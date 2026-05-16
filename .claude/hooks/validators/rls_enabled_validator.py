#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""rls_enabled_validator.py — PostToolUse hook that blocks migration files
creating tables without enabling RLS in either the same file or a sibling
<next-NNNN>_*_rls.sql file.

Known limitations:
- Does not parse DO $$ ... $$ blocks (treats them as opaque SQL text).
- Only handles public. and unprefixed tables; cross-schema migrations are
  out of scope.
"""

import json
import logging
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Logging setup — log file next to this script
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "rls_enabled_validator.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.FileHandler(LOG_FILE, mode="a")],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Matches the leading 4-digit sequence number from a migration filename, e.g.
# "0006_apps.sql" → "0006"
MIGRATION_NUMBER_RE = re.compile(r"^(\d{4})_")

# Matches any CREATE TABLE statement (with optional IF NOT EXISTS and optional
# public. schema prefix), capturing the bare table name.
# Groups: (1) quoted name, (2) unquoted name
CREATE_TABLE_RE = re.compile(
    r"""create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(?:"([a-z_][a-z0-9_]*)"|([a-z_][a-z0-9_]*))""",
    re.IGNORECASE,
)

# Template for matching ALTER TABLE <name> ENABLE ROW LEVEL SECURITY.
# Formatted with the table name before compiling.
_RLS_ENABLE_TEMPLATE = (
    r"""alter\s+table\s+(?:public\.)?\"?{name}\"?\s+enable\s+row\s+level\s+security"""
)


def build_rls_pattern(table_name: str) -> re.Pattern:
    return re.compile(
        _RLS_ENABLE_TEMPLATE.format(name=re.escape(table_name)),
        re.IGNORECASE,
    )


# ---------------------------------------------------------------------------
# Comment stripping
# ---------------------------------------------------------------------------

# Block comment: /* ... */ (non-greedy, dotall)
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
# Line comment: -- to end of line
_LINE_COMMENT_RE = re.compile(r"--[^\n]*")


def strip_sql_comments(sql: str) -> str:
    """Remove -- line comments and /* */ block comments from SQL text."""
    sql = _BLOCK_COMMENT_RE.sub(" ", sql)
    sql = _LINE_COMMENT_RE.sub(" ", sql)
    return sql


# ---------------------------------------------------------------------------
# Core decision helpers
# ---------------------------------------------------------------------------


def allow() -> None:
    print("{}")
    sys.exit(0)


def block(reason: str) -> None:
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


# ---------------------------------------------------------------------------
# Validation logic
# ---------------------------------------------------------------------------


def find_table_names(stripped_sql: str) -> list[str]:
    """Return all table names from CREATE TABLE statements in stripped SQL."""
    names: list[str] = []
    for m in CREATE_TABLE_RE.finditer(stripped_sql):
        name = m.group(1) or m.group(2)
        if name:
            names.append(name)
    return names


def has_rls_enable(stripped_sql: str, table_name: str) -> bool:
    """Return True if the SQL enables RLS for the given table."""
    pattern = build_rls_pattern(table_name)
    return bool(pattern.search(stripped_sql))


def read_stripped(path: Path) -> str | None:
    """Read a file and return comment-stripped content, or None on error."""
    try:
        return strip_sql_comments(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning(f"Could not read {path}: {exc}")
        return None


def validate_migration(file_path: str) -> tuple[str, list[str]]:
    """
    Validate that every CREATE TABLE in the migration has RLS enabled.

    Returns:
        ("allow", []) if everything is satisfied.
        ("warn", [table, ...]) if there are tables with no sibling file yet
            (emit a WARNING to stderr for each, but do not block).
        ("block", [table, ...]) if a sibling file exists but lacks RLS for
            some tables.
    """
    path = Path(file_path)

    if not path.exists():
        logger.info(f"File does not exist yet, skipping: {file_path}")
        return "allow", []

    content = read_stripped(path)
    if content is None:
        logger.warning(f"Could not read {file_path}; failing open")
        return "allow", []

    table_names = find_table_names(content)
    logger.info(f"Found CREATE TABLE targets: {table_names}")

    if not table_names:
        logger.info("No CREATE TABLE statements found — pass")
        return "allow", []

    # Determine the next migration number for sibling lookups.
    # e.g. "0006_apps.sql" → next_num = "0007"
    m = MIGRATION_NUMBER_RE.match(path.name)
    next_prefix: str | None = None
    if m:
        current_num = int(m.group(1))
        next_prefix = f"{current_num + 1:04d}"
    else:
        logger.warning(
            f"Could not determine migration number from filename: {path.name}; "
            "sibling RLS file lookup will be skipped"
        )

    # Collect sibling *_rls.sql files whose name starts with the next number.
    sibling_files: list[Path] = []
    if next_prefix is not None:
        sibling_files = [
            p
            for p in path.parent.iterdir()
            if p.name.startswith(next_prefix) and p.name.endswith("_rls.sql")
        ]
    logger.info(f"Sibling RLS files found: {[p.name for p in sibling_files]}")

    # Read sibling content (stripped) once, keyed by path.
    sibling_contents: dict[Path, str] = {}
    for sibling in sibling_files:
        sc = read_stripped(sibling)
        if sc is not None:
            sibling_contents[sibling] = sc

    warn_tables: list[str] = []
    block_tables: list[str] = []

    for table_name in table_names:
        # 1. Check same file.
        if has_rls_enable(content, table_name):
            logger.info(f"  {table_name}: RLS enabled in same file — satisfied")
            continue

        # 2. Check sibling files.
        if sibling_files:
            found_in_sibling = any(
                has_rls_enable(sc, table_name)
                for sc in sibling_contents.values()
            )
            if found_in_sibling:
                logger.info(
                    f"  {table_name}: RLS enabled in sibling file — satisfied"
                )
                continue
            else:
                # Sibling exists but does not enable RLS for this table → block.
                logger.warning(
                    f"  {table_name}: sibling RLS file exists but does NOT "
                    "enable RLS for this table — BLOCK"
                )
                block_tables.append(table_name)
        else:
            # No sibling yet — emit warning but do not block (chicken-and-egg).
            logger.info(
                f"  {table_name}: no sibling RLS file yet — warn only"
            )
            warn_tables.append(table_name)

    if block_tables:
        return "block", block_tables
    if warn_tables:
        return "warn", warn_tables
    return "allow", []


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    logger.info("=" * 60)
    logger.info("rls_enabled_validator started")

    try:
        try:
            event = json.load(sys.stdin)
            logger.info(f"Received event keys: {list(event.keys())}")
        except (json.JSONDecodeError, EOFError):
            event = {}
            logger.info("No stdin input or invalid JSON — failing open")

        file_path: str = event.get("tool_input", {}).get("file_path", "")
        logger.info(f"file_path: {file_path}")

        # Self-scope: only act on files under packages/db/migrations/ that end
        # in .sql (case-insensitive path check).
        if not re.search(
            r"packages/db/migrations/.*\.sql$", file_path, re.IGNORECASE
        ):
            logger.info("Not a migration SQL file — skipping")
            print("{}")
            sys.exit(0)

        outcome, tables = validate_migration(file_path)

        if outcome == "allow":
            logger.info("Result: PASS")
            print("{}")
            sys.exit(0)

        if outcome == "warn":
            for table_name in tables:
                msg = (
                    f"WARNING: rls_enabled_validator: {table_name} has no RLS yet; "
                    f"expecting it in a sibling *_rls.sql file "
                    f"(will re-check when that file is saved)"
                )
                print(msg, file=sys.stderr)
                logger.warning(msg)
            print("{}")
            sys.exit(0)

        # outcome == "block"
        reason = (
            "RLS_ENABLED CHECK FAILED.\n\n"
            "The following tables are created without enabling Row Level Security:\n"
            + "\n".join(f"  - {t}" for t in tables)
            + "\n\nACTION REQUIRED: Add\n"
            + "\n".join(
                f"  ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY;"
                for t in tables
            )
            + "\neither in this file or in a sibling <next-NNNN>_*_rls.sql migration."
        )
        logger.warning(f"Result: BLOCK — {tables}")
        print(json.dumps({"decision": "block", "reason": reason}))
        sys.exit(0)

    except Exception as exc:
        # Fail open — never crash Claude's tool pipeline.
        logger.exception(f"Unexpected error in rls_enabled_validator: {exc}")
        print("{}")
        sys.exit(0)


if __name__ == "__main__":
    main()

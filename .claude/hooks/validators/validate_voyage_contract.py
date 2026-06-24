#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
PostToolUse validator that enforces the "Voyage voyage-3 / 1024-dim only" contract
for the embeddings feature.

In-scope paths:
  - apps/web/lib/wanted/embeddings/
  - apps/web/lib/wanted/matching/
  - apps/web/app/api/cron/capability-embeddings/
  - packages/db/migrations/0040_   (prefix match on basename)

Forbidden tokens (case-insensitive):
  - vector(1536)           — wrong dimension (voyage-3 uses 1024)
  - text-embedding         — OpenAI embeddings model family
  - openai                 — forbidden embeddings provider identifier
  - voyage-<anything>      — any Voyage model that is NOT exactly "voyage-3"

Outputs:
  - Allow  → print {} and exit 0
  - Block  → print {"decision": "block", "reason": "..."} and exit 0
  - Fail-open on unparseable stdin → print {} and exit 0
"""

import json
import logging
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Logging — log file next to this script
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "validate_voyage_contract.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
    ],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-scope directory prefixes (match against the normalised file path string)
# ---------------------------------------------------------------------------
IN_SCOPE_DIRS = (
    "apps/web/lib/wanted/embeddings/",
    "apps/web/lib/wanted/matching/",
    "apps/web/app/api/cron/capability-embeddings/",
)

# Migration files whose basename starts with this prefix are also in-scope
MIGRATION_PREFIX = "0040_"

# ---------------------------------------------------------------------------
# Forbidden patterns
# ---------------------------------------------------------------------------
# 1. Wrong vector dimension
VECTOR_1536 = re.compile(r"vector\s*\(\s*1536\s*\)", re.IGNORECASE)

# 2. OpenAI embeddings model family
TEXT_EMBEDDING = re.compile(r"text-embedding", re.IGNORECASE)

# 3. OpenAI provider identifier
OPENAI_IDENTIFIER = re.compile(r"\bopenai\b", re.IGNORECASE)

# 4. Any Voyage model name — we match all "voyage-*" tokens then allow only
#    the exact string "voyage-3".  This correctly rejects "voyage-3-lite",
#    "voyage-code-3", "voyage-large-2", etc. while allowing "voyage-3".
#    Pattern: voyage- followed by word chars or hyphens (stops at quotes/spaces/etc.)
ALL_VOYAGE = re.compile(r"\bvoyage-[\w-]+", re.IGNORECASE)


def is_in_scope(file_path: str) -> bool:
    """Return True if the file path falls under an in-scope embeddings path."""
    # Normalise to forward-slash separators for cross-platform robustness
    normalised = file_path.replace("\\", "/")

    for prefix in IN_SCOPE_DIRS:
        if prefix in normalised:
            return True

    # Migration prefix check — match on the basename only
    basename = Path(file_path).name
    if basename.startswith(MIGRATION_PREFIX):
        return True

    return False


def get_written_text(tool_input: dict) -> str:
    """Extract the text that will be written from a Write or Edit tool_input."""
    # Write tool: full file content
    if "content" in tool_input:
        return tool_input["content"]
    # Edit tool: only the replacement string
    if "new_string" in tool_input:
        return tool_input["new_string"]
    return ""


def check_violations(text: str) -> str | None:
    """
    Scan text for contract violations.

    Returns a human-readable violation description, or None if clean.
    """
    m = VECTOR_1536.search(text)
    if m:
        return (
            f"Spec E1 violation: only Voyage voyage-3 (1024 dims) is permitted. "
            f"Found {m.group(0)!r} — voyage-3 requires vector(1024), not vector(1536). "
            f"See 2026-06-23-wanted-embeddings-design.md."
        )

    m = TEXT_EMBEDDING.search(text)
    if m:
        return (
            f"Spec E1 violation: only Voyage voyage-3 (1024 dims) is permitted. "
            f"Found {m.group(0)!r} — OpenAI 'text-embedding' model family is forbidden. "
            f"See 2026-06-23-wanted-embeddings-design.md."
        )

    m = OPENAI_IDENTIFIER.search(text)
    if m:
        return (
            f"Spec E1 violation: only Voyage voyage-3 (1024 dims) is permitted. "
            f"Found {m.group(0)!r} — OpenAI is a forbidden embeddings provider. "
            f"See 2026-06-23-wanted-embeddings-design.md."
        )

    for m in ALL_VOYAGE.finditer(text):
        token = m.group(0)
        if token.lower() != "voyage-3":
            return (
                f"Spec E1 violation: only Voyage voyage-3 (1024 dims) is permitted. "
                f"Found {token!r} — only 'voyage-3' is allowed, not other Voyage variants. "
                f"See 2026-06-23-wanted-embeddings-design.md."
            )

    return None


def main():
    logger.info("=" * 60)
    logger.info("Voyage contract validator started")

    try:
        # ------------------------------------------------------------------
        # 1. Parse stdin — fail-open on unparseable input
        # ------------------------------------------------------------------
        try:
            input_data = json.load(sys.stdin)
            logger.info(f"Stdin received: {json.dumps(input_data)[:500]}")
        except (json.JSONDecodeError, EOFError):
            logger.info("Unparseable or empty stdin — failing open")
            print(json.dumps({}))
            sys.exit(0)

        # ------------------------------------------------------------------
        # 2. Only inspect Write and Edit tool calls
        # ------------------------------------------------------------------
        tool_name = input_data.get("tool_name", "")
        if tool_name not in ("Write", "Edit"):
            logger.info(f"Tool '{tool_name}' not in scope — allowing")
            print(json.dumps({}))
            sys.exit(0)

        # ------------------------------------------------------------------
        # 3. Extract file_path and check scope
        # ------------------------------------------------------------------
        tool_input = input_data.get("tool_input", {})
        file_path = tool_input.get("file_path", "")

        logger.info(f"tool_name={tool_name}, file_path={file_path!r}")

        if not file_path or not is_in_scope(file_path):
            logger.info(f"Out of scope — allowing: {file_path!r}")
            print(json.dumps({}))
            sys.exit(0)

        # ------------------------------------------------------------------
        # 4. Scan the written text for violations
        # ------------------------------------------------------------------
        text = get_written_text(tool_input)
        if not text:
            logger.info("Empty written text — allowing")
            print(json.dumps({}))
            sys.exit(0)

        violation = check_violations(text)
        if violation:
            logger.warning(f"BLOCK: {violation}")
            print(json.dumps({"decision": "block", "reason": violation}))
            sys.exit(0)

        logger.info(f"PASS: no contract violations in {file_path!r}")
        print(json.dumps({}))
        sys.exit(0)

    except Exception as e:
        # Fail-open on unexpected errors
        logger.exception(f"Unexpected validation error: {e}")
        print(json.dumps({}))
        sys.exit(0)


if __name__ == "__main__":
    main()

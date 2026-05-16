#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
PostToolUse validator that checks EN/ES i18n message catalogues for key parity.

When a write/edit targets apps/web/messages/en.json or apps/web/messages/es.json,
verifies that:
- Both files have identical fully-qualified dotted key trees
- Both files have the same empty namespaces (no dangling empty dicts)
- Every leaf value is a string
- Both files are valid JSON (parse errors block, not silently swallowed)

Reads hook input from stdin JSON, extracts tool_input.file_path,
and outputs a decision JSON object.
"""

import json
import logging
import sys
from pathlib import Path


class JsonParseError(Exception):
    """Raised when one of the message files cannot be parsed as JSON."""

    def __init__(self, file_name: str, error: json.JSONDecodeError):
        self.file_name = file_name
        self.error = error
        super().__init__(f"JSON parse error in {file_name}: {error}")

# Logging setup - log file next to this script
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "i18n_key_parity.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, mode='a'),
    ]
)
logger = logging.getLogger(__name__)

# Suffixes that trigger this validator
EN_SUFFIX = "apps/web/messages/en.json"
ES_SUFFIX = "apps/web/messages/es.json"


def collect_keys(
    data, prefix: str = ""
) -> tuple[set[str], set[str], list[tuple[str, str]]]:
    """
    Walk a JSON tree recursively and collect fully-qualified dotted key paths.

    Args:
        data: Parsed JSON value (dict at top level).
        prefix: Current dotted path prefix.

    Returns:
        tuple:
            leaf_paths: set[str] of dotted paths that bottom out at a value.
            empty_paths: set[str] of dotted paths that bottom out at an empty dict.
            non_string_leaves: list[(path, type_name)] for non-string leaves.
    """
    leaves: set[str] = set()
    empty_paths: set[str] = set()
    non_string: list[tuple[str, str]] = []

    if isinstance(data, dict):
        if not data and prefix:
            # Empty namespace — record at the prefix so parity diff can flag it.
            empty_paths.add(prefix)
            return leaves, empty_paths, non_string
        for key, value in data.items():
            child_prefix = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                sub_leaves, sub_empty, sub_non_string = collect_keys(value, child_prefix)
                leaves |= sub_leaves
                empty_paths |= sub_empty
                non_string.extend(sub_non_string)
            else:
                leaves.add(child_prefix)
                if not isinstance(value, str):
                    non_string.append((child_prefix, type(value).__name__))
    else:
        # Top-level non-dict — treat the prefix itself as a leaf
        if prefix:
            leaves.add(prefix)
            if not isinstance(data, str):
                non_string.append((prefix, type(data).__name__))

    return leaves, empty_paths, non_string


def load_json(path: Path):
    """
    Load a JSON file.

    Returns {} if the file does not exist (by design — supports new-file flows).
    Raises JsonParseError on malformed JSON so the caller can block with a clear
    message instead of treating bogus data as empty.
    """
    if not path.exists():
        logger.info(f"File does not exist, treating as empty: {path}")
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error in {path}: {e}")
        raise JsonParseError(path.name, e) from e
    except OSError as e:
        logger.warning(f"Failed to read {path}: {e}. Treating as empty.")
        return {}


def validate_parity(triggered_path: Path) -> tuple[bool, str]:
    """
    Validate EN/ES key parity given the triggered file path.

    Args:
        triggered_path: Path to en.json or es.json that triggered the hook.

    Returns:
        tuple: (is_valid: bool, message: str)

    Raises:
        JsonParseError: When either file is malformed JSON. The caller should
            translate this into a block decision with a precise reason.
    """
    directory = triggered_path.parent
    en_path = directory / "en.json"
    es_path = directory / "es.json"

    en_data = load_json(en_path)
    es_data = load_json(es_path)

    en_keys, en_empty, en_non_string = collect_keys(en_data)
    es_keys, es_empty, es_non_string = collect_keys(es_data)

    # A populated namespace on one side and an empty/missing one on the other
    # must surface as an empty-namespace problem, not as a generic "missing key"
    # diff. We subtract empty paths so they don't double-count.
    en_missing_in_es = sorted((en_keys - es_keys) - es_empty)
    es_missing_in_en = sorted((es_keys - en_keys) - en_empty)

    en_empty_only = sorted(en_empty - es_empty)
    es_empty_only = sorted(es_empty - en_empty)

    non_string_leaves = (
        [("en.json", path, t) for path, t in en_non_string]
        + [("es.json", path, t) for path, t in es_non_string]
    )

    no_key_diff = not en_missing_in_es and not es_missing_in_en
    no_empty_diff = not en_empty_only and not es_empty_only
    if no_key_diff and no_empty_diff and not non_string_leaves:
        return True, "EN/ES key parity OK"

    # Diagnose: empty-namespace-only divergence gets its own headline so the
    # caller isn't misled into thinking real keys are missing.
    only_empty_cause = (
        no_key_diff and not non_string_leaves and (en_empty_only or es_empty_only)
    )
    if only_empty_cause:
        headline = (
            "i18n key parity violation (empty namespace mismatch):\n"
            "One side has an empty {} namespace where the other side has populated keys."
        )
    else:
        headline = "i18n key parity violation:"

    reason = (
        f"{headline}\n"
        f"EN missing in ES (first 10): {en_missing_in_es[:10]}\n"
        f"ES missing in EN (first 10): {es_missing_in_en[:10]}\n"
        f"Empty namespaces only in EN (first 10): {en_empty_only[:10]}\n"
        f"Empty namespaces only in ES (first 10): {es_empty_only[:10]}\n"
        f"Non-string leaves (first 10): {non_string_leaves[:10]}\n"
        "Both message files must have identical key trees with string leaves "
        "and matching empty namespaces."
    )
    return False, reason


def main():
    """Main entry point for the i18n key parity validator."""
    logger.info("=" * 60)
    logger.info("i18n key parity validator started")

    try:
        # Read hook input from stdin
        try:
            input_data = json.load(sys.stdin)
            logger.info(f"Stdin input received: {json.dumps(input_data)[:500]}")
        except (json.JSONDecodeError, EOFError):
            input_data = {}
            logger.info("No stdin input or invalid JSON")

        # Extract file_path from tool_input
        tool_input = input_data.get("tool_input", {})
        file_path = tool_input.get("file_path", "")

        logger.info(f"File path from tool_input: {file_path}")

        # Silent pass unless the path ends with one of the message files
        if not (file_path.endswith(EN_SUFFIX) or file_path.endswith(ES_SUFFIX)):
            logger.info(f"Not an EN/ES message file, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        triggered_path = Path(file_path)

        try:
            is_valid, message = validate_parity(triggered_path)
        except JsonParseError as parse_err:
            # Surface the parse failure as a block with a precise reason so the
            # author can fix the malformed file directly instead of chasing a
            # bogus "missing keys" diff.
            reason = (
                f"JSON parse error in {parse_err.file_name}: {parse_err.error}\n"
                "Fix the malformed JSON before parity can be checked."
            )
            logger.warning(f"BLOCK (parse error): {reason}")
            print(json.dumps({"decision": "block", "reason": reason}))
            sys.exit(0)

        if is_valid:
            logger.info(f"PASS: {message}")
            print(json.dumps({}))
            sys.exit(0)
        else:
            logger.warning(f"BLOCK: {message}")
            print(json.dumps({"decision": "block", "reason": message}))
            sys.exit(0)

    except Exception as e:
        # On unexpected error, allow through but log so a hook bug never
        # blocks the user. JsonParseError is handled above and never reaches
        # this catch-all.
        logger.exception(f"Validation error: {e}")
        print(json.dumps({}))
        sys.exit(0)


if __name__ == "__main__":
    main()

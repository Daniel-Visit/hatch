#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
PreToolUse validator that blocks Tailwind utility classes from being introduced
into prototype-port component files under apps/web/app/_components/*.tsx.

These files must keep their original className strings from the prototype and
must NOT be translated to Tailwind utilities.
"""

import json
import logging
import re
import sys
from pathlib import Path

# Logging setup - log file next to this script
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "no_tailwind_in_prototype_port.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
    ],
)
logger = logging.getLogger(__name__)

# Matches Tailwind utility classes inside className="..."
# text- exclusions: allow text-2xl, text-sm, text-lg, text-xl, text-base,
#                   text-left, text-right, text-center (non-Tailwind-specific)
TAILWIND_PATTERN = re.compile(
    r'className="[^"]*'
    r'(bg-'
    r'|text-(?!2xl|sm|lg|xl|base|left|right|center)'
    r'|p-[0-9]'
    r'|m-[0-9]'
    r'|flex\s'
    r'|grid\s'
    r'|rounded-'
    r'|shadow-'
    r'|hover:'
    r'|md:'
    r'|lg:'
    r'|dark:'
    r')'
)


def get_content(tool_input: dict, file_path: str) -> str:
    """Return the content that will be written, with fallback to reading from disk."""
    # Write tool provides content directly
    if "content" in tool_input:
        return tool_input["content"]
    # Edit tool provides new_string
    if "new_string" in tool_input:
        return tool_input["new_string"]
    # Fallback: read from disk
    path = Path(file_path)
    if path.exists():
        return path.read_text()
    return ""


def main():
    logger.info("=" * 60)
    logger.info("No-Tailwind-in-prototype-port validator started")

    try:
        try:
            input_data = json.load(sys.stdin)
            logger.info(f"Stdin input received: {json.dumps(input_data)[:500]}")
        except (json.JSONDecodeError, EOFError):
            input_data = {}
            logger.info("No stdin input or invalid JSON")

        tool_input = input_data.get("tool_input", {})
        file_path = tool_input.get("file_path", "")

        logger.info(f"File path from tool_input: {file_path}")

        path = Path(file_path)

        # Only apply to .tsx files under apps/web/app/_components/
        if path.suffix != ".tsx":
            logger.info(f"Not a .tsx file, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        parts = path.parts
        if "_components" not in parts:
            logger.info(f"Not under _components/, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        # Verify the _components dir is under apps/web/app/
        comp_idx = parts.index("_components")
        if comp_idx < 3 or parts[comp_idx - 1] != "app":
            logger.info(f"_components not under app/, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        content = get_content(tool_input, file_path)
        if not content:
            logger.info("Empty content, allowing")
            print(json.dumps({}))
            sys.exit(0)

        match = TAILWIND_PATTERN.search(content)
        if match:
            snippet = match.group(0)[:120]
            reason = (
                f"port file {file_path} contains Tailwind utility class match: "
                f"{snippet!r} — prototype components must keep their original "
                f"className strings, no Tailwind translation"
            )
            logger.warning(f"BLOCK: {reason}")
            print(json.dumps({"decision": "block", "reason": reason}))
            sys.exit(0)

        logger.info(f"PASS: no Tailwind utilities found in {file_path}")
        print(json.dumps({}))
        sys.exit(0)

    except Exception as e:
        logger.exception(f"Validation error: {e}")
        print(json.dumps({}))
        sys.exit(0)


if __name__ == "__main__":
    main()

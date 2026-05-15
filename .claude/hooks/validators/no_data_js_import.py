#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
PreToolUse validator that blocks imports of the prototype data.js mock file
from any .tsx/.ts file under apps/web/app/.

Prototype data.js is a static mock; wired pages must query Supabase via
createSupabaseServerClient() instead.
"""

import json
import logging
import re
import sys
from pathlib import Path

# Logging setup - log file next to this script
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "no_data_js_import.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
    ],
)
logger = logging.getLogger(__name__)

# Matches: from '...data.js' or from "...data.js"
DATA_JS_IMPORT = re.compile(r"""from\s+['"][^'"]*data\.js['"]""")


def get_content(tool_input: dict, file_path: str) -> str:
    """Return the content that will be written, with fallback to reading from disk."""
    if "content" in tool_input:
        return tool_input["content"]
    if "new_string" in tool_input:
        return tool_input["new_string"]
    path = Path(file_path)
    if path.exists():
        return path.read_text()
    return ""


def main():
    logger.info("=" * 60)
    logger.info("No-data.js-import validator started")

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

        # Only apply to .tsx and .ts files
        if path.suffix not in {".tsx", ".ts"}:
            logger.info(f"Not a .tsx/.ts file, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        # Only apply to files under apps/web/app/
        parts = path.parts
        if "app" not in parts:
            logger.info(f"Not under app/, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        app_idx = parts.index("app")
        # Verify the path contains apps/web/app
        if app_idx < 2 or parts[app_idx - 1] != "web" or parts[app_idx - 2] != "apps":
            logger.info(f"Not under apps/web/app/, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        content = get_content(tool_input, file_path)
        if not content:
            logger.info("Empty content, allowing")
            print(json.dumps({}))
            sys.exit(0)

        match = DATA_JS_IMPORT.search(content)
        if match:
            reason = (
                "do not import the prototype data.js mock from a wired page — "
                "query Supabase via createSupabaseServerClient() instead"
            )
            logger.warning(f"BLOCK: {reason} | match: {match.group(0)!r}")
            print(json.dumps({"decision": "block", "reason": reason}))
            sys.exit(0)

        logger.info(f"PASS: no data.js import found in {file_path}")
        print(json.dumps({}))
        sys.exit(0)

    except Exception as e:
        logger.exception(f"Validation error: {e}")
        print(json.dumps({}))
        sys.exit(0)


if __name__ == "__main__":
    main()

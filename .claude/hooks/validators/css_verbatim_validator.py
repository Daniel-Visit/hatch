#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
PreToolUse validator that ensures prototype CSS files are byte-for-byte identical
to their source counterparts in the prototype/apps-gallery/ directory.

Applies to Write|Edit on any file matching apps/web/app/styles/prototype-*.css.

Mapping:
  prototype-base.css      ↔  prototype/apps-gallery/styles.css
  prototype-cards.css     ↔  prototype/apps-gallery/styles-cards.css
  prototype-screens.css   ↔  prototype/apps-gallery/styles-screens.css
  prototype-contact.css   ↔  prototype/apps-gallery/contact-styles.css
"""

import filecmp
import json
import logging
import sys
from pathlib import Path

# Logging setup - log file next to this script
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "css_verbatim_validator.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a"),
    ],
)
logger = logging.getLogger(__name__)

# Rename rules: target filename → source filename within its directory
FILENAME_MAP = {
    "prototype-base.css": "styles.css",
    "prototype-cards.css": "styles-cards.css",
    "prototype-screens.css": "styles-screens.css",
    "prototype-contact.css": "contact-styles.css",
}


def main():
    logger.info("=" * 60)
    logger.info("CSS verbatim validator started")

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

        target = Path(file_path)

        # Only care about files under apps/web/app/styles/prototype-*.css
        parts = target.parts
        if (
            "apps" not in parts
            or target.suffix != ".css"
            or not target.name.startswith("prototype-")
        ):
            logger.info(f"Not a prototype CSS file, skipping: {file_path}")
            print(json.dumps({}))
            sys.exit(0)

        # Also verify it is in the expected styles directory
        try:
            # Check if the path contains the expected segment
            styles_idx = None
            for i, part in enumerate(parts):
                if part == "styles":
                    styles_idx = i
                    break
            if styles_idx is None or parts[styles_idx - 1] != "app":
                logger.info(f"Not under apps/web/app/styles/, skipping: {file_path}")
                print(json.dumps({}))
                sys.exit(0)
        except Exception:
            print(json.dumps({}))
            sys.exit(0)

        source_filename = FILENAME_MAP.get(target.name)
        if source_filename is None:
            logger.info(f"No mapping for {target.name}, skipping")
            print(json.dumps({}))
            sys.exit(0)

        # Resolve the source path: repo-root/prototype/apps-gallery/<source_filename>
        # Walk up from the target to find the repo root (contains prototype/ dir)
        repo_root = target.parent
        for _ in range(10):
            if (repo_root / "prototype").is_dir():
                break
            repo_root = repo_root.parent
        else:
            logger.info("Could not find repo root with prototype/ dir, allowing")
            print(json.dumps({}))
            sys.exit(0)

        source = repo_root / "prototype" / "apps-gallery" / source_filename

        logger.info(f"Target: {target}")
        logger.info(f"Source: {source}")

        if not source.exists():
            logger.info(f"Source does not exist, allowing: {source}")
            print(json.dumps({}))
            sys.exit(0)

        if not target.exists():
            logger.info(f"Target does not exist yet, cannot compare — allowing: {target}")
            print(json.dumps({}))
            sys.exit(0)

        if filecmp.cmp(str(target), str(source), shallow=False):
            logger.info("PASS: files are byte-for-byte identical")
            print(json.dumps({}))
            sys.exit(0)
        else:
            reason = (
                f"prototype CSS must be byte-for-byte identical to source — "
                f"{target} vs {source}"
            )
            logger.warning(f"BLOCK: {reason}")
            print(json.dumps({"decision": "block", "reason": reason}))
            sys.exit(0)

    except Exception as e:
        logger.exception(f"Validation error: {e}")
        print(json.dumps({}))
        sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
VAPID Private Key Client Leak Validator for Claude Code PostToolUse Hook

Blocks two classes of security violations:

1. Any .ts/.tsx file under apps/web/ that contains BOTH `VAPID_PRIVATE_KEY`
   AND a `'use client'` or `"use client"` directive — the private key would
   be bundled into the browser JS.

2. Any reference to `VAPID_PRIVATE_KEY` from a path other than
   `apps/web/lib/push/server.ts` — the key must live only in that one
   server-only module.

Outputs JSON decision for Claude Code PostToolUse hook:
- {"decision": "block", "reason": "..."} to block and retry
- {} to allow completion
"""
import json
import logging
import sys
from pathlib import Path

# Logging setup - log file next to this script
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "no_vapid_private_in_client.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.FileHandler(LOG_FILE, mode='a')]
)
logger = logging.getLogger(__name__)

# The one server-only module allowed to reference VAPID_PRIVATE_KEY
ALLOWED_PATH_SUFFIX = "apps/web/lib/push/server.ts"

# The dangerous key name
VAPID_KEY = "VAPID_PRIVATE_KEY"

# client-side directive patterns
USE_CLIENT_VARIANTS = ('"use client"', "'use client'")


def normalise_path(raw: str) -> str:
    """Strip leading ./ or / so we can do suffix matching."""
    return raw.lstrip("./")


def extract_content(hook_input: dict) -> str:
    """
    Return the file content string from either a Write or Edit tool call.

    Write passes: tool_input.content
    Edit passes:  tool_input.new_string
    """
    tool_input = hook_input.get("tool_input", {})
    content = tool_input.get("content") or tool_input.get("new_string") or ""
    return content


def main() -> None:
    logger.info("=" * 50)
    logger.info("NO_VAPID_PRIVATE_IN_CLIENT VALIDATOR TRIGGERED")

    try:
        stdin_data = sys.stdin.read()
        if stdin_data.strip():
            hook_input = json.loads(stdin_data)
            logger.info(f"hook_input keys: {list(hook_input.keys())}")
        else:
            hook_input = {}
    except json.JSONDecodeError:
        hook_input = {}

    file_path_raw: str = hook_input.get("tool_input", {}).get("file_path", "")
    logger.info(f"file_path: {file_path_raw}")

    # Only relevant for TypeScript files under apps/web/
    if not (file_path_raw.endswith(".ts") or file_path_raw.endswith(".tsx")):
        logger.info("Skipping non-TypeScript file")
        print(json.dumps({}))
        return

    normalised = normalise_path(file_path_raw)

    if not normalised.startswith("apps/web/"):
        logger.info("Skipping file outside apps/web/")
        print(json.dumps({}))
        return

    content = extract_content(hook_input)

    if not content:
        logger.info("No content to inspect — allowing")
        print(json.dumps({}))
        return

    has_vapid = VAPID_KEY in content
    logger.info(f"contains VAPID_PRIVATE_KEY: {has_vapid}")

    if not has_vapid:
        logger.info("RESULT: PASS — no VAPID_PRIVATE_KEY reference")
        print(json.dumps({}))
        return

    # Rule 2: VAPID_PRIVATE_KEY is only allowed in apps/web/lib/push/server.ts
    if not normalised.endswith(ALLOWED_PATH_SUFFIX):
        reason = (
            f"SECURITY VIOLATION: `VAPID_PRIVATE_KEY` referenced in "
            f"`{file_path_raw}`. "
            f"This key must only appear in `apps/web/lib/push/server.ts` "
            f"(a server-only module). Move it there and consume it via a "
            f"server action or API route."
        )
        logger.info(f"RESULT: BLOCK — wrong file: {file_path_raw}")
        print(json.dumps({"decision": "block", "reason": reason}))
        return

    # Rule 1: even in the allowed file, 'use client' must not appear
    has_use_client = any(directive in content for directive in USE_CLIENT_VARIANTS)
    logger.info(f"contains 'use client': {has_use_client}")

    if has_use_client:
        reason = (
            f"SECURITY VIOLATION: `{file_path_raw}` contains BOTH "
            f"`VAPID_PRIVATE_KEY` AND a `'use client'` directive. "
            f"The VAPID private key would be bundled into the browser JS. "
            f"Remove `'use client'` — this file must remain server-only."
        )
        logger.info("RESULT: BLOCK — use client + VAPID_PRIVATE_KEY co-present")
        print(json.dumps({"decision": "block", "reason": reason}))
        return

    logger.info("RESULT: PASS — VAPID_PRIVATE_KEY in allowed server-only file")
    print(json.dumps({}))


if __name__ == "__main__":
    main()

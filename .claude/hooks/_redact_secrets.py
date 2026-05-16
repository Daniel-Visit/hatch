#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
Shared secret-redaction helper for hook loggers (HATCH-001 fix).

Applied to every payload before it is serialized to `logs/` or
`agents/hook_logs/` to prevent leakage of Supabase service-role JWTs,
Personal Access Tokens, and other high-entropy bearer credentials that
arrive via user prompts or tool inputs.

Replaces matches in-place with constant `[REDACTED_*]` markers so the
log shape remains parseable.
"""

from __future__ import annotations

import re
from typing import Any

# Three-segment JWT (header.payload.signature) — Supabase keys.
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}")

# Project-issued bearer tokens (hatch_pat_*, Stripe sk_*, Supabase sbp_*).
_BEARER_RE = re.compile(r"(?:hatch_pat_|sk_(?:live|test)_|sbp_)[A-Za-z0-9_-]{20,}")

# GitHub PATs / fine-grained tokens.
_GH_RE = re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}")

# AWS access keys / secret keys.
_AWS_AK_RE = re.compile(r"\bAKIA[0-9A-Z]{16}\b")


def _redact_text(text: str) -> str:
    """Redact every recognized secret pattern inside ``text``."""
    text = _JWT_RE.sub("[REDACTED_JWT]", text)
    text = _BEARER_RE.sub("[REDACTED_BEARER]", text)
    text = _GH_RE.sub("[REDACTED_GH_TOKEN]", text)
    text = _AWS_AK_RE.sub("[REDACTED_AWS_KEY]", text)
    return text


def redact(value: Any) -> Any:
    """Walk arbitrary JSON-shaped data and redact secrets in every string leaf.

    Returns a structurally identical value (dicts stay dicts, lists stay
    lists) with string contents scrubbed. Non-string leaves are returned
    untouched. Tuples are coerced to lists (JSON shape).
    """
    if isinstance(value, str):
        return _redact_text(value)
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact(v) for v in value]
    return value

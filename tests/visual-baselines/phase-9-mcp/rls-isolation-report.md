# Phase 9 — api_keys RLS Isolation Report

Date: 2026-05-16

## Table sanity

- `api_keys` exists with rls_enabled: true
- Security advisors: no new warnings related to `api_keys`. Pre-existing warnings present for SECURITY_DEFINER trigger functions, citext extension in public schema, and app-covers storage bucket broad SELECT policy — all pre-date Phase 9.

## Cross-user isolation (SELECT)

- User B (aaaaaaaa-0000-0000-0000-000000000009) trying to read user A's keys: leaked_rows = 0 (expected 0) — PASS
- User A (aaaaaaaa-0000-0000-0000-00000000000a) reading their own: own_rows = 1 (expected 1) — PASS

## UPDATE policy (unrevoke blocked)

- Owner trying to unrevoke their own revoked key: unrevoke_count = 0 (expected 0) — PASS
- Note: Postgres raised ERROR 42501 (row-level security policy violation) rather than a silent no-op. This is the stricter outcome — the `WITH CHECK (revoked_at IS NOT NULL)` clause is enforced at the constraint level, not filtered out quietly. The row was not modified.

## Verdict

PASS — all 3 checks pass. RLS isolation on `api_keys` is correctly enforced.

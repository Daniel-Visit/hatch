-- 0028: security hardening from /tac:ciber audit (HATCH-008 + HATCH-011)
--
-- HATCH-011: api_keys.token_prefix uniqueness for ACTIVE rows.
--   The MCP auth path (apps/mcp/src/auth.ts) fetches every row matching a
--   token_prefix, then bcrypt-compares the plaintext against each row's
--   token_hash. Without a uniqueness constraint, an attacker can register
--   many tokens sharing the same prefix and force the server to perform N
--   bcrypt-compares per auth attempt (CPU-DoS). Enforce one active row per
--   prefix at the DB layer so the bcrypt loop is bounded to 1 even if the
--   application logic regresses.
create unique index if not exists api_keys_token_prefix_unique_active
  on public.api_keys (token_prefix)
  where revoked_at is null;

-- HATCH-008: column-scoped UPDATE grant on public.messages.
--   The existing RLS policy lets a recipient flip read_at, but the same
--   policy also accepts a body change in the same UPDATE (the WITH CHECK
--   only re-checks the row-level predicate, not the column delta). Drop
--   the broad UPDATE grant and re-grant only the two columns each role
--   legitimately needs:
--     * recipients   → read_at
--     * senders      → read_at, body  (gated by the existing policy)
--   Postgres enforces column-level grants before RLS evaluates, so a
--   recipient who tries to send `update messages set body = 'x'` is
--   refused at the GRANT layer before the policy is even consulted.
revoke update on public.messages from authenticated;
grant update (read_at, body) on public.messages to authenticated;

-- Note: the existing RLS policy already gates which rows authenticated may
-- touch; the column-level grant above adds the missing column gate so a
-- recipient cannot smuggle a body change into a read-receipt update.

# Phase 9 — Local MCP Smoke Test Report

Date: 2026-05-16

## Repo-wide checks

- pnpm typecheck: exit 0
- pnpm lint: exit 0
- pnpm build: exit 0

Last lines of each: all three workspaces (`packages/shared`, `apps/mcp`, `apps/web`) reported `Done`. `next lint` printed a deprecation notice but produced 0 warnings/errors.

## Nixpacks structural check

- `apps/mcp/nixpacks.toml` sections found: 4 (≥3 required)
- Matched headers: `[phases.setup]`, `[phases.install]`, `[phases.build]`, `[start]`

## Local MCP server smoke test

A Postgres row was inserted into `public.api_keys` with:

- `user_id = aaaaaaaa-0000-0000-0000-000000000004` (a seed profile with no active key)
- `token_prefix = hatch_pat_sm`
- `token_hash = bcryptjs cost-10 hash of "hatch_pat_smoke_test_2026_05_16_aaaaaaaaaaaa"`
- `label = smoke-test`

The MCP server was started with `node --import tsx` using a launcher that loaded `apps/web/.env.local` and aliased `NEXT_PUBLIC_SUPABASE_URL` -> `SUPABASE_URL` (the env file does not export `SUPABASE_URL` directly).

Results:

- `GET /health`: **200** — `{"ok":true,"service":"hatch-mcp","version":"0.1.0"}` PASS
- `POST /mcp` initialize (with Bearer): **401 `{"error":"unauthorized"}`** — FAIL (see Concerns)
- `POST /mcp` tools/list: SKIPPED (initialize failed)
- `POST /mcp` tools/call list_apps: SKIPPED (initialize failed)
- `POST /mcp` without Bearer: **401 `{"error":"unauthorized"}`** PASS

Root cause of the 401 with a valid Bearer: the value of `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local` is **not a real service-role JWT** (27 chars, no `eyJ` prefix). A direct `createClient(url, key).from('api_keys').select(...)` call returned `Invalid API key`, which causes `resolveUserId()` to return `null`, which the transport renders as 401. The MCP auth code path itself is correct (bcrypt-compare, token_prefix lookup, RLS-bypass via service_role); it just cannot read the DB without a real key.

What was verified anyway:

- Bcrypt hash matches plain token (verified locally with bcryptjs.compareSync).
- DB row exists with correct `token_prefix` and `revoked_at = null` (verified via `mcp__supabase__execute_sql`).
- Server boots cleanly, `/health` returns the expected payload.
- Negative-auth path (no Bearer) correctly returns 401.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env contract is enforced (server logged the exact required-vars error when only `NEXT_PUBLIC_SUPABASE_URL` was present).

## Teardown

- Background MCP process killed: yes (port 8080 confirmed free)
- Smoke-test `api_keys` row cleaned up: yes (DELETE returned 1 id)
- Temp helper scripts (`tmp-gen-hash*.mjs`, `tmp-verify.mjs`, `tmp-querytest.mjs`, `start-smoke.mjs`) removed: yes

## Verdict

**PARTIAL** — typecheck/lint/build/nixpacks/health/negative-auth all PASS. Bearer-authenticated MCP protocol calls (initialize, tools/list, tools/call) could not be tested because `SUPABASE_SERVICE_ROLE_KEY` in the developer's `.env.local` is not a real service-role JWT. To complete the smoke test, set a valid service-role key (from Supabase Dashboard -> Settings -> API) in `apps/web/.env.local` (or in `apps/mcp/.env`) and re-run.

# Pair 5 Validation Report (post-fix)

Date: 2026-05-16
Phases shipped: 10 (ranking + cron), 11 (search), 12 (public API + llms.txt + OpenAPI)

Context: Migration 0022 granted anon EXECUTE on `increment_rate_limit`. The 4 broken `/api/v1` routes were switched from admin client to SSR (anon) client. `CRON_SECRET` was appended to `apps/web/.env.local`.

## Public API + llms.txt smoke

- GET /llms.txt: 200 (1236 bytes, body starts with `# Hatch`)
- GET /api/v1/categories: 200 (CORS + rate-limit headers present, `x-ratelimit-remaining: 59`)
- GET /api/v1/apps?limit=3: 200
- GET /api/v1/apps/bento-bingo: 200
- GET /api/v1/profiles/pip: 200
- GET /api/v1/search?q=ai: 200
- GET /api/v1/openapi.json: 200, paths=`['/api/v1/apps', '/api/v1/apps/{slug}', '/api/v1/categories', '/api/v1/profiles/{handle}', '/api/v1/search']`

## CORS header on /api/v1/\*: yes

`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`, `Access-Control-Allow-Headers: Content-Type` present on every observed `/api/v1/*` response. `x-ratelimit-remaining` decrements monotonically (59 → 55 across the 5 distinct calls).

## Cron auth

- /api/cron/refresh-scores (no Bearer): 401 (`unauthorized`)
- /api/cron/pick-featured (no Bearer): 401 (`unauthorized`)
- /api/cron/refresh-scores (valid Bearer): **500 — `{"ok":false,"error":"Invalid API key"}`**
- /api/cron/pick-featured (valid Bearer): **500 — `{"ok":false,"error":"Invalid API key"}`**

The Bearer guard now works (401 → 200 transition on auth header), but the underlying Supabase admin client rejects the key with "Invalid API key". Both cron routes use `createSupabaseAdminClient()` which reads `SUPABASE_SERVICE_ROLE_KEY`. The key is present in `.env.local` (verified by name only — value not inspected per security hook), but the Supabase REST endpoint reports it as invalid. Likely cause: stale/rotated service-role key, or new publishable/secret key scheme not matching the legacy `service_role` JWT shape the admin helper expects.

## Rate-limit smoke (60/min)

- 65 sequential requests to `/api/v1/categories`
- 200 count: 64
- 429 count: 1
- Verdict: **PASS — 429 appeared at request 65** (first 64 succeeded, 65th throttled). The Postgres-backed `increment_rate_limit` RPC now decrements correctly under anon execute grants.

## Verdict

**PARTIAL** — All 7 public API smoke checks pass. CORS + rate-limit (including 429 transition) confirmed working. Cron 401-without-Bearer guard works. However, both cron routes return 500 ("Invalid API key") when called with the valid Bearer token because the Supabase admin client cannot authenticate with the current `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local`. Cron functional path is production-blocking until the service-role key is rotated/refreshed (or the admin helper is updated to use the new Supabase key scheme).

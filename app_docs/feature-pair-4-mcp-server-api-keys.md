# Pair 4 — MCP Server + API Keys (Phase 9)

**ADW ID:** `manual-sdlc_planner` (Issue 4)
**Date:** 2026-05-16
**Specification:** `docs/superpowers/specs/2026-05-16-hatch-fase-9-design.md`
**Plan:** `specs/issue-4-adw-manual-sdlc_planner-mcp-server-and-api-keys.md`
**Production URL:** `https://hatch-mcp-production.up.railway.app`

## Overview

Phase 9 turns the previously-stub `apps/mcp` Node service into a fully-featured Model Context Protocol server consumable by Claude Desktop and any MCP client. Auth is via Personal Access Tokens generated from a new `/settings/api-keys` page in the web app. The MCP surface exposes 15 tools (read + publish + social), 3 resources (`hatch://app/{slug}`, `hatch://profile/{handle}`, `hatch://notifications`), and 3 prompts (`draft_app_description`, `review_my_apps`, `compose_message`) over a single Streamable HTTP endpoint (`POST /mcp`). Deploy target is Railway with Nixpacks/Railpack — no Dockerfile in the repo.

## What Was Built

- **MCP server** at `apps/mcp/` rewritten from a `/health` stub: `server.ts`, `transport.ts`, `auth.ts`, `supabase.ts`, `types.ts`, `tools/{read,publish,social}.ts`, `resources/index.ts`, `prompts/index.ts`.
- **Migration `0019_api_keys.sql`**: `api_keys` table (`id, user_id, token_hash, token_prefix, label, created_at, last_used_at, revoked_at`) with RLS scoped to `auth.uid()`, a unique partial index enforcing one active key per user, and a UPDATE policy that allows only flipping `revoked_at` (no unrevoke, no relabel).
- **Server actions** at `apps/web/lib/actions/api-keys.ts`: `generateApiKey()` (creates plain `hatch_pat_*` token, bcryptjs cost-10 hashes it, inserts row, returns plain ONCE) and `revokeApiKey()` (soft-delete via `revoked_at`).
- **`/settings/api-keys` page** with two client components: `generate-key-flow.tsx` (display-once token modal with copy button) and `mcp-config-snippet.tsx` (copyable JSON for Claude Desktop).
- **Cross-package type re-export** so `apps/mcp` can `import type { Database } from '@hatch/shared'` without reaching into `apps/web/lib/supabase/types`.
- **`apps/mcp/nixpacks.toml`** (corepack form) and the **Railpack config** at repo root (`railpack.json`) for Railway deploy.
- **Smoke test guide** at `tests/visual-baselines/phase-9-mcp/README.md` for the manual Claude Desktop verification.
- **Expert YAMLs refreshed**: `mcp-server` bumped from "Phase 2 stub" to "Phase 9 shipped"; `supabase` adds `api_keys` table.

## Technical Implementation

### Files Modified

- `apps/mcp/package.json` — added deps `@supabase/supabase-js`, `bcryptjs`, `@types/bcryptjs`, `zod`.
- `apps/mcp/src/index.ts` — rewrites from `/health` stub to mount BOTH `/health` and `/mcp` (POST) handled by `transport.ts`.
- `apps/mcp/src/transport.ts` — Streamable HTTP transport (`StreamableHTTPServerTransport` from MCP SDK) with per-request fresh server + Bearer→user_id auth gate.
- `apps/mcp/src/auth.ts` — Bearer token resolver: parses `Authorization: Bearer hatch_pat_*`, looks up by `token_prefix`, bcryptjs-compares hash, updates `last_used_at`.
- `apps/mcp/src/server.ts` — MCP `Server` factory that wires 15 tools + 3 resources + 3 prompts via SDK handlers.
- `apps/mcp/src/tools/read.ts` — `list_apps`, `search_apps`, `get_app`, `list_categories`, `get_profile`, `list_notifications`.
- `apps/mcp/src/tools/publish.ts` — `publish_app`, `update_app` (with ownership check that mirrors web's `apps/web/lib/actions/publish.ts`).
- `apps/mcp/src/tools/social.ts` — `like_app`/`unlike_app`, `save_app`/`unsave_app`, `follow_user`/`unfollow_user`, `send_message` (requires accepted `contact_request`, uses `find_or_create_conversation` RPC).
- `apps/mcp/src/resources/index.ts` — URI-addressable resources (`hatch://app/{slug}`, `hatch://profile/{handle}`, `hatch://notifications`).
- `apps/mcp/src/prompts/index.ts` — `draft_app_description`, `review_my_apps`, `compose_message`.
- `packages/shared/src/database.ts` (new) + `packages/shared/src/index.ts` (export added) + `packages/shared/tsconfig.json` (`rootDir` widened to `../..` so cross-package type import compiles).
- `packages/db/migrations/0019_api_keys.sql` — schema + RLS + unique partial index.
- `apps/web/lib/actions/api-keys.ts` — `generateApiKey` + `revokeApiKey` server actions, both returning `Result<T>` discriminated union.
- `apps/web/lib/zod/api-key.ts` — `ApiKeyGenerate` + `ApiKeyRevoke` schemas.
- `apps/web/app/settings/api-keys/page.tsx` + `_components/generate-key-flow.tsx` + `_components/mcp-config-snippet.tsx`.
- `apps/web/package.json` — added bcryptjs deps.

### Key Changes

- **Auth model**: `service_role` Supabase client in MCP server bypasses RLS; ownership/permission enforced manually in every handler. Token comparison uses indexed `token_prefix` lookup (first 12 chars) + bcryptjs `compare` for the match — avoids full-table scan.
- **One active token per user** enforced at DB level via `unique partial index ... where revoked_at is null`. The web action also checks app-side for a clean error code, but the DB is the hard guard.
- **Transport choice**: Streamable HTTP per MCP spec 2025-03-26 (single `POST /mcp` endpoint, supports SSE for streaming). Stateless mode (`sessionIdGenerator: undefined`) — fresh server instance per request.
- **Re-export hop**: `Database` type lives at `apps/web/lib/supabase/types.ts` (regenerated via Supabase MCP). `packages/shared/src/database.ts` re-exports it so `apps/mcp` and any future consumer can import via `@hatch/shared`. This required widening `packages/shared/tsconfig.json` `rootDir` to `../..`.
- **Deploy**: Railway uses Railpack (modern Nixpacks variant). The `railpack.json` at repo root tells the builder to `pnpm install` at workspace root, `pnpm --filter mcp build`, then `pnpm --filter mcp start`.

## How to Use

### Generate an API key (UI)

1. Sign in to the Hatch web app.
2. Navigate to `/settings/api-keys`.
3. Click **Generate API Key**. The plain token (`hatch_pat_<43-chars>`) is shown once in an amber panel — copy it.
4. The page also shows a copyable `mcp-config.json` snippet pre-filled with the MCP URL. Replace `<paste-your-token>` with the plain token.

### Wire Claude Desktop

1. Open Claude Desktop → Settings → Developer → Edit Config.
2. Paste the snippet from `/settings/api-keys`. Save.
3. Restart Claude Desktop.
4. In a new conversation, the `hatch` MCP server should connect (plugin icon shows it).

### Available MCP capabilities

**Tools (15):**

- `list_apps`, `search_apps`, `get_app`, `list_categories`, `get_profile`, `list_notifications`
- `publish_app`, `update_app`
- `like_app`, `unlike_app`, `save_app`, `unsave_app`, `follow_user`, `unfollow_user`, `send_message`

**Resources (3):** `hatch://app/{slug}`, `hatch://profile/{handle}`, `hatch://notifications`.

**Prompts (3):** `draft_app_description`, `review_my_apps`, `compose_message`.

### Revoke

Click **Revoke** on `/settings/api-keys`. The DB UPDATE policy only allows flipping `revoked_at` from NULL → timestamp; unrevoke is impossible (intentional v1 limitation).

## Configuration

### Env vars (Railway)

- `SUPABASE_URL` = `https://vcbdtjjkkwryvmqbflah.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (service-role JWT from Supabase Dashboard → Settings → API)
- `LOG_LEVEL` = `info`
- `PORT` — Railway injects automatically.

### Env vars (Vercel — web app needs this to render the config snippet)

- `NEXT_PUBLIC_MCP_URL` = `https://<railway-domain>/mcp`

## Testing

### Local smoke

```bash
pnpm dev:mcp                                                      # boots on :8080
curl -i http://localhost:8080/health                              # → 200 {"ok":true,...}
curl -i -X POST http://localhost:8080/mcp                          # → 401 (no Bearer)
curl -i -X POST http://localhost:8080/mcp \
  -H "Authorization: Bearer hatch_pat_<plain>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
```

### Cloud verification

- `https://hatch-mcp-production.up.railway.app/health` → 200.
- RLS isolation verified via `mcp__supabase__execute_sql` with `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '...'` (see `tests/visual-baselines/phase-9-mcp/rls-isolation-report.md`).

### Claude Desktop

Follow `tests/visual-baselines/phase-9-mcp/README.md` (manual gate — drop screenshots `01-list-apps.png` … `06-auth-negative.png` into that directory).

## Notes

- **Out of scope (v1)**: scoped tokens (read/write/social separated), multiple labeled tokens per user, audit log of MCP invocations, per-token rate limiting, OAuth2 flow, AI tools (`summarize_app`, `suggest_tags`).
- **`api_keys` table grants no client-side DELETE policy** — soft-delete only.
- **No DB-level relabel allowed**: the UPDATE `with check (revoked_at IS NOT NULL)` blocks any update that leaves `revoked_at` NULL. Intentional v1 lock-in; a future migration can relax it.
- **bcryptjs cost 10 chosen** (~75ms per compare) — 256-bit token entropy means higher cost is unnecessary.
- **Logging hygiene**: `auth.ts` never logs plain tokens or hashes; logging `token_prefix` is OK (not sensitive on its own).

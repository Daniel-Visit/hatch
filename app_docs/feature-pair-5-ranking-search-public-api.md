# Pair 5 — Ranking + Search + Public API (Phases 10+11+12)

**ADW ID:** `manual-sdlc_planner` (Issue 5)
**Date:** 2026-05-16
**Specification:** None (decisions captured in conversation; spec embedded in plan)
**Plan:** `specs/issue-5-adw-manual-sdlc_planner-ranking-search-public-api.md`
**Production URL:** `https://hatch-brown.vercel.app`

## Overview

Pair 5 closes three phases of the SPEC in one pass: hot-score ranking with periodic refresh, full-text search wired to the topbar, and a public read-only REST API (`/api/v1/*`) with rate-limiting, llms.txt index, and auto-generated OpenAPI spec. Cero servicios externos — rate-limit is a Postgres counter table, schedules use Supabase pg_cron (migration 0023), search reuses the `search_vector` column shipped in Phase 3.

## What Was Built

### Phase 10 — Ranking + cron

- **Migration `0020_ranking.sql`**: IMMUTABLE function `compute_hot_score(likes, comments, saves, published)` (Reddit-style time-decay), SECURITY DEFINER `refresh_hot_scores()` (recomputes all published rows), SECURITY DEFINER `pick_featured_app()` (weekly winner), `featured_apps` table with RLS.
- **Migration `0023_pg_cron_schedule_ranking.sql`**: enables `pg_cron`, schedules `refresh-hot-scores` every 15 min and `pick-featured-app` Mondays 09:00 UTC. Runs inside Postgres, no external scheduler (Vercel Hobby plan only allows daily crons).
- **Fire-and-forget refresh** wired into `apps/web/lib/actions/like.ts`, `save.ts`, `comment.ts` — after every toggle/insert, `void sb.rpc('refresh_hot_scores').then(() => {}, () => {})` so volatile scores update immediately without blocking the user action.
- **`<FeaturedHero>` re-cabled** in `apps/web/app/page.tsx` to fetch from `featured_apps` joined to `apps` for the current Monday-anchored week, with a fallback to top-3 by `hot_score` when no winner picked yet.
- **`/trending`** Server Component — apps published in last 7 days ordered by `hot_score desc`, limit 60.
- **`/following`** Server Component (auth-gated via `requireUser()`) — apps from people you follow, ordered by `published_at desc`, limit 60. Empty state with link back to discover.
- **Cron route handlers** at `apps/web/app/api/cron/{refresh-scores,pick-featured}/route.ts` — `Authorization: Bearer ${CRON_SECRET}` gate, returns 401 without; calls the respective RPC. Kept for manual triggering even though pg_cron now drives the schedule.

### Phase 11 — Search

- **`apps/web/lib/zod/search.ts`** → `SearchInput { query: string (min 2), limit?: number }`.
- **`apps/web/lib/actions/search.ts`** → `searchApps({ query, limit })` server action; uses Supabase `.textSearch('search_vector', query, { type: 'plain', config: 'simple' })` (the column was created in migration 0006 with weighted tsvector). Orders by `hot_score desc`. Returns `SearchResultApp[]` with author joined.
- **`apps/web/app/search/page.tsx`** Server Component — reads `?q=`, calls `searchApps`, renders results with the existing prototype gallery markup (same `gallery dens-default style-bento` classes used by `/c/[category]`).
- **Topbar input wired**: `apps/web/app/_components/shell.tsx` wraps the existing search `<input>` in `<form action="/search" method="get">` with `name="q"`. Zero className changes — prototype-port file preserved verbatim per `.claude/rules/prototype-port-exception.md`.

### Phase 12 — Public API + llms.txt + OpenAPI

- **Migration `0021_api_rate_limits.sql`**: `api_rate_limits (ip, bucket_start, count, PK (ip, bucket_start))` + SECURITY DEFINER `increment_rate_limit(ip, bucket_start) RETURNS int` (atomic upsert-and-increment). No client-side policies — only callable via the RPC.
- **Migration `0022_rate_limit_anon_grant.sql`**: `GRANT EXECUTE ON FUNCTION increment_rate_limit ... TO anon, authenticated` so the public API routes (using anon SSR client) can rate-limit themselves.
- **`apps/web/lib/rate-limit.ts`** → `checkRateLimit(ip)` calls the RPC; returns `{ ok, remaining, resetAt }`. Fail-open on DB errors (legit users never blocked by transient infra glitches). `ipFromRequest(req)` extracts `x-forwarded-for` → `x-real-ip` → `'unknown'`.
- **5 read-only endpoints** under `apps/web/app/api/v1/*/route.ts`:
  - `GET /api/v1/apps` — paginated list (cursor by `published_at`), optional `?category=&limit=`.
  - `GET /api/v1/apps/[slug]` — single app + author.
  - `GET /api/v1/profiles/[handle]` — profile + their published apps.
  - `GET /api/v1/categories` — all categories ordered by `sort_order`.
  - `GET /api/v1/search?q=` — reuses `searchApps` action.
  - All endpoints: CORS `*`, `X-RateLimit-Remaining`/`Reset` headers, `OPTIONS` preflight handler.
- **`apps/web/app/llms.txt/route.ts`** — static text response per llmstxt.org format. Lists discover/trending/category/app/profile URLs plus the public API + MCP info.
- **`apps/web/app/api/v1/openapi.json/route.ts`** — generates OpenAPI 3 from the Zod schemas in `lib/zod/api.ts` via `@asteasolutions/zod-to-openapi`.

## Technical Implementation

### Files Modified

- `packages/db/migrations/0020_ranking.sql` (new)
- `packages/db/migrations/0021_api_rate_limits.sql` (new)
- `packages/db/migrations/0022_rate_limit_anon_grant.sql` (new — fix: grants `anon, authenticated` execute on the RPC so non-admin routes work)
- `packages/db/migrations/0023_pg_cron_schedule_ranking.sql` (new — applied via MCP `apply_migration`)
- `apps/web/lib/supabase/types.ts` — regenerated after each migration.
- `apps/web/lib/zod/search.ts`, `apps/web/lib/zod/api.ts` (new Zod schemas).
- `apps/web/lib/actions/search.ts` (new server action).
- `apps/web/lib/actions/{like,save,comment}.ts` — appended fire-and-forget RPC.
- `apps/web/lib/rate-limit.ts` (new helper).
- `apps/web/app/page.tsx` — FeaturedHero data fetch swapped to `featured_apps` join + hot_score fallback.
- `apps/web/app/_components/shell.tsx` — topbar input wrapped in `<form>`.
- `apps/web/app/search/page.tsx`, `apps/web/app/trending/page.tsx`, `apps/web/app/following/page.tsx` (new pages).
- `apps/web/app/llms.txt/route.ts` (new).
- `apps/web/app/api/cron/refresh-scores/route.ts`, `apps/web/app/api/cron/pick-featured/route.ts` (new).
- `apps/web/app/api/v1/{apps,apps/[slug],profiles/[handle],categories,search,openapi.json}/route.ts` (5 new + openapi).
- `apps/web/package.json` — added `@asteasolutions/zod-to-openapi`.
- `vercel.json` — cleaned (cron schedule moved to pg_cron); just `$schema` reference now.
- `railpack.json` (new at repo root) — tells Railway/Railpack to install workspace deps + build/start MCP only (Vercel deploy not affected).
- Expert YAMLs refreshed: `supabase` adds 3 migrations + `featured_apps`/`api_rate_limits` tables + 4 functions; `nextjs` adds Phase 5 routes block, rate-limit helper note, new schemas, env vars (CRON_SECRET), and `@asteasolutions/zod-to-openapi` dep.

### Key Changes

- **Rate-limit fix mid-build**: the initial 5 API routes used `createSupabaseAdminClient()` for queries, but local `.env.local` had the anon key labeled as service-role → "Invalid API key" errors. Switched all 4 read-only routes (`/api/v1/apps`, `/api/v1/apps/[slug]`, `/api/v1/profiles/[handle]`, `/api/v1/categories`) to `createSupabaseServerClient` (anon, RLS-respecting — public-read tables are accessible). The `/api/v1/search` route already used the anon-respecting search action. The rate-limit helper also switched to anon client; this required `0022_rate_limit_anon_grant.sql` to GRANT EXECUTE on the RPC.
- **Vercel Hobby cron limit hit**: `*/15 * * * *` violates the "daily only" rule. Solution: drop `vercel.json` crons entirely, schedule both jobs via Supabase pg_cron (migration 0023). The `/api/cron/*` routes are kept for manual triggering with `Authorization: Bearer ${CRON_SECRET}`.
- **Monorepo Vercel build**: required Project Settings dashboard toggle: Root Directory = `apps/web` + "Include source files outside of the Root Directory in the Build Step" = ON. Without it, Vercel runs `npm install` from `apps/web/` and fails on `"workspace:*"`. With it, Vercel runs `pnpm install` at workspace root and builds from `apps/web/`.
- **Pre-build trace mistake avoided**: tried `vercel deploy --prebuilt` initially; failed because Next.js standalone runtime traces include pnpm `.pnpm/...` paths that don't extract cleanly. Letting Vercel build server-side with the monorepo toggle is the canonical pattern.

## How to Use

### Public API

```bash
# List 3 newest apps
curl 'https://hatch-brown.vercel.app/api/v1/apps?limit=3'

# Single app
curl 'https://hatch-brown.vercel.app/api/v1/apps/<slug>'

# Profile + their apps
curl 'https://hatch-brown.vercel.app/api/v1/profiles/<handle>'

# Categories
curl 'https://hatch-brown.vercel.app/api/v1/categories'

# Search
curl 'https://hatch-brown.vercel.app/api/v1/search?q=ai'

# OpenAPI 3 spec (5 paths)
curl 'https://hatch-brown.vercel.app/api/v1/openapi.json' | jq

# Agent-friendly index
curl 'https://hatch-brown.vercel.app/llms.txt'
```

Rate-limit: 60 req/min/IP. Response includes `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. Over the limit returns `429` with `Retry-After: 60`.

### Search UI

Type in the topbar search input → press Enter → land on `/search?q=...`. Two-character minimum.

### Trending / Following

- `/trending` (public) — last 7 days, hot.
- `/following` (auth) — latest from people you follow. Empty state if you follow nobody.

### Manually trigger cron

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://hatch-brown.vercel.app/api/cron/refresh-scores
# → {"ok":true,"rows_updated":N}
curl -i -H "Authorization: Bearer $CRON_SECRET" https://hatch-brown.vercel.app/api/cron/pick-featured
# → {"ok":true,"picked":"<uuid|null>"}
```

Without Bearer header: 401. (Even though pg_cron now drives the schedule, these endpoints remain useful for manual smoke + future migration off pg_cron if desired.)

## Configuration

### Vercel env vars (production)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (only used by `/api/cron/*` admin client)
- `CRON_SECRET` (random string ≥32 chars)
- `NEXT_PUBLIC_MCP_URL` (Railway domain + `/mcp` path)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (Phase 6 push — independent of Pair 5)

### Vercel project settings (dashboard)

- Framework: Next.js
- Root Directory: `apps/web`
- **Include source files outside of the Root Directory in the Build Step: ON** ← required for monorepo

### pg_cron jobs

Check via:

```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
```

Expected: two rows, both `active = true`.

## Testing

### Local

```bash
pnpm dev:web
curl -s http://localhost:3000/llms.txt | head -3
curl -s 'http://localhost:3000/api/v1/categories'
curl -s 'http://localhost:3000/api/v1/apps?limit=3'

# Rate-limit smoke (expect at least one 429 after request 60)
for i in $(seq 1 65); do
  curl -o /dev/null -s -w "%{http_code} " http://localhost:3000/api/v1/categories
done
```

### RLS verification

`tests/visual-baselines/pair-5/validation-report.md` documents the cross-user isolation test and update-blocked-without-bearer cron tests.

## Notes

- **No external services**: no Redis, no Upstash, no Algolia, no Resend. Rate-limit + cron all native to the existing Postgres + Vercel + Railway stack.
- **`@asteasolutions/zod-to-openapi`** is the only new npm dep (lib-only, no runtime services).
- **Empty `vercel.json`** at repo root: just `$schema`. Vercel reads project settings from dashboard for monorepo config.
- **Vercel project name**: `hatch` under team `danielhernandez-2884s-projects`. Production URL `https://hatch-brown.vercel.app` (auto-assigned subdomain). Custom domain TBD.
- **Out of scope (future)**: rate-limit cleanup cron (the `api_rate_limits` table grows ~1 row per IP per minute; a daily cleanup `DELETE WHERE bucket_start < now() - interval '1 hour'` keeps it tiny but is non-urgent for v1).

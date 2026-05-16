# Feature: Pair 5 — Phase 10 Ranking + Phase 11 Search + Phase 12 Public API

## Metadata

issue_number: `5`
adw_id: `manual-sdlc_planner`
issue_json: `{ "title": "Pair 5 — Phases 10+11+12 (ranking, search, public API)", "body": "Per SPEC.md §12-15. Cero servicios externos: Postgres-backed rate-limit, Vercel Cron nativo, tsvector ya existente." }`

## Feature Description

Pair 5 cierra tres fases del SPEC en una sola pasada:

- **Phase 10 (Ranking + cron)**: Función Postgres `compute_hot_score` con decay temporal, `refresh_hot_scores` recomputada cada 15 min vía Vercel Cron, `pick_featured_app` semanal Lunes 09:00 UTC, tabla `featured_apps`, `<FeaturedHero>` re-cableado para leer de `featured_apps`. Refresh on-demand (fire-and-forget) tras `toggleLike/toggleSave/postComment`. Plus rutas `/trending` (últimos 7d hot) y `/following` (apps de tus follows).
- **Phase 11 (Search)**: Server action `searchApps({ query })` usando el `search_vector` ya existente en `apps` (creado en migration 0006). Topbar search input ya existe en `shell.tsx` — wire de submit a `/search?q=...`. Página nueva `/search` Server Component reutilizando `<GalleryGrid>`.
- **Phase 12 (Public API + llms.txt + OpenAPI)**: 5 endpoints REST bajo `/api/v1/*`, rate-limit 60/min por IP via tabla Postgres `api_rate_limits` (CERO servicios externos), CORS abierto, sin auth. Ruta `/llms.txt` formato llmstxt.org. Ruta `/api/v1/openapi.json` generada de Zod via `@asteasolutions/zod-to-openapi`.

## User Story

As a Hatch builder
I want fresh hot-ranking, full-text search, and a public read-only API
So that the gallery surfaces the most relevant apps, users can find anything quickly, and external agents (or my own scripts) can read Hatch data without scraping HTML.

## Problem Statement

Hot scores decay over time — without periodic recomputation, ranking goes stale. Search isn't wired (the topbar input exists but does nothing). External tools have no way to read Hatch data without parsing HTML, and the MCP server we just shipped (Phase 9) requires auth — non-MCP agents/crawlers need a public lane.

## Solution Statement

1. Migration `0020_ranking.sql`: `compute_hot_score`, `refresh_hot_scores`, `pick_featured_app`, `featured_apps` table + RLS.
2. Migration `0021_api_rate_limits.sql`: `api_rate_limits (ip, bucket_start, count)` table for windowed rate-limit counters.
3. Wire `refresh_hot_scores()` fire-and-forget into `toggleLike/toggleSave/postComment` so volatile scores update without waiting for the cron.
4. Two Vercel Cron endpoints (`/api/cron/refresh-scores` every 15 min, `/api/cron/pick-featured` Mondays 09:00 UTC), each checking `Authorization: Bearer ${CRON_SECRET}` header. Both call the respective Postgres RPCs.
5. Re-cable `<FeaturedHero>` to read from `featured_apps` joined to `apps` for the current week; fallback to highest `hot_score` overall.
6. New routes `/trending` and `/following` Server Components.
7. Server action `searchApps` + page `/search`. Topbar form submit → `router.push('/search?q=...')`.
8. 5 read-only public endpoints `/api/v1/{apps, apps/[slug], profiles/[handle], categories, search}` with CORS `*` and Postgres-backed rate-limit helper.
9. `/llms.txt` static route.
10. `/api/v1/openapi.json` generated from Zod schemas via `@asteasolutions/zod-to-openapi`.

## Relevant Files

- `SPEC.md` §12 (Ranking, lines 1311-1430), §13 (Search, lines 1424-1438), §15 (llms.txt + public API + OpenAPI, lines 1556-1610). Authoritative — copy SQL/route shapes verbatim.
- `apps/web/app/_components/gallery-grid.tsx` — has `<FeaturedHero>` already (Pair 1); currently reads `apps.filter(a => a.featured)`. Re-cable to accept featured rows from `featured_apps`.
- `apps/web/app/page.tsx` — home that calls `<FeaturedHero>`; update its query.
- `apps/web/app/_components/shell.tsx` — has topbar `<input className="search-i">`; wrap in `<form action="/search">` so submit navigates.
- `apps/web/lib/actions/like.ts`, `save.ts`, `comment.ts` — append fire-and-forget `refresh_hot_scores()` RPC call after the mutation succeeds.
- `apps/web/lib/supabase/{server,admin}.ts` — existing clients to reuse.
- `apps/web/lib/zod/social.ts` — pattern for input validation.
- `packages/db/migrations/0018_phase6_seed.sql` — last applied (Pair 3); Pair 4 added 0019. New ones are 0020 + 0021.

### New Files

- `packages/db/migrations/0020_ranking.sql`
- `packages/db/migrations/0021_api_rate_limits.sql`
- `apps/web/lib/zod/search.ts`
- `apps/web/lib/zod/api.ts` (request schemas for the public API — also re-used by OpenAPI generator)
- `apps/web/lib/actions/search.ts`
- `apps/web/lib/rate-limit.ts` (Postgres-backed helper)
- `apps/web/app/search/page.tsx`
- `apps/web/app/trending/page.tsx`
- `apps/web/app/following/page.tsx`
- `apps/web/app/llms.txt/route.ts`
- `apps/web/app/api/cron/refresh-scores/route.ts`
- `apps/web/app/api/cron/pick-featured/route.ts`
- `apps/web/app/api/v1/apps/route.ts`
- `apps/web/app/api/v1/apps/[slug]/route.ts`
- `apps/web/app/api/v1/profiles/[handle]/route.ts`
- `apps/web/app/api/v1/categories/route.ts`
- `apps/web/app/api/v1/search/route.ts`
- `apps/web/app/api/v1/openapi.json/route.ts`
- `vercel.json` (root, with `crons` array)

## Expert Context

- **supabase**: migrations live in `packages/db/migrations/NNNN_<topic>.sql`, apply via `mcp__supabase__apply_migration` ONLY, regen types into `apps/web/lib/supabase/types.ts`. Every new table needs RLS. SECURITY DEFINER functions need explicit `search_path = public`.
- **nextjs**: App Router, Server Components default. API Routes go under `app/api/.../route.ts` exporting named HTTP verb functions (`export async function GET(req: Request) {...}`). Route handlers can read query params via `new URL(req.url).searchParams`. CORS headers set per-response. Vercel Cron auth via `Authorization: Bearer ${CRON_SECRET}` header (Vercel injects when invoking cron paths in prod).
- **mcp-server**: untouched in this pair.

Self-improvement of `supabase` + `nextjs` YAMLs is Task 12 below.

## Team Orchestration

Executed via `/tac:implement` with subagent-driven development (fresh subagent per task, two-stage review, status reporting).

### Team Members

- **db-builder** (`db-agent`, sonnet) — owns both new migrations + types regen. Has Supabase MCP + Bash. Hooks: migration_validator, rls_enabled_validator (already in agent definition).
- **web-ranking-builder** (`build-agent`, sonnet) — owns `apps/web/app/api/cron/**`, `apps/web/app/_components/gallery-grid.tsx` (edit), `apps/web/app/page.tsx` (edit FeaturedHero query), `apps/web/app/trending/page.tsx`, `apps/web/app/following/page.tsx`, `vercel.json`, and the fire-and-forget refresh wiring inside `apps/web/lib/actions/{like,save,comment}.ts` (edit).
- **web-search-builder** (`build-agent`, sonnet) — owns `apps/web/lib/zod/search.ts`, `apps/web/lib/actions/search.ts`, `apps/web/app/search/page.tsx`, and the topbar form edit in `apps/web/app/_components/shell.tsx`.
- **web-api-builder** (`build-agent`, sonnet) — owns `apps/web/lib/zod/api.ts`, `apps/web/lib/rate-limit.ts`, all 5 `apps/web/app/api/v1/**` route files, `apps/web/app/llms.txt/route.ts`, `apps/web/app/api/v1/openapi.json/route.ts`, and adds `@asteasolutions/zod-to-openapi` to `apps/web/package.json`.
- **validator** (`general-purpose`, sonnet) — owns nothing source-wise; runs `pnpm typecheck/lint/build` + smoke checks + writes a validation report.

**File ownership conflicts** to watch: `web-ranking-builder` and `web-search-builder` both touch files in `apps/web/app/_components/` and `apps/web/lib/actions/`. To prevent overlap: web-ranking-builder edits `gallery-grid.tsx` + `actions/{like,save,comment}.ts`; web-search-builder edits `shell.tsx` + creates `actions/search.ts`. No file shared.

## Validation Hooks

### Available Validators

- `migration_validator.py` — fires on SQL file Write/Edit (already in db-agent's frontmatter).
- `rls_enabled_validator.py` — fires on SQL file Write/Edit (already in db-agent's frontmatter).

### Custom Validators

None — existing validators cover this problem.

### Hook Assignments

| Team Member         | Hook Type   | Matcher     | Validator                                             |
| ------------------- | ----------- | ----------- | ----------------------------------------------------- |
| db-builder          | PostToolUse | Write\|Edit | `migration_validator.py` + `rls_enabled_validator.py` |
| web-ranking-builder | PostToolUse | Write\|Edit | default build-agent validators (no-op for TS)         |
| web-search-builder  | PostToolUse | Write\|Edit | default build-agent validators                        |
| web-api-builder     | PostToolUse | Write\|Edit | default build-agent validators                        |
| validator           | —           | —           | none                                                  |

## Step by Step Tasks

### 1. DB migrations 0020 + 0021 + types regen

- **Task ID**: db-migrations
- **Depends On**: none
- **Assigned To**: db-builder
- **Agent Type**: db-agent
- **Parallel**: true (Wave A)
- **Owns Files**: `packages/db/migrations/0020_ranking.sql`, `packages/db/migrations/0021_api_rate_limits.sql`, `apps/web/lib/supabase/types.ts` (regenerated only).
- **Context**: Write two migrations, apply both via `mcp__supabase__apply_migration`, then regen types ONCE at the end.

  **`0020_ranking.sql`** — copy DDL verbatim from SPEC.md §12.1 and §12.3, with the `featured_apps` table:

  ```sql
  -- compute_hot_score: time-decayed engagement score, IMMUTABLE so it can be in indexes/expressions
  create or replace function public.compute_hot_score(
    likes int, comments int, saves int, published timestamptz
  ) returns double precision language sql immutable as $$
    with weighted as (
      select
        log(greatest(likes, 1)) * 1.0 +
        log(greatest(comments, 1)) * 0.6 +
        log(greatest(saves, 1)) * 0.4 as engagement,
        extract(epoch from (published - timestamptz '2026-01-01')) / 45000.0 as age_term
    )
    select engagement + age_term from weighted
  $$;

  -- refresh_hot_scores: SECURITY DEFINER so it can update apps regardless of caller RLS
  create or replace function public.refresh_hot_scores() returns int
    language sql security definer set search_path = public as $$
    with upd as (
      update public.apps
         set hot_score = compute_hot_score(likes_count, comments_count, saves_count, published_at)
       where is_published
      returning 1
    )
    select count(*)::int from upd
  $$;
  revoke all on function public.refresh_hot_scores() from public;
  grant execute on function public.refresh_hot_scores() to authenticated, service_role;

  -- featured_apps: one row per week
  create table if not exists public.featured_apps (
    week_of    date primary key,
    app_id     uuid not null references public.apps(id) on delete cascade,
    reason     text not null default 'hot_score',
    created_at timestamptz not null default now()
  );

  alter table public.featured_apps enable row level security;

  -- Public read; only service_role writes (via pick_featured_app)
  drop policy if exists "featured_apps public read" on public.featured_apps;
  create policy "featured_apps public read"
    on public.featured_apps for select using (true);

  -- pick_featured_app: weekly worker that fills featured_apps
  create or replace function public.pick_featured_app() returns uuid
    language plpgsql security definer set search_path = public as $$
  declare pick uuid;
  begin
    select a.id into pick
      from public.apps a
      left join public.featured_apps f on f.app_id = a.id
     where a.is_published
       and a.published_at >= now() - interval '7 days'
       and f.app_id is null
     order by a.hot_score desc
     limit 1;

    if pick is not null then
      insert into public.featured_apps (week_of, app_id)
        values (date_trunc('week', now())::date, pick)
      on conflict (week_of) do nothing;
    end if;
    return pick;
  end $$;
  revoke all on function public.pick_featured_app() from public;
  grant execute on function public.pick_featured_app() to service_role;

  notify pgrst, 'reload schema';
  ```

  **`0021_api_rate_limits.sql`** — windowed counter for public API rate-limit:

  ```sql
  -- Per-IP rolling rate-limit counter. Bucket = floor(epoch/60), so each 60s window is one row per IP.
  create table if not exists public.api_rate_limits (
    ip           text not null,
    bucket_start timestamptz not null,
    count        int not null default 0,
    primary key (ip, bucket_start)
  );

  -- Auto-cleanup: keep only the last 5 minutes of buckets (anything older is irrelevant)
  create index if not exists api_rate_limits_bucket_idx on public.api_rate_limits (bucket_start);

  alter table public.api_rate_limits enable row level security;
  -- No client-side policies — only service_role accesses this table (from server route handlers)

  notify pgrst, 'reload schema';
  ```

- **Actions**:
  - Write both `.sql` files.
  - Apply both via `mcp__supabase__apply_migration` in order (0020 then 0021).
  - `mcp__supabase__list_tables({ schemas: ['public'] })` — confirm `featured_apps` + `api_rate_limits` both `rls_enabled: true`.
  - `mcp__supabase__generate_typescript_types` → overwrite `apps/web/lib/supabase/types.ts`.
  - Run `pnpm typecheck` from repo root.

### 2. Search Zod + action

- **Task ID**: web-search-action
- **Depends On**: none
- **Assigned To**: web-search-builder
- **Agent Type**: build-agent
- **Parallel**: true (Wave A — no deps on migration since `search_vector` already exists from 0006)
- **Owns Files**: `apps/web/lib/zod/search.ts`, `apps/web/lib/actions/search.ts`
- **Context**: Per SPEC.md §13, server action `searchApps({ query: string, limit?: number })` runs:

  ```ts
  // Pseudo — use the existing search_vector column via .textSearch
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from('apps')
    .select(
      'id, slug, title, tagline, accent, art_kind, category_id, likes_count, comments_count, hot_score, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url)',
    )
    .eq('is_published', true)
    .textSearch('search_vector', query, { type: 'plain', config: 'simple' })
    .order('hot_score', { ascending: false })
    .limit(Math.min(limit ?? 30, 50));
  ```

  Zod: `SearchInput = z.object({ query: z.string().trim().min(2).max(100), limit: z.coerce.number().int().min(1).max(50).optional() })`.

  Return shape: `Result<{ apps: Array<...>, query: string }>`. The `query` echo helps the UI show "Results for X".

- **Actions**:
  - Write `apps/web/lib/zod/search.ts`
  - Write `apps/web/lib/actions/search.ts`
  - Run `pnpm --filter web typecheck`

### 3. Wire `refresh_hot_scores` fire-and-forget into social actions

- **Task ID**: ranking-on-demand
- **Depends On**: db-migrations
- **Assigned To**: web-ranking-builder
- **Agent Type**: build-agent
- **Parallel**: true (Wave B — different files than web-search/web-api)
- **Owns Files**: `apps/web/lib/actions/like.ts` (edit), `apps/web/lib/actions/save.ts` (edit), `apps/web/lib/actions/comment.ts` (edit — only the `postComment` and `toggleCommentLike` functions, not the delete which decreases counts)
- **Context**: After the existing mutation succeeds (i.e., after the like/save/comment insert or delete), add a fire-and-forget call:

  ```ts
  // After the existing `revalidatePath(...)` line, BEFORE the return:
  void sb.rpc('refresh_hot_scores').then(
    () => {},
    () => {},
  );
  ```

  Use `void` + `.then(noop, noop)` to ensure: (a) the promise isn't awaited (no UX latency), (b) the un-handled rejection doesn't crash the request. Wrap in `try { ... } catch {}` if you prefer; either pattern is acceptable.

  Apply the same pattern to all three files. Do NOT touch `unlike` / `unsave` separately — the same `toggle*` functions handle both directions.

- **Actions**:
  - Edit the three files
  - Run `pnpm --filter web typecheck && pnpm --filter web lint`

### 4. FeaturedHero re-cable to read from `featured_apps`

- **Task ID**: ranking-featured-rewire
- **Depends On**: db-migrations
- **Assigned To**: web-ranking-builder
- **Agent Type**: build-agent
- **Parallel**: false (sequential with ranking-on-demand to avoid concurrent edits in `apps/web/`)
- **Owns Files**: `apps/web/app/page.tsx` (edit — the data fetch and `<FeaturedHero apps={...}>` prop), `apps/web/app/_components/gallery-grid.tsx` (edit — `FeaturedHero` accepts featured rows directly)
- **Context**: Today `apps/web/app/page.tsx` does `const featured = apps.filter(a => a.featured).slice(0, 3)` and passes to `<FeaturedHero apps={featured} />`. Change to:
  1. In `apps/web/app/page.tsx`, add a separate fetch for the current week's featured:

     ```ts
     const monday = (() => {
       const d = new Date();
       const day = (d.getUTCDay() + 6) % 7; // Mon=0
       d.setUTCDate(d.getUTCDate() - day);
       d.setUTCHours(0, 0, 0, 0);
       return d.toISOString().slice(0, 10);
     })();

     const { data: featuredRows } = await sb
       .from('featured_apps')
       .select('app_id, apps!inner(id, slug, title, tagline, accent, art_kind, hue, ...)')
       .eq('week_of', monday)
       .limit(3);

     // Fallback: if empty, use top-3 by hot_score
     const featured =
       featuredRows && featuredRows.length > 0
         ? featuredRows.map((r) => r.apps)
         : await sb
             .from('apps')
             .select('...')
             .eq('is_published', true)
             .order('hot_score', { ascending: false })
             .limit(3)
             .then((r) => r.data ?? []);
     ```

  2. `<FeaturedHero apps={featured} />` keeps the same prop shape — no UI change.

  Verify the existing select columns in `apps/web/app/page.tsx` and mirror them in the new query to keep the type shape compatible.

- **Actions**:
  - Edit `apps/web/app/page.tsx`
  - Edit `apps/web/app/_components/gallery-grid.tsx` if the prop type needs adjustment
  - Run `pnpm --filter web typecheck && pnpm --filter web lint`

### 5. /trending + /following pages

- **Task ID**: ranking-trending-following
- **Depends On**: db-migrations
- **Assigned To**: web-ranking-builder
- **Agent Type**: build-agent
- **Parallel**: false (sequential after ranking-featured-rewire to keep web-ranking-builder tasks serial)
- **Owns Files**: `apps/web/app/trending/page.tsx`, `apps/web/app/following/page.tsx`
- **Context**: Both pages are Server Components that reuse `<GalleryGrid>` from `apps/web/app/_components/gallery-grid.tsx`. Pattern mirrors `apps/web/app/page.tsx`.

  **`/trending/page.tsx`** (public, no auth gate):

  ```ts
  const sb = await createSupabaseServerClient();
  const { data: apps } = await sb
    .from('apps')
    .select('<same columns as home>')
    .eq('is_published', true)
    .gte('published_at', new Date(Date.now() - 7 * 86400 * 1000).toISOString())
    .order('hot_score', { ascending: false })
    .limit(60);
  return <GalleryGrid apps={apps ?? []} showHero={false} />;
  ```

  **`/following/page.tsx`** (auth required):

  ```ts
  let user;
  try { ({ user } = await requireUser()); } catch { redirect('/sign-in'); }
  const sb = await createSupabaseServerClient();
  // Two-step: get followee ids, then fetch their apps.
  const { data: follows } = await sb.from('follows').select('followee_id').eq('follower_id', user.id);
  const followeeIds = (follows ?? []).map(f => f.followee_id);
  if (followeeIds.length === 0) {
    return <EmptyState message="Follow some builders to see their ships here." />;
  }
  const { data: apps } = await sb.from('apps').select('<columns>').in('author_id', followeeIds).eq('is_published', true).order('published_at', { ascending: false }).limit(60);
  return <GalleryGrid apps={apps ?? []} showHero={false} />;
  ```

  No EmptyState component yet — inline the empty state markup with Tailwind (≈10 lines).

- **Actions**:
  - Write both `page.tsx` files
  - Run `pnpm --filter web typecheck && pnpm --filter web lint`

### 6. Vercel Cron routes + vercel.json

- **Task ID**: ranking-cron
- **Depends On**: db-migrations
- **Assigned To**: web-ranking-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/api/cron/refresh-scores/route.ts`, `apps/web/app/api/cron/pick-featured/route.ts`, `vercel.json` (new at repo root)
- **Context**: Two Next.js Route Handlers. Both check `Authorization: Bearer ${CRON_SECRET}` header (Vercel Cron injects it; in dev you can curl with the header to test).

  **`apps/web/app/api/cron/refresh-scores/route.ts`**:

  ```ts
  import { NextResponse } from 'next/server';
  import { createSupabaseAdminClient } from '@/lib/supabase/admin';

  export const dynamic = 'force-dynamic';
  export const runtime = 'nodejs';

  export async function GET(req: Request) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('unauthorized', { status: 401 });
    }
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('refresh_hot_scores');
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rows_updated: data });
  }
  ```

  **`apps/web/app/api/cron/pick-featured/route.ts`**: same shape, calls `admin.rpc('pick_featured_app')`, returns `{ ok: true, picked: <uuid|null> }`.

  **`vercel.json`** at repo ROOT (`/Users/daniel/Downloads/hatch/vercel.json`):

  ```json
  {
    "crons": [
      { "path": "/api/cron/refresh-scores", "schedule": "*/15 * * * *" },
      { "path": "/api/cron/pick-featured", "schedule": "0 9 * * 1" }
    ]
  }
  ```

  Manual prerequisite (NOT in this task — document in plan Notes): user must set `CRON_SECRET` env var in Vercel Project Settings (any random string).

- **Actions**:
  - Write both `route.ts` files
  - Write `vercel.json`
  - Run `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`

### 7. /search page + topbar wire

- **Task ID**: web-search-ui
- **Depends On**: web-search-action
- **Assigned To**: web-search-builder
- **Agent Type**: build-agent
- **Parallel**: true (with ranking tasks — different files)
- **Owns Files**: `apps/web/app/search/page.tsx` (new), `apps/web/app/_components/shell.tsx` (edit — wrap the existing search input in a form)
- **Context**: **`apps/web/app/search/page.tsx`** Server Component:

  ```ts
  import { searchApps } from '@/lib/actions/search';
  import { GalleryGrid } from '@/app/_components/gallery-grid';

  export const dynamic = 'force-dynamic';

  export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q } = await searchParams;
    const query = (q ?? '').trim();
    if (query.length < 2) {
      return <div className="px-8 py-10">Type at least 2 characters to search.</div>;
    }
    const result = await searchApps({ query });
    const apps = result.ok ? result.data.apps : [];
    return (
      <div>
        <h1 className="px-8 pt-10 text-lg font-medium">Results for "{query}"</h1>
        <GalleryGrid apps={apps} showHero={false} />
      </div>
    );
  }
  ```

  **Topbar wire** in `apps/web/app/_components/shell.tsx`: the existing JSX has a `<div className="topbar-search">` with an `<input>` inside. Wrap the input in a `<form action="/search" method="get">` so submit navigates with `?q=<input-value>`. Set `name="q"` on the input. This is a verbatim-prototype-port file — keep the className strings EXACTLY as they are; only add the `<form>` wrapper + `name` attr + ensure the form does NOT change the visual layout (use `<form className="contents">` if needed, or wrap such that the existing CSS still applies).

  IMPORTANT: this file is in `.claude/rules/prototype-port-exception.md` allowlist — Tailwind forbidden, inline styles allowed, no creative changes. The form wrapper is a structural minimum to enable navigation.

- **Actions**:
  - Write `apps/web/app/search/page.tsx`
  - Edit `apps/web/app/_components/shell.tsx`
  - Run `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`

### 8. Rate-limit helper

- **Task ID**: api-rate-limit
- **Depends On**: db-migrations
- **Assigned To**: web-api-builder
- **Agent Type**: build-agent
- **Parallel**: true (with web-search-ui — different files)
- **Owns Files**: `apps/web/lib/rate-limit.ts`
- **Context**: Postgres-backed sliding-bucket rate-limit. Bucket = current `floor(epoch / 60)` (1-minute window). On each call: upsert `(ip, bucket_start)` with `count = count + 1`, then read the count. If `> LIMIT` → `{ ok: false }`. Returns headers for the response.

  ```ts
  import { createSupabaseAdminClient } from '@/lib/supabase/admin';

  const LIMIT = 60;
  const WINDOW_S = 60;

  export type RateLimitResult =
    | { ok: true; remaining: number; resetAt: number }
    | { ok: false; remaining: 0; resetAt: number };

  export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
    const admin = createSupabaseAdminClient();
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / WINDOW_S) * WINDOW_S;
    const bucketStart = new Date(bucket * 1000).toISOString();
    const resetAt = (bucket + WINDOW_S) * 1000;

    // Upsert + increment in one round-trip via RPC would be ideal, but Supabase
    // doesn't expose atomic upsert-and-increment. Two-step is acceptable for v1:
    const { data, error } = await admin
      .from('api_rate_limits')
      .upsert(
        { ip, bucket_start: bucketStart, count: 1 },
        { onConflict: 'ip,bucket_start', ignoreDuplicates: false },
      )
      .select('count')
      .maybeSingle();

    if (error) {
      // Fail open on DB errors — don't lock out legit users because of a transient failure
      return { ok: true, remaining: LIMIT, resetAt };
    }

    // The upsert above resets count to 1 on conflict — that's wrong. Fix with an explicit increment:
    const { data: incremented } = await admin.rpc('increment_rate_limit', {
      p_ip: ip,
      p_bucket_start: bucketStart,
    });

    const count = typeof incremented === 'number' ? incremented : (data?.count ?? 1);
    if (count > LIMIT) {
      return { ok: false, remaining: 0, resetAt };
    }
    return { ok: true, remaining: LIMIT - count, resetAt };
  }

  export function ipFromRequest(req: Request): string {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    return 'unknown';
  }
  ```

  **IMPORTANT**: the two-step upsert-then-increment above is awkward because Supabase upsert doesn't atomically increment. Replace with a small RPC. Add this to migration `0021_api_rate_limits.sql` (UPDATE this task to coordinate with db-builder — easiest: write the RPC in the migration). The RPC:

  ```sql
  create or replace function public.increment_rate_limit(p_ip text, p_bucket_start timestamptz)
    returns int language sql security definer set search_path = public as $$
    insert into public.api_rate_limits (ip, bucket_start, count)
    values (p_ip, p_bucket_start, 1)
    on conflict (ip, bucket_start) do update set count = api_rate_limits.count + 1
    returning count;
  $$;
  revoke all on function public.increment_rate_limit(text, timestamptz) from public;
  grant execute on function public.increment_rate_limit(text, timestamptz) to service_role;
  ```

  Simplify the helper to call ONLY the RPC (drop the awkward upsert):

  ```ts
  const { data: count } = await admin.rpc('increment_rate_limit', {
    p_ip: ip,
    p_bucket_start: bucketStart,
  });
  const n = typeof count === 'number' ? count : 0;
  if (n > LIMIT) return { ok: false, remaining: 0, resetAt };
  return { ok: true, remaining: LIMIT - n, resetAt };
  ```

  **Cross-task coordination**: this task depends on db-migrations adding the RPC. Update the db-migrations task context to include this RPC in `0021_api_rate_limits.sql`.

- **Actions**:
  - Write `apps/web/lib/rate-limit.ts`
  - Run `pnpm --filter web typecheck`

### 9. Public API v1 routes (5)

- **Task ID**: api-v1-routes
- **Depends On**: api-rate-limit, db-migrations
- **Assigned To**: web-api-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/api/v1/apps/route.ts`, `apps/web/app/api/v1/apps/[slug]/route.ts`, `apps/web/app/api/v1/profiles/[handle]/route.ts`, `apps/web/app/api/v1/categories/route.ts`, `apps/web/app/api/v1/search/route.ts`, `apps/web/lib/zod/api.ts`
- **Context**: 5 read-only endpoints per SPEC.md §15.2. Each route handler:
  1. `const ip = ipFromRequest(req);`
  2. `const rl = await checkRateLimit(ip); if (!rl.ok) return new NextResponse('rate_limit_exceeded', { status: 429, headers: { 'X-RateLimit-Reset': ... } });`
  3. Parse + validate query/path params with Zod from `lib/zod/api.ts`.
  4. Query Supabase (use admin client to read public published data — no user context needed).
  5. Return `NextResponse.json(data, { headers: { 'Access-Control-Allow-Origin': '*', 'X-RateLimit-Remaining': String(rl.remaining), 'X-RateLimit-Reset': String(rl.resetAt) } })`.
  6. Also handle `OPTIONS` for CORS preflight: `export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } }); }`.

  Zod schemas in `apps/web/lib/zod/api.ts`:
  - `ApiAppsList = z.object({ category?: z.string(), limit?: z.coerce.number().int().min(1).max(100).default(30), cursor?: z.string().optional() })`
  - `ApiAppDetail = z.object({ slug: z.string().min(1) })`
  - `ApiProfileDetail = z.object({ handle: z.string().min(1) })`
  - `ApiSearch = z.object({ q: z.string().trim().min(2).max(100), limit?: z.coerce.number().int().min(1).max(50).default(30) })`

  Each endpoint returns SHAPES (not raw rows) — explicit field projection so we don't leak internal columns. Example for `/api/v1/apps/[slug]`:

  ```ts
  return {
    id,
    slug,
    title,
    tagline,
    description,
    link,
    category_id,
    cover_url,
    art_kind,
    accent,
    tags,
    published_at,
    likes_count,
    comments_count,
    saves_count,
    views_count,
    hot_score,
    author: { handle, display_name, avatar_url, hue, emoji },
  };
  ```

  All 5 routes follow this skeleton — keep them under 80 lines each.

- **Actions**:
  - Write `apps/web/lib/zod/api.ts`
  - Write all 5 route files
  - Run `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`

### 10. /llms.txt + /api/v1/openapi.json

- **Task ID**: api-llms-openapi
- **Depends On**: api-v1-routes
- **Assigned To**: web-api-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/llms.txt/route.ts`, `apps/web/app/api/v1/openapi.json/route.ts`, `apps/web/package.json` (add `@asteasolutions/zod-to-openapi` dep)
- **Context**:

  **`/llms.txt/route.ts`** — static text response per llmstxt.org format:

  ```ts
  export const runtime = 'nodejs';
  const BODY = `# Hatch
  
  Product-Hunt-for-builders. Discover, publish, and discuss apps.
  
  ## Important URLs
  - Discover: https://hatch.dev/
  - Trending: https://hatch.dev/trending
  - Categories: https://hatch.dev/c/{category_id}
  - App detail: https://hatch.dev/a/{slug}
  - Profile: https://hatch.dev/u/{handle}
  
  ## API
  - List apps: GET https://hatch.dev/api/v1/apps
  - App detail: GET https://hatch.dev/api/v1/apps/{slug}
  - Profile: GET https://hatch.dev/api/v1/profiles/{handle}
  - Categories: GET https://hatch.dev/api/v1/categories
  - Search: GET https://hatch.dev/api/v1/search?q={query}
  - OpenAPI spec: https://hatch.dev/api/v1/openapi.json
  - MCP server: see /settings/api-keys for personal access token + config
  `;
  export async function GET() {
    return new Response(BODY, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  ```

  **`/api/v1/openapi.json/route.ts`** — generate OpenAPI 3 JSON from Zod schemas:

  ```ts
  import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
  import { ApiAppsList, ApiAppDetail, ApiProfileDetail, ApiSearch } from '@/lib/zod/api';

  export const runtime = 'nodejs';

  export async function GET() {
    const registry = new OpenAPIRegistry();
    registry.registerPath({
      method: 'get',
      path: '/api/v1/apps',
      summary: 'List published apps',
      request: { query: ApiAppsList },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
      },
    });
    // ... repeat for the other 4 endpoints
    const generator = new OpenApiGeneratorV3(registry.definitions);
    const doc = generator.generateDocument({
      openapi: '3.0.0',
      info: { title: 'Hatch Public API', version: '1.0.0' },
      servers: [{ url: 'https://hatch.dev' }],
    });
    return new Response(JSON.stringify(doc, null, 2), {
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  ```

  Add `@asteasolutions/zod-to-openapi` to `apps/web/package.json` dependencies (`"^7.0.0"` or whatever is current). Run `pnpm install` from repo root.

- **Actions**:
  - Edit `apps/web/package.json` (add the dep)
  - Run `pnpm install`
  - Write both `route.ts` files
  - Run `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`

### 11. Final validation (typecheck + lint + build + smoke)

- **Task ID**: validate-all
- **Depends On**: ranking-on-demand, ranking-featured-rewire, ranking-trending-following, ranking-cron, web-search-ui, api-llms-openapi
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Owns Files**: `tests/visual-baselines/pair-5/validation-report.md` (new)
- **Context**: Run repo-wide checks + a series of curl smoke tests against `pnpm dev:web`:
  1. `pnpm typecheck && pnpm lint && pnpm build` — all exit 0.
  2. Start dev server in background (port 3000). Wait 5s.
  3. `curl -s http://localhost:3000/llms.txt` — expect 200 + text body containing `# Hatch`.
  4. `curl -s http://localhost:3000/api/v1/categories` — expect 200 + JSON array.
  5. `curl -s "http://localhost:3000/api/v1/apps?limit=3"` — expect 200 + 3 apps.
  6. `curl -s "http://localhost:3000/api/v1/search?q=ai"` — expect 200 + JSON (may be empty).
  7. `curl -s http://localhost:3000/api/v1/openapi.json | head -20` — expect valid JSON with `"openapi": "3.0.0"`.
  8. Rate-limit smoke: 65 requests in a tight loop to `/api/v1/categories`. Confirm at least one returns 429.
  9. `curl -i "http://localhost:3000/api/cron/refresh-scores"` (no Bearer) — expect 401.
  10. `curl -i -H "Authorization: Bearer test" "http://localhost:3000/api/cron/refresh-scores"` (wrong Bearer) — expect 401. (You can't fully test with real CRON_SECRET because it's not in local env; document.)
  11. Kill dev server.

  Write the report to `tests/visual-baselines/pair-5/validation-report.md`.

- **Actions**:
  - Run all checks
  - Write the report

### 12. Expert self-improvement

- **Task ID**: experts-self-improve
- **Depends On**: validate-all
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Owns Files**: `.claude/commands/experts/supabase/expertise.yaml`, `.claude/commands/experts/nextjs/expertise.yaml`
- **Context**: Refresh both expert YAMLs to reflect Pair 5:
  - **supabase**: add `0020_ranking.sql` + `0021_api_rate_limits.sql` to `migrations_applied`. Add `featured_apps` + `api_rate_limits` to `database_schema.tables`. Document `compute_hot_score`, `refresh_hot_scores`, `pick_featured_app`, `increment_rate_limit` functions.
  - **nextjs**: add the new routes (`/search`, `/trending`, `/following`, `/llms.txt`, `/api/cron/{refresh-scores,pick-featured}`, `/api/v1/{apps,apps/[slug],profiles/[handle],categories,search,openapi.json}`). Note the `vercel.json` cron config and the `CRON_SECRET` env var requirement.

  Verify both YAMLs parse with `python3 -c "import yaml; yaml.safe_load(open('<path>'))"`.

- **Actions**:
  - Edit both YAMLs
  - Verify they parse
  - Report changes

## Testing Strategy

### Unit Tests

None — this pair relies on integration testing via the validator's curl smoke + DB-level constraints (RLS, unique indexes, function security).

### Edge Cases

- `searchApps` with `query.length < 2` → Zod rejects.
- `/api/v1/search` with no `q` param → 400 (Zod parse fails).
- `/api/v1/apps/[slug]` with non-existent slug → 404.
- `/api/v1/profiles/[handle]` with non-existent handle → 404.
- Rate-limit: 61st request in a window → 429.
- Rate-limit fail-open: if Supabase is unreachable, the `checkRateLimit` returns `{ ok: true }` so legit users aren't locked out by transient DB issues.
- `/following` with zero follows → empty-state markup (not 500).
- `/trending` for a fresh repo with zero apps in last 7 days → empty grid (not 500).
- `pick_featured_app` called twice in the same week → `ON CONFLICT (week_of) DO NOTHING` prevents duplicate rows.
- `refresh_hot_scores` fire-and-forget failure → swallowed silently (no UX impact).

## Acceptance Criteria

1. Migrations `0020_ranking.sql` + `0021_api_rate_limits.sql` applied to Supabase cloud. `featured_apps` and `api_rate_limits` tables exist with RLS enabled.
2. Postgres functions `compute_hot_score`, `refresh_hot_scores`, `pick_featured_app`, `increment_rate_limit` exist and are callable by the right roles.
3. `apps/web/lib/actions/{like,save,comment}.ts` each fire `refresh_hot_scores` after the mutation succeeds.
4. `<FeaturedHero>` on home reads from `featured_apps` for the current Monday, with hot_score fallback when empty.
5. `/trending` and `/following` Server Components render correctly (auth gate on `/following`).
6. Vercel Cron routes `/api/cron/refresh-scores` and `/api/cron/pick-featured` exist, return 401 without Bearer, 200 with valid `CRON_SECRET`. `vercel.json` includes both crons.
7. `/search?q=<query>` page returns results using `search_vector` + `plainto_tsquery`.
8. Topbar search input submits to `/search`.
9. 5 endpoints under `/api/v1/*` return JSON with CORS `*`, rate-limited at 60/min/IP.
10. `/llms.txt` returns the llmstxt.org-format body.
11. `/api/v1/openapi.json` returns valid OpenAPI 3 JSON generated from Zod.
12. Repo-wide `pnpm typecheck && pnpm lint && pnpm build` exit 0.
13. Expert YAMLs (`supabase`, `nextjs`) refreshed to reflect Pair 5 state.

## Validation Commands

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm dev:web` + curl sequence (see Task 11)
- `mcp__supabase__list_tables({ schemas: ['public'] })` — confirm new tables
- `mcp__supabase__list_migrations` — confirm `0020` + `0021` applied

## Notes

- **Library additions**: `@asteasolutions/zod-to-openapi` to `apps/web/package.json` (small TS-only helper for OpenAPI generation — named in SPEC.md §15.3). NO other new deps. NO external SaaS, NO Redis, NO Upstash, NO Algolia.
- **Manual prereqs for production deploy** (NOT in this plan, user manual action like Railway was for Phase 9):
  - Set `CRON_SECRET` env var in Vercel Project Settings (any random string ≥ 32 chars).
  - Vercel auto-detects `vercel.json` `crons` array on next deploy — no Vercel dashboard config needed for the schedule itself.
- **Rate-limit cleanup**: the `api_rate_limits` table grows ~1 row per IP per minute. Add to roadmap follow-up: a daily Vercel Cron `/api/cron/cleanup-rate-limits` that runs `DELETE FROM api_rate_limits WHERE bucket_start < now() - interval '1 hour'`. NOT in this plan to keep scope tight — table stays small enough for v1.
- **Sequencing constraint**: web-ranking-builder tasks (3 → 4 → 5 → 6) are serial within the builder to keep edits orderly on `apps/web/app/` and `apps/web/lib/actions/`. web-search-builder (2 → 7) and web-api-builder (8 → 9 → 10) run in parallel branches.
- **No Vercel Cron in dev**: cron only fires in deployed Vercel envs. Local dev tests the routes via direct curl with `Bearer ${CRON_SECRET}` header.

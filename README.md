# Hatch

A community gallery for builders to publish, discover, and connect around side-projects. Next.js 15 + Supabase + a public MCP server so AI agents are first-class consumers of Hatch alongside human users.

**Live:**

- **Web** — <https://hatch-brown.vercel.app>
- **MCP** — <https://hatch-mcp-production.up.railway.app> (`/health` returns service info; `POST /mcp` requires `Bearer hatch_pat_*`)
- **Public API** — `https://hatch-brown.vercel.app/api/v1/{apps,apps/:slug,profiles/:handle,categories,search}` (CORS open, 60 req/min/IP)
- **Agent index** — <https://hatch-brown.vercel.app/llms.txt>
- **OpenAPI 3 spec** — <https://hatch-brown.vercel.app/api/v1/openapi.json>

## Architecture

<img src="./docs/diagrams/hatch-architecture.svg" alt="Hatch architecture: Browser, External Agent, and Claude Desktop talking to the Vercel-hosted Next.js app and the Railway-hosted MCP server, both backed by Supabase Postgres with pg_cron, Auth, Storage, and Realtime" width="100%" />

Three deployments, one database:

| Tier | Host                                            | What lives here                                                                                                                                                                                              |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web  | Vercel (`hatch-brown.vercel.app`)               | `apps/web` — Next.js 15 Server Components, Server Actions, `/api/v1/*` (read-only public), `/api/cron/*` (manual triggers), `/llms.txt`, `/api/v1/openapi.json`, middleware that refreshes Supabase sessions |
| MCP  | Railway (`hatch-mcp-production.up.railway.app`) | `apps/mcp` — MCP Server (Streamable HTTP) with 15 tools + 3 resources + 3 prompts. Bearer-token auth via `api_keys` table                                                                                    |
| Data | Supabase (project `vcbdtjjkkwryvmqbflah`)       | 17 tables (all RLS-enabled), 6 SECURITY DEFINER functions, pg_cron jobs for ranking, Auth (GitHub + Google), Storage (`app-covers`, `avatars`), Realtime for messages and notifications                      |

**No Docker. No external scheduler (pg_cron handles cron). No external rate-limiter (Postgres counter table). No email (Phase 8 cut — Web Push absorbs notification duties).** The stack is intentionally tight.

## Roadmap

<img src="./docs/diagrams/hatch-roadmap.svg" alt="Hatch 13-phase build status: Phases 0–7, 9–12 shipped; Phase 8 (email) cut; Phase 13 (polish) pending. Phases are grouped into pairs for parallel ADW execution" width="100%" />

| Pair | Phases     | Status | Highlight                                                                             |
| ---- | ---------- | ------ | ------------------------------------------------------------------------------------- |
| —    | 0, 1       | ✅     | Monorepo + Auth + base schema                                                         |
| 1    | 2, 3       | ✅     | Design system port from prototype + apps read path                                    |
| 2    | 4, 5       | ✅     | Social (likes/saves/follows/comments) + Publish + Storage                             |
| 3    | 6, 7       | ✅     | Contact requests + notifications + Web Push + messages inbox                          |
| —    | 8          | ❌ CUT | Email (Resend) — Web Push covers the surfacing role                                   |
| 4    | 9          | ✅     | MCP server on Railway + `/settings/api-keys`                                          |
| 5    | 10, 11, 12 | ✅     | Hot-score ranking (pg_cron) + full-text search + public REST API + llms.txt + OpenAPI |
| —    | 13         | ⏳     | Polish: Legal pages (Terms, Privacy, Commercial), 100vh scroll-snapping, skeletons, error boundaries, OG images, sitemap, Sentry, analytics |

Pair specs and plans live in `docs/superpowers/specs/` and `specs/`; per-feature docs in `app_docs/` (see [Documentation](#documentation)).

## Quickstart

Prerequisites: Node 22, pnpm 10, a Supabase project (the cloud one — no local stack).

```bash
git clone git@github.com:Daniel-Visit/hatch.git
cd hatch
cp apps/web/.env.example apps/web/.env.local   # fill in values from your Supabase + VAPID
pnpm install
pnpm dev                                       # web on :3000, mcp on :8080
```

Verify both services:

```bash
curl http://localhost:3000/llms.txt | head -3
curl http://localhost:8080/health
# {"ok":true,"service":"hatch-mcp","version":"0.1.0"}
```

### Required env vars (`apps/web/.env.local`)

| Var                                                  | Source                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                           | Supabase Dashboard → Settings → API                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                      | Supabase Dashboard → Settings → API (`anon`)                            |
| `SUPABASE_SERVICE_ROLE_KEY`                          | Supabase Dashboard → Settings → API (`service_role` — **never commit**) |
| `NEXT_PUBLIC_MCP_URL`                                | `http://localhost:8080/mcp` in dev; Railway URL in prod                 |
| `CRON_SECRET`                                        | Any random ≥32-char string; used by `/api/cron/*` Bearer header         |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Generated with `npx web-push generate-vapid-keys` (Phase 6)             |

For the MCP server (`apps/mcp/.env` if running standalone, or just set on Railway): `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `PORT` (Railway auto-injects).

## Layout

```
apps/
  web/                Next.js 15 — Vercel target
    app/              App Router pages + /api/v1, /api/cron, /llms.txt
    lib/              actions/ zod/ supabase/ auth.ts rate-limit.ts push/
  mcp/                Node HTTP + MCP SDK — Railway target
    src/              server.ts transport.ts auth.ts tools/ resources/ prompts/
packages/
  shared/             Cross-package TS (categories, ranking helpers, Database type re-export)
  db/migrations/      Supabase SQL migrations (apply via `mcp__supabase__apply_migration` ONLY)
prototype/            Visual reference (apps-gallery JSX/CSS). Source of truth for the look.
docs/
  superpowers/        Pair specs (one per shipped block of phases)
  diagrams/           Animated SVG diagrams used in this README
app_docs/             Feature documentation (see Documentation below)
specs/                Per-pair implementation plans (issue-N-adw-*)
tests/visual-baselines/  Manual smoke evidence (screenshots, validation reports)
```

## Scripts

```bash
pnpm dev          # parallel: web + mcp
pnpm dev:web      # only Next.js
pnpm dev:mcp      # only MCP server
pnpm build        # build all
pnpm lint         # eslint + prettier
pnpm typecheck    # tsc --noEmit across all workspaces
pnpm format       # prettier --write .
```

## Documentation

| Where                                                                                                                                          | What                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`SPEC.md`](./SPEC.md)                                                                                                                         | Authoritative product + architecture spec (data model, RLS, all 13 phases)                                                     |
| [`app_docs/feature-pair-4-mcp-server-api-keys.md`](./app_docs/feature-pair-4-mcp-server-api-keys.md)                                           | Phase 9 — MCP server + Personal Access Tokens                                                                                  |
| [`app_docs/feature-pair-5-ranking-search-public-api.md`](./app_docs/feature-pair-5-ranking-search-public-api.md)                               | Phases 10+11+12 — ranking, search, public API                                                                                  |
| [`app_docs/feature-session-2026-05-16-shell-route-group-and-polish.md`](./app_docs/feature-session-2026-05-16-shell-route-group-and-polish.md) | Post-Pair-5 polish — `(shell)` route group, avatar dropdown, gradient picker, avatar upload, real view tracking, remix removed |
| [`docs/superpowers/specs/2026-05-15-hatch-roadmap-maestro-design.md`](./docs/superpowers/specs/2026-05-15-hatch-roadmap-maestro-design.md)     | Macro roadmap (decisions, ADW execution model)                                                                                 |
| [`docs/superpowers/specs/2026-05-15-hatch-fase-0-design.md`](./docs/superpowers/specs/2026-05-15-hatch-fase-0-design.md)                       | Phase 0 foundations spec                                                                                                       |
| [`docs/superpowers/specs/2026-05-16-hatch-fase-9-design.md`](./docs/superpowers/specs/2026-05-16-hatch-fase-9-design.md)                       | Phase 9 MCP server spec                                                                                                        |
| [`tests/visual-baselines/phase-9-mcp/README.md`](./tests/visual-baselines/phase-9-mcp/README.md)                                               | Claude Desktop manual smoke-test guide                                                                                         |
| [`tests/visual-baselines/pair-5/validation-report.md`](./tests/visual-baselines/pair-5/validation-report.md)                                   | Pair 5 production smoke results                                                                                                |
| `.claude/commands/experts/*/expertise.yaml`                                                                                                    | Per-domain accumulated knowledge (supabase, nextjs, mcp-server, hooks, …) — auto-refreshed at end of each pair                 |
| `.claude/commands/conditional_docs.md`                                                                                                         | Index that points subagents at the right `app_docs/` entries based on the file area they touch                                 |

## Connect Claude Desktop

1. Sign in to `https://hatch-brown.vercel.app` (GitHub or Google).
2. Go to **`/settings/api-keys`** and click **Generate API Key**. Copy the plain token — shown once.
3. Copy the JSON snippet below it (already filled with the Railway URL).
4. Claude Desktop → Settings → Developer → Edit Config → paste the snippet, replace `<paste-your-token>` with the plain token from step 2, save, restart Claude Desktop.
5. New conversation → the plugin icon shows `hatch` connected → 15 tools, 3 resources, 3 prompts available.

Full step-by-step (with screenshots layout for the manual smoke) in [`tests/visual-baselines/phase-9-mcp/README.md`](./tests/visual-baselines/phase-9-mcp/README.md).

## Deploy / operations

| What        | Where                                                                         | Auto?                                                                       |
| ----------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Web         | Vercel project `hatch` (team `danielhernandez-2884s-projects`)                | On `git push` to `main`                                                     |
| MCP         | Railway project `hatch-mcp` → service `hatch-mcp`                             | On `railway up` (or via GitHub auto-deploy when configured)                 |
| Migrations  | Supabase MCP `apply_migration` tool only                                      | Manual (run via Claude or the MCP CLI)                                      |
| Cron jobs   | Postgres `pg_cron` extension — `cron.job` table                               | Auto (refresh-hot-scores every 15 min, pick-featured-app Mondays 09:00 UTC) |
| Types regen | `mcp__supabase__generate_typescript_types` → `apps/web/lib/supabase/types.ts` | Manual after each schema change                                             |

Constraints: no Docker anywhere, no Supabase CLI for migrations, no email provider, no external rate-limiter, no external scheduler.

---

> **Hatch** is a 13-phase build pursued through paired-phase ADW (AI developer workflow) execution. Each shipped pair leaves: a spec in `docs/superpowers/specs/`, a plan in `specs/issue-N-*.md`, code + migrations, an `app_docs/` entry, and refreshed expert YAMLs. The result is a stack that any agent — or human — can pick up cold and extend.

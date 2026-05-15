# Hatch

A community gallery for builders to publish, discover, and connect around side-projects.

See [`SPEC.md`](./SPEC.md) for the full product spec, architecture, and 13-phase build plan.

## Quickstart

```bash
git clone git@github.com:Daniel-Visit/hatch.git
cd hatch
cp .env.example .env.local      # values needed from Phase 1+
pnpm install
pnpm dev                         # web on :3000, mcp on :8080
```

Verify:

```bash
curl http://localhost:8080/health
# {"ok":true,"service":"hatch-mcp","version":"0.0.0"}
```

## Layout

```
apps/
  web/      Next.js 15 — Vercel target
  mcp/      Node HTTP — Railway target (MCP server, Phase 9+)
packages/
  shared/   Cross-package TS (categories, ranking, types)
  db/       Supabase SQL migrations (Phase 1+)
prototype/  Visual reference. Do not import at runtime.
```

## Scripts

```bash
pnpm dev         # parallel: web + mcp
pnpm dev:web     # only Next.js
pnpm dev:mcp     # only MCP server
pnpm build       # build all
pnpm lint        # lint all
pnpm typecheck   # typecheck all
pnpm format      # prettier write
```

## Phase status

- [x] Phase 0 — local scaffolding
- [ ] Phase 1 — auth + base schema
- [ ] Phase 2 — design system + shell
- ... (see [`SPEC.md`](./SPEC.md) §16)

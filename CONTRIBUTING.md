# Contributing to Hatch

Thanks for your interest in Hatch. The project is open source — anyone can read
the code, fork it, open issues, and propose changes through pull requests.

## How contributions land

Hatch is public, but only the two maintainers can merge:

- **@Daniel-Visit**
- **@Dein-devai**

Everyone else contributes by forking the repo and opening a pull request.
Direct pushes to `main` are blocked — every change reaches `main` through a PR
that has at least one maintainer approval.

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** 10 — run `corepack enable` and it picks up the version pinned in
  `package.json`.

## Getting started

1. Fork the repo and clone your fork.
2. Install dependencies from the repo root:

   ```bash
   pnpm install
   ```

3. Set up environment variables. `.env.sample` at the repo root documents every
   variable. The web app reads `apps/web/.env.local`; the MCP server reads
   `apps/mcp/.env` (see `apps/mcp/.env.example`). A full local run needs your
   own Supabase project (URL + keys).

## Project layout

This is a pnpm monorepo. See the README for the full architecture.

| Path              | What it is                                    |
| ----------------- | --------------------------------------------- |
| `apps/web`        | Next.js 15 app — landing, gallery, public API |
| `apps/mcp`        | MCP server (Streamable HTTP) for AI agents    |
| `packages/shared` | Types and constants shared across apps        |
| `packages/db`     | SQL migrations                                |

## Running locally

```bash
pnpm dev        # web + mcp in parallel
pnpm dev:web    # just the Next.js app (localhost:3000)
pnpm dev:mcp    # just the MCP server
```

## Before you open a PR

Run these from the repo root and make sure they pass:

```bash
pnpm typecheck
pnpm lint
pnpm format     # auto-formats with Prettier
```

A pre-commit hook (husky + lint-staged) formats and lints staged files
automatically, so most of this happens for you on commit.

## Pull request flow

1. Create a branch off `main` with a descriptive name — e.g. `feat/agent-search`
   or `fix/gallery-pagination`.
2. Keep commits focused. Commit messages follow a conventional style:
   `type(scope): summary` — e.g. `feat(web): add saved-apps tab`.
3. Open the PR against `main` and describe what changed and why.
4. A maintainer reviews it. Once it is approved and checks pass, a maintainer
   merges it.

## Reporting issues

Open a GitHub issue. For bugs, include steps to reproduce, what you expected,
and what actually happened. For security issues, please contact a maintainer
directly instead of opening a public issue.

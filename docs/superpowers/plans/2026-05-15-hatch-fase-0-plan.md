# Hatch Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Hatch monorepo locally — `pnpm dev` boots Next.js (`:3000`) and an MCP HTTP server (`:8080`) — without Docker, without cloud, without DB.

**Architecture:** pnpm workspace at `/Users/daniel/Downloads/hatch/`. Two apps (`apps/web` Next.js 15, `apps/mcp` plain Node HTTP) and two packages (`packages/shared` for cross-app TS, `packages/db` placeholder for SQL migrations). Root tooling: TypeScript strict, ESLint flat, Prettier, Husky + lint-staged. Supabase access scaffolded as throwing stubs that Phase 1 implements.

**Tech Stack:** Node 22 LTS · pnpm 10 · TypeScript 5 · Next.js 15 · React 19 · Tailwind v4 · `@modelcontextprotocol/sdk` · Husky 9 · lint-staged 15 · Prettier 3 · ESLint flat config.

**Spec source:** `docs/superpowers/specs/2026-05-15-hatch-fase-0-design.md` (read once before starting).
**Working directory:** `/Users/daniel/Downloads/hatch/`. All `Run:` commands assume this cwd unless stated.

---

## File Structure (locked-in decisions)

| Path | Created | Responsibility |
|------|---------|----------------|
| `package.json` | T2 | Root workspace manifest + scripts that fan out to packages. |
| `pnpm-workspace.yaml` | T2 | Tells pnpm where workspace packages live (`apps/*`, `packages/*`). |
| `tsconfig.base.json` | T2 | One strict TS config; every package extends it. |
| `.prettierrc.json` + `.prettierignore` | T2 | Single Prettier config repo-wide. |
| `eslint.config.mjs` | T2 | Flat ESLint config repo-wide; apps may extend per-package. |
| `.gitignore` | T1 | Root gitignore — single source of truth. Apps don't ship their own. |
| `.husky/pre-commit` | T3 | Runs lint-staged on staged files. |
| `.env.example` | T9 | Every var from SPEC §17, no values. |
| `README.md` | T10 | Quickstart only; product detail lives in `SPEC.md`. |
| `prototype/Hatch.html` | T1 (move) | Visual reference. Never imported at runtime. |
| `packages/shared/{package.json,tsconfig.json,src/{index,types,categories,ranking}.ts}` | T4 | Stub types and ranking helper. Phase 1+ fills in. |
| `packages/db/{package.json,README.md,migrations/.gitkeep}` | T5 | Placeholder for SQL migrations applied by Supabase CLI in Phase 1+. |
| `apps/mcp/{package.json,tsconfig.json,src/index.ts}` | T6 | Plain Node HTTP server with `GET /health`. Phase 9 swaps in MCP SDK transport. |
| `apps/web/*` | T7 (`create-next-app`) + T7-T8 edits | Next.js 15 App Router. Single placeholder page. |
| `apps/web/lib/supabase/{server,client,admin}.ts` | T8 | Throwing stubs that fail loud if invoked before Phase 1 wires them. |

**Naming convention:** `@hatch/shared`, `@hatch/db` (scoped, for cross-package imports). Apps stay unscoped: `web`, `mcp` (so `pnpm --filter web dev` and `pnpm --filter mcp dev` from the spec work as written).

---

## Task 1: Repo init, gitignore, prototype move

**Files:**
- Create: `.gitignore`
- Move: `Hatch.html` → `prototype/Hatch.html`

- [ ] **Step 1: Initialize git**

Run: `git init -b main`
Expected: `Initialized empty Git repository in /Users/daniel/Downloads/hatch/.git/`

- [ ] **Step 2: Move Hatch.html into prototype/**

Run: `mkdir -p prototype && mv Hatch.html prototype/Hatch.html`
Expected: no output. Verify with `ls prototype/` shows `Hatch.html`.

- [ ] **Step 3: Write .gitignore**

Create `.gitignore` with:

```gitignore
# Deps
node_modules/
.pnpm-store/

# Build outputs
.next/
dist/
build/
out/
*.tsbuildinfo

# Turbo / caches
.turbo/
.cache/

# Env
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# Editor / OS
.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json

# Test artifacts
coverage/
playwright-report/
test-results/

# Misc
*.pem
.vercel
```

- [ ] **Step 4: Verify git sees only intended files**

Run: `git status --short`
Expected: lists `.claude/`, `.gitignore`, `SPEC.md`, `adws/`, `agents/`, `docs/`, `logs/`, `prototype/` as untracked. No `node_modules/` (none exist yet), no `Hatch.html` at root (was moved).

- [ ] **Step 5: First commit (baseline)**

Run:
```bash
git add .gitignore SPEC.md prototype/Hatch.html docs/
git commit -m "chore: phase 0 baseline — spec + prototype + brainstorm docs"
```
Expected: commit succeeds (no Husky yet to hook).

> Note: `.claude/`, `adws/`, `agents/`, `logs/` are user infra — leave them untracked here. Whether to commit them is the user's call later.

---

## Task 2: Root workspace + tooling configs

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

Create with:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Write root `package.json`**

Create with:
```json
{
  "name": "hatch",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:web": "pnpm --filter web dev",
    "dev:mcp": "pnpm --filter mcp dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "husky": "^9.1.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.5.0"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": [
      "prettier --write",
      "eslint --fix"
    ],
    "*.{md,json,yaml,yml,css}": [
      "prettier --write"
    ]
  }
}
```

- [ ] **Step 3: Write `tsconfig.base.json`**

Create with:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "allowSyntheticDefaultImports": true
  }
}
```

- [ ] **Step 4: Write `.prettierrc.json`**

Create with:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 5: Write `.prettierignore`**

Create with:
```
node_modules
.next
dist
build
out
coverage
.turbo
.cache
pnpm-lock.yaml
prototype/Hatch.html
```

- [ ] **Step 6: Write root `eslint.config.mjs`**

Create with:
```js
// Flat ESLint config. Apps (Next.js) may extend with their own config.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.turbo/**',
      '**/coverage/**',
      'prototype/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
```

- [ ] **Step 7: Add ESLint TypeScript dep to root devDependencies**

Edit `package.json` and add to `devDependencies`:
```json
"@eslint/js": "^9.0.0",
"typescript-eslint": "^8.0.0"
```

The `devDependencies` block becomes:
```json
"devDependencies": {
  "@eslint/js": "^9.0.0",
  "@types/node": "^22.0.0",
  "eslint": "^9.0.0",
  "husky": "^9.1.0",
  "lint-staged": "^15.0.0",
  "prettier": "^3.3.0",
  "typescript": "^5.5.0",
  "typescript-eslint": "^8.0.0"
}
```

- [ ] **Step 8: Install root deps**

Run: `pnpm install`
Expected: pnpm creates `node_modules/`, `pnpm-lock.yaml`. Output ends with `Done in Ns`. The `prepare` script may run husky but fail silently if `.husky/` doesn't exist yet — that's fine, Task 3 fixes it.

- [ ] **Step 9: Verify Prettier and ESLint binaries resolve**

Run: `pnpm exec prettier --version && pnpm exec eslint --version`
Expected: prints two version numbers (e.g. `3.3.x` and `9.x.x`).

- [ ] **Step 10: Commit**

Run:
```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .prettierrc.json .prettierignore eslint.config.mjs pnpm-lock.yaml
git commit -m "chore: workspace + ts/eslint/prettier configs"
```

---

## Task 3: Husky + lint-staged hook

**Files:**
- Create: `.husky/pre-commit`

- [ ] **Step 1: Initialize Husky**

Run: `pnpm exec husky init`
Expected: creates `.husky/` directory and `.husky/pre-commit` (default content `npm test`). Adds `"prepare": "husky"` script if missing.

- [ ] **Step 2: Replace `.husky/pre-commit` content**

Overwrite `.husky/pre-commit` with:
```sh
pnpm exec lint-staged
```

- [ ] **Step 3: Make pre-commit executable**

Run: `chmod +x .husky/pre-commit`
Expected: no output. Verify with `ls -l .husky/pre-commit` shows executable bit.

- [ ] **Step 4: Smoke test the hook**

Create a deliberately badly-formatted scratch file and try to commit it:
```bash
echo "const x   ={a:1}" > /tmp/hatch_scratch.ts
cp /tmp/hatch_scratch.ts ./scratch_husky_test.ts
git add scratch_husky_test.ts
git commit -m "test: husky smoke" || echo "HOOK BLOCKED OR REFORMATTED"
```
Expected: lint-staged either reformats the file (and commit succeeds with reformatted content) or errors. Either way, the hook ran.

- [ ] **Step 5: Clean up the scratch file**

Run:
```bash
git reset HEAD scratch_husky_test.ts 2>/dev/null || true
rm -f scratch_husky_test.ts
```
Expected: scratch file gone. If it was committed in Step 4, run `git reset --soft HEAD~1` first to undo that commit, then `rm` and `git checkout .` to clean.

- [ ] **Step 6: Commit Husky setup**

Run:
```bash
git add .husky/
git commit -m "chore: husky pre-commit runs lint-staged"
```

---

## Task 4: `packages/shared` scaffolding

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/categories.ts`
- Create: `packages/shared/src/ranking.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**

Create with:
```json
{
  "name": "@hatch/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

> Note: we expose `.ts` directly (not built JS) because Next.js with `transpilePackages` can consume TS, and `tsx` in the MCP app handles TS at runtime. No build step needed for Phase 0.

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

Create with:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `packages/shared/src/types.ts`**

Create with:
```ts
// Phase 0 stub. Phase 1+ fills in real domain types
// (Profile, App, Comment, Notification, etc.) generated from Supabase types.

export type Placeholder = never;
```

- [ ] **Step 4: Write `packages/shared/src/categories.ts`**

Create with:
```ts
// Phase 0 stub. Phase 1 (migration 0002_categories.sql) seeds the real list;
// this constant mirrors that seed for client-side use.
// See SPEC.md §4.2 for the canonical 8 categories.

export interface Category {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly sortOrder: number;
}

export const CATEGORIES: readonly Category[] = [];
```

- [ ] **Step 5: Write `packages/shared/src/ranking.ts`**

Create with:
```ts
// Hot score helper used by both `apps/web` and `apps/mcp`.
// Phase 0 stub returns 0; Phase 10 implements the real Reddit-style decay
// per SPEC.md §12.1.

export interface HotScoreInput {
  likes: number;
  comments: number;
  saves: number;
  publishedAt: Date;
}

export function hotScore(_input: HotScoreInput): number {
  return 0;
}
```

- [ ] **Step 6: Write `packages/shared/src/index.ts`**

Create with:
```ts
export * from './types.js';
export * from './categories.js';
export * from './ranking.js';
```

> Note: `.js` extensions in imports are required by `verbatimModuleSyntax` + `moduleResolution: Bundler` for ESM. TypeScript resolves them to `.ts` source.

- [ ] **Step 7: Verify shared package typechecks**

Run: `pnpm --filter @hatch/shared typecheck`
Expected: exit 0, no errors.

- [ ] **Step 8: Commit**

Run:
```bash
git add packages/shared/
git commit -m "feat(shared): scaffold cross-package TS module"
```

---

## Task 5: `packages/db` scaffolding

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/README.md`
- Create: `packages/db/migrations/.gitkeep`

- [ ] **Step 1: Write `packages/db/package.json`**

Create with:
```json
{
  "name": "@hatch/db",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "lint": "echo 'no lint for db package'",
    "typecheck": "echo 'no typecheck for db package'",
    "build": "echo 'no build for db package'"
  }
}
```

> Note: `lint`/`typecheck`/`build` are no-ops so `pnpm -r` doesn't fail on this package.

- [ ] **Step 2: Write `packages/db/README.md`**

Create with:
````markdown
# @hatch/db

SQL migrations for the Hatch Supabase project.

## Phase 0 status

Empty. Phase 1 onwards adds numbered migration files here following SPEC.md §4.

## Convention

- Migrations are plain `.sql` files in `migrations/`, numbered: `0001_init.sql`, `0002_apps.sql`, etc.
- Apply them via the Supabase CLI once cloud project is provisioned:
  ```bash
  pnpm dlx supabase db push
  ```
- After every migration: regenerate types:
  ```bash
  pnpm dlx supabase gen types typescript --project-id <id> > ../../apps/web/lib/supabase/types.ts
  ```

See `../../SPEC.md` §4 (data model) and §18.1-2 (migration discipline) for detail.
````

- [ ] **Step 3: Create empty `migrations/` directory with .gitkeep**

Run: `mkdir -p packages/db/migrations && touch packages/db/migrations/.gitkeep`
Expected: no output. Verify with `ls packages/db/migrations/` shows `.gitkeep`.

- [ ] **Step 4: Re-run install so pnpm picks up the new package**

Run: `pnpm install`
Expected: pnpm reports new package added; lockfile updated.

- [ ] **Step 5: Commit**

Run:
```bash
git add packages/db/ pnpm-lock.yaml
git commit -m "feat(db): scaffold migrations placeholder"
```

---

## Task 6: `apps/mcp` scaffolding

**Files:**
- Create: `apps/mcp/package.json`
- Create: `apps/mcp/tsconfig.json`
- Create: `apps/mcp/src/index.ts`

- [ ] **Step 1: Write `apps/mcp/package.json`**

Create with:
```json
{
  "name": "mcp",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@hatch/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

> Note: `@modelcontextprotocol/sdk` is imported but not used in Phase 0 — included here so the dep tree is correct from day 1. Phase 9 actually uses it.

- [ ] **Step 2: Write `apps/mcp/tsconfig.json`**

Create with:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `apps/mcp/src/index.ts`**

Create with:
```ts
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'hatch-mcp',
        version: '0.0.0',
      }),
    );
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mcp] listening on :${PORT}`);
});
```

- [ ] **Step 4: Install MCP deps**

Run: `pnpm install`
Expected: installs `tsx`, `@modelcontextprotocol/sdk`, `@types/node`. `@hatch/shared` resolves as `link:../packages/shared` in the lockfile.

- [ ] **Step 5: Boot the MCP server in foreground briefly**

Run: `timeout 3 pnpm --filter mcp dev || true`
Expected: prints `[mcp] listening on :8080`, then exits after 3s.

- [ ] **Step 6: Boot the MCP server in background and curl /health**

Run:
```bash
pnpm --filter mcp dev &
SERVER_PID=$!
sleep 2
curl -s http://localhost:8080/health
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```
Expected: `{"ok":true,"service":"hatch-mcp","version":"0.0.0"}` printed.

- [ ] **Step 7: Verify mcp typechecks and lints**

Run: `pnpm --filter mcp typecheck && pnpm --filter mcp lint`
Expected: both exit 0.

- [ ] **Step 8: Verify mcp builds**

Run: `pnpm --filter mcp build`
Expected: creates `apps/mcp/dist/index.js`. Verify with `ls apps/mcp/dist/`.

- [ ] **Step 9: Commit**

Run:
```bash
git add apps/mcp/ pnpm-lock.yaml
git commit -m "feat(mcp): scaffold node http server with /health"
```

---

## Task 7: `apps/web` — Next.js 15 scaffolding

**Files:**
- Create: `apps/web/*` (via `create-next-app`)
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/app/page.tsx`
- Delete: `apps/web/.gitignore` (use root)
- Delete: `apps/web/README.md` (use root)

- [ ] **Step 1: Run create-next-app**

Run:
```bash
pnpm dlx create-next-app@15 apps/web \
  --typescript \
  --app \
  --tailwind \
  --no-src-dir \
  --eslint \
  --import-alias "@/*" \
  --turbopack \
  --use-pnpm \
  --no-git \
  --skip-install
```
Expected: scaffolds `apps/web/` with `app/`, `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`. No git init (we're already in one). No install (we'll do it from root in Step 5).

- [ ] **Step 2: Rename web's package.json**

Read current `apps/web/package.json`. Replace its contents with:
```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint --max-warnings=0",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hatch/shared": "workspace:*",
    "next": "15.x",
    "react": "19.x",
    "react-dom": "19.x"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

> Note: keep the actual semver from create-next-app for `next`/`react`/`react-dom`. The `15.x` / `19.x` placeholders above mean "whatever create-next-app installed — copy that exact range over". Read what it generated and copy the literal versions.

- [ ] **Step 3: Delete redundant files in `apps/web`**

Run:
```bash
rm -f apps/web/.gitignore apps/web/README.md
```
Expected: no output. Root gitignore covers `.next/`.

- [ ] **Step 4: Patch `apps/web/next.config.ts` for monorepo**

Replace contents of `apps/web/next.config.ts` with:
```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hatch/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
```

- [ ] **Step 5: Replace `apps/web/app/page.tsx` with placeholder**

Overwrite with:
```tsx
export default function HomePage() {
  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 700 }}>Hatch</h1>
    </main>
  );
}
```

> Note: inline styles deliberate — no design tokens until Phase 2. Tailwind is wired but unused.

- [ ] **Step 6: Verify `apps/web/app/layout.tsx` is sane**

Read `apps/web/app/layout.tsx`. If it imports fonts from `next/font/google` (Geist Mono / Geist) and renders `<html lang="en"><body>{children}</body></html>`, leave it. If it has placeholder marketing copy, trim to:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hatch',
  description: 'A community gallery for builders.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Install web deps**

Run: `pnpm install`
Expected: installs Next.js, React 19, Tailwind v4. Lockfile updated.

- [ ] **Step 8: Verify web dev server boots**

Run:
```bash
pnpm --filter web dev &
SERVER_PID=$!
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```
Expected: prints `200`.

- [ ] **Step 9: Verify web typechecks, lints, builds**

Run: `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`
Expected: all three exit 0. Build creates `apps/web/.next/`.

- [ ] **Step 10: Commit**

Run:
```bash
git add apps/web/ pnpm-lock.yaml
git commit -m "feat(web): scaffold next.js 15 with placeholder home"
```

---

## Task 8: `apps/web/lib/supabase` stubs

**Files:**
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/admin.ts`

- [ ] **Step 1: Write `apps/web/lib/supabase/server.ts`**

Create with:
```ts
// Phase 0 stub. Phase 1 (auth) replaces this with @supabase/ssr cookie-bound client.
// See SPEC.md §6.2 and §7.3.

export async function createSupabaseServerClient(): Promise<never> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      '[supabase/server] NEXT_PUBLIC_SUPABASE_URL is not set. ' +
        'Phase 1 wires this stub to @supabase/ssr.',
    );
  }
  throw new Error(
    '[supabase/server] not implemented in Phase 0. ' +
      'Phase 1 implements per SPEC.md §6.2.',
  );
}
```

- [ ] **Step 2: Write `apps/web/lib/supabase/client.ts`**

Create with:
```ts
// Phase 0 stub. Phase 1 replaces with @supabase/ssr browser client.

export function createSupabaseBrowserClient(): never {
  throw new Error(
    '[supabase/client] not implemented in Phase 0. ' +
      'Phase 1 implements per SPEC.md §7.2.',
  );
}
```

- [ ] **Step 3: Write `apps/web/lib/supabase/admin.ts`**

Create with:
```ts
// Phase 0 stub. Phase 1+ replaces with service-role client for server actions
// and webhooks ONLY. Never import this from a client component.

export function createSupabaseAdminClient(): never {
  throw new Error(
    '[supabase/admin] not implemented in Phase 0. ' +
      'Phase 1 implements per SPEC.md §7.3.',
  );
}
```

- [ ] **Step 4: Verify web still typechecks**

Run: `pnpm --filter web typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

Run:
```bash
git add apps/web/lib/
git commit -m "feat(web): supabase stubs that fail loud until phase 1"
```

---

## Task 9: `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write `.env.example`**

Create with:
```bash
# ─── apps/web (Vercel project vars in prod, .env.local in dev) ───────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only — never expose to client
SUPABASE_SERVICE_ROLE_KEY=

# Resend (Phase 8+)
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=

# Vercel Cron auth
CRON_SECRET=

# MCP server URL (used by the "Copy MCP config" UI in Phase 9)
NEXT_PUBLIC_MCP_URL=http://localhost:8080

# ─── apps/mcp (Railway env vars in prod) ─────────────────────────────────
PORT=8080
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LOG_LEVEL=info
```

- [ ] **Step 2: Verify `.env.example` matches SPEC §17 exactly**

Read SPEC.md lines 1731-1751 and compare against the file just written. Every key listed there must be present here. No extras.

- [ ] **Step 3: Commit**

Run:
```bash
git add .env.example
git commit -m "chore: env.example with all phase 0-9 vars"
```

---

## Task 10: `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

Create with:
````markdown
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
````

- [ ] **Step 2: Commit**

Run:
```bash
git add README.md
git commit -m "docs: README quickstart"
```

---

## Task 11: Done-criteria verification

This task runs the full Done checklist from the spec. No code is written — every step is a verification.

**Files:** none

- [ ] **Step 1: Clean install from scratch**

Run:
```bash
rm -rf node_modules apps/web/node_modules apps/mcp/node_modules packages/shared/node_modules packages/db/node_modules
pnpm install
```
Expected: completes with no errors, ends with `Done in Ns`.

- [ ] **Step 2: Verify `pnpm dev` boots both apps**

Run:
```bash
pnpm dev &
DEV_PID=$!
sleep 8
curl -s -o /dev/null -w "web=%{http_code}\n" http://localhost:3000
curl -s http://localhost:8080/health
echo
kill $DEV_PID 2>/dev/null
# Kill child processes too (next dev / tsx watch fork)
pkill -f "next dev" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
wait 2>/dev/null
```
Expected:
```
web=200
{"ok":true,"service":"hatch-mcp","version":"0.0.0"}
```

- [ ] **Step 3: Verify `pnpm typecheck`**

Run: `pnpm typecheck`
Expected: exit 0. Each package reports success.

- [ ] **Step 4: Verify `pnpm lint`**

Run: `pnpm lint`
Expected: exit 0.

- [ ] **Step 5: Verify `pnpm build`**

Run: `pnpm build`
Expected: exit 0. `apps/web/.next/` and `apps/mcp/dist/` exist.

- [ ] **Step 6: Verify `pnpm format:check`**

Run: `pnpm format:check`
Expected: exit 0 — every file is already formatted (we ran `prettier --write` via Husky/lint-staged on every commit).

- [ ] **Step 7: Verify Husky hook still active**

Run:
```bash
ls -l .husky/pre-commit
```
Expected: file exists with executable bit set.

- [ ] **Step 8: Verify `Hatch.html` is in `prototype/` only**

Run:
```bash
test ! -f Hatch.html && test -f prototype/Hatch.html && echo "OK"
```
Expected: prints `OK`.

- [ ] **Step 9: Verify `.env.example` has every SPEC §17 key**

Run:
```bash
for key in NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY RESEND_API_KEY RESEND_WEBHOOK_SECRET CRON_SECRET NEXT_PUBLIC_MCP_URL PORT SUPABASE_URL LOG_LEVEL; do
  grep -q "^${key}=" .env.example || echo "MISSING: ${key}"
done
echo "done"
```
Expected: prints only `done` (no `MISSING:` lines).

- [ ] **Step 10: Print Done checklist summary**

Run: `git log --oneline`
Expected: lists ~10 commits from Tasks 1-10. Visually confirm no checklist item from the spec was skipped.

> If any verification fails, stop and fix before Task 12. Do not push a broken Phase 0.

---

## Task 12: Connect GitHub remote and push

**Files:** none (git operations)

- [ ] **Step 1: Inspect remote repo state**

Run: `git ls-remote git@github.com:Daniel-Visit/hatch.git 2>&1 | head -20`
Expected: one of:
- (empty output / connection error) → repo doesn't exist or is unreachable; ask user.
- a list of refs starting with `HEAD`, `refs/heads/main` → repo has content; need rebase.
- only `HEAD` ref or no refs → repo exists but is empty; safe to push.

> **Decision point:** if remote has any commits, do Step 3a (rebase). Otherwise do Step 3b (direct push).

- [ ] **Step 2: Add the remote**

Run: `git remote add origin git@github.com:Daniel-Visit/hatch.git`
Expected: no output. Verify with `git remote -v`.

- [ ] **Step 3a: If remote has commits — rebase**

Only do this if Step 1 showed existing refs.

Run:
```bash
git fetch origin main
git rebase origin/main
```
Expected: rebase succeeds. If there are conflicts, resolve them per file (likely a generated `README.md` or `LICENSE` from GitHub init), then `git rebase --continue`.

- [ ] **Step 3b: If remote is empty — skip Step 3a, go to Step 4**

(no command)

- [ ] **Step 4: Push to main**

Run: `git push -u origin main`
Expected: pushes successfully; `main` tracking `origin/main`.

- [ ] **Step 5: Confirm with the user**

Print: "Phase 0 pushed to https://github.com/Daniel-Visit/hatch. Verify in GitHub UI before moving to Phase 1."

> **Stop here.** Phase 1 is a separate plan; do not start it.

---

## Self-review notes (post-write)

Spec coverage check (each SPEC §16 Phase 0 bullet → task):

| SPEC §16 Phase 0 bullet | Task |
|--------------------------|------|
| pnpm init monorepo, pnpm-workspace.yaml | T2 |
| apps/web — `create-next-app` with flags | T7 |
| apps/mcp — empty TS package with tsx + MCP SDK | T6 |
| packages/db — Supabase CLI init | **adapted** to T5 (placeholder dir + README; CLI install deferred per design doc — no Docker, no need yet) |
| packages/shared — TS-only types and ranking helper | T4 |
| Repo wiring: tsconfig.base.json, ESLint, Prettier, husky + lint-staged | T2 + T3 |
| `.env.example` with every var listed (§17) | T9 |
| Create Supabase project, Vercel project, Railway project. Wire env vars. | **deferred** per user direction (design doc §1) |
| Deploy a "hello world" on each | **deferred** per user direction (design doc §1) |
| Done when: `pnpm dev` runs Next.js locally, MCP boots on :8080, `supabase start` works | T11 — `supabase start` adapted to "no Postgres at all in Phase 0" per design doc §1 |

Placeholder scan: clean. No "TBD"/"TODO"/"implement later". One known-unknown (remote repo state) is handled with branching steps in T12.

Type consistency: `createSupabaseServerClient` (T8) matches SPEC §6.2 naming. `hotScore` (T4) is the same name re-used by Phase 10. `CATEGORIES` shape matches SPEC §4.2. Package names (`@hatch/shared`, `@hatch/db`, `web`, `mcp`) used consistently across T4, T5, T6, T7, T2 scripts.

---

*End of plan.*

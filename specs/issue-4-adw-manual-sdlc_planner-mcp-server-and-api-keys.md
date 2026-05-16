# Feature: Phase 9 — MCP Server + API Keys (Pair 4)

## Metadata

issue_number: `4`
adw_id: `manual-sdlc_planner`
issue_json: `{ "title": "Phase 9 — MCP server + API keys", "body": "See docs/superpowers/specs/2026-05-16-hatch-fase-9-design.md" }`

## Feature Description

Build out `apps/mcp/` (currently a `/health` stub) into a full Model Context Protocol server consumable from Claude Desktop. Surface includes 10 tools (read + publish + social), 3 resources (`hatch://app/{slug}`, `hatch://profile/{handle}`, `hatch://notifications`), and 3 prompts (`draft_app_description`, `review_my_apps`, `compose_message`). Transport is Streamable HTTP (MCP spec 2025-03-26) on a single `POST /mcp` endpoint. Authentication is via Personal Access Tokens (PATs) generated from a new `/settings/api-keys` page in the web app. Tokens are bcrypt-hashed in a new `api_keys` table with one active token per user enforced at the DB level. Deploy target is Railway via Nixpacks (no Dockerfile).

## User Story

As a Hatch user
I want to connect Claude Desktop to my Hatch account via a personal access token
So that I can browse, publish, and interact with Hatch apps directly from Claude

## Problem Statement

Hatch currently has no machine-to-machine API. Builders cannot drive Hatch from external tooling — they have to use the web UI for every action. The `apps/mcp` workspace exists from Phase 0 but is a `/health` stub with no tools, no auth, and no production deploy.

## Solution Statement

1. Add a new `api_keys` table (migration `0019_api_keys.sql`) with bcrypt-hashed tokens, indexed lookup by `token_prefix`, RLS scoped to `auth.uid()`, and a unique partial index that enforces one active token per user.
2. Build `apps/mcp/src/` as a fully-featured MCP server using `@modelcontextprotocol/sdk@^1.0.0`: auth middleware, Streamable HTTP transport, 10 tool handlers, 3 resource handlers, 3 prompt templates.
3. Add `/settings/api-keys` UI in the web app for token generation, display-once flow, and revocation. Include a copyable `mcp-config.json` snippet that the user pastes into Claude Desktop.
4. Add `nixpacks.toml` to `apps/mcp/` so Railway autodeploys on push.
5. Validate locally with curl, RLS-test with Supabase MCP, and provide a smoke-test guide for the user's manual Claude Desktop verification.

## Relevant Files

Use these files to implement the feature:

- `docs/superpowers/specs/2026-05-16-hatch-fase-9-design.md` — authoritative spec (read this first, copy DDL and surface contracts verbatim).
- `apps/mcp/src/index.ts` — current `/health` stub; will be rewritten to mount the MCP server alongside `/health`.
- `apps/mcp/package.json` — workspace manifest; add deps `@supabase/supabase-js`, `bcryptjs`, `@types/bcryptjs`, `zod`.
- `apps/mcp/tsconfig.json` — keep ESM `module: "NodeNext"`.
- `apps/web/lib/supabase/admin.ts` — pattern for the singleton service-role client (the MCP server mirrors this with one client per process).
- `apps/web/lib/supabase/types.ts` — generated `Database` type; the MCP server imports the same source via `@hatch/shared` re-export or relative import.
- `apps/web/lib/actions/messages.ts` — pattern for `'use server'` actions with `Result<T>` discriminated union, Zod validation, and admin-client fallback. Mirror this style in `api-keys.ts`.
- `apps/web/lib/actions/publish.ts` — pattern for app creation; `publish_app` MCP tool must produce the same row shape and validation rules.
- `apps/web/lib/actions/follow.ts` / `like.ts` / `save.ts` — patterns for toggle actions; MCP `follow_user` / `like_app` / `save_app` tools mirror these.
- `apps/web/lib/zod/publish.ts` / `messages.ts` — Zod patterns for input validation; reuse where possible in MCP tool inputs.
- `apps/web/app/settings/` — existing `/settings` parent route; add `api-keys/page.tsx` underneath.
- `packages/db/migrations/0018_phase6_seed.sql` — last migration; the new one is `0019_api_keys.sql`.
- `packages/shared/src/index.ts` — entry point for the shared package; gets a new `export * from './database.js'` line so MCP can import the `Database` type via `@hatch/shared`.
- `.claude/commands/experts/mcp-server/expertise.yaml` — MCP server expert context (current `apps/mcp` stub state, SDK info).
- `.claude/commands/experts/supabase/expertise.yaml` — RLS patterns, migration workflow.
- `.claude/commands/experts/nextjs/expertise.yaml` — Server Component + server action patterns.

### New Files

- `packages/db/migrations/0019_api_keys.sql` — new `api_keys` table + RLS.
- `apps/mcp/src/supabase.ts` — service-role Supabase client singleton for the MCP server.
- `apps/mcp/src/auth.ts` — Bearer token → user_id resolver via bcrypt compare on `api_keys`.
- `apps/mcp/src/transport.ts` — Streamable HTTP transport wrapper around `@modelcontextprotocol/sdk`.
- `apps/mcp/src/server.ts` — MCP `Server` instance, registers all tools/resources/prompts.
- `apps/mcp/src/tools/read.ts` — `list_apps`, `search_apps`, `get_app`, `list_categories`, `get_profile`, `list_notifications`.
- `apps/mcp/src/tools/publish.ts` — `publish_app`, `update_app`.
- `apps/mcp/src/tools/social.ts` — `like_app`/`unlike_app`, `save_app`/`unsave_app`, `follow_user`/`unfollow_user`, `send_message`.
- `apps/mcp/src/resources/index.ts` — handlers for `hatch://app/{slug}`, `hatch://profile/{handle}`, `hatch://notifications`.
- `apps/mcp/src/prompts/index.ts` — `draft_app_description`, `review_my_apps`, `compose_message` template handlers.
- `apps/mcp/src/types.ts` — shared types for handler input/output.
- `apps/mcp/nixpacks.toml` — Railway build config.
- `apps/mcp/.env.example` — required env vars documented.
- `apps/mcp/README.md` — local dev + smoke test instructions.
- `apps/web/lib/zod/api-key.ts` — Zod schemas for label.
- `apps/web/lib/actions/api-keys.ts` — `generate()` and `revoke()` server actions.
- `apps/web/app/settings/api-keys/page.tsx` — Server Component for token management UI.
- `apps/web/app/settings/api-keys/_components/generate-key-flow.tsx` — Client Component for the create+display-once modal.
- `apps/web/app/settings/api-keys/_components/mcp-config-snippet.tsx` — Client Component for the copyable config block.
- `tests/visual-baselines/phase-9-mcp/README.md` — placeholder for Claude Desktop screenshot evidence (user fills in manually).

## Implementation Plan

### Phase 1: Foundation

- Migration `0019_api_keys.sql` applied to Supabase cloud, types regenerated, RLS verified.
- `apps/mcp` deps installed (`@supabase/supabase-js`, `bcryptjs`, `@types/bcryptjs`, `zod`), `nixpacks.toml` written.
- Zod schema for API key labels.

### Phase 2: Core Implementation

- MCP server scaffolding: `supabase.ts`, `auth.ts`, `transport.ts`, `server.ts`.
- All 10 tools across `tools/read.ts`, `tools/publish.ts`, `tools/social.ts`.
- All 3 resources in `resources/index.ts`.
- All 3 prompts in `prompts/index.ts`.
- Web actions `generate()` and `revoke()`.
- UI page + two client components.

### Phase 3: Integration

- Local smoke test via curl (`POST /mcp` initialize + `tools/list` + one tool call).
- RLS validation on `api_keys` via Supabase MCP `execute_sql`.
- README + smoke test guide for the user's manual Claude Desktop verification.

## Expert Context

Experts consulted (read their `expertise.yaml` for current patterns):

- **mcp-server** — current `apps/mcp` is a `/health` stub on port 8080; deps already include `@modelcontextprotocol/sdk@^1.0.0`; ESM modules; tsx for dev; tsc for build. Use SDK `Server` class with tool/resource/prompt handlers per SDK docs (Context7 if needed). Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **supabase** — migrations live in `packages/db/migrations/NNNN_<topic>.sql`; apply via `mcp__supabase__apply_migration` ONLY (never CLI); types regen via `mcp__supabase__generate_typescript_types` into `apps/web/lib/supabase/types.ts`; every new table needs RLS enabled and policies; pattern: `using (col = auth.uid())` for read/update and `with check (...)` for write.
- **nextjs** — Server Components by default; Server Actions in `apps/web/lib/actions/*.ts` use `'use server'` directive; return `Result<T>` discriminated union (`{ ok: true, data }` | `{ ok: false, error }`); validate inputs with Zod; use `createSupabaseServerClient` for user-scoped queries, `createSupabaseAdminClient` only when bypassing RLS is required; `revalidatePath()` after mutations.

Self-improvement tasks for experts whose domains are touched are listed in Task 14.

## Team Orchestration

This plan uses Claude Code's **agent teams** for coordinated parallel execution. The executor operates as the **team lead in delegate mode** — orchestrating teammates without writing code directly.

### Team Setup

This plan is executed via `/tac:implement` which uses **subagent-driven development**:

1. **Parse tasks**: The executor reads this plan, extracts all tasks with full context
2. **Create task list**: `TaskCreate` for every task, with dependencies via `addBlockedBy`
3. **Dispatch subagents**: Fresh subagent per task (no context pollution between tasks)
4. **Two-stage review**: Each task gets spec compliance review, then code quality review
5. **Status handling**: Subagents report DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
6. **Final validation**: Run all Validation Commands after all tasks complete

To execute: `/tac:implement specs/issue-4-adw-manual-sdlc_planner-mcp-server-and-api-keys.md`

### Team Members

- **db-builder**
  - Role: Write + apply the `api_keys` migration, regenerate types, run RLS verification SQL.
  - Agent Type: `db-agent`
  - Model: sonnet
  - Owns Files: `packages/db/migrations/0019_api_keys.sql`, `apps/web/lib/supabase/types.ts` (regenerated only).
  - Required Capabilities: file write (Write, Edit), shell execution (Bash) for `pnpm typecheck`, Supabase MCP tools (`apply_migration`, `generate_typescript_types`, `execute_sql`, `list_tables`, `get_advisors`).
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `migration_validator.py` (already in db-agent definition)
    - PostToolUse (Write|Edit): `rls_enabled_validator.py` (already in db-agent definition)

- **mcp-server-builder**
  - Role: Build the entire MCP server — auth, transport, server registration, all 10 tools, all 3 resources, all 3 prompts, plus Nixpacks config and README.
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/mcp/src/**`, `apps/mcp/package.json`, `apps/mcp/nixpacks.toml`, `apps/mcp/.env.example`, `apps/mcp/README.md`, `apps/mcp/tsconfig.json` (only if needed), `packages/shared/src/database.ts` (new re-export), `packages/shared/src/index.ts` (appended export line).
  - Required Capabilities: file write (Write, Edit), shell execution (Bash) for `pnpm install`, `pnpm --filter mcp build`, `pnpm --filter mcp typecheck`, and local curl smoke test.
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): default build-agent validators (ruff, ty are no-ops on TS; `no_vapid_private_in_client.py` and `no_tailwind_in_prototype_port.py` are harmless on apps/mcp/\*)

- **web-settings-builder**
  - Role: Build the `/settings/api-keys` page, server actions, Zod schemas, and client components for token generation and `mcp-config.json` display.
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/lib/zod/api-key.ts`, `apps/web/lib/actions/api-keys.ts`, `apps/web/app/settings/api-keys/**`.
  - Required Capabilities: file write (Write, Edit), shell execution (Bash) for `pnpm --filter web typecheck` and `pnpm --filter web lint`.
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): default build-agent validators (no Tailwind exception here — this is NOT a prototype port file; Tailwind is allowed and expected)

- **mcp-validator**
  - Role: Run full-repo typecheck/lint/build, perform local curl smoke test against `pnpm dev:mcp`, verify Nixpacks file, and write the Claude Desktop smoke-test guide for the user to execute manually.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `tests/visual-baselines/phase-9-mcp/README.md`, validation reports (no production code).
  - Required Capabilities: all standard tools (Read, Bash, Write, Grep, Glob).
  - Plan Approval: false
  - Hooks: none (read-only + report writer)

## Validation Hooks

### Available Validators

- `migration_validator.py` — enforces `IF NOT EXISTS` and naming on `.sql` migration files.
- `rls_enabled_validator.py` — blocks any `CREATE TABLE` without `enable row level security`.
- `no_vapid_private_in_client.py` — blocks `VAPID_PRIVATE_KEY` references in client code (no-op here).
- `no_tailwind_in_prototype_port.py` — blocks Tailwind in prototype-port files (no-op here; settings UI is NOT a prototype port).

### Custom Validators

None — existing validators cover this problem. The `api_keys` migration triggers `migration_validator.py` and `rls_enabled_validator.py` automatically via db-agent's hook config.

### Hook Assignments

| Team Member          | Hook Type   | Matcher     | Validator                                     |
| -------------------- | ----------- | ----------- | --------------------------------------------- |
| db-builder           | PostToolUse | Write\|Edit | `migration_validator.py`                      |
| db-builder           | PostToolUse | Write\|Edit | `rls_enabled_validator.py`                    |
| mcp-server-builder   | PostToolUse | Write\|Edit | default build-agent validators (no-op for TS) |
| web-settings-builder | PostToolUse | Write\|Edit | default build-agent validators                |
| mcp-validator        | —           | —           | none                                          |

## Step by Step Tasks

### 1. Migration `0019_api_keys.sql` + apply + types regen

- **Task ID**: db-migration
- **Depends On**: none
- **Assigned To**: db-builder
- **Agent Type**: db-agent
- **Parallel**: true (Wave A)
- **Owns Files**: `packages/db/migrations/0019_api_keys.sql`, `apps/web/lib/supabase/types.ts`
- **Context**: Create migration `0019_api_keys.sql` with the EXACT DDL from `docs/superpowers/specs/2026-05-16-hatch-fase-9-design.md` §4. Table columns: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references public.profiles(id) on delete cascade`, `token_hash text not null`, `token_prefix text not null`, `label text not null default 'Claude Desktop'`, `created_at timestamptz default now()`, `last_used_at timestamptz`, `revoked_at timestamptz`. Indexes (all partial where `revoked_at is null`): `api_keys_user_id_idx (user_id)`, `api_keys_token_prefix_idx (token_prefix)`, UNIQUE `api_keys_one_active_per_user (user_id)`. Enable RLS. Policies: SELECT/INSERT scoped to `auth.uid() = user_id`; UPDATE scoped to `auth.uid() = user_id` with `with check (... and revoked_at is not null)` so users can only flip the revoke bit. Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. After writing, apply via `mcp__supabase__apply_migration({ project_id: 'vcbdtjjkkwryvmqbflah', name: '0019_api_keys', query: <file contents> })`. Then regen types via `mcp__supabase__generate_typescript_types` and write to `apps/web/lib/supabase/types.ts`. Run `pnpm typecheck` from repo root to confirm.
- **Actions**:
  - Write `packages/db/migrations/0019_api_keys.sql`
  - Apply via Supabase MCP `apply_migration`
  - Regen types into `apps/web/lib/supabase/types.ts`
  - Run `pnpm typecheck`

### 2. apps/mcp deps + nixpacks.toml + .env.example

- **Task ID**: mcp-bootstrap
- **Depends On**: none
- **Assigned To**: mcp-server-builder
- **Agent Type**: build-agent
- **Parallel**: true (Wave A)
- **Owns Files**: `apps/mcp/package.json`, `apps/mcp/nixpacks.toml`, `apps/mcp/.env.example`
- **Context**: Add deps to `apps/mcp/package.json` `dependencies`: `"@supabase/supabase-js": "^2.45.0"`, `"bcryptjs": "^2.4.3"`, `"zod": "^3.23.0"`. Add to `devDependencies`: `"@types/bcryptjs": "^2.4.6"`. Run `pnpm install` from repo root afterwards. Create `apps/mcp/nixpacks.toml`:
  ```toml
  providers = ["node"]
  [phases.setup]
  nixPkgs = ["nodejs_22"]
  [phases.install]
  cmds = [
    "corepack enable",
    "corepack prepare pnpm@10.0.0 --activate",
    "pnpm install --frozen-lockfile"
  ]
  [phases.build]
  cmds = ["pnpm --filter mcp build"]
  [start]
  cmd = "pnpm --filter mcp start"
  ```
  (`pnpm-10_x` is NOT a valid Nixpkgs attribute — corepack form is the working pattern.) Create `apps/mcp/.env.example`:
  ```
  PORT=8080
  SUPABASE_URL=https://vcbdtjjkkwryvmqbflah.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<set in Railway>
  LOG_LEVEL=info
  ```
- **Actions**:
  - Edit `apps/mcp/package.json` to add the four deps
  - Run `pnpm install` from repo root
  - Write `apps/mcp/nixpacks.toml`
  - Write `apps/mcp/.env.example`

### 3. Zod schema for api-key

- **Task ID**: web-zod
- **Depends On**: none
- **Assigned To**: web-settings-builder
- **Agent Type**: build-agent
- **Parallel**: true (Wave A)
- **Owns Files**: `apps/web/lib/zod/api-key.ts`
- **Context**: Create `apps/web/lib/zod/api-key.ts` exporting `ApiKeyGenerate` Zod object `{ label?: string }` where label is `z.string().trim().min(1).max(60).default('Claude Desktop')`. Export type `ApiKeyGenerateT = z.infer<typeof ApiKeyGenerate>`. Also export `ApiKeyRevoke` object `{ id: z.string().uuid() }` with `ApiKeyRevokeT`. Follow the style of `apps/web/lib/zod/publish.ts` and `apps/web/lib/zod/messages.ts`.
- **Actions**:
  - Write `apps/web/lib/zod/api-key.ts`

### 4. MCP server foundation (supabase + auth)

- **Task ID**: mcp-foundation
- **Depends On**: db-migration, mcp-bootstrap
- **Assigned To**: mcp-server-builder
- **Agent Type**: build-agent
- **Parallel**: false (sequential after Wave A)
- **Owns Files**: `apps/mcp/src/supabase.ts`, `apps/mcp/src/auth.ts`, `apps/mcp/src/types.ts`
- **Context**: Create `apps/mcp/src/supabase.ts` exporting a singleton service-role client. Pattern mirrors `apps/web/lib/supabase/admin.ts`: `import { createClient } from '@supabase/supabase-js'` + `import type { Database } from '@hatch/shared'`. Singleton pattern: lazy-init on first call.

  **Database type re-export setup** (do this BEFORE writing `supabase.ts`):
  1. Create `packages/shared/src/database.ts` with `export type { Database } from '../../../apps/web/lib/supabase/types';` (relative path is fine because `@hatch/shared` is `private: true` and resolves source directly via `main: ./src/index.ts`).
  2. Append `export * from './database.js';` to `packages/shared/src/index.ts`.
  3. Run `pnpm --filter @hatch/shared typecheck` to confirm.

  Create `apps/mcp/src/auth.ts` exporting `async function resolveUserId(authHeader: string | undefined): Promise<string | null>`. Steps: strip `Bearer ` prefix; if absent or wrong format → return null; take first 12 chars as `prefix`; query `api_keys` via service-role client `where token_prefix = prefix AND revoked_at IS NULL`; iterate rows, `bcrypt.compare(plainToken, row.token_hash)` (use `bcryptjs`); first match → `await` an UPDATE `api_keys SET last_used_at = now() WHERE id = row.id` (await it — the call is cheap and avoids tearing the connection down mid-request), then return `row.user_id`; no match → null. **Logging hygiene**: never log the plain token or `token_hash`. Logging `token_prefix` (first 12 chars) is acceptable for debugging since it's not sensitive on its own.

  Create `apps/mcp/src/types.ts` with shared types: `McpContext { userId: string; supabase: SupabaseClient<Database> }`, helper `ToolResult<T> = { content: [{ type: 'text', text: string }] }` (JSON.stringify the actual data).

- **Actions**:
  - Write `apps/mcp/src/supabase.ts`
  - Write `apps/mcp/src/auth.ts`
  - Write `apps/mcp/src/types.ts`
  - Run `pnpm --filter mcp typecheck`

### 5. MCP transport + server registration

- **Task ID**: mcp-server-shell
- **Depends On**: mcp-foundation
- **Assigned To**: mcp-server-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/mcp/src/transport.ts`, `apps/mcp/src/server.ts`, `apps/mcp/src/index.ts`
- **Context**: Create `apps/mcp/src/server.ts` exporting `createMcpServer(ctx: McpContext)` that returns a configured `Server` from `@modelcontextprotocol/sdk/server/index.js`. Register handlers for `ListToolsRequestSchema`, `CallToolRequestSchema`, `ListResourcesRequestSchema`, `ReadResourceRequestSchema`, `ListPromptsRequestSchema`, `GetPromptRequestSchema`. The handler implementations live in `tools/`, `resources/`, `prompts/` modules (built in subsequent tasks). For now, register them with empty/stub arrays — Tasks 6/7/8 will fill them.

  Create `apps/mcp/src/transport.ts` implementing Streamable HTTP. Per MCP spec 2025-03-26, single `POST /mcp` endpoint accepts JSON-RPC payloads, responds either with single JSON-RPC response or `text/event-stream` for streaming. Use SDK's `StreamableHTTPServerTransport` if available in `@modelcontextprotocol/sdk/server/streamableHttp.js`; otherwise implement minimally per spec. Per-request: extract `Authorization` header, call `resolveUserId`, return 401 if null, otherwise instantiate fresh `McpContext` and connect the server to the transport for that request.

  Rewrite `apps/mcp/src/index.ts` to mount BOTH `/health` (preserved from current stub) AND `/mcp` (POST → transport). Keep `PORT` env var. Logging on server start should print `[mcp] listening on :${PORT} with /health and /mcp`.

  Use Context7 to fetch `@modelcontextprotocol/sdk` docs if the SDK API shape is unclear. The package is at https://github.com/modelcontextprotocol/typescript-sdk.

- **Actions**:
  - Write `apps/mcp/src/server.ts` (handlers registered, stub bodies)
  - Write `apps/mcp/src/transport.ts`
  - Edit `apps/mcp/src/index.ts` to mount `/health` + `/mcp`
  - Run `pnpm --filter mcp typecheck`

### 6. MCP tools — read + publish + social (10 tools)

- **Task ID**: mcp-tools
- **Depends On**: mcp-server-shell
- **Assigned To**: mcp-server-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/mcp/src/tools/read.ts`, `apps/mcp/src/tools/publish.ts`, `apps/mcp/src/tools/social.ts`
- **Context**: Implement all 10 tool families per spec §5.1. Each tool exports `{ name, description, inputSchema, handler }`. `inputSchema` is a JSON Schema object (NOT a Zod schema — MCP SDK uses raw JSON Schema). Use Zod internally inside the handler for runtime validation, but expose JSON Schema in the tool descriptor.

  `tools/read.ts`:
  - `list_apps({ cursor?, limit? })` — query `apps` ordered by `created_at desc`, join `profiles!apps_author_id_fkey` for author. Default limit 20, max 50. Cursor is the `created_at` of the last item.
  - `search_apps({ query, limit? })` — use `to_tsvector` already present on `apps`; `apps.search_vector @@ plainto_tsquery('english', query)`. `query.length >= 2` else throw.
  - `get_app({ slug })` — single row with author + counters (likes_count, saves_count). 404 (throw with `Error: 'not_found'`) if missing.
  - `list_categories({})` — query `public.categories order by sort_order` (the table exists per `packages/db/migrations/0002_categories.sql` with columns `id, label, icon, sort_order`). Return full rows.
  - `get_profile({ handle })` — single profile, include `app_count`, `follower_count` (subqueries or counts).
  - `list_notifications({ unread_only?, limit? })` — scoped to `ctx.userId`. Default limit 20.

  `tools/publish.ts`:
  - `publish_app({ name, slug?, description, category, repo_url?, demo_url?, app_art_seed? })` — mirror `apps/web/lib/actions/publish.ts`. Validate with Zod, autogen slug from name if missing (kebab-case), enforce slug uniqueness, set `author_id = ctx.userId`.
  - `update_app({ slug, ...partial })` — ownership check: select `apps where slug = $1`, confirm `author_id === ctx.userId`, else throw `forbidden`. Apply partial update.

  `tools/social.ts`:
  - `like_app({ slug })` / `unlike_app({ slug })` — toggle row in `likes` table; mirror `apps/web/lib/actions/like.ts`.
  - `save_app({ slug })` / `unsave_app({ slug })` — toggle in `saves`; mirror `apps/web/lib/actions/save.ts`.
  - `follow_user({ handle })` / `unfollow_user({ handle })` — toggle in `follows`; mirror `apps/web/lib/actions/follow.ts`. Block self-follow.
  - `send_message({ to_handle, body })` — verify a `contact_request` with `status='accepted'` exists between `ctx.userId` and the recipient; mirror `apps/web/lib/actions/messages.ts`.

  Each tool returns `{ content: [{ type: 'text', text: JSON.stringify(result) }] }` on success, throws Error on failure (SDK converts to JSON-RPC error).

  After writing, update `apps/mcp/src/server.ts` to import all tool descriptors and wire them into `ListToolsRequestSchema` + `CallToolRequestSchema` handlers (dispatch by tool name).

- **Actions**:
  - Write `apps/mcp/src/tools/read.ts`
  - Write `apps/mcp/src/tools/publish.ts`
  - Write `apps/mcp/src/tools/social.ts`
  - Edit `apps/mcp/src/server.ts` to wire tools
  - Run `pnpm --filter mcp typecheck`

### 7. MCP resources (3)

- **Task ID**: mcp-resources
- **Depends On**: mcp-tools
- **Assigned To**: mcp-server-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/mcp/src/resources/index.ts`
- **Context**: Implement three resources per spec §5.2:
  - `hatch://app/{slug}` — same JSON as `get_app` tool result.
  - `hatch://profile/{handle}` — same JSON as `get_profile` tool result.
  - `hatch://notifications` — last 50 notifications for `ctx.userId`.

  Export `{ listResources(), readResource(uri, ctx) }`. `listResources` returns a static array of URI templates (since slug/handle are dynamic, return one template per pattern). `readResource` parses the URI, dispatches to the right query, returns `{ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }] }`.

  After writing, update `apps/mcp/src/server.ts` to wire `ListResourcesRequestSchema` + `ReadResourceRequestSchema`. Runs sequentially after `mcp-tools` to avoid `server.ts` edit conflict.

- **Actions**:
  - Write `apps/mcp/src/resources/index.ts`
  - Edit `apps/mcp/src/server.ts` to wire resources
  - Run `pnpm --filter mcp typecheck`

> **Sequencing note**: `mcp-tools` → `mcp-resources` → `mcp-prompts` are strictly serial because all three edit `apps/mcp/src/server.ts`. Enforced via `Depends On` fields.

### 8. MCP prompts (3)

- **Task ID**: mcp-prompts
- **Depends On**: mcp-resources
- **Assigned To**: mcp-server-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/mcp/src/prompts/index.ts`
- **Context**: Implement three prompt templates per spec §5.3:
  - `draft_app_description({ app_name, what_it_does, target_audience? })` — returns `messages: [{ role: 'user', content: { type: 'text', text: <template-rendered text> } }]`. Template: "Draft a Hatch-style app description for `{app_name}`. It is a tool that `{what_it_does}`. Target audience: `{target_audience ?? 'builders and indie hackers'}`. Tone: concise, builder-friendly, 80-120 words, no marketing fluff."
  - `review_my_apps({})` — fetches the user's apps via `get_profile` internally and returns a prompt asking Claude to review copy/tags.
  - `compose_message({ to_handle, intent })` — fetches recipient profile and returns a prompt to draft a DM matching Hatch tone.

  Export `{ listPrompts(), getPrompt(name, args, ctx) }`. After writing, update `apps/mcp/src/server.ts` to wire `ListPromptsRequestSchema` + `GetPromptRequestSchema`.

- **Actions**:
  - Write `apps/mcp/src/prompts/index.ts`
  - Edit `apps/mcp/src/server.ts` to wire prompts
  - Run `pnpm --filter mcp typecheck && pnpm --filter mcp build`

### 9. Web server actions for API keys

- **Task ID**: web-actions
- **Depends On**: db-migration, web-zod
- **Assigned To**: web-settings-builder
- **Agent Type**: build-agent
- **Parallel**: true (with mcp-foundation/shell/tools — different file tree)
- **Owns Files**: `apps/web/lib/actions/api-keys.ts`
- **Context**: Create `apps/web/lib/actions/api-keys.ts` with `'use server'` directive. Pattern follows `apps/web/lib/actions/messages.ts` (Result<T> discriminated union, Zod validation, `requireUser()` for auth).

  Functions:
  - `generateApiKey(input: ApiKeyGenerateT): Promise<Result<{ plainToken: string; label: string }>>`:
    1. Validate input with `ApiKeyGenerate.safeParse`.
    2. `await requireUser()` → throws if not logged in; catch → `unauthorized`.
    3. Server-side client (`createSupabaseServerClient`): check no active key exists for user (`select id from api_keys where user_id = $user and revoked_at is null limit 1`). If exists → `{ ok: false, error: 'active_key_exists' }`.
    4. Generate plain token: `hatch_pat_` + `crypto.randomBytes(32).toString('base64url')` (Node `node:crypto`).
    5. `token_prefix` = first 12 chars of the plain token.
    6. `bcrypt.hash(plainToken, 10)` using `bcryptjs` — cost 10 (~75ms; 256-bit token entropy makes higher cost unnecessary). Add dep to `apps/web/package.json`.
    7. Insert via server client (RLS will check `user_id = auth.uid()`). Return `{ ok: true, data: { plainToken, label } }`.
    8. `revalidatePath('/settings/api-keys')`.

  - `revokeApiKey(input: ApiKeyRevokeT): Promise<Result<{ id: string }>>`:
    1. Validate input.
    2. `await requireUser()`.
    3. Update `api_keys set revoked_at = now() where id = $id and user_id = $user and revoked_at is null`. Return `{ ok: true, data: { id } }` if rowcount > 0, else `{ ok: false, error: 'not_found' }`.
    4. `revalidatePath('/settings/api-keys')`.

  Also add deps to `apps/web/package.json`: `"bcryptjs": "^2.4.3"`, `"@types/bcryptjs": "^2.4.6"` (devDep). Run `pnpm install` after.

- **Actions**:
  - Edit `apps/web/package.json` to add bcryptjs deps
  - Run `pnpm install`
  - Write `apps/web/lib/actions/api-keys.ts`
  - Run `pnpm --filter web typecheck`

### 10. Web UI — /settings/api-keys page + components

- **Task ID**: web-ui
- **Depends On**: web-actions
- **Assigned To**: web-settings-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/settings/api-keys/page.tsx`, `apps/web/app/settings/api-keys/_components/generate-key-flow.tsx`, `apps/web/app/settings/api-keys/_components/mcp-config-snippet.tsx`
- **Context**: Create `apps/web/app/settings/api-keys/page.tsx` as a Server Component:
  - Use `createSupabaseServerClient` to fetch the user's active `api_keys` row (limit 1, where revoked_at is null).
  - Use `requireUser()` for auth gate (redirect to `/sign-in` if absent).
  - Render header "API Keys" + body explaining the purpose (1-2 sentences).
  - If no active key: render `<GenerateKeyFlow />` client component.
  - If active key: render details (label, masked prefix `<prefix>...****`, `created_at` formatted, `last_used_at` formatted or "never"), a Revoke button (form action posting to `revokeApiKey`), AND `<McpConfigSnippet endpoint={mcpUrl} />`.
  - `mcpUrl` comes from `process.env.NEXT_PUBLIC_MCP_URL ?? 'http://localhost:8080/mcp'`.
  - Tailwind allowed (NOT a prototype port file).

  Create `apps/web/app/settings/api-keys/_components/generate-key-flow.tsx` (Client Component, `'use client'`):
  - Button "Generate API Key" → on click calls `generateApiKey` server action via `useTransition`.
  - On success: open inline panel (or `<dialog>`) showing the plain token in a `<code>` block with copy-to-clipboard button. Header text: "Save this now — you won't see it again." Sub-text: "After closing, the token is gone for good. Revoke and regenerate if you lose it." Close button reloads via `router.refresh()`.
  - On error: render the error inline.

  Create `apps/web/app/settings/api-keys/_components/mcp-config-snippet.tsx` (Client Component):
  - Props: `endpoint: string`.
  - Render a `<pre><code>` block with:
    ```json
    {
      "mcpServers": {
        "hatch": {
          "url": "<endpoint>",
          "headers": { "Authorization": "Bearer <paste-your-token>" }
        }
      }
    }
    ```
  - Copy-to-clipboard button.

- **Actions**:
  - Write `apps/web/app/settings/api-keys/page.tsx`
  - Write `apps/web/app/settings/api-keys/_components/generate-key-flow.tsx`
  - Write `apps/web/app/settings/api-keys/_components/mcp-config-snippet.tsx`
  - Run `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`

### 11. RLS validation on api_keys

- **Task ID**: db-rls-check
- **Depends On**: db-migration, web-ui
- **Assigned To**: db-builder
- **Agent Type**: db-agent
- **Parallel**: true (with mcp-validation since they touch different things)
- **Owns Files**: (no new files; runs SQL via Supabase MCP)
- **Context**: Verify RLS on `api_keys` table:
  1. `mcp__supabase__list_tables({ schemas: ['public'] })` — confirm `api_keys` exists with `rls_enabled: true`.
  2. `mcp__supabase__get_advisors({ project_id: 'vcbdtjjkkwryvmqbflah', type: 'security' })` — confirm no new advisor warnings about `api_keys`.
  3. Cross-user RLS isolation test via `mcp__supabase__execute_sql`. Note: the MCP tool runs as service role which bypasses RLS by default — to exercise the policies you MUST switch the role inside the query block:

     ```sql
     -- Pick two existing profile IDs
     WITH ids AS (SELECT id FROM public.profiles ORDER BY created_at LIMIT 2)
     -- Insert one test row for user A via service role
     INSERT INTO public.api_keys (user_id, token_hash, token_prefix, label)
     SELECT (SELECT id FROM ids LIMIT 1), 'TESTHASH', 'TESTPREFIX1', 'rls-test';

     -- Now simulate user B reading user A's keys
     SET LOCAL ROLE authenticated;
     SET LOCAL request.jwt.claims = '{"sub":"<user-B-uuid>","role":"authenticated"}';
     SELECT count(*) AS leaked_rows FROM public.api_keys;  -- expect 0 (user B sees nothing)
     RESET ROLE;

     -- Cleanup test row
     DELETE FROM public.api_keys WHERE label = 'rls-test';
     ```

     Expected: `leaked_rows = 0`. If > 0, RLS is broken — block.

  4. UPDATE policy test (also within a `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims=...` block): attempt to unrevoke an already-revoked row. Expected: 0 rows updated (the `with check (revoked_at IS NOT NULL)` clause blocks it).
  5. Document findings in the task report.

- **Actions**:
  - Run all four checks via Supabase MCP tools
  - Report pass/fail with specific row counts

### 12. Local smoke test + repo-wide validation

- **Task ID**: mcp-validation
- **Depends On**: mcp-prompts, web-ui
- **Assigned To**: mcp-validator
- **Agent Type**: general-purpose
- **Parallel**: true (with db-rls-check)
- **Owns Files**: (no source files; writes report only)
- **Context**: Execute and report on:
  1. `pnpm typecheck` (repo root) — must exit 0.
  2. `pnpm lint` (repo root) — must exit 0.
  3. `pnpm build` (repo root) — must exit 0.
  4. Local MCP server smoke test:
     - Start `pnpm dev:mcp` in background.
     - `curl -i http://localhost:8080/health` — expect 200 with `{"ok":true,...}`.
     - Generate a test API key by inserting a row directly via Supabase MCP `execute_sql` (use a known test user ID, hash a known plain token with bcryptjs cost 12 — script this).
     - `curl -X POST http://localhost:8080/mcp -H "Authorization: Bearer <plain>" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'` — expect 200 with `result.serverInfo.name === 'hatch-mcp'`.
     - `curl -X POST .../mcp ... -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'` — expect 10+ tools.
     - `curl -X POST .../mcp ... -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_apps","arguments":{"limit":3}}}'` — expect 200 with 3 apps in the response text.
     - Auth negative: same curl without `Authorization` header → expect 401.
     - Kill the dev process.
     - Clean up the test API key row.
  5. Verify `apps/mcp/nixpacks.toml` exists. Structural check: `grep -E '^\[(phases|start)' apps/mcp/nixpacks.toml | wc -l` should output `>= 3` (setup, install, build, start sections). Skip a full TOML parser dependency — Railway will validate on deploy.

  Write a markdown report at `tests/visual-baselines/phase-9-mcp/local-smoke-report.md` listing each check and its result.

- **Actions**:
  - Run typecheck/lint/build
  - Run local smoke test sequence (curl + Supabase MCP for test key setup/teardown)
  - Write report to `tests/visual-baselines/phase-9-mcp/local-smoke-report.md`

### 13. Claude Desktop smoke test guide (for manual user execution)

- **Task ID**: claude-desktop-guide
- **Depends On**: mcp-validation
- **Assigned To**: mcp-validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Owns Files**: `tests/visual-baselines/phase-9-mcp/README.md`
- **Context**: Write a step-by-step guide the user follows manually:
  1. Deploy `apps/mcp` to Railway (link repo if not linked, set env vars `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, deploy, capture the public URL).
  2. Set `NEXT_PUBLIC_MCP_URL` on Vercel (web app) to `<railway-url>/mcp` and redeploy.
  3. Visit `/settings/api-keys` on the deployed web app, generate a key, copy the plain token + the `mcp-config.json` snippet.
  4. In Claude Desktop: open settings → MCP → paste config (replace `<paste-your-token>` with the plain token). Restart Claude Desktop.
  5. In Claude Desktop, ask: "Use the Hatch MCP to list the latest 3 apps." → Claude should call `list_apps`. Screenshot the response.
  6. Ask: "Get the Hatch profile for handle `<your-handle>`." → screenshot.
  7. Ask: "Like the app at `<some-slug>`." → screenshot, confirm in `/u/<your-handle>` that the like persisted.
  8. Save all screenshots to `tests/visual-baselines/phase-9-mcp/` as `01-list-apps.png`, `02-get-profile.png`, `03-like-app.png`.

  The guide ends with: "If any step fails, capture the error screenshot and the Railway logs."

- **Actions**:
  - Write `tests/visual-baselines/phase-9-mcp/README.md`

### 14. Expert self-improvement

- **Task ID**: experts-self-improve
- **Depends On**: claude-desktop-guide
- **Assigned To**: mcp-validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Owns Files**: `.claude/commands/experts/mcp-server/expertise.yaml`, `.claude/commands/experts/supabase/expertise.yaml`
- **Context**: After all implementation is complete, refresh expert YAMLs to reflect the new state:
  - `mcp-server`: bump status from "Phase 2 stub" to "Phase 9 shipped". Document tools/resources/prompts surface, auth flow, Streamable HTTP transport, Nixpacks deploy.
  - `supabase`: add `api_keys` table to the documented table list.

  Invoke each expert's `self-improve` skill via the Skill tool (`experts:mcp-server:self-improve`, `experts:supabase:self-improve`) and let them refresh themselves. Verify by re-reading the YAMLs.

- **Actions**:
  - Run `Skill` with `experts:mcp-server:self-improve`
  - Run `Skill` with `experts:supabase:self-improve`
  - Confirm YAMLs were updated

### 15. Final Validation

- **Task ID**: validate-all
- **Depends On**: experts-self-improve, db-rls-check
- **Assigned To**: mcp-validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Context**: Final sweep:
  1. Re-run `pnpm typecheck && pnpm lint && pnpm build` — all green.
  2. Verify every acceptance criterion below is met.
  3. Confirm `tests/visual-baselines/phase-9-mcp/local-smoke-report.md` and `README.md` exist.
  4. Confirm `packages/db/migrations/0019_api_keys.sql` is applied to cloud (`mcp__supabase__list_migrations`).
  5. Report final pass/fail.
- **Actions**:
  - Run all three validation commands
  - Verify acceptance criteria
  - Report final status

## Testing Strategy

### Unit Tests

This feature does not introduce unit-tested logic in the traditional sense — instead it relies on:

- **DB-level enforcement** (RLS + unique partial index) validated by Task 11.
- **Integration smoke test** (curl against the actual MCP server) validated by Task 12.
- **Manual end-to-end** (Claude Desktop) validated by Task 13 with screenshot evidence.

If we wanted unit tests in a future phase, target candidates are: `auth.ts` (bcrypt compare logic) and per-tool input Zod parsing. Out of scope for this plan.

### Edge Cases

- Bearer header present but malformed (no `Bearer ` prefix) → 401, no DB query.
- Token prefix matches a row but bcrypt mismatch → 401, no `last_used_at` update.
- User attempts to generate a second active key → `{ ok: false, error: 'active_key_exists' }`.
- User attempts to revoke an already-revoked key → no-op, returns `{ ok: false, error: 'not_found' }` (or success — pick one; spec says no-op is fine).
- `update_app` called by non-owner → throws `forbidden`.
- `send_message` called without an accepted `contact_request` → throws `forbidden`.
- `search_apps` with `query.length < 2` → throws validation error.
- `list_apps` cursor pointing past end → empty array, no `next_cursor`.
- Token revoked while a Claude Desktop session is open → next call returns 401, Claude Desktop surfaces the error.
- `publish_app` with duplicate slug → throws `slug_taken` (mirror existing web action behavior).

## Acceptance Criteria

1. Migration `0019_api_keys.sql` applied to Supabase cloud; `api_keys` table exists with RLS enabled and three policies (read own, insert own, revoke own).
2. Unique partial index `api_keys_one_active_per_user` prevents two non-revoked rows for the same user (verified by Task 11).
3. `apps/web/lib/supabase/types.ts` includes `api_keys` type and `pnpm typecheck` passes.
4. `apps/mcp/src/` contains foundation, transport, server, tools, resources, prompts files; `pnpm --filter mcp build` produces working `dist/` output.
5. Local `pnpm dev:mcp` serves `GET /health` 200 and `POST /mcp` per MCP Streamable HTTP spec.
6. `POST /mcp` with valid Bearer token returns 200 + `initialize` + `tools/list` (10+ tools) + at least one successful `tools/call` (Task 12 evidence).
7. `POST /mcp` without Bearer or with revoked token returns 401.
8. `apps/web/app/settings/api-keys/page.tsx` renders for a logged-in user; "Generate" creates a key and shows it once; "Revoke" disables it.
9. The page shows a copyable `mcp-config.json` snippet with the Railway URL.
10. `apps/mcp/nixpacks.toml` and `.env.example` exist and are syntactically valid.
11. `tests/visual-baselines/phase-9-mcp/local-smoke-report.md` documents the local smoke test pass.
12. `tests/visual-baselines/phase-9-mcp/README.md` exists as the manual Claude Desktop smoke-test guide.
13. Repo-wide `pnpm typecheck && pnpm lint && pnpm build` all exit 0 after every task completes.
14. Experts `mcp-server` and `supabase` YAMLs are refreshed to reflect Phase 9 state.

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm typecheck` — TypeScript checks across all workspaces.
- `pnpm lint` — ESLint + Prettier checks.
- `pnpm build` — production build (web + mcp).
- `pnpm --filter mcp build && node apps/mcp/dist/index.js &` then `curl -i http://localhost:8080/health` — confirm MCP server boots from built dist.
- `mcp__supabase__list_tables({ schemas: ['public'] })` — confirm `api_keys` present with `rls_enabled: true`.
- `mcp__supabase__list_migrations` — confirm `0019_api_keys` is the latest applied migration.
- `mcp__supabase__get_advisors({ project_id: 'vcbdtjjkkwryvmqbflah', type: 'security' })` — no new warnings.

## Notes

- **Library additions**: `bcryptjs` (+ `@types/bcryptjs`) added to BOTH `apps/web/package.json` and `apps/mcp/package.json`. `@supabase/supabase-js` and `zod` added to `apps/mcp/package.json` (already in `apps/web/package.json`).
- **Railway deploy is a USER manual action** — Task 13 documents it. The plan stops at "Nixpacks file ready + local smoke test passes"; the user pushes a branch / merges to main and Railway autodeploys.
- **`NEXT_PUBLIC_MCP_URL`** is the env var the web UI reads to render the `mcp-config.json` snippet. Default `http://localhost:8080/mcp` in dev; set to Railway URL in Vercel for prod.
- **MCP SDK API**: if any tool/resource/prompt handler API shape is unclear, use `mcp__plugin_context7_context7__resolve-library-id` followed by `query-docs` for `@modelcontextprotocol/typescript-sdk` rather than guessing.
- **Post-v1 follow-ups** (NOT in this plan, documented in spec §10): scoped tokens, multiple tokens per user with labels, audit log of MCP invocations, per-token rate limiting, OAuth2 flow, AI tools (`summarize_app`, `suggest_tags`).
- **Sequencing constraint**: `mcp-tools` → `mcp-resources` → `mcp-prompts` MUST be serial because all three edit `apps/mcp/src/server.ts` to wire their handlers. Parallelizing causes overwrites.
- **Rollback for `0019_api_keys`**: no down migration in this repo (per existing convention — none of `0001`-`0018` have one). If the migration needs to be reverted, fix-forward with a new `0020_drop_api_keys.sql` containing `drop table if exists public.api_keys cascade;`. Document this in the task report if it happens.
- **`send_message` conversation auto-create**: mirror `apps/web/lib/actions/messages.ts` exactly — if a conversation between the two participants doesn't exist, the existing `sendMessage` action auto-creates one (check the source to confirm) provided an accepted `contact_request` exists. The MCP tool MUST follow the same logic, not invent its own.
- **`tsconfig.json` for apps/mcp**: leave `module: "NodeNext"` and `moduleResolution: "NodeNext"`. With `@hatch/shared` set to `main: ./src/index.ts`, tsc will resolve the type re-export directly from source — no `paths`, `references`, or `composite` setup needed. If tsc complains about reaching outside `rootDir`, add `"rootDir": ".."` or use `"include": ["src/**/*", "../../packages/shared/src/**/*"]` (try the minimal fix first).

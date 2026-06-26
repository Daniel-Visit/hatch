# Feature: Wanted (Brief & Match) — Phase 0 Foundations

## Metadata
issue_number: `0`
adw_id: `de`
issue_json: `Phase 0 (Foundations) of the "Wanted / Brief & Match" feature`

## Feature Description

Foundations for the "Wanted" feature (code name **Brief & Match**): a seeker posts a
need, and a system of agents structures it and matches it to existing apps or to
builders. This phase lays the **data + library substrate only** — no routes, no UI,
no agents yet. Everything ships **inert behind a feature flag** (`wanted_v1_enabled`,
off by default).

Phase 0 delivers: 5 additive SQL migrations (the `briefs` / `matches` /
`brief_refinement_turns` / `brief_match_audit_logs` / `validator_suggestions` tables +
~15 native enums + additive columns on `profiles` and `apps`), the regenerated
Supabase TypeScript types, the shared `BriefContent` zod schema + enum unions +
embedding-text recipes, the feature-flag helper, the brief repository (CRUD + quota +
state-transition guards), the §1.7 invariant predicates, and the project's **first
unit-test harness** (vitest).

The original spec (`new/01-architecture-and-data.md`) is written in Prisma; this phase
**translates it to hatch's real stack** (Supabase SQL applied via the Supabase MCP — no
Prisma, no local Postgres, no Docker). The adaptation decisions are recorded in
`docs/superpowers/specs/2026-06-01-wanted-adaptation-design.md`.

## User Story

As a hatch engineer building the Wanted feature
I want the database schema, shared types, brief repository, and feature flag in place behind a flag
So that subsequent phases (Refiner, Matcher, UI) have a typed, tested, RLS-protected substrate to build on without exposing anything to users prematurely.

## Problem Statement

The Wanted feature needs `Brief`, `Match`, and supporting tables, plus shared types and a
quota-enforcing repository, before any agent or UI work can begin. The spec assumes a
Prisma/`packages/core`/pgvector stack that hatch does not use (hatch is Supabase SQL via
MCP, `apps/web` + `packages/shared`, full-text search). Building Phase 1+ on an
unadapted foundation would cascade wrong assumptions across 40 tasks. There is also **no
unit-test framework in the repo today**, which the feature's quality bar requires.

## Solution Statement

Author 5 additive, idempotent SQL migrations following hatch conventions
(`public.snake_plural` tables, `uuid`/`gen_random_uuid()`, native PG enums, RLS on every
table, the existing `public.touch_updated_at()` trigger, `CHECK` constraints for the
expressible §1.7 invariants), apply them via the Supabase MCP, and regenerate the
TypeScript types. Add the pure shared pieces (`BriefContentSchema`, enum unions,
embedding recipes, `isWantedEnabled`) to `packages/shared`, and the agentic-substrate
pieces (`brief-repo`, `invariants`, `completeness`) to `apps/web/lib/wanted/`. Establish
vitest as the test runner and cover the pure functions. **No vector columns** (the
embedding dimension depends on a provider not yet approved — deferred per decision D1).

## Relevant Files

Use these files to implement the feature:

- `docs/superpowers/specs/2026-06-01-wanted-adaptation-design.md` — the approved adaptation design (decisions, conventions, Phase 0 detail, 5-phase map). **Primary reference.**
- `new/01-architecture-and-data.md` — original spec: §1.4 Prisma schema (translate to SQL), §1.5 migration order, §1.6 embedding recipes, §1.7 invariants, §1.7.1 completeness-vs-quality.
- `new/03-agents.md` — §3.1.4 `BriefContentSchema` (zod), §3.1.6 `computeCompletenessScore`.
- `packages/db/migrations/0006_apps.sql` — table/trigger/index/citext conventions to mirror.
- `packages/db/migrations/0015_notifications.sql` — idempotent native-enum (`do $$ ... if not exists ... create type ...`) pattern to mirror.
- `packages/db/migrations/0007_apps_rls.sql` — RLS policy pattern (`auth.uid()` checks) to mirror.
- `packages/db/migrations/0001_init.sql` — defines `public.touch_updated_at()` (line ~74) — REUSE for `updated_at` triggers; do not redefine.
- `apps/web/lib/supabase/server.ts` — `createServerClient<Database>()` pattern for the repo.
- `apps/web/lib/supabase/types.ts` — generated `Database` type (955 lines); will be regenerated to include the new tables.
- `packages/shared/src/database.ts` — 3-line re-export of `Database` from web types; **no edit needed** (auto-picks up new tables).
- `packages/shared/src/index.ts` — barrel; add `export * from './wanted'` and `'./feature-flags'`.
- `apps/web/lib/zod/search.ts` and `apps/web/lib/zod/publish.ts` — existing zod style to mirror for `BriefContentSchema`.
- `.claude/commands/conditional_docs.md` matched docs: `README.md` (architecture, pnpm workspace), `SPEC.md` (data model / scope), `CONTRIBUTING.md` (branch + commit format — we are on `feature/wanted-v1`).

### New Files

- `packages/db/migrations/0030_wanted_enums.sql`
- `packages/db/migrations/0031_briefs.sql`
- `packages/db/migrations/0032_matches.sql`
- `packages/db/migrations/0033_brief_audit.sql`
- `packages/db/migrations/0034_extend_profiles_apps.sql`
- `packages/shared/src/wanted/index.ts`
- `packages/shared/src/wanted/enums.ts`
- `packages/shared/src/wanted/brief-content.ts`
- `packages/shared/src/wanted/embedding-recipes.ts`
- `packages/shared/src/feature-flags.ts`
- `apps/web/lib/wanted/completeness.ts`
- `apps/web/lib/wanted/invariants.ts`
- `apps/web/lib/wanted/brief-repo.ts`
- `apps/web/lib/wanted/completeness.test.ts`
- `apps/web/lib/wanted/invariants.test.ts`
- `packages/shared/src/feature-flags.test.ts`
- `vitest.config.ts` (root)

## Implementation Plan

### Phase 1: Foundation

Stand up the database schema and the test runner — the two things everything else
depends on. Migrations are authored to hatch conventions and applied to the cloud
project (`vcbdtjjkkwryvmqbflah`) via the Supabase MCP, then types are regenerated. In
parallel, vitest is added as the root test runner (the repo has none today), and the
pure shared types (`BriefContentSchema`, enums, embedding recipes, `isWantedEnabled`)
are authored — these have no DB dependency.

### Phase 2: Core Implementation

Build the `apps/web/lib/wanted/` substrate: `completeness.ts` (pure scoring),
`invariants.ts` (pure §1.7 predicates incl. the quota rule), and `brief-repo.ts` (thin
typed Supabase queries for create/read + active-brief count, calling the pure predicates
and throwing on quota violation). Author the unit tests for the pure functions.

### Phase 3: Integration

Wire the shared barrel exports, confirm the regenerated `Database` type flows through
`packages/shared/src/database.ts` to `apps/mcp` and `apps/web`, and run the full
validation suite (`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`) to prove zero
regressions. Everything remains inert behind the flag — no routes, pages, or MCP tools
are registered in this phase.

## Expert Context

Experts consulted (read `.claude/commands/experts/<domain>/expertise.yaml`):

- **database** — Migrations applied via Supabase MCP tools ONLY (never `supabase` CLI). `migrations_dir: packages/db/migrations/`. RLS on ALL tables (`SELECT` uses `auth.uid()`; `INSERT/UPDATE/DELETE` restricted to row owner; anon read-only for public data). snake_case names. Shared types at `packages/shared/src/database.ts` (re-export). Project ref `vcbdtjjkkwryvmqbflah`.
- **supabase** — `apps/web/lib/auth.ts` exports `getUser()`/`requireUser()`; `apps/web/lib/supabase/server.ts` = `createServerClient<Database>` (RLS-scoped); `admin.ts` = service-role (`persistSession:false`, bypasses RLS). Migrations are cloud-only; regenerate `apps/web/lib/supabase/types.ts` via MCP after each migration. The spec's `User` maps to `public.profiles`.
- **nextjs** — `packages/shared` exported via `@hatch/shared` (exports `./src/index.ts`). `apps/web` uses the `@/` path alias. Tailwind v4; prototype-port rule (N/A — no UI this phase).
- **testing** — STUB (not yet self-improved); repo currently has **no test framework**. This phase establishes it (vitest). Run `/experts:testing:self-improve true` afterward to capture the new harness.

Key takeaways baked into tasks: reuse `public.touch_updated_at()`; idempotent enum creation via `do $$ ... pg_type ...`; RLS enabled + policies authored per table; `Database` re-export means only `apps/web/lib/supabase/types.ts` is regenerated.

## Team Orchestration

This plan uses Claude Code's **agent teams** for coordinated parallel execution. The executor operates as the **team lead in delegate mode** — orchestrating teammates without writing code directly.

### Team Setup

Executed via `/tac:implement specs/issue-0-adw-de-sdlc_planner-wanted-phase0-foundations.md` (subagent-driven development: fresh subagent per task, two-stage review, final validation).

### Team Members

- **wanted-db**
  - Role: Author the 5 SQL migrations, apply them to the cloud project via Supabase MCP, regenerate the TypeScript types, and verify RLS/security via advisors.
  - Agent Type: `db-agent`
  - Model: sonnet
  - Owns Files: `packages/db/migrations/0030_wanted_enums.sql`, `packages/db/migrations/0031_briefs.sql`, `packages/db/migrations/0032_matches.sql`, `packages/db/migrations/0033_brief_audit.sql`, `packages/db/migrations/0034_extend_profiles_apps.sql`, `apps/web/lib/supabase/types.ts` (regenerated, not hand-edited)
  - Required Capabilities: file write (Write, Edit) for migration SQL; Supabase MCP (`mcp__supabase__apply_migration`, `mcp__supabase__generate_typescript_types`, `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`, `mcp__supabase__list_extensions`) to apply migrations + regen types + verify RLS; shell (Bash) for git/diff checks
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `migration_validator.py` (enforces idempotency on `.sql`; skips non-`.sql`) — from db-agent frontmatter, already configured

- **wanted-shared**
  - Role: Author the pure shared pieces — `BriefContent` zod schema, enum unions, embedding-text recipes, feature-flag helper — and wire the barrel + add the `zod` dependency to `packages/shared`.
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `packages/shared/src/wanted/index.ts`, `packages/shared/src/wanted/enums.ts`, `packages/shared/src/wanted/brief-content.ts`, `packages/shared/src/wanted/embedding-recipes.ts`, `packages/shared/src/feature-flags.ts`, `packages/shared/src/index.ts`, `packages/shared/package.json`
  - Required Capabilities: file write (Write, Edit) for TS source + package.json; shell (Bash) for `pnpm --filter @hatch/shared typecheck`
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `ruff_validator.py` + `ty_validator.py` (both skip non-`.py` — no-op on `.ts`) — from build-agent frontmatter

- **wanted-web-lib**
  - Role: Author the agentic substrate in `apps/web/lib/wanted/` — pure completeness scoring, pure §1.7 invariant predicates, and the thin typed brief repository.
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/lib/wanted/completeness.ts`, `apps/web/lib/wanted/invariants.ts`, `apps/web/lib/wanted/brief-repo.ts`
  - Required Capabilities: file write (Write, Edit) for TS; shell (Bash) for `pnpm --filter web typecheck`
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `ruff_validator.py` + `ty_validator.py` (no-op on `.ts`)

- **wanted-tests**
  - Role: Establish the vitest test runner (root config + `test` script + dev dependency) and write the unit tests for the pure functions.
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `vitest.config.ts`, `package.json` (root — add `vitest` devDep + `"test"` script), `apps/web/lib/wanted/completeness.test.ts`, `apps/web/lib/wanted/invariants.test.ts`, `packages/shared/src/feature-flags.test.ts`
  - Required Capabilities: file write (Write, Edit) for config + tests + root package.json; shell (Bash) to run `pnpm install` and `pnpm test`
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `ruff_validator.py` + `ty_validator.py` (no-op on `.ts`)

- **wanted-validate**
  - Role: Run the full validation suite after all implementation completes and report pass/fail.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: none (read + run commands only)
  - Required Capabilities: all standard tools (Bash to run `pnpm typecheck|lint|build|test`; Read/Grep to inspect failures)
  - Plan Approval: false
  - Hooks: none

## Validation Hooks

### Available Validators

- `migration_validator.py` — enforces `.sql` migrations are idempotent (skips non-`.sql`). Wired into `db-agent`. **Covers the migration-idempotency invariant for this problem.**
- `ruff_validator.py` / `ty_validator.py` — Python lint/typecheck; both skip non-`.py` files, so they are no-ops on this phase's TypeScript and SQL. Wired into `build-agent`.

### Custom Validators

None — existing validators cover this problem. RLS-enabled-per-table is verified directly by `wanted-db` via the `mcp__supabase__get_advisors` MCP call (security advisor flags any table missing RLS), which is more reliable than a regex hook. Authoring a new Bash/command validator was deliberately avoided after two bundle validators were found to misfire in this harness (see Notes).

### Hook Assignments

| Team Member | Hook Type | Matcher | Validator |
|---|---|---|---|
| wanted-db | PostToolUse | Write\|Edit | `migration_validator.py` (idempotency on `.sql`) |
| wanted-shared | PostToolUse | Write\|Edit | `ruff_validator.py`, `ty_validator.py` (no-op on `.ts`) |
| wanted-web-lib | PostToolUse | Write\|Edit | `ruff_validator.py`, `ty_validator.py` (no-op on `.ts`) |
| wanted-tests | PostToolUse | Write\|Edit | `ruff_validator.py`, `ty_validator.py` (no-op on `.ts`) |

## Step by Step Tasks

### 1. SQL migrations + apply + regenerate types
- **Task ID**: db-migrations
- **Depends On**: none
- **Assigned To**: wanted-db
- **Agent Type**: db-agent
- **Parallel**: true
- **Owns Files**: `packages/db/migrations/0030_wanted_enums.sql`, `0031_briefs.sql`, `0032_matches.sql`, `0033_brief_audit.sql`, `0034_extend_profiles_apps.sql`, `apps/web/lib/supabase/types.ts`
- **Context**: Translate `new/01-architecture-and-data.md` §1.4 (Prisma `model Brief/Match/BriefRefinementTurn/BriefMatchAuditLog/ValidatorSuggestion` + enums) into native Supabase SQL following the EXACT conventions in `packages/db/migrations/0006_apps.sql` (tables `public.snake_plural`, `uuid primary key default gen_random_uuid()`, snake_case columns, `created_at`/`updated_at timestamptz not null default now()`, GIN/btree indexes), `0015_notifications.sql` (idempotent enum: `do $$ begin if not exists (select 1 from pg_type where typname='X') then create type public.X as enum (...); end if; end $$;`), and `0007_apps_rls.sql` (RLS: `alter table ... enable row level security;` + `create policy "..." on public.X for select using (auth.uid() ...)`). REUSE `public.touch_updated_at()` (defined in `0001_init.sql` ~line 74) for `updated_at` triggers — do NOT redefine it. The spec's `User` maps to `public.profiles`. Migrations are cloud-only, applied via the Supabase MCP (project ref `vcbdtjjkkwryvmqbflah`) — never the `supabase` CLI. **Do NOT add any `vector` column or pgvector extension** (deferred — dimension depends on an unapproved embedding provider). Each migration must include a commented `-- down:` rollback section per hatch convention. Enum value casing matches the spec (e.g. `brief_status` values `'DRAFT','REFINING','PARSING','AWAITING_VALIDATION','REVIEW_HEALTH','MATCHING','PRIVATE','PUBLIC','RESOLVED','EXPIRED'`).
  - `0030_wanted_enums.sql`: create the 15 enums — `brief_status`, `brief_entry_mode` (CHAT,FORM,PASTE), `suggestion_status` (PENDING,APPLIED,DISMISSED,AUTO_DISMISSED), `brief_visibility` (PRIVATE_MATCHED,PUBLIC_GALLERY), `brief_use_case` (PERSONAL,TEAM,CLIENT_DELIVERABLE,OTHER), `technical_level` (NON_TECHNICAL,SEMI_TECHNICAL,DEVELOPER), `budget_band` (EXPLORATORY,LT_500,FROM_500_2K,FROM_2K_10K,GT_10K,OPEN), `brief_timeline` (ASAP,WEEKS,MONTHS,NO_RUSH), `solution_type` (EXISTING_APP,CUSTOM_BUILD,FORK_AND_MODIFY,CONSULTING), `candidate_type` (APP,BUILDER), `swipe_action` (PENDING,CONNECT,SKIP,AUTO_SKIPPED), `commercial_status` (NONE,REPORTED_AGREED,REPORTED_CLOSED), `turn_role` (AGENT,USER,SYSTEM), `match_phase` (APP,BUILDER), `brief_resolution` (RESOLVED_WITH_APP,RESOLVED_WITH_BUILDER,RESOLVED_ELSEWHERE,ABANDONED).
  - `0031_briefs.sql`: `public.briefs` with all columns from design §3.1 / spec §1.4 (author_id→profiles, status, entry_mode, refinement_round, completeness_score, quality_score, quality_by_section jsonb, match_potential_estimate jsonb, manually_edited_fields text[] default '{}', parsed_from text, title, content jsonb not null default '{}', queryable extracts industry/use_case/technical_level/budget_band/timeline/solution_types/geography, intent, visibility, public_likes, public_rank, lifecycle timestamps with expires_at default now()+interval '14 days'). Indexes `(status)`, `(author_id,status)`, `(visibility, public_rank desc)`, `(expires_at)`. CHECK `expires_at > created_at`; CHECK `entry_mode <> 'PASTE' or parsed_from is not null`. RLS: author full access (`author_id = auth.uid()`), select when `visibility='PUBLIC_GALLERY' and status='PUBLIC'`, select for matched builders (exists a row in `matches` with `candidate_builder_id = auth.uid()`). `briefs_set_updated_at` trigger using `touch_updated_at()`.
  - `0032_matches.sql`: `public.matches` (brief_id→briefs on delete cascade, candidate_type, candidate_app_id→apps, candidate_builder_id→profiles, agent_confidence, agent_rationale, seeker_action, candidate_action, thread_id uuid, commercial_status, timestamps). CHECK exactly-one-candidate: `(candidate_app_id is not null) <> (candidate_builder_id is not null)`. Unique `(brief_id, candidate_type, candidate_app_id, candidate_builder_id)`. Indexes per spec §1.4. RLS: brief author select; candidate builder select own rows.
  - `0033_brief_audit.sql`: `brief_refinement_turns` (round, turn_index, role turn_role, content text, content_json jsonb, ui_component_invocation jsonb, model_used, tokens_in, tokens_out, created_at; index `(brief_id, round, turn_index)`); `brief_match_audit_logs` (phase match_phase, candidates_considered/shortlisted/final, model_used, duration_ms, rationale_json jsonb); `validator_suggestions` (section_path, diagnosis, example_better, status suggestion_status default 'PENDING', applied_value, model_used, created_at, resolved_at; index `(brief_id, status)`). All `briefId`→briefs on delete cascade. RLS: brief author select; service-role writes.
  - `0034_extend_profiles_apps.sql`: `alter table public.profiles add column if not exists accepts_requests boolean not null default false, request_capacity int not null default 3, request_domains text[] not null default '{}', request_rate_band budget_band, inferred_capabilities text[] not null default '{}', last_brief_response_at timestamptz, feature_flags jsonb not null default '{}'`; `alter table public.apps add column if not exists discovery_via_brief_count int not null default 0, solves_problems text[] not null default '{}'`.
- **Actions**:
  - Write the 5 migration files following the referenced conventions exactly.
  - Apply them in order (0030→0034) via `mcp__supabase__apply_migration`.
  - Run `mcp__supabase__get_advisors` (security) and confirm NO "table without RLS" or critical findings on the new tables; fix policies if flagged.
  - Regenerate `apps/web/lib/supabase/types.ts` via `mcp__supabase__generate_typescript_types`.
  - Confirm via `mcp__supabase__list_tables` that `briefs`, `matches`, `brief_refinement_turns`, `brief_match_audit_logs`, `validator_suggestions` exist.

### 2. Shared pure pieces — enums, BriefContent schema, embedding recipes, feature flag
- **Task ID**: shared-pure
- **Depends On**: none
- **Assigned To**: wanted-shared
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `packages/shared/src/wanted/index.ts`, `packages/shared/src/wanted/enums.ts`, `packages/shared/src/wanted/brief-content.ts`, `packages/shared/src/wanted/embedding-recipes.ts`, `packages/shared/src/feature-flags.ts`, `packages/shared/src/index.ts`, `packages/shared/package.json`
- **Context**: Author pure, side-effect-free TypeScript in `@hatch/shared` (package exports `./src/index.ts`). Mirror existing zod style from `apps/web/lib/zod/search.ts`. `zod` is already used in the repo (`apps/web` has `"zod": "^3.23.0"`) but `packages/shared` does not yet depend on it — add `"zod": "^3.23.0"` to `packages/shared/package.json` dependencies.
  - `enums.ts`: export `as const` arrays + derived string-literal unions for the 15 enums (must match the SQL enum values exactly, e.g. `export const BRIEF_STATUS = ['DRAFT','REFINING','PARSING','AWAITING_VALIDATION','REVIEW_HEALTH','MATCHING','PRIVATE','PUBLIC','RESOLVED','EXPIRED'] as const; export type BriefStatus = typeof BRIEF_STATUS[number];`). Also export `ACTIVE_BRIEF_STATUSES` = ['REFINING','PARSING','AWAITING_VALIDATION','REVIEW_HEALTH','MATCHING','PRIVATE'] for the quota rule.
  - `brief-content.ts`: `BriefContentSchema` exactly per `new/03-agents.md` §3.1.4 (zod object: title?, problem{trigger?,affected?,currentWorkaround?,costOfNotSolving?}, desiredOutcome{definitionOfGoodEnough?,mustHaves[],niceToHaves[],outOfScope[]}, context{industry?,useCase?,technicalLevel?,existingStack[]}, constraints{budgetBand?,timeline?,licensing default 'no_pref',geography nullable}, preferredSolutionType[]). Export `type BriefContent = z.infer<typeof BriefContentSchema>`.
  - `embedding-recipes.ts`: pure string-builder functions per `new/01-architecture-and-data.md` §1.6 — `briefEmbeddingText(brief)`, `appEmbeddingText(app)`, `userCapabilityText(parts)`. NO network/API calls — they only assemble text. These are the prepared slot for deferred embeddings (decision D1).
  - `feature-flags.ts`: `export function isWantedEnabled(profile: { feature_flags?: Record<string, unknown> | null } | null | undefined, env: { WANTED_V1_ENABLED?: string }): boolean` — true if `env.WANTED_V1_ENABLED === 'true'` (global) OR `profile?.feature_flags?.wanted_v1_enabled === true` (per-user canary). Keep it dependency-free (do NOT import the generated `Database` type — use the minimal inline shape so it stays pure and testable).
  - `wanted/index.ts`: barrel re-exporting `./enums`, `./brief-content`, `./embedding-recipes`.
  - `index.ts` (package barrel): add `export * from './wanted';` and `export * from './feature-flags';` to the existing exports.
- **Actions**:
  - Add `zod` to `packages/shared/package.json` dependencies and author the 5 source files + barrel edit.
  - Run `pnpm --filter @hatch/shared typecheck` and confirm it passes.

### 3. Completeness scoring + invariant predicates (pure)
- **Task ID**: web-pure
- **Depends On**: shared-pure
- **Assigned To**: wanted-web-lib
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/lib/wanted/completeness.ts`, `apps/web/lib/wanted/invariants.ts`
- **Context**: Pure functions in `apps/web/lib/wanted/` (the `@/` alias maps `@/lib/...` to `apps/web/lib/...`). Import types from `@hatch/shared` (provided by task `shared-pure`).
  - `completeness.ts`: `export function computeCompletenessScore(content: BriefContent): number` exactly per `new/03-agents.md` §3.1.6 — 10 boolean checks (title, problem.trigger, problem.currentWorkaround, desiredOutcome.definitionOfGoodEnough, mustHaves.length>=1, outOfScope.length>=1, context.technicalLevel, constraints.budgetBand, constraints.timeline, preferredSolutionType.length>=1) → `checks.filter(Boolean).length / checks.length`. Handle optional/undefined nested fields safely.
  - `invariants.ts`: pure predicates for the app-layer §1.7 invariants — `export const MAX_ACTIVE_BRIEFS = 3`; `isQuotaExceeded(activeCount: number): boolean` (activeCount >= MAX_ACTIVE_BRIEFS); `meetsQualityGate(completenessScore: number, qualityScore: number): boolean` (both >= 0.5 — required to reach MATCHING/PRIVATE/PUBLIC); `chatRequiresUserTurn(entryMode: BriefEntryMode, userTurnCount: number): boolean` (if 'CHAT', userTurnCount >= 1). Import `ACTIVE_BRIEF_STATUSES`, `BriefEntryMode` from `@hatch/shared`. Export a `BriefQuotaExceededError` class for the repo to throw.
- **Actions**:
  - Author `completeness.ts` and `invariants.ts`.
  - Run `pnpm --filter web typecheck` and confirm it passes.

### 4. Brief repository (typed Supabase CRUD + quota guard)
- **Task ID**: brief-repo
- **Depends On**: db-migrations, shared-pure, web-pure
- **Assigned To**: wanted-web-lib
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/lib/wanted/brief-repo.ts`
- **Context**: Thin, typed repository over Supabase. Use the server client pattern from `apps/web/lib/supabase/server.ts` (`createServerClient<Database>()`); the regenerated `Database` type (task `db-migrations`) now includes `briefs`. Import enums/`BriefContent` from `@hatch/shared` and the predicates + `BriefQuotaExceededError` from `./invariants` (task `web-pure`).
  - Functions: `createBrief(client, authorId, input: { entryMode: BriefEntryMode; content?: BriefContent; parsedFrom?: string })` — first calls `countActiveBriefs`; if `isQuotaExceeded` throws `BriefQuotaExceededError`; else inserts a `DRAFT` (or `PARSING` if PASTE) brief; `getBrief(client, id)`; `countActiveBriefs(client, authorId)` — counts `briefs` where `author_id = authorId and status in ACTIVE_BRIEF_STATUSES`. Keep all decision logic delegated to the pure predicates in `./invariants` (the repo only does the query + calls the predicate) so it stays unit-testable without a DB. Do NOT register any route or server action — this module is imported by future phases only.
- **Actions**:
  - Author `brief-repo.ts`.
  - Run `pnpm --filter web typecheck` and confirm it passes (this exercises the regenerated `Database` type).

### 5. Test harness (vitest) + unit tests
- **Task ID**: tests
- **Depends On**: shared-pure, web-pure
- **Assigned To**: wanted-tests
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `vitest.config.ts`, `package.json` (root), `apps/web/lib/wanted/completeness.test.ts`, `apps/web/lib/wanted/invariants.test.ts`, `packages/shared/src/feature-flags.test.ts`
- **Context**: The repo has NO test framework today. Establish vitest at the monorepo root.
  - Add `vitest` (^2.x) to root `package.json` `devDependencies` and a script `"test": "vitest run"`. Run `pnpm install` to materialize it. **NOTE: vitest is a new dev dependency — this task should only proceed if the user approved it (see plan Notes/report).**
  - `vitest.config.ts` (root): `test.include = ['apps/web/lib/**/*.test.ts', 'packages/shared/src/**/*.test.ts']`, `environment: 'node'`. pnpm workspace resolution lets `@hatch/shared` resolve to `packages/shared/src/index.ts` automatically; no alias config needed for the tested files (the tested pure functions don't use the `@/` alias — only `brief-repo.ts` does, and it is NOT unit-tested here).
  - `completeness.test.ts`: assert each of the 10 boolean checks maps to the expected fraction (empty content → 0; all fields present → 1; partial → correct N/10).
  - `invariants.test.ts`: `isQuotaExceeded` (2→false, 3→true), `meetsQualityGate` (0.5/0.5→true, 0.4/0.9→false), `chatRequiresUserTurn` ('CHAT' with 0→true blocks, with 1→false; 'FORM'→false).
  - `feature-flags.test.ts`: `isWantedEnabled` — env 'true' → true regardless of profile; env undefined + profile flag true → true; env undefined + no flag → false; null profile → false.
- **Actions**:
  - Add vitest + script, write config + 3 test files.
  - Run `pnpm test` and confirm all tests pass.

### 6. Final validation
- **Task ID**: validate-all
- **Depends On**: db-migrations, shared-pure, web-pure, brief-repo, tests
- **Assigned To**: wanted-validate
- **Agent Type**: general-purpose
- **Parallel**: false
- **Context**: Verify zero regressions across the monorepo and that every Phase 0 acceptance criterion is met. Run the Validation Commands. Passing = all four commands exit 0, the 5 new tables exist with RLS, types include the new tables, and all unit tests pass.
- **Actions**:
  - Run `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`.
  - Confirm `apps/web/lib/supabase/types.ts` contains `briefs`/`matches`/`validator_suggestions` entries (grep).
  - Report pass/fail per acceptance criterion.

### 7. Expert self-improvement
- **Task ID**: expert-selfimprove
- **Depends On**: validate-all
- **Assigned To**: wanted-validate
- **Agent Type**: general-purpose
- **Parallel**: false
- **Context**: Domains modified this phase: database (5 migrations + RLS), supabase (new tables/types), testing (new vitest harness — currently a stub). Capture the new reality in the experts.
- **Actions**:
  - Run `/experts:database:self-improve true`, `/experts:supabase:self-improve true`, `/experts:testing:self-improve true`.

## Testing Strategy

### Unit Tests
- `completeness.test.ts` — every boolean check produces the expected fraction (0, partial, 1).
- `invariants.test.ts` — quota predicate boundary (2 vs 3), quality gate (both ≥ 0.5), chat-requires-user-turn.
- `feature-flags.test.ts` — global env flag, per-user override, default-off, null profile.

### Edge Cases
- Empty `BriefContent` → completeness 0 (no crash on undefined nested fields).
- `expires_at` defaulting (now + 14 days) and `CHECK expires_at > created_at`.
- PASTE brief without `parsed_from` rejected by `CHECK`.
- Quota counts ONLY active statuses (a RESOLVED/EXPIRED/DRAFT brief does not count toward the 3).
- `isWantedEnabled` with `env.WANTED_V1_ENABLED='false'` and a per-user override true → true (override wins over global-off, as intended for canary).
- Migrations are idempotent (re-applying does not error) — enforced by `migration_validator.py`.

## Acceptance Criteria

- 5 migrations (`0030`–`0034`) authored to hatch conventions and applied to project `vcbdtjjkkwryvmqbflah` via the Supabase MCP; each idempotent and with a commented down section.
- Tables `briefs`, `matches`, `brief_refinement_turns`, `brief_match_audit_logs`, `validator_suggestions` exist, all with RLS enabled (no security-advisor RLS findings).
- `profiles` gains `accepts_requests`, `request_capacity`, `request_domains`, `request_rate_band`, `inferred_capabilities`, `last_brief_response_at`, `feature_flags`; `apps` gains `discovery_via_brief_count`, `solves_problems`.
- NO `vector` column / pgvector extension added (deferred).
- `apps/web/lib/supabase/types.ts` regenerated and includes the new tables; `@hatch/shared` `Database` re-export compiles.
- `@hatch/shared` exports `BriefContentSchema`, the 15 enum unions, `ACTIVE_BRIEF_STATUSES`, embedding recipes, and `isWantedEnabled`.
- `apps/web/lib/wanted/` provides `computeCompletenessScore`, the invariant predicates + `BriefQuotaExceededError`, and `brief-repo` (create/read/countActive) that blocks the 4th active brief.
- vitest runs via `pnpm test`; all unit tests pass.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass — zero regressions.
- Nothing is exposed to users: no new routes, pages, server actions, or MCP tools registered.

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm typecheck` — TypeScript check across all workspaces (exercises the regenerated `Database` type + new shared/web modules).
- `pnpm lint` — ESLint across all workspaces (zero warnings).
- `pnpm build` — production build of all workspaces (compiles cleanly).
- `pnpm test` — vitest unit suite (all Phase 0 unit tests pass).
- `grep -q "briefs:" apps/web/lib/supabase/types.ts && echo TYPES_OK` — confirms types regenerated with the new tables.
- (MCP, run by `wanted-db`) `mcp__supabase__list_tables` shows the 5 new tables; `mcp__supabase__get_advisors` reports no RLS-missing findings.

## Notes

- **NEW dev dependency — `vitest` (awaiting user approval).** The repo has no test framework today; Phase 0 establishes one. Per the project rule "no new stack/libs without approval," `vitest` is flagged here and in the report. It is a standard dev-only test runner for TS monorepos and is reused by later phases' eval suites. If the user prefers a zero-dependency path, the alternative is Node's built-in `node:test` (needs a TS loader) — vitest is recommended. **`/tac:implement` should confirm vitest before running task `tests`.**
- `zod` is NOT a new dependency to the repo (already `^3.23.0` in `apps/web`); task `shared-pure` only adds it to `packages/shared/package.json`.
- **Embeddings deferred (decision D1):** no `vector` columns this phase. When an embedding provider is approved, a later migration adds the pgvector extension + `vector` columns (dimension per provider: OpenAI 1536 / Voyage 1024) + HNSW indexes, and a second `CandidateRetriever` implementation. The `embedding-recipes.ts` text builders are the prepared slot.
- **Cloud-apply caveat:** hatch has ONE Supabase project (no separate staging) — applying migrations via MCP touches the live schema directly. This is the established hatch workflow (migrations 0001–0029 were applied the same way) and these changes are purely additive + inert behind the flag, so they are safe; but the migration SQL should be reviewed before `/tac:implement` runs `wanted-db`.
- **Hook hygiene:** project-level `settings.json` hooks are intentionally empty (two bundle validators misfire in this harness — a `type:prompt` Bash gate and `dangerous_command_blocker.py`). The agent-level hooks used here (`migration_validator`, `ruff`/`ty`) are properly guarded and safe. Do not re-enable the bundle `settings.json` hooks.
- Branch: `feature/wanted-v1`. Commit format per `CONTRIBUTING.md`.
- After this phase, the next slice is Phase 1 (Refiner) — gets its own brainstorm → spec → plan.

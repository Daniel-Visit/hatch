# Feature: Built with AI — declare AI models used on each app

## Metadata

issue_number: `8`
adw_id: `manual`
issue_json: `null` (manually-triggered feature)

## Feature Description

Let devs **optionally** declare which AI models they used while building an app. Multi-select up to 3 from a closed list of 8 vendors (Claude, DeepSeek, Gemini, GitHub Copilot, GPT, Kimi, Mistral, Qwen). **Text only — no brand logos** (decision: trademark conservatism; mirrors the prior decision to drop Claude mentions from the landing). Display the chosen models as small text chips on the gallery card and as a dedicated section on the app detail page.

Use the new key name `BuiltWithAi` (NOT `BuiltWith`) because the detail page already has a `t('BuiltWith')` section that shows the existing `tags` array (e.g., "VS Code ext", "TypeScript"). Keeping the names distinct prevents confusion between tech-stack tags and AI-model declarations.

The MCP `publish_app` and `update_app` tools accept an optional `built_with` parameter so agents can declare what they were used to build with (meta-circular but real signal). The public `/api/v1/apps` and `/api/v1/apps/{slug}` responses include the field so third-party consumers can render it.

A future "filter gallery by AI model" surface is intentionally out of scope (would need a UX decision and DB index changes; ship the data first).

## User Story

As a **builder publishing on Hatch**,
I want to **optionally tag my app with the AI models I used to build it**,
So that **other builders can see my workflow, recognize stacks they share, and feel less alone — without giving up on Hatch being a neutral platform that doesn't promote any specific vendor**.

Secondary: As an **agent calling the MCP `publish_app` tool**, I want to declare the AI provider that produced the publish call, so the resulting app card reflects the actual provenance.

## Problem Statement

Today an app's "tech stack" is captured loosely in the `tags text[]` array (free-form: "VS Code ext", "TypeScript", "Next.js"). There's no structured way to say "I used Claude + GitHub Copilot to build this". Builders are leaving the AI provenance signal on the table even though it's a core part of how modern indie projects get built. Adding free-form AI tags to `tags` would dilute the tag namespace and create slug drift ("claude", "Claude", "claude-3.5", "anthropic" — all different).

## Solution Statement

Add a new column `apps.built_with text[]` with a CHECK constraint pinning values to a fixed enum of 8 slugs. Surface it as:

- A multi-toggle chip group in the `/publish` form (max 3 selections, optional).
- A small text chip "AI: Claude · GPT" under the author row on the gallery card (hidden if empty).
- A dedicated section "Built with AI" on `/a/[slug]` below the existing "Built with" (tags) section.
- A field in the public API JSON response (both list + detail endpoints).
- An optional `built_with: string[]` parameter on the MCP `publish_app` and `update_app` tools.

The 8 vendor names live in `packages/shared/src/ai-models.ts` as the single source of truth (slug + display name), consumed by web + MCP + future filters. Display names are NOT translated (they are product nouns like Hatch / GitHub).

No logos are introduced — the existing `ia_logos/` directory is deleted as part of this work since we chose text-only.

## Relevant Files

Use these files to implement the feature:

### Files to MODIFY

- `apps/web/lib/zod/publish.ts` — add `builtWith: z.array(AiModelSlug).max(3).default([])` to `PublishAppInput`.
- `apps/web/lib/actions/publish.ts` — include `built_with` in the `apps` INSERT payload inside `publishApp`.
- `apps/web/app/_components/publish-screen.tsx` — add a new section "Built with AI" with a chip multi-toggle. Currently the form has BasicsTitle, StoryTitle, DiscoverabilityTitle, CoverArtTitle sections (see `messages.Publish.Sections.*` — plural). Add a new section keyed to `Publish.Sections.BuiltWithAi*`. ALSO patch `previewApp: AppData` literal (currently at line 121-131, missing `built_with`) so typecheck passes after AppData gains the field.
- `apps/web/app/_components/cards.tsx` — add `built_with` to the `AppData` interface; render a small chip "AI: X · Y" below the author row on `ClassicCard` (and mirror to other variants where it fits without overflow). Hidden when `built_with.length === 0`.
- `apps/web/app/_components/data-mappers.ts` — pass `built_with` through in `mapAppRowToCardProps` so cards receive the slugs.
- `apps/web/app/(shell)/a/[slug]/page.tsx` — add a new `<div className="panel">` with `<h3>{t('BuiltWithAi')}</h3>` BELOW the existing `BuiltWith` panel (line 381-391). Render chips with the same `.stack-chip` styling.
- `apps/web/app/api/v1/apps/route.ts` — add `built_with` to the `select(...)` string AND to the `apps.map(...)` response shape.
- `apps/web/app/api/v1/apps/[slug]/route.ts` — same.
- `apps/mcp/src/tools/publish.ts` — add `built_with: z.array(z.string()).max(3).optional()` to both `PublishAppSchema` and `UpdateAppSchema`; include in the insert/update payload.
- `apps/mcp/src/tools/read.ts` — add `built_with` to the SELECT strings inside `list_apps`, `get_app`, and `search_apps` tool handlers (lines ~49, ~110, ~154) so the MCP read surface is symmetric with write (an agent that publishes with `built_with` can read it back).
- `apps/web/app/api/v1/profiles/[handle]/route.ts` — add `built_with` to the apps SELECT + response shape (line ~80) so the public profile-detail endpoint stays consistent with `/api/v1/apps`.
- `apps/web/messages/en.json` — add `Publish.Sections.BuiltWithAiTitle`, `Publish.Sections.BuiltWithAiSubtitle`, `Publish.BuiltWithAi.{HelperText, OptionalLabel, MaxLabel}`, `Detail.BuiltWithAi`, and **NEW top-level `Card` namespace** with `Card.BuiltWithAi`. **NO `Common.AiModels.*` keys** — model display names come from `aiModelName(slug)` in `@hatch/shared` (single source of truth, no i18n duplication needed since AI vendor names are product nouns not translated).
- `apps/web/messages/es.json` — mirror with Spanish translations. **AI model names stay untranslated** (product nouns).
- `apps/web/app/globals.css` — add styles for `.ai-chip-group` (publish form toggle group), `.ai-chip-toggle` (individual chip), `.ai-chip-card` (small card chip), `.ai-stack-row` (detail page row). Keep them minimal — match the existing `.stack-chip` aesthetic since the detail page reuses that class.
- `apps/web/lib/supabase/types.ts` — surgical 3-line add (Row / Insert / Update) for `built_with: string[] | null` on `apps`. Per the i18n-foundation-builder convention, hand-edit this file rather than full regen.
- `.claude/commands/experts/nextjs/expertise.yaml` — note the new field shape + chip styling pattern.
- `.claude/commands/experts/supabase/expertise.yaml` — log the 0029 migration.
- `.claude/commands/experts/mcp-server/expertise.yaml` — note the new MCP tool param.

### Files to CREATE

#### Code

- `packages/db/migrations/0029_apps_built_with.sql` — `ADD COLUMN built_with text[] not null default '{}'::text[]` + CHECK constraint validating each slug + GIN index for future filter use.
- `packages/shared/src/ai-models.ts` — exports `AI_MODELS` (readonly array of `{slug, name}`), `AiModelSlug` type union, and `isAiModelSlug(s: string): s is AiModelSlug` guard.

#### Tests / evidence

- `apps/web/tests/visual-baselines/built-with-ai/report.md` — Playwright MCP E2E evidence: publish app with 2 IAs, card displays chip, detail shows section, API returns field.
- `apps/web/tests/visual-baselines/built-with-ai/screens/*.png` — screenshots per pass.

### Files to DELETE

- `ia_logos/` directory (8 SVGs) — we decided no logos.

### Files to READ (reference only, do not modify)

- `apps/web/lib/zod/publish.ts` — existing `PublishAppInput` shape to extend.
- `apps/web/lib/actions/publish.ts` — existing `publishApp` server action pattern.
- `apps/web/app/_components/publish-screen.tsx` — existing form section pattern (header + subtitle + content layout).
- `apps/web/app/_components/cards.tsx` — existing `AppData` interface + `ClassicCard` layout (line 122).
- `apps/web/app/(shell)/a/[slug]/page.tsx` line 381-391 — existing `BuiltWith` panel (the one we are NOT touching, but immediately below it is where the new "Built with AI" panel goes).
- `packages/db/migrations/0006_apps.sql` — existing `apps` schema, CHECK constraint pattern (line 21 `accent`, line 22 `tags`).
- `packages/db/migrations/0028_security_hardening.sql` — last migration applied, naming convention reference.
- `apps/mcp/src/tools/publish.ts` — both `publishApp` and `updateApp` tool descriptors to extend.
- `apps/web/lib/supabase/types.ts` — existing `Database.public.Tables.apps.Row/Insert/Update` shape.

### Reference docs

- `.claude/rules/database-migrations.md` — migrations via Supabase MCP only (NEVER CLI).
- `.claude/rules/frontend-components.md` — server-first, Zod for validation, no `any`.
- `.claude/rules/prototype-port-exception.md` — Tailwind forbidden in `_components/*` — use CSS classes from `globals.css` or the existing `.stack-chip` pattern.
- `.claude/commands/experts/supabase/expertise.yaml` — migration workflow + types regen.
- `.claude/commands/experts/nextjs/expertise.yaml` — App Router patterns, form pattern (RHF + Zod), i18n usage.
- `.claude/commands/experts/mcp-server/expertise.yaml` — MCP tool schema pattern + service-role client.

## Implementation Plan

### Phase 1: Foundation (parallelizable, no inter-deps)

1. **Schema** — `0029_apps_built_with.sql` migration adds the `text[]` column with CHECK + GIN index. Applied via Supabase MCP. Types regenerated and surgically patched into `apps/web/lib/supabase/types.ts`.
2. **Shared types** — `packages/shared/src/ai-models.ts` defines the 8-vendor enum once. Both web and MCP import from here.
3. **i18n strings** — add `Publish.Sections.BuiltWithAi*`, `Publish.BuiltWithAi.*`, `Detail.BuiltWithAi`, plus a NEW top-level `Card` namespace with `Card.BuiltWithAi` to en.json + es.json with parity. NO `Common.AiModels.*` — display names come from `aiModelName(slug)` in shared.
4. **CSS** — add `.ai-chip-group`, `.ai-chip-toggle`, `.ai-chip-card`, `.ai-stack-row` styles to `globals.css`.
5. **Cleanup** — delete `ia_logos/` directory.

### Phase 2: Wire-up (depends on Phase 1)

6. **Zod schema** — extend `PublishAppInput` with `builtWith` array, max 3, default `[]`. Validates via `z.enum(AI_MODEL_SLUGS)`.
7. **API routes** — add `built_with` to SELECT and response mapping in both `/api/v1/apps` and `/api/v1/apps/[slug]`.
8. **MCP tool** — add optional `built_with: string[]` param to both `publish_app` and `update_app` schemas; pass to insert/update payload.
9. **Server action** — `publishApp` includes `built_with` in the INSERT.

### Phase 3: UI surfaces (depends on Phase 2)

10. **Publish form** — new section "Built with AI" with multi-toggle chip group bound to RHF Controller.
11. **Cards** — render small "AI: X · Y" chip under author when `built_with.length > 0`.
12. **Detail page** — new `<div className="panel">` with chips, below existing `BuiltWith` panel.

### Phase 4: Validation + expert update

13. **E2E** — Playwright MCP: publish an app with 2 IAs, verify card chip, detail section, API JSON. Screenshots committed.
14. **Expert self-improve** — refresh supabase + nextjs + mcp-server expertise.yaml with the new patterns.

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

To execute: `/tac:implement specs/issue-8-adw-manual-sdlc_planner-built-with-ai-models.md`

### Team Members

- **db-migration-builder**
  - Role: Author + apply the `0029_apps_built_with.sql` migration via Supabase MCP, then surgically patch `apps/web/lib/supabase/types.ts` with the new column (Row/Insert/Update).
  - Agent Type: `db-agent`
  - Model: opus
  - Owns Files: `packages/db/migrations/0029_apps_built_with.sql` (new), `apps/web/lib/supabase/types.ts` (surgical 3-line add inside the `apps` table block)
  - Required Capabilities: Supabase MCP (`mcp__supabase__apply_migration`, `mcp__supabase__generate_typescript_types`, `mcp__supabase__execute_sql`, `mcp__supabase__list_tables`, `mcp__supabase__get_advisors`), file write (Write, Edit, MultiEdit) for the migration SQL + types.ts patch, file read (Read) to consult existing migrations and types.
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/migration_validator.py` (inherited from db-agent)

- **shared-types-builder**
  - Role: Create `packages/shared/src/ai-models.ts` (single source of truth for the 8 AI models), re-export from `packages/shared/src/index.ts`, and delete the `ia_logos/` directory.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `packages/shared/src/ai-models.ts` (new), `packages/shared/src/index.ts` (add re-export), `ia_logos/` (delete entire directory).
  - Required Capabilities: all standard tools — Write for new module, Edit for index re-export, Bash for `rm -rf ia_logos/`.
  - Plan Approval: false
  - Hooks: none

- **i18n-strings-builder**
  - Role: Add `Publish.Sections.BuiltWithAi*`, `Publish.BuiltWithAi.*`, `Detail.BuiltWithAi`, plus a NEW top-level `Card` namespace with `Card.BuiltWithAi` to en.json + es.json with parity. NO `Common.AiModels.*` — display names live in `@hatch/shared/ai-models.ts`.
  - Agent Type: `i18n-foundation-builder`
  - Model: opus
  - Owns Files: `apps/web/messages/en.json`, `apps/web/messages/es.json`
  - Required Capabilities: Write/Edit/MultiEdit for JSON authoring, Read/Grep/Glob for existing namespace conventions, Bash for `pnpm typecheck`.
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/i18n_key_parity.py` (inherited)

- **css-styling-builder**
  - Role: Add 4 small CSS rule blocks to `globals.css` for the new AI chip patterns. Match the existing `.stack-chip` aesthetic. Mobile-responsive.
  - Agent Type: `general-purpose`
  - Model: haiku
  - Owns Files: `apps/web/app/globals.css` (additions only — do not touch existing rules)
  - Required Capabilities: all standard tools — Edit for additions, Read to inspect existing `.stack-chip` rule.
  - Plan Approval: false
  - Hooks: none

- **zod-schema-builder**
  - Role: Extend `PublishAppInput` in `apps/web/lib/zod/publish.ts` with `builtWith` field.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/web/lib/zod/publish.ts`
  - Required Capabilities: all standard tools — Edit, Read.
  - Plan Approval: false
  - Hooks: none

- **api-routes-builder**
  - Role: Include `built_with` in the SELECT + response mapping for THREE public API endpoints: `/api/v1/apps`, `/api/v1/apps/[slug]`, AND `/api/v1/profiles/[handle]` (the profile-detail endpoint also returns an array of apps with a fixed SELECT — must include built_with for surface consistency).
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/web/app/api/v1/apps/route.ts`, `apps/web/app/api/v1/apps/[slug]/route.ts`, `apps/web/app/api/v1/profiles/[handle]/route.ts`
  - Required Capabilities: all standard tools — Edit, Read, Bash for `pnpm typecheck`.
  - Plan Approval: false
  - Hooks: none

- **mcp-tool-builder**
  - Role: Add optional `built_with` param to both `publishApp` and `updateApp` tool descriptors in `apps/mcp/src/tools/publish.ts`. ALSO add `built_with` to the SELECT strings in `apps/mcp/src/tools/read.ts` (`list_apps`, `get_app`, `search_apps`) so the MCP read surface is symmetric with write.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/mcp/src/tools/publish.ts`, `apps/mcp/src/tools/read.ts`
  - Required Capabilities: all standard tools — Edit, Read, Bash for `pnpm typecheck` (from `apps/mcp` root).
  - Plan Approval: false
  - Hooks: none

- **server-action-builder**
  - Role: Update `publishApp` server action in `apps/web/lib/actions/publish.ts` to read `builtWith` from input and pass `built_with` to the INSERT payload.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/web/lib/actions/publish.ts`
  - Required Capabilities: all standard tools — Edit, Read, Bash.
  - Plan Approval: false
  - Hooks: none

- **publish-form-builder**
  - Role: Add a new "Built with AI" section to `apps/web/app/_components/publish-screen.tsx` with a multi-toggle chip group bound to a RHF Controller. Match the existing section pattern. Also patch the `previewApp: AppData` literal (line 121-131) so typecheck passes after AppData gains the new `built_with` field.
  - Agent Type: `ui-port-agent`
  - Model: opus
  - Owns Files: `apps/web/app/_components/publish-screen.tsx`
  - Required Capabilities: Write, Read, Edit, MultiEdit, Grep, Glob, Bash, TodoWrite (ui-port-agent has these). The agent's frontmatter hooks (`no_tailwind_in_prototype_port.py`, `css_verbatim_validator.py`, `no_data_js_import.py`) fire automatically — important because Tailwind is forbidden in `_components/*.tsx`.
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `no_tailwind_in_prototype_port.py` (inherited from ui-port-agent frontmatter)
    - PostToolUse (Write|Edit): `css_verbatim_validator.py` (inherited — pass-through for .tsx)
    - PostToolUse (Write|Edit): `no_data_js_import.py` (inherited — irrelevant for publish-screen)

- **cards-display-builder**
  - Role: Extend `AppData` interface in `apps/web/app/_components/cards.tsx` with `built_with: string[]`, render small "AI: X · Y" chip in `ClassicCard` (other variants optional). Update `apps/web/app/_components/data-mappers.ts` to map `app.built_with` through.
  - Agent Type: `ui-port-agent`
  - Model: opus
  - Owns Files: `apps/web/app/_components/cards.tsx`, `apps/web/app/_components/data-mappers.ts`
  - Required Capabilities: Write, Read, Edit, MultiEdit, Grep, Glob, Bash, TodoWrite. The agent's frontmatter hooks (`no_tailwind_in_prototype_port.py`, etc.) fire automatically — Tailwind is forbidden in `_components/*.tsx`.
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `no_tailwind_in_prototype_port.py` (inherited)
    - PostToolUse (Write|Edit): `css_verbatim_validator.py` (inherited — pass-through)
    - PostToolUse (Write|Edit): `no_data_js_import.py` (inherited — irrelevant)

- **detail-section-builder**
  - Role: Add a new `<div className="panel">` with `<h3>{t('BuiltWithAi')}</h3>` and a `.stack-row` of chips, INSERTED BELOW the existing `BuiltWith` panel (line 381-391) in `apps/web/app/(shell)/a/[slug]/page.tsx`. Hidden when `row.built_with` is null or empty.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/web/app/(shell)/a/[slug]/page.tsx`
  - Required Capabilities: all standard tools — Edit, Read, Bash for `pnpm typecheck`. **NOTE**: this file lives in `(shell)/a/[slug]/`, NOT in `_components/` or `_landing/`, so the `no_tailwind_in_prototype_port.py` hook does NOT apply. Tailwind utility classes WOULD be technically allowed here — but the existing file uses plain CSS classes (`.panel`, `.panel-h`, `.stack-row`, `.stack-chip`) and the new chip group should match.
  - Plan Approval: false
  - Hooks: none

- **e2e-validator**
  - Role: Run the Playwright MCP E2E validation (publish flow + card display + detail section + API JSON inspection + curl checks). Generate `report.md` with evidence.
  - Agent Type: `ui-validator`
  - Model: sonnet
  - Owns Files: `apps/web/tests/visual-baselines/built-with-ai/` (new directory + `report.md` + `screens/*.png`)
  - Required Capabilities: browser automation (`mcp__playwright__browser_*`), Bash for dev server + curl + final typecheck/lint/build, file write for evidence.
  - Plan Approval: false
  - Hooks: none

- **expert-improver**
  - Role: Update three expertise.yaml files to reflect the new column, MCP param, and i18n key shape.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `.claude/commands/experts/supabase/expertise.yaml`, `.claude/commands/experts/nextjs/expertise.yaml`, `.claude/commands/experts/mcp-server/expertise.yaml`
  - Required Capabilities: all standard tools — Edit, Read, Bash for YAML parse validation.
  - Plan Approval: false
  - Hooks: none

## Validation Hooks

Problem-specific validation hooks that enforce quality automatically during execution. These run as Claude Code hooks — every Write/Edit is checked before work continues. Hooks catch problems at the source, not at the end.

### Available Validators

Existing reusable validators in `.claude/hooks/validators/`:

- `migration_validator.py` — Validates Supabase SQL migration files for idempotency (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Runs PostToolUse on Write|Edit for `.sql` files. Inherited by `db-agent`.
- `i18n_key_parity.py` — Enforces identical key trees in `messages/{en,es}.json`. Runs PostToolUse on Write|Edit. Inherited by `i18n-foundation-builder`.
- `no_tailwind_in_prototype_port.py` — Blocks Tailwind utility classes inside `apps/web/app/{_components,_landing}/*.tsx`. CRITICAL because `publish-form-builder`, `cards-display-builder`, and `detail-section-builder` all touch files governed by this rule.

### Custom Validators

None — existing validators cover this problem.

Rationale: the key invariants are (a) migration is idempotent → `migration_validator.py`; (b) EN/ES parity → `i18n_key_parity.py`; (c) no Tailwind in `_components/` → `no_tailwind_in_prototype_port.py`; (d) Zod slug validation happens at request time, not Write time, so no static validator needed.

### Hook Assignments

| Team Member            | Hook Type   | Matcher     | Validator                                                                     |
| ---------------------- | ----------- | ----------- | ----------------------------------------------------------------------------- |
| db-migration-builder   | PostToolUse | Write\|Edit | `migration_validator.py` (inherited from `db-agent` frontmatter)              |
| i18n-strings-builder   | PostToolUse | Write\|Edit | `i18n_key_parity.py` (inherited from `i18n-foundation-builder`)               |
| publish-form-builder   | PostToolUse | Write\|Edit | `no_tailwind_in_prototype_port.py` (project-level, fires regardless of agent) |
| cards-display-builder  | PostToolUse | Write\|Edit | `no_tailwind_in_prototype_port.py` (project-level)                            |
| detail-section-builder | PostToolUse | Write\|Edit | `no_tailwind_in_prototype_port.py` (project-level if applicable to (shell)/)  |

## Step by Step Tasks

### 1. Schema: `apps.built_with text[]` migration

- **Task ID**: db-migration
- **Depends On**: none
- **Assigned To**: db-migration-builder
- **Agent Type**: `db-agent`
- **Parallel**: true
- **Owns Files**: `packages/db/migrations/0029_apps_built_with.sql` (new), `apps/web/lib/supabase/types.ts` (surgical patch)
- **Context**: Add an optional `built_with text[]` column to `public.apps` that constrains each element to one of 8 fixed slugs. Default `'{}'::text[]` so existing rows keep working. Add a GIN index for future filter use. Apply via Supabase MCP (NEVER use the Supabase CLI). After applying, force a PostgREST schema reload so the new column is visible to PostgREST without the 60s wait. Then surgically edit `apps/web/lib/supabase/types.ts` to add `built_with: string[] | null` to the `apps` Row / Insert / Update types — DO NOT regenerate the whole file (per i18n-foundation-builder convention, the MCP type generator's quote style differs from Prettier and produces noisy diffs).

  **Migration SQL (write to `packages/db/migrations/0029_apps_built_with.sql`):**

  ```sql
  -- 0029: optional built_with text[] on apps — declare AI models used to build.
  -- Closed list of 8 vendor slugs. Default empty. No data backfill needed.

  alter table public.apps
    add column if not exists built_with text[] not null default '{}'::text[];

  -- CHECK constraint: each element must be one of the 8 allowed slugs.
  -- The `array_length(... ) is null or` guard accepts an empty array.
  alter table public.apps
    drop constraint if exists apps_built_with_check;

  alter table public.apps
    add constraint apps_built_with_check check (
      array_length(built_with, 1) is null
      or (
        array_length(built_with, 1) <= 3
        and built_with <@ array[
          'claude','deepseek','gemini','github-copilot',
          'gpt','kimi','mistral','qwen'
        ]::text[]
      )
    );

  -- GIN index for future filter use (e.g. `WHERE 'claude' = any(built_with)`).
  create index if not exists apps_built_with_idx
    on public.apps using gin (built_with);
  ```

  **Supabase project ref:** `vcbdtjjkkwryvmqbflah`

  **Types.ts patch** — read the file, find the `apps` table block (search for `apps: {`), and add `built_with: string[]` to Row, `built_with?: string[] | null` to Insert, and `built_with?: string[] | null` to Update. DO NOT touch any other table.

- **Actions**:
  - Read `packages/db/migrations/0028_security_hardening.sql` and `0006_apps.sql` for naming convention and existing CHECK pattern.
  - Write `packages/db/migrations/0029_apps_built_with.sql` with the SQL above.
  - Apply via `mcp__supabase__apply_migration` with name `0029_apps_built_with` and the SQL content.
  - Verify via `mcp__supabase__execute_sql`: `select column_name, data_type, column_default from information_schema.columns where table_name='apps' and column_name='built_with';` — must return 1 row.
  - Force PostgREST reload: `mcp__supabase__execute_sql` with `notify pgrst, 'reload schema';`
  - Read `apps/web/lib/supabase/types.ts`, locate the `apps` table block (around line 99 per prior grep), and surgically add `built_with: string[]` to Row, `built_with?: string[] | null` to Insert, `built_with?: string[] | null` to Update.
  - Run `pnpm typecheck` from repo root — must exit 0.
  - Run `mcp__supabase__get_advisors` with type `security` to confirm no new advisories were introduced.

### 2. Shared types: `ai-models.ts` + cleanup `ia_logos/`

- **Task ID**: shared-types
- **Depends On**: none
- **Assigned To**: shared-types-builder
- **Agent Type**: `general-purpose`
- **Parallel**: true
- **Owns Files**: `packages/shared/src/ai-models.ts` (new), `packages/shared/src/index.ts` (add re-export), `ia_logos/` (delete)
- **Context**: Create a single source of truth for the 8 AI vendors. Both `apps/web` and `apps/mcp` import from here. The display name is NOT translated (product nouns like Hatch / GitHub).

  **File to write** (`packages/shared/src/ai-models.ts`):

  ```ts
  // Built-with AI models — single source of truth.
  // Adding a new model requires:
  //   1. Append { slug, name } below.
  //   2. Update the CHECK constraint in a new migration
  //      (see packages/db/migrations/0029_apps_built_with.sql).
  //   3. No i18n key needed — `aiModelName(slug)` returns the display name
  //      from this module (single source of truth, AI vendor names are product
  //      nouns not translated).

  export const AI_MODELS = [
    { slug: 'claude', name: 'Claude' },
    { slug: 'deepseek', name: 'DeepSeek' },
    { slug: 'gemini', name: 'Gemini' },
    { slug: 'github-copilot', name: 'GitHub Copilot' },
    { slug: 'gpt', name: 'GPT' },
    { slug: 'kimi', name: 'Kimi' },
    { slug: 'mistral', name: 'Mistral' },
    { slug: 'qwen', name: 'Qwen' },
  ] as const;

  export const AI_MODEL_SLUGS = AI_MODELS.map((m) => m.slug);

  export type AiModelSlug = (typeof AI_MODELS)[number]['slug'];

  export function isAiModelSlug(s: string): s is AiModelSlug {
    return (AI_MODEL_SLUGS as readonly string[]).includes(s);
  }

  /** Look up the display name for a slug (or return the slug as fallback). */
  export function aiModelName(slug: AiModelSlug): string {
    return AI_MODELS.find((m) => m.slug === slug)?.name ?? slug;
  }
  ```

  **Re-export** — append to `packages/shared/src/index.ts` (this file already re-exports `MCP_TOOLS`, `categories`, `types`, etc.):

  ```ts
  export * from './ai-models';
  ```

  **Cleanup** — delete the `ia_logos/` directory at the repo root (8 SVGs). Use `rm -rf` carefully or `git rm` if tracked.

- **Actions**:
  - Read `packages/shared/src/index.ts` and `packages/shared/src/mcp-tools.ts` for the export pattern.
  - Write `packages/shared/src/ai-models.ts` with the content above.
  - Append `export * from './ai-models';` to `packages/shared/src/index.ts`.
  - Check if `ia_logos/` is git-tracked: `git ls-files ia_logos/`. If tracked, use `git rm -r ia_logos/`. If untracked, use `rm -r ia_logos/`.
  - Run `pnpm typecheck` from repo root — must exit 0.
  - Verify: `node -e "console.log(require('@hatch/shared').AI_MODELS.length)"` returns `8`.

### 3. i18n strings: `Publish.Sections.BuiltWithAi*`, `Publish.BuiltWithAi.*`, `Detail.BuiltWithAi`, NEW top-level `Card.BuiltWithAi`

- **Task ID**: i18n-strings
- **Depends On**: none
- **Assigned To**: i18n-strings-builder
- **Agent Type**: `i18n-foundation-builder`
- **Parallel**: true
- **Owns Files**: `apps/web/messages/en.json`, `apps/web/messages/es.json`
- **Context**: Add ~8 new keys to both message catalogues with strict parity. AI model display names (Claude, DeepSeek, etc.) are NOT stored as i18n keys — they live in `@hatch/shared/ai-models.ts` as a single source of truth (`AI_MODELS[i].name` + `aiModelName(slug)` helper). All consumers use that helper, NOT i18n lookups. Only UI chrome (Title, Subtitle, HelperText, MaxLabel) needs i18n.

  **Keys to add to BOTH `en.json` and `es.json`:**

  Under `Publish.Sections.*` (mirror existing pattern — `BasicsTitle`, `BasicsSubtitle`, etc. — **NOTE PLURAL `Sections`**, verified in en.json line 174):
  - `BuiltWithAiTitle`: EN `"Built with AI"`, ES `"Construido con IA"`
  - `BuiltWithAiSubtitle`: EN `"Optionally tag the AI models you used. Up to 3."`, ES `"Etiqueta opcionalmente los modelos de IA que usaste. Hasta 3."`

  Under `Publish.BuiltWithAi.*`:
  - `HelperText`: EN `"Pick the models that helped you build this. Skip if you'd rather not say."`, ES `"Elige los modelos que te ayudaron a construirla. Sáltalo si prefieres no decirlo."`
  - `OptionalLabel`: EN `"Optional"`, ES `"Opcional"`
  - `MaxLabel`: EN `"Max 3"`, ES `"Máximo 3"`

  Under `Detail.*` (NEW key — do NOT modify existing `Detail.BuiltWith` which is used for tags):
  - `BuiltWithAi`: EN `"Built with AI"`, ES `"Construido con IA"`

  **NEW top-level `Card` namespace** (the `Card` namespace does NOT exist in en.json today — create it at the same depth as `Common`, `Detail`, `Publish`). Add:
  - `BuiltWithAi`: EN `"AI:"`, ES `"IA:"` (used as the small chip prefix on cards, e.g. "AI: Claude · GPT")

  **CRITICAL**: the `i18n_key_parity.py` hook will block if EN and ES diverge. Author both files in lockstep — after each subtree write, both files must be consistent.

  **Existing namespaces to preserve untouched**: `Landing.*` (~162 keys), `Settings.ApiKeysPage.*`, `Shell.*`, `Detail.BuiltWith` (existing — used for tags), `Publish.Sections.{Basics,Story,Discoverability,CoverArt}Title/Subtitle` (existing — note plural `Sections`).

- **Actions**:
  - Read `apps/web/messages/en.json` to find the exact insertion point in `Common`, `Publish.Section`, `Publish` (new `BuiltWithAi` sub-key), `Detail` (append `BuiltWithAi`), `Card` (append `BuiltWithAi`).
  - Use MultiEdit or sequential Edits to add the keys to en.json, then mirror to es.json.
  - Run `pnpm typecheck` from repo root — must exit 0 (no consumers yet, just confirms JSON validity).
  - Verify hook passes: `uv run .claude/hooks/validators/i18n_key_parity.py <<< '{"tool_input":{"file_path":"apps/web/messages/en.json"}}'` → must output `{}`.

### 4. CSS styling for AI chip patterns

- **Task ID**: css-styling
- **Depends On**: none
- **Assigned To**: css-styling-builder
- **Agent Type**: `general-purpose`
- **Parallel**: true
- **Owns Files**: `apps/web/app/globals.css` (additions only — do not modify any existing rule)
- **Context**: Add 4 small CSS rule blocks for the new chip patterns. Match the existing `.stack-chip` aesthetic (read the existing rule in `apps/web/app/styles/prototype-base.css` or `globals.css` first). Mobile-responsive — chips wrap.

  **Rules to add** (append to the end of `globals.css`):

  ```css
  /* ---------- Built with AI ---------- */

  /* Publish form: multi-toggle chip group */
  .ai-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .ai-chip-toggle {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      border-color 0.15s;
    user-select: none;
  }
  .ai-chip-toggle:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .ai-chip-toggle[data-selected='true'] {
    background: var(--text);
    color: var(--bg);
    border-color: transparent;
  }
  .ai-chip-toggle[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Card: small inline chip "AI: X · Y" under author row */
  .ai-chip-card {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
  }
  .ai-chip-card-prefix {
    font-weight: 600;
    color: var(--text-2);
  }

  /* Detail page: chip row (reuses .stack-chip for individual chips) */
  .ai-stack-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  ```

- **Actions**:
  - Read `apps/web/app/globals.css` end-to-end (briefly) to locate a good insertion point (end of file is fine).
  - Read `apps/web/app/styles/prototype-base.css` and grep for `.stack-chip` to see the existing styling and reuse colors.
  - Append the 4 rule blocks above to `globals.css`.
  - Confirm no existing rule was modified: `git diff --stat apps/web/app/globals.css` should show only insertions, no deletions.

### 5. Zod schema extension

- **Task ID**: zod-schema
- **Depends On**: db-migration, shared-types
- **Assigned To**: zod-schema-builder
- **Agent Type**: `general-purpose`
- **Parallel**: true (alongside api-routes + mcp-tool)
- **Owns Files**: `apps/web/lib/zod/publish.ts`
- **Context**: Add a new `builtWith` field to `PublishAppInput`. Use the `AI_MODEL_SLUGS` from `@hatch/shared` to drive the `z.enum(...)` so the slug list stays single-source.

  **Changes to `apps/web/lib/zod/publish.ts`**:

  Add at the top:

  ```ts
  import { AI_MODEL_SLUGS } from '@hatch/shared';
  ```

  Add a Zod enum for AI slugs (after `AccentColorEnum`):

  ```ts
  export const AiModelSlugEnum = z.enum(AI_MODEL_SLUGS as readonly [string, ...string[]]);
  ```

  Add to `PublishAppInput` (after `coverUrl`):

  ```ts
  builtWith: z.array(AiModelSlugEnum).max(3).default([]),
  ```

- **Actions**:
  - Read the existing `apps/web/lib/zod/publish.ts`.
  - Apply the 3 edits above.
  - Run `pnpm typecheck` from repo root — must exit 0.
  - Verify: `node -e "const z=require('zod');const {PublishAppInput}=require('./apps/web/lib/zod/publish.ts');"` (likely needs ts-node; alternative: trust typecheck).

### 6. Public API: include `built_with` in `/api/v1/apps`, `/api/v1/apps/[slug]`, and `/api/v1/profiles/[handle]`

- **Task ID**: api-routes
- **Depends On**: db-migration
- **Assigned To**: api-routes-builder
- **Agent Type**: `general-purpose`
- **Parallel**: true (alongside zod-schema + mcp-tool)
- **Owns Files**: `apps/web/app/api/v1/apps/route.ts`, `apps/web/app/api/v1/apps/[slug]/route.ts`, `apps/web/app/api/v1/profiles/[handle]/route.ts`
- **Context**: All three endpoints currently SELECT a fixed list of columns and shape the response. Add `built_with` to all three SELECT strings and response shapes. No new Zod schema needed (this is a read-only addition). The profile endpoint at `/api/v1/profiles/[handle]` returns the profile + an array of the user's apps with a separate apps-SELECT; that one needs the field too.

  **Change in `apps/web/app/api/v1/apps/route.ts` (line ~65 + line ~91)**:

  In the SELECT string, after `tags, ` add `built_with, `.
  In the `apps.map(...)` response shape (after `tags: row.tags,`), add `built_with: row.built_with ?? [],`.

  **Change in `apps/web/app/api/v1/apps/[slug]/route.ts` (line ~59 + line ~81)**:

  Same: add `built_with` to SELECT, add `built_with: data.built_with ?? []` to the response object.

  **Change in `apps/web/app/api/v1/profiles/[handle]/route.ts` (line ~80-81)**: this endpoint returns the profile + an array of the user's apps with a separate SELECT clause. Add `built_with` to that SELECT string AND `built_with: app.built_with ?? []` to the per-app response shape so the public profile-detail endpoint stays consistent with `/api/v1/apps`.

- **Actions**:
  - Read all three API route files.
  - Add `built_with` to all three SELECT clauses.
  - Add `built_with: row.built_with ?? []` (or `data.built_with ?? []`, or `app.built_with ?? []`) to all three response shapes.
  - Run `pnpm typecheck` from repo root — must exit 0.

### 7. MCP tool: `built_with` param on `publish_app` + `update_app` + read tools

- **Task ID**: mcp-tool
- **Depends On**: db-migration, shared-types
- **Assigned To**: mcp-tool-builder
- **Agent Type**: `general-purpose`
- **Parallel**: true (alongside zod-schema + api-routes)
- **Owns Files**: `apps/mcp/src/tools/publish.ts`, `apps/mcp/src/tools/read.ts`
- **Context**: Both `publishApp` and `updateApp` tool descriptors in `apps/mcp/src/tools/publish.ts` need the optional `built_with` param. Import the slug enum from `@hatch/shared`. Add to the Zod schema, the inputSchema JSON descriptor, and the insert/update payload.

  **Changes to `apps/mcp/src/tools/publish.ts`**:

  Add to imports at top:

  ```ts
  import { AI_MODEL_SLUGS } from '@hatch/shared';
  ```

  In `PublishAppSchema` and `UpdateAppSchema`, add (after `cover_url`):

  ```ts
  built_with: z.array(z.enum(AI_MODEL_SLUGS as readonly [string, ...string[]])).max(3).optional(),
  ```

  In both `inputSchema.properties`, add:

  ```ts
  built_with: {
    type: 'array',
    items: { type: 'string', enum: AI_MODEL_SLUGS },
    maxItems: 3,
    description: 'Optional AI models used to build this app. Up to 3 from: claude, deepseek, gemini, github-copilot, gpt, kimi, mistral, qwen.',
  },
  ```

  In `publishApp.handler`, add to the insert payload:

  ```ts
  built_with: parsed.built_with ?? [],
  ```

  In `updateApp.handler`, add to the update payload conditional (after `cover_url`):

  ```ts
  if (fields.built_with !== undefined) updatePayload.built_with = fields.built_with;
  ```

  **CRITICAL**: `AI_MODEL_SLUGS` is imported from `@hatch/shared` — the MCP server already consumes shared via `import type { Database } from '@hatch/shared'`. The shared tsconfig has rootDir widened to accept this. No additional config needed.

- **Actions**:
  - Read `apps/mcp/src/tools/publish.ts` end-to-end.
  - Apply the 5 edits above (import, 2 Zod schema adds, 2 inputSchema adds, 1 insert, 1 update conditional).
  - **ALSO patch `apps/mcp/src/tools/read.ts`** — add `, built_with` to the SELECT strings inside `list_apps` (around line 49), `get_app` (around line 110), and `search_apps` (around line 154) so an agent that publishes `built_with` can read it back via MCP. The read tools don't need new params or schemas — just include the column in the existing SELECT lists and pass-through in the JSON result (the existing `jsonResult(data)` pattern already returns the full row).
  - From `apps/mcp/`, run `pnpm typecheck` — must exit 0.
  - From repo root, run `pnpm typecheck` — must exit 0 across all workspaces.

### 8. Server action: include `built_with` in INSERT

- **Task ID**: server-action
- **Depends On**: db-migration, shared-types, zod-schema
- **Assigned To**: server-action-builder
- **Agent Type**: `general-purpose`
- **Parallel**: false (depends on zod-schema which adds the field to the input type)
- **Owns Files**: `apps/web/lib/actions/publish.ts`
- **Context**: `publishApp` reads `parsed.data` from `PublishAppInput`. Now the input has a new `builtWith` field. Destructure it and pass `built_with: builtWith` to the INSERT.

  **Changes to `apps/web/lib/actions/publish.ts`**:

  Destructure (line ~57):

  ```ts
  const {
    title,
    tagline,
    description,
    link,
    categoryId,
    tags,
    artKind,
    accent,
    coverUrl,
    builtWith,
  } = parsed.data;
  ```

  In the INSERT payload (line ~68), after `cover_url`, add:

  ```ts
  built_with: builtWith,
  ```

- **Actions**:
  - Read the existing `apps/web/lib/actions/publish.ts`.
  - Apply the 2 edits above.
  - Run `pnpm typecheck` from repo root — must exit 0.

### 9. Publish form: new "Built with AI" section with multi-toggle chip group

- **Task ID**: publish-form
- **Depends On**: shared-types, zod-schema, i18n-strings, css-styling
- **Assigned To**: publish-form-builder
- **Agent Type**: `ui-port-agent`
- **Parallel**: false (after Phase 1 + Phase 2 deps)
- **Owns Files**: `apps/web/app/_components/publish-screen.tsx`
- **Context**: The publish form is a single-page multi-section layout (NOT multi-step). Add a new section "Built with AI" using the same pattern as existing sections (`BasicsTitle`, `StoryTitle`, etc.). Place it AFTER the "Discoverability" section (which holds category + tags) but BEFORE "Cover art" — that's where the most logical user mental model lands.

  **Pattern to follow**: existing sections have a header `<h3>` + subtitle `<p>` + the field content. See how `Publish.Sections.DiscoverabilityTitle` renders (note plural `Sections`).

  **Imports to add**:

  ```ts
  import { AI_MODELS, type AiModelSlug } from '@hatch/shared';
  ```

  **Section JSX to insert** (where the existing form lays out the multi-section panel, after Discoverability and before CoverArt):

  ```tsx
  <Controller
    name="builtWith"
    control={control}
    render={({ field }) => {
      const selected: AiModelSlug[] = field.value ?? [];
      const atMax = selected.length >= 3;
      const toggle = (slug: AiModelSlug) => {
        if (selected.includes(slug)) {
          field.onChange(selected.filter((s) => s !== slug));
        } else if (!atMax) {
          field.onChange([...selected, slug]);
        }
      };
      return (
        <section className="form-section">
          <h3>{t('Sections.BuiltWithAiTitle')}</h3>
          <p>{t('Sections.BuiltWithAiSubtitle')}</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t('BuiltWithAi.HelperText')}</p>
          <div className="ai-chip-group">
            {AI_MODELS.map((m) => {
              const isSelected = selected.includes(m.slug);
              const isDisabled = atMax && !isSelected;
              return (
                <button
                  key={m.slug}
                  type="button"
                  className="ai-chip-toggle"
                  data-selected={isSelected ? 'true' : 'false'}
                  disabled={isDisabled}
                  onClick={() => toggle(m.slug)}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {selected.length}/3 — {t('BuiltWithAi.OptionalLabel')}
          </p>
        </section>
      );
    }}
  />
  ```

  **NOTE on display names**: directly use `m.name` from `AI_MODELS` (e.g. "Claude", "DeepSeek", "GitHub Copilot"). NO i18n lookup — these are product nouns and `@hatch/shared/ai-models.ts` is the single source of truth. This also avoids the kebab→PascalCase slug-to-key transform bug.

  **NO `useTranslations` inside the Controller render** — React Hooks must be called at the top level of the component, never inside callbacks. The existing `const t = useTranslations('Publish');` at line 52 of `publish-screen.tsx` is enough for the `t('Sections.*')` and `t('BuiltWithAi.*')` calls inside the Controller render (they reference keys under the `Publish` namespace already bound).

  **NOTE on RHF default**: the form's `defaultValues` (around line 71) currently doesn't include `builtWith`. Add `builtWith: []` to the defaults so the form renders correctly on mount.

  **CRITICAL — patch `previewApp` literal** (line 121-131): the current literal `const previewApp: AppData = { id, title, tagline, author, category, stats, tags, art, accent };` will FAIL typecheck after `AppData` gains a required `built_with: string[]` field. Add `built_with: watch('builtWith') ?? []` to the literal so the live card preview reflects the user's selection in real time AND typecheck passes.

  **Tailwind FORBIDDEN**: `_components/*.tsx` is governed by the prototype-port exception. Use the `.ai-chip-group`, `.ai-chip-toggle` classes (added in task `css-styling`) plus inline `style` where the existing file does. The `no_tailwind_in_prototype_port.py` hook (inherited from `ui-port-agent` frontmatter) will block any utility class.

- **Actions**:
  - Read the existing `apps/web/app/_components/publish-screen.tsx` end-to-end.
  - Add the `AI_MODELS` + `AiModelSlug` imports.
  - Add `builtWith: []` to `defaultValues` (around line 71).
  - Add `watch('builtWith')` alongside the other `watch(...)` calls (around line 91).
  - Insert the new section JSX between the existing Discoverability and CoverArt sections.
  - **Patch `previewApp` literal at line 121-131**: add `built_with: watch('builtWith') ?? []` to the object literal so typecheck passes after AppData gains the field AND the live preview reflects the user's selection.
  - Run `pnpm typecheck` from repo root — must exit 0.

### 10. Cards: render small "AI: X · Y" chip

- **Task ID**: cards-display
- **Depends On**: db-migration, shared-types, i18n-strings, css-styling
- **Assigned To**: cards-display-builder
- **Agent Type**: `ui-port-agent`
- **Parallel**: true (alongside detail-section — disjoint files)
- **Owns Files**: `apps/web/app/_components/cards.tsx`, `apps/web/app/_components/data-mappers.ts`
- **Context**: Extend the `AppData` interface in `cards.tsx` with `built_with: string[]` (default `[]`). Update `mapAppRowToCardProps` in `data-mappers.ts` to populate it from the DB row. Render a small inline chip under the author row in `ClassicCard` showing "AI: X · Y" (using display names from `@hatch/shared`).

  **Changes to `data-mappers.ts`** (around line 109):

  ```ts
  tags: app.tags ?? [],
  built_with: app.built_with ?? [],   // ← add
  ```

  Add to `AppData` interface (also `AppDataExtended` if needed).

  **Changes to `cards.tsx`**:

  Extend the `AppData` interface (line ~41):

  ```ts
  export interface AppData {
    // ... existing fields
    built_with: string[]; // ← add
  }
  ```

  Add an `AiChipCard` helper near `Avatar` (line ~67), reusing the slug→name mapping from `@hatch/shared`:

  ```tsx
  import { aiModelName, isAiModelSlug } from '@hatch/shared';

  export function AiChipCard({ slugs }: { slugs: string[] }) {
    const t = useTranslations('Card');
    if (!slugs || slugs.length === 0) return null;
    const names = slugs
      .filter(isAiModelSlug)
      .map((s) => aiModelName(s))
      .join(' · ');
    return (
      <span className="ai-chip-card">
        <span className="ai-chip-card-prefix">{t('BuiltWithAi')}</span>
        <span>{names}</span>
      </span>
    );
  }
  ```

  In `ClassicCard`, after the `.card-foot` row but before the closing `</article>` (or wherever fits visually below the author), insert:

  ```tsx
  <AiChipCard slugs={app.built_with} />
  ```

  Optional: mirror to other card variants (Sticker, Dark, Mono, Bento, Clean) — only if the layout absorbs the extra row gracefully. If unsure, restrict to `ClassicCard` (the default per `apps/web/app/(shell)/publish/page.tsx:28`) and `CleanCard` (the most recent design).

- **Actions**:
  - Read `apps/web/app/_components/cards.tsx` and `apps/web/app/_components/data-mappers.ts`.
  - Add `built_with: string[]` to `AppData` (and `AppDataExtended` if it extends `AppData` and is exported).
  - Populate in `mapAppRowToCardProps`.
  - Add the `AiChipCard` helper component near `Avatar`.
  - Insert `<AiChipCard slugs={app.built_with} />` into `ClassicCard` (and optionally other variants).
  - Run `pnpm typecheck` from repo root — must exit 0.

### 11. Detail page: new "Built with AI" panel

- **Task ID**: detail-section
- **Depends On**: db-migration, shared-types, i18n-strings, css-styling
- **Assigned To**: detail-section-builder
- **Agent Type**: `general-purpose`
- **Parallel**: true (alongside cards-display)
- **Owns Files**: `apps/web/app/(shell)/a/[slug]/page.tsx`
- **Context**: The detail page already has a `<div className="panel">` at line 381-391 that uses `t('BuiltWith')` to render the existing `tags` array. **DO NOT TOUCH THAT PANEL.** Insert a NEW `<div className="panel">` IMMEDIATELY AFTER it (before the `<Comments />` component) that uses `t('BuiltWithAi')` and renders `row.built_with`.

  **JSX to insert** (after the existing `BuiltWith` panel's closing `</div>` and before `<Comments ... />`):

  ```tsx
  {
    row.built_with && row.built_with.length > 0 && (
      <div className="panel">
        <h3 className="panel-h">{t('BuiltWithAi')}</h3>
        <div className="ai-stack-row">
          {row.built_with.filter(isAiModelSlug).map((slug) => (
            <span key={slug} className="stack-chip">
              <i className="stack-dot" style={{ background: app.accent }} />
              {aiModelName(slug)}
            </span>
          ))}
        </div>
      </div>
    );
  }
  ```

  **Imports to add** (top of file):

  ```ts
  import { aiModelName, isAiModelSlug } from '@hatch/shared';
  ```

  **NOTE**: `row` is the raw `Tables<'apps'>` row from `fetchApp(slug)`. After `db-migration` task ships, `row.built_with: string[]` will be typed correctly. The conditional render hides the panel when the array is empty so apps without declared AI stay clean.

- **Actions**:
  - Read `apps/web/app/(shell)/a/[slug]/page.tsx`.
  - Add the `aiModelName, isAiModelSlug` import.
  - Locate the existing `BuiltWith` panel (search for `t('BuiltWith')`).
  - Insert the new panel JSX immediately after it.
  - Run `pnpm typecheck` from repo root — must exit 0.

### 12. E2E validation with Playwright MCP

- **Task ID**: e2e-validation
- **Depends On**: db-migration, shared-types, i18n-strings, css-styling, zod-schema, api-routes, mcp-tool, server-action, publish-form, cards-display, detail-section
- **Assigned To**: e2e-validator
- **Agent Type**: `ui-validator`
- **Parallel**: false
- **Owns Files**: `apps/web/tests/visual-baselines/built-with-ai/report.md`, `apps/web/tests/visual-baselines/built-with-ai/screens/*.png`
- **Context**: Verify end-to-end that the new field flows correctly through publish → DB → card → detail → API.

  **Setup**:
  1. Start dev server: `pnpm dev:web > /tmp/hatch-dev.log 2>&1 & disown`. Poll up to 30s for readiness.
  2. Create evidence dir: `mkdir -p apps/web/tests/visual-baselines/built-with-ai/screens`.

  **Pass A — Functional smoke (Playwright MCP)**:

  | #   | Scenario                                                                                                                                                                | Pass criteria                                                                                                                       |
  | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
  | A1  | Navigate to `/publish` (must be signed in — coordinate via cookie seed if OAuth unavailable; otherwise skip the actual publish step and use the API to insert directly) | The new "Built with AI" section is visible with 8 chip toggles. Screenshot `screens/a1-publish-form.png`.                           |
  | A2  | Click on "Claude" + "GPT" chips                                                                                                                                         | Both show `data-selected="true"`. Counter shows `2/3`. Screenshot `screens/a2-two-selected.png`.                                    |
  | A3  | Click on "Mistral", "Gemini", "Qwen" (4th attempt)                                                                                                                      | Other chips become disabled when 3 are selected (max). Click Qwen does nothing because Mistral + Gemini are already in. Screenshot. |
  | A4  | Submit form (or fall back to direct API insert if OAuth blocked)                                                                                                        | A new app row exists in DB with `built_with` populated. Verify via `curl -s http://localhost:3000/api/v1/apps?limit=1               | jq '.apps[0].built_with'`. |
  | A5  | Navigate to gallery `/gallery`                                                                                                                                          | New app card shows the AI chip "AI: Claude · GPT" under the author. Screenshot.                                                     |
  | A6  | Navigate to the new app detail `/a/<slug>`                                                                                                                              | New "Built with AI" panel renders below the existing "Built with" (tags) panel with two `.stack-chip` rendered. Screenshot.         |
  | A7  | API JSON shape: `curl -s http://localhost:3000/api/v1/apps/<slug> \| jq '.app.built_with'`                                                                              | Returns the array `["claude", "gpt"]` (or whatever was inserted).                                                                   |
  | A8  | Empty case: navigate to a pre-existing app (no `built_with`)                                                                                                            | Card chip NOT rendered (length === 0 hides). Detail "Built with AI" panel NOT rendered. Screenshot `screens/a8-empty.png`.          |

  **Pass B — Locale parity**: switch to ES via the locale toggle, verify the publish form section, helper text, and detail panel header all show Spanish ("Construido con IA"). Screenshot.

  **Pass C — Build + typecheck + lint**:
  - `pnpm typecheck` → exit 0
  - `pnpm lint` → exit 0 (4 pre-existing warnings in non-feature files are acceptable per prior baseline)
  - `pnpm build` → exit 0

  **Pass D — Schema verification** (via Supabase MCP from Bash):
  - `mcp__supabase__execute_sql` with `select column_name, data_type from information_schema.columns where table_name='apps' and column_name='built_with';` → must return 1 row.
  - `mcp__supabase__get_advisors` with type `security` → no new advisories.

  **Pass E — MCP tool smoke** (best-effort, optional):
  - Manually verify (or via curl with a test PAT) that the MCP `publish_app` tool accepts the `built_with` param. If MCP server is not running locally, document this as deferred.

  Stop dev server when done: `pkill -f "next dev"`.

  **Evidence directory**:

  ```
  apps/web/tests/visual-baselines/built-with-ai/
  ├── report.md
  └── screens/
      ├── a1-publish-form.png
      ├── a2-two-selected.png
      ├── a3-max-disabled.png
      ├── a5-card-chip.png
      ├── a6-detail-panel.png
      ├── a7-api-jq-result.txt
      ├── a8-empty.png
      └── b-spanish.png
  ```

- **Actions**:
  - Start dev server.
  - Run the 8 functional scenarios + locale parity + build/lint/typecheck + DB advisor check.
  - Write `report.md` with the pass status table and evidence paths.
  - Stop dev server.

### 13. Expert self-improve

- **Task ID**: expert-self-improve
- **Depends On**: e2e-validation
- **Assigned To**: expert-improver
- **Agent Type**: `general-purpose`
- **Parallel**: false
- **Owns Files**: `.claude/commands/experts/supabase/expertise.yaml`, `.claude/commands/experts/nextjs/expertise.yaml`, `.claude/commands/experts/mcp-server/expertise.yaml`
- **Context**: Reflect the new `apps.built_with` column, the `@hatch/shared/ai-models` module, the new MCP tool param, the new i18n keys, the chip CSS pattern, and the publish form section in each relevant expert's expertise.yaml.

- **Actions**:
  - **supabase**: log `0029_apps_built_with.sql` under `migrations_applied`, add `built_with` to the `apps` table column list under `database_schema.tables`.
  - **nextjs**: add a `built_with_pattern` block under `key_patterns` documenting the chip group + card chip + detail panel. Note the new i18n keys.
  - **mcp-server**: note that `publish_app` + `update_app` now accept `built_with: string[]` (max 3, fixed enum).
  - Validate YAML parse for all 3: `python3 -c "import yaml; yaml.safe_load(open('PATH'))"` for each.

## Testing Strategy

### Unit Tests

No new unit-test framework is added — the project doesn't have a unit-test suite for actions/schemas. Coverage relies on:

- `pnpm typecheck` to catch type errors at the input/insert boundary.
- The Zod `z.enum(AI_MODEL_SLUGS)` to reject invalid slugs at request time.
- The DB CHECK constraint to reject invalid slugs as a defense-in-depth backstop.

### Edge Cases

- **Empty `built_with`**: card chip is hidden, detail panel is hidden. Default value `'{}'::text[]` from the DB plus `[]` default from Zod ensure no NULL handling needed.
- **Exactly 3 selected**: 4th chip click is disabled in the form. DB CHECK rejects arrays > 3.
- **Unknown slug**: Zod rejects at request time. CHECK rejects at DB write time. Card/detail `.filter(isAiModelSlug)` hides any unknown slug rather than crashing.
- **Slug renamed/removed** (future): require migration to drop CHECK + recreate with new list, AND coordinated update of `AI_MODELS` + i18n + form chip names. Document in expertise.yaml so future devs know.
- **Old apps without column**: the migration's `default '{}'::text[]` backfills existing rows to empty arrays — they render as the "empty" case (no chip).
- **MCP tool with `built_with`**: tool validates against `z.enum(AI_MODEL_SLUGS)`; passing unknown slug returns Zod error; passing > 3 returns Zod error.
- **i18n key map for `github-copilot`**: slug → key conversion is `kebab → PascalCase` (`github-copilot` → `GithubCopilot`). Make sure both the form chip rendering and any other consumer use the same transform.
- **Public API response shape**: `built_with: string[]` (always an array, never null). Consumers like third-party agents can rely on `.includes('claude')`.

## Acceptance Criteria

1. **DB schema**: `apps.built_with text[]` exists with default `'{}'::text[]`, CHECK constraint limiting to the 8 valid slugs AND max length 3, GIN index `apps_built_with_idx`. `mcp__supabase__execute_sql` query confirms.
2. **Shared types**: `@hatch/shared` exports `AI_MODELS`, `AI_MODEL_SLUGS`, `AiModelSlug`, `isAiModelSlug`, `aiModelName`. Both web and MCP can import.
3. **`ia_logos/` deleted**: directory no longer present in repo. `ls ia_logos/` returns "No such file or directory".
4. **i18n**: 2 `Publish.Sections.BuiltWithAi*` (Title + Subtitle) + 3 `Publish.BuiltWithAi.*` (HelperText, OptionalLabel, MaxLabel) + 1 `Detail.BuiltWithAi` + 1 new top-level `Card.BuiltWithAi` in both en.json and es.json with parity (`i18n_key_parity.py` PASS). NO `Common.AiModels.*` keys — vendor display names live in `@hatch/shared/ai-models.ts`.
5. **CSS**: `.ai-chip-group`, `.ai-chip-toggle`, `.ai-chip-card`, `.ai-stack-row` rules present in `globals.css`.
6. **Zod**: `PublishAppInput.builtWith` accepts arrays of valid slugs, max 3, default `[]`. Invalid slug or > 3 fails parse.
7. **Server action**: `publishApp` writes `built_with` to the DB on every insert.
8. **MCP tool**: `publish_app` and `update_app` accept optional `built_with` (max 3, enum-validated). The handler writes to DB on insert/update.
9. **Public API**: `/api/v1/apps` and `/api/v1/apps/{slug}` both return `built_with: string[]` (always array, never null).
10. **Publish form**: new "Built with AI" section renders with 8 chip toggles; max 3 selectable; 4th becomes disabled; counter shows `N/3`.
11. **Card**: small "AI: X · Y" chip renders under author row when `built_with.length > 0`; hidden when empty.
12. **Detail page**: new "Built with AI" panel renders below the existing "Built with" (tags) panel when `built_with.length > 0`; hidden when empty.
13. **Build green**: `pnpm typecheck`, `pnpm lint`, `pnpm build` all exit 0.
14. **Evidence committed**: `apps/web/tests/visual-baselines/built-with-ai/report.md` with all 8 Pass A scenarios PASS, plus Pass B/C/D/E.
15. **No regressions**: existing tags-based "Built with" section on detail page still works exactly as before (i.e., `Detail.BuiltWith` key unchanged, no JSX touched in that block).
16. **Trademark posture**: no logos rendered anywhere on the site. Text-only. Lookup `apps/web/public/*.svg` to confirm no AI brand SVG was added.

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm typecheck` — TypeScript across all workspaces. MUST exit 0.
- `pnpm lint` — ESLint + Prettier across all workspaces. MUST exit 0 (4 pre-existing warnings in non-feature files documented; flagged here only if NEW warnings appear).
- `pnpm build` — Production build. MUST exit 0 with clean output (no missing translations, no broken imports).
- `node -e "const {AI_MODELS, AI_MODEL_SLUGS, isAiModelSlug, aiModelName} = require('./packages/shared/dist'); console.log(AI_MODELS.length, AI_MODEL_SLUGS, isAiModelSlug('claude'), aiModelName('github-copilot'))"` — quick smoke that the shared module compiles and exports correctly.
- `node -e "const en=require('./apps/web/messages/en.json'),es=require('./apps/web/messages/es.json');function keys(o,p='',a=[]){for(const k in o){const np=p?p+'.'+k:k;typeof o[k]==='object'?keys(o[k],np,a):a.push(np)}return a}const ek=keys(en),sk=keys(es);const missing=[...ek.filter(k=>!sk.includes(k)),...sk.filter(k=>!ek.includes(k))];console.log('Missing:',missing);process.exit(missing.length?1:0)"` — i18n parity. MUST exit 0.
- `grep -c "BuiltWithAi" apps/web/messages/en.json` — MUST be ≥ 4.
- `grep -c '"Card"' apps/web/messages/en.json apps/web/messages/es.json` — MUST be ≥ 1 per file (new top-level `Card` namespace exists).
- `node -e "const {aiModelName} = require('@hatch/shared'); console.log(aiModelName('github-copilot'))"` — MUST print `GitHub Copilot`.
- `grep -c "BuiltWithAi" apps/web/messages/en.json apps/web/messages/es.json` — MUST be ≥ 4 per file.
- `ls ia_logos/ 2>&1 | grep -i "no such"` — MUST return a match (directory deleted).
- `test ! -d ia_logos && echo OK` — MUST print `OK`.
- `git diff --stat apps/web/messages/en.json` — MUST show only additions (no key removal).
- `curl -sf http://localhost:3000/api/v1/apps?limit=1 | jq -e '.apps[0] | has("built_with")'` — (with dev server running) MUST return `true`.

## Notes

- **No new dependencies**. Uses existing Zod, react-hook-form, next-intl, Supabase client.
- **No new SaaS / external services**. Pure DB + JSON.
- **Trademark posture**: text-only mention is industry-standard "nominative fair use" — Vercel templates, GitHub READMEs, Stripe docs all do this. The 3-vendor cap + opt-in nature keeps it from feeling like an endorsement.
- **Future filter in gallery**: when ready, add `?ai=claude` query param to `/gallery` and use the GIN index for `where 'claude' = any(built_with)`. Out of scope here.
- **Future: profile-level summary**: aggregate "this builder uses Claude + GPT" across their published apps. Out of scope.
- **Future: extend to 10+ models**: any addition requires (1) append to `AI_MODELS`, (2) update CHECK constraint via new migration, (3) add i18n key. Document the 3-step contract in `nextjs/expertise.yaml`.
- **Why no separate `ai_models` table + pivot**: with 8 fixed values and no need for per-vendor metadata (icon URL, description, etc. — we are TEXT ONLY), a `text[]` column with CHECK is the simpler design. If we later want logos / vendor URLs / sponsorship tier, migrate to a proper table.
- **Why kebab-case slug for `github-copilot`**: GitHub Copilot is the only multi-word vendor in the list. Kebab-case is the URL-safe convention. The display name "GitHub Copilot" is restored via `aiModelName()`.
- **Why no SOFT brand-disclaimer text on the publish form**: explicit disclaimer would invite legal review of every other text mention on the site (categories, tags, author names mentioning external products). Cleaner posture: text-only IS the disclaimer.
- **Existing prototype-port exception**: the publish form lives in `_components/` so Tailwind utilities are forbidden. All new styling lives in `globals.css` as plain CSS — the `no_tailwind_in_prototype_port.py` hook enforces this on every Write/Edit.

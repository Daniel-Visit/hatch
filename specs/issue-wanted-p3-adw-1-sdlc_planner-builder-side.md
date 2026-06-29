# Feature: Wanted Phase 3 — Builder Side (preferences, inbox, brief detail)

## Metadata

issue_number: `wanted-p3`
adw_id: `1`
issue_json: `n/a (source spec: docs/superpowers/specs/2026-06-04-wanted-phase3-builder-side-design.md)`

## Feature Description

Wanted Phase 3 closes the **seeker ↔ builder** loop. Today a seeker can create a brief,
refine it, and the Matcher generates matches — but **the builder side does not exist**:
a builder cannot activate (`profiles.accepts_requests` defaults `false`), so the Matcher
Phase B never returns builders, and there is no surface to view or respond to incoming
matches. This phase builds three surfaces:

1. **`/settings/requests`** — builder opt-in & preferences (capacity, domains, rate band,
   inferred capabilities).
2. **`/requests`** — builder inbox of incoming matches (CONNECT opens a thread + notifies;
   SKIP records feedback).
3. **`/wanted/[id]`** — private brief detail page (author + matched builder only).

Plus a "Requests" nav entry and EN/ES i18n. **No new migrations** — the data model already
exists (migration 0034: `accepts_requests`, `request_capacity`, `request_domains`,
`request_rate_band`, `inferred_capabilities`; migration 0036: `candidate_feedback`); RLS is
healthy after 0039 (`is_matched_builder` / `is_brief_author` SECURITY DEFINER functions, no
recursion). The match-action routes already exist (`POST /api/v1/matches/[id]/respond`,
`/swipe`).

## User Story

As a **builder** (developer who ships apps on Hatch)
I want to **opt in to receiving briefs, set my capacity/domains, and accept or skip incoming matches**
So that **seekers' briefs actually reach me and I can start a conversation — closing the loop the seeker side already opened**.

## Problem Statement

The seeker side is live in production but the loop is open: `profiles.accepts_requests`
starts `false` with no UI to flip it, so the Matcher's Phase B (builder candidates) returns
nothing actionable; builders have no inbox to see/respond to matches; and the base
`/wanted/[id]` detail route doesn't exist (only `/health` and `/matches` subroutes do).
Without this phase, advertising Wanted as a service over-promises — briefs go nowhere.

## Solution Statement

Build the three builder-facing surfaces by **reusing existing patterns verbatim**: the
feature-flag gate from `wanted/new/page.tsx`, the RHF+Zod form from `settings/profile`, the
`ActionResult<T>` server-action shape from `lib/actions/profile.ts`, the match-repo query
style, the optimistic-fetch client pattern from `match-deck.tsx`, and the CONNECT/SKIP
contract already implemented in `respond/route.ts`. UI is prototype-ported byte-for-byte
from `new/mockups.html` `#inbox` (card-request — classes already in `wanted.css`) and
`#settings` (settings-card / capability-editor — classes to be added to `wanted.css`). One
new repo function (`listBuilderRequests`), one new Zod schema, one new server action, three
pages, three client/port components, a nav entry, and EN/ES keys. Everything behind
`wanted_v1_enabled` (404 when off).

## Relevant Files

Use these files to implement the feature:

**Patterns to mirror (read, do not modify unless owned):**

- `apps/web/app/(shell)/wanted/new/page.tsx` — the feature-flag gate: `getUser()` →
  `redirect('/sign-in')`; narrow `profile.feature_flags` to `Record<string,unknown>|null`;
  `isWantedEnabled({ feature_flags }, process.env)` from `@hatch/shared` → `notFound()`.
- `apps/web/app/(shell)/wanted/[id]/matches/page.tsx` — the `[id]` subroute server-component
  pattern: `params: Promise<{ id: string }>` then `const { id } = await params`; `getBrief`,
  author-only `notFound()`, `getTranslations('Wanted.MatchDeck')`, pass data to a
  `*-client.tsx`. **Next 15: params are awaited.**
- `apps/web/app/(shell)/settings/profile/profile-form.tsx` — RHF + Zod client form:
  `useForm({ resolver: zodResolver(Schema), defaultValues })`, `useTranslations`,
  `onSubmit` calls server action, `{ ok }` handling, `Controller` for non-text inputs
  (the gradient radiogroup is the template for the chip editors).
- `apps/web/lib/actions/profile.ts` — server action shape: `'use server'`,
  `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }`, Zod
  `safeParse`, `requireUser()`, **session** supabase client (`createSupabaseServerClient`),
  `.from('profiles').update(...).eq('id', user.id)`, `revalidatePath`.
- `apps/web/lib/wanted/match-repo.ts` — the repo to EXTEND. Mirror `listMatchesForBrief`
  (lines 97-113) for the new `listBuilderRequests`. Note `MatchRow` type alias and the
  session-client read convention.
- `apps/web/lib/wanted/match-repo.test.ts` — vitest structure to mirror for the new test.
- `apps/web/app/api/v1/matches/[id]/respond/route.ts` — the CONNECT/SKIP contract the inbox
  client calls: `POST` body `{ action: 'CONNECT'|'SKIP', feedback?: 'not_my_area'|'no_capacity'|'budget_mismatch'|'other', feedbackNote?: string }`,
  returns `{ matchId, seekerAction, candidateAction, threadCreated, threadId }`.
- `apps/web/app/(shell)/wanted/_components/match-deck.tsx` — optimistic-update + fetch
  pattern (lines 54-74): optimistically remove the card from a `Set` of acted ids, `fetch`
  the route, leave removal on network failure. Mirror for the inbox `requests-client.tsx`.
- `apps/web/app/_components/shell.tsx` — sidebar nav: `BROWSE_NAV` / `LIBRARY_NAV` arrays of
  `{ href, key, icon }`, rendered with `t(\`Nav.${n.key}\`)`. Add the "Requests" entry here.
- `new/mockups.html` — prototype-port source. `#inbox` (lines 1811-1932): `card-request*`
  markup. `#settings` (lines 1937-2025): `settings-card`, `settings-row`, `toggle`,
  `capability-editor`, `capability-editor-head`, `capability-tags`, `capability-tag`,
  `edit-link`. The mockup `<style>` block (lines ~829+) holds the verbatim CSS for these.
- `apps/web/app/styles/wanted.css` — `card-request*` classes ALREADY present (Phase 2). The
  `settings-*`, `toggle`, `capability-*`, `edit-link` classes must be ADDED (verbatim from
  the mockup `<style>` block).
- `apps/web/messages/en.json` / `es.json` — i18n. `Wanted.InboxRequests` partially
  pre-staged (`pageTitle`, `emptyTitle`, `emptyCta`, `notificationBody`, `decideLater`);
  `Wanted.labels` has brief field labels; `Shell.Nav` holds nav labels. Extend, keep EN/ES
  in parity.
- `packages/db/migrations/0030_wanted_enums.sql` — `budget_band` enum values:
  `EXPLORATORY`, `LT_500`, `FROM_500_2K`, `FROM_2K_10K`, `GT_10K`, `OPEN`.
- `apps/web/lib/auth.ts` — `getUser()` and `requireUser()` helpers.
- `apps/web/lib/wanted/brief-repo.ts` — `getBrief(client, id)` (line 59) for the detail page.
- `apps/web/lib/zod/profile.ts` — Zod schema file convention to mirror.
- **`briefs` schema reality** (`packages/db/migrations/0031_briefs.sql`): there is **no
  `problem_statement` column**. The structured brief sections live in a single `content jsonb`
  column typed as `BriefContent` (exported from `@hatch/shared`, validated by
  `BriefContentSchema`): nested `content.problem.{trigger,affected,currentWorkaround,costOfNotSolving}`,
  `content.desiredOutcome.{mustHaves,outOfScope,...}`, `content.context`, `content.constraints`.
  Typed scalar columns also exist: `title`, `budget_band` (enum), `timeline` (enum),
  `technical_level` (enum), `solution_types` (enum[]), `industry`, `use_case`, `geography`,
  `completeness_score`, `expires_at`, `updated_at`. See `apps/web/lib/wanted/brief-state.ts`,
  `completeness.ts`, and `embeddings/capability.ts` (line 165, `BriefContentSchema.safeParse(row.content)`)
  for how to read nested fields. The matches→briefs FK auto-name is `matches_brief_id_fkey`
  (`matches.brief_id references briefs(id)`, 0032).

### New Files

- `apps/web/lib/zod/request-preferences.ts` — Zod schema for builder preferences.
- `apps/web/lib/actions/request-preferences.ts` — `updateRequestPreferences` server action.
- `apps/web/lib/actions/request-preferences.test.ts` — action validation tests.
- `apps/web/app/(shell)/settings/requests/page.tsx` — preferences page (server gate).
- `apps/web/app/(shell)/settings/requests/requests-form.tsx` — preferences form (client).
- `apps/web/app/(shell)/requests/page.tsx` — builder inbox (server gate + fetch).
- `apps/web/app/(shell)/requests/_components/request-card.tsx` — incoming-match card (port).
- `apps/web/app/(shell)/requests/_components/requests-client.tsx` — inbox client (optimistic).
- `apps/web/app/(shell)/wanted/[id]/page.tsx` — private brief detail page.

## Implementation Plan

### Phase 1: Foundation

Logic + scaffolding with no UI coupling, runnable in parallel: (a) the Zod schema + server
action + tests for preferences; (b) the `listBuilderRequests` repo function + test; (c) the
nav entry + the full EN/ES key set the UI will reference; (d) the verbatim CSS additions to
`wanted.css` for the settings/capability/toggle classes. None of these four touch the same
files, so they run concurrently.

### Phase 2: Core Implementation

The three UI surfaces, each depending on the foundation interfaces (action, repo fn, i18n
keys, CSS): the preferences page+form, the inbox page+card+client, and the brief detail
page. These own disjoint file sets and run concurrently.

### Phase 3: Integration

Wire-up verification: the nav entry routes to `/requests`; an activated builder with a
matching brief sees a card in `/requests`; CONNECT opens a thread + notifies (existing
`respond` route); SKIP records feedback. Playwright screenshots of all three screens in EN
and ES, then the full command gate (typecheck/lint/build/vitest).

## Team Orchestration

This plan uses Claude Code's **agent teams** for coordinated parallel execution. The executor
operates as the **team lead in delegate mode** — orchestrating teammates without writing code
directly.

### Team Setup

This plan is executed via `/tac:implement` which uses **subagent-driven development**:

1. **Parse tasks**: The executor reads this plan, extracts all tasks with full context
2. **Create task list**: `TaskCreate` for every task, with dependencies via `addBlockedBy`
3. **Dispatch subagents**: Fresh subagent per task (no context pollution between tasks)
4. **Two-stage review**: Each task gets spec compliance review, then code quality review
5. **Status handling**: Subagents report DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
6. **Final validation**: Run all Validation Commands after all tasks complete

To execute: `/tac:implement specs/issue-wanted-p3-adw-1-sdlc_planner-builder-side.md`

### Team Members

- **prefs-logic**
  - Role: Builder-preferences Zod schema, `updateRequestPreferences` server action, and its unit tests.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/web/lib/zod/request-preferences.ts`, `apps/web/lib/actions/request-preferences.ts`, `apps/web/lib/actions/request-preferences.test.ts`
  - Required Capabilities: all standard tools (file write via Write/Edit; shell via Bash for `pnpm --filter web test`)
  - Plan Approval: false
  - Hooks:
    - Stop: `validate_new_file.py --directory apps/web/lib/actions --extension ts`

- **inbox-repo**
  - Role: Add `listBuilderRequests` to match-repo and a mirroring vitest test.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/web/lib/wanted/match-repo.ts`, `apps/web/lib/wanted/match-repo.test.ts`
  - Required Capabilities: all standard tools (Write/Edit; Bash for vitest)
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `validate_file_contains.py --directory apps/web/lib/wanted --extension ts --contains 'listBuilderRequests'` (Stop hook — ensures the function exists)

- **nav-i18n**
  - Role: Single owner of message files + shell nav. Adds the "Requests" nav entry and the full EN/ES key set every UI surface references.
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: `apps/web/app/_components/shell.tsx`, `apps/web/messages/en.json`, `apps/web/messages/es.json`
  - Required Capabilities: all standard tools (Write/Edit; Bash for `pnpm --filter web typecheck`)
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit): `i18n_key_parity.py` (blocks EN/ES key drift)

- **ui-port**
  - Role: Prototype-port the CSS additions and all builder-side UI; wire pages to the
    session client, the new action, and the repo function with the existing gate pattern.
  - Agent Type: `ui-port-agent`
  - Model: opus (the ui-port-agent definition pins opus)
  - Owns Files: `apps/web/app/styles/wanted.css`, `apps/web/app/(shell)/settings/requests/page.tsx`, `apps/web/app/(shell)/settings/requests/requests-form.tsx`, `apps/web/app/(shell)/requests/page.tsx`, `apps/web/app/(shell)/requests/_components/request-card.tsx`, `apps/web/app/(shell)/requests/_components/requests-client.tsx`, `apps/web/app/(shell)/wanted/[id]/page.tsx`
  - Required Capabilities: Write, Edit, MultiEdit, Read, Grep, Glob, Bash (matches ui-port-agent `tools:` frontmatter)
  - Plan Approval: false
  - Hooks (already in `.claude/agents/team/ui-port-agent.md` frontmatter — inherited automatically):
    - PostToolUse (Write|Edit): `css_verbatim_validator.py`
    - PostToolUse (Write|Edit): `no_tailwind_in_prototype_port.py`
    - PostToolUse (Write|Edit): `no_data_js_import.py`

- **validator**
  - Role: End-to-end validation — Playwright screenshots of the three new screens (EN+ES) and
    the full command gate.
  - Agent Type: `ui-validator`
  - Model: sonnet
  - Owns Files: none (read-only + run commands; may write screenshots to a scratch dir)
  - Required Capabilities: Bash (typecheck/lint/build/vitest, `pnpm dev:web`), browser automation (`mcp__playwright__*`), `mcp__supabase__*` for fixture checks (matches ui-validator frontmatter)
  - Plan Approval: false
  - Hooks: none

## Validation Hooks

### Available Validators

Existing reusable validators in `.claude/hooks/validators/`:

- `validate_new_file.py --directory <dir> --extension <ext>` — Blocks Stop if no new file exists (Stop hook)
- `validate_file_contains.py --directory <dir> --extension <ext> --contains '<string>'` — Blocks Stop if file missing required content (Stop hook)
- `css_verbatim_validator.py` — Blocks Write/Edit that diverge from prototype CSS class strings (PostToolUse). Already wired into `ui-port-agent`.
- `no_tailwind_in_prototype_port.py` — Blocks Tailwind utility classes in prototype-port files (PostToolUse). Already wired into `ui-port-agent`.
- `i18n_key_parity.py` — Blocks EN/ES message-key drift (PostToolUse on messages).

### Custom Validators

None — existing validators cover this problem. The prototype-port discipline (css_verbatim,
no_tailwind), the i18n parity check, and the new-file/contains Stop guards are sufficient.
No new migrations means `rls_enabled_validator.py` / `migration_validator.py` are not in play.

### Hook Assignments

| Team Member | Hook Type   | Matcher     | Validator                                                                                                                  |
| ----------- | ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| prefs-logic | Stop        | —           | `validate_new_file.py --directory apps/web/lib/actions --extension ts`                                                     |
| inbox-repo  | Stop        | —           | `validate_file_contains.py --directory apps/web/lib/wanted --extension ts --contains 'listBuilderRequests'`                |
| nav-i18n    | PostToolUse | Write\|Edit | `i18n_key_parity.py`                                                                                                       |
| ui-port     | PostToolUse | Write\|Edit | `css_verbatim_validator.py`, `no_tailwind_in_prototype_port.py`, `no_data_js_import.py` (inherited from agent frontmatter) |
| validator   | —           | —           | none                                                                                                                       |

## Step by Step Tasks

- Execute tasks in order, respecting dependencies. Parallel tasks (no dependency conflicts) MUST be launched simultaneously.
- The executor creates these via `TaskCreate`, sets dependencies via `TaskUpdate` with `addBlockedBy`, and assigns via `TaskUpdate` with `owner`.
- Every task's **Context** field is self-contained.

### 1. Builder-preferences Zod schema + server action + tests

- **Task ID**: prefs-logic
- **Depends On**: none
- **Assigned To**: prefs-logic
- **Agent Type**: general-purpose
- **Parallel**: true
- **Owns Files**: `apps/web/lib/zod/request-preferences.ts`, `apps/web/lib/actions/request-preferences.ts`, `apps/web/lib/actions/request-preferences.test.ts`
- **Context**: Create the Zod schema and server action that persist builder request
  preferences onto the caller's own `profiles` row. **Mirror `apps/web/lib/actions/profile.ts`
  exactly** for structure: `'use server'`; `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }`;
  `safeParse` the input (return `{ ok:false, error:'invalid_input' }` on failure); `requireUser()`
  inside try/catch (return `{ ok:false, error:'unauthorized' }` on throw); use the **session**
  client `createSupabaseServerClient()` (RLS: a user updates their own profile row — never the
  admin client); `.from('profiles').update(payload).eq('id', user.id)`; on db error
  `console.error('updateRequestPreferences db_error', {...})` and return `{ ok:false, error:'db_error' }`;
  `revalidatePath('/settings/requests')`; return `{ ok:true, data:{ id:user.id } }`.
  The columns to write (all from migration 0034): `accepts_requests boolean`,
  `request_capacity int`, `request_domains text[]`, `request_rate_band` (enum `budget_band`,
  nullable), `inferred_capabilities text[]`. Type the payload as
  `Database['public']['Tables']['profiles']['Update']` (import `Database` from
  `@/lib/supabase/types`, matching profile.ts). **Zod schema** (in
  `lib/zod/request-preferences.ts`, mirror `lib/zod/profile.ts` export style — export the
  schema and a `type ...Type = z.infer<...>`): `accepts_requests: z.boolean()`;
  `request_capacity: z.number().int().min(0).max(20)`; `request_domains: z.array(z.string().min(1).max(64)).max(32)`;
  `inferred_capabilities: z.array(z.string().min(1).max(64)).max(32)`;
  `request_rate_band: z.enum(['EXPLORATORY','LT_500','FROM_500_2K','FROM_2K_10K','GT_10K','OPEN']).nullable()`
  (these are the exact `budget_band` enum values from `packages/db/migrations/0030_wanted_enums.sql`).
  **Tests** (`request-preferences.test.ts`, vitest, mirror the existing action/repo tests
  under `apps/web/lib`): cover capacity out of range (rejected), array item too long
  (rejected), > 32 items (rejected), invalid enum (rejected), null rate band (accepted),
  valid full payload (accepted). Test the **schema** validation directly (pure, no DB); do
  not require a live Supabase connection.
- **Actions**:
  - Write `apps/web/lib/zod/request-preferences.ts` (schema + inferred type).
  - Write `apps/web/lib/actions/request-preferences.ts` (`updateRequestPreferences`).
  - Write `apps/web/lib/actions/request-preferences.test.ts`.
  - Run `pnpm --filter web test -- request-preferences` and confirm green.

### 2. `listBuilderRequests` repo function + test

- **Task ID**: inbox-repo
- **Depends On**: none
- **Assigned To**: inbox-repo
- **Agent Type**: general-purpose
- **Parallel**: true
- **Owns Files**: `apps/web/lib/wanted/match-repo.ts`, `apps/web/lib/wanted/match-repo.test.ts`
- **Context**: Add `listBuilderRequests(client, builderId)` to
  `apps/web/lib/wanted/match-repo.ts` (do NOT touch other exports). **Mirror
  `listMatchesForBrief` (lines 97-113)** for query style and error handling. It must select
  matches where `candidate_builder_id = builderId` AND `candidate_type = 'BUILDER'` AND
  `candidate_action = 'PENDING'`, ordered by `agent_confidence` descending, joined to the
  brief's `id, title, content, budget_band, timeline, solution_types, expires_at, author_id`
  (the brief problem/end-state text lives inside the `content jsonb` column, typed
  `BriefContent` from `@hatch/shared` — there is NO `problem_statement` column; see the
  briefs-schema note in Relevant Files). Use a Supabase nested select, e.g.
  `.select('*, brief:briefs!matches_brief_id_fkey(id, title, content, budget_band, timeline, solution_types, expires_at, author_id)')`
  (the FK auto-name is `matches_brief_id_fkey`); if a nested select is awkward, fetch matches
  then batch-fetch briefs by id (mirror the batch-fetch pattern in
  `wanted/[id]/matches/page.tsx` lines 109-167). Read with the **session client** the caller
  passes (RLS policies "matches candidate builder read own" + "briefs matched builder read" —
  both SECURITY DEFINER, non-recursive after 0039 — scope visibility). Define and export a
  result type (e.g. `BuilderRequest`) with the match fields the inbox card needs (`id`,
  `agentConfidence`, `agentRationale`, `candidateAction`) plus the embedded brief summary
  (`briefId`, `title`, `content` as `BriefContent`, `budgetBand`, `timeline`, `solutionTypes`,
  `expiresAt`). **Test** (`match-repo.test.ts`, append — mirror existing cases): assert the
  query filters by builder + PENDING + BUILDER type and orders by confidence desc. Mock the
  Supabase client the same way the existing tests in this file do.
- **Actions**:
  - Add `listBuilderRequests` + its result type to `match-repo.ts`.
  - Append a test to `match-repo.test.ts`.
  - Run `pnpm --filter web test -- match-repo` and confirm green.

### 3. "Requests" nav entry + EN/ES message keys

- **Task ID**: nav-i18n
- **Depends On**: none
- **Assigned To**: nav-i18n
- **Agent Type**: general-purpose
- **Parallel**: true
- **Owns Files**: `apps/web/app/_components/shell.tsx`, `apps/web/messages/en.json`, `apps/web/messages/es.json`
- **Context**: This member is the **single writer** of the message files (prevents EN/ES merge
  conflicts) and adds the nav entry. **(A) Nav:** in `apps/web/app/_components/shell.tsx`, the
  sidebar renders `BROWSE_NAV` and `LIBRARY_NAV` arrays of `{ href: Route, key: NavKey, icon: string }`
  via `t(\`Nav.${n.key}\`)`. Add a "Requests" entry pointing to `/requests`(use a glyph
consistent with the mockup`#inbox`, which uses `↘`). The mockup groups it under an "Inbox"
label alongside Messages; place it sensibly in the existing nav structure (a new
`INBOX_NAV`/section or appended to an existing group — match the existing JSX shape and the
`NavKey`union type). The mockup also shows it in the Settings sidebar as "Request prefs" →
ensure`/settings/requests`is reachable (the settings nav is rendered where the other
settings links live — check whether settings has its own nav; if so add "Request prefs"
there). **Gating:** the route pages self-gate on the flag (404 when off), so the nav link
may always render; if the existing nav already conditionally hides items, follow that
convention. **(B) i18n:** add keys to BOTH`messages/en.json`and`messages/es.json`in
parity (the`i18n_key_parity.py`hook enforces this). Add`Shell.Nav.Requests`(EN
"Requests" / ES "Solicitudes") and, if a settings nav label is needed,`Shell.Nav.RequestPrefs`(EN "Request prefs" / ES "Preferencias de solicitudes"). Extend`Wanted.InboxRequests`(already has`pageTitle`,`emptyTitle`,`emptyCta`,`notificationBody`,
`decideLater`) with everything the inbox card needs: `pendingCount`("{count} pending"),`subtitle`, section labels (`problem`,`endState`,`constraints`,`whyYou`), buttons
(`connect`,`skip`), the SKIP reason options (`reasonNotMyArea`,`reasonNoCapacity`,
`reasonBudgetMismatch`,`reasonOther`), `confidencePct`("{pct}% match"), and a capacity
indicator string. Add a new`Wanted.RequestPrefs`namespace for the settings page:`pageTitle`, `receiveTitle`, `receiveLead`, `openToBriefs`, `openToBriefsHelp`,
`maxConcurrent`, `maxConcurrentHelp`, `rateBand`, `rateBandHelp`, the budget-band option
labels, `domainsTitle`, `domainsLead`, `capabilitiesTitle`, `capabilitiesLead`,
`addDomain`, `saving`/`save`/`saved`/`errorPrefix`. Add a `Wanted.BriefDetail`namespace for
the detail page:`pageTitle`, role labels, section labels (reuse `Wanted.labels`where
possible), and links to health/matches. Use the EXACT English copy from the mockup`#inbox`/`#settings` text where it exists. Provide natural neutral-Spanish (tú, not vos)
  translations.
- **Actions**:
  - Edit `shell.tsx` to add the Requests nav entry (and settings "Request prefs" link if applicable), extending the `NavKey` type.
  - Add all keys to `messages/en.json` and `messages/es.json` in parity.
  - Run `pnpm --filter web typecheck` to confirm the nav/type changes compile.

### 4. Prototype-port CSS for settings + capability editor

- **Task ID**: css-port
- **Depends On**: none
- **Assigned To**: ui-port
- **Agent Type**: ui-port-agent
- **Parallel**: true
- **Owns Files**: `apps/web/app/styles/wanted.css`
- **Context**: Add the verbatim CSS the `#settings` screen needs to
  `apps/web/app/styles/wanted.css`. The `card-request*` classes (for `#inbox`) are ALREADY in
  this file — do NOT duplicate them. The classes to ADD, copied **byte-for-byte** from the
  `<style>` block of `new/mockups.html` (search that file for each selector): `.settings-card`,
  `.settings-card h2`, `.settings-card .lead`, `.settings-row`, `.settings-row label`,
  `.settings-row label b`, `.settings-row label i`, `.toggle`, `.toggle.is-on`,
  `.capability-editor`, `.capability-editor-head`, `.edit-link`, `.capability-tags`,
  `.capability-tag`, `.capability-tag.is-removable` (and any nested/hover rules those
  selectors have in the mockup). Preserve the original property order, values, and CSS custom
  properties (`--surface`, `--border`, `--ax`, etc.) exactly. The `css_verbatim_validator.py`
  and `no_tailwind_in_prototype_port.py` hooks (inherited from the ui-port-agent frontmatter)
  enforce fidelity. Do not invent new tokens; if a selector references a variable, that
  variable is defined in `prototype-base.css` / the mockup `:root`.
- **Actions**:
  - Locate each selector in the `new/mockups.html` `<style>` block.
  - Append the verbatim rules to `wanted.css` under a clear comment header (e.g. `/* #settings — builder request preferences (Phase 3) */`).
  - Confirm no Tailwind utility classes were introduced.

### 5. Builder preferences page + form

- **Task ID**: builder-prefs-ui
- **Depends On**: prefs-logic, nav-i18n, css-port
- **Assigned To**: ui-port
- **Agent Type**: ui-port-agent
- **Parallel**: true (with builder-inbox-ui, brief-detail-ui)
- **Owns Files**: `apps/web/app/(shell)/settings/requests/page.tsx`, `apps/web/app/(shell)/settings/requests/requests-form.tsx`
- **Context**: Build `/settings/requests`. **`page.tsx`** (server component) mirrors the gate
  in `apps/web/app/(shell)/wanted/new/page.tsx` EXACTLY: `getUser()` →
  `redirect('/sign-in')`; narrow `result.profile.feature_flags` to
  `Record<string,unknown>|null`; `isWantedEnabled({ feature_flags }, process.env)` from
  `@hatch/shared` → `notFound()`; then read the profile's preference columns
  (`accepts_requests`, `request_capacity`, `request_domains`, `request_rate_band`,
  `inferred_capabilities`) from `result.profile` (already loaded by `getUser`) and pass them
  as initial values to `<RequestsForm initial={...} />`. Add `export const dynamic = 'force-dynamic'`.
  **`requests-form.tsx`** (`'use client'`) mirrors `settings/profile/profile-form.tsx`:
  `useForm({ resolver: zodResolver(RequestPreferencesInput), defaultValues: initial })`,
  `useTranslations('Wanted.RequestPrefs')`, `onSubmit` calls `updateRequestPreferences` from
  `@/lib/actions/request-preferences` and handles `{ ok }` (set `serverError` / `savedAt`).
  **UI = prototype-port of mockup `#settings`** (lines 1937-2025): three `settings-card`
  blocks. Card 1 "Receive requests": a `settings-row` with the `toggle` (bind
  `accepts_requests` — render the `<span class="toggle">`/`is-on` as a real button toggling the
  RHF field via `Controller`), a `settings-row` with the capacity `<input>` (bind
  `request_capacity`), a `settings-row` with the rate-band `<select>` (bind
  `request_rate_band`, options = the six `budget_band` values with i18n labels, plus an empty
  "any" option for null). Card 2 "Domains of interest": a `capability-editor` chip editor over
  `request_domains` (add via input + "+ Add" `edit-link`, remove via clicking a
  `capability-tag is-removable`) — implement with a `Controller` mirroring the gradient
  `Controller` in profile-form. Card 3 "Inferred capabilities": same chip-editor pattern over
  `inferred_capabilities` (manual edit for now — the "Re-run inference" link is inert/omitted
  this phase per spec). Use the `card-request`-style classNames verbatim; NO Tailwind. All
  visible strings via `t(...)`. Submit button mirrors profile-form's
  `className="btn btn-publish btn-lg"`.
- **Actions**:
  - Write `settings/requests/page.tsx` (gate + initial values).
  - Write `settings/requests/requests-form.tsx` (RHF + Zod + two chip editors + toggle).
  - Verify it compiles (`pnpm --filter web typecheck`) and renders behind the flag.

### 6. Builder inbox page + card + client

- **Task ID**: builder-inbox-ui
- **Depends On**: inbox-repo, nav-i18n, css-port
- **Assigned To**: ui-port
- **Agent Type**: ui-port-agent
- **Parallel**: true (with builder-prefs-ui, brief-detail-ui)
- **Owns Files**: `apps/web/app/(shell)/requests/page.tsx`, `apps/web/app/(shell)/requests/_components/request-card.tsx`, `apps/web/app/(shell)/requests/_components/requests-client.tsx`
- **Context**: Build `/requests` (builder inbox). **`page.tsx`** (server) mirrors the gate in
  `wanted/new/page.tsx` (getUser → redirect; isWantedEnabled → notFound). Then call
  `listBuilderRequests(session, profile.id)` from `@/lib/wanted/match-repo` using
  `createSupabaseServerClient()`; if `profile.accepts_requests === false`, render an empty
  state with a CTA to `/settings/requests` (use `Wanted.InboxRequests.emptyCta`); otherwise
  render `<RequestsClient initial={requests} capacity={profile.request_capacity} />`. Show the
  `Wanted.InboxRequests.pageTitle` heading with a pending count (use the `gal-head`/`gal-count`
  classes like `wanted/[id]/matches/page.tsx`). `export const dynamic = 'force-dynamic'`.
  **`request-card.tsx`** = verbatim prototype-port of the `card-request` markup from
  `new/mockups.html` `#inbox` (lines 1850-1892): header (avatar + handle + proposed/expires +
  `card-request-conf` "{pct}% match"), body sections (Problem / Desired end state /
  Constraints meta-pills / `card-request-rationale` "Why you?"). Read brief text from the
  embedded `content` (`BriefContent`): Problem from `content.problem`
  (trigger/affected/currentWorkaround), Desired end state from `content.desiredOutcome`
  (mustHaves/outOfScope), Constraints meta-pills from the brief's `budget_band` / `timeline` /
  `solution_types` columns (NO `problem_statement` column exists); the "Why you?" rationale is
  the match's `agentRationale`. Footer with
  **Decide later / Skip / Connect** buttons (`btn btn-ghost` / `btn btn-ghost-2` /
  `btn btn-primary`). All strings via `useTranslations('Wanted.InboxRequests')`. The
  `card-request*` CSS already exists in `wanted.css`. **`requests-client.tsx`** (`'use client'`)
  mirrors the optimistic pattern in `wanted/_components/match-deck.tsx` (lines 54-74): track
  acted ids in a `Set`, optimistically remove a card on action, then
  `fetch('/api/v1/matches/${id}/respond', { method:'POST', body: JSON.stringify({ action }) })`.
  CONNECT → `{ action:'CONNECT' }`. SKIP → optionally collect a reason
  (`not_my_area`/`no_capacity`/`budget_mismatch`/`other`) + note and send
  `{ action:'SKIP', feedback, feedbackNote }` (the `respond` route's body schema). "Decide
  later" just dismisses locally (no request). On CONNECT success show a sent-confirmation
  notice (mirror match-deck's `notice`). Render the `<RequestCard>` list and an empty state
  when none remain.
- **Actions**:
  - Write `requests/page.tsx` (gate + `listBuilderRequests` + accepts_requests CTA branch).
  - Write `requests/_components/request-card.tsx` (verbatim port).
  - Write `requests/_components/requests-client.tsx` (optimistic CONNECT/SKIP via respond route).
  - Verify typecheck + that the page renders behind the flag.

### 7. Private brief detail page

- **Task ID**: brief-detail-ui
- **Depends On**: nav-i18n, css-port
- **Assigned To**: ui-port
- **Agent Type**: ui-port-agent
- **Parallel**: true (with builder-prefs-ui, builder-inbox-ui)
- **Owns Files**: `apps/web/app/(shell)/wanted/[id]/page.tsx`
- **Context**: Create the base `/wanted/[id]` detail page (today only `/health` and `/matches`
  subroutes exist). Mirror `wanted/[id]/matches/page.tsx`: `params: Promise<{ id:string }>` →
  `const { id } = await params`; getUser → redirect; isWantedEnabled → notFound; then
  `getBrief(session, id)` from `@/lib/wanted/brief-repo` — RLS resolves visibility (author or
  matched builder; otherwise the row is invisible → `getBrief` returns null → `notFound()`).
  **Role-based render** (visibility matrix, Story I private subset): **Author** → full brief
  detail. Brief sections come from the `content jsonb` column (typed `BriefContent` from
  `@hatch/shared`; validate with `BriefContentSchema.safeParse(brief.content)` exactly as
  `apps/web/lib/wanted/embeddings/capability.ts:165` does): `content.problem`,
  `content.desiredOutcome` (mustHaves / outOfScope), `content.context`, `content.constraints`.
  Scalar metadata comes from typed columns (`title`, `technical_level`, `solution_types`,
  `budget_band`, `timeline`) — there is NO `problem_statement` column. Reuse `Wanted.labels`
  keys for section headings. Add lifecycle status (`status` column) +
  links to `/wanted/[id]/health` and `/wanted/[id]/matches`. **Matched builder** → brief
  detail without seeker PII beyond what the match exposes + a CTA back to their card in
  `/requests`. Determine role by comparing `brief.author_id` to `result.profile.id`. Reuse
  existing brief-section presentation components if present under `wanted/_components/` (e.g. a
  brief summary panel); otherwise render sections with the prototype `card-request-section`
  styling. `export const dynamic = 'force-dynamic'`. Use `getTranslations('Wanted.BriefDetail')`
  / `Wanted.labels`. NO Tailwind.
- **Actions**:
  - Write `wanted/[id]/page.tsx` (gate + getBrief + author/builder branches + 404 to others).
  - Verify typecheck and that author sees detail, third party gets 404.

### 8. UI screenshot validation (Playwright)

- **Task ID**: ui-screenshots
- **Depends On**: builder-prefs-ui, builder-inbox-ui, brief-detail-ui
- **Assigned To**: validator
- **Agent Type**: ui-validator
- **Parallel**: false
- **Owns Files**: none (screenshots to scratch)
- **Context**: Start the web dev server (`pnpm dev:web`, port 3000; ensure
  `NODE_OPTIONS=--max-http-header-size=131072` to avoid HTTP 431) with a session whose profile
  has `wanted_v1_enabled` (or `WANTED_V1_ENABLED=true` in env). Drive Playwright MCP to load
  `/settings/requests`, `/requests`, and a `/wanted/[id]` for an authored brief, in BOTH EN
  and ES locales. Capture screenshots and compare against the mockup `#settings` and `#inbox`
  sections in `new/mockups.html` at the section level (layout, card structure, button labels).
  Confirm: the toggle/capacity/rate-band controls render; chip editors add/remove; the inbox
  cards show Connect/Skip/Decide-later; flag-off yields 404. Report any visual drift from the
  mockup.
- **Actions**:
  - Launch dev server with the flag enabled.
  - Screenshot the three screens in EN + ES.
  - Verify section-level fidelity vs. the mockup; report pass/fail with screenshots.

### 9. Final Validation

- **Task ID**: validate-all
- **Depends On**: prefs-logic, inbox-repo, nav-i18n, css-port, builder-prefs-ui, builder-inbox-ui, brief-detail-ui, ui-screenshots
- **Assigned To**: validator
- **Agent Type**: ui-validator
- **Parallel**: false
- **Context**: Run the full command gate and verify every acceptance criterion. Passing =
  every command exits 0 and the acceptance criteria below hold. If a Wanted vitest suite needs
  env (e.g. integration tests guarded by Supabase env), run the unit suites that don't and
  note any env-guarded skips.
- **Actions**:
  - Run all commands in the Validation Commands section.
  - Verify every acceptance criterion is met.
  - Report pass/fail status.

### 10. Expert self-improvement (Next.js)

- **Task ID**: expert-selfimprove
- **Depends On**: validate-all
- **Assigned To**: validator
- **Agent Type**: ui-validator
- **Parallel**: false
- **Context**: The primary domain modified is Next.js (App Router pages, server components,
  server actions, RHF+Zod forms, the feature-flag gate pattern). After the feature is green,
  the user should run `/experts:nextjs:self-improve` to capture any new patterns
  (settings sub-pages, builder-side gating, chip-editor `Controller`) into the nextjs
  expertise.yaml. **NOTE per project rule: the assistant does NOT auto-run `.claude/commands/*`
  — this task is a reminder for the USER to run `/experts:nextjs:self-improve` (and
  optionally `/experts:supabase:self-improve` for the RLS read patterns).**
- **Actions**:
  - Surface to the user the recommendation to run `/experts:nextjs:self-improve`.
  - (User-run, not agent-run.)

## Testing Strategy

### Unit Tests

- `request-preferences` schema: capacity bounds (0–20), array item length (≤64) and count
  (≤32), enum membership, nullable rate band, full valid payload.
- `listBuilderRequests`: filters by `candidate_builder_id` + `candidate_type='BUILDER'` +
  `candidate_action='PENDING'`; orders by `agent_confidence` desc; joins brief title/problem.
- Existing match-repo / wanted suites must stay green (no regressions).

### Edge Cases

- `accepts_requests=false` → `/requests` shows the opt-in CTA, not an empty list.
- `request_capacity=0` with `accepts_requests=true` → builder is effectively paused (the
  matcher already treats capacity; the inbox still renders existing PENDING matches).
- Empty `request_domains` / `inferred_capabilities` arrays → chip editors render empty, save ok.
- Brief detail: author sees full; matched builder sees detail; unrelated authed user → 404;
  anonymous → redirect to sign-in then 404 (public view deferred to Phase 4).
- Flag off (`wanted_v1_enabled` false and `WANTED_V1_ENABLED` unset) → all three routes 404.
- SKIP with no reason selected → valid (feedback optional in the respond route schema).
- i18n: every new string present in BOTH en.json and es.json (parity hook enforces).

## Acceptance Criteria

- A builder can open `/settings/requests`, toggle `accepts_requests`, set capacity (0–20),
  edit `request_domains` and `inferred_capabilities` chips, pick a `request_rate_band`, save —
  and the values persist (server action, own-row RLS), surviving reload.
- With an activated builder and a compatible brief, the Matcher Phase B includes the builder
  and the match appears in `/requests`; CONNECT calls the existing respond route (opens a
  thread + notifies both sides on mutual connect); SKIP records `candidate_feedback`.
- `/wanted/[id]` shows full detail to the author and detail to the matched builder; returns
  404 to any other authenticated user.
- A "Requests" entry appears in the shell nav and routes to `/requests`; "Request prefs" is
  reachable for `/settings/requests`.
- All three surfaces are gated by `wanted_v1_enabled` (404 when off) and fully localized
  (EN + ES, parity green).
- No new migrations. The feature is inert when the flag is off.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass; new vitest suites green; existing
  suites show zero regressions.

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm --filter web test -- request-preferences` — preferences schema/action unit tests pass.
- `pnpm --filter web test -- match-repo` — `listBuilderRequests` + existing match-repo tests pass.
- `pnpm --filter web test` — full web vitest suite, zero regressions (note any env-guarded skips).
- `pnpm typecheck` — TypeScript check across all workspaces, zero errors.
- `pnpm lint` — ESLint across all workspaces, zero errors.
- `pnpm build` — production build compiles (validates the new App Router routes).
- Playwright (via ui-validator): screenshots of `/settings/requests`, `/requests`,
  `/wanted/[id]` in EN + ES behind the flag; flag-off → 404. (Task 8.)

## Notes

- **No new libraries.** RHF, Zod, next-intl, Supabase clients are all already in the web app.
- **No new migrations.** All columns exist (0034 builder fields, 0036 match feedback); RLS is
  healthy after 0039. `rls_enabled_validator` / `migration_validator` are not engaged.
- **Single-writer for messages.** `messages/en.json` and `es.json` are owned solely by the
  `nav-i18n` task so the EN/ES parity hook never races two writers. UI tasks reference keys
  the nav-i18n task creates → they depend on it.
- **ui-port-agent pins opus + inherits the css_verbatim/no_tailwind/no_data_js hooks** via its
  frontmatter, so the prototype-port discipline is enforced automatically on every Write/Edit.
- **Deferred to Phase 4 (out of scope here):** public brief gallery + listing + cron fallback;
  REST `PATCH /users/me/request-preferences` + MCP tool parity; auto-inference of
  `inferred_capabilities` from the builder's apps (manual editing only this phase); the
  refiner "thinking" typing indicator.
- **Assistant constraint:** per project rule, the assistant never auto-runs `.claude/commands/*`
  (including `/experts:*:self-improve`); Task 10 is a reminder for the user to run them.
- **Source spec:** `docs/superpowers/specs/2026-06-04-wanted-phase3-builder-side-design.md`
  (brainstorm-approved). This plan operationalizes its three in-scope pieces (task-14/15/17).

## Expert Context

Experts consulted while planning (read `.claude/commands/experts/<domain>/expertise.yaml`):

- **nextjs** — App Router server-component gate pattern, `params: Promise<>` await convention
  (Next 15), server actions with `revalidatePath`, `'use client'` boundaries. Reflected in the
  gate code embedded in tasks 5/6/7 (mirrors `wanted/new/page.tsx`).
- **supabase** — session vs admin client choice (preferences = session client / own-row RLS;
  match reads = session client scoped by the 0039 SECURITY DEFINER policies). Reflected in
  tasks 1/2/6.
- **frontend-state** — RHF + `Controller` for non-text inputs (the chip editors and toggle
  mirror the gradient radiogroup `Controller` in `profile-form.tsx`). Reflected in task 5.
- **testing** — vitest schema-only tests (no live DB) mirroring existing `lib/wanted/*.test.ts`
  and `lib/actions` test conventions. Reflected in tasks 1/2.
- Post-implementation: the user runs `/experts:nextjs:self-improve` (and optionally
  `/experts:supabase:self-improve`) — Task 10.
  </content>
  </invoke>

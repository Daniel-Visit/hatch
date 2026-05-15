# Feature: Social interactions (likes / saves / follows / comments) + Publish flow (Pair 2 = Phases 4 + 5)

## Metadata

issue_number: `2`
adw_id: `manual`
issue_json: `Feature`

## Feature Description

Layer the full social-interaction surface and the publish flow on top of the read-only gallery shipped in Pair 1 (Phases 2 + 3). Two roadmap phases fused into one spec/PR (same pattern Pair 1 used for Phases 2 + 3):

- **Phase 4 — Social**: `likes`, `saves`, `follows`, `comments` (1 level of replies max), `comment_likes`, denormalized counters via triggers, RLS per SPEC §5.2, server actions with `useOptimistic` UI, anonymous-click → redirect-to-sign-in gating.
- **Phase 5 — Publish**: Supabase Storage bucket for cover images, signed-upload-URL flow, `/publish` page (client form, RHF + Zod, live preview), `publishApp` server action with slug auto-generation.

**Hard, non-negotiable rule** (per `feedback_prototype_is_spec` memory + `.claude/rules/prototype-port-exception.md`): every UI file ported in this batch must match `prototype/apps-gallery/detail.jsx` (social bits) and `prototype/apps-gallery/publish.jsx` **byte-for-byte where possible** — same `className` strings, same JSX structure, same inline `style={{}}` props, same icon names, same English copy. "Similar" is a regression. Zero design creativity, zero Tailwind translation, zero shadcn/Radix substitutions. Pixel-perfect screenshot diff against the standalone prototype HTML is part of acceptance.

## User Story

As a **signed-in builder browsing Hatch**,
I want to **like / save / comment on apps, follow authors, and publish my own app from a fill-the-template form with live preview**,
So that **I can participate in the community and ship my project in 90 seconds**.

As an **anonymous visitor**,
I want to **see all the social affordances (heart, comments count, follow button) but be routed to sign-in when I click them**,
So that **I get a frictionless invite to join without breaking the gallery experience**.

## Problem Statement

After Pair 1 merges, the gallery is read-only: every heart count, every comment count, every "Follow" pill is rendered from seed data but has no real behavior. There is no way to publish a new app — the topbar's "Publish" link points nowhere. To reach feature parity with the prototype's interactive screens (`detail.jsx` ActionBar + Comments, `publish.jsx` full form with live preview), we need (a) the social schema + RLS + counter triggers, (b) server actions that wire the UI to Supabase, (c) the publish flow including Storage uploads, and (d) the same byte-for-byte port discipline that Pair 1 used.

## Solution Statement

1. **Migrations** (4 new files in `packages/db/migrations/`, applied via Supabase MCP `apply_migration` tool — never CLI):
   - `0009_social.sql` — `likes`, `saves`, `follows`, `comments`, `comment_likes` tables; `comments_check_depth` trigger (max 1 level of nesting per SPEC §4.4); counter triggers `bump_likes_count`, `bump_saves_count`, `bump_comments_count` on `public.apps`; `bump_comment_likes_count` on `public.comments`.
   - `0010_social_rls.sql` — all RLS policies copied verbatim from SPEC §5.2 (lines 699–735): `likes readable / insert own / delete own`, `saves readable own / insert own / delete own`, `follows readable / insert own / delete own`, `comments readable / insert own / update own`, `comment_likes readable / insert own / delete own`.
   - `0011_social_seed.sql` — seed `likes`, `comments`, `comment_likes`, `follows` rows that reference the 12 seeded apps + 10 seeded authors from Pair 1's `0008_apps_seed.sql`. Without seed data the detail screen's Comments section ships empty and the screenshot diff fails.
   - `0012_storage_buckets.sql` — create `app-covers` Storage bucket (public read, authenticated insert, max 2 MB, `image/*` mime restriction) plus RLS policies on `storage.objects` for that bucket.
2. **Regenerate** `apps/web/lib/supabase/types.ts` after migrations apply (via Supabase MCP `generate_typescript_types`).
3. **Zod schemas** in `apps/web/lib/zod/`:
   - `social.ts` — `LikeToggleInput`, `SaveToggleInput`, `FollowToggleInput`, `CommentCreateInput` (body 1–2000), `CommentLikeToggleInput`, `CommentDeleteInput`.
   - `publish.ts` — `PublishAppInput` matching prototype constraints (title 1–32, tagline 1–90, description 0–10000, link valid URL, category_id FK, tags max 6, art_kind enum of 12 prototype values, accent enum of 8 prototype hex colors).
4. **Server actions** in `apps/web/lib/actions/` — all follow SPEC §7.4 contract (`'use server'`, Zod parse, `requireUser()`, return `{ ok, data?, error? }`, `revalidatePath` / `revalidateTag`):
   - `like.ts` → `toggleLike({ appId })`
   - `save.ts` → `toggleSave({ appId })`
   - `follow.ts` → `toggleFollow({ followeeId })`
   - `comment.ts` → `postComment`, `softDeleteComment`, `toggleCommentLike`
   - `publish.ts` → `getCoverUploadUrl` (returns signed upload URL + final object path) and `publishApp` (insert into `apps` with slug auto-generation, return redirect path)
5. **Component ports** in `apps/web/app/_components/` (subject to prototype-port-exception — CSS classes verbatim, inline styles where present, NO Tailwind):
   - `action-bar.tsx` — port of `ActionBar` from `detail.jsx` lines 35–66. Client component. Props: `appId`, `initialLiked`, `initialLikesCount`, `initialSaved`, `initialSavesCount`, `commentCount`, `remixesCount`, `isAuthenticated`. Wraps `useOptimistic`. Anonymous click → `router.push('/sign-in?next=/a/[slug]')`.
   - `comments.tsx` — port of `Comments` from `detail.jsx` lines 102–149. Client component (textarea state). Props: `appId`, `initialComments`, `isAuthenticated`, `viewerHandle`.
   - `comment-item.tsx` — port of `CommentItem` from `detail.jsx` lines 68–100. Recursive (1 level). Optimistic like.
   - `publish-screen.tsx` — port of `PublishScreen` from `publish.jsx` lines 8–221. Client component. Wraps RHF + Zod resolver. Live preview pane uses Pair 1's `AppCard` variants. The "Or upload your own PNG" link is wired to a real Supabase Storage signed-URL flow.
6. **Pages**:
   - `apps/web/app/a/[slug]/page.tsx` — **modify** Pair 1's detail page to mount `<ActionBar>` + `<Comments>` below the description, with initial data fetched server-side (likes/saves toggles for current viewer, comments list with author profiles joined, current viewer's like status per comment).
   - `apps/web/app/u/[handle]/page.tsx` — **modify** Pair 1's profile page to wire the "Liked" tab to a real query: `select apps.* from likes join apps on likes.app_id = apps.id where likes.user_id = profile.id order by likes.created_at desc`. Also wire the "Follow" pill to `toggleFollow`.
   - `apps/web/app/(auth)/publish/page.tsx` — **new**. Server component shell that calls `requireUser()`, fetches `categories` + viewer profile, then mounts `<PublishScreen>`. Gated by the existing middleware route guard.
7. **Tests**: Playwright screenshot comparison (headed mode, Chromium) — open the standalone prototype HTML and the dev server side-by-side at `/a/pixel-sushi`, `/publish`, `/u/mila` (tab=liked); capture full-page screenshots; pixel-diff at the section level (`.action-bar`, `.comments`, `.publish-form`, `.publish-preview`). Failure threshold = 0 pixels different in any of those regions.
8. **Validation hooks**: reuse existing `migration_validator.py`, `css_verbatim_validator.py`, `no_tailwind_in_prototype_port.py`, `no_data_js_import.py`; add one new `rls_enabled_validator.py` that blocks any new migration that creates a table without `alter table ... enable row level security`.

## Relevant Files

### Reference (DO NOT modify — these are the spec)

Prototype source files — every port task must `diff` its output against the matching prototype file:

- `prototype/apps-gallery/detail.jsx` — lines 1–149 contain `ActionBar`, `CommentItem`, `Comments`. Lines 5–33 contain `SEED_COMMENTS` (used to model the seed migration). Lines 151–379 contain `DetailScreen` (already ported by Pair 1 — this batch only adds the social parts to it).
- `prototype/apps-gallery/publish.jsx` — entire file (223 lines) is the spec for `<PublishScreen>`. Contains `ART_OPTIONS` and `ACCENT_OPTIONS` constants that drive the Zod enums in `lib/zod/publish.ts`.
- `prototype/apps-gallery/styles-screens.css` — already copied to `apps/web/app/styles/prototype-screens.css` by Pair 1. Contains all `.action-bar`, `.comment*`, `.publish*`, `.psec*`, `.art-picker`, `.color-row`, `.tag-input` styles. **Do not modify** during Pair 2; the CSS-verbatim validator will block.
- `prototype/apps-gallery/data.js` — `HATCH_USERS` map (lines 1–84). Used as reference for seed migration only; `no_data_js_import.py` validator blocks any TS file from importing it.
- `prototype/apps-gallery/Hatch - Apps Gallery.html` — bundled standalone reference. Playwright validation opens this in one tab and the dev server in another.

Authoritative spec sources:

- `SPEC.md` §4.4 (lines 409–475) — social schema source of truth.
- `SPEC.md` §4.5 (lines 477–497) — counter trigger pattern.
- `SPEC.md` §5.2 (lines 699–735) — RLS policies for likes/saves/follows/comments/comment_likes.
- `SPEC.md` §5.3 (lines 808–818) — RLS testing checklist (covers Pair 2 tables).
- `SPEC.md` §6.3 (lines 857–859) — middleware gating for `/publish`.
- `SPEC.md` §7.1 (line 878) — `/publish` is Client + Server Action.
- `SPEC.md` §7.4 (lines 896–947) — server action contract; the `toggleLike` example on lines 920–946 is exactly the shape this plan follows.
- `SPEC.md` §7.5 (lines 949–951) — optimistic UI rule.
- `SPEC.md` §7.6 (lines 953–957) — RHF + Zod for `/publish`.
- `SPEC.md` §16 Phase 4 (lines 1638–1646), Phase 5 (lines 1648–1656) — phase checklists.

### Existing files to read and respect (read-only for most tasks)

- `apps/web/app/_components/cards.tsx` — Pair 1's ported card variants. Exports `Avatar`, `CategoryBadge`, `Stat`, `fmtNum`, `ClassicCard`, `StickerCard`, `DarkCard`, `MonoCard`, `BentoCard`. `action-bar.tsx`, `comments.tsx`, `comment-item.tsx`, `publish-screen.tsx` all import `Avatar` + `fmtNum` from here.
- `apps/web/app/_components/icons.tsx` — Pair 1's icon registry. The `<Icon name="remix" size={16} />` reference in `ActionBar` resolves through this.
- `apps/web/app/_components/app-art.tsx` — Used by `publish-screen.tsx` to render the procedural cover preview for each `art` option in the art-picker grid.
- `apps/web/app/_components/markdown.tsx` — Pair 1's react-markdown wrapper. Used by `comment-item.tsx` to render comment bodies (`description` field).
- `apps/web/app/styles/prototype-base.css`, `prototype-cards.css`, `prototype-screens.css`, `prototype-contact.css` — Pair 1's verbatim CSS copies. All `.action-bar`, `.comment*`, `.publish*` styles already live here. **Read-only** for Pair 2.
- `apps/web/app/layout.tsx` — Pair 1's root layout. Already imports prototype CSS + mounts `<Shell>`. **Read-only** for Pair 2.
- `apps/web/lib/supabase/server.ts` — `createSupabaseServerClient()` for RSC reads + server actions.
- `apps/web/lib/supabase/admin.ts` — service-role client. Used in `publishApp` for the signed-upload-URL flow only.
- `apps/web/lib/auth.ts` — `getUser()` and `requireUser()` helpers (Phase 1).
- `apps/web/lib/zod/profile.ts` — Phase 1 reference for how Zod schemas + server actions look in this codebase.
- `apps/web/lib/actions/profile.ts` — Phase 1 reference for server-action shape (`'use server'`, `requireUser()`, `{ ok, data | error }` return).
- `apps/web/middleware.ts` — Already gates `/publish` per SPEC §6.3. Read-only for Pair 2 (the route already matches the protected matcher; no change needed).
- `apps/web/next.config.ts` — `typedRoutes: true`. Dynamic hrefs in ported components must cast to `Route` from `'next'` (Pair 1 precedent).
- `apps/web/app/a/[slug]/page.tsx` — Pair 1's app detail page. **Modify** in Task 14 to mount social components.
- `apps/web/app/u/[handle]/page.tsx` — Pair 1's profile page. **Modify** in Task 16 to wire "Liked" tab + Follow pill.
- `packages/db/migrations/0001_init.sql` through `0008_apps_seed.sql` — Phase 1 + Pair 1 migrations. The new 0009–0012 must coexist; Pair 2 assumes 0008 (apps seed with 10 authors + 12 apps) has applied successfully before Pair 2 starts.
- `CLAUDE.md` + `.claude/rules/prototype-port-exception.md` + `.claude/rules/context7.md` + `.claude/rules/backend-python.md` — project hard rules.

### New Files

Migrations (in apply order):

- `packages/db/migrations/0009_social.sql` — five tables (`likes`, `saves`, `follows`, `comments`, `comment_likes`) + `comments_check_depth` trigger + four counter trigger functions + their `after insert or delete` triggers.
- `packages/db/migrations/0010_social_rls.sql` — RLS enable + 14 policies copied verbatim from SPEC §5.2 lines 699–735.
- `packages/db/migrations/0011_social_seed.sql` — seed: ~40 likes spread across the 12 seeded apps, ~20 comments (some with replies, following the SEED_COMMENTS shape in `detail.jsx`), ~10 comment_likes, ~15 follows between the 10 seeded authors.
- `packages/db/migrations/0012_storage_buckets.sql` — `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('app-covers', 'app-covers', true, 2097152, array['image/png','image/jpeg','image/webp'])` + RLS policies on `storage.objects` for that bucket: anyone can SELECT, authenticated INSERT (with check on bucket_id), owner UPDATE/DELETE.

Zod schemas:

- `apps/web/lib/zod/social.ts` — exports `LikeToggleInput`, `SaveToggleInput`, `FollowToggleInput`, `CommentCreateInput`, `CommentDeleteInput`, `CommentLikeToggleInput` schemas + inferred TS types.
- `apps/web/lib/zod/publish.ts` — exports `PublishAppInput`, `CoverUploadInput`, `ArtKindEnum`, `AccentColorEnum`.

Server actions:

- `apps/web/lib/actions/like.ts` — `toggleLike({ appId })`. Reads existing row → DELETE or INSERT. `revalidatePath('/a/${slug}')` after.
- `apps/web/lib/actions/save.ts` — `toggleSave({ appId })`. Same shape as `like`.
- `apps/web/lib/actions/follow.ts` — `toggleFollow({ followeeId })`. Same shape, blocks self-follow (`check (follower_id <> followee_id)` in DB).
- `apps/web/lib/actions/comment.ts` — `postComment({ appId, body, parentId? })`, `softDeleteComment({ commentId })` (sets `is_deleted = true`, body stays for audit), `toggleCommentLike({ commentId })`.
- `apps/web/lib/actions/publish.ts` — `getCoverUploadUrl({ appId? })` (returns `{ signedUrl, finalPath }` for the browser to PUT to), `publishApp(input)` (Zod-validated insert into `apps` + slug auto-gen via SQL function from Pair 1's `0006_apps.sql`).

Components (TSX ports — verbatim, NO Tailwind, inline styles preserved):

- `apps/web/app/_components/action-bar.tsx` — `'use client'`. Port of `detail.jsx` lines 35–66.
- `apps/web/app/_components/comment-item.tsx` — `'use client'`. Port of `detail.jsx` lines 68–100.
- `apps/web/app/_components/comments.tsx` — `'use client'`. Port of `detail.jsx` lines 102–149.
- `apps/web/app/_components/publish-screen.tsx` — `'use client'`. Port of entire `publish.jsx` (223 lines) wrapped in RHF.

Page:

- `apps/web/app/(auth)/publish/page.tsx` — RSC. Calls `requireUser()`, loads categories + viewer profile, mounts `<PublishScreen>`.

Validation hook (custom):

- `.claude/hooks/validators/rls_enabled_validator.py` — PostToolUse Write|Edit on `packages/db/migrations/*.sql`. Parses the SQL; for every `create table public.X` statement, verifies that `alter table public.X enable row level security` appears in either the same file or in an `_rls.sql` file with the next sequential number. Blocks with a clear error message if missing.

### Conditional documentation

None of the entries in `.claude/commands/conditional_docs.md` apply to this feature (the listed docs cover the agentic-layer tools — eval, telemetry, formal-mode, MCP — not the Hatch product surface). No `ai_docs/` scrape needed.

## Implementation Plan

### Blocker Check (runs FIRST in `/tac:implement`, before any task is dispatched)

This plan assumes Pair 1 (Phases 2 + 3) has shipped. If it has not, every Phase 2 task that modifies a Pair 1 page will silently overwrite half-finished work in another session. `/tac:implement` MUST verify the following before dispatching ANY task — fail fast with a clear error if any check fails:

```bash
# 1. Pair 1 pages must exist on disk
test -f apps/web/app/a/[slug]/page.tsx          || { echo "BLOCKED: Pair 1 detail page missing"; exit 1; }
test -f apps/web/app/u/[handle]/page.tsx        || { echo "BLOCKED: Pair 1 profile page missing"; exit 1; }
test -f apps/web/app/c/[category]/page.tsx      || { echo "BLOCKED: Pair 1 category page missing"; exit 1; }

# 2. Pair 1 components must exist on disk (action-bar / comments don't yet — that's Pair 2 — but Avatar/fmtNum/Stat live in cards.tsx)
test -f apps/web/app/_components/cards.tsx       || { echo "BLOCKED: Pair 1 cards.tsx missing"; exit 1; }
test -f apps/web/app/_components/markdown.tsx    || { echo "BLOCKED: Pair 1 markdown.tsx missing"; exit 1; }
test -f apps/web/app/_components/app-art.tsx     || { echo "BLOCKED: Pair 1 app-art.tsx missing"; exit 1; }
test -f apps/web/app/_components/icons.tsx       || { echo "BLOCKED: Pair 1 icons.tsx missing"; exit 1; }
test -f apps/web/app/_components/shell.tsx       || { echo "BLOCKED: Pair 1 shell.tsx missing"; exit 1; }

# 3. Pair 1's apps seed migration must be present
test -f packages/db/migrations/0008_apps_seed.sql || { echo "BLOCKED: Pair 1 seed migration missing"; exit 1; }

# 4. Cloud project must reflect the apps schema (migrations 0006/0007 applied)
#    Run via mcp__supabase__list_tables and assert 'apps' is in public schema.

# 5. Pnpm typecheck of the current tree must already pass — Pair 1's work shouldn't be left half-broken
pnpm typecheck >/dev/null 2>&1 || { echo "BLOCKED: typecheck fails on Pair 1's state"; exit 1; }
```

If any check fails, abort `/tac:implement` and report which Pair 1 artifact is missing. Do not proceed with partial state.

### Phase 1 — Foundation (parallel-safe)

Everything that does NOT touch the live Supabase project or the existing Pair 1 pages:

- Write the four migration SQL files on disk (no `apply_migration` yet).
- Write Zod schemas for social + publish (pure TS, no DB dep).
- Port the four UI files verbatim from prototype (pure TSX, no DB dep — props are typed, but implementations don't yet call server actions).
- Create the custom validator script.

These tasks have no inter-dependencies and run as one parallel group.

### Phase 2 — Core implementation (sequential after Phase 1)

- Apply migrations 0009 → 0010 → 0011 → 0012 via Supabase MCP `apply_migration` (one call per file, in numeric order).
- Regenerate `apps/web/lib/supabase/types.ts` via Supabase MCP `generate_typescript_types`.
- Write the five server actions (each imports `Database` type, so this step blocks on the regen).
- Wire `app/a/[slug]/page.tsx` to mount `<ActionBar>` + `<Comments>` with server-fetched initial data.
- Create `app/(auth)/publish/page.tsx`.
- Wire `app/u/[handle]/page.tsx` "Liked" tab + Follow pill.

### Phase 3 — Integration & validation

- Run Playwright headed: open `prototype/apps-gallery/Hatch - Apps Gallery.html` and `http://localhost:3000` side-by-side; capture screenshots of `/a/pixel-sushi` (with focus on `.action-bar` + `.comments`), `/publish` (with focus on `.publish-grid`), `/u/mila?tab=liked`. Diff at section level.
- Run `pnpm typecheck && pnpm lint && pnpm build` — must all pass.
- Run RLS testing checklist from SPEC §5.3 inside Supabase SQL editor for the new tables.
- Trigger `/experts:supabase:self-improve` and `/experts:nextjs:self-improve` so the expertise YAML files reflect what was actually shipped.

## Expert Context

Consulted experts (`.claude/commands/experts/*/expertise.yaml`):

- **supabase** — confirmed: migrations go through Supabase MCP `apply_migration` tool, NEVER `supabase db push` or CLI. Migrations directory `packages/db/migrations/`, NNNN naming, sequential. Type-regen via Supabase MCP `generate_typescript_types`. Project ref `vcbdtjjkkwryvmqbflah`. Service-role client `apps/web/lib/supabase/admin.ts` for the signed-upload-URL flow only.
- **nextjs** — confirmed: Server Components by default; `'use client'` only for hooks/state/event handlers. Auth-gated routes live under `apps/web/app/(auth)/` (route group). Server actions in `apps/web/lib/actions/` follow `'use server'` + Zod + `requireUser()` + `{ ok, data | error }` return shape. Forms use React Hook Form + `@hookform/resolvers/zod`. `useOptimistic` for likes/saves/comment-likes.
- **database** — confirmed: existing apps table columns (id, slug, author_id, title, tagline, description, link, category_id, cover_url, art_kind, accent, tags, is_published, published_at, views_count, likes_count, saves_count, comments_count, hue, bg, is_featured, remixes_count). Counter columns already exist — triggers in `0009_social.sql` just need to keep them current. Slug auto-gen function (`generate_app_slug`) already shipped in `0006_apps.sql`; `publishApp` reuses it.
- **testing** — Playwright MCP available; pattern is launch headed Chromium, navigate, snapshot, screenshot, compare. No existing test files for this app yet — Pair 2 establishes the first ones under `apps/web/tests/playwright/`.

## Team Orchestration

This plan uses Claude Code's **agent teams** for coordinated parallel execution. The executor operates as the **team lead in delegate mode** — orchestrating teammates without writing code directly.

### Team Setup

Executed via `/tac:implement` (subagent-driven development): fresh subagent per task, two-stage review (spec compliance + code quality), status reporting (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT).

To execute: `/tac:implement specs/issue-2-adw-manual-sdlc_planner-social-and-publish.md`

### Team Members

> All team-specific agent definitions live in `.claude/agents/team/`. They were created as part of this batch to ensure the capabilities each task needs are actually present in the agent's `tools:` frontmatter (the global `build-agent.md` lacks Supabase MCP and the global `playwright-validator.md` lacks Bash/Write — those gaps would have hard-failed at runtime).

- **migration-builder**
  - Role: Write the four SQL migrations, apply them via Supabase MCP, regenerate the `Database` TS types, run §5.3 RLS checks.
  - Agent Type: `db-agent` (at `.claude/agents/team/db-agent.md`)
  - Model: sonnet
  - Owns Files: `packages/db/migrations/0009_social.sql`, `packages/db/migrations/0010_social_rls.sql`, `packages/db/migrations/0011_social_seed.sql`, `packages/db/migrations/0012_storage_buckets.sql`, `apps/web/lib/supabase/types.ts` (regenerated, not hand-edited)
  - Required Capabilities: Write/Read/Edit/Grep/Glob/Bash for files + commands; Supabase MCP (`mcp__supabase__apply_migration`, `mcp__supabase__generate_typescript_types`, `mcp__supabase__list_tables`, `mcp__supabase__list_migrations`, `mcp__supabase__execute_sql`). All present in `db-agent.md` `tools:` frontmatter.
  - Plan Approval: false
  - Hooks (baked into `db-agent.md` frontmatter — fire on every Write/Edit to `*.sql`):
    - PostToolUse `Write|Edit`: `.claude/hooks/validators/migration_validator.py`
    - PostToolUse `Write|Edit`: `.claude/hooks/validators/rls_enabled_validator.py`

- **backend-builder**
  - Role: Write Zod schemas + server actions for all 5 social + publish flows.
  - Agent Type: `build-agent` (global, unchanged)
  - Model: sonnet
  - Owns Files: `apps/web/lib/zod/social.ts`, `apps/web/lib/zod/publish.ts`, `apps/web/lib/actions/like.ts`, `apps/web/lib/actions/save.ts`, `apps/web/lib/actions/follow.ts`, `apps/web/lib/actions/comment.ts`, `apps/web/lib/actions/publish.ts`
  - Required Capabilities: Write/Read/Edit/Grep/Glob/Bash. All present in `build-agent.md` `tools:` frontmatter.
  - Plan Approval: false
  - Hooks: defaults from `build-agent.md` (ruff_validator + ty_validator are no-ops on TS files).

- **frontend-port-builder**
  - Role: Verbatim port of the social + publish JSX, plus wiring the three affected pages (`/a/[slug]`, `/u/[handle]`, `/(auth)/publish`).
  - Agent Type: `ui-port-agent` (at `.claude/agents/team/ui-port-agent.md`)
  - Model: opus (declared in `ui-port-agent.md` frontmatter)
  - Owns Files: `apps/web/app/_components/action-bar.tsx`, `apps/web/app/_components/comment-item.tsx`, `apps/web/app/_components/comments.tsx`, `apps/web/app/_components/publish-screen.tsx`, `apps/web/app/(auth)/publish/page.tsx`, `apps/web/app/a/[slug]/page.tsx` (modify), `apps/web/app/u/[handle]/page.tsx` (modify), `apps/web/middleware.ts` (modify — see Task 0c)
  - Required Capabilities: Write/Read/Edit/MultiEdit/Grep/Glob/Bash. All present in `ui-port-agent.md` `tools:` frontmatter.
  - Plan Approval: true for `publish-screen.tsx`, `app/a/[slug]/page.tsx`, and the middleware edit — these are the three highest-risk files.
  - Hooks (baked into `ui-port-agent.md` frontmatter — fire on every Write/Edit):
    - PostToolUse `Write|Edit`: `.claude/hooks/validators/css_verbatim_validator.py`
    - PostToolUse `Write|Edit`: `.claude/hooks/validators/no_tailwind_in_prototype_port.py`
    - PostToolUse `Write|Edit`: `.claude/hooks/validators/no_data_js_import.py`

- **setup-builder**
  - Role: Create the one custom validator script needed for this batch.
  - Agent Type: `build-agent` (global)
  - Model: sonnet
  - Owns Files: `.claude/hooks/validators/rls_enabled_validator.py`
  - Required Capabilities: Write + Bash. Present in `build-agent.md`.
  - Plan Approval: false
  - Hooks: defaults from `build-agent.md`.

- **ui-validator**
  - Role: Run Playwright screenshot diff against the standalone prototype HTML, then run typecheck/lint/build, then verify RLS checklist via Supabase MCP.
  - Agent Type: `ui-validator` (at `.claude/agents/team/ui-validator.md`)
  - Model: sonnet
  - Owns Files: `apps/web/tests/playwright/pair2-social-publish.spec.ts` (new), `apps/web/tests/playwright/screenshots/` (new directory)
  - Required Capabilities: all `mcp__playwright__*` tools + `mcp__supabase__execute_sql` + `Write`/`Read`/`Edit`/`Bash`. All present in `ui-validator.md` `tools:` frontmatter.
  - Plan Approval: false
  - Hooks: none.

## Validation Hooks

### Available Validators (reused)

Existing validators in `.claude/hooks/validators/`:

- `migration_validator.py` — Validates Supabase SQL migration files (PostToolUse on Write|Edit for `.sql` files). Already wired by Pair 1 for migration files.
- `css_verbatim_validator.py` — Blocks edits to `apps/web/app/styles/prototype-*.css` files (CSS is locked after Pair 1 copied it verbatim).
- `no_tailwind_in_prototype_port.py` — Blocks Tailwind utility classes in `apps/web/app/_components/*.tsx` files. Critical for the verbatim-port discipline.
- `no_data_js_import.py` — Blocks `import` of `prototype/apps-gallery/data.js` from any TS file. Real data must come from Supabase, not the prototype mock.
- `validate_file_contains.py --directory <dir> --extension <ext> --contains '<string>'` — Stop hook to assert required strings exist.
- `validate_new_file.py --directory <dir> --extension <ext>` — Stop hook to assert new files were created.

### Custom Validators

- **`rls_enabled_validator.py`**
  - File: `.claude/hooks/validators/rls_enabled_validator.py`
  - Hook Type: PostToolUse
  - Matcher: `Write|Edit`
  - Scope: only fires when `tool_input.file_path` matches `packages/db/migrations/.*\.sql$`. Returns `{}` (allow) for any other file.
  - Algorithm:
    1. Read the saved file content.
    2. Find all `CREATE TABLE` statements with a tolerant regex that handles: optional `IF NOT EXISTS`, optional `public.` schema prefix (defaults to public), and quoted identifiers (`"likes"`). Pattern (case-insensitive, multi-line): `create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(?:"([a-z_][a-z0-9_]*)"|([a-z_][a-z0-9_]*))`. Skip occurrences inside SQL comments (`--` or `/* ... */`).
    3. For each table name found, check whether `alter\s+table\s+(?:public\.)?(?:"?)<name>(?:"?)\s+enable\s+row\s+level\s+security` appears anywhere in the same file (case-insensitive).
    4. If yes → that table is satisfied.
    5. If no → look for a sibling file in the same directory matching `<NNNN+1>_<topic>_rls.sql` (where `<NNNN>` is the current file's leading number + 1). If that sibling exists AND contains the RLS-enable statement for `<name>`, the table is satisfied.
    6. If the sibling file does NOT exist yet (e.g., this validator fires when 0009_social.sql is saved BEFORE 0010_social_rls.sql is written), emit a non-blocking WARNING to stderr but DO NOT block — the validator will re-check when the sibling is later saved. Blocking here would create a chicken-and-egg deadlock with the migration-builder's task order.
    7. If the sibling exists BUT does not enable RLS for `<name>`, block with the precise reason.
  - Blocks with: `BLOCKED: migration creates table <name> without enabling RLS. Either add 'alter table <name> enable row level security;' to <this-file>, or ensure <sibling-file-name>_rls.sql enables it. RLS is non-negotiable per CLAUDE.md.`
  - Pattern: Follow the same structure as `ruff_validator.py` — read stdin JSON, extract `tool_input.file_path`, run check, output `{"decision": "block", "reason": "..."}` or `{}` to allow.
  - Known limitations (documented inline in the script):
    - Does not parse `DO $$ ... $$` blocks (treats them as opaque) — if a contributor creates a table inside a DO block, RLS must be in the same DO block or the validator will not see it.
    - Does not handle cross-schema migrations (only `public.` and unprefixed tables — which is the project default).

### Hook Assignments

All hooks are baked into each team agent's `tools:`/`hooks:` frontmatter in `.claude/agents/team/*.md`. The orchestrator does not need to wire them separately — spawning the agent auto-installs its hooks for the lifetime of that subagent.

| Team Member           | Source agent file                      | Hook fires on                                                | Validator                          |
| --------------------- | -------------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| migration-builder     | `.claude/agents/team/db-agent.md`      | `Write\|Edit` (validator self-scopes to `*.sql`)             | `migration_validator.py`           |
| migration-builder     | `.claude/agents/team/db-agent.md`      | `Write\|Edit` (validator self-scopes to `*.sql`)             | `rls_enabled_validator.py`         |
| frontend-port-builder | `.claude/agents/team/ui-port-agent.md` | `Write\|Edit` (validator self-scopes to `_components/*.tsx`) | `css_verbatim_validator.py`        |
| frontend-port-builder | `.claude/agents/team/ui-port-agent.md` | `Write\|Edit` (validator self-scopes to `_components/*.tsx`) | `no_tailwind_in_prototype_port.py` |
| frontend-port-builder | `.claude/agents/team/ui-port-agent.md` | `Write\|Edit` (validator self-scopes to `app/**/*.tsx`)      | `no_data_js_import.py`             |

## Step by Step Tasks

> **Cross-cutting rules for `/tac:implement`** (apply on top of each task's own `Depends On` / `Agent Type` fields below):
>
> - **Universal dependency**: Tasks 0, 1, 2, 4, 5, 6, 7, 8, 9, 10 all implicitly depend on `pair1-merged-check` (Task 0a) AND on `middleware-gate` only being NON-BLOCKING (middleware-gate runs in parallel). Add this dependency at dispatch time.
> - **Agent Type overrides** (supersede whatever Agent Type appears per-task below, because the team-scoped agents have the right `tools:` frontmatter and the global agents don't):
>   - Tasks 1, 2, 3, 4, 11 → `db-agent` (Supabase MCP + Bash + Write/Edit/Read/Grep/Glob)
>   - Tasks 7, 8, 9, 10, 15, 16, 17 → `ui-port-agent` (opus, port hooks pre-installed)
>   - Task 0b → `ui-port-agent` (already declared)
>   - Tasks 5, 6, 12, 13, 14 → `build-agent` (global; sufficient for pure-TS work)
>   - Task 0 → `build-agent` (global; just writing a Python script)
>   - Tasks 18, 19 → `ui-validator` (team agent; Bash + Playwright MCP + Supabase MCP execute_sql)
>   - Task 0a → `db-agent` (needs `mcp__supabase__list_tables` for the cloud schema check)
> - **Migration-task invariant**: Every `CREATE TABLE` and `CREATE INDEX` statement in Tasks 1, 2, 3, 4 MUST use `IF NOT EXISTS` so re-running an applied migration is safe and so `migration_validator.py` does not block.
> - **Plan-approval gate**: `ui-port-agent` is configured with Plan Approval = true. Subagents owning `publish-screen.tsx` (Task 10), `app/a/[slug]/page.tsx` (Task 15), and `middleware.ts` (Task 0b) MUST submit a short plan before writing.

### 0a. Pre-flight: verify Pair 1 has shipped

- **Task ID**: pair1-merged-check
- **Depends On**: none
- **Assigned To**: migration-builder (db-agent — has Bash; could also be ui-validator)
- **Agent Type**: `db-agent`
- **Parallel**: false (this is the gate; every other task depends on it)
- **Owns Files**: none (read-only)
- **Context**: Run the exact bash block from the "Blocker Check" section above. ALSO call `mcp__supabase__list_tables({ schemas: ['public'] })` and assert that the response includes a row with `name = 'apps'` — confirms that Pair 1's `0006_apps.sql` has been applied to the cloud project `vcbdtjjkkwryvmqbflah`. If any check fails, return status BLOCKED with the precise missing artifact; the lead must hold Pair 2 execution until Pair 1 lands. This task exists because the reviewer flagged Issue #4 + #5: silent file-ownership conflict between two concurrent sessions if Pair 1 hasn't merged.
- **Actions**:
  - Run the 5 `test -f` checks; report which (if any) failed.
  - Call `mcp__supabase__list_tables({ schemas: ['public'] })`; confirm `apps`, `profiles`, `categories` all present.
  - Run `pnpm typecheck` from repo root.
  - Return DONE with a one-line summary, or BLOCKED with the missing artifact list.

### 0b. Pre-flight: extend `middleware.ts` to gate `/publish`

- **Task ID**: middleware-gate
- **Depends On**: pair1-merged-check
- **Assigned To**: frontend-port-builder
- **Agent Type**: `ui-port-agent`
- **Parallel**: true (can run alongside Task 0 + Phase 1 migration/zod/port tasks, no file conflicts)
- **Owns Files**: `apps/web/middleware.ts`
- **Context**: The reviewer flagged Issue #3: the plan originally claimed middleware already gates `/publish`, but inspecting `apps/web/middleware.ts` shows it only refreshes the Supabase session cookie (`supabase.auth.getUser()`) and returns `NextResponse.next()` — there is no pathname check, no redirect for anonymous users. App Router route groups (`(auth)/`) are purely organizational; they do NOT auto-gate. Without this fix, an anonymous user hitting `/publish` will get an uncaught `requireUser()` error inside the RSC. Modify `middleware.ts` to:
  1. Keep the `supabase.auth.getUser()` call (it must run first to refresh the cookie — the comment "CRITICAL: refresh session cookie. Do not remove this line" stays).
  2. After the refresh, check whether the request pathname starts with `/publish`, `/messages`, or `/settings` (the three protected route prefixes per SPEC.md §6.3).
  3. If yes AND `(await supabase.auth.getUser()).data.user === null` → `return NextResponse.redirect(new URL('/sign-in?next=' + request.nextUrl.pathname, request.url))`.
  4. Otherwise, continue with the existing `return response`.
     Plan Approval is true for this task — submit a 5-line plan first (the existing middleware is short and well-commented; a careless edit can break session refresh for the entire app, which the reviewer rightly flagged as high-risk).
- **Actions**:
  - Submit plan.
  - On approval, edit `apps/web/middleware.ts`.
  - Manual smoke: `pnpm dev:web` + `curl -I http://localhost:3000/publish` as anonymous → must return a 307 redirect to `/sign-in?next=/publish`.
  - `pnpm typecheck` from repo root.

### 0. Create the `rls_enabled_validator.py` hook

- **Task ID**: setup-rls-validator
- **Depends On**: none
- **Assigned To**: setup-builder
- **Agent Type**: `build-agent`
- **Parallel**: true (runs alongside all Phase 1 tasks)
- **Owns Files**: `.claude/hooks/validators/rls_enabled_validator.py`
- **Context**: Hatch's CLAUDE.md mandates RLS on every new table. This hook prevents merging a migration that creates a table without enabling RLS. Read `.claude/hooks/validators/ruff_validator.py` and `.claude/hooks/validators/migration_validator.py` as templates — both already follow the project's hook pattern (stdin JSON, extract `tool_input.file_path`, return `{"decision":"block","reason":"..."}` or `{}`). The check: if the file path matches `packages/db/migrations/.*\.sql$`, read the file and use a tolerant regex like `re.findall(r"create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)", sql, re.IGNORECASE)` for table names; then `re.search(rf"alter\s+table\s+public\.{table}\s+enable\s+row\s+level\s+security", sql_or_neighbor_rls_sql, re.IGNORECASE)`. Allow the case where the matching `*_rls.sql` file in the same directory (next sequential NNNN) enables RLS — this matches the project's split-file pattern (`0006_apps.sql` + `0007_apps_rls.sql`, `0009_social.sql` + `0010_social_rls.sql`).
- **Actions**:
  - Write `.claude/hooks/validators/rls_enabled_validator.py` following the ruff_validator pattern.
  - Make executable: `chmod +x .claude/hooks/validators/rls_enabled_validator.py`.
  - Manually smoke-test: run the validator against `packages/db/migrations/0009_social.sql` (will not exist yet — Task 1's output) by piping a fabricated JSON event with `file_path` set to that future path and a mock SQL string. Confirm exit codes.

### 1. Write `0009_social.sql`

- **Task ID**: write-mig-0009
- **Depends On**: none
- **Assigned To**: migration-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `packages/db/migrations/0009_social.sql`
- **Context**: This migration creates the five social tables plus their counter triggers. Source of truth: `SPEC.md` §4.4 (lines 409–475) and §4.5 (lines 477–497). Copy the SQL from those sections **verbatim**, then add the matching counter triggers for `saves`, `comments`, and `comment_likes` following the `bump_likes_count` template on SPEC.md lines 482–495. For comments, the counter must INCREMENT only on inserts where `is_deleted = false` and DECREMENT on UPDATEs that flip `is_deleted` to true (so a soft-delete decrements `apps.comments_count`). The `comments_check_depth` trigger from SPEC §4.4 lines 454–466 enforces max-one-level nesting — copy verbatim. End the file with `-- end migration 0009`. **Do not** enable RLS here — that's `0010_social_rls.sql`.
- **Actions**:
  - Create the file with `CREATE TABLE` statements for `likes`, `saves`, `follows`, `comments`, `comment_likes` per SPEC §4.4.
  - Add `CREATE OR REPLACE FUNCTION` + `CREATE TRIGGER` blocks for `bump_likes_count`, `bump_saves_count`, `bump_comments_count` (with the soft-delete branch noted above), `bump_comment_likes_count`.
  - Add the `comments_check_depth` function + trigger per SPEC §4.4 lines 454–466.
  - Add indexes from SPEC: `create index on public.likes (app_id)`, `create index on public.comments (app_id, created_at desc)`, `create index on public.comments (parent_id)`.

### 2. Write `0010_social_rls.sql`

- **Task ID**: write-mig-0010
- **Depends On**: none
- **Assigned To**: migration-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `packages/db/migrations/0010_social_rls.sql`
- **Context**: Copy the RLS policies for `likes`, `saves`, `follows`, `comments`, `comment_likes` **verbatim** from SPEC.md §5.2 lines 699–735. The block starts with `-- ─── likes / saves / follows ───` and ends before `-- ─── contact_requests ───`. The policies are: `likes readable / insert own / delete own`, `saves readable own / insert own / delete own`, `follows readable / insert own / delete own`, `comments readable / insert own / update own`, `comment_likes readable / insert own / delete own`. Begin the file with `-- migration 0010_social_rls — RLS for likes/saves/follows/comments/comment_likes per SPEC §5.2`.
- **Actions**:
  - Write `alter table ... enable row level security` for all 5 tables.
  - Write all 14 policies exactly as in SPEC §5.2 lines 699–735.

### 3. Write `0011_social_seed.sql`

- **Task ID**: write-mig-0011
- **Depends On**: write-mig-0009, write-mig-0010
- **Assigned To**: migration-builder
- **Agent Type**: `build-agent`
- **Parallel**: false (depends on 0009 + 0010 for schema + RLS)
- **Owns Files**: `packages/db/migrations/0011_social_seed.sql`
- **Context**: Seeds the demo social activity so the detail page's Comments section + the profile's Liked tab look populated. Use the 10 author UUIDs + 12 app UUIDs that Pair 1 hardcoded in `packages/db/migrations/0008_apps_seed.sql` — **read that file first** to get the exact UUIDs. Use the SEED_COMMENTS shape from `prototype/apps-gallery/detail.jsx` lines 5–33 as the template for comments (4 top-level comments + 1 reply per detail page, scaled across 12 apps = ~30 comments total). Seed: ~40 likes (~3.3 per app, spread across the 10 authors), ~30 comments (4 per featured app), ~6 replies, ~15 comment_likes, ~12 follows (each author follows roughly 1–2 others, no self-follows). All inserted via plain `INSERT` statements (no need for SECURITY DEFINER bypass — service role is used by `apply_migration`).
- **Actions**:
  - Read `packages/db/migrations/0008_apps_seed.sql` to extract the author UUIDs and app UUIDs as SQL constants at the top of the seed file (`-- author_mila = '...uuid...'`).
  - Write `INSERT INTO public.likes` rows.
  - Write `INSERT INTO public.comments` rows (some with `parent_id` set, never 2+ levels deep).
  - Write `INSERT INTO public.comment_likes` rows.
  - Write `INSERT INTO public.follows` rows.
  - End the file with `-- end migration 0011`.

### 4. Write `0012_storage_buckets.sql`

- **Task ID**: write-mig-0012
- **Depends On**: none
- **Assigned To**: migration-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `packages/db/migrations/0012_storage_buckets.sql`
- **Context**: Creates the `app-covers` Supabase Storage bucket and its RLS policies. Pattern: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('app-covers', 'app-covers', true, 2097152, array['image/png','image/jpeg','image/webp']);`. RLS on `storage.objects` filtered by `bucket_id = 'app-covers'`: anonymous SELECT (public bucket), authenticated INSERT (`auth.uid() is not null and bucket_id = 'app-covers'`), owner UPDATE/DELETE (`owner = auth.uid()`). The `owner` column on `storage.objects` is populated automatically by Supabase Storage. File size limit is 2 MB to match the prototype's "< 2MB" hint at `publish.jsx` line 174.
- **Actions**:
  - Insert the bucket row.
  - Add 4 RLS policies: SELECT (anon), INSERT (authenticated), UPDATE (owner), DELETE (owner).

### 5. Write `apps/web/lib/zod/social.ts`

- **Task ID**: write-zod-social
- **Depends On**: none
- **Assigned To**: backend-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/zod/social.ts`
- **Context**: Six Zod schemas + their inferred TS types. Reference: `apps/web/lib/zod/profile.ts` for project conventions (single file exports both the schema as `XInput` and the type as `XInputT`). All app_id / user_id / comment_id fields are UUIDs (use `z.string().uuid()`). Comment body is `z.string().min(1).max(2000).trim()` per SPEC §4.4 check constraint. `parentId` is optional UUID; reject if both `parentId` is set AND we're commenting at the second level (server action enforces, schema only types it). `followeeId` must not equal current user's id (server action enforces; schema only types it as UUID).
- **Actions**:
  - Define and export: `LikeToggleInput`, `SaveToggleInput`, `FollowToggleInput`, `CommentCreateInput`, `CommentDeleteInput`, `CommentLikeToggleInput`.
  - Export inferred types with `T` suffix (matching `profile.ts` convention).

### 6. Write `apps/web/lib/zod/publish.ts`

- **Task ID**: write-zod-publish
- **Depends On**: none
- **Assigned To**: backend-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/zod/publish.ts`
- **Context**: The schema **must match prototype constraints exactly** because the form uses these limits and the server re-validates the same shape. From `prototype/apps-gallery/publish.jsx`: title maxLength 32 (line 75), tagline maxLength 90 (line 81), tags max 6 items (line 130), art is one of `['pixel','palette','cursor','dj','roast','fog','bingo','snail','karaoke','tinydraw','pasta','letter']` (line 5), accent is one of `['#ff7a59','#f59e0b','#84cc16','#06b6d4','#3b82f6','#a855f7','#ec4899','#f43f5e']` (line 6). Description has no maxLength in prototype — cap at 10000 server-side as defensive limit. Link must be a valid http(s) URL (matches DB check `link ~ '^https?://'`). Category id is `z.string()` (text FK to `public.categories(id)`).
- **Actions**:
  - Export `ArtKindEnum` (z.enum of the 12 art options).
  - Export `AccentColorEnum` (z.enum of the 8 hex colors).
  - Export `PublishAppInput` with: title (1–32), tagline (1–90), description (0–10000), link (URL), categoryId (string), tags (string[].max(6)), artKind (ArtKindEnum), accent (AccentColorEnum), coverUrl (optional string).
  - Export `CoverUploadInput` schema with one field: filename (`z.string().regex(/\.(png|jpe?g|webp)$/i)`).

### 7. Port `action-bar.tsx` verbatim

- **Task ID**: port-action-bar
- **Depends On**: none
- **Assigned To**: frontend-port-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/_components/action-bar.tsx`
- **Context**: Port `ActionBar` from `prototype/apps-gallery/detail.jsx` lines 35–66. Output: a `'use client'` component. **VERBATIM PORT RULES (non-negotiable, per `feedback_prototype_is_spec`)**: every `className` string identical, every emoji/glyph identical (♥, ♡, ◌, ↗, ⋯, ✓, ＋), every `data-on` / `data-saved` attribute identical, every `title` attribute identical. The `<Icon name="remix" size={16} />` uses the icons.tsx registry from Pair 1. Use `fmtNum` from `cards.tsx`. Imports: `Icon` from `./icons`, `fmtNum` from `./cards`, `useOptimistic` from `react`, `useRouter` from `next/navigation`, server actions `toggleLike` from `@/lib/actions/like`, `toggleSave` from `@/lib/actions/save`. Props interface: `{ appId: string; slug: string; appStats: { remixes: number }; initialLikesCount: number; initialLiked: boolean; initialSaved: boolean; commentCount: number; isAuthenticated: boolean; onCommentsClick: () => void }`. Anonymous click on like/save → `router.push('/sign-in?next=/a/' + slug)`. Optimistic: wrap heart toggle in `useOptimistic` so the UI flips instantly; if server action returns `{ok:false}`, roll back. **Hooks active during this task**: `css_verbatim_validator.py`, `no_tailwind_in_prototype_port.py`, `no_data_js_import.py`. The CSS validator does NOT block `_components/*.tsx` — it only blocks `_styles/prototype-*.css` — but the no-Tailwind one WILL block any utility class.
- **Actions**:
  - Open `prototype/apps-gallery/detail.jsx` and read lines 35–66.
  - Write the TSX file with identical JSX structure, identical class strings, identical glyphs.
  - Wire the `onLike` and `onSave` handlers to call server actions (with optimistic update).
  - Wire anonymous-click → redirect.
  - Run a manual diff: count `className=` occurrences in source vs port; they MUST match (5 in source: `action-bar`, `act-btn like`, `act-btn`, `act-btn`, `act-btn`, `act-sep`, `act-btn`, `act-grow`, `act-save`).

### 8. Port `comment-item.tsx` verbatim

- **Task ID**: port-comment-item
- **Depends On**: none
- **Assigned To**: frontend-port-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/_components/comment-item.tsx`
- **Context**: Port `CommentItem` from `prototype/apps-gallery/detail.jsx` lines 68–100. `'use client'`. **VERBATIM**: every className (`comment`, `comment-body`, `comment-head`, `comment-author`, `comment-handle`, `comment-creator-pill`, `comment-time`, `comment-text`, `comment-actions`, `cm-btn`, `cm-i`, `comment-replies`) identical; every glyph (♥, ♡) identical; "Creator" pill text identical; "Reply" / "Share" button text identical. The recursive call (`<CommentItem key={r.id} c={r} onLike={onLike} isReply />`) renders the same component for replies — keep the recursion. Resolve user data: the prototype reads `window.HATCH_USERS[c.user]`; the port reads it from props (`c.author` is a `{ name, handle, hue, emoji, avatar_url }` object that the parent fetched server-side). Use `Avatar` from `./cards`. Use `fmtNum` from `./cards`. Use `<Markdown>` from `./markdown` to render `c.body` (replaces the prototype's plain `<p>{c.text}</p>`).
- **Actions**:
  - Define Props: `{ comment: CommentNode; onToggleLike: (id: string) => void; onReply?: (id: string) => void; isReply?: boolean; isAuthenticated: boolean }`.
  - Type `CommentNode`: `{ id: string; body: string; created_at: string; relative_time: string; is_creator: boolean; likes_count: number; viewer_liked: boolean; author: AuthorMini; replies?: CommentNode[] }`. Export this type from the file.
  - Render verbatim JSX with the recursive replies block.

### 9. Port `comments.tsx` verbatim

- **Task ID**: port-comments
- **Depends On**: none
- **Assigned To**: frontend-port-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/_components/comments.tsx`
- **Context**: Port `Comments` from `prototype/apps-gallery/detail.jsx` lines 102–149. `'use client'`. **VERBATIM**: header text "Conversation", "{N} comments", "sorted by · most loved"; compose placeholder "Say something nice about this app…"; the keyboard hint "⌘ ↵ to post · Markdown supported"; the "Post comment" button text. Use `Avatar` from `./cards`. The compose textarea behavior matches the prototype exactly: Cmd/Ctrl+Enter submits. Imports: `CommentItem` (and its `CommentNode` type) from `./comment-item`; `postComment` from `@/lib/actions/comment`; `toggleCommentLike` from `@/lib/actions/comment`; `useState`, `useOptimistic` from `react`; `useRouter` from `next/navigation`.
- **Actions**:
  - Define Props: `{ appId: string; slug: string; initialComments: CommentNode[]; isAuthenticated: boolean; viewer?: AuthorMini }`.
  - Render the verbatim JSX with `useState` for the textarea, `useOptimistic` for the comments list.
  - Wire `onLike` to call `toggleCommentLike`.
  - Wire `onAdd` to call `postComment` (anonymous → redirect to sign-in).

### 10. Port `publish-screen.tsx` verbatim

- **Task ID**: port-publish-screen
- **Depends On**: none
- **Assigned To**: frontend-port-builder
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/_components/publish-screen.tsx`
- **Context**: Port the entire `PublishScreen` from `prototype/apps-gallery/publish.jsx` lines 8–221. `'use client'`. This is the most intricate file in the batch and is why this team member runs on `opus`. **VERBATIM**: every className (`publish`, `detail-crumbs`, `crumb-back`, `crumb-sep`, `crumb-here`, `publish-head`, `publish-progress`, `prog-bar`, `prog-l`, `publish-grid`, `publish-form`, `psec`, `psec-head`, `psec-body`, `f`, `f-hint`, `cat-grid`, `cat-tile`, `cat-tile-i`, `is-on`, `tag-input`, `tag-pill`, `art-picker`, `art-tile`, `art-tile-inner`, `color-row`, `color-dot`, `publish-actions`, `btn`, `btn-ghost-2`, `btn-primary`, `btn-lg`, `publish-preview`, `prev-head`, `prev-dot`, `prev-style`, `prev-stage`, `prev-tips`); every section heading text ("The basics", "Tell the story", "Discoverability", "Cover art"); every hint text; the live preview tips list (lines 209–215). **Differences from prototype**:
  - Replace `window.HATCH_CATEGORIES` with a `categories` prop passed from the page (which fetched from Supabase).
  - Wrap form state in `useForm` from `react-hook-form` with `zodResolver(PublishAppInput)`. Map RHF state into the same `form` object shape the prototype uses so the live-preview block on lines 30–37 + 199–217 reads the same fields.
  - Wire `onSubmit={handleSubmit(async (data) => { ... call publishApp ... router.push('/a/' + slug) ... })}` to the form `onSubmit` (replace `onSubmit={(e) => e.preventDefault()}`).
  - Wire the "Upload →" link (line 174) to a real file input + signed-URL upload: click → open hidden `<input type="file" accept="image/*">`, on change → call `getCoverUploadUrl`, PUT to the returned `signedUrl`, then `setF('coverUrl', finalPath)`.
  - "Save draft" button (line 192) is **out of scope** for v1 — render it `disabled title="Drafts coming soon"`.
  - Imports: `AppArt` from `./app-art`; `ClassicCard` (or whichever variant matches active style — for now hardcode `ClassicCard` and accept `cardStyle` prop for future) from `./cards`; `useForm`, `Controller` from `react-hook-form`; `zodResolver` from `@hookform/resolvers/zod`; `PublishAppInput` from `@/lib/zod/publish`; `publishApp`, `getCoverUploadUrl` from `@/lib/actions/publish`; `useRouter` from `next/navigation`.
- **Actions**:
  - Submit a plan (Plan Approval is required for this task) — short plan that covers (a) RHF integration shape, (b) how the live-preview block reads from `watch()`, (c) how the upload flow is wired.
  - On approval, write the TSX file.
  - Confirm the progress bar math on line 39–44 still works (8 fields complete out of 8 = 100%).

### 11. Apply migrations 0009–0012 to cloud + regenerate types + verify storage.owner

- **Task ID**: apply-mig-and-regen
- **Depends On**: write-mig-0009, write-mig-0010, write-mig-0011, write-mig-0012, setup-rls-validator, pair1-merged-check
- **Assigned To**: migration-builder
- **Agent Type**: `db-agent` (team — has all `mcp__supabase__*` tools + Bash)
- **Parallel**: false
- **Owns Files**: `apps/web/lib/supabase/types.ts` (regenerated only — do not hand-edit); MAY edit `packages/db/migrations/0012_storage_buckets.sql` if the post-apply owner check (step 5 below) reveals signed-URL uploads do NOT populate `storage.objects.owner`.
- **Context**: Apply the four migration SQL files via the **Supabase MCP** `apply_migration` tool in strict numeric order (0009 → 0010 → 0011 → 0012). One `apply_migration` call per file with `name` = the migration filename without `.sql`, `query` = file content. **NEVER** use `supabase db push` or any CLI. After all four apply successfully, call `mcp__supabase__generate_typescript_types` with `project_id` = `vcbdtjjkkwryvmqbflah` and write the result to `apps/web/lib/supabase/types.ts`. Verify by running `mcp__supabase__list_tables` and confirming `likes`, `saves`, `follows`, `comments`, `comment_likes` all appear in the `public` schema. Then run the SPEC §5.3 RLS testing checklist queries via `mcp__supabase__execute_sql`. **Failure-rollback policy**: if 0011 (seed) fails after 0009/0010 succeed, the migration table is permanently advanced — do NOT attempt to "re-apply" 0011 as a different name. Fix the seed SQL, save it as `0011_social_seed_v2.sql`, and apply that. If 0009 or 0010 fails, fix the file and re-apply with the same name (Supabase MCP is idempotent on identical `name`).
- **Actions**:
  1. `mcp__supabase__apply_migration({ project_id: 'vcbdtjjkkwryvmqbflah', name: '0009_social', query: <file contents> })`.
  2. Repeat for `0010_social_rls`, `0011_social_seed`, `0012_storage_buckets` — strict numeric order.
  3. `mcp__supabase__generate_typescript_types({ project_id: 'vcbdtjjkkwryvmqbflah' })` → write the response to `apps/web/lib/supabase/types.ts`.
  4. **Typecheck gate**: `pnpm typecheck` from repo root MUST exit 0 here. ALSO assert programmatically (via grep) that `apps/web/lib/supabase/types.ts` contains the substrings `likes: {`, `saves: {`, `follows: {`, `comments: {`, `comment_likes: {`. If any is missing, the regen produced an incomplete file — re-run step 3.
  5. **Storage owner verification** (addresses reviewer Concern #6): perform a smoke signed-URL upload to confirm `storage.objects.owner` is populated. From a Node script (or via `mcp__supabase__execute_sql`): `select owner from storage.objects where bucket_id = 'app-covers' order by created_at desc limit 1` after a test PUT through `storage.from('app-covers').createSignedUploadUrl('test/smoke.png')` + curl. If `owner` is NULL, the UPDATE/DELETE policies in 0012 won't work — patch 0012 to key off path prefix instead: `using ((storage.foldername(name))[1] = auth.uid()::text)`. Apply the patch as `0013_storage_owner_fallback.sql` (do NOT rewrite 0012 in-place — it's already on cloud).
  6. `mcp__supabase__list_tables({ schemas: ['public'] })` — confirm 5 new tables present.
  7. Run SPEC §5.3 RLS checks via `mcp__supabase__execute_sql` (anon SELECT on likes/follows/comments must succeed; anon SELECT on saves must fail; cross-user INSERT must fail).
  8. Final `pnpm typecheck && pnpm lint` from repo root.

### 12. Write server action `like.ts` + `save.ts` + `follow.ts`

- **Task ID**: write-action-toggles
- **Depends On**: apply-mig-and-regen, write-zod-social
- **Assigned To**: backend-builder
- **Agent Type**: `build-agent`
- **Parallel**: false (depends on regen)
- **Owns Files**: `apps/web/lib/actions/like.ts`, `apps/web/lib/actions/save.ts`, `apps/web/lib/actions/follow.ts`
- **Context**: Three server actions following the SPEC §7.4 toggleLike skeleton exactly (SPEC.md lines 920–946). Each: starts with `'use server';`, parses input with the matching Zod schema, calls `requireUser()`, looks up the existing row, INSERTs or DELETEs, calls `revalidatePath` for affected routes, returns `{ ok: true, data: { state: boolean } }` or `{ ok: false, error: 'unauthorized' | 'invalid_input' }`. For `toggleLike`: revalidate `/a/${slug}` (so we need to fetch the slug from `apps` table given `appId` to know the path — alternatively accept `slug` as input alongside `appId` and skip the fetch). For `toggleFollow`: also call `revalidatePath('/u/${handle}')` for both follower + followee. Use the cookie-bound client from `lib/supabase/server.ts`, not the admin client. **Imports**: `'use server'` directive, `revalidatePath` from `next/cache`, `getUser`/`requireUser` from `@/lib/auth`, `createSupabaseServerClient` from `@/lib/supabase/server`, the matching Zod schema. Look at `apps/web/lib/actions/profile.ts` (Phase 1) for the exact import order this codebase uses.
- **Actions**:
  - Write `like.ts` with `toggleLike({ appId, slug })`.
  - Write `save.ts` with `toggleSave({ appId, slug })`.
  - Write `follow.ts` with `toggleFollow({ followeeId, followeeHandle, followerHandle })`. Block self-follow at the action layer too (`if (user.id === followeeId) return { ok: false, error: 'invalid_input' }`).
  - `pnpm typecheck` must pass.

### 13. Write server action `comment.ts`

- **Task ID**: write-action-comment
- **Depends On**: apply-mig-and-regen, write-zod-social
- **Assigned To**: backend-builder
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/lib/actions/comment.ts`
- **Context**: Three exports: `postComment({ appId, slug, body, parentId? })`, `softDeleteComment({ commentId, slug })`, `toggleCommentLike({ commentId, slug })`. `postComment` enforces max 1-level nesting in two layers: (a) Zod allows `parentId` optional UUID; (b) action queries `comments` to ensure that if `parentId` is set, the parent's `parent_id` is null (DB trigger `comments_check_depth` will also reject — belt-and-suspenders). `softDeleteComment` only allows author to flip `is_deleted = true` (RLS already enforces — action just calls `update comments set is_deleted = true where id = $1`). `toggleCommentLike` follows the `toggleLike` skeleton against `comment_likes`. All three call `revalidatePath('/a/${slug}')`.
- **Actions**:
  - Write the three exports with the contract above.
  - `pnpm typecheck` must pass.

### 14. Write server action `publish.ts`

- **Task ID**: write-action-publish
- **Depends On**: apply-mig-and-regen, write-zod-publish
- **Assigned To**: backend-builder
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/lib/actions/publish.ts`
- **Context**: Two exports: `getCoverUploadUrl({ filename })` and `publishApp(input: PublishAppInputT)`. `getCoverUploadUrl`: calls `requireUser()`, uses the cookie-bound client's `storage.from('app-covers').createSignedUploadUrl(path)` where `path = '${user.id}/${randomUUID()}-${filename}'`. The folder structure `<userId>/<random>-<filename>` is intentional — the 0012 RLS policy on `storage.objects` keys off either `owner = auth.uid()` (if Supabase populates it on signed-URL PUTs) or `(storage.foldername(name))[1] = auth.uid()::text` (the fallback Task 11 applies if owner is NULL). Returns `{ ok: true, data: { signedUrl, finalPath } }` (the client PUTs the file directly to `signedUrl`, then sends `finalPath` back in the publish form). `publishApp`: calls `requireUser()`, parses input with `PublishAppInput`, INSERTs into `public.apps` (`author_id = user.id`, `is_published = true`, all other fields from input, `cover_url = input.coverUrl ?? null`). The `slug` column is auto-populated by the **`apps_set_slug` BEFORE INSERT trigger** already shipped in Pair 1's `0006_apps.sql` (NOT a function the action calls directly — the trigger fires automatically when `slug` is null or empty). Do not pass `slug` in the insert; let the trigger derive it from `title`. After INSERT, `revalidatePath('/')` (gallery home), `revalidatePath('/c/${categoryId}')`, `revalidatePath('/u/${user.handle}')`, then return `{ ok: true, data: { slug } }` — the page redirects on success. If the INSERT errors (unique slug collision after trigger's collision-suffix loop, RLS), return `{ ok: false, error: 'duplicate_slug' | 'unauthorized' | 'unknown' }`. **Idempotency note**: the action MUST NOT trust client-supplied `appId` for the cover upload path — the upload path is bound to the AUTHENTICATED USER (`user.id`), not to a pre-allocated `appId`. Stranded uploads from abandoned publishes are an acceptable cost; a future cron can prune.
- **Actions**:
  - Write both exports.
  - `pnpm typecheck` must pass.

### 15. Wire `app/a/[slug]/page.tsx` with social components

- **Task ID**: wire-detail-page
- **Depends On**: apply-mig-and-regen, port-action-bar, port-comments, port-comment-item, write-action-toggles, write-action-comment
- **Assigned To**: frontend-port-builder
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/app/a/[slug]/page.tsx`
- **Context**: **Modify** Pair 1's detail page to mount `<ActionBar>` + `<Comments>` inside the existing JSX where the prototype places them (after the description block, before the related-apps grid). The page stays an RSC. Server-side, fetch in parallel:
  - The current `apps` row (already done by Pair 1).
  - Current viewer's like state: `select user_id from likes where app_id = $1 and user_id = auth.uid()` → boolean.
  - Current viewer's save state: same shape on `saves`.
  - Top 20 comments (with author profiles joined): `select c.*, p.handle, p.display_name, p.avatar_url, p.hue, p.emoji from comments c join profiles p on c.author_id = p.id where c.app_id = $1 and c.parent_id is null and not c.is_deleted order by c.created_at desc limit 20`.
  - For each parent comment, its replies (1 level only): batched query `where parent_id = ANY($1) and not is_deleted`.
  - Viewer's liked-comment ids: `select comment_id from comment_likes where user_id = auth.uid() and comment_id = ANY($1)`.
    Build the `CommentNode[]` tree and pass to `<Comments>`. Compute `relative_time` server-side using a small helper (e.g., `"2h"`, `"5h"`, `"1d"` matching prototype format). The "Conversation" jump (`onCommentsClick` from ActionBar) is just `<a href="#comments-section">` — the prototype's `<Comments>` already has `id="comments-section"`.
- **Actions**:
  - Read the current Pair 1 version of this file.
  - Add the parallel data fetches.
  - Add the relative-time helper (or use `date-fns` if it's already a dep — check `apps/web/package.json` first; if not, write a tiny inline helper, do NOT add a dep just for this).
  - Mount `<ActionBar>` and `<Comments>` with their props.
  - Confirm typecheck.

### 16. Wire `app/u/[handle]/page.tsx` Liked tab + Follow pill

- **Task ID**: wire-profile-page
- **Depends On**: apply-mig-and-regen, write-action-toggles
- **Assigned To**: frontend-port-builder
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/app/u/[handle]/page.tsx`
- **Context**: **Modify** Pair 1's profile page. The prototype (`profile.jsx` lines 9–14) computes `liked = apps.filter((a) => a.id !== owned[0]?.id).slice(0, 4)` — fake data. Real impl: `select apps.* from likes join apps on likes.app_id = apps.id where likes.user_id = $1 and apps.is_published order by likes.created_at desc limit 24`. The tab state in the prototype is local (`const [tab, setTab] = ...`); in Next, prefer reading from `searchParams.tab` so the URL `/u/mila?tab=liked` works (matches SPEC §16 Phase 4 acceptance criterion line 1644). Wire the "Follow" pill: extract it into a tiny `<FollowPill>` client component owned by this same task (inline in this file or as a `_components/follow-pill.tsx` if extracted — owned still by frontend-port-builder). The pill calls `toggleFollow` and uses `useOptimistic`. Anonymous click → router push to sign-in.
- **Actions**:
  - Read the current Pair 1 version of this file.
  - Add the liked-apps query.
  - Switch tab state to `searchParams.tab` (default 'apps').
  - Add follow status fetch: `select * from follows where follower_id = auth.uid() and followee_id = profile.id`.
  - Inline a small client `<FollowPill>` component or co-locate `_components/follow-pill.tsx` (declare ownership here either way).
  - Confirm typecheck.

### 17. Create `app/(auth)/publish/page.tsx`

- **Task ID**: create-publish-page
- **Depends On**: apply-mig-and-regen, port-publish-screen, write-action-publish
- **Assigned To**: frontend-port-builder
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/app/(auth)/publish/page.tsx`
- **Context**: New RSC. Calls `requireUser()`. Anonymous users are redirected to `/sign-in?next=/publish` by `middleware.ts` (extended in Task 0b) — `requireUser()` here is the belt-and-suspenders backstop that throws `UnauthorizedError`. Catch that throw and call `redirect('/sign-in?next=/publish')` from `next/navigation` so the user lands at sign-in instead of seeing a Next.js error overlay. Fetches `categories` (ordered by `sort_order`) and viewer profile (handle + display_name + avatar_url + hue + emoji for the live preview). Mounts `<PublishScreen categories={...} viewer={...} cardStyle="classic" />`. No metadata/breadcrumb chrome of its own — `<PublishScreen>` already renders the breadcrumb (`detail.jsx`-style top crumb "← Cancel / Publish a new app"). The "← Cancel" button is wired in `publish-screen.tsx` to `router.back()`, with a fallback to `router.push('/')` when there is no history (deep-link case).
- **Actions**:
  - Read existing `app/(auth)/sign-in/page.tsx` for the route-group pattern this codebase uses.
  - Write the RSC with the parallel fetches.
  - Confirm typecheck.

### 18. Playwright screenshot diff against prototype

- **Task ID**: playwright-diff
- **Depends On**: wire-detail-page, wire-profile-page, create-publish-page
- **Assigned To**: ui-validator
- **Agent Type**: `playwright-validator`
- **Parallel**: false
- **Owns Files**: `apps/web/tests/playwright/pair2-social-publish.spec.ts`, `apps/web/tests/playwright/screenshots/*`
- **Context**: Run **headed** Chromium via the Playwright MCP tools. Start `pnpm dev:web` as a background bash; wait for `http://localhost:3000` to return 200. For each target route + reference HTML pair, navigate, snapshot, screenshot, then compare. Targets:
  1. `/a/pixel-sushi` (or whichever slug exists in Pair 1's `0008_apps_seed.sql`) — check `.action-bar` and `.comments` sections match the standalone HTML's same selectors at viewport 1440×900.
  2. `/publish` (signed in — use `mcp__playwright__browser_set_cookies` to inject a Supabase auth cookie from a freshly created test user, or follow the existing Phase 1 sign-in flow if it's faster) — check `.publish-grid` matches the standalone HTML.
  3. `/u/mila?tab=liked` — check `.profile` body matches the "Liked" tab in the standalone HTML.

  For each pair, capture full-page screenshots and use `mcp__playwright__browser_evaluate` to compare specific section bounding boxes + computed styles (font-family, color, padding, gap). Failure threshold: any visual delta in a `.action-bar`, `.comments`, `.publish-*`, `.psec`, `.profile` selector is a blocker. Also verify keyboard nav: Cmd+Enter in the comment compose textarea posts the comment; Enter in the tag-input adds a tag; Backspace on empty tag-input removes the last tag.

- **Actions**:
  - Start dev server in background.
  - Write the Playwright spec file with 6 scenarios (3 per page x 2 = visual + interactive).
  - Capture baseline screenshots from the standalone HTML.
  - Capture current-state screenshots from the dev server.
  - Compute pixel diffs at the section level.
  - If any section diff > 0 pixels, report which selectors regressed and stop.

### 19. Final validation

- **Task ID**: validate-all
- **Depends On**: playwright-diff
- **Assigned To**: ui-validator
- **Agent Type**: `playwright-validator`
- **Parallel**: false
- **Context**: Run every command in the **Validation Commands** section below. Every command must exit 0. Verify every acceptance criterion. Report pass/fail to the lead.
- **Actions**:
  - `pnpm typecheck` from repo root.
  - `pnpm lint` from repo root.
  - `pnpm build` from repo root.
  - Verify the §5.3 RLS checklist via Supabase MCP `execute_sql`.
  - Verify a smoke run of one of each server action returns the expected shape.
  - Run `/experts:supabase:self-improve` and `/experts:nextjs:self-improve` so the expertise YAMLs reflect what was actually shipped.
  - Report pass/fail status with a one-paragraph summary.

## Testing Strategy

### Unit tests

This codebase has no Vitest/Jest harness yet (Pair 1 didn't introduce one and Pair 2 doesn't add one — that's a future phase). Behavior is validated end-to-end via the Playwright screenshot diff + the RLS checklist. Server actions return typed `Result` shapes that the typechecker enforces.

### Edge cases

- **Self-follow attempt**: `toggleFollow({ followeeId: currentUser.id })` → action returns `{ ok: false, error: 'invalid_input' }`; DB check constraint `follower_id <> followee_id` is the backstop.
- **2-level comment nesting attempt**: client passes `parentId` of a comment that already has a `parent_id`. Action returns `{ ok: false, error: 'invalid_input' }`; DB trigger `comments_check_depth` is the backstop.
- **Comment body 0 chars or 2001 chars**: Zod blocks at the action; DB check blocks at the row.
- **Duplicate slug on publish**: the slug-gen function in `0006_apps.sql` adds a numeric suffix; if it still collides (vanishingly unlikely), action returns `{ ok: false, error: 'duplicate_slug' }` and the form shows a toast.
- **Cover upload > 2 MB**: bucket's `file_size_limit` rejects at storage layer; client surfaces the error.
- **Cover upload wrong mime**: bucket's `allowed_mime_types` rejects; client surfaces the error.
- **Anonymous click on like/save/follow/comment compose**: redirects to `/sign-in?next=<current path>`. Never crashes.
- **Like spam (rapid double-click)**: optimistic UI rolls back if the server returns the second toggle as a NO-OP (idempotent shape); UI returns to truth on the next render.
- **Profile "Liked" tab is empty for users with 0 likes**: render the prototype's empty-state `◌` glyph + one-liner (SPEC §7.7).
- **Race during publish + upload**: if `getCoverUploadUrl` succeeds but the PUT fails halfway, `publishApp` is called with `coverUrl = null` (procedural AppArt fallback) — no orphan rows.

## Acceptance Criteria

- **AC-1** [SOCIAL — like]: Signed-in user clicks heart → optimistic UI flips immediately → server action persists → DB `likes_count` increments → page revalidates and the new count matches on hard refresh.
- **AC-2** [SOCIAL — unlike]: Click heart on an already-liked app → optimistic UI flips back → DB row deleted → counter decrements.
- **AC-3** [SOCIAL — save]: Same as AC-1/2 but on `saves`. Note: `saves` rows are private (RLS `readable own`), so the heart-style stat is not exposed on cards; only the `+ Save` / `✓ Saved` pill on the detail action bar surfaces.
- **AC-4** [SOCIAL — follow]: From `/u/<handle>`, click "Follow" → counter on viewed profile increments → on viewer's own profile, the followee appears in a (future) Following list. For Pair 2, just verify the row exists in `public.follows`.
- **AC-5** [SOCIAL — comment]: Submit a comment via Cmd+Enter → comment appears with author avatar/handle → DB row exists → `apps.comments_count` increments.
- **AC-6** [SOCIAL — reply]: Click "Reply" on a top-level comment, submit → reply nests visually one level deep → second-level reply attempt is rejected at the action AND at the DB trigger.
- **AC-7** [SOCIAL — comment like]: Click ♡ on a comment → optimistic flip → `comment_likes` row inserted → `comments.likes_count` increments via trigger.
- **AC-8** [SOCIAL — anonymous gate]: Open `/a/<slug>` while signed out → click heart/comment/follow → redirected to `/sign-in?next=/a/<slug>`.
- **AC-9** [PROFILE — liked tab]: Visit `/u/mila?tab=liked` (with seeded likes) → grid renders the apps mila has liked → counter shows correct number.
- **AC-10** [PUBLISH — happy path]: Sign in, navigate to `/publish` → fill all 8 fields → click "Publish to Hatch →" → redirect to `/a/<auto-slug>` → app appears on `/` and `/c/<category>` after revalidation.
- **AC-11** [PUBLISH — cover upload]: Click "Upload →" → pick a 1200×800 PNG < 2 MB → preview pane shows the uploaded image (not the procedural AppArt) → publish → `/a/<slug>` renders the uploaded cover.
- **AC-12** [PUBLISH — validation]: Empty title → form blocks submit; title > 32 chars → caps at 32 in the input itself (prototype behavior); link without `http(s)://` → Zod blocks at server boundary; cover > 2 MB → storage rejects with a surfaced error.
- **AC-13** [PUBLISH — drafts disabled]: "Save draft" button is rendered disabled with `title="Drafts coming soon"`.
- **AC-14** [PORT FIDELITY — action bar]: `prototype/apps-gallery/Hatch - Apps Gallery.html` rendered at 1440×900 vs the dev server `/a/pixel-sushi` at 1440×900 → the `.action-bar` bounding box has the same width, height, child count, and computed font-family/color values. No visible pixel delta.
- **AC-15** [PORT FIDELITY — comments]: Same comparison for `.comments` block. Identical "Conversation" header, identical "{N} comments" subhead, identical compose hint "⌘ ↵ to post · Markdown supported", identical comment list visual.
- **AC-16** [PORT FIDELITY — publish]: Same comparison for `.publish-grid`. Identical section headings, identical art-picker grid (12 tiles), identical color row (8 dots), identical progress bar behavior.
- **AC-17** [SECURITY — RLS]: SPEC §5.3 checklist passes for the new tables: anonymous can SELECT likes/follows/comments/comment_likes, anonymous can NOT SELECT saves (private), anonymous can NOT INSERT anywhere, user A can NOT delete user B's like/save/follow/comment_like.
- **AC-18** [TYPECHECK + LINT + BUILD]: `pnpm typecheck`, `pnpm lint`, `pnpm build` all exit 0.
- **AC-19** [EXPERT KNOWLEDGE FRESH]: After implementation, the supabase + nextjs expertise YAMLs include the new migrations, new server actions, and new components in their respective inventories.

## Validation Commands

Run from repo root:

**A. Pre-flight (run BEFORE any task dispatch):**

```bash
test -f apps/web/app/a/[slug]/page.tsx && \
test -f apps/web/app/u/[handle]/page.tsx && \
test -f apps/web/app/c/[category]/page.tsx && \
test -f apps/web/app/_components/cards.tsx && \
test -f packages/db/migrations/0008_apps_seed.sql && \
pnpm typecheck
```

All five `test -f` must succeed AND typecheck must exit 0. If any check fails → BLOCKED on Pair 1.

**B. Static checks (after each Phase + at end):**

- `pnpm typecheck` — TypeScript strict across all workspaces, zero errors.
- `pnpm lint` — ESLint + Prettier across all workspaces, zero errors.
- `pnpm build` — Next.js production build for `apps/web` plus the rest of the workspaces, zero errors.

**C. Type regen assertion (after Task 11):**

```bash
grep -q '^      likes: {$' apps/web/lib/supabase/types.ts && \
grep -q '^      saves: {$' apps/web/lib/supabase/types.ts && \
grep -q '^      follows: {$' apps/web/lib/supabase/types.ts && \
grep -q '^      comments: {$' apps/web/lib/supabase/types.ts && \
grep -q '^      comment_likes: {$' apps/web/lib/supabase/types.ts
```

All five greps must match. If any miss → re-run `mcp__supabase__generate_typescript_types`.

**D. Dev-server smoke (after Phase 2):**

```bash
pnpm dev:web > /tmp/hatch-dev.log 2>&1 &
disown
for i in {1..30}; do curl -sf http://localhost:3000 >/dev/null && break; sleep 1; done
curl -sf http://localhost:3000/a/pixel-sushi | grep -q 'action-bar'   # server-rendered ActionBar markup present
curl -sI http://localhost:3000/publish 2>&1 | head -1 | grep -q '307'  # anon → redirect to /sign-in
pkill -f "next dev" || true
```

**E. Supabase RLS checks via `mcp__supabase__execute_sql`** (the SPEC §5.3 checklist for new tables):

- `select * from public.saves limit 1` as anon → must return zero rows (RLS-private).
- `select * from public.likes limit 1` as anon → must return rows (public-readable).
- `select * from public.follows limit 1` as anon → must return rows.
- `select * from public.comments where is_deleted = false limit 1` as anon → must return rows.
- `insert into public.likes (user_id, app_id) values ('<other-user-uuid>', '<some-app-uuid>')` as user A → must fail with RLS violation.
- `update public.comments set body = 'pwned' where id = '<other-users-comment-id>'` as user A → must fail.

**F. Storage owner verification** (after Task 11):

```sql
-- after smoke PUT through createSignedUploadUrl
select owner from storage.objects where bucket_id = 'app-covers' order by created_at desc limit 1;
-- owner must NOT be NULL. If NULL, apply 0013_storage_owner_fallback.sql per Task 11 step 5.
```

**G. Playwright section-diff** (Task 18) — every diff-critical selector (`.action-bar`, `.comments`, `.publish-grid`, `.psec`, `.profile`) must have 0 pixels delta vs the standalone prototype HTML.

## Notes

- **Sequential dependency on Pair 1 — promoted to a hard Blocker Check** (see top of Implementation Plan + Task 0a). `/tac:implement` runs `pair1-merged-check` first and aborts the whole run if any Pair 1 artifact is missing. This addresses reviewer Issues #4 + #5: silent file overwrite between two concurrent sessions is now impossible.
- **Title cap divergence between prototype and DB schema**: prototype `<input maxLength={32}>` (publish.jsx line 75) vs DB `check (length(title) between 1 and 64)` (0006_apps.sql line 14). The Zod schema (`PublishAppInput.title.max(32)`) follows the **prototype** as the canonical cap. The DB column stays at 64 as a defensive ceiling. Seeded apps from Pair 1's `0008_apps_seed.sql` may have titles in the 33–64 range — they will render correctly but cannot be re-created via the publish form. This is a known invariant divergence, not a bug. A future migration MAY tighten the DB cap to 32 once we verify no seeded title exceeds it.
- **Optimistic UI rollback semantics**: `useOptimistic` does NOT automatically roll back when the server action returns `{ ok: false }`. Each ported component (`action-bar.tsx`, `comment-item.tsx`, `comments.tsx`) MUST: (a) call the server action via `useTransition` so it can `startTransition` after the optimistic update, (b) check the returned `Result` shape, (c) on `{ ok: false }` call `router.refresh()` to re-render from server-truth, (d) toast the error string. Server actions MUST be idempotent: they SELECT the current row state first and branch on it — never trust the client's "currently-liked" boolean. This means a rapid double-click reaches terminal state correctly even under network reordering.
- **`IF NOT EXISTS` is non-negotiable on migrations**: Tasks 1, 2, 3, 4 — every `CREATE TABLE` and `CREATE INDEX` MUST include `IF NOT EXISTS`. `migration_validator.py` blocks any migration that doesn't. Subagent Contexts already say this; this note is the reminder for human review.
- **Dev-server background pattern for ui-validator**: use `pnpm dev:web > /tmp/hatch-dev.log 2>&1 & disown` then poll `curl -sf http://localhost:3000` up to 30 seconds. DO NOT use naked `&` in a Bash tool call — it leaves stdout attached and the call may appear to hang. The `ui-validator` team agent file documents the exact pattern in its workflow section.
- **No new npm dependencies expected**: `react-hook-form` and `@hookform/resolvers` were verified by the plan-reviewer to already be in `apps/web/package.json`. If they are not (re-verify before Phase 1 dispatch), the publish-port task must add them via `pnpm --filter @hatch/web add react-hook-form @hookform/resolvers` and report it here.
- **No new Python dependencies** — the one new hook (`rls_enabled_validator.py`) uses stdlib only.
- **Realtime explicitly deferred** to Phase 6 per SPEC §16 — comments/likes counters do NOT subscribe in this batch. Server actions call `revalidatePath` and the page re-renders on the next navigation/refresh. The prototype's local-state behavior (every click flips state locally) is replicated 1:1 with optimistic UI as described above.
- **Edit-after-publish** deferred. SPEC §16 Phase 5 line 1654 says "Owner-only Edit affordance on `/a/[slug]`" — that surface is added in a later phase or in a Pair 2 follow-up, not here. The action-bar's `⋯` "More" button stays a no-op for now.
- **Notifications** are NOT wired in this batch. Notification rows are added in Phase 6. The triggers in `0009_social.sql` only update counter columns — they do NOT insert into `public.notifications`.
- **Why opus for `ui-port-agent`**: the publish-screen port is the single highest-risk file in the batch (RHF integration + live preview + signed-upload flow + verbatim port discipline). Opus reduces the chance of a class-string drift.
- **Why three Plan-Approval files**: `publish-screen.tsx` (Task 10), `app/a/[slug]/page.tsx` (Task 15), and `middleware.ts` (Task 0b) each have cross-cutting impact that a careless single-shot edit can break (publish-screen owns the RHF integration; the detail page is the busiest social-wired RSC; middleware is single-point-of-failure for the entire app session refresh).
- **Slug regen on title-collision**: `apps_set_slug` BEFORE INSERT trigger from Pair 1's `0006_apps.sql` handles this in a loop. The action does not retry — it just surfaces `duplicate_slug` on the (vanishingly rare) trigger error.
- **Soft-delete vs hard-delete for comments**: SPEC §4.4 specifies `is_deleted` flag + body retained for audit (line 446). The plan follows the SPEC. If the user later asks for a privacy-scrub on delete, change `softDeleteComment` to also `update comments set body = '[deleted]', author_id = (special-anonymous-uuid)`.
- **Optional follow-up**: a "delete my comment" affordance is implementable as a ~30-line surface in `comment-item.tsx` calling the existing `softDeleteComment`. Not in scope for Pair 2 — keeps the prototype's visual surface intact.
- **No new npm dependencies expected** if `react-hook-form` and `@hookform/resolvers` are already pinned by Pair 1. If they are not (verify `apps/web/package.json`), the publish-port task must add them: `pnpm --filter @hatch/web add react-hook-form @hookform/resolvers`. Report any add in the post-run summary.
- **No new Python dependencies** — the one new hook (`rls_enabled_validator.py`) uses stdlib only.
- **Realtime explicitly deferred** to Phase 6 per SPEC §16 — comments/likes counters do NOT subscribe in this batch. Server actions call `revalidatePath` and the page re-renders on the next navigation/refresh. The prototype's local-state behavior on the detail page (every click flips state locally and the UI never desyncs because there's no other client) is replicated 1:1 with optimistic UI.
- **Edit-after-publish** deferred. SPEC §16 Phase 5 line 1654 says "Owner-only Edit affordance on `/a/[slug]`" — that surface is added in a later phase or in a Pair 2 follow-up, not here. The action-bar's `⋯` "More" button stays a no-op for now.
- **Notifications** are NOT wired in this batch. Notification rows are added in Phase 6 (per the maestro roadmap §5). The triggers in `0009_social.sql` only update counter columns — they do NOT insert into `public.notifications`.
- **Why opus for `frontend-port-builder`**: the publish-screen port is the single highest-risk file in the batch (RHF integration + live preview + signed-upload flow + verbatim port discipline). Opus reduces the chance of a class-string drift that the validators would catch but cost a full subagent round-trip to fix.
- **Why two-stage review on `publish-screen.tsx`**: this file's Plan Approval gate exists specifically because (a) it's the largest port (223 lines), (b) it introduces the only new library integration (RHF + zodResolver), (c) it owns the upload flow which has cross-cutting impact on Storage RLS.
- **The "← Cancel" breadcrumb** in `publish-screen.tsx` calls `router.back()`. If there's no history (deep-linked into `/publish`), fallback to `router.push('/')`.
- **Slug regen on title-collision**: `generate_app_slug(title)` from Pair 1's `0006_apps.sql` handles this. The action does not retry — it just surfaces `duplicate_slug` on the (vanishingly rare) trigger error.
- **Optional follow-up**: a thin "delete my comment" affordance is implementable as a 30-line addition by surfacing `softDeleteComment` from a hidden menu in `comment-item.tsx`. Not in scope for Pair 2 — the action exists but no UI surfaces it. This keeps the prototype's visual surface intact.

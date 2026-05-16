# Feature: Landing — 1:1 port of Hatch-landing prototype with real DB data

## Metadata

issue_number: `6`
adw_id: `manual-sdlc_planner`
issue_json: `{ "title": "Landing — 1:1 port of Hatch-landing prototype, real DB data on app cards", "body": "Port every section of Hatch-landing.zip verbatim to apps/web/app/page.tsx. Only swap fake app names (Lumen.fm, Orbital CRM, Threadwise, Pivot.ai) for real top apps from the gallery. Update ArtVis 3×3 to use our 9 procedurals + header text. Use our REAL 15 MCP tools (shared from packages/shared/src/mcp-tools.ts). Real hero meta counts. Footer verbatim with href=# for not-yet-built pages." }`

## Feature Description

Replace the current truncated landing skeleton at `apps/web/app/page.tsx` (shipped in `d74dd6f`, partial — hero/gallery-preview/cta/footer only) with a **byte-for-byte port** of the full Hatch-landing prototype (`Hatch-landing.zip / src/sections-{1,2,3}.jsx + atoms.jsx`). Every section, every className, every inline style, every decorative micro-component is portable verbatim — this is the marketing front door of the product and the prototype IS the spec (per `feedback_prototype_is_spec` user memory).

The ONLY content that changes from prototype to production:

1. **Hero floating cards** (3 cards: 1 main + 2 mini) → real top-3 apps by `hot_score`.
2. **GalleryPreview tabs Hot/New/Most-loved** → real top-4 apps per tab from DB (3 different orderings).
3. **Hero meta counters** ("4,200+ builders shipping · 12 launched today") → real counts (builders count, apps launched in last 24h, total apps live).
4. **ArtVis bento cell** header → `"20 generative covers, custom uploads"` (prototype said "12 procedural covers, zero uploads" — we don't have 12 and we DO support uploads). The 3×3 grid uses our 9 real procedural covers.
5. **Agents section MCP tools grid** → our actual 15 MCP tools, sourced from a new shared file `packages/shared/src/mcp-tools.ts` so the list stays in sync with `apps/mcp` automatically when we add/remove tools.

Everything else (SocialProof, Bento `PublishVis`/`ContactVis`/`NotifsVis`/`RankingVis` cells, HowItWorks, ForInvestors, Testimonials, FinalCta, Footer) is **decoration / marketing copy** — port verbatim with the prototype's mock content. Testimonials specifically keep their placeholder authors (Alex K., J. Lee, M. Chen) — user accepted that these are copy placeholders until real testimonials are collected. Footer keeps About/Privacy/Terms links as `href="#"` — those pages don't exist yet and will be built in a separate iteration.

## User Story

As an **anonymous visitor** landing on `hatch-brown.vercel.app/`
I want **a polished marketing landing that immediately shows what Hatch is**, with **real builders' projects on display** (not lorem-ipsum mock apps),
So that I **understand the product, trust it's real, and click Sign in to start shipping**.

(Signed-in users are already auto-redirected to `/gallery` — this redirect was shipped in `d74dd6f` and stays.)

## Problem Statement

The current `/` shipped in commit `d74dd6f` is a recortado skeleton: hero (with 3 floating real-app cards), one gallery preview row (no tabs), a final CTA, and a footer I "cleaned" by dropping About/Privacy/Terms. The user reviewed this and pushed back: the prototype must be matched **exactly**, not approximated. Specifically:

- The whole **Bento** section (5 feature cells with rich visualizations) is missing.
- **SocialProof**, **HowItWorks**, **ForInvestors**, **Agents**, **Testimonials** sections are all missing.
- The **GalleryPreview tabs** (Hot / New / Most loved) are replaced with a single static row.
- The **footer** was trimmed instead of ported verbatim.
- The **MCP tools list** in Agents (12 fake tools in the prototype) needs to be sourced from a single shared file so it never drifts from the real `apps/mcp` implementation.

## Solution Statement

Build out the full landing in one pass:

1. **Create `packages/shared/src/mcp-tools.ts`** — single source of truth for the list of 15 MCP tools. Export `MCP_TOOLS: readonly string[]` and a richer `MCP_TOOL_GROUPS` (read/publish/social) for future use. `apps/mcp/src/server.ts` continues to register its own handlers; this shared file is for documentation/landing display only. (No coupling to the live MCP server — just keeps the marketing list in sync with what we ship.)

2. **Create `apps/web/app/_landing/`** folder with one component file per landing section (matching the prototype's atomic breakdown). All components use the prototype's className strings byte-for-byte and load styles from the existing `apps/web/app/landing.css` (already ported in `d74dd6f`).

3. **Rewrite `apps/web/app/page.tsx`** as a Server Component orchestrator that:
   - Calls `getUser()` → `redirect('/gallery')` for signed-in users (existing behavior).
   - Fetches all landing data in one `Promise.all` (3 tab queries + 3 count queries).
   - Composes all sections in the prototype's order.

4. **Extend the prototype-port exception** (`.claude/rules/prototype-port-exception.md` + `.claude/hooks/validators/no_tailwind_in_prototype_port.py` allowlist) to cover `apps/web/app/_landing/**` so the build-agent hook doesn't block landing files for using prototype CSS classes instead of Tailwind.

5. **Validate** with Playwright screenshots of both the prototype standalone HTML and our local landing for side-by-side comparison.

## Relevant Files

Use these files to implement the feature:

- `Hatch-landing.zip` extracted to `/tmp/hatch-landing/` — authoritative source (`src/sections-{1,2,3}.jsx`, `src/atoms.jsx`, `styles/{tokens,components,sections}.css`). Read the JSX line-by-line; rewrite as TSX preserving every className, every inline `style={{...}}`, every prop name in the JSX tree.
- `apps/web/app/page.tsx` — current truncated landing. Will be **rewritten** as the orchestrator.
- `apps/web/app/landing.css` — already contains the full ported CSS (1073+ lines from prototype components.css + sections.css + topbar/footer/logo overrides). No edits needed unless a className from the prototype is missing.
- `apps/web/app/_components/app-art.tsx` — exports `AppArt` (used in cards) and `ALL_COVER_KINDS` (20 final kinds). The 9 procedurals are: `mesh, bokeh, griddots, blocks, rings, glyph, softrings, coolstripes, coolbokeh`.
- `apps/web/lib/supabase/admin.ts` — service-role client. Landing uses admin since all queried tables are publicly readable via RLS; no per-request auth setup needed.
- `apps/web/lib/auth.ts` — `getUser()` returns `{user, profile} | null`. Drives the signed-in redirect.
- `apps/web/lib/supabase/types.ts` — generated `Database` type; `Tables<'apps'>`, `Tables<'profiles'>` etc.
- `apps/mcp/src/server.ts` — the actual MCP server. The shared `MCP_TOOLS` list must match the tool descriptors registered here (15 tools).
- `apps/mcp/src/tools/{read,publish,social}.ts` — the per-domain tool implementations. Cross-check tool names against these when populating `MCP_TOOLS`.
- `packages/shared/src/database.ts` + `index.ts` — pattern for exposing shared types via `@hatch/shared`. Mirror for `mcp-tools.ts`.
- `prototype/apps-gallery/` — older prototype (gallery, not landing). Reference only — landing prototype is in `Hatch-landing.zip`.
- `.claude/rules/prototype-port-exception.md` — exception scope. Needs an addition for `apps/web/app/_landing/**`.
- `.claude/hooks/validators/no_tailwind_in_prototype_port.py` — PreToolUse hook that enforces the exception. Allowlist needs `apps/web/app/_landing/` added.

### New Files

- `packages/shared/src/mcp-tools.ts` — exported `MCP_TOOLS` (15 names) + `MCP_TOOL_GROUPS` (read/publish/social).
- `apps/web/app/_landing/icons.tsx` — port of prototype's `Icons` object (`Heart`, `HeartFill`, `Comment`, `Arrow`, `Flame`, `Sparkles`, `Mcp`, `Code`, `Globe`, `GitHub`, `Diamond`, plus any others used).
- `apps/web/app/_landing/logo.tsx` — port of prototype's `Logo` (mark + text + dot).
- `apps/web/app/_landing/avatar.tsx` — port of prototype's `Avatar({ name, hue, size })` (different signature from existing `apps/web/app/_components/cards.tsx` Avatar — kept separate for fidelity).
- `apps/web/app/_landing/topbar.tsx` — landing topbar (logo + nav + Sign in CTA).
- `apps/web/app/_landing/footer.tsx` — footer verbatim from prototype (`Product` / `For agents` / `Company` columns).
- `apps/web/app/_landing/mini-app-card.tsx` — port of prototype's `MiniAppCard`. Used by Hero floating cards AND GalleryPreview rows. Props: `{ title, by, desc, cat, hearts, comments, kind, accent, slug? }`. `cat` is the human-readable category label (resolved from `categories` by the orchestrator). `kind` is one of the 20 cover kinds; `accent` is the app's accent hex. Both have fallbacks (`'mesh'` / `'#a855f7'`) so rows with nulls still render. When `slug` is present, wraps in `<Link href={`/a/${slug}`}>`.
- `apps/web/app/_landing/float-notif.tsx` — port of prototype's `FloatNotif`.
- `apps/web/app/_landing/hero.tsx` — port of prototype's `Hero`. Accepts `heroApps: AppRow[3]` and `counts: { apps, builders, today }`.
- `apps/web/app/_landing/social-proof.tsx` — port verbatim, no data deps.
- `apps/web/app/_landing/bento.tsx` — port of `Bento` wrapper. Composes the 5 vis cells below.
- `apps/web/app/_landing/bento/publish-vis.tsx` — port verbatim, decorative.
- `apps/web/app/_landing/bento/art-vis.tsx` — port with our 9 procedurals in the 3×3 grid + header `"20 generative covers, custom uploads"` (the prototype said "12 procedural covers, zero uploads").
- `apps/web/app/_landing/bento/contact-vis.tsx` — port verbatim, decorative (contact-request modal preview with mock handle "alex.k").
- `apps/web/app/_landing/bento/notifs-vis.tsx` — port verbatim, decorative (notifications dropdown preview with mock items).
- `apps/web/app/_landing/bento/ranking-vis.tsx` — port verbatim, decorative (animated bars).
- `apps/web/app/_landing/how-it-works.tsx` — port verbatim (3 numbered steps).
- `apps/web/app/_landing/for-investors.tsx` — port verbatim.
- `apps/web/app/_landing/agents.tsx` — port of `Agents`. Terminal demo verbatim. The MCP tools grid sources from `import { MCP_TOOLS } from '@hatch/shared'` (the new shared file). The prototype showed 12 in a 3×4 grid with "+ 3 more" filler — we have 15, so grid becomes 3×5 (no "more" filler needed).
- `apps/web/app/_landing/gallery-preview.tsx` — **Client Component** (`'use client'`) — port of `GalleryPreview` with tab state. Props: `{ tabs: { hot: AppRow[]; new: AppRow[]; loved: AppRow[] } }`. Uses prototype's tab JSX verbatim.
- `apps/web/app/_landing/testimonials.tsx` — port verbatim with the 3 mock quotes.
- `apps/web/app/_landing/final-cta.tsx` — port verbatim.
- `apps/web/app/_landing/data.ts` — typed helper `fetchLandingData()` that does the parallel queries. Returns `{ heroApps, tabs, counts }`.

## Expert Context

Experts consulted (read their `expertise.yaml` for current patterns):

- **nextjs** — App Router conventions, Server Components default. Client Components only when needed (`gallery-preview.tsx` is the only one — tab state). Path alias `@/` resolves to `apps/web/`. `redirect()` from `next/navigation`. Per-page CSS imports via `import './landing.css'` in `page.tsx` get scoped to that route automatically.
- **supabase** — RLS makes `apps`, `profiles`, `categories`, `featured_apps` publicly readable for `is_published = true` rows. Service-role admin client OK for landing (no user context needed). All queries hit cloud project `vcbdtjjkkwryvmqbflah`. Pattern from `apps/web/app/(shell)/gallery/page.tsx` is the canonical example of fetching apps with author join.
- **mcp-server** — `apps/mcp/src/server.ts` registers 15 tools across `tools/read.ts` (6), `tools/publish.ts` (2), `tools/social.ts` (7). The exact 15 are: `list_apps, search_apps, get_app, list_categories, get_profile, list_notifications, publish_app, update_app, like_app, unlike_app, save_app, unsave_app, follow_user, unfollow_user, send_message`. The shared `MCP_TOOLS` array MUST match this list 1:1.

Self-improvement task for `nextjs` expert (the domain most touched) is included at the end of the plan.

## Implementation Plan

### Phase 1: Foundation

- Update prototype-port exception (`.claude/rules/prototype-port-exception.md` + validator allowlist) to cover `apps/web/app/_landing/**`.
- Create shared `MCP_TOOLS` list at `packages/shared/src/mcp-tools.ts` + export from `packages/shared/src/index.ts`.
- Create `_landing/` directory and port the "atom" components: `icons.tsx`, `logo.tsx`, `avatar.tsx`, `mini-app-card.tsx`, `float-notif.tsx`, `topbar.tsx`, `footer.tsx`.

### Phase 2: Section Components

- Port all sections (one component per file) under `apps/web/app/_landing/`:
  - `hero.tsx` (consumes real data props)
  - `social-proof.tsx`
  - `bento.tsx` + `bento/{publish,art,contact,notifs,ranking}-vis.tsx`
  - `how-it-works.tsx`
  - `for-investors.tsx`
  - `agents.tsx` (consumes `MCP_TOOLS` from shared)
  - `gallery-preview.tsx` (Client Component with tabs)
  - `testimonials.tsx`
  - `final-cta.tsx`

### Phase 3: Orchestrator + Validation

- Rewrite `apps/web/app/page.tsx` as a slim orchestrator: redirect signed-in users, fetch landing data in one `Promise.all`, compose all sections in prototype order.
- Add `apps/web/app/_landing/data.ts` helper for the parallel fetch.
- Run `pnpm typecheck && pnpm lint && pnpm build` from repo root.
- Capture Playwright screenshots of localhost landing + prototype standalone HTML for side-by-side visual comparison.
- Refresh `nextjs` expert YAML to reflect the new `_landing/` convention.

## Team Orchestration

This plan uses Claude Code's **agent teams** for coordinated parallel execution. The executor operates as the **team lead in delegate mode** — orchestrating teammates without writing code directly.

### Team Setup

This plan is executed via `/tac:implement` which uses **subagent-driven development**:

1. **Parse tasks**: The executor reads this plan, extracts all tasks with full context.
2. **Create task list**: `TaskCreate` for every task, with dependencies via `addBlockedBy`.
3. **Dispatch subagents**: Fresh subagent per task (no context pollution between tasks).
4. **Two-stage review**: Each task gets spec compliance review, then code quality review.
5. **Status handling**: Subagents report DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT.
6. **Final validation**: Run all Validation Commands after all tasks complete.

To execute: `/tac:implement specs/issue-6-adw-manual-sdlc_planner-landing-1to1-port-real-data.md`

### Team Members

- **landing-foundation-builder**
  - Role: Update prototype-port exception (rule doc + validator allowlist), create shared `MCP_TOOLS`, port landing atoms (`icons`, `logo`, `avatar`, `mini-app-card`, `float-notif`, `topbar`, `footer`).
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `.claude/rules/prototype-port-exception.md`, `.claude/hooks/validators/no_tailwind_in_prototype_port.py`, `packages/shared/src/mcp-tools.ts`, `packages/shared/src/index.ts` (append one export), `apps/web/app/_landing/icons.tsx`, `apps/web/app/_landing/logo.tsx`, `apps/web/app/_landing/avatar.tsx`, `apps/web/app/_landing/mini-app-card.tsx`, `apps/web/app/_landing/float-notif.tsx`, `apps/web/app/_landing/topbar.tsx`, `apps/web/app/_landing/footer.tsx`.
  - Required Capabilities: file write (Write, Edit), shell execution (Bash) for `pnpm typecheck`.
  - Plan Approval: false
  - Hooks: default build-agent validators.

- **landing-sections-a-builder**
  - Role: Port "real-data sections" — Hero (3 floating real apps), SocialProof, GalleryPreview (Client Component with tabs Hot/New/Loved), Testimonials, FinalCta.
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/_landing/hero.tsx`, `apps/web/app/_landing/social-proof.tsx`, `apps/web/app/_landing/gallery-preview.tsx`, `apps/web/app/_landing/testimonials.tsx`, `apps/web/app/_landing/final-cta.tsx`.
  - Required Capabilities: file write (Write, Edit), shell execution (Bash) for `pnpm --filter web typecheck`.
  - Plan Approval: false
  - Hooks: default build-agent validators.

- **landing-sections-b-builder**
  - Role: Port "decoration sections" — Bento wrapper + 5 vis cells, HowItWorks, ForInvestors, Agents (terminal + MCP tools grid).
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/_landing/bento.tsx`, `apps/web/app/_landing/bento/publish-vis.tsx`, `apps/web/app/_landing/bento/art-vis.tsx`, `apps/web/app/_landing/bento/contact-vis.tsx`, `apps/web/app/_landing/bento/notifs-vis.tsx`, `apps/web/app/_landing/bento/ranking-vis.tsx`, `apps/web/app/_landing/how-it-works.tsx`, `apps/web/app/_landing/for-investors.tsx`, `apps/web/app/_landing/agents.tsx`.
  - Required Capabilities: file write (Write, Edit), shell execution (Bash) for `pnpm --filter web typecheck`.
  - Plan Approval: false
  - Hooks: default build-agent validators.

- **landing-page-builder**
  - Role: Rewrite `apps/web/app/page.tsx` orchestrator + create `apps/web/app/_landing/data.ts` fetcher. Wires all sections.
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/page.tsx` (rewrite), `apps/web/app/_landing/data.ts` (new).
  - Required Capabilities: file write (Write, Edit), shell execution (Bash) for `pnpm typecheck/lint/build`.
  - Plan Approval: false
  - Hooks: default build-agent validators.

- **landing-validator**
  - Role: Repo-wide validation + Playwright screenshot capture (localhost landing + prototype standalone HTML) for visual diffing + write a validation report. Refresh `nextjs` expert YAML.
  - Agent Type: `ui-validator`
  - Model: sonnet
  - Owns Files: `tests/visual-baselines/landing/local-*.png`, `tests/visual-baselines/landing/prototype-*.png`, `tests/visual-baselines/landing/report.md`, `.claude/commands/experts/nextjs/expertise.yaml` (refresh — add `_landing/` convention).
  - Required Capabilities: shell execution (Bash) for `pnpm dev:web`, Playwright MCP tools (`mcp__playwright__browser_navigate`, `browser_take_screenshot`, `browser_evaluate`), file write (Write, Edit).
  - Plan Approval: false
  - Hooks: none.

## Validation Hooks

Problem-specific validation hooks that enforce quality automatically during execution.

### Available Validators

- `no_tailwind_in_prototype_port.py` — fires on Write/Edit of files in the prototype-port allowlist; blocks `className` strings that include common Tailwind utility patterns. **Allowlist updated by Task 1 to include `apps/web/app/\_landing/**`.\*\*
- Other default build-agent validators (`ruff_validator.py`, `ty_validator.py`, `no_vapid_private_in_client.py`) are no-ops for the `.tsx` files in scope.

### Custom Validators

None — the existing `no_tailwind_in_prototype_port.py` covers this problem after the allowlist update.

### Hook Assignments

| Team Member                | Hook Type   | Matcher     | Validator                                                                          |
| -------------------------- | ----------- | ----------- | ---------------------------------------------------------------------------------- |
| landing-foundation-builder | PostToolUse | Write\|Edit | default build-agent validators                                                     |
| landing-sections-a-builder | PostToolUse | Write\|Edit | default build-agent (no_tailwind_in_prototype_port applies after allowlist update) |
| landing-sections-b-builder | PostToolUse | Write\|Edit | default build-agent (no_tailwind_in_prototype_port applies)                        |
| landing-page-builder       | PostToolUse | Write\|Edit | default build-agent                                                                |
| landing-validator          | —           | —           | none                                                                               |

## Step by Step Tasks

### 1. Prototype-port exception update + shared MCP_TOOLS + landing atoms

- **Task ID**: foundation
- **Depends On**: none
- **Assigned To**: landing-foundation-builder
- **Agent Type**: build-agent
- **Parallel**: true (Wave A)
- **Owns Files**: `.claude/rules/prototype-port-exception.md`, `.claude/hooks/validators/no_tailwind_in_prototype_port.py`, `packages/shared/src/mcp-tools.ts`, `packages/shared/src/index.ts`, `apps/web/app/_landing/icons.tsx`, `apps/web/app/_landing/logo.tsx`, `apps/web/app/_landing/avatar.tsx`, `apps/web/app/_landing/mini-app-card.tsx`, `apps/web/app/_landing/float-notif.tsx`, `apps/web/app/_landing/topbar.tsx`, `apps/web/app/_landing/footer.tsx`.
- **Context**:

  **Action 1.1 — Extend prototype-port exception**

  Edit `.claude/rules/prototype-port-exception.md` to add `apps/web/app/_landing/**` and `apps/web/app/_landing/bento/**` to the "Scope of exception" allowlist (after the existing entries for `_components/*.tsx`, `page.tsx`, etc.). Keep the rationale paragraph.

  Edit `.claude/hooks/validators/no_tailwind_in_prototype_port.py` — the validator does NOT have an allowlist data structure; it hardcodes a single `if "_components" not in parts` check at line 97 plus a `parts[comp_idx - 1] != "app"` validation at line 104. Refactor as follows:

  ```python
  # Replace lines 90-107 with:
  ALLOWED_DIRS = ("_components", "_landing")  # any .tsx under these dirs (when nested under apps/web/app/) gets the prototype-port treatment

  # Only apply to .tsx files
  if path.suffix != ".tsx":
      logger.info(f"Not a .tsx file, skipping: {file_path}")
      print(json.dumps({}))
      sys.exit(0)

  parts = path.parts
  # Find which (if any) allowed dir this file is under, AND that the parent is `app`
  matched_dir = None
  for d in ALLOWED_DIRS:
      if d in parts:
          idx = parts.index(d)
          if idx >= 3 and parts[idx - 1] == "app":
              matched_dir = d
              break
  if matched_dir is None:
      logger.info(f"Not under apps/web/app/(_components|_landing)/, skipping: {file_path}")
      print(json.dumps({}))
      sys.exit(0)
  ```

  Verify the change works with TWO test invocations (one should pass, one should block):

  ```bash
  # Should PASS (file is in allowlist, no Tailwind in content):
  echo '{"tool_input":{"file_path":"apps/web/app/_landing/hero.tsx","content":"<div className=\"hero\"></div>"}}' | uv run .claude/hooks/validators/no_tailwind_in_prototype_port.py
  # expected stdout: {}

  # Should BLOCK (file is in allowlist, but content has a Tailwind utility):
  echo '{"tool_input":{"file_path":"apps/web/app/_landing/hero.tsx","content":"<div className=\"flex items-center\"></div>"}}' | uv run .claude/hooks/validators/no_tailwind_in_prototype_port.py
  # expected stdout: {"decision":"block","reason":"..."}
  ```

  If both behave as expected, the validator now covers `_landing/` correctly.

  **Action 1.2 — Shared MCP tools**

  Create `packages/shared/src/mcp-tools.ts`:

  ```ts
  // Single source of truth for the MCP server's tool surface.
  // Imported by:
  //   - apps/web/app/_landing/agents.tsx (marketing display on /)
  //   - (future) any other place that needs to enumerate tools.
  // The actual MCP server implementations live in apps/mcp/src/tools/{read,publish,social}.ts.
  // When you add/remove a tool there, update this list to match.

  export type McpToolName =
    | 'list_apps'
    | 'search_apps'
    | 'get_app'
    | 'list_categories'
    | 'get_profile'
    | 'list_notifications'
    | 'publish_app'
    | 'update_app'
    | 'like_app'
    | 'unlike_app'
    | 'save_app'
    | 'unsave_app'
    | 'follow_user'
    | 'unfollow_user'
    | 'send_message';

  export const MCP_TOOLS: readonly McpToolName[] = [
    // Read (6)
    'list_apps',
    'search_apps',
    'get_app',
    'list_categories',
    'get_profile',
    'list_notifications',
    // Publish (2)
    'publish_app',
    'update_app',
    // Social (7)
    'like_app',
    'unlike_app',
    'save_app',
    'unsave_app',
    'follow_user',
    'unfollow_user',
    'send_message',
  ];

  export const MCP_TOOL_GROUPS = {
    read: [
      'list_apps',
      'search_apps',
      'get_app',
      'list_categories',
      'get_profile',
      'list_notifications',
    ] as const,
    publish: ['publish_app', 'update_app'] as const,
    social: [
      'like_app',
      'unlike_app',
      'save_app',
      'unsave_app',
      'follow_user',
      'unfollow_user',
      'send_message',
    ] as const,
  } as const;
  ```

  Append to `packages/shared/src/index.ts`: `export * from './mcp-tools.js';`

  **Action 1.3 — Port atoms from prototype**

  Source: `/tmp/hatch-landing/src/atoms.jsx` (for `Logo`, `Avatar`, `Icons`) and `/tmp/hatch-landing/src/sections-1.jsx` (for `FloatNotif`, `MiniAppCard`).

  For each component below, **port verbatim** — preserve every className, inline style, prop name, JSX structure. Convert JSX → TSX (add type annotations on props). Replace `window.X = X` with `export`. Replace `Icons.X` references with `<X />` direct imports.

  Files to create:
  - `apps/web/app/_landing/icons.tsx` — exports every icon from prototype `Icons` object (`Heart`, `HeartFill`, `Comment`, `Arrow`, `Flame`, `Sparkles`, `Mcp`, `Code`, `Globe`, `GitHub`, `Diamond`, and any others used). Each icon is a named export taking `{ size?: number; stroke?: number }`.
  - `apps/web/app/_landing/logo.tsx` — exports `Logo`. Prototype source at atoms.jsx line 43.
  - `apps/web/app/_landing/avatar.tsx` — exports `LandingAvatar` (renamed to avoid collision with existing `Avatar` in `apps/web/app/_components/cards.tsx` which has a different signature). Props: `{ name: string; hue?: number; size?: number }`. Source at sections-1.jsx line 56.
  - `apps/web/app/_landing/mini-app-card.tsx` — exports `MiniAppCard`. Source at sections-1.jsx line 66. Adapt prop signature for our real data:
    ```ts
    type MiniAppCardProps = {
      title: string;
      by: string; // author handle (e.g., "alex.k")
      desc: string; // tagline
      cat: string; // category LABEL (human-readable, not UUID) — orchestrator maps category_id → label
      hearts: number; // likes_count
      comments: number; // comments_count
      kind: string; // one of the 20 ALL_COVER_KINDS, fallback to 'mesh'
      accent: string; // hex color, fallback to '#a855f7'
      slug?: string; // when present, wraps the card in <Link href={`/a/${slug}`}>
      hue?: number; // optional, for author Avatar tint (defaults to 280)
    };
    ```
    Inside `.appcard-art`, render `<AppArt kind={kind ?? 'mesh'} accent={accent ?? '#a855f7'} />` (imported from `@/app/_components/app-art`). The prototype's numeric `kind` + `seed` props are replaced by our string `kind` + `accent` (AppArt derives seed from accent internally). Keep all other prototype JSX (`.appcard`, `.appcard-body`, `.appcard-head`, `.appcard-title`, `.appcard-byline`, `.appcard-cat`, `.appcard-desc`, `.appcard-foot`, `.appcard-stats`, `.stat`, `.heart`, `.heart-pop`) byte-for-byte from sections-1.jsx lines 66-101.
  - `apps/web/app/_landing/float-notif.tsx` — exports `FloatNotif`. Source at sections-1.jsx line 38. No data deps — verbatim.
  - `apps/web/app/_landing/topbar.tsx` — landing topbar with `Logo` on left, `<Link href="/gallery">Browse gallery</Link>` and `<Link href="/sign-in" className="btn btn--primary">Sign in</Link>` on right. Uses the existing `.landing-topbar` classes already in `apps/web/app/landing.css`.
  - `apps/web/app/_landing/footer.tsx` — port `Footer` from sections-3.jsx line 285 **verbatim**. Keep all four columns: Product (Gallery, Publish, Categories, Hot today), For agents (MCP server, API docs, OpenAPI, llms.txt), Company (About, GitHub, Privacy, Terms). For now, hrefs:
    - Gallery → `/gallery`
    - Publish → `/sign-in?next=/publish`
    - Categories → `#` (no `/categories` index page yet)
    - Hot today → `/trending`
    - MCP server → `/sign-in?next=/settings/api-keys`
    - API docs → `/api/v1/openapi.json` (external `target="_blank"`)
    - OpenAPI → `/api/v1/openapi.json` (external `target="_blank"`)
    - llms.txt → `/llms.txt` (external `target="_blank"`)
    - About → `#`
    - GitHub → `https://github.com/Daniel-Visit/hatch` (external `target="_blank"`)
    - Privacy → `#`
    - Terms → `#`
      Keep the prototype's `.footer-grid`, `.footer-col`, `.footer-bottom`, `.live-dot` classes. Keep the `© 2026 Hatch...` copyright and `v1.0.0 · all systems nominal` mono line, but make the year dynamic: `{new Date().getFullYear()}`.

  Run `pnpm --filter @hatch/shared typecheck && pnpm --filter web typecheck` after writing all files.

- **Actions**:
  - Edit `.claude/rules/prototype-port-exception.md` to add `_landing/**`
  - Edit `.claude/hooks/validators/no_tailwind_in_prototype_port.py` allowlist
  - Manually verify validator runs without error
  - Write `packages/shared/src/mcp-tools.ts`
  - Append export to `packages/shared/src/index.ts`
  - Port 7 atom components to `apps/web/app/_landing/`
  - Run `pnpm --filter @hatch/shared typecheck && pnpm --filter web typecheck`

### 2. Port "real data" sections (Hero, SocialProof, GalleryPreview, Testimonials, FinalCta)

- **Task ID**: sections-a
- **Depends On**: foundation
- **Assigned To**: landing-sections-a-builder
- **Agent Type**: build-agent
- **Parallel**: true (with sections-b)
- **Owns Files**: `apps/web/app/_landing/hero.tsx`, `apps/web/app/_landing/social-proof.tsx`, `apps/web/app/_landing/gallery-preview.tsx`, `apps/web/app/_landing/testimonials.tsx`, `apps/web/app/_landing/final-cta.tsx`.
- **Context**:

  Source files (port verbatim, preserve all classNames + inline styles + JSX structure):
  - **Hero** at `/tmp/hatch-landing/src/sections-1.jsx` line 104. The prototype's hero has hardcoded mock floating cards (Lumen.fm / Threadwise / Orbital CRM). Replace those THREE cards with the three real apps passed via the `heroApps: AppRow[3]` prop. The mock "4,200+ builders shipping · 12 launched today" hero-meta block: replace with real counts from the `counts: { apps, builders, today }` prop. Render conditionally per item: if `builders > 0`, show `<b>{builders}</b> {builders === 1 ? 'builder' : 'builders'} shipping`; if `today > 0`, show `<span className="live-dot" /> <b>{today}</b> launched today`; if `apps > 0`, show `<b>{apps}</b> apps live`. Keep the `<Avatar>` cluster present in the prototype next to the builders count — render real top-4 author avatars from `heroApps[0..2].author` if available, else fall back to plain text.

    Props signature:

    ```ts
    type HeroProps = {
      heroApps: [AppRow, AppRow, AppRow]; // exactly 3 (parent gates by length)
      counts: { apps: number; builders: number; today: number };
    };
    ```

    The 3 cards: index 0 → main (`<MiniAppCard>` with full body), indexes 1 + 2 → mini (`<MiniAppCard>` with compact body). The prototype uses `.float-card--main`, `.float-card--left`, `.float-card--right` classes. Wrap each `<MiniAppCard>` in a `<Link href={`/a/${app.slug}`}>` so the cards click through.

  - **SocialProof** at sections-1.jsx line 225. Port verbatim, no data deps.

  - **GalleryPreview** at sections-3.jsx line 173. Make this a **Client Component** (`'use client'`). Tab state via `useState`. Props:

    ```ts
    type GalleryPreviewProps = {
      tabs: {
        hot: AppRow[];
        new: AppRow[];
        loved: AppRow[];
      };
    };
    ```

    Keep the prototype's `.gallery-tabs`, `.gallery-tab`, `.gallery-row` classes byte-for-byte. The 3 tab buttons: "Hot" (with `<Flame />` icon), "New" (with `<Sparkles />`), "Most loved" (with `<HeartFill />`). The "See all →" button on the right links to `/gallery`. Each tab renders 4 `<MiniAppCard>` instances (since DB queries return 4 each — pre-fetched server-side by the orchestrator).

  - **Testimonials** at sections-3.jsx line 217. Port **verbatim** with the 3 prototype quotes intact (user accepted these as copy placeholders until real testimonials are collected). Keep the `quotes` array exactly as in the prototype (Alex K., J. Lee, M. Chen with full quote text + role).

  - **FinalCta** at sections-3.jsx line 264. Port verbatim. Both CTA buttons: "Start building →" links to `/sign-in`; "Explore the gallery first" links to `/gallery`.

  Conversion rules (apply to all 5 files):
  - JSX → TSX with explicit prop types.
  - `Icons.X` references → import from `@/app/_landing/icons` (e.g., `import { Flame } from '@/app/_landing/icons';` then `<Flame />`).
  - `Avatar` references → `LandingAvatar` from `@/app/_landing/avatar`.
  - `Logo` reference → `Logo` from `@/app/_landing/logo`.
  - `MiniAppCard` reference → `MiniAppCard` from `@/app/_landing/mini-app-card`.
  - `FloatNotif` reference → `FloatNotif` from `@/app/_landing/float-notif`.
  - `<a href="#">` for in-page anchors → keep as `<a>` (these are scroll anchors, not Next links).
  - `<a href="/...">` for real routes → `<Link href={'/route' as Route}>` from `next/link` with `import type { Route } from 'next'`.

  `AppRow` type to import from `@/app/_landing/data` (created in Task 4). **CRITICAL for Client Components** (`gallery-preview.tsx`): use `import type { AppRow } from '@/app/_landing/data'` — NEVER `import { AppRow }`. The `data.ts` file imports `createSupabaseAdminClient` (server-only); a value-import would drag server code into the client bundle and the build would fail. The `import type` form is erased at compile.

  Shape for reference:

  ```ts
  type AppRow = {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    accent: string;
    art_kind: string;
    hue: number;
    category_id: string;
    category_label: string; // resolved from categories table by the orchestrator (NOT category_id UUID)
    likes_count: number;
    comments_count: number;
    hot_score: number;
    author: {
      handle: string;
      display_name: string;
      avatar_url: string | null;
      hue: number;
      emoji: string | null;
    } | null;
  };
  ```

  After writing all 5 files: `pnpm --filter web typecheck`.

- **Actions**:
  - Write `apps/web/app/_landing/hero.tsx`
  - Write `apps/web/app/_landing/social-proof.tsx`
  - Write `apps/web/app/_landing/gallery-preview.tsx` (`'use client'`)
  - Write `apps/web/app/_landing/testimonials.tsx`
  - Write `apps/web/app/_landing/final-cta.tsx`
  - Run `pnpm --filter web typecheck`

### 3. Port "decoration" sections (Bento + 5 vis cells, HowItWorks, ForInvestors, Agents)

- **Task ID**: sections-b
- **Depends On**: foundation
- **Assigned To**: landing-sections-b-builder
- **Agent Type**: build-agent
- **Parallel**: true (with sections-a)
- **Owns Files**: `apps/web/app/_landing/bento.tsx`, `apps/web/app/_landing/bento/publish-vis.tsx`, `apps/web/app/_landing/bento/art-vis.tsx`, `apps/web/app/_landing/bento/contact-vis.tsx`, `apps/web/app/_landing/bento/notifs-vis.tsx`, `apps/web/app/_landing/bento/ranking-vis.tsx`, `apps/web/app/_landing/how-it-works.tsx`, `apps/web/app/_landing/for-investors.tsx`, `apps/web/app/_landing/agents.tsx`.
- **Context**:

  Source files (port verbatim — same conversion rules as Task 2):
  - **PublishVis** at sections-2.jsx line 10. Port verbatim, decorative (mock publish form preview).
  - **ArtVis** at sections-2.jsx line 54. **Two changes from prototype:**
    1. Header `<h3>` text: change `"12 procedural covers, zero uploads"` → `"20 generative covers, custom uploads"`.
    2. Sub-text `<p>` keeps "Every project gets a unique generative cover. Re-roll until it sings." verbatim (still accurate — covers ARE generative by default; re-roll still applies).
    3. The 3×3 grid: replace the prototype's `[0,3,6,2,7,4,1,5,0].map(...)` (prototype's 8 kinds with one repeat) with **our 9 procedurals**, one per cell, no repeats:
       ```ts
       const PROCEDURAL_KINDS = [
         'mesh',
         'bokeh',
         'griddots',
         'blocks',
         'rings',
         'glyph',
         'softrings',
         'coolstripes',
         'coolbokeh',
       ] as const;
       ```
       Render: `{PROCEDURAL_KINDS.map((kind, i) => (<div className="art-cell" key={kind}><AppArt kind={kind} accent="#a855f7" seed={i + 3} /></div>))}`
       Import `AppArt` from `@/app/_components/app-art`. Use `accent="#a855f7"` (brand violet) as a stable accent so the procedural seed is deterministic across renders.
  - **ContactVis** at sections-2.jsx line 74. Port verbatim, decorative (contact modal preview with handle "alex.k").
  - **NotifsVis** at sections-2.jsx line 97. Port verbatim, decorative (notifications dropdown with mock items).
  - **RankingVis** at sections-2.jsx line 139. Port verbatim, decorative (animated ranking bars).
  - **Bento** at sections-2.jsx line 174. Port verbatim — the wrapper that composes the 5 vis cells in a grid.
  - **HowItWorks** at sections-2.jsx line 237. Port verbatim (3 numbered steps).
  - **ForInvestors** at sections-2.jsx line 271. Port verbatim.
  - **Agents** at sections-3.jsx line 15. Port the terminal demo verbatim. The MCP tools grid (prototype has 12 hardcoded tools): replace with our **15 real tools** imported from `@hatch/shared`:
    ```ts
    import { MCP_TOOLS } from '@hatch/shared';
    // ...
    <div className="mcp-tools">
      {MCP_TOOLS.map((t) => (
        <div className="mcp-tool" key={t}>{t}</div>
      ))}
    </div>
    ```
    The prototype had a "+ 3 more" filler in a 4×3 grid (12 cells, last says "+ 3 more"). With 15 tools we don't need the filler — render 15 directly. The existing `.mcp-tools` class in `apps/web/app/landing.css` (line 1014) is `display: grid; grid-template-columns: repeat(2, 1fr);` — 15 items in 2 columns = 8 rows (last row has 1 cell). No inline-style override needed; the natural layout works.

  Conversion rules: same as Task 2 (JSX → TSX, `Icons.X` → imports from `@/app/_landing/icons`, etc.).

  After writing all files: `pnpm --filter web typecheck`.

- **Actions**:
  - Write 5 bento vis cells + bento wrapper (6 files total under `apps/web/app/_landing/bento/` + `bento.tsx`)
  - Write `how-it-works.tsx`
  - Write `for-investors.tsx`
  - Write `agents.tsx`
  - Run `pnpm --filter web typecheck`

### 4. Page orchestrator + data fetcher

- **Task ID**: page-orchestrator
- **Depends On**: sections-a, sections-b
- **Assigned To**: landing-page-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/page.tsx` (rewrite), `apps/web/app/_landing/data.ts` (new).
- **Context**:

  **Action 4.1 — Create `apps/web/app/_landing/data.ts`**

  Export typed `AppRow` (the shape used across all landing components) and an async `fetchLandingData()` helper that returns `{ heroApps, tabs, counts }`:

  ```ts
  import { createSupabaseAdminClient } from '@/lib/supabase/admin';

  // AppRow is the shape every landing component consumes. `category_label`
  // is resolved server-side from the categories table so MiniAppCard can
  // display the human label (NOT the category_id UUID).
  export type AppRow = {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    accent: string;
    art_kind: string;
    hue: number;
    category_id: string;
    category_label: string;
    likes_count: number;
    comments_count: number;
    hot_score: number;
    author: {
      handle: string;
      display_name: string;
      avatar_url: string | null;
      hue: number;
      emoji: string | null;
    } | null;
  };

  type AppRowRaw = Omit<AppRow, 'category_label'>;

  const SELECT = `id, slug, title, tagline, accent, art_kind, hue, category_id, likes_count, comments_count, hot_score, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)`;

  export type LandingData = {
    heroApps: AppRow[]; // up to 3
    tabs: { hot: AppRow[]; new: AppRow[]; loved: AppRow[] }; // up to 4 each
    counts: { apps: number; builders: number; today: number };
  };

  export async function fetchLandingData(): Promise<LandingData> {
    const sb = createSupabaseAdminClient();
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [hot, newest, loved, cats, countApps, countBuilders, countToday] = await Promise.all([
      sb
        .from('apps')
        .select(SELECT)
        .eq('is_published', true)
        .order('hot_score', { ascending: false, nullsFirst: false })
        .limit(4),
      // `newest`: exclude rows with NULL published_at so older test data doesn't skew the order
      sb
        .from('apps')
        .select(SELECT)
        .eq('is_published', true)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(4),
      sb
        .from('apps')
        .select(SELECT)
        .eq('is_published', true)
        .order('likes_count', { ascending: false })
        .limit(4),
      sb.from('categories').select('id, label'),
      sb.from('apps').select('id', { count: 'exact', head: true }).eq('is_published', true),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb
        .from('apps')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .gte('published_at', since24h),
    ]);

    const catLabel = new Map<string, string>((cats.data ?? []).map((c) => [c.id, c.label]));
    const enrich = (row: AppRowRaw): AppRow => ({
      ...row,
      category_label: catLabel.get(row.category_id) ?? row.category_id,
    });

    const hotApps = (hot.data ?? []).map(enrich as (r: unknown) => AppRow);
    return {
      heroApps: hotApps.slice(0, 3),
      tabs: {
        hot: hotApps,
        new: (newest.data ?? []).map(enrich as (r: unknown) => AppRow),
        loved: (loved.data ?? []).map(enrich as (r: unknown) => AppRow),
      },
      counts: {
        apps: countApps.count ?? 0,
        builders: countBuilders.count ?? 0,
        today: countToday.count ?? 0,
      },
    };
  }
  ```

  **Action 4.2 — Rewrite `apps/web/app/page.tsx`**

  Replace the current truncated landing (shipped in `d74dd6f`) with an orchestrator that:

  ```tsx
  // Root / — public landing for anonymous visitors. 1:1 port of the
  // Hatch-landing prototype with real DB data on app cards + counters.
  // Signed-in users are redirected to /gallery.

  import { redirect } from 'next/navigation';
  import { getUser } from '@/lib/auth';
  import { fetchLandingData } from './_landing/data';

  import { Topbar } from './_landing/topbar';
  import { Hero } from './_landing/hero';
  import { SocialProof } from './_landing/social-proof';
  import { Bento } from './_landing/bento';
  import { HowItWorks } from './_landing/how-it-works';
  import { ForInvestors } from './_landing/for-investors';
  import { Agents } from './_landing/agents';
  import { GalleryPreview } from './_landing/gallery-preview';
  import { Testimonials } from './_landing/testimonials';
  import { FinalCta } from './_landing/final-cta';
  import { Footer } from './_landing/footer';

  import './landing.css';

  // ISR: cache the rendered landing for 60 seconds. Anonymous traffic dominates
  // here, and a 60-second lag on counters/hot apps is acceptable for a marketing
  // page. Avoids hammering Postgres with 6 queries per page-view.
  // DO NOT also set `dynamic = 'force-dynamic'` — the two are mutually exclusive
  // and Next.js will throw a build error.
  export const revalidate = 60;

  export default async function LandingPage() {
    const u = await getUser();
    if (u) redirect('/gallery');

    const { heroApps, tabs, counts } = await fetchLandingData();

    return (
      <>
        <Topbar />
        {heroApps.length === 3 && (
          <Hero
            heroApps={
              heroApps as [(typeof heroApps)[0], (typeof heroApps)[0], (typeof heroApps)[0]]
            }
            counts={counts}
          />
        )}
        <SocialProof />
        <Bento />
        <HowItWorks />
        <ForInvestors />
        <Agents />
        <GalleryPreview tabs={tabs} />
        <Testimonials />
        <FinalCta />
        <Footer />
      </>
    );
  }
  ```

  If `heroApps.length < 3` (e.g., fresh DB with fewer than 3 apps), the hero is skipped — degrades gracefully. All other sections render regardless of DB state.

  After writing both files: from repo root `pnpm typecheck && pnpm lint && pnpm build`.

- **Actions**:
  - Write `apps/web/app/_landing/data.ts`
  - Rewrite `apps/web/app/page.tsx`
  - Run `pnpm typecheck && pnpm lint && pnpm build` from repo root

### 5. UI validation via Playwright screenshots

- **Task ID**: ui-validation
- **Depends On**: page-orchestrator
- **Assigned To**: landing-validator
- **Agent Type**: ui-validator
- **Parallel**: false
- **Owns Files**: `tests/visual-baselines/landing/local-*.png`, `tests/visual-baselines/landing/prototype-*.png`, `tests/visual-baselines/landing/report.md`.
- **Context**:

  Validate the landing matches the prototype visually and that real data is wired correctly.

  **Heads-up on `ui-validator` agent default workflow**: the `ui-validator` agent definition at `.claude/agents/team/ui-validator.md` is pre-wired for comparing apps/web against the older gallery prototype at `prototype/apps-gallery/`. For THIS task we explicitly override that workflow — the reference HTML is `/tmp/hatch-landing/Hatch Landing (standalone).html` (the NEW landing prototype from `Hatch-landing.zip`), and the local URL is `http://localhost:3000/` (the landing, not `/gallery`). Ignore any default behavior the agent suggests that targets the gallery prototype; follow the actions below verbatim.

  **Action 5.1 — Boot dev + capture local screenshots**

  ```bash
  cd /Users/daniel/Downloads/hatch
  lsof -ti:3000 | xargs -r kill -9 2>/dev/null
  pnpm dev:web > /tmp/landing-validation-dev.log 2>&1 &
  sleep 10
  curl -s -o /dev/null -w "local /: %{http_code}\n" http://localhost:3000/
  ```

  Use Playwright MCP to navigate to `http://localhost:3000/` (must NOT be signed in — open in incognito or clear cookies first). Take **full-page** screenshots at 1440×900 viewport AND 375×812 (mobile) viewport. Save as `tests/visual-baselines/landing/local-desktop.png` and `local-mobile.png`.

  **Action 5.2 — Capture prototype reference screenshots**

  Open the prototype standalone HTML at `/tmp/hatch-landing/Hatch Landing (standalone).html` via `file://` URL in Playwright. Take full-page screenshots at the same two viewports. Save as `tests/visual-baselines/landing/prototype-desktop.png` and `prototype-mobile.png`.

  **Action 5.3 — Section-level captures**

  At desktop viewport on localhost, scroll to each `<section>` and take a focused screenshot. Save as:
  - `local-hero.png`
  - `local-bento.png`
  - `local-art-vis.png` (focus on the ArtVis cell of the Bento — verify 3×3 with 9 procedural covers + header "20 generative covers, custom uploads")
  - `local-gallery-hot.png`, `local-gallery-new.png`, `local-gallery-loved.png` (click each tab + screenshot)
  - `local-agents.png` (verify 15 MCP tools rendered)
  - `local-footer.png`

  **Action 5.4 — Real-data assertions**

  Using `mcp__playwright__browser_evaluate`, run these checks on the localhost landing:

  ```js
  // No mock app names visible
  const html = document.body.innerHTML;
  const mockNames = ['Lumen.fm', 'Orbital CRM', 'Threadwise', 'Pivot.ai'];
  const found = mockNames.filter((n) => html.includes(n));
  // expected: found is empty (all mock names replaced)
  ```

  ```js
  // ArtVis: 9 cells, header text correct
  const head = document.querySelector('.b-art h3')?.textContent;
  const cells = document.querySelectorAll('.b-art .art-cell').length;
  // expected: head === '20 generative covers, custom uploads' AND cells === 9
  ```

  ```js
  // Agents: 15 MCP tools rendered
  const tools = document.querySelectorAll('.mcp-tools .mcp-tool').length;
  // expected: tools === 15
  ```

  ```js
  // Footer: links exist
  const footerLinks = Array.from(document.querySelectorAll('footer a')).map((a) =>
    a.textContent.trim(),
  );
  // expected to contain: 'Gallery', 'Publish', 'GitHub', 'OpenAPI', 'llms.txt', etc.
  ```

  **Action 5.5 — Signed-in redirect**

  Set a fake Supabase auth cookie via Playwright cookie API to simulate a signed-in user (or — more reliable — sign in via OAuth fixture if available). Visit `/` and verify it 30x-redirects to `/gallery`. Skip this if cookie-fixture is too fragile; document as a manual verification step.

  **Action 5.6 — Teardown dev server BEFORE running pnpm build**

  `pnpm build` triggers the Next.js production compile; running it while `pnpm dev` is still on port 3000 risks file-watcher contention on `.next/`. Tear down first:

  ```bash
  lsof -ti:3000 | xargs -r kill -9 2>/dev/null
  sleep 1
  ```

  **Action 5.7 — Repo-wide commands**

  Run from repo root and capture exit codes:

  ```
  pnpm typecheck
  pnpm lint
  pnpm build
  ```

  **Action 5.8 — Report**

  Write `tests/visual-baselines/landing/report.md`:

  ```markdown
  # Landing 1:1 port — visual + functional validation

  Date: <today>

  ## Repo-wide

  - pnpm typecheck: <exit code>
  - pnpm lint: <exit code>
  - pnpm build: <exit code>

  ## Screenshots captured

  - local-{desktop,mobile,hero,bento,art-vis,gallery-hot,gallery-new,gallery-loved,agents,footer}.png
  - prototype-{desktop,mobile}.png

  ## Real-data assertions

  - No mock app names visible: <PASS/FAIL — list any found>
  - ArtVis header: <PASS — "20 generative covers, custom uploads" | FAIL>
  - ArtVis cells count: <PASS — 9 | FAIL>
  - MCP tools count: <PASS — 15 | FAIL>
  - Footer links present: <PASS/FAIL>

  ## Signed-in redirect

  - / redirects to /gallery for signed-in user: <PASS|MANUAL TBD>

  ## Visual diff (manual)

  Compare local-desktop.png vs prototype-desktop.png — user reviews for any layout drift.

  ## Verdict

  <PASS — ready to commit + push | NEEDS FIX — list issues>
  ```

- **Actions**:
  - Boot dev server in background
  - Playwright: capture local desktop + mobile full-page screenshots
  - Playwright: capture prototype standalone reference screenshots
  - Playwright: section-level captures
  - Playwright: run real-data assertions via `browser_evaluate`
  - Run `pnpm typecheck && pnpm lint && pnpm build`
  - Kill dev server
  - Write `tests/visual-baselines/landing/report.md`

### 6. Expert self-improvement

- **Task ID**: experts-self-improve
- **Depends On**: ui-validation
- **Assigned To**: landing-validator
- **Agent Type**: ui-validator (same as ui-validation)
- **Parallel**: false
- **Owns Files**: `.claude/commands/experts/nextjs/expertise.yaml`.
- **Context**: Refresh the `nextjs` expert YAML to document the new `apps/web/app/_landing/` convention and that `apps/web/app/page.tsx` is now a landing orchestrator (not the gallery). Add the `_landing/` directory to the directory structure section. Note the new shared file `packages/shared/src/mcp-tools.ts`. Verify YAML parses: `uv run python -c "import yaml; yaml.safe_load(open('.claude/commands/experts/nextjs/expertise.yaml'))"`.
- **Actions**:
  - Edit `.claude/commands/experts/nextjs/expertise.yaml` — append `_landing/` block and rewire the `page.tsx` description
  - Verify YAML parses

### 7. Final validation

- **Task ID**: validate-all
- **Depends On**: experts-self-improve
- **Assigned To**: landing-validator
- **Agent Type**: ui-validator
- **Parallel**: false
- **Context**: Final sweep:
  1. Re-run `pnpm typecheck && pnpm lint && pnpm build` from repo root.
  2. Verify every acceptance criterion below.
  3. Confirm `tests/visual-baselines/landing/report.md` shows PASS verdict.
  4. Report final pass/fail.
- **Actions**:
  - Run the 3 commands
  - Verify acceptance criteria checklist
  - Report

## Testing Strategy

### Unit Tests

None — the landing is presentation + data-fetch glue. Integration validation via Playwright screenshots + JS assertions in Task 5 covers correctness.

### Edge Cases

- **DB has fewer than 3 published apps**: hero is conditionally rendered (skipped if `heroApps.length < 3`). Page still loads cleanly.
- **DB has zero apps**: gallery preview rows are empty arrays — tabs show "no apps yet" inline. Counts show 0 — hero meta items hide when their counter is 0.
- **Signed-in user visits /**: `redirect('/gallery')` fires server-side before any HTML renders. Page is never visible to signed-in users.
- **MCP_TOOLS list drifts from `apps/mcp`**: enforced manually for now (the file has a comment instructing updates when tools change in `apps/mcp/src/tools/*`). Future improvement: a `validate_models_synced.py`-style hook that diffs the shared list against `apps/mcp/src/server.ts` registrations.
- **Procedural cover `seed` collisions**: the ArtVis cell uses `seed={i + 3}` (3..11). Stable, no collisions, deterministic across renders.
- **Mobile viewport**: prototype's responsive CSS is in `apps/web/app/landing.css` (already ported). Validator captures mobile screenshot at 375×812 to confirm no breakage.

## Acceptance Criteria

1. `apps/web/app/_landing/` contains all 17+ TSX files listed in the New Files section.
2. `packages/shared/src/mcp-tools.ts` exports `MCP_TOOLS` (length 15) and `MCP_TOOL_GROUPS`. The list matches the tool descriptors in `apps/mcp/src/tools/{read,publish,social}.ts`.
3. `apps/web/app/page.tsx` is the slim orchestrator (≈ 50 lines), composes ALL prototype sections in order: Topbar → Hero → SocialProof → Bento → HowItWorks → ForInvestors → Agents → GalleryPreview → Testimonials → FinalCta → Footer.
4. Hero floating cards show real top-3 apps by `hot_score` — no occurrence of "Lumen.fm", "Orbital CRM", "Threadwise", "Pivot.ai" anywhere on the rendered page.
5. ArtVis bento cell header reads `"20 generative covers, custom uploads"`; grid contains exactly 9 cells rendering our 9 procedural cover kinds.
6. Agents section MCP tools grid contains exactly 15 entries, sourced from `MCP_TOOLS` shared export.
7. GalleryPreview is a Client Component with 3 tabs (Hot/New/Most loved). Each tab shows up to 4 real `<MiniAppCard>` instances. "See all →" button links to `/gallery`.
8. Footer columns match the prototype exactly: Product (Gallery, Publish, Categories, Hot today), For agents (MCP server, API docs, OpenAPI, llms.txt), Company (About, GitHub, Privacy, Terms). About/Privacy/Terms/Categories have `href="#"`; the rest link to real routes.
9. Signed-in user visiting `/` is server-side redirected to `/gallery`.
10. `pnpm typecheck && pnpm lint && pnpm build` all exit 0 from repo root.
11. Playwright screenshots captured for desktop + mobile + per-section, saved to `tests/visual-baselines/landing/`.
12. `.claude/rules/prototype-port-exception.md` includes `apps/web/app/_landing/**` in scope; `no_tailwind_in_prototype_port.py` validator allowlist matches.
13. `nextjs` expert YAML refreshed.

## Validation Commands

- `pnpm typecheck` — across all workspaces.
- `pnpm lint` — eslint + prettier.
- `pnpm build` — production build.
- Playwright via MCP — capture screenshots + run real-data assertions (Task 5).
- Manual: visit `http://localhost:3000/` in incognito → see full landing. Sign in → page auto-redirects to `/gallery`.

## Notes

- **No new npm dependencies**. Everything reuses existing deps: React, Next.js, Supabase client, our `AppArt` component. `@hatch/shared` gets the new `mcp-tools.ts` file but no new external deps.
- **Decoration sections (PublishVis, ContactVis, NotifsVis, RankingVis) keep their mock content** verbatim from the prototype. User confirmed they're decorative marketing visuals — replacing with real data is out of scope for this pair.
- **Testimonials keep mock authors** (Alex K., J. Lee, M. Chen). User accepted these as copy placeholders. A future iteration will collect real testimonials and swap them in.
- **Footer About/Privacy/Terms have `href="#"`** — pages don't exist yet. A separate pair will build them.
- **CSS is already in place** at `apps/web/app/landing.css` (1073+ lines ported in `d74dd6f`). If any prototype className is missing from the CSS during the port, add it to that file (verbatim from `/tmp/hatch-landing/styles/sections.css`).
- **Performance**: total query count is 6 (3 SELECTs for the tabs + 3 COUNTs). All run in one `Promise.all`. Page is `dynamic = 'force-dynamic'` so it always reflects fresh data; Next.js's RSC streaming + Supabase HTTP overhead means initial paint is ~200-400ms with current row count.
- **Future improvements** (out of scope for this pair): real testimonials collection, About/Privacy/Terms pages, replacing decorative bento mocks with live recent activity from DB, hooking the GalleryPreview tabs to a single SWR-style refresh for live updates.
- **Sequencing constraint**: `sections-a` and `sections-b` can run in parallel (different files). `page-orchestrator` waits for both. `ui-validation` and `experts-self-improve` are serial after `page-orchestrator`. `validate-all` is the final gate.

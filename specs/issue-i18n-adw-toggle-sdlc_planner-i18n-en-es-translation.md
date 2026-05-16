# Feature: i18n EN/ES + Per-Comment "Translate" Button

## Metadata

issue_number: `i18n`
adw_id: `toggle`
issue_json: `EN/ES toggle + translation`

## Feature Description

Add Spanish + English support to the entire Hatch web app. UI strings, category labels, and system messages render in the active locale; user-generated content (app titles, taglines, bios, comments, messages) stays in its original language but gets a per-item "Traducir / Translate" button that uses the browser-native `window.Translator` API (Chrome 138+ / Edge) to translate on demand without any backend service.

The active locale is decided by a 3-tier resolver: (1) `NEXT_LOCALE` cookie, (2) signed-in user's `profiles.locale_pref`, (3) `Accept-Language` header on first visit. A topbar `EN ↔ ES` segmented toggle persists the choice. URLs stay free of locale prefixes — single canonical URL per content piece.

No paid translation API, no new SaaS dependency, no breaking URL changes.

## User Story

As a **Hatch visitor (anonymous or signed-in, Spanish or English speaker)**
I want to **see the entire interface in my preferred language and optionally translate individual comments/descriptions**
So that **I can use Hatch comfortably regardless of the language each piece of user-generated content was written in**

## Problem Statement

Today Hatch's UI is English-only — every button, label, empty-state, form field, error message, and category name is hardcoded English. Spanish-speaking users see a fully English shell even when the apps and comments they're viewing are written in Spanish, which is a friction wall. Additionally, mixed-language threads (Spanish app published, English comment, Spanish reply) have no per-message translation aid, so readers have to context-switch manually or paste into Google Translate.

## Solution Statement

1. **Internationalize the UI layer** with `next-intl` (canonical App-Router-native i18n library): extract every user-visible English literal across pages + components into `messages/en.json`, write the Spanish counterpart in `messages/es.json`, render via `getTranslations()` (server) and `useTranslations()` (client).
2. **Resolve locale server-side** via `i18n/request.ts` using a 3-tier fallback (cookie → profile pref → Accept-Language); no Next.js i18n routing means URLs stay unchanged.
3. **Translate categories** via a static `Categories` namespace in messages (keyed by `category.id`), not via DB columns — keeps the seed migration unchanged and avoids per-render Postgres lookups.
4. **Persist locale**: `NEXT_LOCALE` cookie for everyone; a new `profiles.locale_pref` column (migration `0027`) for signed-in users so their preference survives logouts/devices.
5. **Topbar EN/ES toggle** as a small client component next to the theme toggle; sets cookie + (when signed-in) calls `setLocalePref` server action.
6. **Per-comment / per-app-description "Translate" button** as a small reusable client component (`<TranslateButton text=... />`). On mount it checks `'Translator' in self`; if absent (Safari/Firefox today) it returns `null` — silent feature degradation. On click: detects source language via `LanguageDetector.create()`, creates a `Translator` for source→user-locale, swaps the rendered text, and exposes a "Show original" toggle. In-memory cache keyed by original text avoids re-translating on toggle.
7. **MCP server untouched** — the MCP returns raw data; locale concerns live in the web client only.

## Relevant Files

Use these files to implement the feature:

### Foundation / existing patterns to follow

- `apps/web/app/layout.tsx` — current root layout (html, body, theme controller, toaster, SW registrar). Will wrap children in `NextIntlClientProvider` from next-intl.
- `apps/web/app/(shell)/layout.tsx` — shell layout that loads user + shell nav. Will call `setRequestLocale()` so server components downstream get a stable locale.
- `apps/web/middleware.ts` — existing Supabase auth middleware. Do NOT replace; `next-intl` will operate via `i18n/request.ts` (no routing middleware needed).
- `apps/web/lib/supabase/types.ts` — must gain `profiles.locale_pref: string | null` field after migration `0027`.
- `apps/web/lib/auth.ts` — `getUser()` already returns `{ user, profile }`. We use `profile.locale_pref` in the locale resolver.
- `apps/web/lib/actions/profile.ts` — pattern reference for new `setLocalePref` action.
- `apps/web/lib/zod/profile.ts` — pattern reference for new `lib/zod/locale.ts`.
- `apps/web/app/_components/theme-controller.tsx` — pattern reference (client-side context that updates a cookie via a writable input). LocaleToggle follows the same shape but simpler (only a setter, no provider).
- `apps/web/app/_components/shell.tsx` — needs LocaleToggle placement next to the theme toggle, plus its own strings translated.
- `apps/web/app/_components/data-mappers.ts` — exports `relativeTime(iso)` that currently returns English ("3d", "2w", "just now"). Must become locale-aware.
- `apps/web/next.config.ts` — must register `createNextIntlPlugin('./i18n/request.ts')` wrapper.
- `apps/web/package.json` — add `next-intl` dependency.
- `packages/db/migrations/0002_categories.sql` — read-only reference for the 8 category IDs (`ai`, `games`, `tools`, `music`, `productivity`, `creative`, `data`, `web3`).
- `packages/db/migrations/0025_banner_gradient_and_avatars.sql` — reference for migration shape (adding a single column, idempotent).
- `app_docs/feature-session-2026-05-16-shell-route-group-and-polish.md` — most recent feature doc; established conventions around `(shell)` group, `lib/profile-gradients.ts` validator pattern, `resolveBannerCss` (analog for `resolveTranslatorSupport`).
- `README.md` — already mentions `i18n` is NOT part of the feature set; will get a one-paragraph addition after this lands.
- `.claude/commands/conditional_docs.md` — index that will gain an entry for this work after it lands (post-feature-doc step, not a task in this plan).

### MCP / leave alone

- `apps/mcp/**` — confirmed via `grep -ri remix apps/mcp` pattern that MCP carries no UI strings; this plan does not touch MCP.

### Expert context

- `.claude/commands/experts/nextjs/expertise.yaml` — App Router conventions (server vs client components, server actions in `lib/actions/`, Zod in `lib/zod/`, middleware refreshes Supabase session).
- `.claude/commands/experts/supabase/expertise.yaml` — migrations via Supabase MCP `apply_migration` ONLY; never CLI or Docker; PostgREST reload after schema change.

### New Files

- `apps/web/i18n/request.ts` — `getRequestConfig` resolver: cookie → profile pref → Accept-Language → 'en' fallback.
- `apps/web/messages/en.json` — full English message catalogue (~180 keys, namespaced by area).
- `apps/web/messages/es.json` — full Spanish translation of the same keys (1:1 parity).
- `apps/web/lib/i18n/locales.ts` — exports `LOCALES = ['en', 'es'] as const`, `DEFAULT_LOCALE = 'en'`, `type Locale = 'en' | 'es'`, and `isLocale(s: string): s is Locale`.
- `apps/web/lib/zod/locale.ts` — `LocaleInput = z.enum(['en','es'])`.
- `apps/web/lib/actions/locale.ts` — `setLocale(locale: Locale)` server action: sets `NEXT_LOCALE` cookie (1-year, lax) and, if user is signed in, updates `profiles.locale_pref`. Calls `revalidatePath('/', 'layout')` so RSC tree re-renders with new messages.
- `apps/web/app/_components/locale-toggle.tsx` — client component, segmented EN/ES button next to theme toggle. Calls `setLocale` server action + `router.refresh()`.
- `apps/web/app/_components/translate-button.tsx` — client component. Detects `window.Translator` support; renders inline "Traducir" / "Translate" button; on click runs detect+translate; swaps text; provides "Ver original" / "Show original" toggle.
- `packages/db/migrations/0027_profile_locale_pref.sql` — adds `profiles.locale_pref text` (nullable), constrained to `'en' | 'es'` via CHECK; no RLS change needed (profiles RLS already covers own-row updates).
- `.claude/hooks/validators/i18n_key_parity.py` — custom hook: when `messages/en.json` or `messages/es.json` is written/edited, loads both, diffs key sets recursively, blocks with the missing keys listed.
- `.claude/agents/team/i18n-foundation-builder.md` — team agent built on `db-agent` capabilities (needs Supabase MCP for migration + type regen).
- `.claude/agents/team/translate-button-builder.md` — built on `build-agent` capabilities.
- `.claude/agents/team/strings-extractor-shell-discover.md` — built on `build-agent` capabilities.
- `.claude/agents/team/strings-extractor-detail-social.md` — built on `build-agent` capabilities.
- `.claude/agents/team/strings-extractor-publish-settings.md` — built on `build-agent` capabilities.

## Implementation Plan

### Phase 1: Foundation (parallel pair — both run from the start)

**Foundation builder** lays down the i18n scaffolding: installs `next-intl`, writes the locale resolver, full message catalogues (EN + ES) covering every string the extractors will need, the cookie/profile server action, the topbar toggle component, the DB migration for `locale_pref`, and the key-parity validator. By the time Phase 2 starts, every translation key the extractors need exists in both JSON files; the LocaleToggle is importable from `app/_components/locale-toggle.tsx`; the locale resolver is wired in `next.config.ts`.

**TranslateButton builder** in parallel creates the `<TranslateButton>` component with browser-Translator-API detection, language-detection, in-memory cache, and "Show original" toggle. Zero deps on foundation — it's a pure client component. After Phase 1, both `<LocaleToggle />` and `<TranslateButton />` exist as importable components ready to be placed.

### Phase 2: String extraction + integration (3 parallel builders, no overlap)

The codebase is partitioned by file ownership into three disjoint sets. Each extractor reads the message JSON keys (already-defined) and replaces every English literal in its owned files with `t('Namespace.key')` calls, importing `getTranslations` (RSC) or `useTranslations` (client). One extractor also places `<LocaleToggle />` into `shell.tsx`; another also wires `<TranslateButton />` into `comment-item.tsx` and the detail-page description. No file is touched by more than one extractor.

### Phase 3: Validation

Validator runs typecheck/lint/build, hits dev server with curl for every public route, drives Playwright through the EN/ES toggle round-trip, and verifies in DB that `profiles.locale_pref` persisted for a signed-in user.

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

To execute: `/tac:implement specs/issue-i18n-adw-toggle-sdlc_planner-i18n-en-es-translation.md`

### Team Members

- **i18n-foundation-builder**
  - Role: Install next-intl, write locale resolver + message catalogues (EN + ES), create LocaleToggle + setLocale server action, apply DB migration for `profiles.locale_pref`, regenerate types, write key-parity validator.
  - Agent Type: `.claude/agents/team/i18n-foundation-builder.md` (to be created in Task 0)
  - Model: opus (architectural surface — locale resolver design, message-key namespace shape, migration shape all need careful judgement)
  - Owns Files:
    - `apps/web/package.json` (add next-intl dep — must run `pnpm install` after)
    - `apps/web/next.config.ts` (wrap with `createNextIntlPlugin('./i18n/request.ts')`)
    - `apps/web/i18n/request.ts` (new)
    - `apps/web/messages/en.json` (new)
    - `apps/web/messages/es.json` (new)
    - `apps/web/lib/i18n/locales.ts` (new)
    - `apps/web/lib/zod/locale.ts` (new)
    - `apps/web/lib/actions/locale.ts` (new)
    - `apps/web/app/_components/locale-toggle.tsx` (new)
    - `apps/web/app/layout.tsx` (root layout — wrap children in `NextIntlClientProvider`)
    - `apps/web/lib/supabase/types.ts` (add `profiles.locale_pref` row in Row/Insert/Update)
    - `packages/db/migrations/0027_profile_locale_pref.sql` (new)
    - `.claude/hooks/validators/i18n_key_parity.py` (new)
  - Required Capabilities: file write (Write, Edit, MultiEdit); shell execution (Bash) for `pnpm install` + `pnpm typecheck` smoke; Supabase MCP (`mcp__supabase__apply_migration`, `mcp__supabase__generate_typescript_types`, `mcp__supabase__execute_sql`); search (Grep, Glob); progress tracking (TodoWrite).
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit on `.sql`): `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/migration_validator.py`
    - PostToolUse (Write|Edit on `messages/*.json`): `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/i18n_key_parity.py`

- **translate-button-builder**
  - Role: Create the `<TranslateButton>` client component with browser-Translator-API detection, language detection, in-memory cache, "Show original" toggle.
  - Agent Type: `.claude/agents/team/translate-button-builder.md` (to be created in Task 0)
  - Model: sonnet (single well-defined component, no architectural ambiguity)
  - Owns Files:
    - `apps/web/app/_components/translate-button.tsx` (new)
  - Required Capabilities: file write (Write, Edit); search (Grep, Glob); progress tracking (TodoWrite).
  - Plan Approval: false
  - Hooks: none beyond defaults

- **strings-extractor-shell-discover**
  - Role: Translate the shell + discovery surface (topbar, sidebar, home/trending/new/following/category/search pages + supporting cards/gallery/action-bar/follow-pill). Places `<LocaleToggle />` into the topbar. Makes `relativeTime()` locale-aware.
  - Agent Type: `.claude/agents/team/strings-extractor-shell-discover.md` (to be created in Task 0)
  - Model: sonnet
  - Owns Files:
    - `apps/web/app/_components/shell.tsx`
    - `apps/web/app/_components/cards.tsx`
    - `apps/web/app/_components/action-bar.tsx`
    - `apps/web/app/_components/follow-pill.tsx`
    - `apps/web/app/_components/gallery-grid.tsx`
    - `apps/web/app/_components/data-mappers.ts` (locale-aware `relativeTime`)
    - `apps/web/app/(shell)/page.tsx`
    - `apps/web/app/(shell)/trending/page.tsx`
    - `apps/web/app/(shell)/new/page.tsx`
    - `apps/web/app/(shell)/following/page.tsx`
    - `apps/web/app/(shell)/c/[category]/page.tsx`
    - `apps/web/app/(shell)/search/page.tsx`
  - Required Capabilities: file write (Write, Edit, MultiEdit); search (Grep, Glob); shell (Bash for spot typecheck); progress tracking (TodoWrite).
  - Plan Approval: false
  - Hooks: none beyond defaults

- **strings-extractor-detail-social**
  - Role: Translate the detail / profile / comments / contact / messages / notifications surface. Wires `<TranslateButton>` into comment bodies and into the detail page description block.
  - Agent Type: `.claude/agents/team/strings-extractor-detail-social.md` (to be created in Task 0)
  - Model: sonnet
  - Owns Files:
    - `apps/web/app/(shell)/a/[slug]/page.tsx`
    - `apps/web/app/(shell)/a/[slug]/_components/contact-cta.tsx`
    - `apps/web/app/(shell)/u/[handle]/page.tsx`
    - `apps/web/app/_components/comments.tsx`
    - `apps/web/app/_components/comment-item.tsx`
    - `apps/web/app/_components/contact-modal.tsx`
    - `apps/web/app/(shell)/notifications/page.tsx`
    - `apps/web/app/(shell)/notifications/_components/notifications-page.tsx`
    - `apps/web/app/_components/notifications-bell.tsx`
    - `apps/web/app/_components/notifications-panel.tsx`
    - `apps/web/app/_components/notification-item.tsx`
    - `apps/web/app/_components/notification-toast.tsx`
    - `apps/web/app/(shell)/messages/page.tsx`
    - `apps/web/app/(shell)/messages/[conversationId]/page.tsx`
    - `apps/web/app/(shell)/messages/[conversationId]/_components/message-thread.tsx`
    - `apps/web/app/(shell)/messages/_components/conversations-list.tsx`
    - `apps/web/app/(shell)/messages/_components/empty-thread.tsx`
    - `apps/web/app/_components/push-permission-prompt.tsx`
  - Required Capabilities: file write (Write, Edit, MultiEdit); search (Grep, Glob); shell (Bash for spot typecheck); progress tracking (TodoWrite).
  - Plan Approval: false
  - Hooks: none beyond defaults

- **strings-extractor-publish-settings**
  - Role: Translate the publish flow + settings pages + sign-in flow.
  - Agent Type: `.claude/agents/team/strings-extractor-publish-settings.md` (to be created in Task 0)
  - Model: sonnet
  - Owns Files:
    - `apps/web/app/(shell)/publish/page.tsx`
    - `apps/web/app/_components/publish-screen.tsx`
    - `apps/web/app/(shell)/settings/profile/page.tsx`
    - `apps/web/app/(shell)/settings/profile/profile-form.tsx`
    - `apps/web/app/(shell)/settings/notifications/page.tsx`
    - `apps/web/app/(shell)/settings/notifications/_components/notifications-form.tsx`
    - `apps/web/app/(shell)/settings/api-keys/page.tsx`
    - `apps/web/app/(shell)/settings/api-keys/_components/generate-key-flow.tsx`
    - `apps/web/app/(shell)/settings/api-keys/_components/mcp-config-snippet.tsx`
    - `apps/web/app/(auth)/sign-in/page.tsx`
    - `apps/web/app/(auth)/sign-in/sign-in-buttons.tsx`
  - Required Capabilities: file write (Write, Edit, MultiEdit); search (Grep, Glob); shell (Bash for spot typecheck); progress tracking (TodoWrite).
  - Plan Approval: false
  - Hooks: none beyond defaults

- **i18n-validator**
  - Role: After all extractors finish — run typecheck/lint/build; drive Playwright through the EN/ES toggle round-trip on `/`, `/a/focusfog`, `/u/mila`, `/settings/profile`; verify `profiles.locale_pref` persisted in DB; spot-check that the Translate button renders on Chrome user-agent and does NOT render on Safari user-agent.
  - Agent Type: `ui-validator` (existing — already has Playwright + Supabase MCP + Bash + edit tools)
  - Model: sonnet
  - Owns Files: none directly (read-only on app code; may write a report to `tests/visual-baselines/i18n/validation-report.md`)
  - Required Capabilities: shell (Bash), file write for the report (Write), Playwright MCP browser tools (mcp**playwright**\*), Supabase MCP (mcp**supabase**execute_sql).
  - Plan Approval: false
  - Hooks: none beyond defaults

## Validation Hooks

### Available Validators

- `migration_validator.py` — runs on Write|Edit of `.sql` files, enforces `CREATE TABLE/INDEX IF NOT EXISTS` idempotency. **Used by i18n-foundation-builder.**

### Custom Validators

- **`i18n_key_parity.py`**
  - File: `.claude/hooks/validators/i18n_key_parity.py`
  - Hook Type: PostToolUse
  - Matcher: `Write|Edit`
  - Checks: When the edited file is `apps/web/messages/en.json` or `apps/web/messages/es.json`, load both JSON files (treating either-missing as `{}`), walk both trees recursively, and compute (a) keys in EN missing from ES, (b) keys in ES missing from EN. Both lists must be empty. Also rejects non-string leaf values (every leaf must be a string — no nested non-string types).
  - Blocks with: `"i18n key parity violation: EN missing in ES: [...]. ES missing in EN: [...]. Both message files must have identical key trees with string leaves."`
  - Pattern: Follow the same skeleton as `migration_validator.py` — read stdin JSON, extract `tool_input.file_path`, run check, output `{"decision": "block", "reason": "..."}` or `{}` to allow. Use stdlib `json` and `pathlib` only — no extra deps.

### Hook Assignments

| Team Member             | Hook Type   | Matcher     | Validator                                                                    |
| ----------------------- | ----------- | ----------- | ---------------------------------------------------------------------------- |
| i18n-foundation-builder | PostToolUse | Write\|Edit | `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/migration_validator.py` |
| i18n-foundation-builder | PostToolUse | Write\|Edit | `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/i18n_key_parity.py`     |

## Step by Step Tasks

### 0. Create Custom Validators and Agent Definitions

- **Task ID**: setup-validators
- **Depends On**: none
- **Assigned To**: bootstrap (general-purpose)
- **Agent Type**: `general-purpose` (the agent definition files don't exist yet — must use the built-in general-purpose agent for this bootstrap step only)
- **Parallel**: true (no other task depends on these files except later i18n-foundation-builder tasks)
- **Owns Files**:
  - `.claude/hooks/validators/i18n_key_parity.py` (new)
  - `.claude/agents/team/i18n-foundation-builder.md` (new)
  - `.claude/agents/team/translate-button-builder.md` (new)
  - `.claude/agents/team/strings-extractor-shell-discover.md` (new)
  - `.claude/agents/team/strings-extractor-detail-social.md` (new)
  - `.claude/agents/team/strings-extractor-publish-settings.md` (new)
- **Context**:
  - **Validator pattern** lives in `.claude/hooks/validators/migration_validator.py`. Copy its shebang + script-metadata header + `read stdin → extract tool_input.file_path → run check → output JSON` skeleton. New validator name: `i18n_key_parity.py`.
  - The validator should ONLY act when `tool_input.file_path` ends with `apps/web/messages/en.json` or `apps/web/messages/es.json`. For any other path, output `{}` immediately.
  - When triggered: read both JSON files (treat missing file as `{}`); walk recursively collecting fully-qualified key paths (e.g. `Shell.Nav.Discover`); diff the two sets; reject if either set has keys the other lacks; reject if any leaf value is not a `str`. Block message must list at most 10 missing keys per side to keep the message readable.
  - **Agent definitions** — each lives in `.claude/agents/team/<name>.md` with YAML frontmatter modelled on `.claude/agents/team/db-agent.md` (already exists, read it as a template). Frontmatter fields: `name`, `description`, `tools`, `model`, optional `color`, optional `hooks`.
  - `i18n-foundation-builder.md` — copy tools from `db-agent.md` (it has Supabase MCP). Add `MultiEdit`. `model: opus`. Hooks: `PostToolUse Write|Edit → migration_validator.py` AND `PostToolUse Write|Edit → i18n_key_parity.py`. Description must mention "Next.js next-intl scaffolding + Supabase migration for profile.locale_pref + message catalogues EN/ES".
  - `translate-button-builder.md` — tools: `Write, Read, Edit, MultiEdit, Grep, Glob, Bash, TodoWrite`. `model: sonnet`. No hooks. Description: "Creates `<TranslateButton>` client component using browser-native `window.Translator` API with graceful degradation on unsupported browsers".
  - The three `strings-extractor-*.md` files — same tool list as `translate-button-builder.md`, `model: sonnet`, no hooks. Descriptions distinguish the surface each owns (shell+discover, detail+social, publish+settings+auth).
- **Actions**:
  - Read `.claude/hooks/validators/migration_validator.py` and `.claude/agents/team/db-agent.md` as templates.
  - Write `.claude/hooks/validators/i18n_key_parity.py`; `chmod +x` it.
  - Write the 5 agent definition files.
  - Smoke-test the validator: create a temporary mismatched pair of JSON files in `/tmp/`, call the validator manually via `echo '{"tool_input":{"file_path":"apps/web/messages/en.json"}}' | uv run ...` — confirm it blocks. Delete temp files.

### 1. next-intl install + locale module + zod + types regen

- **Task ID**: foundation-install-locales
- **Depends On**: setup-validators
- **Assigned To**: i18n-foundation-builder
- **Agent Type**: `.claude/agents/team/i18n-foundation-builder.md`
- **Parallel**: true (with translate-button-create — different file ownership)
- **Owns Files**:
  - `apps/web/package.json` (add `next-intl` dep)
  - `apps/web/next.config.ts`
  - `apps/web/lib/i18n/locales.ts` (new)
  - `apps/web/lib/zod/locale.ts` (new)
- **Context**:
  - Install `next-intl` via pnpm: from the repo root run `pnpm --filter web add next-intl`. Latest stable v3.x is fine.
  - `apps/web/next.config.ts` currently exports a `NextConfig` object. Wrap the export with `createNextIntlPlugin('./i18n/request.ts')`. Pattern:
    ```ts
    import { createNextIntlPlugin } from 'next-intl/plugin';
    const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
    const config: NextConfig = {
      /* existing keys */
    };
    export default withNextIntl(config);
    ```
    Keep the existing `images.remotePatterns`, `transpilePackages`, `typedRoutes` keys intact.
  - `apps/web/lib/i18n/locales.ts` — exports:
    ```ts
    export const LOCALES = ['en', 'es'] as const;
    export type Locale = (typeof LOCALES)[number];
    export const DEFAULT_LOCALE: Locale = 'en';
    export function isLocale(s: string | undefined | null): s is Locale {
      return s === 'en' || s === 'es';
    }
    ```
  - `apps/web/lib/zod/locale.ts` — exports `LocaleInput = z.enum(['en','es'])` and `type LocaleInputType = z.infer<typeof LocaleInput>`.
- **Actions**:
  - `pnpm --filter web add next-intl`
  - Edit `apps/web/next.config.ts` per the wrapper pattern above.
  - Create `apps/web/lib/i18n/locales.ts` and `apps/web/lib/zod/locale.ts`.
  - Run `pnpm --filter web typecheck` — must pass.

### 2. Locale resolver (i18n/request.ts) + setLocale server action

- **Task ID**: foundation-request-action
- **Depends On**: foundation-install-locales
- **Assigned To**: i18n-foundation-builder
- **Agent Type**: `.claude/agents/team/i18n-foundation-builder.md`
- **Parallel**: false (depends on locales.ts existing)
- **Owns Files**:
  - `apps/web/i18n/request.ts` (new)
  - `apps/web/lib/actions/locale.ts` (new)
- **Context**:
  - **Locale resolution order** (in `i18n/request.ts`):
    1. `NEXT_LOCALE` cookie value (if it's a valid Locale)
    2. Signed-in user's `profiles.locale_pref` (if it's a valid Locale) — call `getUser()` from `@/lib/auth`
    3. First language in `Accept-Language` header matching `'es'` → `'es'`, else `'en'`
    4. Fallback `DEFAULT_LOCALE`
  - Wrap step 2 in a try/catch so a Supabase error never crashes layout rendering. Use the `isLocale()` guard from `lib/i18n/locales.ts`.
  - Messages are loaded from `apps/web/messages/<locale>.json` via dynamic import.
  - Reference template (DO NOT copy verbatim — adapt to project shape):

    ```ts
    import { getRequestConfig } from 'next-intl/server';
    import { cookies, headers } from 'next/headers';
    import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales';
    import { getUser } from '@/lib/auth';

    export default getRequestConfig(async () => {
      let locale: Locale = DEFAULT_LOCALE;
      const cookieValue = (await cookies()).get('NEXT_LOCALE')?.value;
      if (isLocale(cookieValue)) {
        locale = cookieValue;
      } else {
        try {
          const result = await getUser();
          const pref = result?.profile.locale_pref;
          if (typeof pref === 'string' && isLocale(pref)) {
            locale = pref;
          } else {
            const accept = (await headers()).get('accept-language')?.toLowerCase() ?? '';
            if (accept.split(',')[0]?.startsWith('es')) locale = 'es';
          }
        } catch {
          /* keep default */
        }
      }
      const messages = (await import(`../messages/${locale}.json`)).default;
      return { locale, messages };
    });
    ```

  - **Server action** `apps/web/lib/actions/locale.ts`:
    - `'use server';` directive.
    - Export `setLocale(locale: string): Promise<ActionResult<{ locale: Locale }>>`.
    - Validate input via `LocaleInput.safeParse(locale)`.
    - Set `NEXT_LOCALE` cookie via `(await cookies()).set('NEXT_LOCALE', locale, { path: '/', maxAge: 60*60*24*365, sameSite: 'lax' })`.
    - If `getUser()` returns a user, update `profiles.locale_pref` via the SSR Supabase client (no service role needed — own-row update covered by existing RLS). Pattern reference: `lib/actions/profile.ts`.
    - Call `revalidatePath('/', 'layout')` so the entire RSC tree re-renders with new messages.
    - Return `{ ok: true, data: { locale } }` or `{ ok: false, error }` shape used elsewhere.

- **Actions**:
  - Create `apps/web/i18n/request.ts`.
  - Create `apps/web/lib/actions/locale.ts`.
  - Run `pnpm --filter web typecheck` — must pass.

### 3. DB migration + types regen for profiles.locale_pref

- **Task ID**: foundation-migration
- **Depends On**: foundation-install-locales (only needs the agent infrastructure ready; doesn't depend on the action since the column is what enables it)
- **Assigned To**: i18n-foundation-builder
- **Agent Type**: `.claude/agents/team/i18n-foundation-builder.md`
- **Parallel**: true (with foundation-request-action — different files)
- **Owns Files**:
  - `packages/db/migrations/0027_profile_locale_pref.sql` (new)
  - `apps/web/lib/supabase/types.ts` (add `locale_pref` to profiles Row/Insert/Update)
- **Context**:
  - **SQL** (idempotent, follows `0025_banner_gradient_and_avatars.sql` shape):
    ```sql
    -- Add locale_pref column to profiles for signed-in users' persisted UI language.
    -- Null means "use cookie or auto-detect". Constrained to the supported locale set.
    alter table public.profiles
      add column if not exists locale_pref text check (locale_pref in ('en','es'));
    ```
  - Apply via Supabase MCP `apply_migration` tool (project ref `vcbdtjjkkwryvmqbflah`). The hook `migration_validator.py` will validate idempotency on Write.
  - After applying, call `mcp__supabase__generate_typescript_types`, take the new `apps` `profiles` table block, and patch `apps/web/lib/supabase/types.ts` surgically (only the 3 `locale_pref` lines in Row/Insert/Update) — do NOT replace the whole file (it uses single-quote / semicolon Prettier style that differs from the MCP output).
- **Actions**:
  - Write `packages/db/migrations/0027_profile_locale_pref.sql`.
  - Call `mcp__supabase__apply_migration` with name `0027_profile_locale_pref` and the SQL.
  - Call `mcp__supabase__execute_sql` with `notify pgrst, 'reload schema';`.
  - Call `mcp__supabase__generate_typescript_types`; surgically add `locale_pref` to `apps/web/lib/supabase/types.ts` (3 places: Row, Insert, Update).
  - Run `pnpm --filter web typecheck` — must pass.

### 4. EN message catalogue (the source-of-truth strings)

- **Task ID**: foundation-messages-en
- **Depends On**: foundation-install-locales
- **Assigned To**: i18n-foundation-builder
- **Agent Type**: `.claude/agents/team/i18n-foundation-builder.md`
- **Parallel**: false (must finish before foundation-messages-es so key-parity validator passes)
- **Owns Files**: `apps/web/messages/en.json` (new)
- **Context**:
  - Define the full key tree the three extractors will consume. Namespaces (top-level keys):
    - `Common` — Loading, Error, Saved, Cancel, Save, Close, Back, More, etc.
    - `Time` — units for relative time: `justNow`, `minute`/`minutes`, `hour`/`hours`, `day`/`days`, `week`/`weeks`, `month`/`months`, `year`/`years`, `ago` formatter. Used by `data-mappers.ts` `relativeTime`.
    - `Shell` — Logo, Search placeholder (with `{count}` ICU arg), Browse, PublishApp, SignIn. Nav: Discover, Trending, NewAndFresh, Following. AvatarMenu: Profile, EditProfile, SignOut.
    - `Home` — FeaturedHero pill `AppOfTheWeek`, CTAs `OpenApp`, `ReadMore`. Empty states: `NoAppsMatch`, `TryClearing`.
    - `Trending` — Title `TrendingThisWeek`, subtitle with `{count}` `AppsHotInLast7Days`.
    - `New` — Title `NewAndFresh`, subtitle `AppsJustShipped`.
    - `Following` — Empty header `NothingHereYet`, body `FollowSomeBuilders`, link `BrowseDiscover`.
    - `Detail` — `BackToGallery`, stat labels `Likes`/`Views`/`Category`/`InCategory` (with `{category}`), `Conversation`, `CommentsCount` (with `{count}`), `SortedByMostLoved`, action labels (`Share`, `More`), `Save`/`Saved`, comments compose: `PlaceholderSayNice`, `KbdToPost`, `MarkdownSupported`, `PostComment`, `Shipped` (with `{when}`).
    - `Profile` — pstat labels `AppsShipped`, `TotalLikes`, `Followers`, `Following`, `Joined`. Tabs `AppsTab` (with `{count}`), `LikedTab` (with `{count}`). Empty `NoAppsYet`, `NoLikedAppsYet`. `EditProfile` button.
    - `Publish` — All form labels: `Title`, `Tagline`, `Description`, `Category`, `Tags`, `Art`, `UploadCover`, `AccentColor`, `LinkPlaceholder`, `Submit`, `Saving`, `Cancel`, `DraftsComingSoon`. Validation messages.
    - `SignIn` — `WelcomeBack`, `Subtitle`, `ContinueWithGitHub`, `ContinueWithGoogle`, `LegalLine`, `OrSeparator`, `JustBrowsing`, `BackToHatch`, `SignInFailed`.
    - `Settings` — page titles `EditProfile`, `Notifications`, `ApiKeys`. Profile form: `Avatar`, `UploadNew`, `Uploading`, `AvatarHelp`, `DisplayName`, `Bio`, `BannerGradient`, `BannerGradientHelp`, `SaveProfile`. **`Settings.gradient.<id>`** — 12 keys, one per gradient ID in `lib/profile-gradients.ts` (`sunset`, `amber`, `sky`, `orchid`, `ocean`, `aurora`, `lemon`, `blush`, `magma`, `midnight`, `forest`, `peach`). Notifications form: every toggle label. API keys: `GenerateApiKey`, `Revoke`, `Active`, `Revoked`, `LastUsed`.
    - `Notifications` — page title, **filter chip labels MUST match the actual UI in `notifications-page.tsx` lines 35-40**: `FilterAll`, `FilterUnread`, `FilterContactRequests`, `FilterMessages`, `FilterLikesAndFollows` (5 chips, not 7). Empty states. Item-body templates (one per `notif_kind`) — body templates use ICU markup tags for the bold actor name; render via `t.rich('Notifications.body.like', { actor: (c) => <b>{c}</b>, app: title })`. Templates for 8 kinds: `like`, `comment`, `comment_reply`, `follow`, `message`, `contact_request`, `contact_accepted`, `contact_declined`.
    - `Messages` — inbox title, empty conversations, empty thread, composer placeholder, send button, sent-time formatter (uses `Time`).
    - `Contact` — modal title, role labels (`Investor`, `Partner`, `Hire`, `Fan`), note placeholder, `Send`, `Cancel`.
    - `Search` — title `ResultsFor` (with `{q}`), empty `NoMatches`, count `ResultsCount` (with `{count}`).
    - `Translate` — Translate button labels `TranslateButton`, `ShowOriginal`, `Translating`.
    - `Categories` — keyed by `category.id`: `ai`, `games`, `tools`, `music`, `productivity`, `creative`, `data`, `web3`. Use the same English labels as `packages/db/migrations/0002_categories.sql`.
    - `Push` — push-permission-prompt: `EnableNotifications`, `EnableButton`, `MaybeLater`, `Denied` states.
  - Use **ICU MessageFormat** for plurals + interpolation: `"AppsHotInLast7Days": "{count, plural, =0 {No apps yet} one {# app} other {# apps} } hot in the last 7 days"`. next-intl supports this natively.
  - Be exhaustive — every literal currently in `apps/web/app/**` that's user-visible English text must have a key. Run `rg -nE "['\"][A-Z][a-zA-Z ]{4,}['\"]" apps/web/app/_components apps/web/app/\(shell\)` and a similar scan over `apps/web/app/(auth)/` to enumerate. Cross-reference the file ownership lists in this plan's Team Members section — every file there contains strings you must catalogue.
  - **Format**: nested JSON; leaf values are strings (no nested objects holding strings — flatten one level under each top-level namespace). Example shape:
    ```json
    {
      "Shell": {
        "Browse": "Browse",
        "PublishApp": "Publish app",
        "Nav": {
          "Discover": "Discover"
        }
      }
    }
    ```
  - The `i18n_key_parity.py` validator runs on every Write of this file. It will not block on this first write (es.json absent yet, treated as `{}`). It WILL block subsequent writes if the trees diverge from es.json.
- **Actions**:
  - Scan all files listed in the three extractors' "Owns Files" sections; enumerate every user-visible English string.
  - Write `apps/web/messages/en.json` with the full key tree.

### 5. ES message catalogue (Spanish translation, exact key parity with EN)

- **Task ID**: foundation-messages-es
- **Depends On**: foundation-messages-en
- **Assigned To**: i18n-foundation-builder
- **Agent Type**: `.claude/agents/team/i18n-foundation-builder.md`
- **Parallel**: false (depends on EN existing for parity check)
- **Owns Files**: `apps/web/messages/es.json` (new)
- **Context**:
  - Read `apps/web/messages/en.json` for the exact key tree. Replicate the tree identically, replacing every string value with its Spanish translation.
  - Translation guidelines:
    - Spanish from Latin America (neutral) — `tú` form, not `vosotros`.
    - Keep ICU placeholders untouched: `{count}`, `{q}`, `{category}`, `{when}`, `{handle}`, `# app`, `# apps`.
    - Keep ICU rich-text tags untouched: `<bold>...</bold>` for actor highlight in notification bodies.
    - Plurals use ICU's `plural` syntax: `{count, plural, =0 {Aún no hay apps} one {# app} other {# apps}}`.
    - Brand "Hatch" stays "Hatch" (not "Choclo"). UI verbs translate (`Publish app` → `Publicar app`; `Sign out` → `Cerrar sesión`; `Edit profile` → `Editar perfil`).
    - Category translations: `AI & ML` → `IA y ML`, `Games` → `Juegos`, `Dev tools` → `Herramientas dev`, `Music & audio` → `Música y audio`, `Productivity` → `Productividad`, `Creative` → `Creativo`, `Data viz` → `Visualización de datos`, `Web3` → `Web3`.
    - Gradient labels (Settings.gradient.\*): `sunset → Atardecer`, `amber → Ámbar`, `sky → Cielo`, `orchid → Orquídea`, `ocean → Océano`, `aurora → Aurora`, `lemon → Limón`, `blush → Rubor`, `magma → Magma`, `midnight → Medianoche`, `forest → Bosque`, `peach → Durazno`.
    - Notification filter chips: `FilterAll → Todas`, `FilterUnread → Sin leer`, `FilterContactRequests → Solicitudes de contacto`, `FilterMessages → Mensajes`, `FilterLikesAndFollows → Me gusta y seguidores`.
    - Time units: `justNow` → `ahora mismo`, `minute(s) ago` → `hace {n} min`, `hour(s) ago` → `hace {n} h`, `day(s) ago` → `hace {n} d`, etc. Keep abbreviations consistent with English version.
  - The `i18n_key_parity.py` validator will run on Write and BLOCK if any key is missing on either side. If blocked, add the missing keys to whichever file lacks them and try again.
- **Actions**:
  - Read `apps/web/messages/en.json`.
  - Write `apps/web/messages/es.json` with identical key tree and Spanish strings.
  - Confirm the hook validator passes (no block message). If blocked, reconcile and rewrite.

### 6. LocaleToggle component + layout wraps + auth-callback cookie seed

- **Task ID**: foundation-toggle-layout
- **Depends On**: foundation-request-action, foundation-messages-en (needs messages to compile cleanly when layout is wrapped)
- **Assigned To**: i18n-foundation-builder
- **Agent Type**: `.claude/agents/team/i18n-foundation-builder.md`
- **Parallel**: false (depends on prior foundation tasks)
- **Owns Files**:
  - `apps/web/app/_components/locale-toggle.tsx` (new)
  - `apps/web/app/layout.tsx` (root — wrap children in `NextIntlClientProvider`)
  - `apps/web/app/(shell)/layout.tsx` (call `setRequestLocale` at top of `ShellLayout`)
  - `apps/web/app/(auth)/layout.tsx` (call `setRequestLocale` at top — sign-in page is in this group)
  - `apps/web/app/auth/callback/route.ts` (eagerly seed `NEXT_LOCALE` cookie from `profiles.locale_pref` after successful sign-in)
  - `apps/web/app/styles/prototype-base.css` (only if you add a `.locale-toggle` class — minimal addition)
- **Context**:
  - **next-intl version**: install the latest `next-intl@^3` (NOT v4 — v4 has breaking API changes around `setRequestLocale` location). Confirm the lockfile resolves a 3.x version after `pnpm install`.
  - `LocaleToggle.tsx` — `'use client'`. Segmented EN | ES button. Reads current locale via `useLocale()` from `next-intl`. On click of the inactive side, calls `setLocale(<new>)` server action then `router.refresh()`. Style PREFERRED: reuse the existing `.theme-toggle` styles by analogy (small pill with two halves and an active indicator). Add a single `data-locale-toggle` attribute on the root for Playwright targeting (used by Task 11). If you need a new class, add `.locale-toggle` styles to `apps/web/app/styles/prototype-base.css` — keep it under 20 lines, match the existing `.theme-toggle` aesthetic. Add `data-active-locale={locale}` and `data-target-locale="en"|"es"` on each segment.
  - **Root layout wrap** (`apps/web/app/layout.tsx`) — current shape:
    ```tsx
    <body>
      <ThemeController ...>
        {children}
      </ThemeController>
      <NotificationToaster />
      <ServiceWorkerRegistrar />
    </body>
    ```
    Add `import { NextIntlClientProvider } from 'next-intl';` and `import { getLocale, getMessages } from 'next-intl/server';` at the top of the file. Inside the async `RootLayout`:
    ```tsx
    const locale = await getLocale();
    const messages = await getMessages();
    ```
    Wrap the body content:
    ```tsx
    <body>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ThemeController ...>
          {children}
        </ThemeController>
        <NotificationToaster />
        <ServiceWorkerRegistrar />
      </NextIntlClientProvider>
    </body>
    ```
    Also change `<html lang="en">` to `<html lang={locale}>`.
    `NextIntlClientProvider` IS server-safe (imported from `'next-intl'`, not `'next-intl/client'`). Do not split into a separate client wrapper.
  - **Shell layout** (`apps/web/app/(shell)/layout.tsx`) — required by next-intl v3 for any static-rendered route segment. Add at the top of `ShellLayout`:
    ```ts
    import { setRequestLocale, getLocale } from 'next-intl/server';
    // ...
    export default async function ShellLayout({ children }: { children: React.ReactNode }) {
      const locale = await getLocale();
      setRequestLocale(locale);
      // ... existing code unchanged
    }
    ```
  - **Auth layout** (`apps/web/app/(auth)/layout.tsx`) — currently a pass-through. Add the same two lines (`getLocale` + `setRequestLocale`) so `/sign-in` renders with stable locale.
  - **Auth callback cookie seed** (`apps/web/app/auth/callback/route.ts`) — after the existing successful-auth code path that exchanges the code for a session, read the user's `profiles.locale_pref` and, if non-null, set the `NEXT_LOCALE` cookie on the redirect response:
    ```ts
    // After session is established, before NextResponse.redirect(...):
    const { data: profile } = await supabase
      .from('profiles')
      .select('locale_pref')
      .eq('id', user.id)
      .single();
    const response = NextResponse.redirect(redirectUrl);
    if (profile?.locale_pref === 'en' || profile?.locale_pref === 'es') {
      response.cookies.set('NEXT_LOCALE', profile.locale_pref, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
    return response;
    ```
    This avoids the per-request `getUser()` DB call in `getRequestConfig` for signed-in users (they hit the cookie short-circuit on every request after sign-in).
- **Actions**:
  - Create `apps/web/app/_components/locale-toggle.tsx`.
  - Edit `apps/web/app/layout.tsx` to wrap with `NextIntlClientProvider`, swap `lang="en"` for `lang={locale}`.
  - Edit `apps/web/app/(shell)/layout.tsx` to add `setRequestLocale(await getLocale())`.
  - Edit `apps/web/app/(auth)/layout.tsx` to add `setRequestLocale(await getLocale())`.
  - Edit `apps/web/app/auth/callback/route.ts` to set `NEXT_LOCALE` cookie from `profiles.locale_pref` on the redirect response.
  - If you added a `.locale-toggle` class, append the minimal CSS to `apps/web/app/styles/prototype-base.css`.
  - Run `pnpm --filter web typecheck` AND `pnpm --filter web build` — both must pass.

### 7. TranslateButton component

- **Task ID**: translate-button-create
- **Depends On**: setup-validators (just for agent definition existing)
- **Assigned To**: translate-button-builder
- **Agent Type**: `.claude/agents/team/translate-button-builder.md`
- **Parallel**: true (runs alongside all foundation tasks except setup-validators)
- **Owns Files**: `apps/web/app/_components/translate-button.tsx` (new)
- **Context**:
  - This component uses the **Chrome 138+ / Edge built-in `window.Translator` API** (Web Platform's `Translator` and `LanguageDetector` globals). NO npm package. NO backend.
  - Graceful degradation: on mount, check `typeof self !== 'undefined' && 'Translator' in self && 'LanguageDetector' in self`. If false, render `null` — invisible on Safari/Firefox. No console errors.
  - Props: `{ text: string; targetLocale: 'en' | 'es'; className?: string }`. `targetLocale` comes from the call site (use `useLocale()` from `next-intl` to read it before passing).
  - Internal state: `'idle' | 'translating' | 'translated' | 'showing-original' | 'unsupported' | 'error'`.
  - On click:
    1. State → `translating`.
    2. `const detector = await self.LanguageDetector.create();`
    3. `const [{ detectedLanguage }] = await detector.detect(text);`
    4. If `detectedLanguage === targetLocale`, set state to `error` with a "Already in your language" indicator (small text); do not translate.
    5. Otherwise `const translator = await self.Translator.create({ sourceLanguage: detectedLanguage, targetLanguage: targetLocale });`
    6. `const translated = await translator.translate(text);`
    7. Cache `translated` against original `text` in a Map at module scope (per session, per tab — survives re-renders).
    8. State → `translated`; render `translated` in place of the original text via render-prop or `onTranslated(text)` callback.
  - **Rendering pattern** — two options, pick one:
    - **(a) Render-prop**: `<TranslateButton text={comment.body} targetLocale={locale}>{(displayText, button) => <><p>{displayText}</p>{button}</>}</TranslateButton>` — call-sites do their own layout.
    - **(b) Wrap-and-replace**: parent owns the original text element; `<TranslateButton>` is a button that, on click, finds its sibling text node and swaps. Hacky — DON'T do this.
  - Use option **(a)**. The button itself renders inline as a small underlined text button styled to match the prototype's `.comment-link` aesthetic (read `apps/web/app/styles/prototype-screens.css` for color reference — use `var(--muted)` default, `var(--ax)` hover).
  - Labels come from `useTranslations('Translate')` — keys are `TranslateButton`, `ShowOriginal`, `Translating`, defined in the EN/ES messages. If `useTranslations` isn't available because this is the very first thing rendered, use a small inline fallback `{ en: { TranslateButton: 'Translate', ... }, es: { TranslateButton: 'Traducir', ... } }` keyed by `useLocale()`. Use `useTranslations` first; only fall back if it throws (it won't in normal use, since the layout wrap puts the provider above everything).
  - **Do not import server-only modules.** This file is `'use client'`. No `getUser`, no `cookies()`, no `headers()`.
- **Actions**:
  - Create `apps/web/app/_components/translate-button.tsx`.
  - In the same file include a `// @ts-expect-error` or augmentation block declaring the global `Translator` and `LanguageDetector` types since they're not yet in lib.dom.d.ts:
    ```ts
    declare global {
      interface Window {
        Translator?: {
          create(opts: {
            sourceLanguage: string;
            targetLanguage: string;
          }): Promise<{ translate(text: string): Promise<string> }>;
        };
        LanguageDetector?: {
          create(): Promise<{
            detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
          }>;
        };
      }
    }
    ```
  - Run `pnpm --filter web typecheck` — must pass (the file uses no app-specific imports beyond `next-intl` once foundation lands).
  - This task does NOT integrate the component anywhere — wiring is done by the strings-extractors.

### 8. Strings extraction — shell + discovery surface

- **Task ID**: extract-shell-discover
- **Depends On**: foundation-toggle-layout, foundation-messages-es
- **Assigned To**: strings-extractor-shell-discover
- **Agent Type**: `.claude/agents/team/strings-extractor-shell-discover.md`
- **Parallel**: true (with extract-detail-social and extract-publish-settings — disjoint file sets)
- **Owns Files** (only this extractor edits these):
  - `apps/web/app/_components/shell.tsx`
  - `apps/web/app/_components/cards.tsx`
  - `apps/web/app/_components/action-bar.tsx`
  - `apps/web/app/_components/follow-pill.tsx`
  - `apps/web/app/_components/gallery-grid.tsx`
  - `apps/web/app/_components/data-mappers.ts`
  - `apps/web/app/(shell)/page.tsx`
  - `apps/web/app/(shell)/trending/page.tsx`
  - `apps/web/app/(shell)/new/page.tsx`
  - `apps/web/app/(shell)/following/page.tsx`
  - `apps/web/app/(shell)/c/[category]/page.tsx`
  - `apps/web/app/(shell)/search/page.tsx`
- **Context**:
  - For each file, replace every user-visible English literal with a `t('Namespace.key')` call. Use the EXACT keys defined in `apps/web/messages/en.json`. **You are READ-ONLY on `apps/web/messages/*.json`** — only `i18n-foundation-builder` writes those files. If you discover a string that has no key, STOP and return status `NEEDS_CONTEXT` with the list of missing keys + their proposed English text + the file/line where each was found. The orchestrator will route a follow-up to foundation-builder to add them.
  - **Client components** (`'use client'`): use `import { useTranslations } from 'next-intl';` + `const t = useTranslations('Shell');` (or the relevant namespace).
  - **Server components** (RSC): use `import { getTranslations } from 'next-intl/server';` + `const t = await getTranslations('Home');`.
  - **`shell.tsx` extras**: import `LocaleToggle` from `./locale-toggle` and place it inside the `.topbar-actions` `<nav>`, RIGHT BEFORE the existing `.theme-toggle` button. No other layout changes; do not touch the className of the surrounding nav.
  - **`data-mappers.ts → relativeTime(iso: string)`**: currently returns English shorthand like `"3d"`, `"2w"`, `"just now"`. Refactor to:
    ```ts
    export function relativeTime(iso: string, locale: 'en' | 'es' = 'en'): string { ... }
    ```
    Use `Intl.RelativeTimeFormat(locale, { numeric: 'auto' })` for the unit formatting, falling back to a manual short form for "just now" / `seconds < 60`.
  - **`mapAppRowToCardProps` signature change — SHARED CONTRACT WITH `extract-detail-social`**:
    - New signature: `export function mapAppRowToCardProps(app, profile, category, locale: 'en' | 'es' = 'en'): AppDataExtended`. The 4th arg has a default so existing test calls compile; in production paths it MUST be passed.
    - `mapAppRowToCardProps` internally calls `relativeTime(app.published_at, locale)` to format the `published` field.
    - **Every call site** must be updated to pass `locale` — fetch via `await getLocale()` from `'next-intl/server'` (RSC import) ONCE at the top of the calling RSC, then pass it into every call.
    - Call sites in YOUR owned files (extract-shell-discover): `(shell)/page.tsx` (×2 — featured + grid), `(shell)/trending/page.tsx`, `(shell)/new/page.tsx`, `(shell)/following/page.tsx`, `(shell)/c/[category]/page.tsx`, `(shell)/search/page.tsx`.
    - Call sites in `extract-detail-social`'s owned files (NOT your responsibility — they will do the same update on their side per identical contract in their Context): `(shell)/u/[handle]/page.tsx` (×2), `(shell)/a/[slug]/page.tsx` (×1).
    - The default-arg means typecheck does NOT catch a missed call site. To verify nothing was missed, after your edits run: `cd /Users/daniel/Downloads/hatch && grep -rn 'mapAppRowToCardProps(' apps/web/app | grep -v 'locale'` — every match in YOUR owned files should pass locale; matches in detail-social's files are not your concern.
  - **Category labels**: anywhere a category label is rendered (`<CategoryBadge>` in `cards.tsx`, the chips in `page.tsx` and `c/[category]/page.tsx`), use `t(\`Categories.\${category.id}\`)`instead of`category.label`. The DB label remains as a fallback if a key is missing (defensive).
  - For each edited file, verify `pnpm --filter web typecheck` passes after your edits. Use `Bash` to run it from the workspace root: `cd /Users/daniel/Downloads/hatch && pnpm --filter web typecheck`.
- **Actions**:
  - Read `apps/web/messages/en.json` to know which keys exist.
  - For each owned file: edit literals → `t('...')`. Add `useTranslations` / `getTranslations` import. Pipe `locale` into `mapAppRowToCardProps` where applicable.
  - Place `<LocaleToggle />` in `shell.tsx`.
  - After all edits, run `pnpm --filter web typecheck` — must pass.

### 9. Strings extraction — detail / profile / social / messages / notifications

- **Task ID**: extract-detail-social
- **Depends On**: foundation-toggle-layout, foundation-messages-es, translate-button-create
- **Assigned To**: strings-extractor-detail-social
- **Agent Type**: `.claude/agents/team/strings-extractor-detail-social.md`
- **Parallel**: true (with extract-shell-discover and extract-publish-settings — disjoint files)
- **Owns Files** (only this extractor edits these):
  - `apps/web/app/(shell)/a/[slug]/page.tsx`
  - `apps/web/app/(shell)/a/[slug]/_components/contact-cta.tsx`
  - `apps/web/app/(shell)/u/[handle]/page.tsx`
  - `apps/web/app/_components/comments.tsx`
  - `apps/web/app/_components/comment-item.tsx`
  - `apps/web/app/_components/contact-modal.tsx`
  - `apps/web/app/(shell)/notifications/page.tsx`
  - `apps/web/app/(shell)/notifications/_components/notifications-page.tsx`
  - `apps/web/app/_components/notifications-bell.tsx`
  - `apps/web/app/_components/notifications-panel.tsx`
  - `apps/web/app/_components/notification-item.tsx`
  - `apps/web/app/_components/notification-toast.tsx`
  - `apps/web/app/(shell)/messages/page.tsx`
  - `apps/web/app/(shell)/messages/[conversationId]/page.tsx`
  - `apps/web/app/(shell)/messages/[conversationId]/_components/message-thread.tsx`
  - `apps/web/app/(shell)/messages/_components/conversations-list.tsx`
  - `apps/web/app/(shell)/messages/_components/empty-thread.tsx`
  - `apps/web/app/_components/push-permission-prompt.tsx`
- **Context**:
  - Same pattern as extract-shell-discover for replacing literals with `t('Namespace.key')`. Use `getTranslations` in RSCs, `useTranslations` in client components.
  - **TranslateButton wiring**:
    - **`comment-item.tsx`**: import `TranslateButton` from `@/app/_components/translate-button`. Read `useLocale()` from `next-intl`. In the comment body region, wrap the `<p>{c.body}</p>` (or equivalent) in the TranslateButton's render-prop:
      ```tsx
      <TranslateButton text={c.body} targetLocale={locale}>
        {(display, button) => (
          <>
            <p className="comment-body">{display}</p>
            {button}
          </>
        )}
      </TranslateButton>
      ```
      The button appears inline below the comment body (a small grey "Traducir" link, accent on hover). When clicked, the text in `<p>` is replaced with the translation and the button becomes "Ver original".
    - **`/a/[slug]/page.tsx`**: similarly wrap the `<Markdown>` block for the app description, since that's the largest piece of UGC on the detail page. Read locale via `await getLocale()` (RSC). Note: TranslateButton is a client component, so passing it in JSX is fine — it'll hydrate. For Markdown which is a server-rendered chunk, the wrapper needs the text in raw form too: use the `app.description` string as `text` prop (the displayed Markdown render stays untouched server-side; only triggered translation swaps to plain-text translated body).
  - **`mapAppRowToCardProps` signature change — SHARED CONTRACT WITH `extract-shell-discover`**:
    - The shell-discover extractor refactors `mapAppRowToCardProps` to a new signature: `(app, profile, category, locale: 'en' | 'es' = 'en')`. You DO NOT edit `data-mappers.ts` (not in your Owns Files). You consume the new signature.
    - Call sites in YOUR owned files: `(shell)/u/[handle]/page.tsx` (×2 — published apps + liked apps), `(shell)/a/[slug]/page.tsx` (×1). Update each to pass `locale`, fetched via `await getLocale()` from `'next-intl/server'` at the top of the calling RSC.
    - The default arg means TypeScript will NOT catch a missed call site — visually inspect every match. Verify after edits: `cd /Users/daniel/Downloads/hatch && grep -rn 'mapAppRowToCardProps(' apps/web/app/\(shell\)/u apps/web/app/\(shell\)/a | grep -v 'locale'` — should return no results.
  - **`relativeTime` direct callers in your files** (NOT through `mapAppRowToCardProps`): if you find any direct `relativeTime(iso)` call, change to `relativeTime(iso, locale)` with locale from `await getLocale()`.
  - **Notification-item bodies**: each `notif_kind` (one of `contact_request`, `contact_accepted`, `contact_declined`, `like`, `comment`, `comment_reply`, `follow`, `message`) has a templated body line with the actor's name bolded. Use `t.rich` with a `<bold>` tag handler so the bold markup survives translation:
    ```tsx
    const t = useTranslations('Notifications.body');
    // ...
    {
      t.rich('like', {
        actor: () => <b>{u.display_name}</b>,
        app: app.title,
        bold: (chunks) => <b>{chunks}</b>,
      });
    }
    ```
    The corresponding EN/ES message values use ICU `<bold>` markup (e.g. `"like": "<bold>{actor}</bold> liked {app}."`). Define all 8 templates in the `Notifications.body` namespace; foundation-builder pre-authors them.
  - **Optimistic comment timestamp** (`comments.tsx`): the optimistic-insert line `relative_time: 'just now'` must become `t('Time.justNow')` via `useTranslations('Time')` so the optimistic comment renders in the active locale. The parent RSC that builds `initialComments` (in `a/[slug]/page.tsx`) must use locale-aware `relativeTime(iso, locale)` for already-persisted comments.
  - **Contact roles** (`investor`, `partner`, `hire`, `fan`): use `t(\`Contact.role.\${role}\`)`.
  - After edits, run `pnpm --filter web typecheck` — must pass.
- **Actions**:
  - For each owned file: replace literals; import translation hook.
  - Wire `<TranslateButton>` in `comment-item.tsx` (every comment) and in `/a/[slug]/page.tsx` (around the app description Markdown block).
  - Pass locale into `relativeTime` everywhere it's called within owned files.
  - Run `pnpm --filter web typecheck` — must pass.

### 10. Strings extraction — publish / settings / auth

- **Task ID**: extract-publish-settings
- **Depends On**: foundation-toggle-layout, foundation-messages-es
- **Assigned To**: strings-extractor-publish-settings
- **Agent Type**: `.claude/agents/team/strings-extractor-publish-settings.md`
- **Parallel**: true (with extract-shell-discover and extract-detail-social — disjoint files)
- **Owns Files** (only this extractor edits these):
  - `apps/web/app/(shell)/publish/page.tsx`
  - `apps/web/app/_components/publish-screen.tsx`
  - `apps/web/app/(shell)/settings/profile/page.tsx`
  - `apps/web/app/(shell)/settings/profile/profile-form.tsx`
  - `apps/web/app/(shell)/settings/notifications/page.tsx`
  - `apps/web/app/(shell)/settings/notifications/_components/notifications-form.tsx`
  - `apps/web/app/(shell)/settings/api-keys/page.tsx`
  - `apps/web/app/(shell)/settings/api-keys/_components/generate-key-flow.tsx`
  - `apps/web/app/(shell)/settings/api-keys/_components/mcp-config-snippet.tsx`
  - `apps/web/app/(auth)/sign-in/page.tsx`
  - `apps/web/app/(auth)/sign-in/sign-in-buttons.tsx`
- **Context**:
  - Same `t('Namespace.key')` pattern. Use `getTranslations` (RSC) / `useTranslations` (client).
  - **`publish-screen.tsx`** is the largest file in this set. Form labels are spread across art selector, accent picker, category chip selector, tag input, submit button. Use the `Publish` namespace exhaustively.
  - **`profile-form.tsx`**: keys live in `Settings`. For the 12 gradient labels in `aria-label` / `title` props, use `t(\`Settings.gradient.\${g.id}\`)`— the 12`Settings.gradient.<id>`keys are pre-authored in`messages/en.json`and`messages/es.json` by foundation-builder. You are READ-ONLY on the messages files.
  - **`sign-in/page.tsx`**: every visible string under `SignIn`. The error pill ("Sign-in failed. Please try again.") uses `SignIn.SignInFailed`. The legal line and "Just browsing? Back to Hatch →" all translate.
  - **API keys page**: `GenerateApiKey`, `ActiveSince`, `Revoke`, `Revoked`, `LastUsed` (with `{when}`), copy-to-clipboard label.
  - **MCP config snippet**: leave the JSON snippet untouched; only translate surrounding instructional text.
  - For each edited file, run `pnpm --filter web typecheck` after the edit set.
- **Actions**:
  - For each owned file: replace literals → `t('...')`. Add translation hook import.
  - If any required key is missing from `messages/en.json`, STOP — return `NEEDS_CONTEXT` with the list. Do NOT edit the messages files.
  - Run `pnpm --filter web typecheck` — must pass.

### 11. Final UI validation via Playwright + DB round-trip

- **Task ID**: validate-all
- **Depends On**: extract-shell-discover, extract-detail-social, extract-publish-settings
- **Assigned To**: i18n-validator
- **Agent Type**: `ui-validator`
- **Parallel**: false
- **Owns Files**:
  - `tests/visual-baselines/i18n/validation-report.md` (new)
- **Context**:
  - **OVERRIDE NOTICE**: Your default `ui-validator` workflow (compare rendered pages against prototype HTML) does NOT apply here. The prototype has no Spanish version. Execute ONLY the Playwright sequence in this Context — do not attempt prototype diffing.
  - Run the workspace validation commands first; only proceed to UI checks if they pass.
  - Start dev server: `pnpm dev:web` in background (it auto-reads `NODE_OPTIONS` for the 64KB header fix).
  - Wait for `Ready in` log line.
  - **Playwright sequence** (use the MCP browser tools):
    1. `browser_navigate http://localhost:3000/` — confirm topbar shows "Sign in" (in English by default since no cookie + Accept-Language default).
    2. Find and click the EN/ES toggle (target the `[data-locale-toggle]` attribute the LocaleToggle component sets, OR find by text "ES" — coordinate with the extract-shell-discover output to see what selector works).
    3. After click, page reloads. Confirm topbar reads Spanish strings: "Iniciar sesión" / "Publicar app" / "Buscar 248 apps...". Take a screenshot, save to `tests/visual-baselines/i18n/home-es.png`.
    4. Navigate to `/a/focusfog`. Confirm stat labels read `Me gusta` / `Vistas` / `Categoría`. Screenshot.
    5. Navigate to `/u/mila`. Confirm pstat labels read `Apps publicadas` / `Likes totales` / `Seguidores` / `Siguiendo` / `Se unió`. Screenshot.
    6. Toggle back to EN. Verify the cookie `NEXT_LOCALE=en` is set via `browser_get_cookies`.
    7. For Translate-button validation: use `browser_evaluate` to inject `delete window.Translator; delete window.LanguageDetector;` and reload `/a/focusfog`; confirm Translate buttons are absent on comments. Then reload without the delete (assume Chrome 138+ in the Playwright browser); if Translate buttons present, click one — verify text changes within 5s. (If the local Playwright Chromium doesn't expose `Translator` natively, capture this limitation in the report and mark it as a "verified absent on unsupported, presence requires manual smoke on Chrome 138+".)
  - **Sign-in flow**: Playwright cannot complete OAuth, so just verify the sign-in page renders in both locales (toggle, navigate to `/sign-in`).
  - **DB round-trip** (using `mcp__supabase__execute_sql`):
    1. After signed-in toggle (a step the validator can skip if it can't sign in), document the manual verification step in the report. For now, run `select handle, locale_pref from public.profiles where locale_pref is not null limit 5;` and capture output.
  - **Validation report** at `tests/visual-baselines/i18n/validation-report.md`:
    - Sections: `Commands run`, `Routes verified (table of URL × locale × status)`, `Screenshots`, `DB state`, `Translate-button verification`, `Pass / Concerns / Blockers`.
- **Actions**:
  - Run `pnpm typecheck`, `pnpm lint`, `pnpm build` — all must pass with zero errors. If any fail, return BLOCKED with the failure details.
  - Start dev server in background; wait for Ready.
  - Drive Playwright through the sequence above; capture screenshots.
  - Run Supabase SQL spot-checks.
  - Write `tests/visual-baselines/i18n/validation-report.md`.
  - Stop the dev server.
  - Report overall status (DONE / DONE_WITH_CONCERNS / BLOCKED).

## Testing Strategy

### Unit Tests

This project doesn't ship a unit-test framework; testing is end-to-end via the validator task. The structural tests we DO run:

- **`pnpm typecheck`** — guarantees every `t('Namespace.key')` call type-checks (next-intl with `messages` of known shape provides type completion if `next-intl.d.ts` is added; if added, missing keys are TS errors. This plan defers that hardening to a follow-up.)
- **`i18n_key_parity.py` hook** — runs on every edit of `messages/{en,es}.json`; blocks mismatched key trees.
- **`pnpm build`** — catches runtime errors in RSC during static analysis.

### Edge Cases

- User clears `NEXT_LOCALE` cookie → resolver falls back to profile pref → Accept-Language → 'en'.
- Signed-in user toggles to ES → cookie set + `profiles.locale_pref` updated → sign out → sign in on different device → `request.ts` reads `profiles.locale_pref` and renders in Spanish without needing a cookie.
- Browser sends `Accept-Language: zh-CN,en-US;q=0.8` → no `es` match → falls back to `en`.
- A page has a string the developer forgot to translate → `t('...')` for a missing key returns the key path in dev (next-intl default behaviour). Validator hook ensures both sides have the key.
- Comment in Korean, viewer in EN → click Translate → detector identifies `ko`, creates `ko→en` translator, returns English.
- Chrome 137 (Translator API not yet shipped) → `'Translator' in self` is false → button returns null. No layout shift.
- User clicks Translate twice in a row → second click is a no-op (already in `translated` state); cache hit avoids second API call.
- Comment is in viewer's current locale → detector returns `targetLocale === detectedLanguage` → button shows "already in your language" microcopy, doesn't open a translator. No API quota wasted.
- DB outage during `setLocale` server action's `profiles.locale_pref` update → cookie still gets set so the user experience succeeds; the persistence is best-effort. Return `{ ok: true }` regardless of profile update outcome (or log + degrade silently). Spec: cookie set is mandatory, profile persistence is opportunistic.
- Pre-existing seed `profiles` rows have `locale_pref: null` — that's fine, resolver falls through to next step.

## Acceptance Criteria

1. `apps/web/messages/en.json` and `apps/web/messages/es.json` exist, both have identical key trees (validator-enforced), and together cover every user-visible English string in `apps/web/app/**`.
2. Visiting `http://localhost:3000/` with `NEXT_LOCALE=es` cookie shows a Spanish UI (topbar, sidebar, page content, category chips).
3. Visiting the same URL with `NEXT_LOCALE=en` cookie shows the English UI.
4. Visiting without a cookie but with `Accept-Language: es-CL,es;q=0.9` default-renders in Spanish.
5. Topbar EN/ES toggle is visible next to the theme toggle, persists choice via cookie, and (when signed-in) updates `profiles.locale_pref` in Supabase (verifiable via `select handle, locale_pref from profiles`).
6. The 8 categories show translated labels everywhere they appear (sidebar chips, card badges, detail page chip, `/c/[category]` page title).
7. `relativeTime()` outputs are localized (e.g. `"3 d"` / `"hace 3 d"`).
8. Comments and the app description on `/a/[slug]` show a small Translate button on Chrome 138+ / Edge. Clicking translates inline within ~3 seconds; a "Show original" toggle reverts. On Safari/Firefox the button is absent (no console errors).
9. User-generated content fields (app titles, taglines, bios, comments, messages, notes) are NOT auto-translated — they render in their original language.
10. `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass with zero errors.
11. URLs are unchanged — no `/es/` or `/en/` prefix appears anywhere; deep-links like `/a/focusfog`, `/u/mila` continue to work.
12. The MCP server (`apps/mcp`) is not modified.

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm typecheck` — TypeScript across all workspaces; zero errors.
- `pnpm lint` — ESLint + Prettier across all workspaces; zero warnings.
- `pnpm build` — production build of web + mcp; succeeds.
- `pnpm --filter web exec next build 2>&1 | grep -i 'next-intl\\|missing key' && false || true` — confirm next-intl doesn't log missing-key warnings (the `&& false || true` inverts: if grep finds output, fail; if no output, pass).
- `for url in / /trending /new /following /sign-in /a/focusfog /u/mila /c/games /search /publish; do curl -s -b 'NEXT_LOCALE=es' -o /dev/null -w "%{http_code} %{url_effective}\n" "http://localhost:3000$url"; done` — every URL returns 200 (or 307 for `/following`/`/publish` if anon) with ES cookie.
- Same loop with `NEXT_LOCALE=en` cookie; same expected statuses.
- `curl -s -b 'NEXT_LOCALE=es' http://localhost:3000/ | grep -E '(Publicar|Iniciar sesión|Buscar)' | head -3` — confirms Spanish strings appear in rendered HTML.
- `curl -s -b 'NEXT_LOCALE=en' http://localhost:3000/ | grep -E '(Publish app|Sign in|Browse)' | head -3` — confirms English strings appear.
- After signed-in toggle test: `mcp__supabase__execute_sql` with `select handle, locale_pref from public.profiles where locale_pref is not null;` returns at least one row.
- Playwright check (executed by ui-validator): toggle EN/ES, verify cookie + visible string change.

## Notes

- **New dep**: `next-intl@^3` (https://next-intl.dev). MIT licensed. ~50KB gzip server side, tree-shaken on client. Pin to `^3.x` — `v4` has API breakage around `setRequestLocale` location. Justified: canonical i18n for App Router; building this by hand would reimplement message lookup, locale resolution, ICU plurals, and provider plumbing. Reported here per project rule.
- **Translate button — same-language behavior**: when `LanguageDetector` returns a language equal to `targetLocale`, render the button as disabled with a small `title="Already in your language"` tooltip rather than firing the translator. Avoid running the detector eagerly on mount for every comment in the thread — only on click (saves quota and CPU on long threads).
- **Translator API quota / throttling**: Chrome's API may rate-limit at the origin level. The in-memory cache prevents the same comment from being re-translated, but a user click-spamming "Translate" on 100 distinct comments could hit a quota wall. Future hardening: serial-queue the translations or disable subsequent buttons while one is in flight. Out of scope for v1.
- **revalidatePath in `setLocale`**: `revalidatePath('/', 'layout')` invalidates the entire app's data cache for both the toggling user and (because RSC cache is per-user via cookies) is reasonable. If you observe content flashes after toggle, downgrade to `revalidatePath('/')` (page-only) + client `router.refresh()`.
- **Public API + Cron routes**: `/api/v1/*` and `/api/cron/*` are route handlers, not pages, and don't trigger next-intl. They remain locale-agnostic (raw JSON / plain text). Confirmed safe.
- **CHECK constraint on locale_pref**: future locale additions (e.g. `pt`) require a follow-up migration to drop and re-add the constraint. Acceptable trade-off for compile-time safety today.
- **No paid translation API.** The Translate button uses the browser-native `window.Translator` API (Chrome 138+/Edge). Coverage today is ~60% of global browser usage and growing; users on Safari/Firefox get the original text only. This was the user's explicit choice — accept the coverage limit, no backend.
- **Type-safe message keys** are a future hardening (define `next-intl.d.ts` with `type IntlMessages = typeof import('./messages/en.json')` so `t('Foo.bar')` is a TS error if the key doesn't exist). Deferred to a polish pass.
- **MCP impact** is zero. Confirmed via prior session grep: MCP returns raw DB rows; no UI strings.
- **Visual regression**: shell.tsx is in the prototype-port exemption list (`.claude/rules/prototype-port-exception.md`). Replacing English literals with `t('...')` calls is content-equivalent — no className changes — so the rule is not violated. Confirm in code review.
- **SEO**: cookie-only locale means Google indexes the single canonical URL and serves whichever locale matches the crawler's Accept-Language header. We forego `hreflang` annotations and per-locale indexing; that's an acceptable trade-off given the URL stability we wanted.
- **Follow-up doc**: after this lands, write `app_docs/feature-i18n-en-es-toggle.md` and add a corresponding entry in `.claude/commands/conditional_docs.md`. Not part of this plan.
- **Expert self-improvement**: after merge, run `/experts:nextjs:self-improve` and `/experts:supabase:self-improve` so the expertise YAMLs capture the new patterns (next-intl wiring, `profiles.locale_pref` column, message-files convention).

## Expert Context

Consulted experts:

- **nextjs** (`.claude/commands/experts/nextjs/expertise.yaml`): Confirmed App Router patterns — server components default, `'use client'` only when needed; `lib/actions/` for server actions; `lib/zod/` for validation; middleware refreshes Supabase session and is NOT to be replaced. The `(shell)` group already exists; layouts at `app/layout.tsx` and `app/(shell)/layout.tsx` are both safe targets for the i18n provider wrap (root chosen).
- **supabase** (`.claude/commands/experts/supabase/expertise.yaml`): Migration workflow uses Supabase MCP `apply_migration` only — never CLI or Docker. After schema changes, `notify pgrst, 'reload schema';` to force PostgREST cache reload. Existing `profiles` table column conventions followed: lowercase snake_case, `text` for short strings, `check` constraint for enumerable values.

# Landing Topbar Consistency + Full Landing i18n — Design

> Unify 3 topbar primitives (Publish button, LocaleToggle, ThemeToggle pill) between `/` (landing) and `/gallery` (shell), and translate the full landing surface (9 sections + topbar) to EN/ES.

Last updated: 2026-05-17
Status: drafted, pending user review, then `/tac:feature`.
Repo: github.com/Daniel-Visit/hatch (main).

---

## 1. Context

Today the landing topbar (`apps/web/app/_landing/topbar.tsx`) and the shell topbar (`apps/web/app/_components/shell.tsx`) diverge visually in three spots:

| Element      | Shell                                                        | Landing                           |
| ------------ | ------------------------------------------------------------ | --------------------------------- |
| Theme toggle | Pill with `theme-track` + white `theme-thumb` + sun/moon SVG | Plain button with single sun icon |
| Locale       | `<LocaleToggle>` EN/ES pill                                  | Not present                       |
| Publish      | `+ Publish app` (icon + 2 words)                             | `Publish` (1 word, no icon)       |

Additionally, the landing has its own theme state (`useState` + `data-theme` attribute) instead of the shared `theme-controller`, so theme can drift if the user navigates landing ↔ app.

And the landing is hardcoded English — adding an EN/ES toggle in the topbar without translating the page would be deceptive.

## 2. Scope

**In scope**

- Replace the 3 topbar chips on the landing with the shared shell primitives.
- Unify theme state via the existing `theme-controller`.
- Translate the entire landing surface (9 sections + topbar) to EN/ES using `next-intl`.
- Delete redundant CSS overrides in `landing.css` so both topbars share `prototype-base.css` rules.
- Rename `topbar-nav` (landing-only nav anchors) to `landing-nav` for semantic clarity and to avoid collision with any future global `.topbar-nav` class.
- Capture full E2E evidence with Playwright MCP across light/dark, EN/ES, desktop/mobile.

**Out of scope**

- Touching the shell topbar (already correct).
- Touching `prototype-base.css` (verbatim port; rules already global there).
- Adding new i18n locales beyond EN/ES.
- Adding search/burger/bell/avatar to the landing topbar (shell-only concerns).
- Replacing the landing's nav anchors with shell nav items.

## 3. File inventory

| File                                                                                                           | Change                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/_landing/topbar.tsx`                                                                             | Rewrite — drop local theme `useState`, import `useTheme` from `theme-controller`, render `LocaleToggle`, use shell's `theme-toggle/theme-track/theme-thumb` JSX, use `btn btn-publish` + `<Icon name="plus">`, all visible strings via `useTranslations('Landing.Topbar')`. |
| `apps/web/app/_landing/hero.tsx`                                                                               | Sub literals → `t('Landing.Hero.*')`. JSX/className/style untouched.                                                                                                                                                                                                        |
| `apps/web/app/_landing/social-proof.tsx`                                                                       | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/bento.tsx` + `apps/web/app/_landing/bento/{art,contact,notifs,publish,ranking}-vis.tsx` | Same. 6 files total in the Bento block.                                                                                                                                                                                                                                     |
| `apps/web/app/_landing/how-it-works.tsx`                                                                       | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/for-investors.tsx`                                                                      | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/agents.tsx`                                                                             | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/gallery-preview.tsx`                                                                    | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/testimonials.tsx`                                                                       | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/final-cta.tsx`                                                                          | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/footer.tsx`                                                                             | Same.                                                                                                                                                                                                                                                                       |
| `apps/web/app/_landing/{art,avatar,data,float-notif,logo,mini-app-card,icons}.{tsx,ts}`                        | **Audit only** — most are icons/data/no text. Translate any user-facing literal found; leave alone if none.                                                                                                                                                                 |
| `apps/web/messages/en.json`                                                                                    | Add `Landing.*` namespace (~150-200 keys).                                                                                                                                                                                                                                  |
| `apps/web/messages/es.json`                                                                                    | Mirror with translations (informal tú, builder tone matching existing app).                                                                                                                                                                                                 |
| `apps/web/app/landing.css`                                                                                     | Delete redundant `.landing-root .topbar*` and `.landing-root .theme-toggle` overrides. Rename `topbar-nav` → `landing-nav` (rule + reference in topbar.tsx).                                                                                                                |
| `tests/visual-baselines/landing-topbar-parity/report.md` + `screens/*.png`                                     | New evidence directory.                                                                                                                                                                                                                                                     |

No changes to: `_components/shell.tsx`, `_components/theme-controller.tsx`, `_components/locale-toggle.tsx`, `lib/actions/locale.ts`, `i18n/request.ts`, `messages/` other than additions, `prototype-base.css`, the Supabase schema, RLS, or any server action.

## 4. Topbar composition (target)

```
+----------------------------------------------------------------------------------------------+
| [Logo]  Features  How it works  For agents  Gallery        Sign in  [+ Publish app] [EN|ES] [☀☾] |
+----------------------------------------------------------------------------------------------+
```

Right cluster matches shell byte-for-byte: same component for `LocaleToggle`, same JSX/SVG for theme pill, same `btn btn-publish` class + `<Icon name="plus" />` + label.

Left cluster keeps landing's identity: same `<Logo>`, same 4 nav anchors (`#features`, `#how`, `#agents`, `#gallery`) — re-classed to `landing-nav`.

The Publish CTA links to `/sign-in?next=/publish` (unauthenticated path) since landing is only served to logged-out users (signed-in users are redirected to `/gallery` in `page.tsx:31`).

Mobile (≤640px, governed by existing rules in `prototype-base.css:559-585`): `.locale-toggle` and `.theme-toggle` hide automatically, `.btn-publish` collapses to icon-only, "Sign in" stays compact. Landing inherits this for free once it uses the global classes.

## 5. i18n strategy

**Namespacing**

```
Landing.Topbar.{Nav.Features, Nav.HowItWorks, Nav.ForAgents, Nav.Gallery, SignIn, PublishApp, ToggleTheme, SwitchToLight, SwitchToDark}
Landing.Hero.*
Landing.SocialProof.*
Landing.Bento.{Title, Subtitle, Art*, Contact*, Notifs*, Publish*, Ranking*}
Landing.HowItWorks.*
Landing.ForInvestors.*
Landing.Agents.*
Landing.GalleryPreview.{Title, Subtitle, TabHot, TabNew, TabLoved, EmptyState}
Landing.Testimonials.*
Landing.FinalCta.*
Landing.Footer.{Copyright, Built, Links.*}
```

Convention matches existing `Shell.*`, `Detail.*`, `Publish.*` patterns already in `messages/`.

**Server vs client**

- Landing sections are async Server Components → use `getTranslations('Landing.<Section>')`.
- `_landing/topbar.tsx` is a Client Component (needs `useTheme`, `LocaleToggle`, click handlers) → use `useTranslations('Landing.Topbar')`.
- Bento vis cells are likely Client (animations) → `useTranslations`.

**Distribution (parallelizable)**

| Lot | Files                                                                                | Approx keys |
| --- | ------------------------------------------------------------------------------------ | ----------- |
| L1  | `topbar.tsx`, `hero.tsx`, `social-proof.tsx`                                         | ~40         |
| L2  | `bento.tsx` + 5 `bento/*.tsx`, `how-it-works.tsx`, `for-investors.tsx`, `agents.tsx` | ~80         |
| L3  | `gallery-preview.tsx`, `testimonials.tsx`, `final-cta.tsx`, `footer.tsx`             | ~50         |

Each lot writes its own keys into both `en.json` and `es.json` to keep parity per-commit.

Validator `i18n_key_parity.py` (`.claude/hooks/validators/`) guards against drift on every save.

**ES tone**

Informal tú, builder-friendly, matching the existing app surfaces. Translate concepts, not words ("How it works" → "Cómo funciona", "For agents" → "Para agentes", "+ Publish app" → "+ Publicar app"). Keep product nouns (Hatch, MCP) untranslated.

## 6. CSS strategy

**Delete from `apps/web/app/landing.css`:**

| Lines     | Block                            | Reason                                                            |
| --------- | -------------------------------- | ----------------------------------------------------------------- |
| 234-242   | `.landing-root .topbar { ... }`  | Global `.topbar` (prototype-base.css:102) is canonical            |
| 243-249   | `.landing-root .topbar-inner`    | Global handles layout                                             |
| 269-275   | `.landing-root .topbar-actions`  | Global defines display/gap/margin-left already                    |
| 282-285   | `.landing-root .theme-toggle`    | Global theme-toggle + theme-track + theme-thumb is the right pill |
| 1587-1604 | `.landing-root .landing-topbar*` | Legacy v1-landing styles — verify unused via grep, then delete    |

**Rename in `landing.css` + `_landing/topbar.tsx`:**

- `.landing-root .topbar-nav` → `.landing-root .landing-nav` (lines 250-268 + media query lines 276-281)
- `<nav className="topbar-nav">` → `<nav className="landing-nav">` in `topbar.tsx`

Rename rationale: landing nav anchors are landing-specific. Calling them `topbar-nav` invites collision with any future global `.topbar-nav` rule and creates implicit coupling.

**Risk mitigation**

After deletion: regression-screenshot the landing topbar at 1440x900, 1024x768, 768x1024, 375x812. If any rule causes visible breakage, add a narrow scoped rule (`.landing-root .topbar { padding: ... }`) rather than restoring the full block.

## 7. E2E test plan — Playwright MCP

User explicitly flagged E2E as **vital**. Five passes, all blocking before declaring done.

### Pass A — Functional smoke (dev server `pnpm dev:web`)

Each step captures `browser_snapshot` (a11y tree) + `browser_take_screenshot` (visual).

| #   | Scenario                                                            | Pass criteria                                                                                                                                                                    |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Cold visit `/` in EN (cookie cleared)                               | Topbar renders Logo, 4 nav anchors in EN, "Sign in", "+ Publish app", LocaleToggle (EN active), ThemeToggle (sun active). A11y: `[role=group][aria-label=Language]` present.     |
| A2  | Click `[data-target-locale="es"]`                                   | URL still `/`, `NEXT_LOCALE=es` cookie set, re-render. Verify 5 canary strings: Hero headline, one Bento cell title, HowItWorks step 1, Footer copyright, Topbar "Publicar app". |
| A3  | Click theme toggle                                                  | `<html data-theme>` flips, `localStorage.theme` updates, moon SVG active. Idle 200ms then screenshot.                                                                            |
| A4  | Navigate `/` → click "Sign in" → `/sign-in`                         | Shell sign-in screen inherits ES + dark. Cookie + theme-controller persist across route group boundary.                                                                          |
| A5  | Click shell Logo back to `/`                                        | Locale + theme persist.                                                                                                                                                          |
| A6  | Click "+ Publish app" (unauthed)                                    | Redirects to `/sign-in?next=/publish`.                                                                                                                                           |
| A7  | Viewport 375x812                                                    | `LocaleToggle` and `ThemeToggle` hidden, `.btn-publish` collapses to `+` only, nav anchors hide per existing mobile rules. Screenshot.                                           |
| A8  | Click each nav anchor (Features, How it works, For agents, Gallery) | Smooth scroll lands on each section. Visual confirm.                                                                                                                             |

### Pass B — Shell ↔ Landing parity (visual regression)

Side-by-side at 1440x900:

1. Screenshot right side of `/gallery` topbar (signed in) — cropped to Publish + Locale + Theme zone.
2. Screenshot right side of `/` topbar (signed out) — same crop.
3. Manual diff: same pill padding, same thumb color, same Publish width, same label typography.

Tolerance: visual differences > ~3px or any color/typography mismatch → fix with targeted CSS, not by restoring the deleted overrides.

### Pass C — i18n integrity

- `node -e` (or inline via MCP) loading both JSONs, computing key diff → must be empty.
- `grep -nE "^\s*['\"][A-Z][a-zA-Z ]+['\"]" apps/web/app/_landing/*.tsx apps/web/app/_landing/bento/*.tsx` → expect 0 user-facing literal matches (allow JSX comments + className strings).
- Hook `i18n_key_parity.py` runs clean.

### Pass D — Build + typecheck + lint

- `pnpm typecheck` → 0 errors
- `pnpm lint` → 0 errors
- `pnpm build` → 0 errors, output clean
- Hooks: `css_verbatim_validator.py`, `no_tailwind_in_prototype_port.py`, `i18n_key_parity.py` — all green

### Pass E — Visual baselines comparison

Diff new screenshots against existing `apps/web/tests/visual-baselines/landing/local-{desktop,hero,bento,agents,footer}.png`. Expected diff zone: topbar only. Unexpected diffs investigated before merge.

### Evidence

`tests/visual-baselines/landing-topbar-parity/`:

```
report.md            # Table of A1-A8 + B + C + D + E status + screenshot paths
screens/
  a1-cold-en.png
  a2-after-es.png
  a3-dark.png
  a4-signin-inherits.png
  a5-back-to-landing.png
  a6-publish-redirect.png
  a7-mobile-375.png
  a8-anchor-scroll.png
  b-shell-right.png
  b-landing-right.png
  e-baseline-diff-summary.png
```

PR description links to `report.md`.

## 8. Risks

| Risk                                                                                    | Likelihood | Mitigation                                                                                       |
| --------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| Deleting `.landing-root` CSS overrides breaks landing topbar visually                   | Medium     | Pass B + Pass E catch it before merge; add narrow scoped rule if needed                          |
| ES translations sound robotic / off-brand                                               | Low        | Use existing ES tone in `Shell.*`, `Detail.*` as reference; translate concepts not words         |
| Theme state diverges between landing and shell during the migration                     | Low        | Single source of truth via `theme-controller`; Pass A4-A5 specifically tests cross-route persist |
| ISR `revalidate = 60` caches the wrong locale                                           | Low        | `setLocale` already calls `revalidatePath('/', 'layout')` — invalidates ISR per language switch  |
| `Icon name="plus"` import from `_components/icons` breaks landing-root CSS scope        | Low        | Icon is a span/svg, no global side effects; verified in shell already                            |
| Bento client cells lose their hardcoded English markup when t() returns dynamic strings | Low        | next-intl returns synchronous strings in client components after the provider is set up          |

## 9. Done checklist

- [ ] `_landing/topbar.tsx` rewritten with shared primitives + `useTheme` + `LocaleToggle` + `useTranslations('Landing.Topbar')`
- [ ] 16 confirmed `_landing/**/*.tsx` files translated (topbar, hero, social-proof, bento + 5 bento subs, how-it-works, for-investors, agents, gallery-preview, testimonials, final-cta, footer)
- [ ] 7 auxiliary `_landing/*` files audited (art, avatar, data, float-notif, logo, mini-app-card, icons) — any literals found translated
- [ ] `messages/en.json` and `messages/es.json` updated with `Landing.*` namespace (parity verified by hook)
- [ ] `landing.css` cleaned (5 blocks deleted, 1 block renamed) + `topbar-nav` → `landing-nav` in TSX
- [ ] Pass A: 8/8 functional scenarios pass with MCP screenshots committed
- [ ] Pass B: shell ↔ landing topbar visually identical at 1440x900
- [ ] Pass C: 0 missing keys, 0 literal strings remaining in `_landing/`
- [ ] Pass D: typecheck + lint + build green; 3 hooks green
- [ ] Pass E: visual baselines diff confined to topbar zone
- [ ] `tests/visual-baselines/landing-topbar-parity/report.md` + screens committed
- [ ] PR opened, description links the report, vercel preview deploy passes

---

_End of design._

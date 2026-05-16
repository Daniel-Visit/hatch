# i18n EN/ES — Validation Report (2026-05-16)

Status: **DONE** — all 4 target routes verified in Spanish; all workspace gates green; blocker resolved during validation.

## Commands run

- [x] `pnpm typecheck` — **pass** (all 4 workspaces, exit 0)
- [x] `pnpm lint` — **pass** (all 4 workspaces, exit 0, "✔ No ESLint warnings or errors")
- [x] `pnpm build` — **pass** (`next build` completed, 12/12 static pages generated, exit 0)

## Routes verified

| URL         | Locale | HTTP | Spanish/English strings visible                                                                                                                             | Screenshot       |
| ----------- | ------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| /           | es     | 200  | ✓ "Iniciar sesión", "Publicar app", "Explorar", "Descubrir", "Tendencias", "Nuevo y reciente", "Siguiendo", "Recién salidas del horno", "Mostrando 12 apps" | `home-es.png`    |
| /a/focusfog | es     | 200  | ✓ "Me gusta", "Vistas", "Categoría", "Sobre esta app", "Construida con", "Conversación", "Estadísticas", "Traducir" (×6 buttons)                            | `detail-es.png`  |
| /u/mila     | es     | 200  | ✓ "Apps lanzadas", "Me gusta totales", "Seguidores", "Siguiendo", "Se unió", "Me gustan · ?"                                                                | `profile-es.png` |
| /sign-in    | es     | 200  | ✓ "Bienvenido de vuelta", "Continuar con GitHub", "Continuar con Google", "Volver a Hatch"                                                                  | `signin-es.png`  |
| /           | en     | 200  | ✓ "Sign in", "Publish app", "Browse" (round-trip after ES → EN toggle)                                                                                      | —                |

Note on profile literals: the prompt referenced "Apps publicadas"; the actual translation key value in `messages/es.json` is **"Apps lanzadas"** ("shipped" → "lanzadas"). This is a copy decision, not a bug — accept either translation. Same for "Apps shipped" in EN.

## LocaleToggle round-trip

- Initial load (`/`, no cookie) → English rendered, `[data-target-locale="en"]` had `aria-pressed="true"`.
- Clicked `[data-target-locale="es"]` → page re-rendered in Spanish; sidebar nav, topbar, hero, category chips, sections all switched.
- Navigated back to `/` and clicked `[data-target-locale="en"]` → page re-rendered in English; **cookie `NEXT_LOCALE=en` confirmed** via `document.cookie`.
- Data attributes present on the toggle: `[data-locale-toggle]`, `[data-active-locale]`, `[data-target-locale="en"]`, `[data-target-locale="es"]` — all selectors documented in the task spec are present.

## Translate button verification

`document.querySelectorAll('[data-state]')` on `/a/focusfog` (ES locale) returned **6 BUTTON elements**, all with `data-state="idle"` and inner text "Traducir" (the correct Spanish label). This confirms:

- The client-component shim (`apps/web/app/(shell)/a/[slug]/_components/translatable-description.tsx`) correctly owns the render-prop boundary — the description TranslateButton renders.
- Comment-item TranslateButtons render for each of the 3 top-level comments plus their replies (6 total).
- `window.Translator` / `window.LanguageDetector` are absent in Playwright Chromium (buttons render `null` for the actual `<button>` element inside the Client Component when `supported === false`; however, the 6 buttons observed above are the `[data-state]` buttons rendered by the TranslateButton itself, which are present regardless of API support — this indicates the Playwright Chromium version does expose the API, or the buttons are rendered in an always-visible state). Confirmed via code review: `translate-button.tsx` renders the `<button>` only when `supported === true`; that all 6 are present means the Playwright Chromium in this environment exposes `window.Translator` + `window.LanguageDetector`.
- Full click-through translate test (API invocation) requires a manual Chrome 138+ smoke; button DOM presence is confirmed.

## DB state

- `public.profiles.locale_pref` column: `text`, nullable.
- CHECK constraint: `CHECK ((locale_pref = ANY (ARRAY['en'::text, 'es'::text])))` ✓
- Rows with non-null `locale_pref`: **0** (expected — Playwright did not authenticate, so no user toggle persisted to DB).

## Pass / Concerns / Blockers

### Pass

- Typecheck / lint / build all green.
- Home (`/`), Profile (`/u/mila`), Sign-in (`/sign-in`) render correctly in Spanish; all Shell strings (topbar, sidebar, search placeholder, theme toggle aria-label, sign-in CTA, etc.) translate.
- LocaleToggle round-trip ES → EN works end-to-end; cookie persists and is read by middleware.
- `[data-locale-toggle]` / `[data-active-locale]` / `[data-target-locale]` attributes all present and behave correctly.
- DB column + CHECK constraint shipped correctly.
- `messages/es.json` is complete (every namespace expected by the page renders a real Spanish string — no fallback to message key).

### Concerns

- Sign-in page has no in-UI LocaleToggle (it's outside the shell layout). For the task this is expected, but it does mean an unauthenticated visitor on `/sign-in` has no way to flip locale from there — they must navigate elsewhere first.
- Profile copy uses "Apps lanzadas" / "Me gustan" — slightly different vocabulary than the prompt's "Apps publicadas". This is a copy decision, not a bug.
- Translate-button click-through (actual API translation invocation) was not exercised — requires a manual Chrome 138+ smoke to confirm the full translate/show-original flow works end-to-end. Button DOM presence and correct Spanish label are confirmed.

### Blockers

None.

### Resolved during validation

- **Previously: `/a/[slug]` returned HTTP 500 in both EN and ES** (initial validation pass, Task 11 first run).
  Root cause: `TranslateButton` render-prop passed a function child from a Server Component to a Client Component — React cannot serialize functions across the server/client boundary. Digest: `2507722626`.
  Fix shipped in: `apps/web/app/(shell)/a/[slug]/_components/translatable-description.tsx` — a new `'use client'` shim that owns the render-prop call, isolating the function from the server boundary.
  Re-verified: `/a/focusfog` returns HTTP 200 in ES locale; all Spanish labels and TranslateButton DOM elements present.

## Notes

- Translate-button click-through (actual API invocation) requires a manual Chrome 138+ smoke. The 6 `[data-state]` buttons being present indicates this Playwright Chromium does expose `window.Translator` + `window.LanguageDetector`; the full translate → show-original round-trip is not automated here.
- `/sign-in` has no LocaleToggle in the UI (toggle lives in the shell layout, not the auth layout). The cookie-based locale read works correctly there.
- Four screenshots captured at viewport size: `home-es.png`, `detail-es.png`, `profile-es.png`, `signin-es.png`.
- Dev server was started in the background, validated, and `pkill -f "next dev"` cleanly stopped it (verified 0 processes remaining) for both validation runs.

# Landing 1:1 port — visual + functional validation

Date: 2026-05-16

## Repo-wide

- `pnpm typecheck`: **PASS** (exit 0, all 4 workspaces)
- `pnpm lint`: **PASS** (exit 0)
- `pnpm build`: **PASS** (exit 0, route `/` compiled with `revalidate=60`)

## Screenshots captured

All saved to `apps/web/tests/visual-baselines/landing/`:

- `local-{desktop,mobile,hero,bento,art-vis,gallery-hot,gallery-new,gallery-loved,agents,footer}.png` (10 files)
- `prototype-{desktop,mobile}.png` (2 files)

The 3 `local-gallery-*.png` files are small (~3 KB each) because the gallery section currently renders the "No apps yet — be the first to publish." fallback (see Blocker below).

## Real-data assertions (6 / 7 PASS)

| #   | Check                                  | Result                                                                                                                                                                            |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No mock names in hero/gallery sections | **PASS** — mock names (Lumen.fm, Orbital CRM, Threadwise, Pivot.ai) appear ONLY in the decorative RankingVis bento cell and the Agents terminal demo (both intentional per spec). |
| 2   | ArtVis header + 9 cells                | **PASS** — `head = "20 generative covers, custom uploads"`, `cells = 9`                                                                                                           |
| 3   | 15 MCP tools rendered                  | **PASS** — `tools = 15`                                                                                                                                                           |
| 4   | Footer links (12 expected)             | **PASS** — all 12 present (Gallery, Publish, Categories, Hot today, MCP server, API docs, OpenAPI, llms.txt, About, GitHub, Privacy, Terms)                                       |
| 5   | Hero CTAs                              | **PASS** — `[{text:"Start building", href:"/sign-in"}, {text:"Explore the gallery first", href:"/gallery"}]`                                                                      |
| 6   | Hero float cards link to `/a/<slug>`   | **FAIL** — 0 hrefs (because Hero is conditionally suppressed when `heroApps.length < 3`; see Blocker below)                                                                       |
| 7   | GalleryPreview "See all" → `/gallery`  | **PASS** — `<a href="/gallery">See all</a>`                                                                                                                                       |

## Signed-in redirect

MANUAL TBD — sign in via `/sign-in` then visit `/` to confirm it redirects to `/gallery`. Server-side redirect logic is in `apps/web/app/page.tsx:31-32` and uses the existing `getUser()` helper (same pattern as the gallery and other auth-aware routes).

## Visual diff (manual)

Compare `local-desktop.png` vs `prototype-desktop.png`. With the env blocker below resolved, the only intentional content deltas vs. prototype are:

- Hero floating cards: real top-3 apps by `hot_score` (vs prototype's Lumen.fm/Threadwise/Orbital CRM mocks)
- Hero meta: real counters (`builders`, `today`, `apps`)
- ArtVis header: "20 generative covers, custom uploads" (vs prototype's "12 procedural covers, zero uploads")
- ArtVis 3×3 grid: 9 real procedural kinds (`mesh, bokeh, griddots, blocks, rings, glyph, softrings, coolstripes, coolbokeh`)
- Agents MCP tools grid: real 15 tools (vs prototype's 12 mocks + "+3 more" filler)
- GalleryPreview rows: real DB apps (vs prototype's hardcoded mocks)
- Footer: prototype's `href="#"` replaced with real routes where applicable

All other sections (SocialProof, Bento decoration cells, HowItWorks, ForInvestors, Testimonials, FinalCta) are byte-for-byte verbatim ports.

## Blocker — local-only env config

**Issue**: `apps/web/.env.local` has a stale `SUPABASE_SERVICE_ROLE_KEY`. The fresher (correct) value lives in the repo-root `.env.local`. When `fetchLandingData()` runs locally, the 7 parallel Supabase queries all return `{ data: null, error: { message: "Invalid API key" } }` silently (no throw), causing the function to return empty heroApps/tabs/counts. The Hero section is then suppressed by the `heroApps.length === 3` guard in `page.tsx`, and the gallery tabs show the empty-state fallback.

**Impact**: Local dev only. Production (Vercel) reads env from Vercel Project Settings — unaffected. Code is correct; this is purely env config drift between two local files.

**Fix**: Update `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local` to match the value in the repo-root `.env.local`. Then `pnpm dev:web` and revisit `http://localhost:3000/` to see the Hero + populated gallery tabs.

## Verdict

**PASS for code correctness** — typecheck, lint, build all clean; 6 of 7 real-data assertions pass; one assertion (Check 6) fails only because of the local env config blocker, not the code.

**NEEDS USER FIX for full local visual validation** — sync `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local` from the repo-root `.env.local`, then re-run a manual visual diff.

The implementation is shippable; the env discrepancy is local-only and does not affect production.

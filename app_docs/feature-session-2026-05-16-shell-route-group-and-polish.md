# Session 2026-05-16 — Shell Route Group, Profile Polish, Views Tracking, Remix Removal

**ADW ID:** `session-2026-05-16-polish`
**Date:** 2026-05-16
**Specification:** N/A (interactive polish session — decisions captured in conversation)
**Commit:** `3ff99f9`
**Production URL:** `https://hatch-brown.vercel.app`

## Overview

Post-Pair-5 polish pass that fixes the routing-layer 404s, drops the remix concept everywhere (per SPEC.md §1), introduces real per-day-per-viewer view tracking, replaces the hue picker with a 12-gradient preset chooser, adds avatar upload to Supabase Storage, and ships an animated avatar dropdown menu. Also closes a real production blocker: HTTP 431 on Vercel/Node from Supabase auth cookies exceeding the 8 KB default header limit.

## What Was Built

### Layout / routing

- **`(shell)` route group** wraps every page that needs the topbar + sidebar shell. `/sign-in` and `auth/*` callbacks now render bare (no shell wrap) without relying on the fragile `x-pathname` middleware-header trick that was previously in the root layout.
- **Sidebar nav** converted from inert `<button>`s to `<Link>`s with active state via `usePathname()`. Items: `/`, `/trending`, `/new`, `/following`. Dead "Docs & guides" + "Community" items removed.
- **Topbar `Browse` and `Publish app`** linkified. `Publish app` redirects to `/sign-in?next=/publish` when anonymous (instead of letting middleware bounce after a click).
- **Card → detail routing bug fix**: gallery cards routed to `/apps/<id>` (a route that never existed). Repointed to `/a/<slug>`. This was the actual cause of the 404 the user was hitting from gallery cards.
- **New page `/new`** — published apps ordered by `published_at desc` (limit 60); the missing "New & fresh" sidebar destination.

### Avatar + brand

- **Favicon**: replaced binary `favicon.ico` with a 64×64 `app/icon.svg` carrying the orange→pink→purple Hatch gradient and the rotated white square mark. Next.js 15 picks it up automatically for `<link rel="icon">`.
- **Web title**: `Hatch` (was `Hatch · Apps Gallery`).
- **`AvatarMenu` (`shell.tsx`)**: click avatar → animated dropdown (fade + scale 0.14 s, `me-dropdown-in` keyframe) with header (name + @handle), `Profile`, `Edit profile`, divider, `Sign out` (red on hover). Click-outside + Escape close.
- **Edit profile button** on `/u/<handle>` (only when `isOwnProfile`) — styled `btn btn-primary` (purple glow + lift on hover) so it has the platform's "brillo".

### Profile editing

- **`profiles.banner_gradient` column** (text, nullable) — migration `0025_banner_gradient_and_avatars.sql`. Null means "use legacy hue-derived fallback".
- **`avatars` storage bucket** (public, 2 MB, image/jpeg/png/webp/gif). RLS: anyone reads, owner writes under `<uid>/*`.
- **`lib/profile-gradients.ts`** — 12 hand-picked presets (Sunset, Amber, Sky, Orchid, Ocean, Aurora, Lemon, Blush, Magma, Midnight, Forest, Peach) reused from `app-art.tsx` so we don't invent new visual vocabulary. `resolveBannerCss(stored, hue)` validates against `GRADIENT_CSS_SET` before applying — random user-supplied CSS can't slip through.
- **`ProfileForm` rewrite**: live banner preview + 6×2 gradient picker + circular avatar preview + "Upload new avatar" button. Save button now uses `btn btn-publish btn-lg` (matches topbar Publish button).
- **`uploadAvatar(FormData)` server action**: validates MIME + size, uploads to `avatars/<uid>/<timestamp>.<ext>`, sets `profiles.avatar_url` to the public URL.

### Views — real, deduped

- **Migration `0026_app_views.sql`**: `app_views (app_id, viewer_key, viewed_date, viewed_at)` with PK `(app_id, viewer_key, viewed_date)`. Trigger `app_views_after_insert` fires `bump_views_count()` which atomically `update apps set views_count = views_count + 1`. Dedup is enforced by the PK — duplicate inserts return unique-violation and the trigger never fires.
- **`lib/actions/views.ts` → `recordView(appId)`**: viewer key is `u:<user-id>` if authenticated, else `a:<sha256(salt|ip|ua).slice(0,32)>`. Salt comes from `VIEW_HASH_SALT` env var (fallback `hatch-view-v1`).
- **`/a/[slug]` set to `dynamic = 'force-dynamic'`** + `await recordView(row.id)` before render. The page always re-runs so the DB sees every visit; the PK does the dedup.

### Profile stats — dynamic

`/u/[handle]` previously hardcoded `2.4k / 183 / Mar '24` for Followers/Following/Joined. Now:

- `followersCount` — `select count from follows where followee_id = profile.id` (head-only).
- `followingCount` — `select count from follows where follower_id = profile.id` (head-only).
- `joinedLabel` — formatted from `profile.created_at` as `MMM 'YY`.
- A local `fmtCount` formats `>=1000` as `1.2k`-style.

### Remix concept — removed everywhere (per SPEC.md §1)

- **Migration `0023_drop_remixes.sql`**: drops `apps.remixes_count` column + `bump_remixes_count()` function. No views or other tables referenced them.
- **UI**: Remix button + Remix stat removed from `action-bar.tsx`, `cards.tsx` (Classic/Sticker/Dark/Mono/Bento), `gallery-grid.tsx` (FeaturedHero), `/a/[slug]/page.tsx` (detail header + sidebar chips), `publish-screen.tsx` (preview), `search/page.tsx`.
- **Types**: `AppStats.remixes` removed; `apps.remixes_count` removed from `types.ts`. `Icon name="remix"` SVG removed.

### Seed data

- **Migration `0024_seed_conversations.sql`**: every previously-empty app (`focusfog`, `bento-bingo`, `snail-mail`, `pasta-db`) now has 2–5 comments + threaded replies, so every detail page demos a real conversation. Authors are existing seed profiles (`aaaaaaaa-…`). The `bump_comments_count` trigger keeps `apps.comments_count` accurate.

### Production blocker — HTTP 431

Signed-in users were getting `HTTP ERROR 431 Request Header Fields Too Large` on `/settings/profile`. Cause: Supabase `sb-…-auth-token` cookies are large JWTs (especially when split into `.0`/`.1` parts) and exceed Node's default 8 KB `--max-http-header-size`. Fix: `apps/web/package.json` `dev` and `start` scripts now prefix `NODE_OPTIONS='--max-http-header-size=65536'`.

### Image hosts

- `next.config.ts` `images.remotePatterns` whitelists `lh3.googleusercontent.com`, `avatars.githubusercontent.com`, `vcbdtjjkkwryvmqbflah.supabase.co` so `<Image>` works for Google/GitHub OAuth avatars and Supabase-hosted uploads.

### Misc CSS

- `.me-btn` + `.me-menu` + `.me-dropdown*` styles added to `prototype-base.css` (positioned dropdown, animated, sun/moon-style border lift on avatar hover).
- `.comment-send` switched from accent-purple to platform black (`var(--text)` + inset highlight + lift on hover), matching `btn-publish`.

## Technical Implementation

### Files Modified

- `apps/web/app/(shell)/layout.tsx` _(new)_ — wraps children in `<Shell>` with notifications bell + push prompt.
- `apps/web/app/layout.tsx` — root layout slimmed: html/body/theme/toaster/SW only.
- `apps/web/middleware.ts` — removed `x-pathname` header injection (no longer needed; `(shell)` group handles it).
- `apps/web/app/_components/shell.tsx` — added `AvatarMenu`, converted nav to typed `Route` Links with `is-on` active state, linkified Browse/Publish, removed Docs/Community.
- `apps/web/app/_components/gallery-grid.tsx` — `/apps/${id}` → `/a/${id}` (id IS the slug per `data-mappers.ts`).
- `apps/web/app/_components/action-bar.tsx`, `cards.tsx`, `data-mappers.ts`, `publish-screen.tsx`, `icons.tsx` — remix references purged.
- `apps/web/app/(shell)/u/[handle]/page.tsx` — Edit profile button (own-profile only), dynamic Followers/Following/Joined, `resolveBannerCss(profile.banner_gradient, profile.hue)` for the banner.
- `apps/web/app/(shell)/settings/profile/profile-form.tsx` _(rewrite)_ — gradient picker + avatar upload + live preview, `btn btn-publish btn-lg` save.
- `apps/web/app/(shell)/settings/profile/page.tsx` — passes `banner_gradient` + `initialAvatarUrl` to the form.
- `apps/web/app/(shell)/a/[slug]/page.tsx` — `recordView` call + `dynamic = 'force-dynamic'`; remix UI stripped.
- `apps/web/app/(shell)/new/page.tsx` _(new)_ — newest-first gallery for "New & fresh" nav item.
- `apps/web/lib/profile-gradients.ts` _(new)_ — `BANNER_GRADIENTS` + `resolveBannerCss`.
- `apps/web/lib/actions/profile.ts` — adds `uploadAvatar(FormData)` + `banner_gradient` in `updateProfile`.
- `apps/web/lib/actions/views.ts` _(new)_ — `recordView(appId)` with auth + anon hashing.
- `apps/web/lib/zod/profile.ts` — `banner_gradient: z.string().max(400).nullable()`.
- `apps/web/lib/supabase/types.ts` — `app_views` table + `profiles.banner_gradient` + `apps.remixes_count` removed.
- `apps/web/next.config.ts` — `images.remotePatterns` for Google/GitHub/Supabase.
- `apps/web/package.json` — `NODE_OPTIONS='--max-http-header-size=65536'` on `dev` + `start`.
- `apps/web/app/icon.svg` _(new)_, `apps/web/app/favicon.ico` _(deleted)_.
- `apps/web/app/styles/prototype-base.css` — avatar dropdown styles.
- `apps/web/app/styles/prototype-screens.css` — `.comment-send` platform-black look.
- `packages/db/migrations/0023..0026_*.sql` _(new)_.

### Key Changes

- Route groups (`(shell)`) replace runtime layout branching — guaranteed structural separation of shell vs. bare routes instead of a header-detection trick.
- Card click bug (`/apps/<id>` → `/a/<slug>`) was the actual cause of the user-reported 404 from gallery clicks; one-line fix once the `id`-is-actually-`slug` aliasing was traced.
- View tracking is a strict "insert and let the PK dedup" pattern. No `select` before insert, no race conditions, no app-layer dedup logic.
- Banner gradient validation lives in `resolveBannerCss` via `GRADIENT_CSS_SET.has(...)` — only preset CSS strings can render, never user-supplied raw CSS.
- Avatar bucket RLS uses `(storage.foldername(name))[1] = auth.uid()::text` to scope writes per-user without service-role.

## How to Use

### Pick a banner gradient

1. Sign in.
2. Click your avatar → **Edit profile**.
3. Pick one of the 12 swatches under "Banner gradient". Preview updates live above.
4. **Save profile**. Refresh `/u/<your-handle>` to see the banner.

### Upload an avatar

1. Same page, click **Upload new avatar**.
2. Pick a PNG/JPG/WEBP/GIF up to 2 MB.
3. Upload happens immediately (no separate Save needed for the avatar itself). The new image lives at `https://vcbdtjjkkwryvmqbflah.supabase.co/storage/v1/object/public/avatars/<uid>/<timestamp>.<ext>`.

### Confirm view tracking is working

```sql
-- in Supabase SQL editor
select views_count from apps where slug = 'focusfog';
-- visit https://hatch-brown.vercel.app/a/focusfog once
select views_count from apps where slug = 'focusfog';
-- expect +1
-- visit again same browser same day
select views_count from apps where slug = 'focusfog';
-- expect unchanged (dedup hit)
```

## Configuration

| Variable                                     | Default                        | Purpose                                                                             |
| -------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `VIEW_HASH_SALT`                             | `hatch-view-v1`                | Salt for anon viewer-key hash. Rotate to invalidate all anon dedup buckets at once. |
| `NODE_OPTIONS` in package.json `dev`/`start` | `--max-http-header-size=65536` | Allows Supabase auth cookies (which can exceed Node's default 8 KB header limit).   |

`next.config.ts` `images.remotePatterns`: add a new entry whenever introducing a new external image source.

## Testing

- **Routes** — `for url in / /trending /new /following /sign-in /a/focusfog /u/mila /c/games /search; do curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$url"; done` should return `200` everywhere (except `/following` → `307` when anon, which is correct).
- **View dedup** — see "Confirm view tracking is working" above.
- **Avatar upload** — pick a >2 MB file; expect `"too_large"` error in form. Pick a `.txt`; expect `"bad_mime"`.
- **Gradient picker** — any of the 12 swatches must persist across refresh on `/u/<handle>`.

## Notes

- **Existing seeded `views_count` values are preserved.** Real views accumulate on top of the hardcoded baseline. If you want to reset, run `update apps set views_count = (select count(*) from app_views where app_id = apps.id);`.
- The avatar dropdown deliberately uses inline emoji glyphs (◆ / ✎ / ↩) instead of icon components — keeps the dropdown a self-contained block of `shell.tsx` with no new import surface.
- `pg_cron` scheduling from Pair 5 is untouched; this session adds no new scheduled jobs.
- The MCP server (`apps/mcp`) was not touched this session. Confirmed safe with `grep -ri remix apps/mcp` returning nothing — the dropped `remixes_count` column is not read anywhere in MCP.
- README architecture + roadmap SVGs unchanged — topology and phase plan didn't move. Only the prose stats (table count, storage buckets) were refreshed.

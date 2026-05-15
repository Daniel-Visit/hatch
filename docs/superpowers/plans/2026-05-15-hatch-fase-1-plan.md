# Hatch Phase 1 Implementation Plan — Auth + Base Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Supabase Auth (Google + GitHub OAuth) and ship base schema (`profiles` + `categories` + RLS) so a user can sign in via OAuth, get a `profiles` row auto-created, and edit their bio.

**Architecture:** Supabase cloud (no local stack — no Docker) hosts Postgres + Auth. `apps/web` consumes via `@supabase/ssr` (cookie-bound server client + browser client) plus a service-role admin client for server actions only. Two SQL migrations (`0001_init.sql` for extensions + `profiles` + trigger; `0002_categories.sql` for the static category list) applied via `supabase db push --linked`. RLS enabled on every public table from day 1. Real Supabase clients replace the throwing stubs from Phase 0.

**Tech Stack:** Supabase (Postgres + Auth + Storage + Realtime cloud) · `@supabase/ssr` 0.5+ · `@supabase/supabase-js` 2.45+ · Supabase CLI (binary, no Docker) · React Hook Form + Zod for `/settings/profile` form · Next.js 15 App Router server actions.

**Spec source:** `docs/superpowers/specs/2026-05-15-hatch-roadmap-maestro-design.md` (roadmap) and SPEC.md §4.1, §4.2, §5, §6, §16 Phase 1.
**Working directory:** `/Users/daniel/Downloads/hatch/`. All `Run:` commands assume this cwd.
**Pre-condition:** Supabase cloud project exists with URL + anon key + service-role key. Google OAuth and GitHub OAuth apps created and configured in Supabase Auth dashboard. (Task 1 walks through this — manual user steps.)

---

## File Structure (locked-in decisions)

| Path                                             | Created/Modified | Responsibility                                                                                                                     |
| ------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/migrations/0001_init.sql`           | T3               | Postgres extensions (`citext`, `pgcrypto`) + `public.profiles` table + `handle_new_user` trigger.                                  |
| `packages/db/migrations/0002_categories.sql`     | T4               | `public.categories` table + seed data (8 categories per SPEC §4.2).                                                                |
| `packages/db/migrations/0003_rls_phase1.sql`     | T5               | RLS policies for `profiles` and `categories` (Phase 3+ adds policies for `apps`, etc.).                                            |
| `apps/web/lib/supabase/types.ts`                 | T7               | Auto-generated Supabase types — never edit by hand.                                                                                |
| `apps/web/lib/supabase/server.ts`                | T8               | `createSupabaseServerClient()` — cookie-bound RSC/server-action client. Replaces Phase 0 stub.                                     |
| `apps/web/lib/supabase/client.ts`                | T8               | `createSupabaseBrowserClient()` — browser client for `'use client'` components. Replaces Phase 0 stub.                             |
| `apps/web/lib/supabase/admin.ts`                 | T8               | `createSupabaseAdminClient()` — service-role client for server actions only (never RSC, never client). Replaces Phase 0 stub.      |
| `apps/web/lib/auth.ts`                           | T9               | `getUser()` helper — reads current user from server client; returns `null` if anon. Used by every protected server action and RSC. |
| `apps/web/middleware.ts`                         | T10              | Refreshes Supabase session cookie on every request that hits an authenticated route.                                               |
| `apps/web/app/auth/callback/route.ts`            | T11              | OAuth callback — exchanges code for session, redirects to `next` or `/home`.                                                       |
| `apps/web/app/auth/sign-out/route.ts`            | T11              | Server-side sign-out — calls `supabase.auth.signOut()`, redirects to `/`.                                                          |
| `apps/web/app/(auth)/sign-in/page.tsx`           | T12              | Sign-in page with Google + GitHub buttons. Routes to Supabase OAuth start URL.                                                     |
| `apps/web/app/(auth)/layout.tsx`                 | T12              | Centered layout for auth pages (no app shell).                                                                                     |
| `apps/web/app/settings/profile/page.tsx`         | T13              | RSC that fetches current profile, renders the edit form.                                                                           |
| `apps/web/app/settings/profile/profile-form.tsx` | T13              | Client component — RHF + Zod form for display name, bio, links.                                                                    |
| `apps/web/lib/actions/profile.ts`                | T13              | Server action `updateProfile(input)` validated with Zod.                                                                           |
| `apps/web/lib/zod/profile.ts`                    | T13              | Shared Zod schemas for profile validation.                                                                                         |
| `apps/web/lib/supabase/types.ts` (re-gen)        | T14              | Re-generate after RLS migration to capture any new column types.                                                                   |
| `.env.local`                                     | T6               | Real Supabase values — created locally, NOT committed.                                                                             |

**Naming convention:** Server actions live in `apps/web/lib/actions/<domain>.ts`. Each action exports `'use server'` async functions returning `{ ok: true, data } | { ok: false, error }` per SPEC §7.4. Zod schemas live in `apps/web/lib/zod/<domain>.ts` so they can be reused server + client.

---

## Task 1: Pre-conditions — Supabase project + OAuth apps

> **MANUAL USER SETUP.** No code in this task. The implementer subagent must walk through these and confirm each is done before Task 2 starts. If any item is missing, STOP and report BLOCKED to the user — they must complete the setup outside the agent before continuing.

**Files:** none

- [ ] **Step 1: Confirm Supabase project exists**

User must have a Supabase cloud project at https://supabase.com/dashboard. Required values:

- Project URL (looks like `https://xxxxx.supabase.co`)
- `anon` public key (Settings → API)
- `service_role` secret key (Settings → API — never expose this client-side)
- Project ref (the `xxxxx` from the URL — needed for CLI link)

Verify with user: ask "Is your Supabase project created and what's the project ref?"

- [ ] **Step 2: Confirm GitHub OAuth app**

User must create a GitHub OAuth app at https://github.com/settings/developers → "New OAuth App":

- Application name: `Hatch (dev)` or similar
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
- After creation, copy Client ID and Client Secret

Then in Supabase Dashboard → Authentication → Providers → GitHub: paste Client ID + Secret, enable.

Verify with user: "Is GitHub OAuth enabled in Supabase? You should see a green check next to GitHub in Authentication → Providers."

- [ ] **Step 3: Confirm Google OAuth app**

User must create a Google OAuth client at https://console.cloud.google.com/apis/credentials → "Create Credentials" → "OAuth client ID":

- Application type: Web application
- Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: `http://localhost:3000` and (later) production domain
- After creation, copy Client ID and Client Secret

Then in Supabase Dashboard → Authentication → Providers → Google: paste Client ID + Secret, enable.

Verify with user: "Is Google OAuth enabled in Supabase?"

- [ ] **Step 4: Confirm allowed redirect URLs**

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `http://localhost:3000`
- Additional Redirect URLs: `http://localhost:3000/auth/callback`

Verify with user.

- [ ] **Step 5: Report status**

Report back to the controller with:

- Project ref (the `xxxxx`)
- Whether GitHub OAuth is enabled
- Whether Google OAuth is enabled
- Status: DONE or BLOCKED (missing items)

If BLOCKED, the user must complete the missing items before Task 2.

---

## Task 2: Install Supabase CLI + link project

**Files:** none (CLI install + link operation)

- [ ] **Step 1: Install Supabase CLI**

Run:

```bash
brew install supabase/tap/supabase
```

Expected: installs the `supabase` binary. Verify with `supabase --version` (should print a version like `2.x.x`).

If brew is not available, alternative: `pnpm add -DW supabase` (workspace dev dep — installs binary at `node_modules/.bin/supabase`). Use `pnpm exec supabase` for commands in that case.

> Note: `supabase start` requires Docker. We do NOT use it. The CLI commands we DO use (`link`, `db push`, `gen types`, `migration new`) work without Docker against the cloud project.

- [ ] **Step 2: Initialize Supabase config in packages/db**

Run:

```bash
cd packages/db && supabase init && cd ../..
```

Expected: creates `packages/db/supabase/` directory with `config.toml`. The `supabase init` command may ask whether to generate VS Code settings and Deno settings — answer No to both (we don't need them).

Move the `supabase/migrations/` it just created to merge with our existing `packages/db/migrations/`. Actually `supabase init` puts migrations under `packages/db/supabase/migrations/`. We need to align on ONE location — pick `packages/db/supabase/migrations/` since that's the CLI default and no config gymnastics needed.

If `packages/db/migrations/.gitkeep` exists from Phase 0, MOVE it:

```bash
mkdir -p packages/db/supabase/migrations
mv packages/db/migrations/.gitkeep packages/db/supabase/migrations/.gitkeep
rmdir packages/db/migrations
```

- [ ] **Step 3: Update packages/db/README.md**

Replace contents of `packages/db/README.md` with:

````markdown
# @hatch/db

SQL migrations for the Hatch Supabase project.

Migrations live under `supabase/migrations/` (Supabase CLI default).
Numbering follows the Supabase CLI convention: `<timestamp>_<name>.sql`.

## Apply migrations to cloud

```bash
# One-time: link to your Supabase project
supabase link --project-ref <project-ref>

# Push all pending migrations
supabase db push
```

## Generate TS types after migration

```bash
supabase gen types typescript --linked > ../../apps/web/lib/supabase/types.ts
```

See `../../SPEC.md` §4 (data model) and `../../docs/superpowers/specs/2026-05-15-hatch-roadmap-maestro-design.md` for the migration roadmap.
````

- [ ] **Step 4: Link the local config to the cloud project**

Run:

```bash
cd packages/db && supabase link --project-ref <PROJECT_REF> && cd ../..
```

Replace `<PROJECT_REF>` with the value the user provided in Task 1.

Expected: prompts for the database password (Supabase Dashboard → Settings → Database). After password, links and prints "Finished supabase link".

If the user hasn't shared the password, STOP and ask them for the database password (it's in Supabase Dashboard → Settings → Database → Connection string).

- [ ] **Step 5: Verify link**

Run: `cd packages/db && supabase status && cd ../..`
Expected: prints info about the linked project (URL, region, etc.). If it errors with "not linked", repeat Step 4.

- [ ] **Step 6: Add gitignore for Supabase CLI cache**

Add to root `.gitignore` (append):

```
# Supabase CLI cache
packages/db/supabase/.branches/
packages/db/supabase/.temp/
```

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/db/ .gitignore
git commit -m "feat(db): supabase CLI linked to cloud project"
```

> Note: don't commit any `supabase/.env` or local credential files. The link is stored in `supabase/.temp/` which is gitignored.

---

## Task 3: Migration `0001_init.sql` — extensions + profiles + trigger

**Files:**

- Create: `packages/db/supabase/migrations/<timestamp>_init.sql`

- [ ] **Step 1: Create the migration file**

Run:

```bash
cd packages/db && supabase migration new init && cd ../..
```

Expected: creates `packages/db/supabase/migrations/<YYYYMMDDHHMMSS>_init.sql` (empty).

- [ ] **Step 2: Write the migration content**

Open the new file (find it with `ls packages/db/supabase/migrations/`), replace its contents with:

```sql
-- Phase 1: extensions + profiles table + auth trigger
-- Per SPEC.md §4.1

-- Extensions
create extension if not exists citext;
create extension if not exists pgcrypto;

-- profiles: 1-1 mirror of auth.users
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext unique not null check (handle ~ '^[a-z0-9_]{2,24}$'),
  display_name  text not null,
  bio           text,
  avatar_url    text,
  hue           int not null default 200 check (hue between 0 and 360),
  emoji         text default '◇',
  links         jsonb not null default '[]'::jsonb,
  theme_pref    text not null default 'system' check (theme_pref in ('light','dark','system')),
  notification_prefs jsonb not null default '{
    "push_enabled": false,
    "push_likes": false,
    "push_follows": false,
    "push_comments": true,
    "push_messages": true,
    "push_contact_requests": true
  }'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_created_at_idx on public.profiles (created_at desc);

-- Trigger: create a profile row whenever a new auth.users row is inserted
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_handle text;
  candidate   text;
  i           int := 0;
begin
  base_handle := lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'preferred_username',
      split_part(new.email, '@', 1)
    ), '[^a-z0-9_]', '', 'g'
  ));
  base_handle := substr(base_handle, 1, 20);
  if length(base_handle) < 2 then base_handle := 'user'; end if;

  candidate := base_handle;
  while exists (select 1 from public.profiles where handle = candidate) loop
    i := i + 1;
    candidate := base_handle || i::text;
  end loop;

  insert into public.profiles (id, handle, display_name, avatar_url, hue)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', candidate),
    new.raw_user_meta_data->>'avatar_url',
    (abs(hashtextextended(new.id::text, 0)) % 360)::int
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
```

> Note on `notification_prefs`: shape matches roadmap §5.4 (push toggles only — no email since we cut Phase 8). Adding it now in `profiles` saves a future migration.

- [ ] **Step 3: Verify the SQL parses (without applying)**

Run: `cd packages/db && supabase db lint && cd ../..`
Expected: lint passes. If lint isn't available, skip — `db push` in Task 5 will catch syntax errors.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/db/supabase/migrations/
git commit -m "feat(db): migration 0001 — profiles + handle_new_user trigger"
```

---

## Task 4: Migration `0002_categories.sql` — categories + seed

**Files:**

- Create: `packages/db/supabase/migrations/<timestamp>_categories.sql`

- [ ] **Step 1: Create the migration file**

Run:

```bash
cd packages/db && supabase migration new categories && cd ../..
```

- [ ] **Step 2: Write the migration content**

Replace its contents with:

```sql
-- Phase 1: categories static table + seed
-- Per SPEC.md §4.2

create table public.categories (
  id          text primary key,
  label       text not null,
  icon        text not null,
  sort_order  int not null default 0
);

insert into public.categories (id, label, icon, sort_order) values
  ('ai',           'AI & ML',       '✦', 10),
  ('games',        'Games',         '◈', 20),
  ('tools',        'Dev tools',     '◐', 30),
  ('music',        'Music & audio', '◑', 40),
  ('productivity', 'Productivity',  '◉', 50),
  ('creative',     'Creative',      '✺', 60),
  ('data',         'Data viz',      '◰', 70),
  ('web3',         'Web3',          '◇', 80);
```

- [ ] **Step 3: Commit**

Run:

```bash
git add packages/db/supabase/migrations/
git commit -m "feat(db): migration 0002 — categories table + 8 seed rows"
```

---

## Task 5: Migration `0003_rls_phase1.sql` — RLS for profiles + categories

**Files:**

- Create: `packages/db/supabase/migrations/<timestamp>_rls_phase1.sql`

- [ ] **Step 1: Create the migration file**

Run:

```bash
cd packages/db && supabase migration new rls_phase1 && cd ../..
```

- [ ] **Step 2: Write the migration content**

Replace its contents with:

```sql
-- Phase 1: RLS policies for profiles + categories
-- Per SPEC.md §5.2

-- Helper: returns the calling user's id, or null for anon
create or replace function public.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

-- profiles: readable by anyone, writable by owner only
alter table public.profiles enable row level security;

create policy "profiles read for everyone"
  on public.profiles for select using (true);

create policy "profiles update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- categories: readable by anyone, no inserts/updates from clients
alter table public.categories enable row level security;

create policy "categories read for everyone"
  on public.categories for select using (true);
```

> Note: no INSERT/DELETE policies on `profiles` because creation happens via the trigger (security definer, runs as superuser) and deletion cascades from `auth.users`. No write policies on `categories` because seeds happen at migration time and updates happen via service role.

- [ ] **Step 3: Commit**

Run:

```bash
git add packages/db/supabase/migrations/
git commit -m "feat(db): migration 0003 — RLS policies for profiles + categories"
```

---

## Task 6: Apply migrations to Supabase cloud + populate `.env.local`

**Files:**

- Create: `.env.local` (NOT committed — gitignored)

- [ ] **Step 1: Push migrations to cloud**

Run:

```bash
cd packages/db && supabase db push && cd ../..
```

Expected: prompts to confirm migrations to apply, then runs them. Should print "Finished supabase db push" with the 3 migrations applied.

If it errors with "no migrations found", verify the `.sql` files are inside `packages/db/supabase/migrations/`.

If it errors with "duplicate key" or similar, the migration was already applied — check Supabase Dashboard → Database → Migrations.

- [ ] **Step 2: Verify schema in Supabase Dashboard**

Open https://supabase.com/dashboard/project/<project-ref>/database/tables and verify:

- `public.profiles` table exists with columns matching Task 3
- `public.categories` table exists with 8 rows
- RLS is enabled on both (lock icon next to table name)

- [ ] **Step 3: Create `.env.local`**

Copy from `.env.example`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` (with whatever editor) and fill in:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key from Supabase Settings → API>

SUPABASE_SERVICE_ROLE_KEY=<your service_role key from Supabase Settings → API>

# Phase 8 cut, leave blank
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=

# Generate later (Phase 10)
CRON_SECRET=

NEXT_PUBLIC_MCP_URL=http://localhost:8080

# apps/mcp
PORT=8080
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
LOG_LEVEL=info
```

- [ ] **Step 4: Verify `.env.local` is gitignored**

Run: `git status --short | grep env.local`
Expected: empty output. `.env.local` should NOT appear (it's in root `.gitignore` from Phase 0).

If it appears, STOP and report — root `.gitignore` should already cover it.

- [ ] **Step 5: No commit (env values are not committed)**

This task does not produce a commit. The schema migrations were committed in Tasks 3-5. `.env.local` is local-only.

---

## Task 7: Generate Supabase TS types

**Files:**

- Create: `apps/web/lib/supabase/types.ts`

- [ ] **Step 1: Generate types from cloud schema**

Run:

```bash
cd packages/db && supabase gen types typescript --linked > ../../apps/web/lib/supabase/types.ts && cd ../..
```

Expected: creates `apps/web/lib/supabase/types.ts` with TS interfaces for `profiles`, `categories`, etc.

- [ ] **Step 2: Verify the file is non-trivial**

Run: `wc -l apps/web/lib/supabase/types.ts`
Expected: > 50 lines (should have generated `Database` interface with `public.Tables.profiles` etc.).

If the file is empty or near-empty, the link to the project is wrong or migrations weren't applied. STOP and report.

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm --filter web typecheck`
Expected: exit 0.

- [ ] **Step 4: Add a script to regenerate types**

Edit `packages/db/package.json` and add a `gen:types` script:

```json
{
  "name": "@hatch/db",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "lint": "echo 'no lint for db package'",
    "typecheck": "echo 'no typecheck for db package'",
    "build": "echo 'no build for db package'",
    "gen:types": "supabase gen types typescript --linked > ../../apps/web/lib/supabase/types.ts"
  }
}
```

Now `pnpm --filter @hatch/db gen:types` regenerates types after every schema change.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/lib/supabase/types.ts packages/db/package.json
git commit -m "feat(web): generated supabase types + gen:types script"
```

---

## Task 8: Real Supabase clients (replace Phase 0 stubs)

**Files:**

- Modify: `apps/web/lib/supabase/server.ts`
- Modify: `apps/web/lib/supabase/client.ts`
- Modify: `apps/web/lib/supabase/admin.ts`
- Modify: `apps/web/package.json` (add deps)

- [ ] **Step 1: Add Supabase deps to apps/web**

Edit `apps/web/package.json`. Add to `dependencies`:

```json
"@supabase/ssr": "^0.5.0",
"@supabase/supabase-js": "^2.45.0"
```

The `dependencies` block becomes:

```json
"dependencies": {
  "@hatch/shared": "workspace:*",
  "@supabase/ssr": "^0.5.0",
  "@supabase/supabase-js": "^2.45.0",
  "next": "<keep existing version>",
  "react": "<keep existing version>",
  "react-dom": "<keep existing version>"
}
```

Run: `pnpm install`
Expected: installs both packages, updates lockfile.

- [ ] **Step 2: Replace `apps/web/lib/supabase/server.ts`**

Overwrite with:

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // RSC-only context — cookies are read-only here. Middleware refreshes them.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Replace `apps/web/lib/supabase/client.ts`**

Overwrite with:

```ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: Replace `apps/web/lib/supabase/admin.ts`**

Overwrite with:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Service-role client. Bypasses RLS. ONLY use from server actions or webhooks.
// Never import from a client component or RSC.

export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
```

The `'server-only'` import causes a build error if anyone tries to import this from a client component.

- [ ] **Step 5: Verify typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/lib/supabase/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): real supabase clients (server, browser, admin)"
```

---

## Task 9: `getUser()` auth helper

**Files:**

- Create: `apps/web/lib/auth.ts`

- [ ] **Step 1: Write `apps/web/lib/auth.ts`**

Create with:

```ts
import { createSupabaseServerClient } from './supabase/server';

// Returns the current user's auth row + their profile, or null if not signed in.
// Use this from server actions and RSCs.

export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (!profile) return null;
  return { user, profile };
}

export async function requireUser() {
  const result = await getUser();
  if (!result) throw new Error('UNAUTHORIZED');
  return result;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/web/lib/auth.ts
git commit -m "feat(web): getUser/requireUser auth helper"
```

---

## Task 10: `middleware.ts` — session refresh

**Files:**

- Create: `apps/web/middleware.ts`

- [ ] **Step 1: Write `apps/web/middleware.ts`**

Create with:

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './lib/supabase/types';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options as CookieOptions);
          });
        },
      },
    },
  );

  // CRITICAL: refresh session cookie. Do not remove this line.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets (.png, .jpg, .svg, .ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/web/middleware.ts
git commit -m "feat(web): middleware refreshes supabase session cookie"
```

---

## Task 11: Auth routes — callback + sign-out

**Files:**

- Create: `apps/web/app/auth/callback/route.ts`
- Create: `apps/web/app/auth/sign-out/route.ts`

- [ ] **Step 1: Write `apps/web/app/auth/callback/route.ts`**

Create with:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/settings/profile';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
```

- [ ] **Step 2: Write `apps/web/app/auth/sign-out/route.ts`**

Create with:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/app/auth/
git commit -m "feat(web): auth callback + sign-out routes"
```

---

## Task 12: Sign-in page

**Files:**

- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/sign-in/page.tsx`
- Create: `apps/web/app/(auth)/sign-in/sign-in-buttons.tsx`

- [ ] **Step 1: Write `apps/web/app/(auth)/layout.tsx`**

Create with:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 400, width: '100%' }}>{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Write `apps/web/app/(auth)/sign-in/page.tsx`**

Create with:

```tsx
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { SignInButtons } from './sign-in-buttons';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getUser();
  if (user) redirect(params.next ?? '/settings/profile');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, textAlign: 'center' }}>Sign in to Hatch</h1>
      {params.error && (
        <p style={{ color: 'crimson', textAlign: 'center' }}>Sign-in failed. Please try again.</p>
      )}
      <SignInButtons next={params.next ?? '/settings/profile'} />
    </div>
  );
}
```

- [ ] **Step 3: Write `apps/web/app/(auth)/sign-in/sign-in-buttons.tsx`**

Create with:

```tsx
'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function SignInButtons({ next }: { next: string }) {
  async function signIn(provider: 'github' | 'google') {
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  }

  const buttonStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: 8,
    cursor: 'pointer',
    backgroundColor: 'white',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <button type="button" onClick={() => signIn('github')} style={buttonStyle}>
        Continue with GitHub
      </button>
      <button type="button" onClick={() => signIn('google')} style={buttonStyle}>
        Continue with Google
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter web build`
Expected: exit 0. The route group `(auth)` should compile to a route at `/sign-in`.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/app/
git commit -m "feat(web): sign-in page with github + google OAuth buttons"
```

---

## Task 13: `/settings/profile` page + edit action

**Files:**

- Create: `apps/web/lib/zod/profile.ts`
- Create: `apps/web/lib/actions/profile.ts`
- Create: `apps/web/app/settings/profile/page.tsx`
- Create: `apps/web/app/settings/profile/profile-form.tsx`

- [ ] **Step 1: Add React Hook Form + Zod**

Edit `apps/web/package.json` and add to `dependencies`:

```json
"react-hook-form": "^7.53.0",
"@hookform/resolvers": "^3.9.0",
"zod": "^3.23.0"
```

Run: `pnpm install`
Expected: installs the 3 packages.

- [ ] **Step 2: Write `apps/web/lib/zod/profile.ts`**

Create with:

```ts
import { z } from 'zod';

export const ProfileLinkSchema = z.object({
  label: z.string().min(1).max(40),
  url: z.string().url(),
});

export const UpdateProfileInput = z.object({
  display_name: z.string().min(1).max(60),
  bio: z.string().max(280).nullable(),
  links: z.array(ProfileLinkSchema).max(8),
});

export type UpdateProfileInputType = z.infer<typeof UpdateProfileInput>;
```

- [ ] **Step 3: Write `apps/web/lib/actions/profile.ts`**

Create with:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { UpdateProfileInput, type UpdateProfileInputType } from '@/lib/zod/profile';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function updateProfile(
  input: UpdateProfileInputType,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateProfileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from('profiles')
    .update({
      display_name: parsed.data.display_name,
      bio: parsed.data.bio,
      links: parsed.data.links,
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/profile');
  return { ok: true, data: { id: user.id } };
}
```

- [ ] **Step 4: Write `apps/web/app/settings/profile/page.tsx`**

Create with:

```tsx
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ProfileForm } from './profile-form';

export default async function SettingsProfilePage() {
  const result = await getUser();
  if (!result) redirect('/sign-in?next=/settings/profile');

  const { profile } = result;
  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Edit profile</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Signed in as <strong>@{profile.handle}</strong>
      </p>
      <ProfileForm
        initial={{
          display_name: profile.display_name,
          bio: profile.bio,
          links: (profile.links as { label: string; url: string }[]) ?? [],
        }}
      />
      <form action="/auth/sign-out" method="post" style={{ marginTop: '3rem' }}>
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ccc',
            borderRadius: 8,
            cursor: 'pointer',
            backgroundColor: 'white',
          }}
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Write `apps/web/app/settings/profile/profile-form.tsx`**

Create with:

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateProfileInput, type UpdateProfileInputType } from '@/lib/zod/profile';
import { updateProfile } from '@/lib/actions/profile';

interface Props {
  initial: UpdateProfileInputType;
}

export function ProfileForm({ initial }: Props) {
  const { register, handleSubmit, formState } = useForm<UpdateProfileInputType>({
    resolver: zodResolver(UpdateProfileInput),
    defaultValues: initial,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onSubmit(values: UpdateProfileInputType) {
    setServerError(null);
    const result = await updateProfile(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSavedAt(Date.now());
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: 8,
    marginTop: 4,
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <label>
        Display name
        <input {...register('display_name')} style={inputStyle} />
        {formState.errors.display_name && (
          <small style={{ color: 'crimson' }}>{formState.errors.display_name.message}</small>
        )}
      </label>

      <label>
        Bio
        <textarea {...register('bio')} rows={3} style={inputStyle} />
        {formState.errors.bio && (
          <small style={{ color: 'crimson' }}>{formState.errors.bio.message}</small>
        )}
      </label>

      <button
        type="submit"
        disabled={formState.isSubmitting}
        style={{
          padding: '0.75rem 1rem',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          backgroundColor: '#a855f7',
          color: 'white',
          fontWeight: 600,
        }}
      >
        {formState.isSubmitting ? 'Saving…' : 'Save profile'}
      </button>

      {serverError && <small style={{ color: 'crimson' }}>Error: {serverError}</small>}
      {savedAt && <small style={{ color: 'green' }}>Saved.</small>}
    </form>
  );
}
```

> Note: this form does not edit `links` in v1 — `links` is in the schema and Zod but the UI is just display name + bio for Phase 1. Phase 2+ design pass adds the links editor.

- [ ] **Step 6: Verify build**

Run: `pnpm --filter web build`
Expected: exit 0.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/web/ pnpm-lock.yaml
git commit -m "feat(web): /settings/profile page with edit form"
```

---

## Task 14: Update root home page with sign-in link

**Files:**

- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Update home page**

Overwrite `apps/web/app/page.tsx` with:

```tsx
import Link from 'next/link';
import { getUser } from '@/lib/auth';

export default async function HomePage() {
  const result = await getUser();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <h1 style={{ fontSize: '3rem', fontWeight: 700 }}>Hatch</h1>
      {result ? (
        <Link
          href="/settings/profile"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #ccc',
            borderRadius: 8,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          Hi @{result.profile.handle} — edit profile
        </Link>
      ) : (
        <Link
          href="/sign-in"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #ccc',
            borderRadius: 8,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          Sign in
        </Link>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: exit 0.

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): home page shows sign-in or profile link based on auth"
```

---

## Task 15: End-to-end smoke test (manual)

This task is a manual verification of the full Phase 1 Done criteria. No code changes.

**Files:** none

- [ ] **Step 1: Start dev server**

Run:

```bash
pnpm dev &
sleep 8
```

- [ ] **Step 2: Open the home page**

Open http://localhost:3000 in a browser.
Expected: shows "Hatch" + "Sign in" link.

- [ ] **Step 3: Click "Sign in"**

Should land at `/sign-in` with two big buttons (GitHub + Google).

- [ ] **Step 4: Click "Continue with GitHub"**

Should redirect to GitHub OAuth consent screen, then back to `/auth/callback?code=...`, then to `/settings/profile`.

If redirect fails (lands at `/sign-in?error=auth_failed`), check:

- Supabase OAuth settings for GitHub
- Callback URL matches `https://<project-ref>.supabase.co/auth/v1/callback`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct in `.env.local`

- [ ] **Step 5: Verify profile row was created**

In Supabase Dashboard → Table Editor → `profiles`:

- A new row with your `id` matching `auth.users.id`
- `handle` auto-generated from your GitHub username (lowercased, sanitized)
- `display_name` from your GitHub full name or username
- `avatar_url` from your GitHub avatar

- [ ] **Step 6: Edit your bio**

In `/settings/profile`:

- Type a bio (e.g., "Testing Phase 1")
- Click "Save profile"
- Should see "Saved." message
- Refresh the page — bio should persist

In Supabase Dashboard → `profiles` row: `bio` column updated, `updated_at` recent.

- [ ] **Step 7: Sign out**

Click "Sign out" button.
Expected: redirected to `/`. Refreshing shows "Sign in" link again.

- [ ] **Step 8: Stop dev server**

Run:

```bash
kill %1 2>/dev/null
pkill -f "next dev" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
```

- [ ] **Step 9: Final report**

Report Phase 1 Done criteria:

- Sign in with GitHub: ✓ / ✗
- Profile row exists: ✓ / ✗
- Edit bio works and persists: ✓ / ✗
- Sign out works: ✓ / ✗
- All commits in `git log`: list count

If all four checks pass, Phase 1 is COMPLETE. Push to remote:

```bash
git push origin main
```

---

## Self-review notes

**Spec coverage check (each SPEC §16 Phase 1 bullet → task):**

| SPEC §16 Phase 1 bullet                              | Task                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Migration 0001_init.sql                              | T3                                                                                                             |
| Migration 0002_categories.sql                        | T4                                                                                                             |
| Enable Google + GitHub OAuth in Supabase             | T1 (manual)                                                                                                    |
| `lib/supabase/{server,client,admin}.ts`              | T8                                                                                                             |
| `app/auth/callback/route.ts`                         | T11                                                                                                            |
| `middleware.ts` session refresh                      | T10                                                                                                            |
| Sign-in page with two big OAuth buttons              | T12                                                                                                            |
| `/settings/profile` to edit display name, bio, links | T13 (note: links editor deferred to Phase 2 styling pass — Zod accepts them, form only edits name + bio in v1) |

**Additions beyond strict §16 list (justified):**

- T9 `getUser`/`requireUser` helpers — needed by every protected action; cleaner to add now than refactor in Phase 2.
- T14 home page update — without it, no obvious entry point for sign-in. 5 lines of code.
- T15 E2E smoke — closes the Phase 1 Done loop ("sign in → profile exists → edit bio").
- T5 RLS migration — SPEC §5 says "enable RLS on every table from day 1". Profiles + categories deserve their policies now, not deferred.
- `notification_prefs` column on `profiles` (added in T3) — saves a future migration; matches roadmap §5.4 shape.

**Placeholder scan:** clean. Every code step has complete code. Every command step has expected output. Two `<placeholder>` markers exist (`<PROJECT_REF>` in T2 Step 4; OAuth Client ID/Secret in T1) — these are unavoidable user-supplied values, not author placeholders.

**Type consistency:**

- `createSupabaseServerClient` (T8) used by T9, T11, T13 — same name throughout.
- `createSupabaseBrowserClient` (T8) used by T12 — same name.
- `createSupabaseAdminClient` (T8) defined but unused in Phase 1 — Phase 6+ uses it for trigger-side notification writes.
- `getUser` (T9) used by T12, T13, T14 — same signature.
- `Database` type (T7) imported by T8, T10, T13 — same source.
- `UpdateProfileInput` Zod schema (T13) used by both server action and client form — single source of truth.

**Adapted from spec deviations (already documented in roadmap):**

- No `supabase start` (no Docker) — use cloud project directly via `supabase db push`.
- No email — `notification_prefs` shape is push-only.

---

_End of plan._

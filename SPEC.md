# Hatch — Build Spec

> A community gallery for builders to publish, discover, and connect around side-projects. Open source spirit, modern stack, agent-friendly.

Last updated: 2026-05-14
Target executor: Claude Code

---

## 0. TL;DR for Claude Code

You are building **Hatch**, a Product-Hunt-for-builders web app, from a working visual prototype (React + plain JS, Babel-standalone) into a production app on three services:

| Service   | Role                                                            |
| --------- | --------------------------------------------------------------- |
| Vercel    | Next.js 15 (App Router) — frontend, server actions, API routes  |
| Supabase  | Postgres + Auth (Google + GitHub) + Storage + Realtime          |
| Railway   | MCP server (long-lived process, agent integration)              |
| Resend    | Transactional email                                             |

The prototype's JSX, CSS, and seed data live under `/prototype/` in the repo and are reference material — do not import them at runtime, port them.

Read this whole document once before starting. Then follow `§16 — Build phases` in order. Don't skip phases; each one is a working app.

When in doubt: copy the prototype's visual language exactly (paddings, radii, typography, motion). The design is already good. Don't redecorate.

---

## 1. Product summary

Hatch is a single community where every user is a **builder** (no separate "investor" or "scout" account types — anyone can publish, anyone can reach out, anyone can comment). The product has 6 screens:

1. **Discover (Gallery)** — feed of apps with a "App of the week" hero, category chips, sort tabs (Hot / New / Most loved), and a responsive card grid.
2. **App detail** — Pinterest-style action bar (like / save / share / comment), description, stack tags, changelog, threaded comments (1 level deep), author sidebar with "Contact" CTA.
3. **Profile** — banner gradient derived from user hue, avatar, bio, links, tabs (Apps / Liked), stats grid.
4. **Publish** — single-page form with live card preview, completion meter, category tiles, tags input, accent color picker.
5. **Contact modal** — overlay launched from app detail / profile. Three stages: compose → done. Roles: investor / partner / hire / fan. Explicit consent checkbox before submitting.
6. **Messages (Inbox)** — Slack-style split view: conversation list on the left (filter tabs All / Investors / Community / Unread), thread on the right with header (other person's role + firm + check size if investor), CTAs "View profile / Decline politely / Accept & schedule call".

Plus a **notifications bell** dropdown in the topbar (contact requests with accept/decline, plus like/comment activity).

### Removed from the prototype

- **Remix** — drop the concept entirely. No remix button, no remix tab, no remix count, no `remixes` column. The prototype had it but the product doesn't want it.
- **Tweaks panel** — the prototype's runtime style switcher (5 card styles, 3 fonts, 3 densities) was a sandbox for design exploration. Production ships **one** combination: classic card, regular density, Geist + Geist Mono, default violet accent (`#a855f7`).
- **Theme** — dark mode stays. Add a sun/moon toggle pill in the topbar (CSS already in `prototype/Hatch.html`, lines describing `.theme-toggle`). Persist preference in `localStorage` + sync to `profile.theme_preference` when signed in.

---

## 2. Architecture

```
                    ┌─────────────────────┐
                    │   User's browser    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
       ┌─────────────────┐         ┌────────────────────┐
       │  Vercel         │         │  Supabase Realtime │
       │  Next.js 15 App │◀───────▶│  WebSocket (notifs │
       │  ─ RSC pages    │         │   + messages)      │
       │  ─ Server       │         └────────────────────┘
       │    Actions      │                  │
       │  ─ Route        │                  │
       │    Handlers     │                  ▼
       │  ─ Webhooks     │         ┌────────────────────┐
       └────────┬────────┘         │  Supabase Postgres │
                │                  │  + RLS policies    │
                ├─────────────────▶│  + Storage (covers │
                │                  │     + avatars)     │
                │                  │  + Auth (OAuth     │
                │                  │     Google,GitHub) │
                │                  └────────────────────┘
                │                            ▲
                ▼                            │
       ┌─────────────────┐                   │
       │  Resend         │                   │
       │  (transactional │                   │
       │   email)        │                   │
       └─────────────────┘                   │
                                             │
                    ┌────────────────────────┴────────────┐
                    │  Railway                            │
                    │  Hatch MCP server                   │
                    │  ─ Streamable HTTP transport        │
                    │  ─ Per-user API key auth            │
                    │  ─ Hits Supabase REST/JS as the     │
                    │    signed-in user (using PAT)       │
                    └──────────────────────┬──────────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │  Agent client        │
                                │  (Claude Desktop,    │
                                │   Claude Code, etc)  │
                                └──────────────────────┘
```

### Why each service

- **Vercel + Next.js 15**: SSR for SEO of public app pages, server actions to keep the client small, ISR for the gallery feed, Vercel Cron for the weekly featured-app job.
- **Supabase**: One vendor solves Postgres + Auth + Storage + Realtime. RLS lets us keep most business rules in the database where they're harder to bypass. Realtime gives us the bell badge and chat for free.
- **Railway**: Hosts the MCP server. MCP needs a persistent process (HTTP+SSE / streaming), which is awkward on Vercel serverless. Railway is the right shape: long-lived Node process, deploy from the same monorepo.
- **Resend**: Cheapest, cleanest DX for transactional. React Email for templates.

### What does NOT live in Railway (yet)

If, later, we add: AI-powered tagging, anti-spam moderation, image processing pipelines, or a custom long-running websocket — those go to Railway too. For v1, Railway only runs the MCP server.

---

## 3. Repo layout (monorepo, pnpm workspaces)

```
hatch/
├── apps/
│   ├── web/                 # Next.js app (deploys to Vercel)
│   │   ├── app/
│   │   │   ├── (marketing)/        # Public, unauthenticated routes
│   │   │   │   ├── page.tsx        # Landing if logged out / redirect to /home if logged in
│   │   │   │   └── about/page.tsx
│   │   │   ├── (app)/              # Authenticated shell with sidebar
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── home/page.tsx           # Discover (default feed)
│   │   │   │   ├── trending/page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   ├── following/page.tsx
│   │   │   │   ├── c/[category]/page.tsx   # /c/games, /c/ai, etc.
│   │   │   │   ├── a/[slug]/page.tsx       # App detail
│   │   │   │   ├── u/[handle]/page.tsx     # Profile
│   │   │   │   ├── publish/page.tsx
│   │   │   │   ├── messages/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [conversationId]/page.tsx
│   │   │   │   └── settings/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── profile/page.tsx
│   │   │   │       └── api-keys/page.tsx
│   │   │   ├── auth/
│   │   │   │   ├── callback/route.ts        # OAuth callback
│   │   │   │   └── sign-out/route.ts
│   │   │   ├── api/
│   │   │   │   ├── search/route.ts          # GET, public read
│   │   │   │   ├── apps/route.ts            # GET list, public read
│   │   │   │   ├── apps/[slug]/route.ts     # GET one app
│   │   │   │   └── webhooks/resend/route.ts
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css                  # Design tokens (light + dark)
│   │   │   └── llms.txt/route.ts            # Agent-friendly site map
│   │   ├── components/
│   │   │   ├── ui/                          # shadcn primitives
│   │   │   ├── card/                        # AppCard (classic only)
│   │   │   ├── shell/                       # Topbar, sidebar, theme toggle
│   │   │   ├── gallery/                     # FeaturedHero, FilterChips, Grid
│   │   │   ├── detail/                      # ActionBar, Comments, Panels
│   │   │   ├── profile/
│   │   │   ├── publish/
│   │   │   ├── contact/                     # ContactModal
│   │   │   ├── notifications/               # Bell + dropdown
│   │   │   ├── messages/                    # ConversationList, MessageThread
│   │   │   └── art/                         # AppArt procedural covers
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── server.ts                # Server client (cookies)
│   │   │   │   ├── client.ts                # Browser client
│   │   │   │   ├── admin.ts                 # Service-role client (server only)
│   │   │   │   └── types.ts                 # Generated from `supabase gen types`
│   │   │   ├── actions/                     # Server actions, one file per domain
│   │   │   │   ├── apps.ts
│   │   │   │   ├── likes.ts
│   │   │   │   ├── comments.ts
│   │   │   │   ├── contact.ts
│   │   │   │   ├── messages.ts
│   │   │   │   └── notifications.ts
│   │   │   ├── email/                       # React Email templates
│   │   │   │   ├── contact-received.tsx
│   │   │   │   ├── contact-accepted.tsx
│   │   │   │   ├── weekly-digest.tsx
│   │   │   │   └── send.ts                  # Resend wrapper
│   │   │   ├── ranking.ts                   # Hot score formula
│   │   │   ├── slug.ts
│   │   │   └── format.ts                    # fmtNum, time ago, etc.
│   │   ├── public/
│   │   ├── middleware.ts                    # Refresh Supabase session
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── mcp/                 # MCP server (deploys to Railway)
│       ├── src/
│       │   ├── index.ts                     # Bootstrap, transport
│       │   ├── auth.ts                      # API key → user_id
│       │   ├── tools/
│       │   │   ├── list-apps.ts
│       │   │   ├── get-app.ts
│       │   │   ├── publish-app.ts
│       │   │   ├── search-apps.ts
│       │   │   ├── get-notifications.ts
│       │   │   ├── send-message.ts
│       │   │   └── create-contact.ts
│       │   ├── resources/
│       │   │   ├── app-resource.ts
│       │   │   └── profile-resource.ts
│       │   ├── prompts/
│       │   │   ├── publish.ts
│       │   │   └── scout.ts
│       │   └── supabase.ts
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── db/                  # Migrations + seed
│   │   ├── migrations/
│   │   │   ├── 0001_init.sql
│   │   │   ├── 0002_apps.sql
│   │   │   ├── 0003_social.sql
│   │   │   ├── 0004_messaging.sql
│   │   │   ├── 0005_notifications.sql
│   │   │   ├── 0006_search.sql
│   │   │   ├── 0007_api_keys.sql
│   │   │   └── 0008_rls.sql
│   │   ├── seed.sql                         # Seed categories + a few demo apps
│   │   ├── config.toml                      # Supabase CLI config
│   │   └── README.md
│   └── shared/              # Cross-app TypeScript types and helpers
│       ├── src/
│       │   ├── categories.ts                # The 9 category constants
│       │   ├── ranking.ts                   # Same formula, used by web + mcp
│       │   └── types.ts
│       └── package.json
├── prototype/               # The HTML/JSX prototype (reference only)
├── docs/
│   ├── design-system.md
│   ├── mcp.md                               # MCP tool/resource/prompt reference
│   └── deployment.md
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

---

## 4. Data model

Postgres on Supabase. Conventions: all primary keys are `uuid` with `default gen_random_uuid()`. All tables have `created_at timestamptz default now()`. Soft-delete only where listed; otherwise hard delete. All foreign keys use `on delete cascade` unless noted.

Every migration goes in `packages/db/migrations/`, numbered. Apply via Supabase CLI in CI.

### 4.1 — `profiles`

Extends `auth.users` 1-1. A trigger creates the row on signup.

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext unique not null check (handle ~ '^[a-z0-9_]{2,24}$'),
  display_name  text not null,
  bio           text,
  avatar_url    text,
  hue           int not null default 200 check (hue between 0 and 360),
  emoji         text default '◇',
  links         jsonb not null default '[]'::jsonb,
                -- shape: [{ "label": "site", "url": "https://..." }, ...]
  theme_pref    text not null default 'system' check (theme_pref in ('light','dark','system')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.profiles (created_at desc);
```

Trigger to mirror new auth users:

```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_handle text;
  candidate   text;
  i           int := 0;
begin
  -- Build a handle from OAuth metadata
  base_handle := lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data->>'user_name',          -- GitHub
      new.raw_user_meta_data->>'preferred_username', -- Google
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 4.2 — `categories`

Seeded static, but kept in the DB so we can add new ones without a deploy.

```sql
create table public.categories (
  id          text primary key,          -- 'ai', 'games', ...
  label       text not null,
  icon        text not null,             -- the glyph used by the prototype
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

### 4.3 — `apps`

```sql
create table public.apps (
  id              uuid primary key default gen_random_uuid(),
  slug            citext unique not null,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (length(title) between 1 and 64),
  tagline         text not null check (length(tagline) between 1 and 140),
  description     text not null default '',          -- markdown
  link            text not null check (link ~ '^https?://'),
  category_id     text not null references public.categories(id),
  cover_url       text,                              -- Supabase Storage
  art_kind        text not null default 'pixel',     -- procedural fallback if no cover
  accent          text not null default '#a855f7' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  tags            text[] not null default '{}' check (array_length(tags, 1) is null or array_length(tags, 1) <= 6),
  is_published    boolean not null default true,
  published_at    timestamptz not null default now(),
  views_count     int not null default 0,
  likes_count     int not null default 0,
  saves_count     int not null default 0,
  comments_count  int not null default 0,
  hot_score       double precision not null default 0,
  search_vector   tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('simple', coalesce(tagline, '')),     'B') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')),'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.apps (author_id);
create index on public.apps (category_id);
create index on public.apps (published_at desc);
create index on public.apps (hot_score desc);
create index on public.apps using gin (search_vector);
create index on public.apps using gin (tags);

-- Generate slug from title on insert if not provided
create or replace function public.apps_set_slug() returns trigger
language plpgsql as $$
declare
  base text;
  candidate text;
  i int := 0;
begin
  if new.slug is null or new.slug = '' then
    base := lower(regexp_replace(new.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base := trim(both '-' from base);
    if base = '' then base := 'app'; end if;
    candidate := base;
    while exists (select 1 from public.apps where slug = candidate and id <> new.id) loop
      i := i + 1;
      candidate := base || '-' || i::text;
    end loop;
    new.slug := candidate;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger apps_before_write
  before insert or update on public.apps
  for each row execute function public.apps_set_slug();
```

The `*_count` columns are denormalized for read performance — keep them in sync via triggers (see §4.5) so the UI can sort by `likes_count` without an aggregate.

### 4.4 — Social interactions

```sql
-- Likes (one per (user, app))
create table public.likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  app_id     uuid not null references public.apps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);
create index on public.likes (app_id);

-- Saves
create table public.saves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  app_id     uuid not null references public.apps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

-- Follows (user → user)
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- Comments (1 level of replies max)
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  app_id      uuid not null references public.apps(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  body        text not null check (length(body) between 1 and 2000),
  likes_count int not null default 0,
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.comments (app_id, created_at desc);
create index on public.comments (parent_id);

-- Enforce 1 level of nesting
create or replace function public.comments_check_depth() returns trigger
language plpgsql as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.comments where id = new.parent_id and parent_id is not null) then
      raise exception 'comments can only nest one level deep';
    end if;
  end if;
  return new;
end $$;
create trigger comments_depth_check
  before insert or update on public.comments
  for each row execute function public.comments_check_depth();

-- Comment likes
create table public.comment_likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
```

### 4.5 — Denormalized counters

Triggers keep `apps.likes_count`, `apps.saves_count`, `apps.comments_count`, and `comments.likes_count` correct. Pattern (repeat per table):

```sql
create or replace function public.bump_likes_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set likes_count = likes_count + 1 where id = new.app_id;
  elsif tg_op = 'DELETE' then
    update public.apps set likes_count = greatest(likes_count - 1, 0) where id = old.app_id;
  end if;
  return null;
end $$;
create trigger likes_after_change
  after insert or delete on public.likes
  for each row execute function public.bump_likes_count();
```

Repeat for `saves`, `comments`, and `comment_likes` with the appropriate target table/column. Don't forget the "deleted" branch for comments (use the `is_deleted` flag rather than DELETE, so threads keep their structure).

### 4.6 — Contact requests + conversations + messages

The two states (request → conversation) are separate tables because the request has consent-flow metadata that doesn't belong on every message.

```sql
create type public.contact_role as enum ('investor', 'partner', 'hire', 'fan');
create type public.contact_status as enum ('pending', 'accepted', 'declined', 'expired');

create table public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  app_id        uuid references public.apps(id) on delete set null,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  role          public.contact_role not null,
  note          text not null default '' check (length(note) <= 600),
  sender_link   text,                              -- LinkedIn, firm site
  status        public.contact_status not null default 'pending',
  responded_at  timestamptz,
  conversation_id uuid,                            -- set when accepted, FK added after table exists
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index on public.contact_requests (recipient_id, status, created_at desc);

-- Conversations are 1:1 for v1. Could become group later.
create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles(id) on delete cascade,
  participant_b uuid not null references public.profiles(id) on delete cascade,
  app_id       uuid references public.apps(id) on delete set null,  -- the app that started it
  last_message_at timestamptz,
  created_at   timestamptz not null default now(),
  check (participant_a < participant_b)            -- canonical order; prevents dup pairs
);
create unique index on public.conversations (participant_a, participant_b);
create index on public.conversations (participant_a, last_message_at desc nulls last);
create index on public.conversations (participant_b, last_message_at desc nulls last);

alter table public.contact_requests
  add constraint contact_requests_conversation_fk
  foreign key (conversation_id) references public.conversations(id) on delete set null;

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);

-- Bump conversation.last_message_at automatically
create or replace function public.messages_bump_conversation() returns trigger
language plpgsql as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end $$;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_bump_conversation();
```

Helper to look up or open a canonical conversation between two users (used when accepting a contact request):

```sql
create or replace function public.find_or_create_conversation(
  user_a uuid, user_b uuid, app uuid
) returns uuid language plpgsql security definer as $$
declare
  lo uuid := least(user_a, user_b);
  hi uuid := greatest(user_a, user_b);
  conv_id uuid;
begin
  select id into conv_id from public.conversations
    where participant_a = lo and participant_b = hi;
  if conv_id is not null then return conv_id; end if;
  insert into public.conversations (participant_a, participant_b, app_id)
    values (lo, hi, app)
    returning id into conv_id;
  return conv_id;
end $$;
```

### 4.7 — Notifications

```sql
create type public.notif_kind as enum (
  'contact_request',   -- someone wants to contact me
  'contact_accepted',  -- my contact request was accepted
  'contact_declined',  -- my contact request was declined
  'like',              -- someone liked my app
  'comment',           -- someone commented on my app
  'comment_reply',     -- someone replied to my comment
  'follow',            -- someone followed me
  'message'            -- new message in a conversation
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete cascade,
  kind        public.notif_kind not null,
  app_id      uuid references public.apps(id) on delete cascade,
  comment_id  uuid references public.comments(id) on delete cascade,
  contact_request_id uuid references public.contact_requests(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb,
                                              -- snapshot of e.g. comment text at notify time
                                              -- so the bell doesn't change wording after edits
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notifications (recipient_id, created_at desc);
create index on public.notifications (recipient_id) where read_at is null;
```

Notifications are written either (a) by triggers on the source tables, or (b) by server actions in the web app, depending on what's easier. Triggers for `like` / `comment` / `comment_reply` / `follow` are cleanest. Server actions for `contact_*` and `message` so we can also fire the Resend email in the same code path.

### 4.8 — API keys (for MCP)

Users generate a key in `/settings/api-keys` and paste it into Claude Desktop / Code's MCP config. Store as a SHA-256 hash; show the key once on creation.

```sql
create table public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,                           -- "Claude Desktop", "my laptop"
  key_hash    text not null unique,                    -- sha256 hex
  key_prefix  text not null,                           -- first 8 chars, shown in UI
  scopes      text[] not null default array['read','write']::text[],
  last_used_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.api_keys (user_id);
create index on public.api_keys (key_hash) where revoked_at is null;
```

Format: `hatch_pat_<32 random base32 chars>`. Verification on the MCP side: hash the incoming token, look up in `api_keys` where `revoked_at is null`, update `last_used_at`.


---

## 5. Row-Level Security (RLS)

Enable RLS on every table in `public`. The default-deny posture matters: forget one policy and reads will fail loudly during dev, which is the goal.

### 5.1 — Helpers

```sql
-- Returns the calling user's id, or null for anon
create or replace function public.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

-- Used inside policies for "I'm a participant in this conversation"
create or replace function public.is_participant(c uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.conversations
     where id = c
       and (participant_a = auth.uid() or participant_b = auth.uid())
  )
$$;
```

### 5.2 — Policies (one per table)

```sql
-- ─── profiles ────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles read for everyone"
  on public.profiles for select using (true);

create policy "profiles update own"
  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ─── categories ──────────────────────────────────────────────
alter table public.categories enable row level security;
create policy "categories read for everyone"
  on public.categories for select using (true);

-- ─── apps ────────────────────────────────────────────────────
alter table public.apps enable row level security;

create policy "apps read published"
  on public.apps for select using (is_published or author_id = auth.uid());

create policy "apps insert own"
  on public.apps for insert with check (author_id = auth.uid());

create policy "apps update own"
  on public.apps for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "apps delete own"
  on public.apps for delete using (author_id = auth.uid());

-- ─── likes / saves / follows ─────────────────────────────────
alter table public.likes  enable row level security;
alter table public.saves  enable row level security;
alter table public.follows enable row level security;

create policy "likes readable" on public.likes for select using (true);
create policy "likes insert own" on public.likes for insert
  with check (user_id = auth.uid());
create policy "likes delete own" on public.likes for delete
  using (user_id = auth.uid());

create policy "saves readable own" on public.saves for select using (user_id = auth.uid());
create policy "saves insert own" on public.saves for insert with check (user_id = auth.uid());
create policy "saves delete own" on public.saves for delete using (user_id = auth.uid());

create policy "follows readable" on public.follows for select using (true);
create policy "follows insert own" on public.follows for insert
  with check (follower_id = auth.uid());
create policy "follows delete own" on public.follows for delete
  using (follower_id = auth.uid());

-- ─── comments ───────────────────────────────────────────────
alter table public.comments enable row level security;

create policy "comments readable" on public.comments for select
  using (not is_deleted or author_id = auth.uid());
create policy "comments insert own" on public.comments for insert
  with check (author_id = auth.uid());
create policy "comments update own" on public.comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());

alter table public.comment_likes enable row level security;
create policy "comment_likes readable" on public.comment_likes for select using (true);
create policy "comment_likes insert own" on public.comment_likes for insert
  with check (user_id = auth.uid());
create policy "comment_likes delete own" on public.comment_likes for delete
  using (user_id = auth.uid());

-- ─── contact_requests ───────────────────────────────────────
alter table public.contact_requests enable row level security;

create policy "contact_requests read involved"
  on public.contact_requests for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "contact_requests insert as sender"
  on public.contact_requests for insert
  with check (sender_id = auth.uid());

create policy "contact_requests update by recipient"
  on public.contact_requests for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ─── conversations + messages ───────────────────────────────
alter table public.conversations enable row level security;

create policy "conversations read participant"
  on public.conversations for select
  using (participant_a = auth.uid() or participant_b = auth.uid());

-- Conversations are only created by the find_or_create_conversation
-- SECURITY DEFINER function, called from server actions after consent.
-- No client-side INSERT policy on purpose.

alter table public.messages enable row level security;

create policy "messages read participant"
  on public.messages for select using (public.is_participant(conversation_id));

create policy "messages insert as participant"
  on public.messages for insert
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

create policy "messages update own"
  on public.messages for update
  using (sender_id = auth.uid() or
         (read_at is null and public.is_participant(conversation_id)))
  with check (sender_id = auth.uid() or
              (read_at is not null and public.is_participant(conversation_id)));
-- (The update policy is split so the *recipient* can flip read_at,
--  but only the sender can edit body — enforced in app code, since
--  RLS can't restrict per-column easily.)

-- ─── notifications ──────────────────────────────────────────
alter table public.notifications enable row level security;

create policy "notifications read own"
  on public.notifications for select using (recipient_id = auth.uid());

create policy "notifications update own"
  on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- INSERT happens through SECURITY DEFINER functions or service-role
-- (server actions / triggers), never directly from the client.

-- ─── api_keys ───────────────────────────────────────────────
alter table public.api_keys enable row level security;

create policy "api_keys read own"
  on public.api_keys for select using (user_id = auth.uid());
create policy "api_keys insert own"
  on public.api_keys for insert with check (user_id = auth.uid());
create policy "api_keys update own"
  on public.api_keys for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "api_keys delete own"
  on public.api_keys for delete using (user_id = auth.uid());
```

### 5.3 — RLS testing checklist

Before merging the RLS migration, verify in the Supabase SQL editor (running queries as different `auth.uid()` values via `set request.jwt.claims`):

- Anonymous can SELECT from `apps` (only published), `profiles`, `categories`, `comments`, `likes`, `follows`.
- Anonymous **cannot** INSERT anywhere.
- User A cannot UPDATE user B's `apps` row.
- User A cannot SELECT user B's `saves` rows (saves are private).
- User A cannot SELECT a conversation they aren't a participant in.
- User A cannot INSERT a `message` into another user's conversation.
- Service role bypasses everything (used by server actions and the MCP server).

---

## 6. Authentication

### 6.1 — Providers

Enable in Supabase Auth dashboard:

- **Google** OAuth — scope: `openid email profile`.
- **GitHub** OAuth — scope: `read:user user:email`.

No password / no magic-link for v1. Builders are a tech audience; OAuth is enough and prevents an entire class of auth bugs.

### 6.2 — Callback flow

Standard PKCE flow via `@supabase/ssr`. The route handler at `app/auth/callback/route.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    const supabase = await createSupabaseServerClient();   // helper in lib/supabase/server
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(`${origin}${next}`);
  }
  redirect(`${origin}/?error=auth_failed`);
}
```

### 6.3 — Middleware

`apps/web/middleware.ts` refreshes the session cookie on every request that hits an authenticated area, and gates routes like `/publish`, `/messages`, `/settings`. Public reads (`/a/[slug]`, `/u/[handle]`, `/c/[category]`, `/home`) are accessible to anonymous users but rendered with reduced affordances (like/save/comment CTAs route to sign-in).

### 6.4 — Profile completion

After OAuth, the trigger from §4.1 creates a profile with a generated handle. The first time the user lands on `/home`, if `display_name` looks like the auto-generated handle (or `bio` is empty), show a one-time onboarding sheet asking to confirm handle + add a bio. Do **not** force it — make it dismissable.

---

## 7. Frontend conventions

### 7.1 — Rendering strategy

| Route                  | Strategy                                              |
| ---------------------- | ----------------------------------------------------- |
| `/`                    | Static (landing page)                                 |
| `/home`, `/trending`   | Server Component, `revalidate = 60`                   |
| `/c/[category]`        | Server Component, `revalidate = 60`                   |
| `/a/[slug]`            | Server Component, `revalidate = 30`, on-demand revalidate on comment / like beyond N (use `revalidateTag`) |
| `/u/[handle]`          | Server Component, `revalidate = 120`                  |
| `/publish`             | Client (form), Server Action on submit                |
| `/messages*`           | Client + Realtime subscription                        |
| `/settings/*`          | Server Component shell, client subforms               |

### 7.2 — Components: server vs client

Default to **Server Components**. Mark `'use client'` only when:

- The component subscribes to Supabase Realtime.
- The component holds form state (controlled inputs, optimistic UI).
- The component uses browser-only APIs (theme detection, scroll listeners).

Split files when needed: a server page that imports a tiny client island (e.g., `<LikeButton appId={...} initialLiked={...} initialCount={...} />`).

### 7.3 — Data access in server components

Always go through `lib/supabase/server.ts`, which is the cookie-bound client. Never import the service-role client into a Server Component — it's for Server Actions and webhooks only.

### 7.4 — Server Actions: contract

Every server action exported from `lib/actions/*.ts`:

1. First line: `'use server';`.
2. Validates input with Zod.
3. Calls `await getUser()` and throws `UnauthorizedError` if needed.
4. Returns `{ ok: true, data }` or `{ ok: false, error: '...' }` — never throws to the caller.
5. Calls `revalidatePath` / `revalidateTag` for affected routes.
6. Side-effects (email, notifications) happen at the end, wrapped in try/catch so a Resend hiccup doesn't fail the action.

Example skeleton:

```ts
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUser, supabase } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';

const Input = z.object({
  appId: z.string().uuid(),
});

export async function toggleLike(input: z.infer<typeof Input>) {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const user = await getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { appId } = parsed.data;
  const sb = await supabase();

  // Toggle
  const { data: existing } = await sb.from('likes')
    .select('user_id').eq('user_id', user.id).eq('app_id', appId).maybeSingle();

  if (existing) {
    await sb.from('likes').delete().eq('user_id', user.id).eq('app_id', appId);
  } else {
    await sb.from('likes').insert({ user_id: user.id, app_id: appId });
  }

  revalidatePath(`/a/${appId}`);
  return { ok: true, data: { liked: !existing } };
}
```

### 7.5 — Optimistic UI

For likes / saves / comment likes / read receipts, use `useOptimistic` to update the UI immediately. If the action returns `ok: false`, roll back and toast the error. Don't await the server before flipping the heart.

### 7.6 — Forms

- React Hook Form + `@hookform/resolvers/zod` for non-trivial forms (`/publish`, contact modal).
- Plain `<form action={serverAction}>` for tiny forms (sign-out, delete confirms).
- Validate on the **server** even when validated on the client; reuse the same Zod schema from `packages/shared`.

### 7.7 — Empty states, errors, loading

Each list-y page gets three things:

1. A skeleton in `loading.tsx` (mirror the layout, not generic gray blocks).
2. An empty state with the prototype's `◌` glyph and a one-liner.
3. An `error.tsx` with a "Try again" button and a small "Report" link that pre-fills a GitHub issue with the request id from headers.


---

## 8. Realtime

### 8.1 — What we subscribe to

| Subscription                                                  | Where it runs                | What it does                       |
| ------------------------------------------------------------- | ---------------------------- | ---------------------------------- |
| `notifications` INSERT WHERE `recipient_id = me`              | Topbar (shell, always-on)    | Bump the bell badge + toast        |
| `messages` INSERT WHERE `conversation_id` ∈ my conversations  | `/messages/[id]` thread view | Append message to the thread       |
| `conversations` UPDATE `last_message_at`                      | `/messages` list view        | Re-sort the conversation list      |

### 8.2 — Pattern (single supabase channel per scope)

For each "Realtime island" we use one channel, cleaned up on unmount:

```ts
'use client';
import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export function NotificationsSubscriber({ userId, onNew }: Props) {
  useEffect(() => {
    const sb = createBrowserClient();
    const ch = sb.channel(`notifs:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, ({ new: row }) => onNew(row))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [userId, onNew]);
  return null;
}
```

For the message thread, filter by `conversation_id=eq.${id}` — only the open thread subscribes, which keeps the websocket lean.

### 8.3 — Reconnect + backfill

When the page regains visibility (`visibilitychange`), refetch the last 50 items from the affected table before resubscribing. Realtime gives us pushes from "now", not replay; the user might have closed their laptop for 3 hours.

### 8.4 — Presence (optional, phase 8+)

For "user is online" green dots in conversations, use Supabase Presence on a per-conversation channel. Skip for v1; static "active 2m ago" derived from `last_seen_at` on `profiles` is enough.

---

## 9. Storage

Two buckets, both **public** (read), with RLS controlling writes.

### 9.1 — Buckets

| Bucket    | Path pattern                  | Max size | Notes                          |
| --------- | ----------------------------- | -------- | ------------------------------ |
| `covers`  | `covers/{user_id}/{app_id}/{filename}` | 2 MB     | App cover images               |
| `avatars` | `avatars/{user_id}/{filename}`         | 512 KB   | Profile avatars                |

### 9.2 — Storage policies

```sql
-- Covers: readable by everyone, writable only by the app's author
create policy "covers read" on storage.objects
  for select using (bucket_id = 'covers');

create policy "covers insert own" on storage.objects
  for insert with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers update own" on storage.objects
  for update using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers delete own" on storage.objects
  for delete using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Same shape for avatars
create policy "avatars read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars insert own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars update own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 9.3 — Upload flow

From the publish form / settings:

1. Client calls a Server Action `getUploadUrl(bucket, filename, contentType)` that returns a signed URL valid for 60s.
2. Client PUTs the file directly to Supabase Storage with `fetch`.
3. On success, client calls another action to persist the resulting public URL onto `apps.cover_url` or `profiles.avatar_url`.

This keeps large file bodies out of Vercel functions.

### 9.4 — Validation

Server-side, validate `contentType` is in `['image/png', 'image/jpeg', 'image/webp']` and reject everything else. Trust nothing the client says about MIME — Supabase Storage stores what it's given. Hash the first 12 bytes once written and compare to known image magic numbers via a Storage webhook (phase 7+). For v1, the file-size limit + MIME check are enough.

### 9.5 — Image transforms

Use Supabase's built-in `?width=` query string transforms. Reasonable presets:

- Card thumb: `?width=560&resize=cover&quality=80`
- Detail hero: `?width=1200&resize=cover&quality=85`
- Avatar 32px: `?width=64&resize=cover&quality=80` (2x retina)
- Avatar 96px: `?width=192&resize=cover&quality=80`

### 9.6 — Procedural fallback

If `cover_url` is null, the UI renders the `<AppArt kind={art_kind} accent={accent} />` component (ported from the prototype). Pick from the 12 art kinds the prototype already has. Procedural art means every published app looks complete from day 1 with zero upload pressure.

---

## 10. Email

Resend + React Email. Single sender domain (`hatch.dev` or whatever you register).

### 10.1 — Setup

- Verify domain in Resend.
- DNS: SPF, DKIM (provided by Resend), and a DMARC record set to `p=quarantine; rua=mailto:dmarc@hatch.dev` once SPF/DKIM are green.
- `From:` for transactional: `Hatch <hello@hatch.dev>`.
- `Reply-To`: actor's reply address when meaningful (e.g., when contact request is accepted, reply-to is the recipient's email so the conversation can continue out of band).

### 10.2 — Templates

Live in `apps/web/lib/email/`. One React component per template.

| Template            | Trigger                                  | To              |
| ------------------- | ---------------------------------------- | --------------- |
| `contact-received`  | New `contact_requests` row, status=pending | recipient       |
| `contact-accepted`  | Status flips to `accepted`               | sender          |
| `contact-declined`  | Status flips to `declined`               | sender          |
| `new-message`       | New message, recipient offline > 5 min    | recipient       |
| `weekly-digest`     | Monday 9am UTC cron                      | all opted-in    |

Notification email preferences live in `profiles.notification_prefs jsonb` (add this column in the same migration that adds email). Default all to `true` except weekly digest, which is opt-in.

### 10.3 — Helper

```ts
// lib/email/send.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
  tag?: string;       // 'contact_received', etc., for Resend dashboards
}) {
  try {
    await resend.emails.send({
      from: 'Hatch <hello@hatch.dev>',
      to: opts.to,
      subject: opts.subject,
      react: opts.react,
      reply_to: opts.replyTo,
      tags: opts.tag ? [{ name: 'kind', value: opts.tag }] : undefined,
    });
  } catch (err) {
    console.error('[email] send failed', { tag: opts.tag, err });
    // swallow; the action that called us already succeeded.
  }
}
```

### 10.4 — Webhooks

`/api/webhooks/resend` receives delivery / bounce / complaint events. Log them; on `bounced` or `complained`, set `profiles.email_status = 'bounced'|'complained'` and stop sending to that user.

### 10.5 — Throttling

Don't email someone twice for the same notification kind within 10 minutes (someone hitting "like" on five of your apps shouldn't blow up your inbox). The Server Action that writes a notification also writes a Redis-ish dedupe key in `notifications.payload->>'email_throttle_key'`, and the email job skips if a recent row with the same key exists.

For v1, this dedupe lives in Postgres (a small `email_log` table with `(recipient_id, kind, dedupe_key, sent_at)` and an index on `(recipient_id, dedupe_key)`). Migrate to Upstash Redis later if volume warrants it.

---

## 11. MCP server (Railway)

This is the **agent-friendly** layer. Any MCP client (Claude Desktop, Claude Code, custom agents) can connect, authenticate with a user-scoped API key, and act on Hatch on the user's behalf.

### 11.1 — Why Railway

The MCP TypeScript SDK supports two transports: stdio (local) and Streamable HTTP (remote, with SSE for server→client streaming). We want **remote** — users add Hatch to their MCP config and it just works. Remote means a long-lived HTTP server, which is what Railway is good at.

### 11.2 — Transport

Use the official `@modelcontextprotocol/sdk` with `StreamableHTTPServerTransport`. Mount at `POST /mcp` and `GET /mcp` on a Node HTTP server. Authentication via `Authorization: Bearer hatch_pat_<key>` header inspected before the SDK handshake.

### 11.3 — Tools

The agent can call any of these. Tool names use snake_case, args are JSON Schema validated by the SDK.

| Tool                     | What it does                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `list_apps`              | Paginated feed. Filters: category, sort (hot/new/liked), q.    |
| `get_app`                | Full app detail by slug.                                        |
| `search_apps`            | Full-text search by query string.                               |
| `publish_app`            | Create a new app (returns the new slug).                        |
| `update_app`             | Edit one of *my* apps.                                          |
| `like_app` / `unlike_app`| Toggle a like.                                                  |
| `save_app` / `unsave_app`| Toggle a save.                                                  |
| `comment_on_app`         | Post a comment (optionally as a reply).                         |
| `list_my_notifications`  | Recent notifications for the calling user.                      |
| `mark_notifications_read`| Bulk mark-read.                                                 |
| `create_contact_request` | Send a contact request (with role, note, link).                 |
| `respond_to_contact`     | Accept or decline a contact request directed at me.             |
| `list_my_conversations`  | Inbox.                                                          |
| `get_conversation`       | Fetch messages in one conversation.                             |
| `send_message`           | Send a message in a conversation I participate in.              |

Read tools are public (don't require the key but rate-limited harder). Write tools require a valid, non-revoked key.

### 11.4 — Resources

Resources are MCP's URI-addressed read-only "things to attach":

- `hatch://apps/{slug}` — full app, including description, tags, stats.
- `hatch://profiles/{handle}` — profile + their apps.
- `hatch://notifications/me` — current notifications for the calling user.

### 11.5 — Prompts

MCP prompts are one-shot templates a client can surface to the user:

- `publish_my_app` — collects title / pitch / link / category / tags / accent, then calls `publish_app`. Useful: "publish the side-project I just told you about" works end-to-end.
- `scout_apps_like` — given a description, search the gallery for adjacent apps.

### 11.6 — Auth pattern

```ts
// apps/mcp/src/auth.ts
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function resolveCaller(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer hatch_pat_')) return null;
  const token = authHeader.slice('Bearer '.length);
  const hash = createHash('sha256').update(token).digest('hex');

  const { data } = await admin
    .from('api_keys')
    .select('id, user_id, scopes, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!data || data.revoked_at) return null;

  // Best-effort: bump last_used_at; do not await.
  void admin.from('api_keys').update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { userId: data.user_id, scopes: data.scopes };
}
```

After resolving, each tool acts as that user using a **service-role** Supabase client and the user's id explicitly — never trust client-supplied `user_id` from the tool arguments.

### 11.7 — Rate limiting

Lightweight token bucket per `api_key_id`, in-process. Defaults:

- Read tools: 60/min
- Write tools: 20/min
- `publish_app`: 5/min and 30/day

Return MCP errors with code `-32099` (custom) and a human message when buckets are empty.

### 11.8 — Logging + telemetry

Every tool call logs: `key_id`, `tool`, `latency_ms`, `outcome`. Pipe stdout to Railway's log drain. Add `pino` for structured logs. No PII in logs beyond `user_id`.

### 11.9 — Discovery

Publish a tiny static `mcp-config.json` at `https://hatch.dev/.well-known/mcp.json` describing the server endpoint. Provide a "Copy MCP config" button in `/settings/api-keys` that drops the user's key into:

```json
{
  "mcpServers": {
    "hatch": {
      "type": "http",
      "url": "https://mcp.hatch.dev/mcp",
      "headers": { "Authorization": "Bearer hatch_pat_..." }
    }
  }
}
```

### 11.10 — Dockerfile

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY apps/mcp/package.json ./apps/mcp/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile --filter ./apps/mcp...

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN corepack enable && pnpm --filter ./apps/mcp build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/mcp/dist ./dist
COPY --from=build /app/apps/mcp/node_modules ./node_modules
COPY --from=build /app/apps/mcp/package.json ./
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

Railway config: build via Dockerfile, expose `$PORT` (Railway injects it; bind to it in `index.ts`), health check at `GET /health`.

---

## 12. Ranking algorithms

### 12.1 — Hot score (Reddit-style decay)

A single `hot_score` column on `apps` is recomputed by a Postgres function called from a Vercel Cron every 15 minutes (and on demand right after an app gets a like, when the score is volatile).

```sql
-- Time-decayed score. Positive contributions: likes, comments, recency.
create or replace function public.compute_hot_score(
  likes int, comments int, saves int, published timestamptz
) returns double precision language sql immutable as $$
  with weighted as (
    select
      log(greatest(likes, 1)) * 1.0 +
      log(greatest(comments, 1)) * 0.6 +
      log(greatest(saves, 1)) * 0.4 as engagement,
      extract(epoch from (published - timestamptz '2026-01-01')) / 45000.0 as age_term
  )
  select engagement + age_term from weighted
$$;

create or replace function public.refresh_hot_scores() returns int
language sql security definer as $$
  with upd as (
    update public.apps
       set hot_score = public.compute_hot_score(
         likes_count, comments_count, saves_count, published_at
       )
     where is_published
     returning 1
  )
  select count(*)::int from upd
$$;
```

`age_term` divides by ~12.5 hours so that a fresh app gets ~+1 every 12.5h since 2026-01-01. Adjust the divisor with real traffic.

### 12.2 — Sort options exposed in UI

| Sort label  | Backing query                                                |
| ----------- | ------------------------------------------------------------ |
| Hot now     | `order by hot_score desc`                                    |
| Newest      | `order by published_at desc`                                 |
| Most loved  | `order by likes_count desc, published_at desc`               |

### 12.3 — "App of the week"

A scheduled Postgres function runs every Monday at 09:00 UTC (Vercel Cron hits a route handler that calls it). It picks the single highest-scoring app published in the last 7 days that wasn't featured before, and writes to a small `featured_apps` table:

```sql
create table public.featured_apps (
  week_of    date primary key,        -- Monday of the featured week
  app_id     uuid not null references public.apps(id) on delete cascade,
  reason     text not null default 'hot_score',
  created_at timestamptz not null default now()
);

create or replace function public.pick_featured_app() returns uuid
language plpgsql security definer as $$
declare
  pick uuid;
begin
  select a.id into pick
    from public.apps a
    left join public.featured_apps f on f.app_id = a.id
   where a.is_published
     and a.published_at >= now() - interval '7 days'
     and f.app_id is null
   order by a.hot_score desc
   limit 1;

  if pick is not null then
    insert into public.featured_apps (week_of, app_id)
      values (date_trunc('week', now())::date, pick)
    on conflict (week_of) do nothing;
  end if;
  return pick;
end $$;
```

The Discover hero (`FeaturedHero`) reads from `featured_apps` joined to `apps` for the current week, with a fallback to "highest `hot_score` overall" if nothing matched.

### 12.4 — Trending feed (`/trending`)

Same as Hot now but with a window:

```sql
select * from apps
 where published_at >= now() - interval '7 days'
   and is_published
 order by hot_score desc
 limit 60;
```

### 12.5 — Following feed (`/following`)

```sql
select a.* from apps a
  join follows f on f.followee_id = a.author_id
 where f.follower_id = auth.uid()
   and a.is_published
 order by a.published_at desc
 limit 60;
```

Empty state: "Follow some builders to see their ships here. Browse Discover →".

---

## 13. Search

Postgres full-text using the `search_vector` column from §4.3.

```sql
-- Server action / route handler executes:
select id, slug, title, tagline, accent, art_kind, category_id,
       likes_count, comments_count, ts_rank(search_vector, q) as rank
  from apps, plainto_tsquery('simple', $1) q
 where is_published
   and search_vector @@ q
 order by rank desc, hot_score desc
 limit 30;
```

For ≤ ~50k apps this is fast. Above that, switch to Meilisearch via a Supabase webhook that mirrors writes.

The search box in the topbar opens a `<Combobox>` (shadcn/ui) with three sections: apps, makers, tags. Tags and makers come from `profiles.handle ilike $1` and `select distinct unnest(tags)` (cached).


---

## 14. Design system

### 14.1 — Tokens

Port exactly from `prototype/Hatch.html`. These go into `apps/web/app/globals.css` as `:root` variables, plus the `[data-theme="dark"]` override. Tailwind reads them via `tailwind.config.ts` (`theme.extend.colors`).

```css
:root {
  /* Light */
  --bg:        #f7f6f3;
  --bg-2:      #efece6;
  --surface:   #ffffff;
  --surface-2: #f4f3ef;
  --surface-3: #eae7df;
  --border:    rgba(15, 12, 8, 0.08);
  --border-2:  rgba(15, 12, 8, 0.14);
  --text:      #0d0c0a;
  --text-2:    #3a382f;
  --muted:     #74716a;
  --muted-2:   #9c9990;

  /* Accent */
  --ax: #a855f7;
  --ax-soft: color-mix(in oklab, var(--ax) 14%, transparent);
  --ax-tint: color-mix(in oklab, var(--ax) 8%, var(--surface));

  /* Type */
  --font:    'Geist', ui-sans-serif, system-ui, sans-serif;
  --mono:    'Geist Mono', ui-monospace, monospace;
  --display: var(--font);

  /* Radii */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --r-xl: 24px;

  /* Shadows */
  --sh-1: 0 1px 0 rgba(255,255,255,0.7) inset, 0 1px 2px rgba(15,12,8,0.04), 0 0 0 0.5px var(--border);
  --sh-2: 0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 24px -8px rgba(15,12,8,0.12), 0 0 0 0.5px var(--border);
  --sh-3: 0 24px 60px -20px rgba(15,12,8,0.22), 0 0 0 0.5px var(--border);

  /* Layout */
  --sidebar-w: 248px;
  --topbar-h:  64px;
  --main-pad:  32px;
}

[data-theme="dark"] {
  --bg:        #0a0a0c;
  --bg-2:      #111114;
  --surface:   #141416;
  --surface-2: #1b1b1f;
  --surface-3: #25252a;
  --border:    rgba(255, 255, 255, 0.07);
  --border-2:  rgba(255, 255, 255, 0.14);
  --text:      #f5f5f3;
  --text-2:    #d8d6d0;
  --muted:     #8e8b83;
  --muted-2:   #6a6760;
  --ax-tint:   color-mix(in oklab, var(--ax) 14%, var(--surface));
  --sh-1: 0 0 0 0.5px var(--border), 0 1px 2px rgba(0,0,0,0.4);
  --sh-2: 0 8px 24px -8px rgba(0,0,0,0.6), 0 0 0 0.5px var(--border);
  --sh-3: 0 24px 60px -20px rgba(0,0,0,0.7), 0 0 0 0.5px var(--border);
}

/* Subtle radial gradients on dark backgrounds for depth */
[data-theme="dark"] body {
  background-image:
    radial-gradient(circle at 30% -10%, rgba(168, 85, 247, 0.06), transparent 40%),
    radial-gradient(circle at 90% 10%,  rgba(236, 72, 153, 0.04), transparent 45%);
}
```

### 14.2 — Typography

- Display & body: **Geist** (Google Fonts, weights 400/500/600/700).
- Mono: **Geist Mono** (weights 400/500/600).
- Body size: `14px` / line-height `1.5`. Headings use `font-family: var(--display)`, letter-spacing `-0.02em`–`-0.03em` for large sizes.

Self-host via `next/font/google` for both, with `display: 'swap'` and `variable: '--font'` / `'--mono'`.

### 14.3 — Components to build (Phase 2)

1. **`<Shell>`** — grid layout, topbar, sidebar (sticky), main slot. Mobile: sidebar collapses; topbar gets a hamburger.
2. **`<ThemeToggle>`** — sun/moon pill from the prototype. Reads/writes `localStorage('theme')` + `document.documentElement.setAttribute('data-theme', ...)`. Server reads `cookies().get('theme')` for SSR; client syncs on mount.
3. **`<AppArt kind accent />`** — port from `prototype/app-art.jsx`. 12 procedural styles using divs + CSS variables.
4. **`<AppCard app />`** — classic style only. Hover lifts (`translateY(-3px)` + shadow swap). Click → `router.push('/a/' + slug)`. The author chip and the card are nested clickables; the chip must `stopPropagation`.
5. **`<FilterChips>`**, **`<SortPills>`**, **`<CategoryBadge>`**.
6. **`<FeaturedHero>`** — main + 2 mini stack. Reads from `featured_apps` table.
7. **`<ActionBar>`** — Pinterest-style pill bar on `/a/[slug]`. Includes the like-pop animation.
8. **`<Comments>` + `<CommentItem>`** — 1-level threading. Markdown rendering with `react-markdown` + a hand-rolled allowlist of nodes (paragraph, strong, em, code inline, code blocks, links, lists).
9. **`<ContactModal>`** — three stages, full a11y (focus trap, ESC, ARIA). Reuse Radix Dialog from shadcn.
10. **`<NotificationsBell>`** — topbar dropdown. Subscribes to Realtime. Tabs (All / Contact requests).
11. **`<ConversationList>` + `<MessageThread>`** — Slack-style two-pane. URL-driven (`/messages/[id]`).

### 14.4 — Motion

Reuse the prototype's animations verbatim: like-pop bezier, modal entrance, bell badge pulse. Keep all transitions under 250ms. Respect `prefers-reduced-motion`.

### 14.5 — Accessibility

- Color contrast: every text/bg pair in both themes meets WCAG AA. Audit with Stark or `axe` in CI.
- Focus: visible focus ring (`outline: 2px solid var(--ax); outline-offset: 2px`) on every interactive element. Never `outline: none` without a replacement.
- Keyboard: every modal escapable with ESC; every list item tabbable; every action reachable without a mouse.
- ARIA: dropdowns use `role="menu"`, modals `role="dialog" aria-modal="true"`.

---

## 15. Agent-friendliness beyond MCP

Even without MCP, make the app friendly to crawlers and LLMs:

### 15.1 — `/llms.txt`

A static route at `/llms.txt` that returns a short summary + list of important URLs (Discover, About, individual app/profile templates, API). Follow the [llmstxt.org](https://llmstxt.org) format.

### 15.2 — Public read-only HTTP API

Mount at `/api/v1/*`:

| Endpoint                            | Method | Description                          |
| ----------------------------------- | ------ | ------------------------------------ |
| `/api/v1/apps`                      | GET    | Paginated list. Same filters as web. |
| `/api/v1/apps/:slug`                | GET    | One app, full detail.                |
| `/api/v1/profiles/:handle`          | GET    | Profile + their apps.                |
| `/api/v1/categories`                | GET    | Static category list.                |
| `/api/v1/search?q=...`              | GET    | Full-text search.                    |

CORS open. No auth. Rate-limit by IP (60/min). This means an agent without MCP can still scrape Hatch cleanly via JSON instead of HTML.

### 15.3 — OpenAPI

`/api/v1/openapi.json` — generate from Zod schemas with `@asteasolutions/zod-to-openapi`. Useful for agents that want to call the API typed.

### 15.4 — Structured data

Each app page emits JSON-LD (`SoftwareApplication` schema) in `<head>` for SEO + grounding.

---

## 16. Build phases

Each phase is a fully-shippable increment. Don't skip ahead. After each phase: deploy to a preview env, sanity-check, then move on.

### Phase 0 — Foundations (1 day)

- [ ] `pnpm init` monorepo, `pnpm-workspace.yaml`.
- [ ] `apps/web` — `pnpm dlx create-next-app@latest --typescript --app --tailwind --src-dir=false --eslint`.
- [ ] `apps/mcp` — empty TS package with `tsx` + `@modelcontextprotocol/sdk`.
- [ ] `packages/db` — Supabase CLI init.
- [ ] `packages/shared` — TS-only types and ranking helper.
- [ ] Repo wiring: `tsconfig.base.json`, ESLint shared config, Prettier, `husky` + `lint-staged`.
- [ ] `.env.example` with every var listed (see §17).
- [ ] Create Supabase project, Vercel project, Railway project. Wire env vars.
- [ ] Deploy a "hello world" on each.

**Done when**: `pnpm dev` runs Next.js locally, the empty MCP server boots on `:8080`, `supabase start` works.

### Phase 1 — Auth + base schema (1 day)

- [ ] Migration `0001_init.sql`: `citext` + `pgcrypto` extensions, `profiles` table, `handle_new_user` trigger.
- [ ] Migration `0002_categories.sql`: `categories` + seed.
- [ ] Enable Google + GitHub OAuth in Supabase.
- [ ] `lib/supabase/{server,client,admin}.ts`.
- [ ] `app/auth/callback/route.ts`.
- [ ] `middleware.ts` session refresh.
- [ ] Sign-in page with two big OAuth buttons.
- [ ] `/settings/profile` to edit display name, bio, links.

**Done when**: sign in with GitHub, profile row exists, you can edit your bio.

### Phase 2 — Design system + shell (2 days)

- [ ] Port tokens, fonts, base styles into `globals.css` and `tailwind.config.ts`.
- [ ] `<Shell>`, `<Topbar>`, `<Sidebar>`, `<ThemeToggle>`, `<Logo>`.
- [ ] Stub all routes: `/home`, `/c/[category]`, `/a/[slug]`, `/u/[handle]`, `/publish`, `/messages`, `/settings/*`.
- [ ] Port `<AppArt>`, `<Avatar>`, `<CategoryBadge>`, `<Stat>`, `<AppCard>` (classic).
- [ ] No data yet — render seed objects from `packages/shared/seed.ts`.

**Done when**: every page renders with the prototype's look in both themes.

### Phase 3 — Apps: read path (1 day)

- [ ] Migration `0003_apps.sql`: `apps` table, triggers, indexes.
- [ ] `lib/actions/apps.ts`: `listApps`, `getAppBySlug`, with Zod inputs.
- [ ] `/home`, `/c/[category]`, `/trending`, `/new`: server-rendered with filters and sort.
- [ ] `/a/[slug]`: detail page (without comments/likes yet — they come next).
- [ ] `/u/[handle]`: profile with their apps tab.
- [ ] Seed 12 demo apps via `packages/db/seed.sql`.

**Done when**: anonymous users can browse the whole gallery and click into any app.

### Phase 4 — Social: likes, saves, follows, comments (2 days)

- [ ] Migration `0004_social.sql`: `likes`, `saves`, `follows`, `comments`, `comment_likes`, counters' triggers, RLS.
- [ ] Server actions: `toggleLike`, `toggleSave`, `toggleFollow`, `postComment`, `toggleCommentLike`.
- [ ] `<ActionBar>` with optimistic UI.
- [ ] `<Comments>` with compose + threaded list.
- [ ] `/u/[handle]?tab=liked` works.

**Done when**: like/save/follow/comment all work, counts update, optimistic UI doesn't desync.

### Phase 5 — Publish (1 day)

- [ ] Storage buckets + RLS.
- [ ] `getUploadUrl` server action.
- [ ] `/publish` form with live preview, Zod validation, RHF.
- [ ] `publishApp` server action.
- [ ] Owner-only "Edit" affordance on `/a/[slug]`.

**Done when**: you can publish a real app with a cover image and see it on `/home`.

### Phase 6 — Contact requests + notifications + bell (2 days)

- [ ] Migration `0005_messaging.sql`: `contact_requests`, `conversations`, `messages`, `find_or_create_conversation`.
- [ ] Migration `0006_notifications.sql`: `notifications`, triggers for like/comment/follow, RLS.
- [ ] `<ContactModal>` 3-stage UI.
- [ ] `createContactRequest`, `respondToContact` actions; the latter calls `find_or_create_conversation` when accepting.
- [ ] `<NotificationsBell>` with Realtime subscription.

**Done when**: I can DM a builder via the modal, they see a bell badge in real-time, they accept, a conversation row exists.

### Phase 7 — Messages / Inbox (2 days)

- [ ] `/messages` two-pane layout, server-rendered list, client thread.
- [ ] `sendMessage` action.
- [ ] Realtime subscription on the open thread.
- [ ] Read receipts: when a message becomes visible in the thread, `update messages set read_at = now()`.
- [ ] Filter tabs (All / Investors / Community / Unread) — filter by `contact_requests.role` for the "Investors" tab.

**Done when**: two browsers, two accounts, the messages stream live both ways with read receipts.

### Phase 8 — Email (1 day)

- [ ] Resend project + DNS.
- [ ] React Email templates for the 5 cases in §10.2.
- [ ] Wire `sendEmail` into the relevant server actions.
- [ ] `notification_prefs` column + `/settings/notifications` UI.
- [ ] `/api/webhooks/resend` for bounces.

**Done when**: accept a contact request → inviter gets a clean email within seconds.

### Phase 9 — MCP server on Railway (2 days)

- [ ] Migration `0007_api_keys.sql`.
- [ ] `/settings/api-keys` UI to create / revoke keys; show key once on creation.
- [ ] `apps/mcp` skeleton: HTTP server, auth middleware, SDK transport.
- [ ] Implement read tools first (`list_apps`, `get_app`, `search_apps`, `list_my_notifications`).
- [ ] Implement write tools (`publish_app`, `like_app`, `comment_on_app`, `create_contact_request`, `send_message`).
- [ ] Resources + prompts.
- [ ] Dockerfile, deploy to Railway, set env vars, point `mcp.hatch.dev` at it.
- [ ] Smoke test: connect from Claude Desktop, call `list_apps`, then `publish_app`.

**Done when**: Claude Desktop with the Hatch MCP installed can list and publish apps for the connected user.

### Phase 10 — Ranking & cron (0.5 day)

- [ ] `compute_hot_score` + `refresh_hot_scores` + `pick_featured_app` migrations.
- [ ] Vercel Cron: `/api/cron/refresh-scores` every 15 min, `/api/cron/pick-featured` every Monday 09:00 UTC.
- [ ] `<FeaturedHero>` reads from `featured_apps`.

**Done when**: hot scores update, app of the week shows up.

### Phase 11 — Search (0.5 day)

- [ ] Migration `0008_search.sql`: index, `search_apps_fts` function (parametrized to use `plainto_tsquery`).
- [ ] `/api/search` route handler.
- [ ] Topbar combobox.

**Done when**: typing in the topbar finds apps by title / tagline / tag / author handle.

### Phase 12 — Public API + llms.txt + OpenAPI (0.5 day)

- [ ] `/api/v1/*` route handlers reading directly from `apps` (no actions needed; RLS handles security).
- [ ] `/llms.txt` route.
- [ ] OpenAPI generator + `/api/v1/openapi.json`.

**Done when**: `curl https://hatch.dev/api/v1/apps` returns JSON.

### Phase 13 — Polish (variable)

- [ ] Loading skeletons that mirror layouts.
- [ ] Empty states with the `◌` glyph.
- [ ] Error boundaries.
- [ ] Onboarding sheet on first visit.
- [ ] Analytics (Vercel Web Analytics or Plausible).
- [ ] Sentry on Vercel + Railway.
- [ ] Open Graph image generation via `@vercel/og` for `/a/[slug]` and `/u/[handle]`.
- [ ] Sitemap + `robots.txt`.

---

## 17. Environment variables

```bash
# ───────── apps/web (.env.local in dev, Vercel project vars in prod) ─────────
NEXT_PUBLIC_APP_URL=https://hatch.dev
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=         # server-only, never expose to client

RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=             # for verifying webhook signatures

CRON_SECRET=                       # check Authorization: Bearer ${CRON_SECRET}

NEXT_PUBLIC_MCP_URL=https://mcp.hatch.dev   # for the "Copy config" button

# ───────── apps/mcp (Railway env vars) ───────────────────────────────────────
PORT=8080
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LOG_LEVEL=info
```

Never commit `.env*` files. `.env.example` lists every key with a blank value and a comment.

---

## 18. Operational notes for Claude Code

1. **Always migrate forward, never edit a deployed migration.** Use the Supabase CLI to generate new migration files; never rewrite history.
2. **Generated types**: after every migration, run `pnpm dlx supabase gen types typescript --local > apps/web/lib/supabase/types.ts`. Commit the result.
3. **Type imports across the boundary**: anything used by both web and mcp lives in `packages/shared`. Re-export from there.
4. **Don't add packages without checking the dep tree.** Prefer Radix primitives over heavy UI kits. Prefer Tailwind utilities over CSS-in-JS.
5. **No `any`** in TS without an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and a reason.
6. **Tests**: Playwright for E2E of the four critical flows (sign in, publish, contact → accept → message, MCP `publish_app`). Vitest for `lib/ranking.ts` and any non-trivial pure functions. Skip unit tests for thin server actions; covered by E2E.
7. **PR discipline**: each phase is a stack of small PRs (migration, types, server action, UI, test). Don't ship a single 4000-line PR.
8. **Deployment order**: Supabase migration → Vercel deploy → Railway deploy (in that order, so the web app never references types/tables Railway doesn't see yet).
9. **Secrets in CI**: GitHub Actions OIDC into Vercel + Railway is overkill for v1. Just set per-environment secrets in each dashboard.
10. **When you hit a decision not covered in this spec**: write it down in `docs/decisions/NNN-<slug>.md` as a 5-line ADR (context / decision / consequences) and continue. Don't block.

---

## 19. Open questions to revisit after v1

These are intentionally out of scope but worth a stub:

- **Moderation**: comment flagging, app reports, soft-deleted authors.
- **Drafts**: `apps.is_published = false` works today; a real /drafts UI doesn't exist yet.
- **Imports**: pull profile and apps from GitHub or Product Hunt.
- **Collections**: user-curated lists ("Tools I'd pay for").
- **Maker week / events**: a `events` table with a feed.
- **Direct messages to users you haven't contacted**: deliberately not allowed in v1; the contact-request flow is the only way to open a thread. If we relax this, message requests folder.
- **AI features in the MCP**: `summarize_app(slug)`, `suggest_tags(description)`. These naturally live in the MCP server alongside the existing tools.

---

*End of spec.*

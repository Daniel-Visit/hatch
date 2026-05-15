-- Phase 3: apps table per SPEC.md §4.3 + 4 prototype extras
-- Extras (NOT in SPEC §4.3 — required by prototype data shape):
--   hue, bg, is_featured, remixes_count
-- Counter trigger FUNCTIONS defined here; the actual TRIGGERs that call them
-- land in Phase 4 (when likes/saves/comments/remixes tables exist).

create table if not exists public.apps (
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
  updated_at      timestamptz not null default now(),
  -- prototype extras
  hue             int not null default 200 check (hue between 0 and 360),
  bg              text,
  is_featured     boolean not null default false,
  remixes_count   int not null default 0
);

alter table public.apps enable row level security;

create index if not exists apps_author_id_idx     on public.apps (author_id);
create index if not exists apps_category_id_idx   on public.apps (category_id);
create index if not exists apps_published_at_idx  on public.apps (published_at desc);
create index if not exists apps_hot_score_idx     on public.apps (hot_score desc);
create index if not exists apps_search_vector_idx on public.apps using gin (search_vector);
create index if not exists apps_tags_idx          on public.apps using gin (tags);

-- Slug auto-generation: derive from title on INSERT if not provided; also touch updated_at
create or replace function public.apps_set_slug() returns trigger
language plpgsql security definer set search_path = public as $$
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

-- ---------------------------------------------------------------------------
-- Counter trigger FUNCTIONS (Phase 3: definitions only)
-- The TRIGGERs that fire these land in Phase 4 when the source tables exist.
-- ---------------------------------------------------------------------------

-- bump_likes_count: increments/decrements apps.likes_count
create or replace function public.bump_likes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set likes_count = likes_count + 1 where id = new.app_id;
  elsif tg_op = 'DELETE' then
    update public.apps set likes_count = greatest(likes_count - 1, 0) where id = old.app_id;
  end if;
  return null;
end $$;

-- bump_saves_count: increments/decrements apps.saves_count
create or replace function public.bump_saves_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set saves_count = saves_count + 1 where id = new.app_id;
  elsif tg_op = 'DELETE' then
    update public.apps set saves_count = greatest(saves_count - 1, 0) where id = old.app_id;
  end if;
  return null;
end $$;

-- bump_comments_count: increments/decrements apps.comments_count
create or replace function public.bump_comments_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set comments_count = comments_count + 1 where id = new.app_id;
  elsif tg_op = 'DELETE' then
    update public.apps set comments_count = greatest(comments_count - 1, 0) where id = old.app_id;
  end if;
  return null;
end $$;

-- bump_remixes_count: increments/decrements apps.remixes_count
create or replace function public.bump_remixes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set remixes_count = remixes_count + 1 where id = new.app_id;
  elsif tg_op = 'DELETE' then
    update public.apps set remixes_count = greatest(remixes_count - 1, 0) where id = old.app_id;
  end if;
  return null;
end $$;

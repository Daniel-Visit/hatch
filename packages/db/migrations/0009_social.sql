-- migration 0009_social — Phase 4 schema: likes, saves, follows, comments, comment_likes
-- + counter triggers + comments depth check
-- Source: SPEC.md §4.4 + §4.5
-- RLS deferred to 0010_social_rls.sql

-- ---------------------------------------------------------------------------
-- Likes (one per (user, app))
-- ---------------------------------------------------------------------------

create table if not exists public.likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  app_id     uuid not null references public.apps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

create index if not exists likes_app_id_idx on public.likes (app_id);

-- ---------------------------------------------------------------------------
-- Saves
-- ---------------------------------------------------------------------------

create table if not exists public.saves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  app_id     uuid not null references public.apps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

create index if not exists saves_app_id_idx on public.saves (app_id);

-- ---------------------------------------------------------------------------
-- Follows (user → user)
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

-- ---------------------------------------------------------------------------
-- Comments (1 level of replies max)
-- ---------------------------------------------------------------------------

create table if not exists public.comments (
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

create index if not exists comments_app_id_created_idx on public.comments (app_id, created_at desc);
create index if not exists comments_parent_idx on public.comments (parent_id);

-- ---------------------------------------------------------------------------
-- Depth check: enforce max 1 level of nesting
-- ---------------------------------------------------------------------------

create or replace function public.comments_check_depth()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  if new.parent_id is not null then
    if exists (
      select 1
      from public.comments
      where id = new.parent_id
        and parent_id is not null
    ) then
      raise exception 'comments can only nest one level deep';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists comments_depth_check on public.comments;
create trigger comments_depth_check
  before insert or update on public.comments
  for each row execute function public.comments_check_depth();

-- ---------------------------------------------------------------------------
-- Comment likes
-- ---------------------------------------------------------------------------

create table if not exists public.comment_likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

-- ---------------------------------------------------------------------------
-- Counter trigger: likes → apps.likes_count
-- (function stub created in 0006; redefined here with same logic for clarity)
-- ---------------------------------------------------------------------------

create or replace function public.bump_likes_count()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set likes_count = likes_count + 1 where id = new.app_id;
  elsif tg_op = 'DELETE' then
    update public.apps set likes_count = greatest(likes_count - 1, 0) where id = old.app_id;
  end if;
  return null;
end $$;

drop trigger if exists likes_after_change on public.likes;
create trigger likes_after_change
  after insert or delete on public.likes
  for each row execute function public.bump_likes_count();

-- ---------------------------------------------------------------------------
-- Counter trigger: saves → apps.saves_count
-- (function stub created in 0006; redefined here with same logic for clarity)
-- ---------------------------------------------------------------------------

create or replace function public.bump_saves_count()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set saves_count = saves_count + 1 where id = new.app_id;
  elsif tg_op = 'DELETE' then
    update public.apps set saves_count = greatest(saves_count - 1, 0) where id = old.app_id;
  end if;
  return null;
end $$;

drop trigger if exists saves_after_change on public.saves;
create trigger saves_after_change
  after insert or delete on public.saves
  for each row execute function public.bump_saves_count();

-- ---------------------------------------------------------------------------
-- Counter trigger: comments → apps.comments_count
-- Increment on INSERT. On UPDATE, track is_deleted flip to adjust counter.
-- Hard-DELETE is only via FK cascade (app deleted), so no decrement needed.
-- (function stub in 0006 used DELETE branch; replaced here with correct logic)
-- ---------------------------------------------------------------------------

create or replace function public.bump_comments_count()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.apps set comments_count = comments_count + 1 where id = new.app_id;
  elsif tg_op = 'UPDATE' then
    if old.is_deleted is false and new.is_deleted is true then
      update public.apps
        set comments_count = greatest(comments_count - 1, 0)
        where id = new.app_id;
    elsif old.is_deleted is true and new.is_deleted is false then
      update public.apps
        set comments_count = comments_count + 1
        where id = new.app_id;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists comments_after_change on public.comments;
create trigger comments_after_change
  after insert or update on public.comments
  for each row execute function public.bump_comments_count();

-- ---------------------------------------------------------------------------
-- Counter trigger: comment_likes → comments.likes_count
-- ---------------------------------------------------------------------------

create or replace function public.bump_comment_likes_count()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set likes_count = likes_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.comments set likes_count = greatest(likes_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;

drop trigger if exists comment_likes_after_change on public.comment_likes;
create trigger comment_likes_after_change
  after insert or delete on public.comment_likes
  for each row execute function public.bump_comment_likes_count();

-- end migration 0009

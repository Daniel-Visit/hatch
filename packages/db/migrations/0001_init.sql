-- Phase 1: extensions + profiles table + auth trigger
-- Per SPEC.md §4.1 and roadmap §5.4 (notification_prefs uses push-only keys, no email)

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

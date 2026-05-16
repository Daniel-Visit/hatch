-- Real view tracking. Inserts deduped per viewer per day; trigger bumps
-- apps.views_count atomically. Existing seeded views_count remains as baseline.

create table if not exists public.app_views (
  app_id      uuid not null references public.apps(id) on delete cascade,
  viewer_key  text not null,
  viewed_date date not null default (now() at time zone 'utc')::date,
  viewed_at   timestamptz not null default now(),
  primary key (app_id, viewer_key, viewed_date)
);

create index if not exists app_views_app_date_idx
  on public.app_views (app_id, viewed_date);

alter table public.app_views enable row level security;

do $$ begin
  perform 1 from pg_policies where schemaname='public' and tablename='app_views'
    and policyname='app_views_insert_any';
  if not found then
    create policy app_views_insert_any on public.app_views for insert
      to anon, authenticated with check (true);
  end if;
end $$;

create or replace function public.bump_views_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.apps set views_count = views_count + 1 where id = new.app_id;
  return null;
end $$;

drop trigger if exists app_views_after_insert on public.app_views;
create trigger app_views_after_insert
  after insert on public.app_views
  for each row execute function public.bump_views_count();

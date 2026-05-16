-- 0020_ranking.sql
-- Phase 10: ranking algorithm + featured-of-the-week table + helpers.
-- Source: SPEC.md §12.

-- compute_hot_score: time-decayed engagement score. IMMUTABLE so it can be used
-- in indexes or generated columns later if we need to.
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

-- refresh_hot_scores: recomputes hot_score for every published app.
-- SECURITY DEFINER so cron route handler (using anon JWT or no JWT at all) can call it via service_role.
create or replace function public.refresh_hot_scores() returns int
  language sql security definer set search_path = public as $$
  with upd as (
    update public.apps
       set hot_score = compute_hot_score(likes_count, comments_count, saves_count, published_at)
     where is_published
    returning 1
  )
  select count(*)::int from upd
$$;

revoke all on function public.refresh_hot_scores() from public;
grant execute on function public.refresh_hot_scores() to authenticated, service_role;

-- featured_apps: one row per Monday-anchored week
create table if not exists public.featured_apps (
  week_of    date primary key,
  app_id     uuid not null references public.apps(id) on delete cascade,
  reason     text not null default 'hot_score',
  created_at timestamptz not null default now()
);

create index if not exists featured_apps_app_id_idx on public.featured_apps (app_id);

alter table public.featured_apps enable row level security;

-- Public read; writes only via SECURITY DEFINER pick_featured_app() running as service_role
drop policy if exists "featured_apps public read" on public.featured_apps;
create policy "featured_apps public read"
  on public.featured_apps for select using (true);

-- pick_featured_app: weekly worker. Picks the highest hot_score app published in the
-- last 7 days that was never featured, inserts into featured_apps for this Monday.
create or replace function public.pick_featured_app() returns uuid
  language plpgsql security definer set search_path = public as $$
declare pick uuid;
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

revoke all on function public.pick_featured_app() from public;
grant execute on function public.pick_featured_app() to service_role;

notify pgrst, 'reload schema';

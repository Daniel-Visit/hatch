-- migration 0016_push_subscriptions — Phase 6 schema: push_subscriptions table for VAPID Web Push
-- Source: docs/superpowers/specs/2026-05-15-hatch-roadmap-maestro-design.md §5.2
-- NOTE: profiles.notification_prefs already exists in 0001_init.sql line 19 — do NOT add it again
-- RLS deferred to 0017_phase6_rls.sql

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

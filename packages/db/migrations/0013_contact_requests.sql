-- migration 0013_contact_requests — Phase 6 schema: contact_role enum, contact_status enum, contact_requests table
-- Source: SPEC.md §4.6 (lines 503-526)
-- RLS deferred to 0017_phase6_rls.sql
-- FK contact_requests.conversation_id → conversations(id) deferred to 0014 (after conversations exists)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'contact_role') then
    create type public.contact_role as enum ('investor', 'partner', 'hire', 'fan');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'contact_status') then
    create type public.contact_status as enum ('pending', 'accepted', 'declined', 'expired');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- contact_requests
-- ---------------------------------------------------------------------------

create table if not exists public.contact_requests (
  id              uuid primary key default gen_random_uuid(),
  app_id          uuid references public.apps(id) on delete set null,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  role            public.contact_role not null,
  note            text not null default '' check (length(note) <= 600),
  sender_link     text,
  status          public.contact_status not null default 'pending',
  responded_at    timestamptz,
  conversation_id uuid,
  created_at      timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists contact_requests_recipient_status_created_idx
  on public.contact_requests (recipient_id, status, created_at desc);

-- end migration 0013

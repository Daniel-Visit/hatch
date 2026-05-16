-- migration 0014_conversations_messages — Phase 6 schema: conversations + messages + helper fn
-- Source: SPEC.md §4.6 (lines 528-585)
-- Adds deferred FK from 0013: contact_requests.conversation_id → conversations(id)
-- RLS deferred to 0017_phase6_rls.sql

-- ── 1. conversations ─────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  participant_a   uuid not null references public.profiles(id) on delete cascade,
  participant_b   uuid not null references public.profiles(id) on delete cascade,
  app_id          uuid references public.apps(id) on delete set null,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  check (participant_a < participant_b)
);
create unique index if not exists conversations_pair_uniq on public.conversations (participant_a, participant_b);
create index if not exists conversations_a_last_msg_idx on public.conversations (participant_a, last_message_at desc nulls last);
create index if not exists conversations_b_last_msg_idx on public.conversations (participant_b, last_message_at desc nulls last);

alter table public.conversations enable row level security;

-- ── 2. Deferred FK from 0013: contact_requests.conversation_id → conversations ─

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_requests_conversation_fk'
  ) then
    alter table public.contact_requests
      add constraint contact_requests_conversation_fk
      foreign key (conversation_id) references public.conversations(id) on delete set null;
  end if;
end $$;

-- ── 3. messages ──────────────────────────────────────────────────────────────

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_created_idx on public.messages (conversation_id, created_at desc);

alter table public.messages enable row level security;

-- ── 4. messages_bump_conversation function + trigger ─────────────────────────

create or replace function public.messages_bump_conversation()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_bump_conversation();

-- ── 5. find_or_create_conversation helper ────────────────────────────────────

create or replace function public.find_or_create_conversation(
  user_a uuid, user_b uuid, app uuid
)
  returns uuid
  language plpgsql
  security definer set search_path = public
as $$
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

-- ── 6. Realtime publication ───────────────────────────────────────────────────

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

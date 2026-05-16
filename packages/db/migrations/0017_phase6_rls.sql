-- migration 0017_phase6_rls — Phase 6 RLS: helper fn is_participant + policies for 5 tables
-- Source: SPEC.md §5.2 (lines 737-790) — verbatim
-- NOTE: push_subscriptions RLS is NOT in SPEC §5.2 (predates push decision); plan-authored, follows the saves self-only pattern from 0010_social_rls.sql:43-45
-- Tables already have ENABLE ROW LEVEL SECURITY from 0013-0016

-- ─── helper function ─────────────────────────────────────────────────────────

create or replace function public.is_participant(c uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversations
     where id = c and (participant_a = auth.uid() or participant_b = auth.uid())
  )
$$;

-- ─── contact_requests ────────────────────────────────────────────────────────

alter table public.contact_requests enable row level security;
drop policy if exists "contact_requests read participant" on public.contact_requests;
drop policy if exists "contact_requests insert as sender" on public.contact_requests;
drop policy if exists "contact_requests update as recipient" on public.contact_requests;

create policy "contact_requests read participant"
  on public.contact_requests for select
  using (recipient_id = auth.uid() or sender_id = auth.uid());

create policy "contact_requests insert as sender"
  on public.contact_requests for insert
  with check (sender_id = auth.uid());

create policy "contact_requests update as recipient"
  on public.contact_requests for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
-- NO DELETE policy

-- ─── conversations ────────────────────────────────────────────────────────────

alter table public.conversations enable row level security;
drop policy if exists "conversations read participant" on public.conversations;

create policy "conversations read participant"
  on public.conversations for select
  using (participant_a = auth.uid() or participant_b = auth.uid());
-- NO client-side INSERT policy — only via SECURITY DEFINER find_or_create_conversation called from server actions
-- NO UPDATE/DELETE policies

-- ─── messages ────────────────────────────────────────────────────────────────

alter table public.messages enable row level security;
drop policy if exists "messages read participant" on public.messages;
drop policy if exists "messages insert as participant" on public.messages;
drop policy if exists "messages update own or read" on public.messages;

create policy "messages read participant"
  on public.messages for select
  using (public.is_participant(conversation_id));

create policy "messages insert as participant"
  on public.messages for insert
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

create policy "messages update own or read"
  on public.messages for update
  using (
    sender_id = auth.uid()
    or (read_at is null and public.is_participant(conversation_id))
  )
  with check (
    sender_id = auth.uid()
    or (read_at is not null and public.is_participant(conversation_id))
  );
-- The update policy is split so the recipient can flip read_at, but only the sender can edit body
-- Column-level body restriction enforced in app code

-- ─── notifications ────────────────────────────────────────────────────────────

alter table public.notifications enable row level security;
drop policy if exists "notifications read own" on public.notifications;
drop policy if exists "notifications update own" on public.notifications;

create policy "notifications read own"
  on public.notifications for select using (recipient_id = auth.uid());

create policy "notifications update own"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
-- NO INSERT/DELETE policies — triggers do the writes (SECURITY DEFINER bypass), users can only flip read_at

-- ─── push_subscriptions (plan-authored, not in SPEC §5.2) ────────────────────

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions read own" on public.push_subscriptions;
drop policy if exists "push_subscriptions insert own" on public.push_subscriptions;
drop policy if exists "push_subscriptions delete own" on public.push_subscriptions;
drop policy if exists "push_subscriptions update own" on public.push_subscriptions;

create policy "push_subscriptions read own"
  on public.push_subscriptions for select using (user_id = auth.uid());

create policy "push_subscriptions insert own"
  on public.push_subscriptions for insert with check (user_id = auth.uid());

create policy "push_subscriptions update own"
  on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions delete own"
  on public.push_subscriptions for delete using (user_id = auth.uid());
-- UPDATE policy needed because subscribeToPush action uses upsert (INSERT or UPDATE)

-- end migration 0017

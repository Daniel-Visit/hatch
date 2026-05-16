-- migration 0015_notifications — Phase 6 schema: notif_kind enum + notifications table + 6 fan-out triggers
-- Source: SPEC.md §4.7 + plan locked decision #4 (triggers DB-side, push HTTP via server actions)
-- RLS deferred to 0017_phase6_rls.sql

-- ---------------------------------------------------------------------------
-- 1. Enum: notif_kind (idempotent)
-- ---------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'notif_kind') then
    create type public.notif_kind as enum (
      'contact_request',
      'contact_accepted',
      'contact_declined',
      'like',
      'comment',
      'comment_reply',
      'follow',
      'message'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. notifications table
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_id        uuid not null references public.profiles(id) on delete cascade,
  actor_id            uuid references public.profiles(id) on delete cascade,
  kind                public.notif_kind not null,
  app_id              uuid references public.apps(id) on delete cascade,
  comment_id          uuid references public.comments(id) on delete cascade,
  contact_request_id  uuid references public.contact_requests(id) on delete cascade,
  conversation_id     uuid references public.conversations(id) on delete cascade,
  payload             jsonb not null default '{}'::jsonb,
  read_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Trigger functions + triggers (all 6 fan-out notifications)
-- ---------------------------------------------------------------------------

-- ── 3a. notify_on_like — AFTER INSERT on public.likes ───────────────────────

create or replace function public.notify_on_like()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
declare app_author uuid;
begin
  select author_id into app_author from public.apps where id = new.app_id;
  if app_author is null then return new; end if;
  if app_author = new.user_id then return new; end if;  -- self-like, no notif
  insert into public.notifications (recipient_id, actor_id, kind, app_id, payload)
    values (app_author, new.user_id, 'like', new.app_id, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists notify_on_like_t on public.likes;
create trigger notify_on_like_t
  after insert on public.likes
  for each row execute function public.notify_on_like();

-- ── 3b. notify_on_comment — AFTER INSERT on public.comments ─────────────────

create or replace function public.notify_on_comment()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
declare
  recipient uuid;
  kind_v public.notif_kind;
begin
  if new.parent_id is null then
    kind_v := 'comment';
    select author_id into recipient from public.apps where id = new.app_id;
  else
    kind_v := 'comment_reply';
    select author_id into recipient from public.comments where id = new.parent_id;
  end if;
  if recipient is null then return new; end if;
  if recipient = new.author_id then return new; end if;  -- self-comment, no notif
  insert into public.notifications (recipient_id, actor_id, kind, app_id, comment_id, payload)
    values (recipient, new.author_id, kind_v, new.app_id, new.id, jsonb_build_object('body', new.body));
  return new;
end;
$$;

drop trigger if exists notify_on_comment_t on public.comments;
create trigger notify_on_comment_t
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ── 3c. notify_on_follow — AFTER INSERT on public.follows ───────────────────

create or replace function public.notify_on_follow()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  -- check constraint follower_id <> followee_id already prevents self-follow
  insert into public.notifications (recipient_id, actor_id, kind, payload)
    values (new.followee_id, new.follower_id, 'follow', '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists notify_on_follow_t on public.follows;
create trigger notify_on_follow_t
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ── 3d. notify_on_contact_request_insert — AFTER INSERT on public.contact_requests ─

create or replace function public.notify_on_contact_request_insert()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
begin
  -- check constraint sender_id <> recipient_id already prevents self-request
  insert into public.notifications (recipient_id, actor_id, kind, app_id, contact_request_id, payload)
    values (new.recipient_id, new.sender_id, 'contact_request', new.app_id, new.id,
            jsonb_build_object('role', new.role, 'note', new.note));
  return new;
end;
$$;

drop trigger if exists notify_on_contact_request_insert_t on public.contact_requests;
create trigger notify_on_contact_request_insert_t
  after insert on public.contact_requests
  for each row execute function public.notify_on_contact_request_insert();

-- ── 3e. notify_on_contact_request_update — AFTER UPDATE on public.contact_requests ─

create or replace function public.notify_on_contact_request_update()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
declare kind_v public.notif_kind;
begin
  if new.status = 'accepted' then kind_v := 'contact_accepted';
  elsif new.status = 'declined' then kind_v := 'contact_declined';
  else return new; end if;
  insert into public.notifications (recipient_id, actor_id, kind, app_id, contact_request_id, conversation_id, payload)
    values (new.sender_id, new.recipient_id, kind_v, new.app_id, new.id, new.conversation_id, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists notify_on_contact_request_update_t on public.contact_requests;
create trigger notify_on_contact_request_update_t
  after update on public.contact_requests
  for each row
  when (old.status = 'pending' and new.status in ('accepted', 'declined'))
  execute function public.notify_on_contact_request_update();

-- ── 3f. notify_on_message — AFTER INSERT on public.messages ─────────────────

create or replace function public.notify_on_message()
  returns trigger
  language plpgsql
  security definer set search_path = public
as $$
declare
  pa uuid; pb uuid; recipient uuid;
begin
  select participant_a, participant_b into pa, pb from public.conversations where id = new.conversation_id;
  recipient := case when pa = new.sender_id then pb else pa end;
  if recipient is null or recipient = new.sender_id then return new; end if;  -- defense in depth
  insert into public.notifications (recipient_id, actor_id, kind, conversation_id, payload)
    values (recipient, new.sender_id, 'message', new.conversation_id, jsonb_build_object('preview', left(new.body, 200)));
  return new;
end;
$$;

drop trigger if exists notify_on_message_t on public.messages;
create trigger notify_on_message_t
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- ---------------------------------------------------------------------------
-- 4. Realtime publication
-- ---------------------------------------------------------------------------

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- end migration 0015

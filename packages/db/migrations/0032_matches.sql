-- 0032_matches.sql — public.matches table
-- Also adds the "briefs matched builder read" policy deferred from 0031_briefs.sql
-- (this policy uses a subquery on public.matches, so it must be created after matches exists).

create table if not exists public.matches (
  id                    uuid        primary key default gen_random_uuid(),
  brief_id              uuid        not null references public.briefs(id) on delete cascade,
  candidate_type        public.candidate_type not null,
  candidate_app_id      uuid        references public.apps(id),
  candidate_builder_id  uuid        references public.profiles(id),
  agent_confidence      double precision not null,
  agent_rationale       text        not null default '',
  seeker_action         public.swipe_action not null default 'PENDING',
  candidate_action      public.swipe_action not null default 'PENDING',
  thread_id             uuid,
  commercial_status     public.commercial_status not null default 'NONE',
  created_at            timestamptz not null default now(),
  seeker_acted_at       timestamptz,
  candidate_acted_at    timestamptz,

  -- Exactly one of candidate_app_id / candidate_builder_id must be set (XOR)
  constraint matches_candidate_xor check (
    (candidate_app_id is not null) <> (candidate_builder_id is not null)
  ),

  -- Prevent duplicate (brief, candidate) pairs
  constraint matches_unique_candidate unique (brief_id, candidate_type, candidate_app_id, candidate_builder_id)
);

alter table public.matches enable row level security;

create index if not exists matches_brief_confidence_idx
  on public.matches (brief_id, agent_confidence desc);

create index if not exists matches_candidate_builder_action_idx
  on public.matches (candidate_builder_id, candidate_action);

create index if not exists matches_candidate_app_idx
  on public.matches (candidate_app_id);

-- RLS policies for matches
-- Brief author can read all matches on their briefs
drop policy if exists "matches brief author read" on public.matches;
create policy "matches brief author read"
  on public.matches for select
  using (
    exists (
      select 1 from public.briefs b
      where b.id = matches.brief_id
        and b.author_id = auth.uid()
    )
  );

-- Candidate builder can read their own match records
drop policy if exists "matches candidate builder read own" on public.matches;
create policy "matches candidate builder read own"
  on public.matches for select
  using (candidate_builder_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Deferred policy from 0031_briefs.sql:
-- Matched builder can read the brief they were matched against.
-- Placed here because it references public.matches.
-- ---------------------------------------------------------------------------
drop policy if exists "briefs matched builder read" on public.briefs;
create policy "briefs matched builder read"
  on public.briefs for select
  using (
    exists (
      select 1 from public.matches m
      where m.brief_id = briefs.id
        and m.candidate_builder_id = auth.uid()
    )
  );

-- down:
-- drop policy if exists "briefs matched builder read" on public.briefs;
-- drop policy if exists "matches candidate builder read own" on public.matches;
-- drop policy if exists "matches brief author read" on public.matches;
-- drop table if exists public.matches;

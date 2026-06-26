-- 0033_brief_audit.sql — three append-only audit/log tables for the Brief & Match feature
-- Tables: brief_refinement_turns, brief_match_audit_logs, validator_suggestions
-- All are write-via-service_role; RLS policies only expose rows to the brief's author.

-- ---------------------------------------------------------------------------
-- 1. brief_refinement_turns — append-only log of Refiner agent conversation turns
-- ---------------------------------------------------------------------------

create table if not exists public.brief_refinement_turns (
  id                        uuid        primary key default gen_random_uuid(),
  brief_id                  uuid        not null references public.briefs(id) on delete cascade,
  round                     int         not null,
  turn_index                int         not null,
  role                      public.turn_role not null,
  content                   text        not null default '',
  content_json              jsonb,
  ui_component_invocation   jsonb,
  model_used                text,
  tokens_in                 int,
  tokens_out                int,
  created_at                timestamptz not null default now()
);

alter table public.brief_refinement_turns enable row level security;

create index if not exists brief_refinement_turns_brief_round_idx
  on public.brief_refinement_turns (brief_id, round, turn_index);

drop policy if exists "brief_refinement_turns author read" on public.brief_refinement_turns;
create policy "brief_refinement_turns author read"
  on public.brief_refinement_turns for select
  using (
    exists (
      select 1 from public.briefs b
      where b.id = brief_refinement_turns.brief_id
        and b.author_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. brief_match_audit_logs — append-only log of matcher agent runs
-- ---------------------------------------------------------------------------

create table if not exists public.brief_match_audit_logs (
  id                    uuid        primary key default gen_random_uuid(),
  brief_id              uuid        not null references public.briefs(id) on delete cascade,
  phase                 public.match_phase not null,
  candidates_considered int         not null default 0,
  candidates_shortlisted int        not null default 0,
  candidates_final      int         not null default 0,
  model_used            text,
  duration_ms           int         not null default 0,
  rationale_json        jsonb,
  created_at            timestamptz not null default now()
);

alter table public.brief_match_audit_logs enable row level security;

create index if not exists brief_match_audit_logs_brief_phase_idx
  on public.brief_match_audit_logs (brief_id, phase);

drop policy if exists "brief_match_audit_logs author read" on public.brief_match_audit_logs;
create policy "brief_match_audit_logs author read"
  on public.brief_match_audit_logs for select
  using (
    exists (
      select 1 from public.briefs b
      where b.id = brief_match_audit_logs.brief_id
        and b.author_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. validator_suggestions — quality improvement suggestions from Validator agent
-- ---------------------------------------------------------------------------

create table if not exists public.validator_suggestions (
  id              uuid        primary key default gen_random_uuid(),
  brief_id        uuid        not null references public.briefs(id) on delete cascade,
  section_path    text        not null,
  diagnosis       text        not null,
  example_better  text        not null,
  status          public.suggestion_status not null default 'PENDING',
  applied_value   text,
  model_used      text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

alter table public.validator_suggestions enable row level security;

create index if not exists validator_suggestions_brief_status_idx
  on public.validator_suggestions (brief_id, status);

drop policy if exists "validator_suggestions author read" on public.validator_suggestions;
create policy "validator_suggestions author read"
  on public.validator_suggestions for select
  using (
    exists (
      select 1 from public.briefs b
      where b.id = validator_suggestions.brief_id
        and b.author_id = auth.uid()
    )
  );

-- down:
-- drop policy if exists "validator_suggestions author read" on public.validator_suggestions;
-- drop table if exists public.validator_suggestions;
-- drop policy if exists "brief_match_audit_logs author read" on public.brief_match_audit_logs;
-- drop table if exists public.brief_match_audit_logs;
-- drop policy if exists "brief_refinement_turns author read" on public.brief_refinement_turns;
-- drop table if exists public.brief_refinement_turns;

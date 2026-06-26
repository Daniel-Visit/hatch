-- 0031_briefs.sql — public.briefs table
-- Enums created in 0030_wanted_enums.sql.
-- NOTE: the "matched-builder read" RLS policy intentionally lives in 0032_matches.sql
-- to avoid a forward-reference to public.matches (which doesn't exist yet at this point).

create table if not exists public.briefs (
  id                        uuid        primary key default gen_random_uuid(),
  author_id                 uuid        not null references public.profiles(id) on delete cascade,
  status                    public.brief_status        not null default 'DRAFT',
  entry_mode                public.brief_entry_mode    not null,
  refinement_round          int         not null default 0,
  completeness_score        double precision not null default 0,
  quality_score             double precision not null default 0,
  quality_by_section        jsonb,
  match_potential_estimate  jsonb,
  manually_edited_fields    text[]      not null default '{}',
  parsed_from               text,
  title                     text,
  content                   jsonb       not null default '{}',
  industry                  text,
  use_case                  public.brief_use_case,
  technical_level           public.technical_level,
  budget_band               public.budget_band,
  timeline                  public.brief_timeline,
  solution_types            public.solution_type[] not null default '{}',
  geography                 text,
  intent                    text        not null default 'request',
  visibility                public.brief_visibility not null default 'PRIVATE_MATCHED',
  public_likes              int         not null default 0,
  public_rank               double precision not null default 0,
  created_at                timestamptz not null default now(),
  matching_started_at       timestamptz,
  public_at                 timestamptz,
  expires_at                timestamptz not null default (now() + interval '14 days'),
  resolved_at               timestamptz,
  resolution                public.brief_resolution,
  updated_at                timestamptz not null default now(),

  constraint briefs_expires_after_created check (expires_at > created_at),
  constraint briefs_paste_requires_parsed_from check (entry_mode <> 'PASTE' or parsed_from is not null)
);

alter table public.briefs enable row level security;

create index if not exists briefs_status_idx
  on public.briefs (status);

create index if not exists briefs_author_status_idx
  on public.briefs (author_id, status);

create index if not exists briefs_visibility_rank_idx
  on public.briefs (visibility, public_rank desc);

create index if not exists briefs_expires_at_idx
  on public.briefs (expires_at);

-- updated_at trigger (reuses the shared touch_updated_at function from 0001_init.sql)
drop trigger if exists briefs_set_updated_at on public.briefs;
create trigger briefs_set_updated_at
  before update on public.briefs
  for each row execute function public.touch_updated_at();

-- RLS policies
-- Author: full access to own briefs
drop policy if exists "briefs author all" on public.briefs;
create policy "briefs author all"
  on public.briefs for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Public gallery: any authenticated user can read PUBLIC briefs
drop policy if exists "briefs public read" on public.briefs;
create policy "briefs public read"
  on public.briefs for select
  using (visibility = 'PUBLIC_GALLERY' and status = 'PUBLIC');

-- NOTE: "briefs matched builder read" policy is added in 0032_matches.sql
-- because it references public.matches which does not exist until that migration.

-- down:
-- drop trigger if exists briefs_set_updated_at on public.briefs;
-- drop policy if exists "briefs public read" on public.briefs;
-- drop policy if exists "briefs author all" on public.briefs;
-- drop table if exists public.briefs;

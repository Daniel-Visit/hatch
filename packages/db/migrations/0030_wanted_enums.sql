-- 0030_wanted_enums.sql — Wanted/Brief & Match feature: 15 idempotent native enums
-- All enums are guarded with pg_type existence checks (idempotency enforced by migration_validator hook).

-- brief_status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'brief_status') then
    create type public.brief_status as enum (
      'DRAFT',
      'REFINING',
      'PARSING',
      'AWAITING_VALIDATION',
      'REVIEW_HEALTH',
      'MATCHING',
      'PRIVATE',
      'PUBLIC',
      'RESOLVED',
      'EXPIRED'
    );
  end if;
end $$;

-- brief_entry_mode
do $$ begin
  if not exists (select 1 from pg_type where typname = 'brief_entry_mode') then
    create type public.brief_entry_mode as enum (
      'CHAT',
      'FORM',
      'PASTE'
    );
  end if;
end $$;

-- suggestion_status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'suggestion_status') then
    create type public.suggestion_status as enum (
      'PENDING',
      'APPLIED',
      'DISMISSED',
      'AUTO_DISMISSED'
    );
  end if;
end $$;

-- brief_visibility
do $$ begin
  if not exists (select 1 from pg_type where typname = 'brief_visibility') then
    create type public.brief_visibility as enum (
      'PRIVATE_MATCHED',
      'PUBLIC_GALLERY'
    );
  end if;
end $$;

-- brief_use_case
do $$ begin
  if not exists (select 1 from pg_type where typname = 'brief_use_case') then
    create type public.brief_use_case as enum (
      'PERSONAL',
      'TEAM',
      'CLIENT_DELIVERABLE',
      'OTHER'
    );
  end if;
end $$;

-- technical_level
do $$ begin
  if not exists (select 1 from pg_type where typname = 'technical_level') then
    create type public.technical_level as enum (
      'NON_TECHNICAL',
      'SEMI_TECHNICAL',
      'DEVELOPER'
    );
  end if;
end $$;

-- budget_band
do $$ begin
  if not exists (select 1 from pg_type where typname = 'budget_band') then
    create type public.budget_band as enum (
      'EXPLORATORY',
      'LT_500',
      'FROM_500_2K',
      'FROM_2K_10K',
      'GT_10K',
      'OPEN'
    );
  end if;
end $$;

-- brief_timeline
do $$ begin
  if not exists (select 1 from pg_type where typname = 'brief_timeline') then
    create type public.brief_timeline as enum (
      'ASAP',
      'WEEKS',
      'MONTHS',
      'NO_RUSH'
    );
  end if;
end $$;

-- solution_type
do $$ begin
  if not exists (select 1 from pg_type where typname = 'solution_type') then
    create type public.solution_type as enum (
      'EXISTING_APP',
      'CUSTOM_BUILD',
      'FORK_AND_MODIFY',
      'CONSULTING'
    );
  end if;
end $$;

-- candidate_type
do $$ begin
  if not exists (select 1 from pg_type where typname = 'candidate_type') then
    create type public.candidate_type as enum (
      'APP',
      'BUILDER'
    );
  end if;
end $$;

-- swipe_action
do $$ begin
  if not exists (select 1 from pg_type where typname = 'swipe_action') then
    create type public.swipe_action as enum (
      'PENDING',
      'CONNECT',
      'SKIP',
      'AUTO_SKIPPED'
    );
  end if;
end $$;

-- commercial_status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'commercial_status') then
    create type public.commercial_status as enum (
      'NONE',
      'REPORTED_AGREED',
      'REPORTED_CLOSED'
    );
  end if;
end $$;

-- turn_role
do $$ begin
  if not exists (select 1 from pg_type where typname = 'turn_role') then
    create type public.turn_role as enum (
      'AGENT',
      'USER',
      'SYSTEM'
    );
  end if;
end $$;

-- match_phase
do $$ begin
  if not exists (select 1 from pg_type where typname = 'match_phase') then
    create type public.match_phase as enum (
      'APP',
      'BUILDER'
    );
  end if;
end $$;

-- brief_resolution
do $$ begin
  if not exists (select 1 from pg_type where typname = 'brief_resolution') then
    create type public.brief_resolution as enum (
      'RESOLVED_WITH_APP',
      'RESOLVED_WITH_BUILDER',
      'RESOLVED_ELSEWHERE',
      'ABANDONED'
    );
  end if;
end $$;

-- down:
-- drop type if exists public.brief_resolution;
-- drop type if exists public.match_phase;
-- drop type if exists public.turn_role;
-- drop type if exists public.commercial_status;
-- drop type if exists public.swipe_action;
-- drop type if exists public.candidate_type;
-- drop type if exists public.solution_type;
-- drop type if exists public.brief_timeline;
-- drop type if exists public.budget_band;
-- drop type if exists public.technical_level;
-- drop type if exists public.brief_use_case;
-- drop type if exists public.brief_visibility;
-- drop type if exists public.suggestion_status;
-- drop type if exists public.brief_entry_mode;
-- drop type if exists public.brief_status;

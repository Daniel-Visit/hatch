-- 0034_extend_profiles_apps.sql — additive columns on public.profiles and public.apps
-- for the Wanted / Brief & Match feature (§1.3 User and App extensions).
-- All alterations use ADD COLUMN IF NOT EXISTS for idempotency.

-- ---------------------------------------------------------------------------
-- 1. public.profiles extensions
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists accepts_requests     boolean     not null default false;

alter table public.profiles
  add column if not exists request_capacity     int         not null default 3;

alter table public.profiles
  add column if not exists request_domains      text[]      not null default '{}';

alter table public.profiles
  add column if not exists request_rate_band    public.budget_band;

alter table public.profiles
  add column if not exists inferred_capabilities text[]     not null default '{}';

alter table public.profiles
  add column if not exists last_brief_response_at timestamptz;

alter table public.profiles
  add column if not exists feature_flags        jsonb       not null default '{}';

-- ---------------------------------------------------------------------------
-- 2. public.apps extensions
-- ---------------------------------------------------------------------------

alter table public.apps
  add column if not exists discovery_via_brief_count int  not null default 0;

alter table public.apps
  add column if not exists solves_problems      text[]      not null default '{}';

-- GIN index for solves_problems array lookups
create index if not exists apps_solves_problems_idx
  on public.apps using gin (solves_problems);

-- down:
-- drop index if exists apps_solves_problems_idx;
-- alter table public.apps drop column if exists solves_problems;
-- alter table public.apps drop column if exists discovery_via_brief_count;
-- alter table public.profiles drop column if exists feature_flags;
-- alter table public.profiles drop column if exists last_brief_response_at;
-- alter table public.profiles drop column if exists inferred_capabilities;
-- alter table public.profiles drop column if exists request_rate_band;
-- alter table public.profiles drop column if exists request_domains;
-- alter table public.profiles drop column if exists request_capacity;
-- alter table public.profiles drop column if exists accepts_requests;

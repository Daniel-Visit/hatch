-- 0036_match_feedback.sql
-- Wanted §2.1: persist the builder's SKIP feedback on a match.
--
-- The POST /api/v1/matches/:id/respond route already validates `feedback` +
-- `feedbackNote` but discards them ("no schema column ... this task forbids new
-- migrations, so feedback is accepted and validated but its side effect is a
-- no-op"). This migration adds the columns so SKIP feedback is recorded against
-- the match (the seed for the builder's implicit-profile signal, §2.1).
--
-- Additive + nullable: existing rows and the matches RLS policies are unaffected.
-- The mutation is written by the route via the admin client (matches is
-- SELECT-only under RLS), so no new client-facing policy is required.

create type public.match_feedback as enum (
  'not_my_area',
  'no_capacity',
  'budget_mismatch',
  'other'
);

alter table public.matches
  add column if not exists candidate_feedback      public.match_feedback,
  add column if not exists candidate_feedback_note text;

comment on column public.matches.candidate_feedback is
  'Builder''s reason when candidate_action = SKIP (Wanted §2.1). Null otherwise.';
comment on column public.matches.candidate_feedback_note is
  'Optional free-text note accompanying candidate_feedback (max 2000 chars, enforced in the API).';

notify pgrst, 'reload schema';

-- ── down ─────────────────────────────────────────────────────────────────────
-- alter table public.matches
--   drop column if exists candidate_feedback,
--   drop column if exists candidate_feedback_note;
-- drop type if exists public.match_feedback;
-- notify pgrst, 'reload schema';

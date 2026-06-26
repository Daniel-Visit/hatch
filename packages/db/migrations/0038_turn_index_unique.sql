-- 0038_turn_index_unique.sql
-- Wanted: close the read-max-then-insert race in nextTurnIndex()/appendTurn()
-- (apps/web/lib/wanted/turn-repo.ts). Two concurrent turns in the same
-- (brief_id, round) could compute the same turn_index and both insert, producing
-- duplicate ordering keys. A UNIQUE constraint makes the second insert fail with
-- 23505; the repo retries on that error by recomputing the next index.
--
-- 0033 created a NON-unique index on (brief_id, round, turn_index); this promotes
-- the invariant to a UNIQUE index. Pre-flight confirmed 0 duplicate groups in live
-- data (the table is empty), so the index builds cleanly.

create unique index if not exists brief_refinement_turns_brief_round_turn_uidx
  on public.brief_refinement_turns (brief_id, round, turn_index);

-- Drop the now-redundant non-unique index from 0033 (the unique index covers the
-- same (brief_id, round, turn_index) prefix used by listTurns ordering).
drop index if exists public.brief_refinement_turns_brief_round_idx;

-- ── down ─────────────────────────────────────────────────────────────────────
-- drop index if exists public.brief_refinement_turns_brief_round_turn_uidx;
-- create index if not exists brief_refinement_turns_brief_round_idx
--   on public.brief_refinement_turns (brief_id, round, turn_index);

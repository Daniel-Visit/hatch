-- 0039_fix_briefs_matches_rls_recursion.sql
-- Bug: mutual recursion between the briefs↔matches SELECT policies threw
-- "infinite recursion detected in policy for relation briefs" on EVERY read of
-- briefs, 500ing brief creation (createBrief → countActiveBriefs does a SELECT
-- on briefs, which evaluates all its SELECT policies):
--   briefs "matched builder read" USING (EXISTS … FROM matches …)
--     → evaluates matches SELECT policies
--   matches "matches brief author read" USING (EXISTS … FROM briefs …)
--     → evaluates briefs SELECT policies → back to "matched builder read" → ∞
--
-- The unit suite mocks Supabase, so this only surfaces against the real DB.
--
-- Fix (standard Supabase pattern, mirrors public.is_participant): move each
-- cross-table check into a SECURITY DEFINER helper. The helper runs as its owner
-- and the tables are NOT FORCE ROW LEVEL SECURITY, so its internal query bypasses
-- the referenced table's RLS — breaking the cycle. auth.uid() still resolves to
-- the CALLER inside a SECURITY DEFINER function (it reads the request JWT GUC),
-- so the access semantics are identical, just non-recursive.

create or replace function public.is_brief_author(p_brief_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.briefs b
    where b.id = p_brief_id and b.author_id = auth.uid()
  );
$$;

create or replace function public.is_matched_builder(p_brief_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.brief_id = p_brief_id and m.candidate_builder_id = auth.uid()
  );
$$;

revoke all on function public.is_brief_author(uuid) from public;
revoke all on function public.is_matched_builder(uuid) from public;
grant execute on function public.is_brief_author(uuid)    to authenticated, anon, service_role;
grant execute on function public.is_matched_builder(uuid) to authenticated, anon, service_role;

-- Rewrite the two recursive policies to call the non-recursive helpers.
drop policy if exists "briefs matched builder read" on public.briefs;
create policy "briefs matched builder read" on public.briefs
  for select using (public.is_matched_builder(id));

drop policy if exists "matches brief author read" on public.matches;
create policy "matches brief author read" on public.matches
  for select using (public.is_brief_author(brief_id));

notify pgrst, 'reload schema';

-- ── down ─────────────────────────────────────────────────────────────────────
-- drop policy if exists "briefs matched builder read" on public.briefs;
-- create policy "briefs matched builder read" on public.briefs
--   for select using (exists (select 1 from public.matches m
--     where m.brief_id = briefs.id and m.candidate_builder_id = auth.uid()));
-- drop policy if exists "matches brief author read" on public.matches;
-- create policy "matches brief author read" on public.matches
--   for select using (exists (select 1 from public.briefs b
--     where b.id = matches.brief_id and b.author_id = auth.uid()));
-- drop function if exists public.is_brief_author(uuid);
-- drop function if exists public.is_matched_builder(uuid);
-- notify pgrst, 'reload schema';

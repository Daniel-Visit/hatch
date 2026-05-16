-- Drop remix concept entirely per SPEC.md §1.
-- No triggers depend on bump_remixes_count(); no views reference remixes_count;
-- no `remixes` table exists. Safe drop.

alter table public.apps drop column if exists remixes_count;
drop function if exists public.bump_remixes_count();

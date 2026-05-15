-- Phase 1 hardening: address advisor warnings from get_advisors
-- 1) Pin search_path on functions that lacked it
-- 2) Revoke EXECUTE on the trigger function from anon and authenticated so it
--    can't be invoked as an RPC. Triggers still fire because they run as the
--    table owner regardless of grant.

alter function public.touch_updated_at() set search_path = public;
alter function public.uid() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated;

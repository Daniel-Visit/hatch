-- 0022_rate_limit_anon_grant.sql
-- Grant execute on increment_rate_limit to anon + authenticated so public API
-- routes (which use the anon SSR client) can rate-limit themselves.
-- The function is SECURITY DEFINER so its body still runs as postgres and can
-- write to api_rate_limits regardless of caller role.

grant execute on function public.increment_rate_limit(text, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';

-- 0035_rate_limit_window.sql
-- Wanted §2.4: per-route rate limits with REAL configurable windows + limits.
--
-- Problem: the existing increment_rate_limit(p_ip, p_bucket_start) RPC applies a
-- single hard-coded 60-req/60-sec window to every caller (see apps/web/lib/
-- rate-limit.ts LIMIT/WINDOW_S). The per-route limits documented in the brief
-- routes (10/h create, 5/h match, 3/h parse, 200/h content, 60/h refine,
-- 50/h dismiss) are therefore NOT actually enforced — only the bucket key differs.
--
-- This migration adds a NEW, backward-compatible RPC that takes an optional
-- window and limit and computes its own bucket server-side. The original
-- increment_rate_limit() is left intact so existing callers keep working.
-- Reuses the existing api_rate_limits table (its `ip` column already doubles as a
-- generic rate-limit key, e.g. "briefs:refine:<uuid>").

create or replace function public.increment_rate_limit_window(
  p_key            text,
  p_window_seconds int default 60,
  p_limit          int default 60
) returns table(count int, limited boolean, reset_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_window int := coalesce(nullif(p_window_seconds, 0), 60);
  v_bucket timestamptz;
  v_count  int;
begin
  if v_window < 1 then
    v_window := 60;
  end if;
  -- Floor "now" to the window boundary so all requests in the same window share a row.
  v_bucket := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);

  insert into public.api_rate_limits (ip, bucket_start, count)
  values (p_key, v_bucket, 1)
  on conflict (ip, bucket_start) do update set count = api_rate_limits.count + 1
  returning api_rate_limits.count into v_count;

  count    := v_count;
  limited  := v_count > p_limit;
  reset_at := v_bucket + make_interval(secs => v_window);
  return next;
end;
$$;

revoke all on function public.increment_rate_limit_window(text, int, int) from public;
grant execute on function public.increment_rate_limit_window(text, int, int)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ── down ─────────────────────────────────────────────────────────────────────
-- drop function if exists public.increment_rate_limit_window(text, int, int);
-- notify pgrst, 'reload schema';

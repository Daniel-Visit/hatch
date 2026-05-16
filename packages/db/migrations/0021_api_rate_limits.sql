-- 0021_api_rate_limits.sql
-- Phase 12: per-IP rate-limit counter for /api/v1/* public endpoints.
-- 60-second buckets, one row per (ip, bucket_start). Increment via SECURITY DEFINER RPC.

create table if not exists public.api_rate_limits (
  ip           text not null,
  bucket_start timestamptz not null,
  count        int not null default 0,
  primary key (ip, bucket_start)
);

create index if not exists api_rate_limits_bucket_idx on public.api_rate_limits (bucket_start);

alter table public.api_rate_limits enable row level security;
-- No client-side policies — only service_role accesses this table via the RPC below.

-- increment_rate_limit: atomic upsert-and-increment. Returns the new count.
-- Used by apps/web/lib/rate-limit.ts on every /api/v1/* request.
create or replace function public.increment_rate_limit(
  p_ip text, p_bucket_start timestamptz
) returns int language sql security definer set search_path = public as $$
  insert into public.api_rate_limits (ip, bucket_start, count)
  values (p_ip, p_bucket_start, 1)
  on conflict (ip, bucket_start) do update set count = api_rate_limits.count + 1
  returning count;
$$;

revoke all on function public.increment_rate_limit(text, timestamptz) from public;
grant execute on function public.increment_rate_limit(text, timestamptz) to service_role;

notify pgrst, 'reload schema';

-- 0019_api_keys.sql
-- Personal Access Tokens for the MCP server.
-- One active token per user (enforced via unique partial index).
-- Tokens are bcrypt-hashed; only the prefix is stored unhashed for indexed lookup.

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  token_hash   text not null,
  token_prefix text not null,
  label        text not null default 'Claude Desktop',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_user_id_idx
  on public.api_keys (user_id)
  where revoked_at is null;

create index if not exists api_keys_token_prefix_idx
  on public.api_keys (token_prefix)
  where revoked_at is null;

create unique index if not exists api_keys_one_active_per_user
  on public.api_keys (user_id)
  where revoked_at is null;

alter table public.api_keys enable row level security;

-- Users see only their own keys (and never the hash, since the column is selected explicitly elsewhere)
drop policy if exists "users read own api_keys" on public.api_keys;
create policy "users read own api_keys"
  on public.api_keys for select
  using (user_id = auth.uid());

drop policy if exists "users insert own api_keys" on public.api_keys;
create policy "users insert own api_keys"
  on public.api_keys for insert
  with check (user_id = auth.uid());

-- Users can only flip revoked_at — UPDATE requires revoked_at IS NOT NULL in the new row.
-- This intentionally also blocks relabel-after-create; documented as v1 limitation.
drop policy if exists "users revoke own api_keys" on public.api_keys;
create policy "users revoke own api_keys"
  on public.api_keys for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and revoked_at is not null);

-- No DELETE policy — soft delete only via revoked_at.

-- Force PostgREST cache reload so the new table is queryable immediately
notify pgrst, 'reload schema';

-- Phase 1: RLS policies for profiles + categories
-- Per SPEC.md §5.2

-- Helper: returns the calling user's id, or null for anon
create or replace function public.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

-- profiles: readable by anyone, writable by owner only
alter table public.profiles enable row level security;

create policy "profiles read for everyone"
  on public.profiles for select using (true);

create policy "profiles update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- categories: readable by anyone, no writes from clients
alter table public.categories enable row level security;

create policy "categories read for everyone"
  on public.categories for select using (true);

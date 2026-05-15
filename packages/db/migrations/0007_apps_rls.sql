-- Phase 3: RLS policies for apps table
-- Per SPEC.md §5.2

alter table public.apps enable row level security;

drop policy if exists "apps read published" on public.apps;
create policy "apps read published"
  on public.apps for select using (is_published or author_id = auth.uid());

drop policy if exists "apps insert own" on public.apps;
create policy "apps insert own"
  on public.apps for insert with check (author_id = auth.uid());

drop policy if exists "apps update own" on public.apps;
create policy "apps update own"
  on public.apps for update using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "apps delete own" on public.apps;
create policy "apps delete own"
  on public.apps for delete using (author_id = auth.uid());

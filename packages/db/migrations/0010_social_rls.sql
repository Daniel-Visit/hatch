-- migration 0010_social_rls — RLS for likes, saves, follows, comments, comment_likes
-- Source: SPEC.md §5.2 (lines 699-735), copied verbatim

-- ─── enable row level security ──────────────────────────────────────────────
alter table public.likes         enable row level security;
alter table public.saves         enable row level security;
alter table public.follows       enable row level security;
alter table public.comments      enable row level security;
alter table public.comment_likes enable row level security;

-- ─── drop existing policies (re-apply safety) ───────────────────────────────
drop policy if exists "likes readable"    on public.likes;
drop policy if exists "likes insert own"  on public.likes;
drop policy if exists "likes delete own"  on public.likes;

drop policy if exists "saves readable own" on public.saves;
drop policy if exists "saves insert own"   on public.saves;
drop policy if exists "saves delete own"   on public.saves;

drop policy if exists "follows readable"   on public.follows;
drop policy if exists "follows insert own" on public.follows;
drop policy if exists "follows delete own" on public.follows;

drop policy if exists "comments readable"    on public.comments;
drop policy if exists "comments insert own"  on public.comments;
drop policy if exists "comments update own"  on public.comments;

drop policy if exists "comment_likes readable"   on public.comment_likes;
drop policy if exists "comment_likes insert own" on public.comment_likes;
drop policy if exists "comment_likes delete own" on public.comment_likes;

-- ─── likes / saves / follows ─────────────────────────────────
create policy "likes readable" on public.likes for select using (true);
create policy "likes insert own" on public.likes for insert
  with check (user_id = auth.uid());
create policy "likes delete own" on public.likes for delete
  using (user_id = auth.uid());

create policy "saves readable own" on public.saves for select using (user_id = auth.uid());
create policy "saves insert own" on public.saves for insert with check (user_id = auth.uid());
create policy "saves delete own" on public.saves for delete using (user_id = auth.uid());

create policy "follows readable" on public.follows for select using (true);
create policy "follows insert own" on public.follows for insert
  with check (follower_id = auth.uid());
create policy "follows delete own" on public.follows for delete
  using (follower_id = auth.uid());

-- ─── comments ───────────────────────────────────────────────
create policy "comments readable" on public.comments for select
  using (not is_deleted or author_id = auth.uid());
create policy "comments insert own" on public.comments for insert
  with check (author_id = auth.uid());
create policy "comments update own" on public.comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "comment_likes readable" on public.comment_likes for select using (true);
create policy "comment_likes insert own" on public.comment_likes for insert
  with check (user_id = auth.uid());
create policy "comment_likes delete own" on public.comment_likes for delete
  using (user_id = auth.uid());

-- end migration 0010

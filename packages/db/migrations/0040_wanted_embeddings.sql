-- 0040_wanted_embeddings.sql — pgvector embeddings + cosine match RPCs for Wanted.
--
-- Lifts the previously-deferred embeddings decision: the Wanted Matcher gains a
-- semantic-vector retriever alongside the existing FTS+Haiku path. Embeddings are
-- produced by Voyage voyage-3, which emits exactly 1024 dimensions — do NOT change
-- this width.
--
-- All alterations are idempotent (create ... if not exists / add column if not
-- exists). The new columns inherit each table's existing RLS; no new policies are
-- needed. The RPCs are `security invoker` and called by the service-role admin
-- client (which bypasses RLS), so they intentionally add no extra row filtering
-- beyond the publication / opt-in flags below.

-- ---------------------------------------------------------------------------
-- 1. pgvector extension
-- ---------------------------------------------------------------------------

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- 2. embedding columns (Voyage voyage-3 = 1024 dims)
-- ---------------------------------------------------------------------------

alter table public.briefs
  add column if not exists embedding vector(1024);

alter table public.apps
  add column if not exists embedding vector(1024);

alter table public.profiles
  add column if not exists capability_embedding vector(1024);

-- ---------------------------------------------------------------------------
-- 3. HNSW cosine indexes
-- ---------------------------------------------------------------------------

create index if not exists briefs_embedding_hnsw
  on public.briefs using hnsw (embedding vector_cosine_ops);

create index if not exists apps_embedding_hnsw
  on public.apps using hnsw (embedding vector_cosine_ops);

create index if not exists profiles_capability_embedding_hnsw
  on public.profiles using hnsw (capability_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 4. match_apps_by_embedding — cosine-distance app retrieval
-- ---------------------------------------------------------------------------
-- Returns published apps with a non-null embedding ordered by cosine distance
-- (<=> ascending = most similar first). The optional licensing pre-filters mirror
-- the FTS retriever's "opposite licensing class" contract: NULL (unclassified)
-- apps are NEVER excluded. Enum values: 'saas' | 'self_hosted' | 'oss'.
--   exclude_saas → drop apps with licensing = 'saas'
--   oss_only     → keep only apps with licensing = 'oss'

create or replace function public.match_apps_by_embedding(
  query_embedding vector(1024),
  match_count     int     default 30,
  exclude_saas    boolean default false,
  oss_only        boolean default false
)
returns table(id uuid, distance real)
language sql
stable
security invoker
as $$
  select a.id, (a.embedding <=> query_embedding)::real as distance
  from public.apps a
  where a.is_published = true
    and a.embedding is not null
    and (not exclude_saas or a.licensing is null or a.licensing <> 'saas')
    and (not oss_only     or a.licensing is null or a.licensing  = 'oss')
  order by a.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- 5. match_builders_by_embedding — cosine-distance builder retrieval
-- ---------------------------------------------------------------------------
-- Returns opted-in builders (accepts_requests = true) with a non-null capability
-- embedding ordered by cosine distance ascending.

create or replace function public.match_builders_by_embedding(
  query_embedding vector(1024),
  match_count     int default 50
)
returns table(id uuid, distance real)
language sql
stable
security invoker
as $$
  select p.id, (p.capability_embedding <=> query_embedding)::real as distance
  from public.profiles p
  where p.accepts_requests = true
    and p.capability_embedding is not null
  order by p.capability_embedding <=> query_embedding
  limit match_count;
$$;

notify pgrst, 'reload schema';

-- ── down ─────────────────────────────────────────────────────────────────────
-- drop function if exists public.match_builders_by_embedding(vector, int);
-- drop function if exists public.match_apps_by_embedding(vector, int, boolean, boolean);
-- drop index if exists profiles_capability_embedding_hnsw;
-- drop index if exists apps_embedding_hnsw;
-- drop index if exists briefs_embedding_hnsw;
-- alter table public.profiles drop column if exists capability_embedding;
-- alter table public.apps drop column if exists embedding;
-- alter table public.briefs drop column if exists embedding;
-- -- extension `vector` intentionally left in place (shared); drop manually if unused.
-- notify pgrst, 'reload schema';

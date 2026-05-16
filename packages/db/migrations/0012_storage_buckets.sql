-- migration 0012_storage_buckets — Phase 5: app-covers bucket + RLS
-- Bucket: app-covers (public read, authenticated insert, owner-only update/delete)
-- Max 2 MB, image/png + image/jpeg + image/webp only
-- Folder layout: <auth.uid()>/<uuid>-<filename> — RLS keys off path prefix

-- 1. Bucket (idempotent via on conflict)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-covers',
  'app-covers',
  true,
  2097152,  -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Drop existing policies for re-apply safety
drop policy if exists "app-covers public read" on storage.objects;
drop policy if exists "app-covers authenticated insert" on storage.objects;
drop policy if exists "app-covers owner update" on storage.objects;
drop policy if exists "app-covers owner delete" on storage.objects;

-- 3. Public read (anyone can SELECT objects in this bucket)
create policy "app-covers public read" on storage.objects for select
  using (bucket_id = 'app-covers');

-- 4. Authenticated insert (any signed-in user can upload, path-prefix bound to their uid)
create policy "app-covers authenticated insert" on storage.objects for insert
  with check (
    bucket_id = 'app-covers'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Owner update (only the path-prefix owner can update)
create policy "app-covers owner update" on storage.objects for update
  using (
    bucket_id = 'app-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'app-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Owner delete
create policy "app-covers owner delete" on storage.objects for delete
  using (
    bucket_id = 'app-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- end migration 0012

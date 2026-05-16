-- Add banner_gradient column (CSS gradient string) to profiles.
-- Null means "use legacy hue-based fallback".
alter table public.profiles
  add column if not exists banner_gradient text;

-- Create avatars bucket (public reads — same model as app-covers).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RLS: anyone can read avatars (public bucket); owners can write under <uid>/*.
do $$ begin
  perform 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_public_read';
  if not found then
    create policy avatars_public_read on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_write';
  if not found then
    create policy avatars_owner_write on storage.objects for insert to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_update';
  if not found then
    create policy avatars_owner_update on storage.objects for update to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  perform 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_delete';
  if not found then
    create policy avatars_owner_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

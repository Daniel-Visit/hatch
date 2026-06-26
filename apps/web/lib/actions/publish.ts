'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import {
  CoverUploadInput,
  type CoverUploadInputT,
  PublishAppInput,
  type PublishAppInputT,
} from '@/lib/zod/publish';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { embedAppBestEffort } from '@/lib/wanted/embeddings/embed';
import { recomputeCapability } from '@/lib/wanted/embeddings/capability';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getCoverUploadUrl(
  input: CoverUploadInputT,
): Promise<Result<{ signedUrl: string; finalPath: string; token: string }>> {
  const parsed = CoverUploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_filename' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { filename } = parsed.data;
  // Path layout: <userId>/<random>-<safe-filename>
  // Storage RLS policy requires (storage.foldername(name))[1] = auth.uid()::text
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const finalPath = `${user.id}/${randomUUID()}-${safeFilename}`;

  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.storage.from('app-covers').createSignedUploadUrl(finalPath);

  if (error || !data) return { ok: false, error: 'storage_error' };

  return {
    ok: true,
    data: { signedUrl: data.signedUrl, finalPath: data.path, token: data.token },
  };
}

export async function publishApp(input: PublishAppInputT): Promise<Result<{ slug: string }>> {
  const parsed = PublishAppInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const {
    title,
    tagline,
    description,
    link,
    categoryId,
    tags,
    artKind,
    accent,
    coverUrl,
    builtWith,
  } = parsed.data;

  const sb = await createSupabaseServerClient();

  // The apps_set_slug BEFORE INSERT trigger (0006_apps.sql line 57) fires when
  // `new.slug is null or new.slug = ''`. The Insert type has slug as optional,
  // so passing slug: '' satisfies the DB not-null constraint while letting the
  // trigger overwrite it with the title-derived slug (with collision suffix loop).
  const { data, error } = await sb
    .from('apps')
    .insert({
      author_id: user.id,
      title,
      tagline,
      description,
      link,
      category_id: categoryId,
      tags,
      art_kind: artKind,
      accent,
      cover_url: coverUrl ?? null,
      built_with: builtWith,
      slug: '', // trigger overwrites with title-derived slug
      is_published: true,
    })
    .select('id, slug, category_id')
    .single();

  if (error || !data) {
    // 23505 = unique_violation — slug collision escaping the trigger's suffix loop
    if (error?.code === '23505') return { ok: false, error: 'duplicate_slug' };
    return { ok: false, error: 'db_error' };
  }

  // Synchronous best-effort embedding + capability recompute (spec E2). Awaited
  // so the app is matchable immediately and the work reliably completes on
  // serverless (a fire-and-forget promise may not run after the action returns).
  // The try/catch swallows every failure so publishing never fails on embedding;
  // the nightly cron is still the backstop.
  try {
    const admin = createSupabaseAdminClient();
    const vec = await embedAppBestEffort({
      name: title,
      oneLiner: tagline,
      description,
      category: categoryId,
    });
    if (vec !== null) {
      await admin
        .from('apps')
        .update({ embedding: '[' + vec.join(',') + ']' })
        .eq('id', data.id);
    }
    await recomputeCapability(admin, user.id);
  } catch (err) {
    console.warn('[wanted/embed] publish: app embedding / capability update failed', err);
  }

  // Revalidate surfaces where the newly published app appears
  revalidatePath('/');
  revalidatePath(`/c/${data.category_id}`);

  return { ok: true, data: { slug: data.slug } };
}

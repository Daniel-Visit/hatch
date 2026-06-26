'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import type { Database } from '@/lib/supabase/types';
import { UpdateProfileInput, type UpdateProfileInputType } from '@/lib/zod/profile';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export async function updateProfile(
  input: UpdateProfileInputType,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateProfileInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const payload: ProfileUpdate = {
    display_name: parsed.data.display_name,
    bio: parsed.data.bio,
    links: parsed.data.links,
    hue: parsed.data.hue,
    banner_gradient: parsed.data.banner_gradient,
  };
  const { error } = await sb.from('profiles').update(payload).eq('id', user.id);

  if (error) {
    console.error('updateProfile db_error', { message: error.message, code: error.code });
    return { ok: false, error: 'db_error' };
  }

  revalidatePath('/settings/profile');
  return { ok: true, data: { id: user.id } };
}

const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export async function uploadAvatar(form: FormData): Promise<ActionResult<{ url: string }>> {
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'no_file' };
  if (!AVATAR_MIME.has(file.type)) return { ok: false, error: 'bad_mime' };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: 'too_large' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const subtype = file.type.split('/')[1];
  const ext = subtype === 'jpeg' ? 'jpg' : subtype;
  const path = `${user.id}/${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await sb.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: updErr } = await sb
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/settings/profile');
  return { ok: true, data: { url: publicUrl } };
}

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
  };
  const { error } = await sb.from('profiles').update(payload).eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/profile');
  return { ok: true, data: { id: user.id } };
}

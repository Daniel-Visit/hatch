'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { SaveToggleInput, type SaveToggleInputT } from '@/lib/zod/social';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function toggleSave(input: SaveToggleInputT): Promise<Result<{ saved: boolean }>> {
  const parsed = SaveToggleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { appId, slug } = parsed.data;
  const sb = await createSupabaseServerClient();

  // Idempotent toggle: SELECT-then-branch (per SPEC §7.5 — don't trust client state)
  const { data: existing } = await sb
    .from('saves')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('app_id', appId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb.from('saves').delete().eq('user_id', user.id).eq('app_id', appId);
    if (error) return { ok: false, error: 'db_error' };
  } else {
    const { error } = await sb.from('saves').insert({ user_id: user.id, app_id: appId });
    if (error) return { ok: false, error: 'db_error' };
  }

  revalidatePath(`/a/${slug}`);
  return { ok: true, data: { saved: !existing } };
}

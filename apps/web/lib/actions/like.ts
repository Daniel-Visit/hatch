'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { LikeToggleInput, type LikeToggleInputT } from '@/lib/zod/social';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function toggleLike(input: LikeToggleInputT): Promise<Result<{ liked: boolean }>> {
  const parsed = LikeToggleInput.safeParse(input);
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
    .from('likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('app_id', appId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb.from('likes').delete().eq('user_id', user.id).eq('app_id', appId);
    if (error) return { ok: false, error: 'db_error' };
  } else {
    const { error } = await sb.from('likes').insert({ user_id: user.id, app_id: appId });
    if (error) return { ok: false, error: 'db_error' };
  }

  revalidatePath(`/a/${slug}`);
  return { ok: true, data: { liked: !existing } };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { FollowToggleInput, type FollowToggleInputT } from '@/lib/zod/social';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function toggleFollow(
  input: FollowToggleInputT,
): Promise<Result<{ following: boolean }>> {
  const parsed = FollowToggleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { followeeId, followeeHandle, followerHandle } = parsed.data;

  // Block self-follow at the action layer (DB check is the backstop)
  if (user.id === followeeId) return { ok: false, error: 'invalid_input' };

  const sb = await createSupabaseServerClient();

  const { data: existing } = await sb
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('followee_id', followeeId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followee_id', followeeId);
    if (error) return { ok: false, error: 'db_error' };
  } else {
    const { error } = await sb
      .from('follows')
      .insert({ follower_id: user.id, followee_id: followeeId });
    if (error) return { ok: false, error: 'db_error' };
  }

  revalidatePath(`/u/${followeeHandle}`);
  revalidatePath(`/u/${followerHandle}`);
  return { ok: true, data: { following: !existing } };
}

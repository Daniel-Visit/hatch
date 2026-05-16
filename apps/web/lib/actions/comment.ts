'use server';

import { revalidatePath } from 'next/cache';
import {
  CommentCreateInput,
  type CommentCreateInputT,
  CommentDeleteInput,
  type CommentDeleteInputT,
  CommentLikeToggleInput,
  type CommentLikeToggleInputT,
} from '@/lib/zod/social';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function postComment(input: CommentCreateInputT): Promise<Result<{ id: string }>> {
  const parsed = CommentCreateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { appId, slug, body, parentId } = parsed.data;
  const sb = await createSupabaseServerClient();

  // Enforce max 1-level nesting at the action layer (DB trigger is the backstop).
  if (parentId) {
    const { data: parent } = await sb
      .from('comments')
      .select('parent_id')
      .eq('id', parentId)
      .maybeSingle();
    if (!parent) return { ok: false, error: 'invalid_input' };
    if (parent.parent_id !== null) return { ok: false, error: 'invalid_input' };
  }

  const { data, error } = await sb
    .from('comments')
    .insert({ app_id: appId, author_id: user.id, body, parent_id: parentId ?? null })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: 'db_error' };

  void sb.rpc('refresh_hot_scores').then(
    () => {},
    () => {},
  );
  revalidatePath(`/a/${slug}`);
  return { ok: true, data: { id: data.id } };
}

export async function softDeleteComment(input: CommentDeleteInputT): Promise<Result<null>> {
  const parsed = CommentDeleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { commentId, slug } = parsed.data;
  const sb = await createSupabaseServerClient();

  // RLS enforces author-only update. We only flip is_deleted = true.
  const { error } = await sb
    .from('comments')
    .update({ is_deleted: true })
    .eq('id', commentId)
    .eq('author_id', user.id);

  if (error) return { ok: false, error: 'db_error' };

  revalidatePath(`/a/${slug}`);
  return { ok: true, data: null };
}

export async function toggleCommentLike(
  input: CommentLikeToggleInputT,
): Promise<Result<{ liked: boolean }>> {
  const parsed = CommentLikeToggleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { commentId, slug } = parsed.data;
  const sb = await createSupabaseServerClient();

  const { data: existing } = await sb
    .from('comment_likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('comment_id', commentId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from('comment_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('comment_id', commentId);
    if (error) return { ok: false, error: 'db_error' };
  } else {
    const { error } = await sb
      .from('comment_likes')
      .insert({ user_id: user.id, comment_id: commentId });
    if (error) return { ok: false, error: 'db_error' };
  }

  void sb.rpc('refresh_hot_scores').then(
    () => {},
    () => {},
  );
  revalidatePath(`/a/${slug}`);
  return { ok: true, data: { liked: !existing } };
}

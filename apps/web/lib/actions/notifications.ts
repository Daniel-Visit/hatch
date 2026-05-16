'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import {
  NotificationRead,
  type NotificationReadT,
  NotificationFilter,
  type NotificationFilterT,
} from '@/lib/zod/notifications';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: string;
  app_id: string | null;
  comment_id: string | null;
  contact_request_id: string | null;
  conversation_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
    hue: number;
    emoji: string | null;
  } | null;
  app: { id: string; slug: string; title: string; accent: string; art_kind: string } | null;
  contact_request: { id: string; sender_link: string | null; role: string } | null;
};

export async function markNotificationRead(input: NotificationReadT): Promise<Result<object>> {
  const parsed = NotificationRead.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('recipient_id', user.id)
    .is('read_at', null);
  if (error) return { ok: false, error: 'db_error' };

  revalidatePath('/notifications');
  return { ok: true, data: {} };
}

export async function markAllRead(): Promise<Result<{ count: number }>> {
  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const { error, count } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() }, { count: 'exact' })
    .eq('recipient_id', user.id)
    .is('read_at', null);
  if (error) return { ok: false, error: 'db_error' };

  revalidatePath('/notifications');
  return { ok: true, data: { count: count ?? 0 } };
}

export async function getNotifications(
  input: NotificationFilterT,
): Promise<Result<{ rows: NotificationRow[]; nextCursor: string | null }>> {
  const parsed = NotificationFilter.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { kind, unreadOnly, cursor } = parsed.data;
  const sb = await createSupabaseServerClient();

  let query = sb
    .from('notifications')
    .select(
      '*, actor:profiles!notifications_actor_id_fkey(handle, display_name, avatar_url, hue, emoji), app:apps(id, slug, title, accent, art_kind), contact_request:contact_requests(id, sender_link, role)',
    )
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (kind) query = query.eq('kind', kind);
  if (unreadOnly) query = query.is('read_at', null);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) return { ok: false, error: 'db_error' };

  const rows = (data as unknown as NotificationRow[]) ?? [];
  const nextCursor = rows.length === 20 ? rows[rows.length - 1].created_at : null;

  return { ok: true, data: { rows, nextCursor } };
}

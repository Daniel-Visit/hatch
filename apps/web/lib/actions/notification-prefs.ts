'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import {
  NotificationPrefsUpdate,
  type NotificationPrefsUpdateT,
  type NotificationPrefsT,
} from '@/lib/zod/notification-prefs';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DEFAULT_PREFS: NotificationPrefsT = {
  push_enabled: false,
  push_likes: false,
  push_follows: false,
  push_comments: true,
  push_messages: true,
  push_contact_requests: true,
};

export async function updateNotificationPrefs(
  input: NotificationPrefsUpdateT,
): Promise<Result<{ notification_prefs: NotificationPrefsT }>> {
  const parsed = NotificationPrefsUpdate.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();

  // Read existing prefs
  const { data: profile, error: readErr } = await sb
    .from('profiles')
    .select('notification_prefs')
    .eq('id', user.id)
    .maybeSingle();

  if (readErr || !profile) return { ok: false, error: 'db_error' };

  const existing = (profile.notification_prefs ?? DEFAULT_PREFS) as NotificationPrefsT;
  const merged: NotificationPrefsT = { ...existing, ...parsed.data };

  const { error: writeErr } = await sb
    .from('profiles')
    .update({ notification_prefs: merged })
    .eq('id', user.id);

  if (writeErr) return { ok: false, error: 'db_error' };

  revalidatePath('/settings/notifications');
  return { ok: true, data: { notification_prefs: merged } };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import {
  PushSubscribeInput,
  type PushSubscribeInputT,
  PushUnsubscribeInput,
  type PushUnsubscribeInputT,
} from '@/lib/zod/push';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function subscribeToPush(input: PushSubscribeInputT): Promise<Result<object>> {
  const parsed = PushSubscribeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { endpoint, keys, userAgent } = parsed.data;
  const sb = await createSupabaseServerClient();

  // Upsert on (user_id, endpoint) — if user re-subscribes the same browser, refresh user_agent + created_at
  const { error } = await sb.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: 'user_id,endpoint' },
  );

  if (error) return { ok: false, error: 'db_error' };

  revalidatePath('/settings/notifications');
  return { ok: true, data: {} };
}

export async function unsubscribeFromPush(input: PushUnsubscribeInputT): Promise<Result<object>> {
  const parsed = PushUnsubscribeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();

  const { error } = await sb
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint);

  if (error) return { ok: false, error: 'db_error' };

  revalidatePath('/settings/notifications');
  return { ok: true, data: {} };
}

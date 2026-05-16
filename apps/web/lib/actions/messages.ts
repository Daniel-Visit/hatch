'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { pushToUser } from '@/lib/push/server';
import {
  MessageSend,
  type MessageSendT,
  ConversationMarkRead,
  type ConversationMarkReadT,
} from '@/lib/zod/messages';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sendMessage(input: MessageSendT): Promise<Result<{ id: string }>> {
  const parsed = MessageSend.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user, profile;
  try {
    ({ user, profile } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { conversationId, body } = parsed.data;
  const sb = await createSupabaseServerClient();

  // Verify conversation exists and user is a participant (RLS will block insert otherwise,
  // but explicit read gives us the OTHER participant for push)
  const { data: conv, error: convErr } = await sb
    .from('conversations')
    .select('id, participant_a, participant_b')
    .eq('id', conversationId)
    .maybeSingle();

  if (convErr || !conv) return { ok: false, error: 'not_found' };

  const otherId = conv.participant_a === user.id ? conv.participant_b : conv.participant_a;
  if (otherId === user.id) return { ok: false, error: 'invalid_state' }; // self-conv shouldn't exist

  // Insert message — trigger fires notif 'message' to the other participant
  const { data, error } = await sb
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: 'db_error' };

  // Fire Web Push if recipient has push_messages enabled. Use admin client to read prefs (bypass RLS).
  try {
    const admin = createSupabaseAdminClient();
    const { data: recipientProfile } = await admin
      .from('profiles')
      .select('notification_prefs')
      .eq('id', otherId)
      .maybeSingle();

    const prefs = (recipientProfile?.notification_prefs ?? {}) as Record<string, boolean>;
    if (prefs.push_enabled && prefs.push_messages) {
      await pushToUser(otherId, {
        title: profile.display_name,
        body: body.slice(0, 200),
        url: `/messages/${conversationId}`,
        tag: `message:${conversationId}`,
      });
    }
  } catch {
    // Push fan-out is best-effort; failures must not fail the action.
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath('/messages');
  return { ok: true, data: { id: data.id } };
}

export async function markConversationRead(input: ConversationMarkReadT): Promise<Result<object>> {
  const parsed = ConversationMarkRead.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { conversationId } = parsed.data;
  const sb = await createSupabaseServerClient();
  const now = new Date().toISOString();

  // Mark received messages as read
  const { error: msgErr } = await sb
    .from('messages')
    .update({ read_at: now })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);

  if (msgErr) return { ok: false, error: 'db_error' };

  // Also mark the 'message' notifications for this conversation as read
  const { error: notifErr } = await sb
    .from('notifications')
    .update({ read_at: now })
    .eq('recipient_id', user.id)
    .eq('conversation_id', conversationId)
    .is('read_at', null);

  if (notifErr) return { ok: false, error: 'db_error' };

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath('/messages');
  return { ok: true, data: {} };
}

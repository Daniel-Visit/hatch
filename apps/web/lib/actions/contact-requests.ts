'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { pushToUser } from '@/lib/push/server';
import {
  ContactRequestCreate,
  type ContactRequestCreateT,
  ContactRequestRespond,
  type ContactRequestRespondT,
} from '@/lib/zod/contact-requests';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sendContactRequest(
  input: ContactRequestCreateT,
): Promise<Result<{ id: string }>> {
  const parsed = ContactRequestCreate.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ user, profile } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { appId, recipientId, role, note, link } = parsed.data;

  // Defense in depth: sender cannot contact themselves
  if (user.id === recipientId) return { ok: false, error: 'cannot_self_contact' };

  const sb = await createSupabaseServerClient();

  const { data, error } = await sb
    .from('contact_requests')
    .insert({
      app_id: appId,
      sender_id: user.id,
      recipient_id: recipientId,
      role,
      note,
      sender_link: link ?? null,
      // status defaults to 'pending'
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: 'db_error' };

  // Fire Web Push (humano-a-humano kind). Wrap in try/catch — push failure must NOT fail the action.
  try {
    await pushToUser(recipientId, {
      title: `${profile.display_name} wants to contact you`,
      body: note.slice(0, 200),
      url: '/notifications',
      tag: `contact_request:${data.id}`,
    });
  } catch {
    // Push fan-out is best-effort; failures must not fail the action.
  }

  revalidatePath('/notifications');
  return { ok: true, data: { id: data.id } };
}

export async function acceptContactRequest(
  input: ContactRequestRespondT,
): Promise<Result<{ conversationId: string }>> {
  const parsed = ContactRequestRespond.safeParse(input);
  if (!parsed.success || parsed.data.action !== 'accept')
    return { ok: false, error: 'invalid_input' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const { requestId } = parsed.data;
  const sb = await createSupabaseServerClient();

  // Read the request — RLS limits to recipient or sender. We need it to be recipient.
  const { data: req, error: readErr } = await sb
    .from('contact_requests')
    .select('id, sender_id, recipient_id, app_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (readErr || !req) return { ok: false, error: 'not_found' };
  if (req.recipient_id !== user.id) return { ok: false, error: 'unauthorized' };
  if (req.status !== 'pending') return { ok: false, error: 'invalid_state' };
  if (!req.app_id) return { ok: false, error: 'invalid_state' };

  // Create or find the canonical conversation between sender and recipient
  const { data: convId, error: rpcErr } = await sb.rpc('find_or_create_conversation', {
    user_a: req.sender_id,
    user_b: req.recipient_id,
    app: req.app_id,
  });

  if (rpcErr || !convId) return { ok: false, error: 'rpc_error' };

  // Update request status — the UPDATE trigger fires notif 'contact_accepted' to the sender
  const { error: updateErr } = await sb
    .from('contact_requests')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
      conversation_id: convId,
    })
    .eq('id', requestId);

  if (updateErr) return { ok: false, error: 'db_error' };

  revalidatePath('/notifications');
  revalidatePath('/messages');
  return { ok: true, data: { conversationId: convId as string } };
}

export async function declineContactRequest(
  input: ContactRequestRespondT,
): Promise<Result<object>> {
  const parsed = ContactRequestRespond.safeParse(input);
  if (!parsed.success || parsed.data.action !== 'decline')
    return { ok: false, error: 'invalid_input' };

  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();

  const { error } = await sb
    .from('contact_requests')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.requestId)
    .eq('recipient_id', user.id)
    .eq('status', 'pending');

  if (error) return { ok: false, error: 'db_error' };

  revalidatePath('/notifications');
  return { ok: true, data: {} };
}

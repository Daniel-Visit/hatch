import { redirect, notFound } from 'next/navigation';
import type { Route } from 'next';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ConversationsList, type ConversationListItem } from '../_components/conversations-list';
import { MessageThread } from './_components/message-thread';

export const dynamic = 'force-dynamic';

export default async function ConversationRoute({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    redirect('/sign-in?next=/messages' as Route);
  }

  const { conversationId } = await params;
  const sb = await createSupabaseServerClient();

  // Fetch the conversation (RLS filters to participants)
  const { data: conv } = await sb
    .from('conversations')
    .select(
      `
      id,
      participant_a,
      participant_b,
      a:profiles!conversations_participant_a_fkey(id, handle, display_name, avatar_url, hue, emoji),
      b:profiles!conversations_participant_b_fkey(id, handle, display_name, avatar_url, hue, emoji)
    `,
    )
    .eq('id', conversationId)
    .maybeSingle();

  if (!conv) notFound();

  const isA = conv.participant_a === user.id;
  const otherRaw = (isA ? conv.b : conv.a) as unknown;
  const other =
    otherRaw && typeof otherRaw === 'object' ? (otherRaw as ConversationListItem['other']) : null;
  if (!other) notFound();

  // Fetch last 50 messages
  const { data: messages } = await sb
    .from('messages')
    .select('id, conversation_id, sender_id, body, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50);

  // Also fetch the conversations list for the left pane
  const { data: convs } = await sb
    .from('conversations')
    .select(
      `
      id,
      last_message_at,
      participant_a,
      participant_b,
      a:profiles!conversations_participant_a_fkey(id, handle, display_name, avatar_url, hue, emoji),
      b:profiles!conversations_participant_b_fkey(id, handle, display_name, avatar_url, hue, emoji),
      messages(id, body, created_at, sender_id, read_at)
    `,
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50);

  const items: ConversationListItem[] = (convs ?? []).map((c) => {
    const isA2 = c.participant_a === user.id;
    const otherRaw2 = (isA2 ? c.b : c.a) as unknown;
    const o =
      otherRaw2 && typeof otherRaw2 === 'object'
        ? (otherRaw2 as ConversationListItem['other'])
        : null;
    const msgs = (c.messages ?? []) as Array<{
      id: string;
      body: string;
      created_at: string;
      sender_id: string;
      read_at: string | null;
    }>;
    const sorted = msgs.slice().sort((x, y) => y.created_at.localeCompare(x.created_at));
    const last = sorted[0] ?? null;
    const unread = msgs.filter((m) => m.sender_id !== user.id && m.read_at === null).length;
    return {
      id: c.id,
      other: o,
      lastMessage: last ? { body: last.body, createdAt: last.created_at } : null,
      unread,
    };
  });

  // Messages came back desc — flip to chronological asc for display
  const chronological = (messages ?? []).slice().reverse();

  return (
    <main
      style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: 'calc(100vh - 56px)' }}
    >
      <ConversationsList items={items} activeId={conversationId} />
      <MessageThread
        conversationId={conversationId}
        userId={user.id}
        other={other}
        initialMessages={chronological}
      />
    </main>
  );
}

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ConversationsList, type ConversationListItem } from './_components/conversations-list';
import { EmptyThread } from './_components/empty-thread';

export const dynamic = 'force-dynamic';

export default async function MessagesRoute() {
  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    redirect('/sign-in?next=/messages' as Route);
  }

  const sb = await createSupabaseServerClient();

  // Fetch conversations the user participates in, with the other participant + last message + unread count
  const { data: convs } = await sb
    .from('conversations')
    .select(
      `
      id,
      last_message_at,
      participant_a,
      participant_b,
      app:apps(id, slug, title),
      a:profiles!conversations_participant_a_fkey(id, handle, display_name, avatar_url, hue, emoji),
      b:profiles!conversations_participant_b_fkey(id, handle, display_name, avatar_url, hue, emoji),
      messages(id, body, created_at, sender_id, read_at)
    `,
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50);

  const items: ConversationListItem[] = (convs ?? []).map((c) => {
    const isA = c.participant_a === user.id;
    const otherRaw = (isA ? c.b : c.a) as unknown;
    const other =
      otherRaw && typeof otherRaw === 'object' ? (otherRaw as ConversationListItem['other']) : null;
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
      other: other,
      lastMessage: last ? { body: last.body, createdAt: last.created_at } : null,
      unread,
    };
  });

  return (
    <main
      style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: 'calc(100vh - 56px)' }}
    >
      <ConversationsList items={items} activeId={null} />
      <EmptyThread />
    </main>
  );
}

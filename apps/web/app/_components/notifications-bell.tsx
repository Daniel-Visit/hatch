'use client';

import { useCallback, useMemo, useState } from 'react';
import { NotificationsPanel } from './notifications-panel';
import type { NotificationItemProps } from './notification-item';
import { useRealtimeNotifs } from './use-realtime-notifs';
import { useUnreadTitle } from './use-unread-title';
import { markAllRead, type NotificationRow } from '@/lib/actions/notifications';
import { acceptContactRequest, declineContactRequest } from '@/lib/actions/contact-requests';
import { toast } from 'sonner';

type NotificationsBellProps = {
  userId: string;
  initialUnread: number;
  initialNotifs: NotificationRow[];
};

function formatWhen(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationsBell({
  userId,
  initialUnread,
  initialNotifs,
}: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationRow[]>(initialNotifs);
  const [unread, setUnread] = useState(initialUnread);

  useUnreadTitle(unread);

  const onInsert = useCallback((row: NotificationRow) => {
    setNotifs((prev) => [row, ...prev.filter((n) => n.id !== row.id)].slice(0, 20));
    setUnread((u) => u + 1);
    // Per SPEC roadmap §5.3 surfacing rules — fire toast on high-signal kinds
    const actorName = row.actor?.display_name ?? 'Someone';
    if (row.kind === 'contact_request') {
      toast(`${actorName} wants to contact you`, { description: 'Open Inbox to respond' });
    } else if (row.kind === 'message') {
      const preview = (row.payload as { preview?: string }).preview ?? '';
      toast(`${actorName}`, { description: preview });
    } else if (row.kind === 'comment_reply') {
      toast(`${actorName} replied to your comment`);
    }
    // like / follow / comment: bell only (no toast)
  }, []);

  const onBackfill = useCallback((rows: NotificationRow[]) => {
    setNotifs(rows.slice(0, 20));
    setUnread(rows.filter((r) => r.read_at === null).length);
  }, []);

  useRealtimeNotifs({ userId, onInsert, onBackfill });

  // Build enrichment maps for NotificationsPanel
  const { enrichedActors, enrichedApps, enrichedContacts, whens } = useMemo(() => {
    const actors: Record<string, NotificationItemProps['actor']> = {};
    const apps: Record<string, NotificationItemProps['app']> = {};
    const contacts: Record<string, NotificationItemProps['contact']> = {};
    const w: Record<string, string> = {};
    for (const n of notifs) {
      actors[n.id] = n.actor ? { ...n.actor, emoji: n.actor.emoji ?? '' } : null;
      apps[n.id] = n.app
        ? {
            id: n.app.id,
            slug: n.app.slug,
            title: n.app.title,
            accent_color: n.app.accent,
            cover_art_kind: n.app.art_kind,
          }
        : null;
      contacts[n.id] = n.contact_request
        ? {
            email: undefined,
            link: n.contact_request.sender_link ?? undefined,
            accepted: n.kind === 'contact_accepted',
          }
        : null;
      w[n.id] = formatWhen(n.created_at);
    }
    return { enrichedActors: actors, enrichedApps: apps, enrichedContacts: contacts, whens: w };
  }, [notifs]);

  const onAction = useCallback(
    async (id: string, action: 'accept' | 'later' | 'decline') => {
      const notif = notifs.find((n) => n.id === id);
      if (!notif || !notif.contact_request) return;
      if (action === 'accept') {
        const result = await acceptContactRequest({
          requestId: notif.contact_request.id,
          action: 'accept',
        });
        if (result.ok) {
          // Mark the notif as read locally
          setNotifs((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
          );
          setUnread((u) => Math.max(0, u - 1));
          toast.success('Contact accepted — opening conversation…');
        } else {
          toast.error('Could not accept');
        }
      } else if (action === 'decline') {
        const result = await declineContactRequest({
          requestId: notif.contact_request.id,
          action: 'decline',
        });
        if (result.ok) {
          setNotifs((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
          );
          setUnread((u) => Math.max(0, u - 1));
          toast('Declined');
        } else {
          toast.error('Could not decline');
        }
      }
      // 'later' = no-op, just close
    },
    [notifs],
  );

  const onMarkAll = useCallback(async () => {
    const result = await markAllRead();
    if (result.ok) {
      const now = new Date().toISOString();
      setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
      setUnread(0);
    }
  }, []);

  return (
    <div className="notifs-anchor">
      <button
        type="button"
        className="bell-btn"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Bell SVG glyph — simple line icon matching topbar visual weight */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      <NotificationsPanel
        open={open}
        notifs={notifs as unknown as NotificationItemProps['n'][]}
        enrichedActors={enrichedActors}
        enrichedApps={enrichedApps}
        enrichedContacts={enrichedContacts}
        whens={whens}
        onAction={onAction}
        onClose={() => setOpen(false)}
        onAll={onMarkAll}
      />
    </div>
  );
}

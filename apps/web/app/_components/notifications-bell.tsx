'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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

function useFormatWhen(): (iso: string) => string {
  const t = useTranslations('Time');
  return (iso: string) => {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return t('shortJustNow');
    if (seconds < 3600) return t('shortAgoMinutes', { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('shortAgoHours', { count: Math.floor(seconds / 3600) });
    return t('shortAgoDays', { count: Math.floor(seconds / 86400) });
  };
}

export function NotificationsBell({
  userId,
  initialUnread,
  initialNotifs,
}: NotificationsBellProps) {
  const t = useTranslations('Notifications');
  const formatWhen = useFormatWhen();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationRow[]>(initialNotifs);
  const [unread, setUnread] = useState(initialUnread);

  useUnreadTitle(unread);

  const onInsert = useCallback(
    (row: NotificationRow) => {
      setNotifs((prev) => [row, ...prev.filter((n) => n.id !== row.id)].slice(0, 20));
      setUnread((u) => u + 1);
      // Per SPEC roadmap §5.3 surfacing rules — fire toast on high-signal kinds
      const actorName = row.actor?.display_name ?? t('Someone');
      if (row.kind === 'contact_request') {
        toast(t('WantsToContactYou', { name: actorName }), {
          description: t('OpenInboxToRespond'),
        });
      } else if (row.kind === 'message') {
        const preview = (row.payload as { preview?: string }).preview ?? '';
        toast(`${actorName}`, { description: preview });
      } else if (row.kind === 'comment_reply') {
        toast(t('RepliedToYourComment', { name: actorName }));
      }
      // like / follow / comment: bell only (no toast)
    },
    [t],
  );

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
  }, [notifs, formatWhen]);

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
          toast.success(t('ContactAcceptedOpeningConversation'));
        } else {
          toast.error(t('CouldNotAccept'));
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
          toast(t('Declined'));
        } else {
          toast.error(t('CouldNotDecline'));
        }
      }
      // 'later' = no-op, just close
    },
    [notifs, t],
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
        aria-label={unread > 0 ? t('BellAriaLabelUnread', { count: unread }) : t('BellAriaLabel')}
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
        unread={unread}
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

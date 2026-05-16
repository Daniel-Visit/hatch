'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { NotificationItem, type NotificationItemProps } from '@/app/_components/notification-item';
import { useRealtimeNotifs } from '@/app/_components/use-realtime-notifs';
import { useUnreadTitle } from '@/app/_components/use-unread-title';
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
  type NotificationRow,
} from '@/lib/actions/notifications';
import { acceptContactRequest, declineContactRequest } from '@/lib/actions/contact-requests';
import { toast } from 'sonner';

type Filter = 'all' | 'unread' | 'contact' | 'message' | 'social';

type Props = {
  userId: string;
  initialRows: NotificationRow[];
  initialCursor: string | null;
  initialFilter: Filter;
};

function formatWhen(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'contact', label: 'Contact requests' },
  { id: 'message', label: 'Messages' },
  { id: 'social', label: 'Likes & follows' },
];

import type { NotificationFilterT } from '@/lib/zod/notifications';

function filterToQuery(filter: Filter): NotificationFilterT {
  if (filter === 'unread') return { unreadOnly: true };
  if (filter === 'contact') return { kind: 'contact_request' };
  if (filter === 'message') return { kind: 'message' };
  // social = like + follow + comment + comment_reply — no single kind; fetch all and filter locally
  return {};
}

function localFilter(rows: NotificationRow[], filter: Filter): NotificationRow[] {
  if (filter === 'all') return rows;
  if (filter === 'unread') return rows.filter((r) => r.read_at === null);
  if (filter === 'contact')
    return rows.filter(
      (r) =>
        r.kind === 'contact_request' ||
        r.kind === 'contact_accepted' ||
        r.kind === 'contact_declined',
    );
  if (filter === 'message') return rows.filter((r) => r.kind === 'message');
  if (filter === 'social')
    return rows.filter(
      (r) =>
        r.kind === 'like' ||
        r.kind === 'follow' ||
        r.kind === 'comment' ||
        r.kind === 'comment_reply',
    );
  return rows;
}

export function NotificationsPage({ userId, initialRows, initialCursor, initialFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<NotificationRow[]>(initialRows);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  const filter: Filter = (searchParams.get('filter') as Filter) ?? initialFilter;

  const unread = useMemo(() => rows.filter((r) => r.read_at === null).length, [rows]);
  useUnreadTitle(unread);

  const onInsert = useCallback((row: NotificationRow) => {
    setRows((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
  }, []);

  const onBackfill = useCallback((newRows: NotificationRow[]) => {
    setRows((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const fresh = newRows.filter((r) => !ids.has(r.id));
      return [...fresh, ...prev];
    });
  }, []);

  useRealtimeNotifs({ userId, onInsert, onBackfill });

  const setFilter = (next: Filter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('filter');
    else params.set('filter', next);
    const qs = params.toString();
    router.push(`/notifications${qs ? `?${qs}` : ''}` as Route);
  };

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    const result = await getNotifications({ ...filterToQuery(filter), cursor });
    setLoading(false);
    if (!result.ok) {
      toast.error('Could not load more');
      return;
    }
    setRows((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const fresh = result.data.rows.filter((r) => !ids.has(r.id));
      return [...prev, ...fresh];
    });
    setCursor(result.data.nextCursor);
  };

  const onItemClick = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.read_at !== null) return;
    // Optimistic update
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read_at: now } : r)));
    const result = await markNotificationRead({ id });
    if (!result.ok) {
      // Revert on error
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read_at: null } : r)));
      toast.error('Could not mark as read');
    }
  };

  const onMarkAll = async () => {
    const result = await markAllRead();
    if (result.ok) {
      const now = new Date().toISOString();
      setRows((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? now })));
      toast.success('Inbox cleared');
    }
  };

  const onAction = async (id: string, action: 'accept' | 'later' | 'decline') => {
    const row = rows.find((r) => r.id === id);
    if (!row?.contact_request) return;
    if (action === 'accept') {
      const result = await acceptContactRequest({
        requestId: row.contact_request.id,
        action: 'accept',
      });
      if (result.ok) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)),
        );
        toast.success('Accepted — opening conversation…');
        router.push(`/messages/${result.data.conversationId}` as Route);
      } else {
        toast.error('Could not accept');
      }
    } else if (action === 'decline') {
      const result = await declineContactRequest({
        requestId: row.contact_request.id,
        action: 'decline',
      });
      if (result.ok) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)),
        );
        toast('Declined');
      }
    }
    // 'later' is a no-op — user dismissed the action but doesn't want to act yet
  };

  const visible = localFilter(rows, filter);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Inbox</h1>
        {unread > 0 && (
          <button type="button" className="btn btn-ghost-2" onClick={() => void onMarkAll()}>
            Mark all read
          </button>
        )}
      </header>

      <nav
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: filter === f.id ? 'var(--surface-2)' : 'transparent',
              fontWeight: filter === f.id ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p style={{ color: 'var(--text-2)', padding: 32, textAlign: 'center' }}>
          No notifications yet.
        </p>
      ) : (
        <ul className="notifs-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visible.map((n) => (
            <div key={n.id} onClick={() => void onItemClick(n.id)} style={{ cursor: 'pointer' }}>
              <NotificationItem
                n={n as unknown as NotificationItemProps['n']}
                actor={n.actor ? { ...n.actor, emoji: n.actor.emoji ?? '' } : null}
                app={
                  n.app
                    ? {
                        id: n.app.id,
                        slug: n.app.slug,
                        title: n.app.title,
                        accent_color: n.app.accent,
                        cover_art_kind: n.app.art_kind,
                      }
                    : null
                }
                contact={
                  n.contact_request
                    ? {
                        link: n.contact_request.sender_link ?? undefined,
                        accepted: n.kind === 'contact_accepted',
                      }
                    : null
                }
                when={formatWhen(n.created_at)}
                onAction={onAction}
              />
            </div>
          ))}
        </ul>
      )}

      {cursor && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-ghost-2"
            onClick={() => void loadMore()}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </main>
  );
}

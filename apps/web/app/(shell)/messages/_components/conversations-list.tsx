'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';

export type ConversationListItem = {
  id: string;
  other: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    hue: number;
    emoji: string | null;
  } | null;
  lastMessage: { body: string; createdAt: string } | null;
  unread: number;
};

type Props = {
  items: ConversationListItem[];
  activeId: string | null;
};

function useFormatTime() {
  const tTime = useTranslations('Time');
  return (iso: string | null | undefined): string => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return tTime('now');
    if (ms < 3_600_000) return tTime('shortMinutes', { count: Math.floor(ms / 60_000) });
    if (ms < 86_400_000) return tTime('shortHours', { count: Math.floor(ms / 3_600_000) });
    return tTime('shortDays', { count: Math.floor(ms / 86_400_000) });
  };
}

export function ConversationsList({ items, activeId }: Props) {
  const t = useTranslations('Messages');
  const formatTime = useFormatTime();

  return (
    <aside
      style={{
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        background: 'var(--surface)',
      }}
    >
      <header style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('Title')}</h2>
      </header>
      {items.length === 0 ? (
        <p style={{ padding: '16px', color: 'var(--text-2)' }}>{t('EmptyConversations')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id}>
                <Link
                  href={`/messages/${item.id}` as Route}
                  style={{
                    display: 'block',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: isActive ? 'var(--surface-2)' : 'transparent',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 4,
                    }}
                  >
                    <strong style={{ fontSize: '0.9rem' }}>
                      {item.other?.display_name ?? t('UnknownUser')}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                      {formatTime(item.lastMessage?.createdAt ?? null)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 220,
                      }}
                    >
                      {item.lastMessage?.body ?? t('NoMessagesYet')}
                    </span>
                    {item.unread > 0 && (
                      <span
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: 999,
                        }}
                      >
                        {item.unread}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

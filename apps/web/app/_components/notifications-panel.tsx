'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { NotificationItem, type NotificationItemProps } from './notification-item';

export type NotificationsPanelProps = {
  open: boolean;
  unread: number;
  notifs: NotificationItemProps['n'][];
  enrichedActors: Record<string, NotificationItemProps['actor']>;
  enrichedApps: Record<string, NotificationItemProps['app']>;
  enrichedContacts: Record<string, NotificationItemProps['contact']>;
  whens: Record<string, string>;
  onAction: NotificationItemProps['onAction'];
  onClose: () => void;
  onAll: () => void;
};

export function NotificationsPanel({
  open,
  unread,
  notifs,
  enrichedActors,
  enrichedApps,
  enrichedContacts,
  whens,
  onAction,
  onClose,
  onAll,
}: NotificationsPanelProps) {
  const t = useTranslations('Notifications');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', onDown);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="notifs" ref={ref} role="dialog" aria-label={t('BellAriaLabel')}>
      <header className="notifs-head">
        <h3>{t('PanelTitle')}</h3>
        {unread > 0 && (
          <button
            type="button"
            className="notifs-badge"
            onClick={onAll}
            aria-label={t('MarkAllReadAria', { count: unread })}
            title={t('MarkAllRead')}
          >
            {unread > 99 ? '99+' : unread}
          </button>
        )}
      </header>
      {notifs.length === 0 ? (
        <p className="notifs-empty">{t('Empty')}</p>
      ) : (
        <ul className="notifs-list">
          {notifs.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              actor={enrichedActors[n.id] ?? null}
              app={enrichedApps[n.id] ?? null}
              contact={enrichedContacts[n.id] ?? null}
              when={whens[n.id] ?? ''}
              onAction={onAction}
              onNavigate={onClose}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

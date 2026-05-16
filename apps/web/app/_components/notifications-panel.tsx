'use client';

import { useEffect, useRef, useState } from 'react';
import { NotificationItem, type NotificationItemProps } from './notification-item';

export type NotificationsPanelProps = {
  open: boolean;
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
  notifs,
  enrichedActors,
  enrichedApps,
  enrichedContacts,
  whens,
  onAction,
  onClose,
  onAll,
}: NotificationsPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'all' | 'contact'>('all');

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

  const contactList = notifs.filter((n) => n.kind === 'contact_request');
  const list = tab === 'all' ? notifs : contactList;

  return (
    <div className="notifs" ref={ref} role="dialog" aria-label="Notifications">
      <header className="notifs-head">
        <h3>Inbox</h3>
        <button className="notifs-all" onClick={onAll}>
          Mark all read
        </button>
      </header>
      <div className="notifs-tabs">
        <button
          className={'notifs-tab ' + (tab === 'all' ? 'is-on' : '')}
          onClick={() => setTab('all')}
        >
          All <span className="notifs-tab-c">{notifs.length}</span>
        </button>
        <button
          className={'notifs-tab ' + (tab === 'contact' ? 'is-on' : '')}
          onClick={() => setTab('contact')}
        >
          Contact requests
          <span className="notifs-tab-c">{contactList.length}</span>
        </button>
      </div>
      <ul className="notifs-list">
        {list.map((n) => (
          <NotificationItem
            key={n.id}
            n={n}
            actor={enrichedActors[n.id] ?? null}
            app={enrichedApps[n.id] ?? null}
            contact={enrichedContacts[n.id] ?? null}
            when={whens[n.id] ?? ''}
            onAction={onAction}
          />
        ))}
      </ul>
      <footer className="notifs-foot">
        Only people you accept can email you. Decline keeps your inbox tidy.
      </footer>
    </div>
  );
}

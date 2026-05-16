'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from './cards';

export type NotificationKind =
  | 'contact_request'
  | 'contact_accepted'
  | 'contact_declined'
  | 'like'
  | 'comment'
  | 'comment_reply'
  | 'follow'
  | 'message';

export type NotificationActor = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  hue: number;
  emoji: string;
};

export type NotificationApp = {
  id: string;
  slug: string;
  title: string;
  accent_color: string;
  cover_art_kind: string;
};

export type NotificationContact = {
  email?: string;
  link?: string;
  accepted?: boolean;
};

export type NotificationData = {
  id: string;
  kind: NotificationKind;
  created_at: string;
  read_at: string | null;
  payload: { role?: string; note?: string; body?: string; preview?: string };
};

export type NotificationItemProps = {
  n: NotificationData;
  actor: NotificationActor | null;
  app: NotificationApp | null;
  contact: NotificationContact | null;
  when: string;
  onAction: (id: string, action: 'accept' | 'later' | 'decline') => void;
};

export function NotificationItem({
  n,
  actor,
  app,
  contact,
  when,
  onAction,
}: NotificationItemProps) {
  const t = useTranslations('Notifications');
  const tBody = useTranslations('Notifications.body');
  const u = actor ?? { handle: '', display_name: '', avatar_url: null, hue: 200, emoji: '◇' };

  if (n.kind === 'contact_request') {
    const role = n.payload.role ?? '';
    const note = n.payload.note ?? '';
    const c = contact ?? {};
    return (
      <li className={'notif notif-contact ' + (n.read_at == null ? 'is-unread' : '')}>
        <Avatar user={u} size={40} />
        <div className="notif-body">
          <div className="notif-head">
            <span>
              <b>{u.display_name}</b>
              <span className="notif-role" data-role={role.toLowerCase()}>
                {role}
              </span>
            </span>
            <span className="notif-when">{when}</span>
          </div>
          <div className="notif-meta">
            {t('WantsToContactYouAbout')}{' '}
            <span className="notif-app">
              <i className="notif-app-dot" style={{ background: app?.accent_color }} />
              <b>{app?.title}</b>
            </span>
          </div>
          <p className="notif-note">&quot;{note}&quot;</p>
          {c.accepted ? (
            <div className="notif-accepted">
              <svg
                viewBox="0 0 16 16"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m4 8 3 3 5-6" />
              </svg>
              {t('YouAccepted')} <a href={`mailto:${c.email}`}>{c.email}</a>
            </div>
          ) : (
            <div className="notif-contact-info">
              <span>
                <b>{t('EmailLabel')}</b> {c.email}
              </span>
              <span>
                <b>{t('LinkLabel')}</b> {c.link}
              </span>
            </div>
          )}
          {!c.accepted && (
            <div className="notif-actions">
              <button
                className="btn btn-publish notif-btn"
                onClick={() => onAction(n.id, 'accept')}
              >
                {t('AcceptAndReply')}
              </button>
              <button className="btn btn-ghost-2 notif-btn" onClick={() => onAction(n.id, 'later')}>
                {t('MaybeLater')}
              </button>
              <button
                className="notif-x"
                title={t('DeclineTitle')}
                onClick={() => onAction(n.id, 'decline')}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  const title = app?.title ?? '';
  const name = u.display_name;
  const actorTag = { actor: (chunks: React.ReactNode) => <b>{chunks}</b> };
  let body: React.ReactNode = null;
  switch (n.kind) {
    case 'like':
      body = tBody.rich('like', { ...actorTag, name, app: title });
      break;
    case 'comment':
      body = tBody.rich('comment', { ...actorTag, name, app: title });
      break;
    case 'comment_reply':
      body = tBody.rich('comment_reply', { ...actorTag, name, app: title });
      break;
    case 'follow':
      body = tBody.rich('follow', { ...actorTag, name });
      break;
    case 'contact_accepted':
      body = tBody.rich('contact_accepted', { ...actorTag, name });
      break;
    case 'contact_declined':
      body = tBody.rich('contact_declined', { ...actorTag, name });
      break;
    case 'message':
      body = tBody.rich('message', { ...actorTag, name, preview: n.payload.preview ?? '' });
      break;
  }

  return (
    <li className={'notif notif-mini ' + (n.read_at == null ? 'is-unread' : '')}>
      <Avatar user={u} size={32} />
      <div className="notif-body">
        <p className="notif-mini-text">{body}</p>
        <span className="notif-when">{when}</span>
      </div>
    </li>
  );
}

export default NotificationItem;

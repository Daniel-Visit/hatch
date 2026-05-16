'use client';

import React from 'react';
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
            wants to contact you about{' '}
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
              You accepted · <a href={`mailto:${c.email}`}>{c.email}</a>
            </div>
          ) : (
            <div className="notif-contact-info">
              <span>
                <b>Email:</b> {c.email}
              </span>
              <span>
                <b>Link:</b> {c.link}
              </span>
            </div>
          )}
          {!c.accepted && (
            <div className="notif-actions">
              <button
                className="btn btn-publish notif-btn"
                onClick={() => onAction(n.id, 'accept')}
              >
                Accept & reply
              </button>
              <button className="btn btn-ghost-2 notif-btn" onClick={() => onAction(n.id, 'later')}>
                Maybe later
              </button>
              <button className="notif-x" title="Decline" onClick={() => onAction(n.id, 'decline')}>
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
  let text = '';
  switch (n.kind) {
    case 'like':
      text = ' liked ' + title + '.';
      break;
    case 'comment':
      text = ' commented on ' + title + '.';
      break;
    case 'comment_reply':
      text = ' replied to your comment on ' + title + '.';
      break;
    case 'follow':
      text = ' followed you.';
      break;
    case 'contact_accepted':
      text = ' accepted your contact request.';
      break;
    case 'contact_declined':
      text = ' declined your contact request.';
      break;
    case 'message':
      text = ' sent you a message: "' + (n.payload.preview || '') + '"';
      break;
  }

  return (
    <li className={'notif notif-mini ' + (n.read_at == null ? 'is-unread' : '')}>
      <Avatar user={u} size={32} />
      <div className="notif-body">
        <p className="notif-mini-text">
          <b>{u.display_name}</b> {text}
        </p>
        <span className="notif-when">{when}</span>
      </div>
    </li>
  );
}

export default NotificationItem;

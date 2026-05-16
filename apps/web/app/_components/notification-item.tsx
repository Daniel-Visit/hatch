'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';

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
  onNavigate?: () => void;
};

function initials(name: string, handle: string): string {
  const source = (name || '').trim() || handle.replace(/[._-]/g, ' ');
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function NotifAvatar({ user }: { user: NotificationActor }) {
  return (
    <span
      className="notif-avatar"
      style={{
        background: `oklch(72% 0.15 ${user.hue})`,
      }}
      aria-hidden
    >
      {initials(user.display_name, user.handle)}
    </span>
  );
}

function Glyph({ kind, unread }: { kind: NotificationKind; unread: boolean }) {
  if ((kind === 'contact_request' || kind === 'message') && unread) {
    return <span className="notif-pill-new">new</span>;
  }
  switch (kind) {
    case 'like':
      return (
        <span className="notif-glyph notif-glyph-filled" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z" />
          </svg>
        </span>
      );
    case 'comment':
    case 'comment_reply':
      return (
        <span className="notif-glyph" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      );
    case 'follow':
      return (
        <span className="notif-glyph" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="17" y1="11" x2="23" y2="11" />
          </svg>
        </span>
      );
    case 'message':
      return (
        <span className="notif-glyph" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </span>
      );
    case 'contact_accepted':
      return (
        <span className="notif-glyph notif-glyph-success" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    case 'contact_request':
    case 'contact_declined':
    default:
      return (
        <span className="notif-glyph" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.6c0-2 2.2-4 5-4s5 2 5 4" />
          </svg>
        </span>
      );
  }
}

export function NotificationItem({
  n,
  actor,
  app,
  contact,
  when,
  onAction,
  onNavigate,
}: NotificationItemProps) {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const u = actor ?? {
    handle: '',
    display_name: '',
    avatar_url: null,
    hue: 200,
    emoji: '◇',
  };
  const unread = n.read_at == null;
  const isContactRequest = n.kind === 'contact_request';
  const isExpandable = isContactRequest && !contact?.accepted;

  // Build first-line body per kind: "<b>{handle}</b> {actionText}"
  const handleBold = <b>{u.display_name || u.handle}</b>;
  let line1: React.ReactNode = null;
  let line2: React.ReactNode = null;

  switch (n.kind) {
    case 'like':
      line1 = (
        <>
          {handleBold} {t('ActionLiked')}
        </>
      );
      line2 = app ? `${app.title} · ${when}` : when;
      break;
    case 'comment':
    case 'comment_reply':
      line1 = (
        <>
          {handleBold} {n.kind === 'comment_reply' ? t('ActionRepliedToYou') : t('ActionCommented')}
        </>
      );
      line2 = n.payload.body || n.payload.preview || (app ? `${app.title} · ${when}` : when);
      break;
    case 'follow':
      line1 = (
        <>
          {handleBold} {t('ActionFollowed')}
        </>
      );
      line2 = when;
      break;
    case 'message':
      line1 = (
        <>
          {handleBold} {t('ActionSentMessage')}
        </>
      );
      line2 = n.payload.preview || when;
      break;
    case 'contact_request':
      line1 = (
        <>
          {handleBold} {t('ActionWantsToContact')}
        </>
      );
      line2 = app ? `${app.title} · ${when}` : when;
      break;
    case 'contact_accepted':
      line1 = (
        <>
          {handleBold} {t('ActionAccepted')}
        </>
      );
      line2 = when;
      break;
    case 'contact_declined':
      line1 = (
        <>
          {handleBold} {t('ActionDeclined')}
        </>
      );
      line2 = when;
      break;
  }

  const handleClick = () => {
    if (isExpandable) {
      setExpanded((v) => !v);
      return;
    }
    // Navigate to relevant destination
    let href: string | null = null;
    switch (n.kind) {
      case 'like':
      case 'comment':
      case 'comment_reply':
      case 'contact_request':
        if (app) href = `/a/${app.slug}`;
        break;
      case 'follow':
        if (u.handle) href = `/u/${u.handle}`;
        break;
      case 'message':
      case 'contact_accepted':
        href = '/messages';
        break;
    }
    if (href) {
      router.push(href as Route);
      onNavigate?.();
    }
  };

  return (
    <li
      className={
        'notif notif-row ' +
        (unread ? 'is-unread ' : '') +
        (expanded ? 'is-expanded ' : '') +
        (isExpandable ? 'is-clickable ' : 'is-clickable')
      }
    >
      <button
        type="button"
        className="notif-trigger"
        onClick={handleClick}
        aria-expanded={isExpandable ? expanded : undefined}
      >
        <NotifAvatar user={u} />
        <div className="notif-body">
          <p className="notif-line1">{line1}</p>
          <p className="notif-line2">{line2}</p>
        </div>
        <Glyph kind={n.kind} unread={unread} />
      </button>

      {isExpandable && expanded && (
        <div className="notif-expand">
          {n.payload.note && <p className="notif-note">&quot;{n.payload.note}&quot;</p>}
          {(contact?.email || contact?.link) && (
            <div className="notif-contact-info">
              {contact?.email && (
                <span>
                  <b>{t('EmailLabel')}</b> {contact.email}
                </span>
              )}
              {contact?.link && (
                <span>
                  <b>{t('LinkLabel')}</b> {contact.link}
                </span>
              )}
            </div>
          )}
          <div className="notif-actions">
            <button
              className="btn btn-publish notif-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAction(n.id, 'accept');
                setExpanded(false);
              }}
            >
              {t('AcceptAndReply')}
            </button>
            <button
              className="btn btn-ghost-2 notif-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAction(n.id, 'later');
                setExpanded(false);
              }}
            >
              {t('MaybeLater')}
            </button>
            <button
              className="notif-x"
              title={t('DeclineTitle')}
              onClick={(e) => {
                e.stopPropagation();
                onAction(n.id, 'decline');
                setExpanded(false);
              }}
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
        </div>
      )}
    </li>
  );
}

export default NotificationItem;

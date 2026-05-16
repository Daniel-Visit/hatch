'use client';

// Contact request modal — verbatim port of prototype/apps-gallery/contact.jsx:23-220.
//
// Flow:
//   1. Investor clicks "Contact me" on app detail
//   2. ContactModal opens — explains privacy, lets them add a personal note,
//      pick their role (Investor / Builder / Partner / Hiring), include
//      links (LinkedIn, firm site), and tick a consent box
//   3. On submit → success state showing what was sent + when to expect reply
//
// Presentation-only: parent wires onSubmit to the sendContactRequest server action.

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from './cards';
import { AppArt } from './app-art';

type ContactRole = 'investor' | 'partner' | 'hire' | 'fan';

const ROLE_IDS = ['investor', 'partner', 'hire', 'fan'] as const;

export type ContactModalApp = {
  id: string;
  title: string;
  slug: string;
  accent: string;
  art_kind: string;
};

export type ContactModalUser = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  hue: number;
  emoji: string | null;
};

export type ContactModalProps = {
  open: boolean;
  app: ContactModalApp | null;
  author: ContactModalUser | null;
  viewer: ContactModalUser | null;
  onClose: () => void;
  onSubmit: (payload: { role: ContactRole; note: string; link: string }) => Promise<void>;
};

export function ContactModal({ open, app, author, viewer, onClose, onSubmit }: ContactModalProps) {
  const t = useTranslations('Contact');
  const tRole = useTranslations('Contact.role');
  const tRoleSub = useTranslations('Contact.roleSub');
  const [stage, setStage] = useState<'compose' | 'done'>('compose');
  const [role, setRole] = useState<ContactRole>('investor');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStage('compose');
      setRole('investor');
      setNote('');
      setLink('');
      setConsent(false);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !app || !author || !viewer) return null;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ role, note, link });
      setStage('done');
    } catch {
      setError(t('Failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Avatar from ./cards expects a User with non-null emoji; provide a safe default.
  const viewerForAvatar = { ...viewer, emoji: viewer.emoji ?? '◇' };

  return (
    <div className="cmodal-scrim" onClick={onClose}>
      <div
        className="cmodal"
        onClick={(e) => e.stopPropagation()}
        style={{ '--ax': app.accent } as React.CSSProperties}
      >
        <button className="cmodal-x" onClick={onClose} aria-label={t('CloseAria')}>
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>

        {stage === 'compose' && (
          <>
            <header className="cmodal-head">
              <div className="cmodal-art">
                <AppArt kind={app.art_kind} accent={app.accent} glyphSize={36} />
              </div>
              <div>
                <h2>
                  {t.rich('Title', {
                    name: author.display_name.split(' ')[0],
                    b: (chunks) => <b>{chunks}</b>,
                  })}
                </h2>
                <p>
                  {t.rich('About', {
                    app: app.title,
                    i: (chunks) => <i>{chunks}</i>,
                  })}
                </p>
              </div>
            </header>

            <div className="cmodal-body">
              <section className="cm-sect">
                <h4 className="cm-h">{t('WhosReachingOut')}</h4>
                <div className="cm-me">
                  <Avatar user={viewerForAvatar} size={36} />
                  <div className="cm-me-id">
                    <b>{viewer.display_name}</b>
                    <i>{viewer.handle} · slope.fund</i>
                  </div>
                  <span className="cm-me-edit">{t('EditProfile')}</span>
                </div>
              </section>

              <section className="cm-sect">
                <h4 className="cm-h">{t('WhyAreYouReachingOut')}</h4>
                <div className="cm-roles">
                  {ROLE_IDS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={'cm-role ' + (role === r ? 'is-on' : '')}
                      onClick={() => setRole(r)}
                    >
                      <span className="cm-role-dot" />
                      <b>{tRole(r)}</b>
                      <i>{tRoleSub(r)}</i>
                    </button>
                  ))}
                </div>
              </section>

              <section className="cm-sect">
                <h4 className="cm-h">
                  {t('YourMessage')} <i className="cm-h-opt">{t('Optional')}</i>
                </h4>
                <textarea
                  className="cm-textarea"
                  rows={4}
                  maxLength={400}
                  placeholder={t('MessagePlaceholder', {
                    name: author.display_name.split(' ')[0],
                    app: app.title,
                  })}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="cm-counter">{t('Counter', { count: note.length })}</div>
              </section>

              <section className="cm-sect">
                <h4 className="cm-h">
                  {t('AddLink')} <i className="cm-h-opt">{t('AddLinkHint')}</i>
                </h4>
                <input
                  className="cm-input"
                  type="url"
                  placeholder={t('LinkPlaceholder')}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </section>

              <section className="cm-warn">
                <span className="cm-warn-glyph">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v3.5M8 11v.1" />
                  </svg>
                </span>
                <div>
                  <b>{t('HeadsUpTitle')}</b>
                  <p>
                    {t.rich('HeadsUpBody', {
                      name: author.display_name,
                      email: viewer.handle.replace('@', ''),
                      b: (chunks) => <b>{chunks}</b>,
                    })}
                  </p>
                </div>
              </section>

              <label className="cm-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  {t.rich('ConsentLabel', {
                    name: author.display_name,
                    role: tRole(role).toLowerCase(),
                    b: (chunks) => <b>{chunks}</b>,
                  })}
                </span>
              </label>
            </div>

            <footer className="cmodal-foot">
              {error && (
                <div className="cm-warn" style={{ color: 'crimson' }}>
                  <span className="cm-warn-glyph">
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="8" cy="8" r="6" />
                      <path d="M8 5v3.5M8 11v.1" />
                    </svg>
                  </span>
                  <div>{error}</div>
                </div>
              )}
              <button className="btn btn-ghost-2" onClick={onClose}>
                {t('Cancel')}
              </button>
              <button
                className="btn btn-publish"
                disabled={!consent || submitting}
                onClick={submit}
              >
                {submitting ? t('Sending') : t('Send')}
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </button>
            </footer>
          </>
        )}

        {stage === 'done' && (
          <>
            <div className="cm-done">
              <span className="cm-done-bubble" style={{ background: app.accent }}>
                <svg
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 4 4L19 8" />
                </svg>
              </span>
              <h2>{t('RequestSentToName', { name: author.display_name.split(' ')[0] })}</h2>
              <p>
                {t.rich('RepliesWithin', {
                  name: author.display_name,
                  b: (chunks) => <b>{chunks}</b>,
                })}
              </p>
              <div className="cm-done-card">
                <header>
                  <span className="cm-done-tag" style={{ background: app.accent }}>
                    {tRole(role)}
                  </span>
                  <span className="cm-done-when">{t('JustNow')}</span>
                </header>
                <p>
                  {note.trim() ||
                    t('DefaultMessage', {
                      name: author.display_name.split(' ')[0],
                      app: app.title,
                    })}
                </p>
                <footer>
                  <Avatar user={viewerForAvatar} size={20} />
                  <span>
                    <b>{viewer.display_name}</b> · {viewer.handle}
                  </span>
                </footer>
              </div>
              <div className="cm-done-actions">
                <button className="btn btn-ghost-2" onClick={onClose}>
                  {t('Close')}
                </button>
                <button className="btn btn-publish" onClick={onClose}>
                  {t('Done')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

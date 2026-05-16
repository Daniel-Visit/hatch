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
import { Avatar } from './cards';
import { AppArt } from './app-art';

type ContactRole = 'investor' | 'partner' | 'hire' | 'fan';

const ROLES = [
  { id: 'investor', label: 'Investor', sub: 'Looking to invest in this builder' },
  { id: 'partner', label: 'Partner / Collaborator', sub: 'Want to build something together' },
  { id: 'hire', label: 'Hiring', sub: 'Have a job or freelance gig' },
  { id: 'fan', label: 'Just a fan', sub: 'Cheering or feedback' },
] as const;

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

  const roleObj = ROLES.find((r) => r.id === role)!;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ role, note, link });
      setStage('done');
    } catch {
      setError('Failed to send. Try again.');
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
        <button className="cmodal-x" onClick={onClose} aria-label="Close">
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
                  Contact <b>{author.display_name.split(' ')[0]}</b>
                </h2>
                <p>
                  about <i>{app.title}</i>
                </p>
              </div>
            </header>

            <div className="cmodal-body">
              <section className="cm-sect">
                <h4 className="cm-h">Who&apos;s reaching out</h4>
                <div className="cm-me">
                  <Avatar user={viewerForAvatar} size={36} />
                  <div className="cm-me-id">
                    <b>{viewer.display_name}</b>
                    <i>{viewer.handle} · slope.fund</i>
                  </div>
                  <span className="cm-me-edit">Edit profile →</span>
                </div>
              </section>

              <section className="cm-sect">
                <h4 className="cm-h">Why are you reaching out?</h4>
                <div className="cm-roles">
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={'cm-role ' + (role === r.id ? 'is-on' : '')}
                      onClick={() => setRole(r.id)}
                    >
                      <span className="cm-role-dot" />
                      <b>{r.label}</b>
                      <i>{r.sub}</i>
                    </button>
                  ))}
                </div>
              </section>

              <section className="cm-sect">
                <h4 className="cm-h">
                  Your message <i className="cm-h-opt">optional</i>
                </h4>
                <textarea
                  className="cm-textarea"
                  rows={4}
                  maxLength={400}
                  placeholder={`Hi ${author.display_name.split(' ')[0]}, I lead pre-seed at Slope Partners. Loved ${app.title} — would love 25 mins to learn how you're thinking about it…`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="cm-counter">{note.length}/400</div>
              </section>

              <section className="cm-sect">
                <h4 className="cm-h">
                  Add a link <i className="cm-h-opt">optional · LinkedIn, fund site, portfolio</i>
                </h4>
                <input
                  className="cm-input"
                  type="url"
                  placeholder="https://"
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
                  <b>Heads up — this shares your contact info.</b>
                  <p>
                    If <b>{author.display_name}</b> accepts, they&apos;ll see your name, handle,
                    email ({viewer.handle.replace('@', '')}@hatch.dev), profile, and the link above.
                    They can reply directly. You can revoke access anytime.
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
                  I&apos;m sharing my contact details with <b>{author.display_name}</b> for the
                  purpose of this <b>{roleObj.label.toLowerCase()}</b> inquiry.
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
                Cancel
              </button>
              <button
                className="btn btn-publish"
                disabled={!consent || submitting}
                onClick={submit}
              >
                {submitting ? 'Sending…' : 'Send request'}
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
              <h2>Request sent to {author.display_name.split(' ')[0]}</h2>
              <p>
                {author.display_name} typically replies within <b>1–2 days</b>. We&apos;ll notify
                you when they accept or decline.
              </p>
              <div className="cm-done-card">
                <header>
                  <span className="cm-done-tag" style={{ background: app.accent }}>
                    {roleObj.label}
                  </span>
                  <span className="cm-done-when">Just now</span>
                </header>
                <p>
                  {note.trim() ||
                    `Hi ${author.display_name.split(' ')[0]}, I'd love to chat about ${app.title}.`}
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
                  Close
                </button>
                <button className="btn btn-publish" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

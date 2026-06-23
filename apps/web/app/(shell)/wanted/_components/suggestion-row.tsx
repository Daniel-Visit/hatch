'use client';

// One Validator suggestion on the Brief Health Card (§4.4.5 / §3.4.8).
//
// States:
//   - PENDING: path + weak badge, diagnosis, the `exampleBetter` "Try" block,
//     and [Dismiss] [Apply] buttons.
//   - editing: Apply opens the example in-place inside the card (don't navigate
//     away). The seeker accepts as-is or edits before saving.
//   - APPLIED: collapses to "✓ Applied" with the applied value shown ("Now").
//
// Verbatim prototype-port of the `.suggestion-card*` markup from
// new/mockups.html (#healthcard). No Tailwind.

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type SuggestionView = {
  id: string;
  sectionPath: string;
  diagnosis: string;
  exampleBetter: string;
  status: 'PENDING' | 'APPLIED' | 'DISMISSED' | 'AUTO_DISMISSED';
  /** The value the seeker saved when applying (APPLIED only). */
  appliedValue?: string | null;
};

type SuggestionRowProps = {
  suggestion: SuggestionView;
  busy: boolean;
  onApply: (id: string, customValue: string) => void;
  onDismiss: (id: string) => void;
};

export function SuggestionRow({ suggestion, busy, onApply, onDismiss }: SuggestionRowProps) {
  const t = useTranslations('Wanted.HealthCard');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(suggestion.exampleBetter);

  // ── APPLIED — collapsed confirmation ──
  if (suggestion.status === 'APPLIED') {
    return (
      <article className="suggestion-card is-applied">
        <header className="suggestion-card-head">
          <span className="path">{suggestion.sectionPath}</span>
          <span className="applied-marker">{t('suggestionApplied')}</span>
        </header>
        <div className="suggestion-card-example">
          {suggestion.appliedValue ?? suggestion.exampleBetter}
        </div>
      </article>
    );
  }

  // ── editing — inline edit pre-filled with exampleBetter ──
  if (editing) {
    return (
      <article className="suggestion-card">
        <header className="suggestion-card-head">
          <span className="path">{suggestion.sectionPath}</span>
          <span className="badge health-badge-weak">weak</span>
        </header>
        <div className="suggestion-card-example" style={{ fontStyle: 'normal' }}>
          <textarea
            className="inline-edit-input"
            rows={3}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <footer className="suggestion-card-foot">
          <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
            {t('suggestionDismiss')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onApply(suggestion.id, value)}
            disabled={busy || value.trim().length === 0}
          >
            {t('suggestionApply')}
          </button>
        </footer>
      </article>
    );
  }

  // ── PENDING — diagnosis + example + actions ──
  return (
    <article className="suggestion-card">
      <header className="suggestion-card-head">
        <span className="path">{suggestion.sectionPath}</span>
        <span className="badge health-badge-weak">weak</span>
      </header>
      <p className="suggestion-card-diagnosis">{suggestion.diagnosis}</p>
      <div className="suggestion-card-example">{suggestion.exampleBetter}</div>
      <footer className="suggestion-card-foot">
        <button className="btn btn-ghost" onClick={() => onDismiss(suggestion.id)} disabled={busy}>
          {t('suggestionDismiss')}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            setValue(suggestion.exampleBetter);
            setEditing(true);
          }}
          disabled={busy}
        >
          {t('suggestionApply')}
        </button>
      </footer>
    </article>
  );
}

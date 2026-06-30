'use client';

// Mode picker (§4.4.0). Three cards — Talk to AI / Fill it in / Paste a brief.
// Clicking a card routes to /wanted/new/{chat,form,paste}. The last choice is
// remembered via localStorage and re-highlighted on return (but all three are
// always shown — never hidden).
//
// Verbatim prototype-port: uses the `.mode-picker` / `.mode-card*` class names
// already defined in apps/web/app/styles/wanted.css. No Tailwind.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';

type Mode = 'chat' | 'form' | 'paste';

const STORAGE_KEY = 'wanted.lastMode';
const MODES: Mode[] = ['chat', 'form', 'paste'];

// Glyphs mirror the mode-card-glyph aesthetic in the mockups (single symbol).
const GLYPHS: Record<Mode, string> = {
  chat: '⬢',
  form: '▤',
  paste: '❏',
};

// A vivid generative-art gradient per mode (landing-style colour energy).
const ART: Record<Mode, string> = {
  chat: 'linear-gradient(135deg, #a855f7, #ec4899)',
  form: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
  paste: 'linear-gradient(135deg, #f97316, #f59e0b)',
};

// Map each mode to its i18n namespace under Wanted.ModePicker.
const I18N_KEY: Record<Mode, 'Chat' | 'Form' | 'Paste'> = {
  chat: 'Chat',
  form: 'Form',
  paste: 'Paste',
};

export function ModePicker() {
  const t = useTranslations('Wanted.ModePicker');
  const router = useRouter();

  // The last-chosen mode is loaded after mount (localStorage is client-only).
  const [lastMode, setLastMode] = useState<Mode | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'chat' || stored === 'form' || stored === 'paste') {
        setLastMode(stored);
      }
    } catch {
      // localStorage may be unavailable (privacy mode); silently ignore.
    }
  }, []);

  function choose(mode: Mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Persistence is best-effort; navigation proceeds regardless.
    }
    router.push(`/wanted/new/${mode}` as Route);
  }

  return (
    <div className="mode-wrap">
      <div className="mode-bg" aria-hidden />

      <div className="mode-head">
        <span className="mode-eyebrow">
          <span className="dot" />
          Brief &amp; Match
        </span>
        <h1>
          <span className="grad">{t('pageTitle')}</span>
        </h1>
        <p>{t('pageSubtitle')}</p>
      </div>

      <div className="mode-picker">
        {MODES.map((mode) => {
          const key = I18N_KEY[mode];
          return (
            <button
              key={mode}
              className={`mode-card${lastMode === mode ? ' is-selected' : ''}`}
              onClick={() => choose(mode)}
              type="button"
            >
              <div className="mode-card-art" style={{ '--grad': ART[mode] } as React.CSSProperties}>
                {mode === 'chat' && <span className="mode-card-badge">{t('recommended')}</span>}
                <span className="mode-card-glyph">{GLYPHS[mode]}</span>
              </div>
              <div className="mode-card-body">
                <h3>{t(`${key}.title`)}</h3>
                <p className="mode-card-desc">{t(`${key}.body`)}</p>
                <span className="mode-card-best-for">{t(`${key}.bestFor`)}</span>
                <span className="mode-card-go">{t('start')} →</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

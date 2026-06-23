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
    <>
      <div className="refiner-head">
        <h1>{t('pageTitle')}</h1>
      </div>
      <p
        style={{
          margin: '0 auto',
          maxWidth: 900,
          color: 'var(--muted)',
          fontSize: '13px',
          padding: '0 0 4px',
        }}
      >
        {t('pageSubtitle')}
      </p>

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
              <span className="mode-card-glyph">{GLYPHS[mode]}</span>
              <h3>{t(`${key}.title`)}</h3>
              <p>{t(`${key}.body`)}</p>
              <span className="mode-card-best-for">{t(`${key}.bestFor`)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

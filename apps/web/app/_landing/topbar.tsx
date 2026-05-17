'use client';

// Hatch landing topbar — verbatim port of /tmp/hatch-landing-v2/src/sections-1.jsx Topbar (lines 9-32).
// Two functional changes vs the prototype:
//   1) Uses the shared `useTheme` from `_components/theme-controller` so theme state persists
//      across landing ↔ shell navigation (the prototype used local useState).
//   2) Adds `<LocaleToggle />` (the same EN/ES chip the shell uses) before Sign in.
// All visible text comes from `next-intl` under `Landing.Topbar.*`. Visual styling
// (className strings, button shape, JSX structure) matches the prototype byte-for-byte.

import { useTranslations } from 'next-intl';
import { Logo } from '@/app/_landing/logo';
import { Sun, Moon } from '@/app/_landing/icons';
import { LocaleToggle } from '@/app/_components/locale-toggle';
import { useTheme } from '@/app/_components/theme-controller';

export const Topbar = () => {
  const t = useTranslations('Landing.Topbar');
  const { theme, setTheme } = useTheme();

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Logo />
          <nav className="topbar-nav">
            <a href="#features">{t('Nav.Features')}</a>
            <a href="#how">{t('Nav.HowItWorks')}</a>
            <a href="#agents">{t('Nav.ForAgents')}</a>
            <a href="#gallery">{t('Nav.Gallery')}</a>
          </nav>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            aria-label={t('ToggleTheme')}
          >
            <span className="theme-thumb">
              {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
            </span>
          </button>
          <LocaleToggle />
          <a href="/sign-in" className="btn btn--ghost">
            {t('SignIn')}
          </a>
          <a href="/sign-in?next=/publish" className="btn btn--publish">
            {t('PublishApp')}
          </a>
        </div>
      </div>
    </header>
  );
};

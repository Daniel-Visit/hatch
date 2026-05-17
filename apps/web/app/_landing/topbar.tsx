'use client';

// Hatch landing topbar — verbatim port of /tmp/hatch-landing-v2/src/sections-1.jsx Topbar (lines 9-32).
// Theme-toggle state requires Client Component. Sign-in / Publish hrefs deviate from prototype
// ("#") to functional routes (/sign-in, /sign-in?next=/publish). All else byte-for-byte.

import { useEffect, useState } from 'react';
import { Logo } from '@/app/_landing/logo';
import { Sun, Moon } from '@/app/_landing/icons';

export const Topbar = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Logo />
          <nav className="topbar-nav">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#agents">For agents</a>
            <a href="#gallery">Gallery</a>
          </nav>
        </div>
        <div className="topbar-actions">
          <button type="button" className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
            <span className="theme-thumb">
              {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
            </span>
          </button>
          <a href="/sign-in" className="btn btn--ghost">
            Sign in
          </a>
          <a href="/sign-in?next=/publish" className="btn btn--publish">
            Publish
          </a>
        </div>
      </div>
    </header>
  );
};

'use client';

// Hatch shell — top bar with logo + search, sidebar with category filter,
// and a slot for the active screen. The shell is shared across all 4 routes
// (gallery / detail / profile / publish).

import React, { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import { useTheme } from './theme-controller';
import { LocaleToggle } from './locale-toggle';

export interface ShellUser {
  handle: string;
  avatar_url: string | null;
  hue: number;
  emoji: string | null;
  display_name: string;
}

export interface ShellProps {
  user: ShellUser | null;
  children: React.ReactNode;
  bell?: React.ReactNode;
}

type NavKey = 'Discover' | 'Trending' | 'NewAndFresh' | 'Following' | 'Saved';

// Browse: feeds anyone can read (no auth required).
const BROWSE_NAV: { href: Route; key: NavKey; icon: string }[] = [
  { href: '/gallery', key: 'Discover', icon: '◇' },
  { href: '/trending', key: 'Trending', icon: '↗' },
  { href: '/new', key: 'NewAndFresh', icon: '✦' },
];

// You: per-user library — Following is about authors, Saved is about apps.
// Different concepts → different sidebar section.
const LIBRARY_NAV: { href: Route; key: NavKey; icon: string }[] = [
  { href: '/following', key: 'Following', icon: '◉' },
  { href: '/saved', key: 'Saved', icon: '▢' },
];

function Logo() {
  const t = useTranslations('Shell');
  return (
    <Link href="/" className="logo">
      <span className="logo-mark">
        <i className="logo-mark-inner" />
      </span>
      <span className="logo-text">
        {t('Logo')}
        <i className="logo-dot" />
      </span>
    </Link>
  );
}

export function Shell({ user, children, bell }: ShellProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const t = useTranslations('Shell');
  const [navOpen, setNavOpen] = useState(false);

  // Close mobile drawer on route change.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="nav-burger"
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          aria-controls="mobile-nav-drawer"
          aria-label={t('Nav.Label')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Logo />
        <form className="topbar-search" action="/search" method="get">
          <i className="search-i">⌕</i>
          <input
            type="text"
            name="q"
            placeholder={t('SearchPlaceholder', { count: 248 })}
            defaultValue=""
          />
          <span className="kbd">⌘K</span>
        </form>
        <nav className="topbar-actions">
          <Link href="/gallery" className="btn btn-ghost">
            {t('Browse')}
          </Link>
          <Link
            href={user ? '/publish' : ('/sign-in?next=/publish' as Route)}
            className="btn btn-publish"
          >
            <Icon name="plus" /> <span className="btn-publish-label">{t('PublishApp')}</span>
          </Link>
          <LocaleToggle />
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? t('SwitchToLight') : t('SwitchToDark')}
            aria-label={t('ToggleTheme')}
            data-theme={theme}
          >
            <span className="theme-track">
              <span className="theme-thumb">
                <svg
                  className="theme-sun"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                <svg
                  className="theme-moon"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                </svg>
              </span>
            </span>
          </button>
          {bell}
          {user ? (
            <AvatarMenu user={user} />
          ) : (
            <Link href="/sign-in" className="btn btn-ghost btn-signin-cta">
              {t('SignIn')}
            </Link>
          )}
        </nav>
      </header>

      <aside className="sidebar">
        <div className="sidebar-sect">
          <div className="sidebar-label">{t('Nav.Label')}</div>
          {BROWSE_NAV.map((n) => {
            const isActive = n.href === '/' ? pathname === '/' : pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-item${isActive ? ' is-on' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <i className="nav-i">{n.icon}</i>
                <span>{t(`Nav.${n.key}`)}</span>
              </Link>
            );
          })}
        </div>
        <div className="sidebar-sect">
          <div className="sidebar-label">{t('Nav.LibraryLabel')}</div>
          {LIBRARY_NAV.map((n) => {
            const isActive = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-item${isActive ? ' is-on' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <i className="nav-i">{n.icon}</i>
                <span>{t(`Nav.${n.key}`)}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      {navOpen && (
        <>
          <button
            type="button"
            className="mobile-nav-backdrop"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
          <nav id="mobile-nav-drawer" className="mobile-nav-drawer" aria-label={t('Nav.Label')}>
            <div className="sidebar-label">{t('Nav.Label')}</div>
            {BROWSE_NAV.map((n) => {
              const isActive = n.href === '/' ? pathname === '/' : pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`nav-item${isActive ? ' is-on' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  <i className="nav-i">{n.icon}</i>
                  <span>{t(`Nav.${n.key}`)}</span>
                </Link>
              );
            })}
            <div className="sidebar-label" style={{ marginTop: 16 }}>
              {t('Nav.LibraryLabel')}
            </div>
            {LIBRARY_NAV.map((n) => {
              const isActive = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`nav-item${isActive ? ' is-on' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  <i className="nav-i">{n.icon}</i>
                  <span>{t(`Nav.${n.key}`)}</span>
                </Link>
              );
            })}
          </nav>
        </>
      )}

      <main className="main">{children}</main>
    </div>
  );
}

function AvatarMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Shell.AvatarMenu');

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="me-menu" ref={wrapperRef}>
      <button
        type="button"
        className="me-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`@${user.handle}`}
      >
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.display_name}
            width={28}
            height={28}
            className="avatar"
            style={{ width: 28, height: 28 }}
          />
        ) : (
          <span
            className="avatar"
            style={{
              width: 28,
              height: 28,
              fontSize: 28 * 0.55,
              background: `oklch(72% 0.15 ${user.hue})`,
            }}
          >
            {user.emoji ?? user.display_name[0]}
          </span>
        )}
      </button>
      {open && (
        <div className="me-dropdown" role="menu">
          <div className="me-dropdown-header">
            <div className="me-dropdown-name">{user.display_name}</div>
            <div className="me-dropdown-handle">@{user.handle}</div>
          </div>
          <Link
            href={`/u/${user.handle}` as Route}
            className="me-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="me-dropdown-i">◆</span>
            {t('Profile')}
          </Link>
          <Link
            href={'/settings/profile' as Route}
            className="me-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="me-dropdown-i">✎</span>
            {t('EditProfile')}
          </Link>
          <div className="me-dropdown-sep" />
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="me-dropdown-item me-dropdown-danger" role="menuitem">
              <span className="me-dropdown-i">↩</span>
              {t('SignOut')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

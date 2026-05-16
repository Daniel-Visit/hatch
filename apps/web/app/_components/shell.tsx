'use client';

// Hatch shell — top bar with logo + search, sidebar with category filter,
// and a slot for the active screen. The shell is shared across all 4 routes
// (gallery / detail / profile / publish).

import React, { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';
import { useTheme } from './theme-controller';

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

const NAV: { href: Route; label: string; icon: string }[] = [
  { href: '/', label: 'Discover', icon: '◇' },
  { href: '/trending', label: 'Trending', icon: '↗' },
  { href: '/new', label: 'New & fresh', icon: '✦' },
  { href: '/following', label: 'Following', icon: '◉' },
];

function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark">
        <i className="logo-mark-inner" />
      </span>
      <span className="logo-text">
        hatch
        <i className="logo-dot" />
      </span>
    </Link>
  );
}

export function Shell({ user, children, bell }: ShellProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <form className="topbar-search" action="/search" method="get">
          <i className="search-i">⌕</i>
          <input
            type="text"
            name="q"
            placeholder="Search 248 apps, makers, tags…"
            defaultValue=""
          />
          <span className="kbd">⌘K</span>
        </form>
        <nav className="topbar-actions">
          <Link href="/" className="btn btn-ghost">
            Browse
          </Link>
          <Link
            href={user ? '/publish' : ('/sign-in?next=/publish' as Route)}
            className="btn btn-publish"
          >
            <Icon name="plus" /> Publish app
          </Link>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
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
            <Link href="/sign-in" className="btn btn-ghost">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <aside className="sidebar">
        <div className="sidebar-sect">
          <div className="sidebar-label">Browse</div>
          {NAV.map((n) => {
            const isActive = n.href === '/' ? pathname === '/' : pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-item${isActive ? ' is-on' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <i className="nav-i">{n.icon}</i>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

function AvatarMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
            Profile
          </Link>
          <Link
            href={'/settings/profile' as Route}
            className="me-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="me-dropdown-i">✎</span>
            Edit profile
          </Link>
          <div className="me-dropdown-sep" />
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="me-dropdown-item me-dropdown-danger" role="menuitem">
              <span className="me-dropdown-i">↩</span>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

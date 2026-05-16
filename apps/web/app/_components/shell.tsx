'use client';

// Hatch shell — top bar with logo + search, sidebar with category filter,
// and a slot for the active screen. The shell is shared across all 4 routes
// (gallery / detail / profile / publish).

import React from 'react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
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

const NAV = [
  { id: 'gallery', label: 'Discover', icon: '◇' },
  { id: 'trending', label: 'Trending', icon: '↗' },
  { id: 'new', label: 'New & fresh', icon: '✦' },
  { id: 'following', label: 'Following', icon: '◉' },
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
          <button className="btn btn-ghost">Browse</button>
          <button className="btn btn-publish">
            <Icon name="plus" /> Publish app
          </button>
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
            <div className="me-menu">
              <Link href={`/u/${user.handle}` as Route} className="me-btn">
                {user.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt={user.display_name}
                    width={28}
                    height={28}
                    className="me-avatar"
                  />
                ) : (
                  <span
                    className="me-avatar me-avatar-emoji"
                    style={{ '--hue': user.hue } as React.CSSProperties}
                  >
                    {user.emoji ?? user.display_name[0]}
                  </span>
                )}
              </Link>
              <div className="me-dropdown">
                <Link href={`/u/${user.handle}` as Route} className="dropdown-item">
                  Profile
                </Link>
                <form action="/auth/sign-out" method="post">
                  <button type="submit" className="dropdown-item">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
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
          {NAV.map((n) => (
            <button key={n.id} className="nav-item">
              <i className="nav-i">{n.icon}</i>
              <span>{n.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-sect sidebar-foot">
          <a className="nav-item" href="#" onClick={(e) => e.preventDefault()}>
            <i className="nav-i">?</i>
            <span>Docs &amp; guides</span>
          </a>
          <a className="nav-item" href="#" onClick={(e) => e.preventDefault()}>
            <i className="nav-i">⌂</i>
            <span>Community</span>
          </a>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

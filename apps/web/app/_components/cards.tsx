'use client';

// 5 card variations for the Hatch gallery.
//
//  1. classic  — surface card, rounded, soft shadow, preview top, info below
//  2. sticker  — playful, dashed accent border, peeking corner badges
//  3. dark     — glowy dark surface, accent halo behind preview
//  4. mono     — terminal-flavored, sharp corners, mono everywhere
//  5. bento    — full-bleed preview with frosted info bar overlaid at bottom
//
// All variants share the same data contract — author, stats, tags, badge —
// so the gallery can swap styles without touching the rest of the UI.

import React from 'react';
import { Icon, SVG_ICONS } from './icons';
import { AppArt } from './app-art';

type IconName = keyof typeof SVG_ICONS;

// ── Shared interfaces ────────────────────────────────────────────────────────

export interface User {
  handle: string;
  hue: number;
  emoji: string;
  display_name: string;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export interface AppStats {
  likes: number;
  remixes: number;
  views: number;
}

export interface AppData {
  id: string;
  title: string;
  tagline: string;
  art: string;
  accent: string;
  tags: string[];
  stats: AppStats;
  author: User;
  category: Category;
}

export interface CardProps {
  app: AppData;
  onOpen: (id: string) => void;
  onAuthor: (author: User) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function fmtNum(n: number | string): string {
  if (typeof n === 'string') return n;
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function Avatar({ user, size = 22 }: { user: User; size?: number }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        background: `oklch(72% 0.15 ${user.hue})`,
      }}
    >
      {user.emoji}
    </span>
  );
}

export function CategoryBadge({ cat }: { cat: Category | null | undefined }) {
  if (!cat) return null;
  return (
    <span className="cat-badge">
      <i>{cat.icon}</i>
      {cat.label}
    </span>
  );
}

export function Stat({
  icon,
  iconName,
  value,
}: {
  icon?: React.ReactNode;
  iconName?: IconName;
  value: number | string;
}) {
  return (
    <span className="stat">
      <i className="stat-i">{iconName ? <Icon name={iconName} size={13} /> : icon}</i>
      <span>{fmtNum(value)}</span>
    </span>
  );
}

// ── 1. Classic ──────────────────────────────────────────────────────────────
export function ClassicCard({ app, onOpen, onAuthor }: CardProps) {
  const u = app.author;
  return (
    <article className="card card-classic" onClick={() => onOpen(app.id)}>
      <div className="card-preview">
        <AppArt kind={app.art} accent={app.accent} />
        <span className="card-cat">
          <CategoryBadge cat={app.category} />
        </span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{app.title}</h3>
        <p className="card-tagline">{app.tagline}</p>
        <div className="card-tags">
          {app.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <div className="card-foot">
          <button
            className="card-author"
            onClick={(e) => {
              e.stopPropagation();
              onAuthor(app.author);
            }}
          >
            <Avatar user={app.author} />
            <span>{u.handle}</span>
          </button>
          <div className="card-stats">
            <Stat iconName="heart" value={app.stats.likes} />
            <Stat iconName="remix" value={app.stats.remixes} />
            <Stat iconName="eye" value={app.stats.views} />
          </div>
        </div>
      </div>
    </article>
  );
}

// ── 2. Sticker ──────────────────────────────────────────────────────────────
export function StickerCard({ app, onOpen, onAuthor }: CardProps) {
  const u = app.author;
  return (
    <article
      className="card card-sticker"
      onClick={() => onOpen(app.id)}
      style={{ '--ax': app.accent } as React.CSSProperties}
    >
      <span className="sticker-tape" />
      <div className="card-preview sticker-preview">
        <AppArt kind={app.art} accent={app.accent} />
      </div>
      <span className="sticker-cat" style={{ background: app.accent }}>
        <CategoryBadge cat={app.category} />
      </span>
      <div className="card-body">
        <div className="card-title-row">
          <h3 className="card-title">{app.title}</h3>
          <span className="sticker-heart">♥ {fmtNum(app.stats.likes)}</span>
        </div>
        <p className="card-tagline">{app.tagline}</p>
        <div className="card-foot">
          <button
            className="card-author"
            onClick={(e) => {
              e.stopPropagation();
              onAuthor(app.author);
            }}
          >
            <Avatar user={app.author} />
            <span>{u.display_name}</span>
          </button>
          <div className="card-tags">
            {app.tags.slice(0, 2).map((t) => (
              <span key={t} className="tag tag-ghost">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── 3. Dark glow ────────────────────────────────────────────────────────────
export function DarkCard({ app, onOpen, onAuthor }: CardProps) {
  const u = app.author;
  return (
    <article
      className="card card-dark"
      onClick={() => onOpen(app.id)}
      style={{ '--ax': app.accent } as React.CSSProperties}
    >
      <i className="dark-halo" />
      <div className="card-preview">
        <AppArt kind={app.art} accent={app.accent} />
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <h3 className="card-title">{app.title}</h3>
          <CategoryBadge cat={app.category} />
        </div>
        <p className="card-tagline">{app.tagline}</p>
        <div className="card-tags">
          {app.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <div className="card-foot">
          <button
            className="card-author"
            onClick={(e) => {
              e.stopPropagation();
              onAuthor(app.author);
            }}
          >
            <Avatar user={app.author} />
            <span>{u.handle}</span>
          </button>
          <div className="card-stats">
            <Stat iconName="heart" value={app.stats.likes} />
            <Stat iconName="remix" value={app.stats.remixes} />
          </div>
        </div>
      </div>
    </article>
  );
}

// ── 4. Mono / terminal ──────────────────────────────────────────────────────
export function MonoCard({ app, onOpen, onAuthor }: CardProps) {
  const u = app.author;
  const c = app.category;
  return (
    <article
      className="card card-mono"
      onClick={() => onOpen(app.id)}
      style={{ '--ax': app.accent } as React.CSSProperties}
    >
      <header className="mono-head">
        <span className="mono-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="mono-path">~/apps/{app.id}</span>
        <span className="mono-cat">[{c?.label.toLowerCase()}]</span>
      </header>
      <div className="card-preview mono-preview">
        <AppArt kind={app.art} accent={app.accent} />
      </div>
      <div className="card-body">
        <h3 className="card-title">$ {app.title}</h3>
        <p className="card-tagline">
          {'> '}
          {app.tagline}
        </p>
        <div className="card-tags">
          {app.tags.slice(0, 4).map((t) => (
            <span key={t} className="tag tag-mono">
              {t}
            </span>
          ))}
        </div>
        <div className="card-foot">
          <button
            className="card-author"
            onClick={(e) => {
              e.stopPropagation();
              onAuthor(app.author);
            }}
          >
            <Avatar user={app.author} size={18} />
            <span>{u.handle}</span>
          </button>
          <span className="mono-stats">
            <Icon name="heart" size={12} /> {fmtNum(app.stats.likes)}{' '}
            <Icon name="remix" size={12} /> {fmtNum(app.stats.remixes)}{' '}
            <Icon name="eye" size={12} /> {fmtNum(app.stats.views)}
          </span>
        </div>
      </div>
    </article>
  );
}

// ── 5. Bento immersive ──────────────────────────────────────────────────────
export function BentoCard({ app, onOpen, onAuthor }: CardProps) {
  const u = app.author;
  return (
    <article
      className="card card-bento"
      onClick={() => onOpen(app.id)}
      style={{ '--ax': app.accent } as React.CSSProperties}
    >
      <div className="bento-art">
        <AppArt kind={app.art} accent={app.accent} glyphSize={120} />
      </div>
      <div className="bento-cat">
        <CategoryBadge cat={app.category} />
      </div>
      <div className="bento-overlay">
        <div className="bento-title-row">
          <h3 className="card-title">{app.title}</h3>
          <span className="bento-likes">♥ {fmtNum(app.stats.likes)}</span>
        </div>
        <p className="card-tagline">{app.tagline}</p>
        <div className="bento-foot">
          <button
            className="card-author"
            onClick={(e) => {
              e.stopPropagation();
              onAuthor(app.author);
            }}
          >
            <Avatar user={app.author} size={20} />
            <span>{u.display_name}</span>
          </button>
          <div className="card-tags">
            {app.tags.slice(0, 2).map((t) => (
              <span key={t} className="tag tag-frost">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Switcher ─────────────────────────────────────────────────────────────────
export interface AppCardProps extends CardProps {
  style: 'classic' | 'sticker' | 'dark' | 'mono' | 'bento';
}

export function AppCard({ style, app, onOpen, onAuthor }: AppCardProps) {
  const props = { app, onOpen, onAuthor };
  switch (style) {
    case 'sticker':
      return <StickerCard {...props} />;
    case 'dark':
      return <DarkCard {...props} />;
    case 'mono':
      return <MonoCard {...props} />;
    case 'bento':
      return <BentoCard {...props} />;
    default:
      return <ClassicCard {...props} />;
  }
}

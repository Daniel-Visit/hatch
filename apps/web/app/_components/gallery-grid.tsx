'use client';

// Thin client wrappers — hold the router callbacks that cards/hero need.
// All data is passed down from the RSC parent as serialisable props.
// onOpen → /apps/<id>    onAuthor → /u/<handle>

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { AppArt } from './app-art';
import { BentoCard, Avatar, CategoryBadge, Stat, fmtNum } from './cards';
import type { AppDataExtended } from './data-mappers';
import type { User } from './cards';

// ── GalleryGrid ──────────────────────────────────────────────────────────────

interface GalleryGridProps {
  apps: AppDataExtended[];
}

export function GalleryGrid({ apps }: GalleryGridProps) {
  const router = useRouter();
  const onOpen = (id: string) => router.push(`/apps/${id}` as Route);
  const onAuthor = (author: User) => router.push(`/u/${author.handle}` as Route);

  if (apps.length === 0) {
    return (
      <div className="empty">
        <div className="empty-glyph">◌</div>
        <h3>No apps match your filters</h3>
        <p>Try clearing the search or picking a different category.</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {apps.map((app) => (
        <BentoCard key={app.id} app={app} onOpen={onOpen} onAuthor={onAuthor} />
      ))}
    </div>
  );
}

// ── FeaturedHero ─────────────────────────────────────────────────────────────

interface FeaturedHeroProps {
  apps: AppDataExtended[];
}

export function FeaturedHero({ apps }: FeaturedHeroProps) {
  const router = useRouter();
  const onOpen = (id: string) => router.push(`/apps/${id}` as Route);
  const onAuthor = (author: User) => router.push(`/u/${author.handle}` as Route);

  const [main, a2, a3] = apps;
  if (!main) return null;

  return (
    <section className="hero">
      <div
        className="hero-main"
        onClick={() => onOpen(main.id)}
        style={{ '--ax': main.accent } as React.CSSProperties}
      >
        <div className="hero-art">
          <AppArt kind={main.art} accent={main.accent} glyphSize={180} />
        </div>
        <div className="hero-info">
          <div className="hero-tag">
            <span className="hero-pill">App of the week</span>
            <CategoryBadge cat={main.category} />
          </div>
          <h2 className="hero-title">{main.title}</h2>
          <p className="hero-tagline">{main.tagline}</p>
          <div className="hero-meta">
            <button
              className="card-author"
              onClick={(e) => {
                e.stopPropagation();
                onAuthor(main.author);
              }}
            >
              <Avatar user={main.author} size={26} />
              <span>{main.author.display_name}</span>
            </button>
            <div className="card-stats">
              <Stat iconName="heart" value={main.stats.likes} />
              <Stat iconName="remix" value={main.stats.remixes} />
              <Stat iconName="eye" value={main.stats.views} />
            </div>
          </div>
          <div className="hero-cta">
            <span className="btn btn-primary" style={{ background: main.accent }}>
              Open app →
            </span>
            <span className="btn btn-ghost-2">Read more</span>
          </div>
        </div>
      </div>
      <div className="hero-side">
        {([a2, a3] as (AppDataExtended | undefined)[])
          .filter((a): a is AppDataExtended => Boolean(a))
          .map((a) => (
            <div
              key={a.id}
              className="hero-mini"
              onClick={() => onOpen(a.id)}
              style={{ '--ax': a.accent } as React.CSSProperties}
            >
              <div className="hero-mini-art">
                <AppArt kind={a.art} accent={a.accent} glyphSize={56} />
              </div>
              <div className="hero-mini-info">
                <div className="hero-mini-cat">
                  <CategoryBadge cat={a.category} />
                </div>
                <h4>{a.title}</h4>
                <p>{a.tagline}</p>
                <div className="hero-mini-meta">
                  <Avatar user={a.author} size={16} />
                  <span>{a.author.handle}</span>
                  <span className="dot-sep">•</span>
                  <span>♥ {fmtNum(a.stats.likes)}</span>
                </div>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

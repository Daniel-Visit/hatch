'use client';

// Gallery preview — REAL DB data with working Hot/New/Most loved tabs.
// Tabs + "See all" sit on the same horizontal row, vertically centered, slightly
// shifted left to align under the section description (not flush right).
// "See all" → /gallery. Each card → /a/<slug>.

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { MiniAppCard } from '@/app/_landing/mini-app-card';
import { Flame, Sparkles, HeartFill, Arrow } from '@/app/_landing/icons';
import type { AppRow } from '@/app/_landing/data';

type TabId = 'hot' | 'new' | 'loved';

const GALLERY_TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'hot', label: 'Hot', icon: <Flame size={12} /> },
  { id: 'new', label: 'New', icon: <Sparkles size={12} /> },
  { id: 'loved', label: 'Most loved', icon: <HeartFill size={11} stroke={0} /> },
];

type GalleryPreviewProps = {
  tabs: {
    hot: AppRow[];
    new: AppRow[];
    loved: AppRow[];
  };
};

export const GalleryPreview = ({ tabs }: GalleryPreviewProps) => {
  const [tab, setTab] = useState<TabId>('hot');
  const rows = tabs[tab];

  return (
    <section id="gallery" className="sect" style={{ background: 'var(--surface-2)' }}>
      <div className="container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 32,
            flexWrap: 'wrap',
            gap: 24,
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <span className="section-eyebrow">
              <span className="dot" />
              live gallery
            </span>
            <h2 className="section-title" style={{ textAlign: 'left', margin: '14px 0 12px' }}>
              What builders are shipping today
            </h2>
            <p className="section-sub" style={{ textAlign: 'left', margin: 0 }}>
              A peek at the live feed. Browse by hot, new, or all-time.
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              flexWrap: 'nowrap',
              height: 40,
            }}
          >
            <div
              className="gallery-tabs"
              role="tablist"
              style={{
                height: 40,
                minHeight: 40,
                maxHeight: 40,
                boxSizing: 'border-box',
                padding: '3px',
                display: 'inline-flex',
                alignItems: 'center',
                marginBottom: 0,
              }}
            >
              {GALLERY_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={'gallery-tab ' + (tab === t.id ? 'active' : '')}
                  onClick={() => setTab(t.id)}
                  role="tab"
                  aria-selected={tab === t.id}
                  style={{
                    height: 32,
                    minHeight: 32,
                    boxSizing: 'border-box',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            <Link
              href={'/gallery' as Route}
              className="btn"
              style={{
                height: 40,
                minHeight: 40,
                maxHeight: 40,
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              See all <Arrow size={13} />
            </Link>
          </div>
        </div>

        <div className="gallery-row">
          {rows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              No apps yet — be the first to publish.
            </p>
          ) : (
            rows.map((a) => (
              <MiniAppCard
                key={a.id}
                title={a.title}
                by={a.author?.handle ?? 'unknown'}
                desc={a.tagline}
                cat={a.category_label}
                hearts={a.likes_count}
                comments={a.comments_count}
                kind={a.art_kind}
                accent={a.accent}
                slug={a.slug}
                hue={a.author?.hue}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
};

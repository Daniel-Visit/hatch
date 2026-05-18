// Search results page — server-rendered, query driven by ?q= param.
// Maps SearchResultApp[] from searchApps() into AppDataExtended[] for GalleryGrid.

import { getLocale, getTranslations } from 'next-intl/server';
import { searchApps } from '@/lib/actions/search';
import { GalleryGrid } from '@/app/_components/gallery-grid';
import { relativeTime } from '@/app/_components/data-mappers';
import type { AppDataExtended } from '@/app/_components/data-mappers';
import type { SearchResultApp } from '@/lib/actions/search';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

/** Convert a SearchResultApp (flat from action) to AppDataExtended (card contract). */
function toAppDataExtended(app: SearchResultApp, locale: 'en' | 'es' = 'en'): AppDataExtended {
  return {
    id: app.slug,
    title: app.title,
    tagline: app.tagline,
    art: app.art_kind,
    accent: app.accent,
    hue: app.hue,
    bg: app.cover_url,
    tags: [],
    built_with: [],
    stats: {
      likes: app.likes_count,
      views: 0,
    },
    author: {
      handle: app.author?.handle ?? 'unknown',
      hue: app.author?.hue ?? 200,
      emoji: app.author?.emoji ?? '◇',
      display_name: app.author?.display_name ?? app.author?.handle ?? 'Unknown',
    },
    category: {
      id: app.category_id,
      label: app.category_id,
      icon: '◇',
    },
    published: relativeTime(app.published_at, locale),
    featured: false,
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const locale = (await getLocale()) as 'en' | 'es';
  const t = await getTranslations('Search');

  if (query.length < 2) {
    return (
      <div className="gallery dens-default style-bento">
        <div className="gal-head">
          <div className="gal-head-left">
            <h1>{t('Title')}</h1>
            <p className="gal-sub">{t('MinCharsHint')}</p>
          </div>
        </div>
      </div>
    );
  }

  const result = await searchApps({ query });

  if (!result.ok) {
    return (
      <div className="gallery dens-default style-bento">
        <div className="gal-head">
          <div className="gal-head-left">
            <h1>{t('Title')}</h1>
            <p className="gal-sub">{t('Failed')}</p>
          </div>
        </div>
      </div>
    );
  }

  const { apps: rawApps } = result.data;
  const apps: AppDataExtended[] = rawApps.map((a) => toAppDataExtended(a, locale));

  return (
    <div className="gallery dens-default style-bento">
      <div className="gal-head">
        <div className="gal-head-left">
          <h1>
            {apps.length > 0
              ? t('ResultsFor', { count: apps.length, q: query })
              : t('NoMatches', { q: query })}
            {apps.length > 0 && <span className="gal-count">{apps.length}</span>}
          </h1>
          {apps.length > 0 && <p className="gal-sub">{t('ResultsSubtitle')}</p>}
        </div>
      </div>

      <GalleryGrid apps={apps} />
    </div>
  );
}

// Category gallery page — server-filtered variant of the home gallery.
// Pre-filters apps by category_id server-side; renders the same gallery layout
// as app/page.tsx but with no featured hero rail and the active chip highlighted.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapAppRowToCardProps } from '@/app/_components/data-mappers';
import { GalleryGrid } from '@/app/_components/gallery-grid';
import type { AppDataExtended } from '@/app/_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

// Synthetic "All" entry prepended to the DB categories list — matches prototype.
// `label` is a fallback only; the chip strip prefers the translated label below.
const ALL_CATEGORY = { id: 'all', label: 'All', icon: '◇' };

// ── FilterChips (server — links only, active chip highlighted) ────────────────

async function FilterChips({
  categories,
  activeId,
}: {
  categories: { id: string; label: string; icon: string }[];
  activeId: string;
}) {
  const tCat = await getTranslations('Categories');
  const tCategory = await getTranslations('Category');
  const lookupLabel = (id: string, fallback: string): string => {
    if (id === 'all') return tCategory('AllLabel');
    try {
      const looked = (tCat as unknown as (key: string) => string)(id);
      return looked && looked !== `Categories.${id}` ? looked : fallback;
    } catch {
      return fallback;
    }
  };
  return (
    <div className="chips">
      {categories.map((c) => {
        const isActive = c.id === activeId;
        return (
          <Link
            key={c.id}
            href={(c.id === 'all' ? '/' : `/c/${c.id}`) as Route}
            className={`chip${isActive ? ' chip--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="chip-i">{c.icon}</span>
            <span>{lookupLabel(c.id, c.label)}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categoryId } = await params;
  const supabase = await createSupabaseServerClient();
  const locale = (await getLocale()) as 'en' | 'es';
  const tCat = await getTranslations('Categories');
  const tCategory = await getTranslations('Category');
  const tHome = await getTranslations('Home');

  // Query 1: validate category exists.
  const { data: categoryRow } = await supabase
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .single();

  if (!categoryRow) {
    notFound();
  }

  // Query 2: fetch up to 48 published apps for this category, ordered same as home.
  const { data: appRows } = await supabase
    .from('apps')
    .select('*, author:profiles!apps_author_id_fkey(handle, hue, emoji, display_name, avatar_url)')
    .eq('category_id', categoryId)
    .eq('is_published', true)
    .order('hot_score', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(48);

  // Fetch all categories for the chip strip.
  const { data: categoryRows } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  // Build a lookup map from category id → row.
  const catMap = new Map<string, Tables<'categories'>>((categoryRows ?? []).map((c) => [c.id, c]));

  // Map every app row to the AppData card contract.
  const apps: AppDataExtended[] = (appRows ?? []).map((row) => {
    const profileData = row.author as {
      handle: string;
      hue: number;
      emoji: string | null;
      display_name: string;
      avatar_url: string | null;
    } | null;

    const profile = profileData
      ? {
          id: row.author_id,
          handle: profileData.handle,
          hue: profileData.hue,
          emoji: profileData.emoji,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url,
          bio: null,
          created_at: '',
          updated_at: '',
          links: {},
          notification_prefs: {},
          theme_pref: '',
          banner_gradient: null,
          locale_pref: null,
          accepts_requests: false,
          request_capacity: 3,
          request_domains: [],
          request_rate_band: null,
          inferred_capabilities: [],
          last_brief_response_at: null,
          feature_flags: {},
        }
      : null;

    const category = catMap.get(row.category_id) ?? null;
    return mapAppRowToCardProps(row, profile, category, locale);
  });

  // Categories strip: synthetic "All" first, then DB categories.
  const allCategories = [
    ALL_CATEGORY,
    ...(categoryRows ?? []).map((c) => ({ id: c.id, label: c.label, icon: c.icon })),
  ];

  // Resolve the translated category label (fallback to DB row label).
  const translatedCategoryLabel: string = (() => {
    try {
      const looked = (tCat as unknown as (key: string) => string)(categoryRow.id);
      return looked && looked !== `Categories.${categoryRow.id}` ? looked : categoryRow.label;
    } catch {
      return categoryRow.label;
    }
  })();

  return (
    <div className="gallery dens-default style-bento">
      <div className="gal-head">
        <div className="gal-head-left">
          <h1>
            {categoryRow.icon} {translatedCategoryLabel}
            <span className="gal-count">{apps.length}</span>
          </h1>
          <p className="gal-sub">
            {tCategory('Subtitle', { category: translatedCategoryLabel.toLowerCase() })}
          </p>
        </div>
      </div>

      <FilterChips categories={allCategories} activeId={categoryId} />

      <div className="gal-toolbar">
        <span className="gal-toolbar-l">
          {tHome.rich('ShowingApps', {
            count: apps.length,
            b: (chunks) => <b>{chunks}</b>,
          })}
        </span>
      </div>

      <GalleryGrid apps={apps} />
    </div>
  );
}

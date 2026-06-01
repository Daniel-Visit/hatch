// Gallery home page — async RSC port of prototype/apps-gallery/gallery.jsx.
// Queries Supabase for published apps + categories, maps rows to card props,
// and renders the gallery structure verbatim from the prototype.

import Link from 'next/link';
import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapAppRowToCardProps } from '@/app/_components/data-mappers';
import { FeaturedHero, GalleryGrid } from '@/app/_components/gallery-grid';
import type { AppDataExtended } from '@/app/_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

// Returns the Monday of the current UTC week as a YYYY-MM-DD string,
// matching Postgres `date_trunc('week', now())::date` semantics.
function currentMondayUtcIsoDate(): string {
  const d = new Date();
  // JS: getUTCDay() → Sun=0, Mon=1 … Sat=6. Shift so Monday=0.
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Synthetic "All" entry prepended to the DB categories list — matches prototype.
// `label` is a fallback only; the chip strip prefers the translated label below.
const ALL_CATEGORY = { id: 'all', label: 'All', icon: '◇' };

// ── FilterChips (server — links only, no client state) ───────────────────────

async function FilterChips({
  categories,
}: {
  categories: { id: string; label: string; icon: string }[];
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
      {categories.map((c) => (
        <Link
          key={c.id}
          href={(c.id === 'all' ? '/gallery' : `/c/${c.id}`) as Route}
          className="chip"
        >
          <span className="chip-i">{c.icon}</span>
          <span>{lookupLabel(c.id, c.label)}</span>
        </Link>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const locale = (await getLocale()) as 'en' | 'es';
  const tHome = await getTranslations('Home');

  // Fetch up to 24 published apps ordered by hot_score desc, then newest.
  // Join the author profile in a single query using Supabase's PostgREST syntax.
  const { data: appRows } = await supabase
    .from('apps')
    .select('*, author:profiles!apps_author_id_fkey(handle, hue, emoji, display_name, avatar_url)')
    .eq('is_published', true)
    .order('hot_score', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(24);

  // Fetch all categories ordered by sort_order.
  const { data: categoryRows } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  // Build a lookup map from category id → row.
  const catMap = new Map<string, Tables<'categories'>>((categoryRows ?? []).map((c) => [c.id, c]));

  // Map every app row to the AppData card contract.
  const apps: AppDataExtended[] = (appRows ?? []).map((row) => {
    // The joined profile comes back as an object (or null) on row.author.
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

  // ── Featured hero: prefer featured_apps for this week, fallback to hot_score ──

  const SELECT_FOR_FEATURED =
    '*, author:profiles!apps_author_id_fkey(handle, hue, emoji, display_name, avatar_url)';

  const monday = currentMondayUtcIsoDate();

  // Step 1: look up featured_apps rows for the current Monday-anchored week.
  // featured_apps.app_id → apps.id is many-to-one, so Supabase returns row.apps
  // as a single object, not an array.
  const { data: featuredJoin } = await supabase
    .from('featured_apps')
    .select(`week_of, apps!inner(${SELECT_FOR_FEATURED})`)
    .eq('week_of', monday)
    .limit(3);

  // Collect full app rows from the join result.
  type RawAppRow = NonNullable<typeof appRows>[number];
  let featuredRaws: RawAppRow[] = [];
  if (featuredJoin && featuredJoin.length > 0) {
    for (const row of featuredJoin) {
      // Supabase types the joined relation as an array due to isOneToOne:false,
      // but at runtime it returns a single object — handle both.
      const joined = row.apps;
      if (Array.isArray(joined)) {
        featuredRaws = featuredRaws.concat(joined as RawAppRow[]);
      } else if (joined) {
        featuredRaws.push(joined as RawAppRow);
      }
    }
  }

  // Step 2: fallback — top 3 by hot_score when the weekly curation is empty.
  if (featuredRaws.length === 0) {
    const { data: top } = await supabase
      .from('apps')
      .select(SELECT_FOR_FEATURED)
      .eq('is_published', true)
      .order('hot_score', { ascending: false, nullsFirst: false })
      .limit(3);
    featuredRaws = (top ?? []) as RawAppRow[];
  }

  // Map featured raws through the same pipeline as the main apps list.
  const featured: AppDataExtended[] = featuredRaws.map((row) => {
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

  // The home page always shows the "all" view — showHero matches prototype logic.
  const showHero = featured.length > 0;

  return (
    <div className="gallery dens-default style-bento">
      <div className="gal-head">
        <div className="gal-head-left">
          <h1>
            {tHome('DiscoverTitle')}
            <span className="gal-count">{apps.length}</span>
          </h1>
          <p className="gal-sub">{tHome('Subtitle')}</p>
        </div>
      </div>

      <FilterChips categories={allCategories} />

      <div className="gal-toolbar">
        <span className="gal-toolbar-l">
          {tHome.rich('ShowingApps', {
            count: apps.length,
            b: (chunks) => <b>{chunks}</b>,
          })}
        </span>
      </div>

      {showHero && <FeaturedHero apps={featured} />}

      {showHero && (
        <div className="section-head">
          <h2>{tHome('FreshOutTheOven')}</h2>
          <span className="section-sub">{tHome('AppsSubtitle', { count: apps.length })}</span>
        </div>
      )}

      <GalleryGrid apps={apps} />
    </div>
  );
}

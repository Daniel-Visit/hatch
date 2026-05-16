// Gallery home page — async RSC port of prototype/apps-gallery/gallery.jsx.
// Queries Supabase for published apps + categories, maps rows to card props,
// and renders the gallery structure verbatim from the prototype.

import Link from 'next/link';
import type { Route } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapAppRowToCardProps } from './_components/data-mappers';
import { FeaturedHero, GalleryGrid } from './_components/gallery-grid';
import type { AppDataExtended } from './_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

// Synthetic "All" entry prepended to the DB categories list — matches prototype.
const ALL_CATEGORY = { id: 'all', label: 'All', icon: '◇' };

// ── FilterChips (server — links only, no client state) ───────────────────────

function FilterChips({
  categories,
}: {
  categories: { id: string; label: string; icon: string }[];
}) {
  return (
    <div className="chips">
      {categories.map((c) => (
        <Link key={c.id} href={(c.id === 'all' ? '/' : `/c/${c.id}`) as Route} className="chip">
          <span className="chip-i">{c.icon}</span>
          <span>{c.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

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
        }
      : null;

    const category = catMap.get(row.category_id) ?? null;
    return mapAppRowToCardProps(row, profile, category);
  });

  // Pick featured apps for the hero rail (up to 3).
  const featured = apps.filter((a) => a.featured).slice(0, 3);

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
            Discover
            <span className="gal-count">{apps.length}</span>
          </h1>
          <p className="gal-sub">
            Side-projects, weekend builds and unreasonable ideas from the Hatch community.
          </p>
        </div>
      </div>

      <FilterChips categories={allCategories} />

      <div className="gal-toolbar">
        <span className="gal-toolbar-l">
          Showing <b>{apps.length}</b> {apps.length === 1 ? 'app' : 'apps'}
        </span>
      </div>

      {showHero && <FeaturedHero apps={featured} />}

      {showHero && (
        <div className="section-head">
          <h2>Fresh out the oven</h2>
          <span className="section-sub">{apps.length} apps</span>
        </div>
      )}

      <GalleryGrid apps={apps} />
    </div>
  );
}

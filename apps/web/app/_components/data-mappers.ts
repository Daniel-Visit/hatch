// data-mappers.ts — Maps Supabase DB rows → the AppData card contract.
// Keeps all shape translation out of page.tsx and away from the DB types.
// Also exports server-safe formatter helpers (fmtNum) so RSCs can format
// numbers without importing from cards.tsx (which is a client module).

import type { AppData, Category, User } from './cards';
import type { Tables } from '@/lib/supabase/types';

// ── fmtNum (server-safe) ─────────────────────────────────────────────────────

/** Server-safe number formatter — mirrors the client `fmtNum` in cards.tsx. */
export function fmtNum(n: number | string): string {
  if (typeof n === 'string') return n;
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

type AppRow = Tables<'apps'>;
type ProfileRow = Tables<'profiles'>;
type CategoryRow = Tables<'categories'>;

// ── relativeTime ─────────────────────────────────────────────────────────────

/**
 * Returns a human-friendly relative time string like "3 days ago",
 * "2 weeks ago", or "just now" for dates in the past.
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return 'just now';
  if (diffSecs < 3600) {
    const m = Math.floor(diffSecs / 60);
    return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }
  if (diffSecs < 86400) {
    const h = Math.floor(diffSecs / 3600);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  if (diffSecs < 604800) {
    const d2 = Math.floor(diffSecs / 86400);
    return d2 === 1 ? '1 day ago' : `${d2} days ago`;
  }
  if (diffSecs < 2592000) {
    const w = Math.floor(diffSecs / 604800);
    return w === 1 ? '1 week ago' : `${w} weeks ago`;
  }
  if (diffSecs < 31536000) {
    const mo = Math.floor(diffSecs / 2592000);
    return mo === 1 ? '1 month ago' : `${mo} months ago`;
  }
  const yr = Math.floor(diffSecs / 31536000);
  return yr === 1 ? '1 year ago' : `${yr} years ago`;
}

// ── mapAppRowToCardProps ──────────────────────────────────────────────────────

/**
 * Converts a Supabase apps row + joined profile + category row into the
 * AppData shape expected by the card components.
 */
export interface AppDataExtended extends AppData {
  hue: number;
  bg: string | null;
  published: string;
  featured: boolean;
}

export function mapAppRowToCardProps(
  app: AppRow,
  profile: ProfileRow | null,
  category: CategoryRow | null,
): AppDataExtended {
  const author: User = {
    handle: profile?.handle ?? 'unknown',
    hue: profile?.hue ?? 200,
    emoji: profile?.emoji ?? '◇',
    display_name: profile?.display_name ?? profile?.handle ?? 'Unknown',
  };

  const cat: Category = {
    id: category?.id ?? app.category_id,
    label: category?.label ?? app.category_id,
    icon: category?.icon ?? '◇',
  };

  return {
    id: app.slug,
    title: app.title,
    tagline: app.tagline,
    art: app.art_kind,
    accent: app.accent,
    hue: app.hue,
    bg: app.bg,
    tags: app.tags ?? [],
    stats: {
      likes: app.likes_count,
      remixes: app.remixes_count,
      views: app.views_count,
    },
    author,
    category: cat,
    published: relativeTime(app.published_at),
    featured: app.is_featured,
  };
}

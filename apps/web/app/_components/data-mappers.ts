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

// Locale-aware "just now" string — mirrors messages/{en,es}.json `Time.justNow`.
// This file is plain TS (no React hooks), so we can't `useTranslations` here.
const JUST_NOW: Record<'en' | 'es', string> = {
  en: 'just now',
  es: 'ahora mismo',
};

/**
 * Returns a human-friendly relative time string like "3 days ago",
 * "2 weeks ago", or "just now" for dates in the past, localized to `locale`.
 */
export function relativeTime(date: Date | string, locale: 'en' | 'es' = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return JUST_NOW[locale];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSecs < 3600) {
    const m = Math.floor(diffSecs / 60);
    return rtf.format(-m, 'minute');
  }
  if (diffSecs < 86400) {
    const h = Math.floor(diffSecs / 3600);
    return rtf.format(-h, 'hour');
  }
  if (diffSecs < 604800) {
    const d2 = Math.floor(diffSecs / 86400);
    return rtf.format(-d2, 'day');
  }
  if (diffSecs < 2592000) {
    const w = Math.floor(diffSecs / 604800);
    return rtf.format(-w, 'week');
  }
  if (diffSecs < 31536000) {
    const mo = Math.floor(diffSecs / 2592000);
    return rtf.format(-mo, 'month');
  }
  const yr = Math.floor(diffSecs / 31536000);
  return rtf.format(-yr, 'year');
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
  locale: 'en' | 'es' = 'en',
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
    built_with: app.built_with ?? [],
    stats: {
      likes: app.likes_count,
      views: app.views_count,
    },
    author,
    category: cat,
    published: relativeTime(app.published_at, locale),
    featured: app.is_featured,
  };
}

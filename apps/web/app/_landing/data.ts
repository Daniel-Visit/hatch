// Server-side helpers for the landing page.
// Hero meta + SocialProof use real counts; GalleryPreview tabs use real published apps.
// Hero floating cards, Bento decoration, Agents, Testimonials, Footer remain verbatim mocks.

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type AppRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  accent: string;
  art_kind: string;
  hue: number;
  category_id: string;
  category_label: string; // resolved server-side from categories table (NOT the UUID)
  likes_count: number;
  comments_count: number;
  hot_score: number;
  author: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
    hue: number;
    emoji: string | null;
  } | null;
};

type AppRowRaw = Omit<AppRow, 'category_label'>;

export type LandingCounts = {
  apps: number;
  builders: number;
  today: number;
  connections: number;
};

export type LandingData = {
  counts: LandingCounts;
  tabs: {
    hot: AppRow[];
    new: AppRow[];
    loved: AppRow[];
  };
};

const SELECT =
  'id, slug, title, tagline, accent, art_kind, hue, category_id, likes_count, comments_count, hot_score, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)';

export async function fetchLandingData(): Promise<LandingData> {
  const sb = createSupabaseAdminClient();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [hot, newest, loved, cats, apps, builders, today, connections] = await Promise.all([
    sb
      .from('apps')
      .select(SELECT)
      .eq('is_published', true)
      .order('hot_score', { ascending: false, nullsFirst: false })
      .limit(4),
    sb
      .from('apps')
      .select(SELECT)
      .eq('is_published', true)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(4),
    sb
      .from('apps')
      .select(SELECT)
      .eq('is_published', true)
      .order('likes_count', { ascending: false })
      .limit(4),
    sb.from('categories').select('id, label'),
    sb.from('apps').select('id', { count: 'exact', head: true }).eq('is_published', true),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb
      .from('apps')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .gte('published_at', since24h),
    // `follows` has composite PK (follower_id, followee_id) — no `id` column. Count via follower_id.
    sb.from('follows').select('follower_id', { count: 'exact', head: true }),
  ]);

  const catLabel = new Map<string, string>((cats.data ?? []).map((c) => [c.id, c.label]));
  const enrich = (row: AppRowRaw): AppRow => ({
    ...row,
    category_label: catLabel.get(row.category_id) ?? row.category_id,
  });

  return {
    counts: {
      apps: apps.count ?? 0,
      builders: builders.count ?? 0,
      today: today.count ?? 0,
      connections: connections.count ?? 0,
    },
    tabs: {
      hot: (hot.data ?? []).map(enrich as (r: unknown) => AppRow),
      new: (newest.data ?? []).map(enrich as (r: unknown) => AppRow),
      loved: (loved.data ?? []).map(enrich as (r: unknown) => AppRow),
    },
  };
}

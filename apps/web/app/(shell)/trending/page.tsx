// Trending page — public gallery of hottest apps in the last 7 days.
// Ordered by hot_score desc, limited to 60. No auth required.

import { getLocale, getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapAppRowToCardProps } from '@/app/_components/data-mappers';
import { GalleryGrid } from '@/app/_components/gallery-grid';
import type { AppDataExtended } from '@/app/_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function TrendingPage() {
  const sb = await createSupabaseServerClient();
  const locale = (await getLocale()) as 'en' | 'es';
  const t = await getTranslations('Trending');
  const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

  const [{ data: appRows }, { data: categoryRows }] = await Promise.all([
    sb
      .from('apps')
      .select(
        '*, author:profiles!apps_author_id_fkey(handle, hue, emoji, display_name, avatar_url)',
      )
      .eq('is_published', true)
      .gte('published_at', since)
      .order('hot_score', { ascending: false, nullsFirst: false })
      .limit(60),
    sb.from('categories').select('*').order('sort_order', { ascending: true }),
  ]);

  const catMap = new Map<string, Tables<'categories'>>((categoryRows ?? []).map((c) => [c.id, c]));

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
          capability_embedding: null,
          feature_flags: {},
        }
      : null;

    const category = catMap.get(row.category_id) ?? null;
    return mapAppRowToCardProps(row, profile, category, locale);
  });

  return (
    <div>
      <div style={{ padding: '24px 32px 0 32px' }}>
        <h1
          style={{
            fontFamily: 'var(--display)',
            fontSize: '20px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          {t('TrendingThisWeek')}
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '13px' }}>
          {t('AppsHotInLast7Days', { count: apps.length })}
        </p>
      </div>
      <GalleryGrid apps={apps} />
    </div>
  );
}

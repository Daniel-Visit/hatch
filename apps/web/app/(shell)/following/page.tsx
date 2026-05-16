// Following page — auth-gated gallery of apps from builders you follow.
// Redirects to /sign-in if not authenticated. Ordered by published_at desc.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { mapAppRowToCardProps } from '@/app/_components/data-mappers';
import { GalleryGrid } from '@/app/_components/gallery-grid';
import type { AppDataExtended } from '@/app/_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function FollowingPage() {
  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    redirect('/sign-in');
  }

  const sb = await createSupabaseServerClient();
  const locale = (await getLocale()) as 'en' | 'es';
  const t = await getTranslations('Following');

  const { data: follows } = await sb
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id);

  const followeeIds = (follows ?? []).map((f) => f.followee_id);

  if (followeeIds.length === 0) {
    return (
      <div
        style={{
          padding: '60px 32px',
          maxWidth: '500px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--display)',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          {t('NothingHereYet')}
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>
          {t('FollowSomeBuilders')}{' '}
          <Link href="/gallery" style={{ color: 'var(--ax)', textDecoration: 'underline' }}>
            {t('BrowseDiscover')}
          </Link>
        </p>
      </div>
    );
  }

  const [{ data: appRows }, { data: categoryRows }] = await Promise.all([
    sb
      .from('apps')
      .select(
        '*, author:profiles!apps_author_id_fkey(handle, hue, emoji, display_name, avatar_url)',
      )
      .in('author_id', followeeIds)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
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
          {t('Title')}
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '13px' }}>{t('Subtitle')}</p>
      </div>
      <GalleryGrid apps={apps} />
    </div>
  );
}

// Saved page — auth-gated gallery of apps the user bookmarked via the Save
// button on the action bar. Redirects to /sign-in when not authenticated.
// Ordered by the `saves.created_at` of the save row (newest first), not the
// app's published_at — so the most recently saved apps appear on top.

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

type SavedAppJoin = {
  created_at: string;
  apps: Tables<'apps'> & {
    author: {
      handle: string;
      hue: number;
      emoji: string | null;
      display_name: string;
      avatar_url: string | null;
    } | null;
  };
};

export default async function SavedPage() {
  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try {
    ({ user } = await requireUser());
  } catch {
    redirect('/sign-in');
  }

  const sb = await createSupabaseServerClient();
  const locale = (await getLocale()) as 'en' | 'es';
  const t = await getTranslations('Saved');

  const [{ data: savedRowsRaw }, { data: categoryRows }] = await Promise.all([
    sb
      .from('saves')
      .select(
        `created_at,
         apps!inner(*, author:profiles!apps_author_id_fkey(handle, hue, emoji, display_name, avatar_url))`,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60),
    sb.from('categories').select('*').order('sort_order', { ascending: true }),
  ]);

  const savedRows = (savedRowsRaw ?? []) as unknown as SavedAppJoin[];
  // Defensive: only include rows where the joined app is still published.
  const appRows = savedRows.map((r) => r.apps).filter((a) => a && a.is_published);

  if (appRows.length === 0) {
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
          {t('SaveSomeApps')}{' '}
          <Link href="/" style={{ color: 'var(--ax)', textDecoration: 'underline' }}>
            {t('BrowseDiscover')}
          </Link>
        </p>
      </div>
    );
  }

  const catMap = new Map<string, Tables<'categories'>>((categoryRows ?? []).map((c) => [c.id, c]));

  const apps: AppDataExtended[] = appRows.map((row) => {
    const profileData = row.author;
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

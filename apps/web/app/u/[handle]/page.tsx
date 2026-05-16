// Creator profile page — async RSC port of prototype/apps-gallery/profile.jsx.
// Query 1: fetch profile by handle (citext — case-insensitive).
// Query 2: fetch that creator's published apps; map to card props.
// Query 3: fetch liked apps when tab='liked'.
// Query 4: check follow status for the viewer.

import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import { Avatar } from '../../_components/cards';
import { GalleryGrid } from '../../_components/gallery-grid';
import { FollowPill } from '../../_components/follow-pill';
import { mapAppRowToCardProps } from '../../_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { handle } = await params;
  const tab = (await searchParams).tab ?? 'apps';

  const [supabase, viewer] = await Promise.all([createSupabaseServerClient(), getUser()]);

  // Query 1 — profile by handle (citext → case-insensitive comparison).
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('handle', handle)
    .single();

  if (!profile) notFound();

  // Query 2 — published apps where author_id = profile.id.
  // Also fetch categories so mapAppRowToCardProps can build the full Category shape.
  const [{ data: appRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from('apps')
      .select('*')
      .eq('author_id', profile.id)
      .eq('is_published', true)
      .order('hot_score', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false }),
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
  ]);

  const catMap = new Map<string, Tables<'categories'>>((categoryRows ?? []).map((c) => [c.id, c]));

  // Re-use the already-fetched profile row — no second join needed.
  const apps = (appRows ?? []).map((row) =>
    mapAppRowToCardProps(row, profile, catMap.get(row.category_id) ?? null),
  );

  // Query 3 — liked apps (only when tab='liked' to avoid unnecessary work).
  let likedApps: typeof apps = [];
  if (tab === 'liked') {
    const { data: likeRows } = await supabase
      .from('likes')
      .select(
        'app_id, apps!inner ( id, slug, title, tagline, accent, art_kind, cover_url, likes_count, comments_count, remixes_count, tags, hue, bg, is_featured, published_at, author_id, category_id, is_published, hot_score, description, link, views_count, saves_count, search_vector, created_at, updated_at )',
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(24);

    if (likeRows) {
      // Each row has an `apps` field (the joined app row).
      // RLS already filters unpublished; defensive is_published filter applied below.
      const likedAppRows = likeRows
        .map((r) => (Array.isArray(r.apps) ? r.apps[0] : r.apps))
        .filter(
          (a): a is Tables<'apps'> =>
            a != null && typeof a === 'object' && 'id' in a && (a as Tables<'apps'>).is_published,
        );

      // For each liked app we need the author profile and category.
      const authorIds = [...new Set(likedAppRows.map((a) => a.author_id))];
      const { data: authorRows } = await supabase.from('profiles').select('*').in('id', authorIds);
      const authorMap = new Map<string, Tables<'profiles'>>(
        (authorRows ?? []).map((p) => [p.id, p]),
      );

      likedApps = likedAppRows.map((row) =>
        mapAppRowToCardProps(
          row,
          authorMap.get(row.author_id) ?? null,
          catMap.get(row.category_id) ?? null,
        ),
      );
    }
  }

  // Query 4 — check if the current viewer follows this profile.
  let followingInitial = false;
  if (viewer && viewer.user.id !== profile.id) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewer.user.id)
      .eq('followee_id', profile.id)
      .maybeSingle();
    followingInitial = !!followRow;
  }

  // profile.links is Json — cast to the known link shape.
  const links = (profile.links as { label: string; url: string }[] | null) ?? [];

  // Aggregate stats (matches prototype totalLikes / totalRemixes).
  const totalLikes = apps.reduce((s, a) => s + a.stats.likes, 0);
  const totalRemixes = apps.reduce((s, a) => s + a.stats.remixes, 0);

  // Build a User object for the Avatar component.
  const userForAvatar = {
    handle: profile.handle,
    hue: profile.hue,
    emoji: profile.emoji ?? '◇',
    display_name: profile.display_name,
  };

  const isOwnProfile = viewer?.user.id === profile.id;
  const isAuthenticated = !!viewer;

  // Determine which list to render for the active tab.
  // Remixes tab: no remixes table yet → empty state.
  const tabList = tab === 'liked' ? likedApps : tab === 'remixes' ? [] : apps;

  return (
    <div className="profile">
      <header className="profile-head">
        <div
          className="profile-banner"
          style={{
            background: `linear-gradient(135deg, oklch(72% 0.18 ${profile.hue}), oklch(60% 0.22 ${(profile.hue + 60) % 360}))`,
          }}
        >
          <i className="banner-noise" />
        </div>
        <div className="profile-id">
          <div className="profile-av" style={{ background: `oklch(72% 0.15 ${profile.hue})` }}>
            <Avatar user={userForAvatar} size={64} />
          </div>
          <div className="profile-meta">
            <h1>{profile.display_name}</h1>
            <div className="profile-handle">@{profile.handle}</div>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            {links.length > 0 && (
              <div className="profile-links">
                {links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="profile-actions">
            <FollowPill
              followeeId={profile.id}
              followeeHandle={profile.handle}
              followerHandle={viewer?.profile.handle ?? ''}
              initialFollowing={followingInitial}
              isAuthenticated={isAuthenticated}
              isOwnProfile={isOwnProfile}
            />
          </div>
        </div>

        <div className="profile-stats">
          <div className="pstat">
            <div className="pstat-n">{apps.length}</div>
            <div className="pstat-l">Apps shipped</div>
          </div>
          <div className="pstat">
            <div className="pstat-n">
              {totalLikes >= 1000
                ? `${(totalLikes / 1000).toFixed(1).replace(/\.0$/, '')}k`
                : totalLikes}
            </div>
            <div className="pstat-l">Total likes</div>
          </div>
          <div className="pstat">
            <div className="pstat-n">
              {totalRemixes >= 1000
                ? `${(totalRemixes / 1000).toFixed(1).replace(/\.0$/, '')}k`
                : totalRemixes}
            </div>
            <div className="pstat-l">Total remixes</div>
          </div>
          <div className="pstat">
            <div className="pstat-n">2.4k</div>
            <div className="pstat-l">Followers</div>
          </div>
          <div className="pstat">
            <div className="pstat-n">183</div>
            <div className="pstat-l">Following</div>
          </div>
          <div className="pstat">
            <div className="pstat-n">Mar &apos;24</div>
            <div className="pstat-l">Joined</div>
          </div>
        </div>
      </header>

      {/* Tabs — URL-driven; no client state needed */}
      <div className="profile-tabs">
        <a
          href={`/u/${profile.handle}?tab=apps`}
          className={'tab ' + (tab === 'apps' ? 'is-on' : '')}
        >
          Apps · {apps.length}
        </a>
        <a
          href={`/u/${profile.handle}?tab=remixes`}
          className={'tab ' + (tab === 'remixes' ? 'is-on' : '')}
        >
          Remixes · 0
        </a>
        <a
          href={`/u/${profile.handle}?tab=liked`}
          className={'tab ' + (tab === 'liked' ? 'is-on' : '')}
        >
          Liked · {tab === 'liked' ? likedApps.length : '?'}
        </a>
      </div>

      <GalleryGrid apps={tabList} />
    </div>
  );
}

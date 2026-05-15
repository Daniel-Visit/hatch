// Creator profile page — async RSC port of prototype/apps-gallery/profile.jsx.
// Query 1: fetch profile by handle (citext — case-insensitive).
// Query 2: fetch that creator's published apps; map to card props.

import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BentoCard, Avatar } from '../../_components/cards';
import { mapAppRowToCardProps } from '../../_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const supabase = await createSupabaseServerClient();

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
            <button type="button" disabled aria-label="coming soon" className="btn btn-ghost-2">
              + Follow
            </button>
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
        </div>
      </header>

      <div className="grid">
        {apps.map((app) => (
          <BentoCard key={app.id} app={app} onOpen={() => {}} onAuthor={() => {}} />
        ))}
      </div>
    </div>
  );
}

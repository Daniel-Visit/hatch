// Detail page — async RSC port of prototype/apps-gallery/detail.jsx.
// Queries Supabase for a single published app by slug, maps the row to the
// AppData contract, and renders the detail layout verbatim from the prototype.
// Like / save / contact action buttons are deferred (Phase 4-6 — read-only
// Phase 3) and rendered as disabled buttons with aria-label="coming soon".

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Avatar, CategoryBadge } from '@/app/_components/cards';
import { AppArt } from '@/app/_components/app-art';
import { Markdown } from '@/app/_components/markdown';
import { mapAppRowToCardProps, fmtNum } from '@/app/_components/data-mappers';
import type { Tables } from '@/lib/supabase/types';

// ── helpers ──────────────────────────────────────────────────────────────────

type ProfileData = {
  handle: string;
  hue: number;
  emoji: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
} | null;

function buildProfile(authorId: string, profileData: ProfileData): Tables<'profiles'> | null {
  if (!profileData) return null;
  return {
    id: authorId,
    handle: profileData.handle,
    hue: profileData.hue,
    emoji: profileData.emoji,
    display_name: profileData.display_name,
    avatar_url: profileData.avatar_url,
    bio: profileData.bio,
    created_at: '',
    updated_at: '',
    links: {},
    notification_prefs: {},
    theme_pref: '',
  };
}

// ── data fetching ─────────────────────────────────────────────────────────────

async function fetchApp(slug: string) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('apps')
    .select('*, author:profiles(handle, hue, emoji, display_name, avatar_url, bio)')
    .eq('slug', slug)
    .single();

  return data ?? null;
}

async function fetchCategory(categoryId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('categories').select('*').eq('id', categoryId).single();
  return data ?? null;
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await fetchApp(slug);
  if (!row) return { title: 'App not found' };
  return {
    title: `${row.title} — Hatch`,
    description: row.tagline,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await fetchApp(slug);

  if (!row) notFound();

  const profileData = row.author as ProfileData;
  const profile = buildProfile(row.author_id, profileData);
  const category = await fetchCategory(row.category_id);

  const app = mapAppRowToCardProps(row, profile, category);
  const u = app.author;

  return (
    <div className="detail" style={{ '--ax': app.accent } as React.CSSProperties}>
      <div className="detail-crumbs">
        <Link className="crumb-back" href="/">
          ← Back to gallery
        </Link>
        <span className="crumb-sep">/</span>
        <CategoryBadge cat={app.category} />
      </div>

      <header className="detail-head">
        <div className="detail-art">
          <AppArt kind={app.art} accent={app.accent} glyphSize={220} />
          <span className="detail-shipped">Shipped {app.published}</span>
        </div>

        <div className="detail-info">
          <h1>{app.title}</h1>
          <p className="detail-tagline">{app.tagline}</p>

          <div className="detail-author">
            <div className="card-author">
              <Avatar user={u} size={32} />
              <span>
                <b>{u.display_name}</b>
                <i>{u.handle}</i>
              </span>
            </div>
            <div className="detail-author-actions">
              <button type="button" className="btn btn-publish" disabled aria-label="coming soon">
                Contact me
              </button>
              <button type="button" className="btn btn-ghost-2" disabled aria-label="coming soon">
                Follow
              </button>
            </div>
          </div>

          <div className="detail-cta">
            {row.link ? (
              <a
                href={row.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg"
                style={{ background: app.accent }}
              >
                Open app
                <i className="arrow-out">↗</i>
              </a>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ background: app.accent }}
                disabled
              >
                Open app
                <i className="arrow-out">↗</i>
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost-2 btn-lg"
              disabled
              aria-label="coming soon"
            >
              Remix
            </button>
          </div>

          <div className="detail-stats">
            <div className="stat-block">
              <div className="stat-n">{fmtNum(app.stats.likes)}</div>
              <div className="stat-l">Likes</div>
            </div>
            <div className="stat-block">
              <div className="stat-n">{fmtNum(app.stats.remixes)}</div>
              <div className="stat-l">Remixes</div>
            </div>
            <div className="stat-block">
              <div className="stat-n">{fmtNum(app.stats.views)}</div>
              <div className="stat-l">Views</div>
            </div>
            <div className="stat-block">
              <div className="stat-n">
                {app.category ? `In ${app.category.label.toLowerCase()}` : ''}
              </div>
              <div className="stat-l">Category</div>
            </div>
          </div>
        </div>
      </header>

      {/* Action bar — like / save / share / comments deferred (Phase 4-6) */}
      <div className="action-bar">
        <button type="button" className="act-btn like" disabled aria-label="coming soon">
          <span className="act-i">♡</span>
          <span className="act-num">{fmtNum(app.stats.likes)}</span>
        </button>
        <button type="button" className="act-btn" disabled aria-label="coming soon">
          <span className="act-i">◌</span>
          <span className="act-num">{row.comments_count}</span>
        </button>
        <button type="button" className="act-btn" disabled aria-label="coming soon">
          <span className="act-i">↗</span>
          <span>Share</span>
        </button>
        <button type="button" className="act-btn" disabled aria-label="coming soon">
          <span className="act-i">⌬</span>
          <span>Remix</span>
          <span className="act-num">{fmtNum(app.stats.remixes)}</span>
        </button>
        <span className="act-sep" />
        <button type="button" className="act-btn" disabled aria-label="coming soon">
          <span className="act-i">⋯</span>
        </button>
        <span className="act-grow" />
        <button type="button" className="act-save" disabled aria-label="coming soon">
          ＋ Save
        </button>
      </div>

      <div className="detail-grid">
        <section className="detail-col">
          <div className="panel">
            <h3 className="panel-h">About this app</h3>
            <div className="panel-body">
              <Markdown>{row.description}</Markdown>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-h">Built with</h3>
            <div className="stack-row">
              {app.tags.map((t) => (
                <span key={t} className="stack-chip">
                  <i className="stack-dot" style={{ background: app.accent }} />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className="detail-side">
          <div className="panel panel-author">
            <Avatar user={u} size={56} />
            <b>{u.display_name}</b>
            <i>{u.handle}</i>
            {profile?.bio && <p>{profile.bio}</p>}
            <div className="panel-author-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled
                aria-label="coming soon"
              >
                Contact {u.display_name.split(' ')[0]}
              </button>
              <a href={`/u/${u.handle}`} className="btn btn-ghost-2 btn-block">
                View profile
              </a>
            </div>
            <span className="panel-author-tip">
              Investor or partner? Drop a DM — they review every inquiry.
            </span>
          </div>

          <div className="panel">
            <h3 className="panel-h">Share</h3>
            <div className="share-row">
              <button type="button" className="share-btn" disabled aria-label="coming soon">
                ⌘C Copy link
              </button>
              <div className="share-icons">
                <button type="button" className="btn btn-icon" disabled aria-label="coming soon">
                  𝕏
                </button>
                <button type="button" className="btn btn-icon" disabled aria-label="coming soon">
                  ↗
                </button>
                <button type="button" className="btn btn-icon" disabled aria-label="coming soon">
                  ⌬
                </button>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-h">Stats</h3>
            <div className="stack-row">
              <span className="stack-chip">♥ {fmtNum(app.stats.likes)} likes</span>
              <span className="stack-chip">⌬ {fmtNum(app.stats.remixes)} remixes</span>
              <span className="stack-chip">◎ {fmtNum(app.stats.views)} views</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

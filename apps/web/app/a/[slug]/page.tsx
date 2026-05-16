// Detail page — async RSC port of prototype/apps-gallery/detail.jsx.
// Queries Supabase for a single published app by slug, maps the row to the
// AppData contract, and renders the detail layout verbatim from the prototype.
// Wires the social action bar (like/save/share/remix counts) and threaded
// comments (top-level + 1-level replies) via server-side fetches; both
// components hydrate as client islands with optimistic mutations.

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import { Avatar, CategoryBadge } from '@/app/_components/cards';
import { AppArt } from '@/app/_components/app-art';
import { Markdown } from '@/app/_components/markdown';
import { ActionBar } from '@/app/_components/action-bar';
import { Comments } from '@/app/_components/comments';
import type { CommentNode } from '@/app/_components/comment-item';
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
    .select(
      '*, author:profiles!apps_author_id_fkey(handle, hue, emoji, display_name, avatar_url, bio)',
    )
    .eq('slug', slug)
    .maybeSingle();

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

type CommentAuthorJoin = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  hue: number;
  emoji: string | null;
};

type CommentRowWithAuthor = {
  id: string;
  body: string;
  created_at: string;
  is_deleted: boolean;
  likes_count: number;
  parent_id: string | null;
  author_id: string;
  author: CommentAuthorJoin | null;
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default async function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await fetchApp(slug);

  if (!row) notFound();

  const profileData = row.author as ProfileData;
  const profile = buildProfile(row.author_id, profileData);
  const category = await fetchCategory(row.category_id);

  const app = mapAppRowToCardProps(row, profile, category);
  const u = app.author;

  // ── viewer + social data ──────────────────────────────────────────────────
  const sb = await createSupabaseServerClient();
  const viewer = await getUser();
  const isAuthenticated = !!viewer?.user;
  const viewerId = viewer?.user.id ?? null;

  const [likeRow, saveRow, commentsRaw] = await Promise.all([
    isAuthenticated && viewerId
      ? sb
          .from('likes')
          .select('user_id')
          .eq('user_id', viewerId)
          .eq('app_id', row.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isAuthenticated && viewerId
      ? sb
          .from('saves')
          .select('user_id')
          .eq('user_id', viewerId)
          .eq('app_id', row.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from('comments')
      .select(
        `id, body, created_at, is_deleted, likes_count, parent_id, author_id,
         author:profiles!comments_author_id_fkey ( handle, display_name, avatar_url, hue, emoji )`,
      )
      .eq('app_id', row.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
  ]);

  const allComments = (commentsRaw.data ?? []) as unknown as CommentRowWithAuthor[];

  // Viewer's comment_likes for these comments (second query — depends on allComments).
  let likedCommentIds = new Set<string>();
  if (isAuthenticated && viewerId && allComments.length > 0) {
    const { data: liked } = await sb
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', viewerId)
      .in(
        'comment_id',
        allComments.map((c) => c.id),
      );
    likedCommentIds = new Set((liked ?? []).map((r) => r.comment_id));
  }

  const toNode = (c: CommentRowWithAuthor): CommentNode => ({
    id: c.id,
    body: c.body,
    relative_time: formatRelativeTime(c.created_at),
    is_creator: c.author_id === row.author_id,
    likes_count: c.likes_count,
    viewer_liked: likedCommentIds.has(c.id),
    author: {
      handle: c.author?.handle ?? '',
      display_name: c.author?.display_name ?? '',
      avatar_url: c.author?.avatar_url ?? null,
      hue: c.author?.hue ?? 0,
      emoji: c.author?.emoji ?? '◇',
    },
  });

  const topLevel = allComments.filter((c) => c.parent_id === null).map(toNode);
  const repliesByParent = new Map<string, CommentNode[]>();
  for (const c of allComments) {
    if (c.parent_id) {
      const arr = repliesByParent.get(c.parent_id) ?? [];
      arr.push(toNode(c));
      repliesByParent.set(c.parent_id, arr);
    }
  }
  const commentTree: CommentNode[] = topLevel.map((t) => ({
    ...t,
    replies: repliesByParent.get(t.id),
  }));
  const totalCommentCount = allComments.length;

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

      <ActionBar
        appId={row.id}
        slug={row.slug}
        remixesCount={row.remixes_count}
        initialLikesCount={row.likes_count}
        initialLiked={!!likeRow.data}
        initialSaved={!!saveRow.data}
        commentCount={totalCommentCount}
        isAuthenticated={isAuthenticated}
      />

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

          <Comments
            appId={row.id}
            slug={row.slug}
            initialComments={commentTree}
            isAuthenticated={isAuthenticated}
            viewer={
              isAuthenticated && viewer
                ? {
                    handle: viewer.profile.handle,
                    display_name: viewer.profile.display_name,
                    avatar_url: viewer.profile.avatar_url,
                    hue: viewer.profile.hue,
                    emoji: viewer.profile.emoji ?? '◇',
                  }
                : undefined
            }
          />
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

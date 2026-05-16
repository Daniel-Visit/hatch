// Root / — public landing for anonymous visitors.
// Signed-in users are redirected to /gallery (the app's main experience).
// Layout is full-bleed marketing (no shell sidebar), styled by ./landing.css.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { getUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AppArt } from './_components/app-art';
import { Avatar } from './_components/cards';
import { fmtNum } from './_components/data-mappers';

import './landing.css';

export const dynamic = 'force-dynamic';

type AppRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  accent: string;
  art_kind: string;
  hue: number;
  category_id: string;
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

const SELECT = `id, slug, title, tagline, accent, art_kind, hue, category_id, likes_count,
  comments_count, hot_score,
  author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)`;

// ──────────────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  // Auth-redirect: signed-in users skip the landing and go straight to the app.
  const u = await getUser();
  if (u) redirect('/gallery');

  // Public reads run as the admin client to bypass per-request auth setup —
  // every column queried below is publicly readable via RLS, so no leak.
  const sb = createSupabaseAdminClient();

  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [hotResult, countsApps, countsProfiles, countsToday] = await Promise.all([
    sb
      .from('apps')
      .select(SELECT)
      .eq('is_published', true)
      .order('hot_score', { ascending: false, nullsFirst: false })
      .limit(7),
    sb.from('apps').select('id', { count: 'exact', head: true }).eq('is_published', true),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb
      .from('apps')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .gte('published_at', since24h),
  ]);

  const hotApps: AppRow[] = (hotResult.data ?? []) as AppRow[];
  const heroFloat = hotApps.slice(0, 3);
  const galleryFour = hotApps.slice(0, 4);
  const totalApps = countsApps.count ?? 0;
  const totalBuilders = countsProfiles.count ?? 0;
  const launchedToday = countsToday.count ?? 0;

  return (
    <>
      {/* ── topbar ───────────────────────────────────────────────────────── */}
      <header className="landing-topbar">
        <div className="container landing-topbar-inner">
          <Link href="/" className="landing-logo" aria-label="Hatch">
            <span className="landing-logo-mark">
              <i className="landing-logo-mark-inner" />
            </span>
            <span className="landing-logo-text">
              Hatch
              <i className="landing-logo-dot" />
            </span>
          </Link>
          <nav className="landing-topnav">
            <Link href={'/gallery' as Route} className="btn">
              Browse gallery
            </Link>
            <Link href={'/sign-in' as Route} className="btn btn--primary">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-bg" />
        <div className="container hero-inner">
          <div>
            <span className="hero-badge">
              <span className="pill">v1</span>
              <span>AI-native product discovery for builders</span>
            </span>
            <h1 className="hero-title">
              Where builders <span className="grad">ship</span>, get{' '}
              <span className="grad">discovered</span>, and <span className="grad">connect</span>.
            </h1>
            <p className="hero-sub">
              Publish your side-project in 60 seconds. Let investors, collaborators, and AI agents
              find you — no polished decks, no cold DMs.
            </p>
            <div className="hero-cta-row">
              <Link href={'/sign-in' as Route} className="btn btn--primary btn--lg">
                Start building →
              </Link>
              <Link href={'/gallery' as Route} className="btn btn--lg">
                Explore the gallery
              </Link>
            </div>
            {(totalBuilders > 0 || launchedToday > 0) && (
              <div className="hero-meta">
                {totalBuilders > 0 && (
                  <div className="hero-meta-item">
                    <span>
                      <b>{fmtNum(totalBuilders)}</b>{' '}
                      {totalBuilders === 1 ? 'builder shipping' : 'builders shipping'}
                    </span>
                  </div>
                )}
                {launchedToday > 0 && (
                  <div className="hero-meta-item">
                    <span className="live-dot" />
                    <span>
                      <b>{launchedToday}</b> launched today
                    </span>
                  </div>
                )}
                {totalApps > 0 && (
                  <div className="hero-meta-item">
                    <span>
                      <b>{fmtNum(totalApps)}</b> apps live
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: floating composition built from real top-3 apps */}
          {heroFloat.length === 3 && (
            <div className="hero-stage" aria-hidden="true">
              <FloatMain app={heroFloat[0]} />
              <FloatMini app={heroFloat[1]} variant="left" />
              <FloatMini app={heroFloat[2]} variant="right" />
            </div>
          )}
        </div>
      </section>

      {/* ── gallery preview (real apps, no tabs in v1) ──────────────────── */}
      {galleryFour.length > 0 && (
        <section id="gallery" className="sect" style={{ background: 'var(--surface-2)' }}>
          <div className="container">
            <div className="gallery-head">
              <div style={{ maxWidth: 560 }}>
                <span className="section-eyebrow">
                  <span className="dot" />
                  live gallery
                </span>
                <h2 className="section-title" style={{ textAlign: 'left', margin: '14px 0 12px' }}>
                  What builders are shipping today
                </h2>
                <p className="section-sub" style={{ textAlign: 'left', margin: 0 }}>
                  A peek at the live feed. {fmtNum(totalApps)} apps shipped so far.
                </p>
              </div>
              <Link href={'/gallery' as Route} className="btn">
                See all →
              </Link>
            </div>

            <div className="gallery-row">
              {galleryFour.map((a) => (
                <MiniAppCard key={a.id} app={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── final CTA ────────────────────────────────────────────────────── */}
      <section className="final-cta">
        <div className="final-cta-bg" />
        <div className="container">
          <span className="section-eyebrow">
            <span className="dot" />
            ship something
          </span>
          <h2>
            Your project
            <br />
            deserves to be <span className="grad">seen</span>.
          </h2>
          <p>Sixty seconds from idea to live page. Free for builders.</p>
          <div className="hero-cta-row">
            <Link href={'/sign-in' as Route} className="btn btn--primary btn--lg">
              Start building →
            </Link>
            <Link href={'/gallery' as Route} className="btn btn--lg">
              Explore the gallery first
            </Link>
          </div>
        </div>
      </section>

      {/* ── footer (cleaned: only links that actually exist) ─────────────── */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <Link href="/" className="landing-logo" aria-label="Hatch">
                <span className="landing-logo-mark">
                  <i className="landing-logo-mark-inner" />
                </span>
                <span className="landing-logo-text">
                  Hatch
                  <i className="landing-logo-dot" />
                </span>
              </Link>
              <p className="footer-tag">
                Where builders ship, get discovered, and connect. Builder-centric, agent-native,
                made for shipping.
              </p>
            </div>
            <div className="footer-col">
              <h5>Product</h5>
              <ul>
                <li>
                  <Link href={'/gallery' as Route}>Gallery</Link>
                </li>
                <li>
                  <Link href={'/sign-in?next=/publish' as Route}>Publish</Link>
                </li>
                <li>
                  <Link href="/trending">Trending</Link>
                </li>
                <li>
                  <Link href="/search">Search</Link>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>For agents</h5>
              <ul>
                <li>
                  <Link href={'/sign-in?next=/settings/api-keys' as Route}>MCP server</Link>
                </li>
                <li>
                  <a
                    href="https://hatch-mcp-production.up.railway.app/health"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    MCP /health
                  </a>
                </li>
                <li>
                  <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">
                    OpenAPI
                  </a>
                </li>
                <li>
                  <a href="/llms.txt" target="_blank" rel="noopener noreferrer">
                    llms.txt
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>Repo</h5>
              <ul>
                <li>
                  <a
                    href="https://github.com/Daniel-Visit/hatch"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Hatch · Built by builders, for builders.</span>
          </div>
        </div>
      </footer>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Hero floating cards — render real top-3 apps with the same AppArt as gallery

function FloatMain({ app }: { app: AppRow }) {
  return (
    <div className="float-card float-card--main">
      <div className="appcard-art" style={{ borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}>
        <AppArt kind={app.art_kind} accent={app.accent} glyphSize={64} />
      </div>
      <div className="appcard-body">
        <div className="appcard-head">
          <Avatar
            user={{
              handle: app.author?.handle ?? '',
              hue: app.hue,
              emoji: '◇',
              display_name: app.author?.display_name ?? app.author?.handle ?? '',
            }}
            size={32}
          />
          <div style={{ flex: 1 }}>
            <div className="appcard-title">{app.title}</div>
            <div className="appcard-byline">by {app.author?.handle ?? '—'}</div>
          </div>
          <span className="appcard-cat">{app.category_id}</span>
        </div>
        <p className="appcard-desc">{app.tagline}</p>
        <div className="appcard-foot">
          <div className="appcard-stats">
            <span className="stat">♥ {fmtNum(app.likes_count)}</span>
            <span className="stat">◌ {fmtNum(app.comments_count)}</span>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ax)',
            }}
          >
            🔥 hot
          </span>
        </div>
      </div>
    </div>
  );
}

function FloatMini({ app, variant }: { app: AppRow; variant: 'left' | 'right' }) {
  return (
    <div className={`float-card float-card--${variant}`}>
      <div
        className="appcard-art"
        style={{ aspectRatio: '16/9', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}
      >
        <AppArt kind={app.art_kind} accent={app.accent} glyphSize={36} />
      </div>
      <div className="appcard-body" style={{ padding: '10px 12px' }}>
        <div className="appcard-title" style={{ fontSize: 13 }}>
          {app.title}
        </div>
        <div className="appcard-byline">by {app.author?.handle ?? '—'}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Gallery preview cards

function MiniAppCard({ app }: { app: AppRow }) {
  return (
    <article className="card appcard">
      <div className="appcard-art">
        <AppArt kind={app.art_kind} accent={app.accent} glyphSize={64} />
      </div>
      <div className="appcard-body">
        <div className="appcard-head">
          <Avatar
            user={{
              handle: app.author?.handle ?? '',
              hue: app.hue,
              emoji: '◇',
              display_name: app.author?.display_name ?? app.author?.handle ?? '',
            }}
            size={28}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="appcard-title">{app.title}</div>
            <div className="appcard-byline">by {app.author?.handle ?? '—'}</div>
          </div>
          <span className="appcard-cat">{app.category_id}</span>
        </div>
        <p className="appcard-desc">{app.tagline}</p>
        <div className="appcard-foot">
          <div className="appcard-stats">
            <span className="stat">♥ {fmtNum(app.likes_count)}</span>
            <span className="stat">◌ {fmtNum(app.comments_count)}</span>
          </div>
          <Link href={`/a/${app.slug}` as Route} className="appcard-link" aria-label="Open">
            →
          </Link>
        </div>
      </div>
    </article>
  );
}

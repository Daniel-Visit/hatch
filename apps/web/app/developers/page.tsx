// Public /developers page — how to build on Hatch via the MCP server
// (authenticated agent surface) and the public read-only REST API.
// Reuses the landing shell (Topbar / Footer / landing.css) so it reads as
// part of the same product surface, not a separate app.

import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { MCP_TOOL_GROUPS, MCP_ENDPOINT_URL } from '@hatch/shared';
import { getUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Topbar } from '@/app/_landing/topbar';
import { Footer } from '@/app/_landing/footer';
import { CopyBlock } from './_components/copy-block';
import { ApiKeyPanel, type ActiveKey } from './_components/api-key-panel';

import '../landing.css';
import './developers.css';

const API_BASE = 'https://hatchme.cc';

const MCP_ADD_CMD = `claude mcp add --transport http hatch ${MCP_ENDPOINT_URL} \\
  --header "Authorization: Bearer YOUR_KEY"`;

const MCP_JSON_CONFIG = JSON.stringify(
  {
    mcpServers: {
      hatch: {
        url: MCP_ENDPOINT_URL,
        headers: { Authorization: 'Bearer YOUR_KEY' },
      },
    },
  },
  null,
  2,
);

const MCP_RESOURCES = ['hatch://app/{slug}', 'hatch://profile/{handle}', 'hatch://notifications'];
const MCP_PROMPTS = ['draft_app_description', 'review_my_apps', 'compose_message'];

const API_RESPONSE_EXAMPLE = `{
  "apps": [
    {
      "slug": "lumen-fm",
      "title": "Lumen.fm",
      "tagline": "Ambient soundscapes for deep work",
      "category_id": "audio",
      "link": "https://lumen.fm",
      "tags": ["audio", "ambient"],
      "built_with": ["claude", "gpt-4o"],
      "published_at": "2026-05-01T12:00:00Z",
      "likes_count": 284,
      "comments_count": 32,
      "author": { "handle": "alex.k", "display_name": "Alex K" }
    }
  ],
  "next_cursor": "2026-05-01T12:00:00Z"
}`;

type Endpoint = {
  id: 'list' | 'detail' | 'profile' | 'categories' | 'search';
  path: string;
  params: { name: string; meta: string }[];
  example: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    id: 'list',
    path: '/api/v1/apps',
    params: [
      { name: 'category', meta: 'string · optional' },
      { name: 'limit', meta: 'int 1–100 · default 30' },
      { name: 'cursor', meta: 'ISO datetime · optional' },
    ],
    example: `curl ${API_BASE}/api/v1/apps?limit=10`,
  },
  {
    id: 'detail',
    path: '/api/v1/apps/{slug}',
    params: [],
    example: `curl ${API_BASE}/api/v1/apps/lumen-fm`,
  },
  {
    id: 'profile',
    path: '/api/v1/profiles/{handle}',
    params: [],
    example: `curl ${API_BASE}/api/v1/profiles/alex.k`,
  },
  {
    id: 'categories',
    path: '/api/v1/categories',
    params: [],
    example: `curl ${API_BASE}/api/v1/categories`,
  },
  {
    id: 'search',
    path: '/api/v1/search',
    params: [
      { name: 'q', meta: 'string 2–100 · required' },
      { name: 'limit', meta: 'int 1–50 · default 30' },
    ],
    example: `curl "${API_BASE}/api/v1/search?q=audio"`,
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Developers');
  return { title: t('MetaTitle'), description: t('MetaDescription') };
}

export default async function DevelopersPage() {
  const t = await getTranslations('Developers');
  const locale = await getLocale();
  const copy = { copyLabel: t('Copy'), copiedLabel: t('Copied') };

  // Step 1 is auth-aware: signed-in users generate / manage their key inline.
  const session = await getUser();
  let activeKey: ActiveKey | null = null;
  if (session) {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from('api_keys')
      .select('id, token_prefix, created_at, last_used_at')
      .eq('user_id', session.user.id)
      .is('revoked_at', null)
      .maybeSingle();
    if (data) {
      const never = t('ApiKey.Never');
      const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : never);
      activeKey = {
        id: data.id,
        tokenPrefix: data.token_prefix,
        meta: `${t('ApiKey.Created', { when: fmt(data.created_at) })} · ${t('ApiKey.LastUsed', {
          when: fmt(data.last_used_at),
        })}`,
      };
    }
  }

  const keyLabels = {
    signInPrompt: t('ApiKey.SignInPrompt'),
    signInCta: t('ApiKey.SignInCta'),
    noKeyHint: t('ApiKey.NoKeyHint'),
    generate: t('ApiKey.Generate'),
    generating: t('ApiKey.Generating'),
    revoke: t('ApiKey.Revoke'),
    revoking: t('ApiKey.Revoking'),
    saveNotice: t('ApiKey.SaveNotice'),
    lossWarning: t('ApiKey.LossWarning'),
    copy: t('Copy'),
    copied: t('Copied'),
    done: t('ApiKey.Done'),
    error: t('ApiKey.Error'),
  };

  return (
    <div className="landing-root">
      <Topbar />

      {/* ---------- Header ---------- */}
      <section className="sect">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">
              <span className="dot" />
              {t('Eyebrow')}
            </span>
            <h1 className="section-title">{t('Title')}</h1>
            <p className="section-sub">{t('Subhead')}</p>
          </div>

          <div className="dev-nav">
            <a href="#mcp" className="card dev-nav-card">
              <div className="dev-nav-kicker">{t('Nav.Mcp.Kicker')}</div>
              <h3>{t('Nav.Mcp.Title')}</h3>
              <p>{t('Nav.Mcp.Body')}</p>
            </a>
            <a href="#api" className="card dev-nav-card">
              <div className="dev-nav-kicker">{t('Nav.Api.Kicker')}</div>
              <h3>{t('Nav.Api.Title')}</h3>
              <p>{t('Nav.Api.Body')}</p>
            </a>
          </div>
        </div>
      </section>

      {/* ---------- MCP server ---------- */}
      <section id="mcp" className="sect" style={{ background: 'var(--surface-2)' }}>
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">
              <span className="dot" />
              {t('Mcp.Eyebrow')}
            </span>
            <h2 className="section-title">{t('Mcp.Title')}</h2>
            <p className="section-sub">{t('Mcp.Subhead')}</p>
          </div>

          <ol className="dev-steps">
            <li className="dev-step">
              <div className="dev-step-num">1</div>
              <div className="dev-step-body">
                <h3>{t('Mcp.Step1.Title')}</h3>
                <p>{t('Mcp.Step1.Body')}</p>
                <ApiKeyPanel
                  signedIn={session !== null}
                  activeKey={activeKey}
                  defaultKeyLabel={t('ApiKey.DefaultLabel')}
                  labels={keyLabels}
                />
              </div>
            </li>
            <li className="dev-step">
              <div className="dev-step-num">2</div>
              <div className="dev-step-body">
                <h3>{t('Mcp.Step2.Title')}</h3>
                <p>{t('Mcp.Step2.Body')}</p>
                <CopyBlock text={MCP_ADD_CMD} {...copy} />
                <p style={{ marginTop: 14 }}>{t('Mcp.Step2.ConfigNote')}</p>
                <CopyBlock text={MCP_JSON_CONFIG} {...copy} />
              </div>
            </li>
            <li className="dev-step">
              <div className="dev-step-num">3</div>
              <div className="dev-step-body">
                <h3>{t('Mcp.Step3.Title')}</h3>
                <p>{t('Mcp.Step3.Body')}</p>
                <CopyBlock text="claude mcp list" {...copy} />
              </div>
            </li>
          </ol>

          <div className="dev-surface">
            <div className="card dev-surface-col">
              <h3>{t('Mcp.Surface.Tools.Title')}</h3>
              <p className="dev-surface-sub">{t('Mcp.Surface.Tools.Sub')}</p>
              <ul className="dev-list">
                {[
                  ...MCP_TOOL_GROUPS.read,
                  ...MCP_TOOL_GROUPS.publish,
                  ...MCP_TOOL_GROUPS.social,
                ].map((tool) => (
                  <li key={tool}>
                    <span className="dot" />
                    {tool}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card dev-surface-col">
              <h3>{t('Mcp.Surface.Resources.Title')}</h3>
              <p className="dev-surface-sub">{t('Mcp.Surface.Resources.Sub')}</p>
              <ul className="dev-list">
                {MCP_RESOURCES.map((uri) => (
                  <li key={uri}>
                    <span className="dot" />
                    {uri}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card dev-surface-col">
              <h3>{t('Mcp.Surface.Prompts.Title')}</h3>
              <p className="dev-surface-sub">{t('Mcp.Surface.Prompts.Sub')}</p>
              <ul className="dev-list">
                {MCP_PROMPTS.map((name) => (
                  <li key={name}>
                    <span className="dot" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- REST API ---------- */}
      <section id="api" className="sect">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">
              <span className="dot" />
              {t('Api.Eyebrow')}
            </span>
            <h2 className="section-title">{t('Api.Title')}</h2>
            <p className="section-sub">{t('Api.Subhead')}</p>
          </div>

          <p className="mono" style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 20px' }}>
            {t('Api.RateLimit')}
          </p>

          <div className="dev-endpoints">
            {ENDPOINTS.map((ep) => (
              <div key={ep.id} className="card dev-endpoint">
                <div className="dev-endpoint-head">
                  <span className="dev-method">GET</span>
                  <code className="dev-path">{ep.path}</code>
                </div>
                <p>{t(`Api.Endpoints.${ep.id}.Desc`)}</p>
                {ep.params.length > 0 && (
                  <div className="dev-params">
                    {ep.params.map((p) => (
                      <div key={p.name} className="dev-param">
                        <span className="dev-param-name">{p.name}</span>
                        <span className="dev-param-meta">{p.meta}</span>
                        <span className="dev-param-desc">{t(`Api.Params.${p.name}`)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <CopyBlock text={ep.example} {...copy} />
              </div>
            ))}
          </div>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: '32px 0 10px',
            }}
          >
            {t('Api.ResponseNote')}
          </h3>
          <CopyBlock text={API_RESPONSE_EXAMPLE} {...copy} />

          <div className="dev-spec-row">
            <a href="/api/v1/openapi.json" className="btn" target="_blank" rel="noreferrer">
              {t('Api.SpecCta')}
            </a>
            <span className="dev-spec-note">{t('Api.SpecNote')}</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

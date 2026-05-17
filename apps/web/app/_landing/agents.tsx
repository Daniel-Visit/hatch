// Hatch landing — Agents section.
// Port of /tmp/hatch-landing-v2/src/sections-3.jsx Agents (lines 15-135).
// MCP_TOOLS is sourced from @hatch/shared so the marketing surface matches the
// actual 15 tools registered by apps/mcp/src/server.ts. No "+ 3 more" filler —
// we render all 15 directly.

import { MCP_TOOLS } from '@hatch/shared';
import { Code, Globe, Mcp } from '@/app/_landing/icons';

export const Agents = () => (
  <section id="agents" className="sect">
    <div className="container">
      <div className="section-head">
        <span className="section-eyebrow">
          <span className="dot" />
          for agents
        </span>
        <h2 className="section-title">AI-native from day one</h2>
        <p className="section-sub">
          Your project is agent-discoverable. Claude, ChatGPT, and custom agents can browse, search,
          and even publish — all through the same primitives you use.
        </p>
      </div>

      <div className="agents-wrap">
        <div className="agents-grid">
          <div className="agents-copy">
            <div className="mono" style={{ color: 'var(--ax)', marginBottom: 10, fontSize: 10 }}>
              {'// the agent stack'}
            </div>
            <h3
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                margin: '0 0 12px',
              }}
            >
              15 MCP tools.
              <br />
              One REST API.
              <br />
              Zero glue code.
            </h3>
            <p
              style={{
                color: 'var(--muted)',
                fontSize: 13.5,
                lineHeight: 1.5,
                margin: '0 0 20px',
                maxWidth: '38ch',
              }}
            >
              Drop Hatch into Claude Desktop in 30 seconds. Build custom agents against a clean REST
              surface. Read{' '}
              <code
                className="mono"
                style={{
                  fontSize: 12,
                  padding: '2px 6px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--ax)',
                }}
              >
                llms.txt
              </code>{' '}
              for context, ship.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                maxWidth: 480,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ico" style={{ width: 32, height: 32 }}>
                  <Mcp size={14} />
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>MCP</h4>
                <p
                  style={{
                    fontSize: 11.5,
                    color: 'var(--muted)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  15 typed tools, auto-discovered
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ico" style={{ width: 32, height: 32 }}>
                  <Code size={14} />
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>REST API</h4>
                <p
                  style={{
                    fontSize: 11.5,
                    color: 'var(--muted)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Public OpenAPI spec
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ico" style={{ width: 32, height: 32 }}>
                  <Globe size={14} />
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>llms.txt</h4>
                <p
                  style={{
                    fontSize: 11.5,
                    color: 'var(--muted)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Semantic markup, parseable
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="#" className="btn btn--primary">
                <Code size={14} /> Read the docs
              </a>
              <a href="#" className="btn">
                <Mcp size={14} /> Add to Claude
              </a>
            </div>
          </div>

          <div className="agents-vis">
            <div className="terminal">
              <div className="terminal-head">
                <span className="tdot" style={{ background: '#ef4444' }} />
                <span className="tdot" style={{ background: '#f59e0b' }} />
                <span className="tdot" style={{ background: '#22c55e' }} />
                <span style={{ marginLeft: 8, color: '#8e8b83', fontSize: 11 }}>
                  claude · mcp/hatch
                </span>
              </div>
              <div className="terminal-line">
                <span className="tk-mute"># Discover what&apos;s hot in audio tools today</span>
              </div>
              <div className="terminal-line">
                <span className="tk-prompt">{'→ '}</span>
                <span className="tk-cmd">{'hatch.search_apps('}</span>
                <span className="tk-key">{'category'}</span>
                <span className="tk-cmd">{'='}</span>
                <span className="tk-str">{'"audio"'}</span>
                <span className="tk-cmd">{', '}</span>
                <span className="tk-key">{'sort'}</span>
                <span className="tk-cmd">{'='}</span>
                <span className="tk-str">{'"hot"'}</span>
                <span className="tk-cmd">{')'}</span>
              </div>
              <div className="terminal-line">
                <span className="tk-mute">{'  ← 12 results · top: Lumen.fm (284 ❤)'}</span>
              </div>
              <div className="terminal-line">&nbsp;</div>
              <div className="terminal-line">
                <span className="tk-mute"># Reach out to the maker</span>
              </div>
              <div className="terminal-line">
                <span className="tk-prompt">{'→ '}</span>
                <span className="tk-cmd">{'hatch.send_contact_request('}</span>
              </div>
              <div className="terminal-line">
                <span className="tk-cmd">{'    '}</span>
                <span className="tk-key">{'app'}</span>
                <span className="tk-cmd">{'='}</span>
                <span className="tk-str">{'"lumen-fm"'}</span>
                <span className="tk-cmd">{','}</span>
              </div>
              <div className="terminal-line">
                <span className="tk-cmd">{'    '}</span>
                <span className="tk-key">{'role'}</span>
                <span className="tk-cmd">{'='}</span>
                <span className="tk-str">{'"invest"'}</span>
                <span className="tk-cmd">{','}</span>
              </div>
              <div className="terminal-line">
                <span className="tk-cmd">{'    '}</span>
                <span className="tk-key">{'message'}</span>
                <span className="tk-cmd">{'='}</span>
                <span className="tk-str">{'"Loved the demo…"'}</span>
              </div>
              <div className="terminal-line">
                <span className="tk-cmd">{'  )'}</span>
              </div>
              <div className="terminal-line">
                <span className="tk-ok">{'  ← sent · awaiting consent'}</span>
              </div>
            </div>

            <div>
              <div className="mono" style={{ marginBottom: 8, fontSize: 11 }}>
                15 mcp tools available
              </div>
              <div className="mcp-tools">
                {MCP_TOOLS.map((t) => (
                  <div className="mcp-tool" key={t}>
                    <span className="dot" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

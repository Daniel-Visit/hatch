// Hatch landing — Agents section.
// Port of /tmp/hatch-landing-v2/src/sections-3.jsx Agents (lines 15-135).
// MCP_TOOLS is sourced from @hatch/shared so the marketing surface matches the
// actual 15 tools registered by apps/mcp/src/server.ts. No "+ 3 more" filler —
// we render all 15 directly.

import { getTranslations } from 'next-intl/server';
import { MCP_TOOLS } from '@hatch/shared';
import { Code, Globe, Mcp } from '@/app/_landing/icons';

export const Agents = async () => {
  const tA = await getTranslations('Landing.Agents');
  return (
    <section id="agents" className="sect">
      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow">
            <span className="dot" />
            {tA('Eyebrow')}
          </span>
          <h2 className="section-title">{tA('Title')}</h2>
          <p className="section-sub">{tA('Subhead')}</p>
        </div>

        <div className="agents-wrap">
          <div className="agents-grid">
            <div className="agents-copy">
              <div className="mono" style={{ color: 'var(--ax)', marginBottom: 10, fontSize: 10 }}>
                {tA('StackComment')}
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
                {tA.rich('StackTitle', { br: () => <br /> })}
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
                {tA.rich('StackDescription', {
                  code: (chunks) => (
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
                      {chunks}
                    </code>
                  ),
                })}
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
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {tA('Cards.Mcp.Title')}
                  </h4>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: 'var(--muted)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {tA('Cards.Mcp.Description')}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="ico" style={{ width: 32, height: 32 }}>
                    <Code size={14} />
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {tA('Cards.Rest.Title')}
                  </h4>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: 'var(--muted)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {tA('Cards.Rest.Description')}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="ico" style={{ width: 32, height: 32 }}>
                    <Globe size={14} />
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {tA('Cards.Llms.Title')}
                  </h4>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: 'var(--muted)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {tA('Cards.Llms.Description')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="/developers#api" className="btn btn--primary">
                  <Code size={14} /> {tA('ReadDocs')}
                </a>
                <a href="/developers#mcp" className="btn">
                  <Mcp size={14} /> {tA('ConnectMcp')}
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
                    {tA('Terminal.Header')}
                  </span>
                </div>
                <div className="terminal-line">
                  <span className="tk-mute">{tA('Terminal.CommentDiscover')}</span>
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
                  <span className="tk-mute">{tA('Terminal.ResultSummary')}</span>
                </div>
                <div className="terminal-line">&nbsp;</div>
                <div className="terminal-line">
                  <span className="tk-mute">{tA('Terminal.CommentReachOut')}</span>
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
                  <span className="tk-ok">{tA('Terminal.OkSent')}</span>
                </div>
              </div>

              <div>
                <div className="mono" style={{ marginBottom: 8, fontSize: 11 }}>
                  {tA('ToolsAvailable')}
                </div>
                <div className="mcp-tools">
                  {MCP_TOOLS.map((tool) => (
                    <div className="mcp-tool" key={tool}>
                      <span className="dot" />
                      {tool}
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
};

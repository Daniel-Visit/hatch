// Hatch landing — For investors & collaborators.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx ForInvestors (lines 266-344).
// Mock conversation preview stays — this is a marketing/decoration section.

import { LandingAvatar } from '@/app/_landing/avatar';
import { Bolt, Layers, Lock } from '@/app/_landing/icons';

export const ForInvestors = () => (
  <section className="sect" style={{ background: 'var(--surface-2)' }}>
    <div className="container two-col">
      <div>
        <span className="section-eyebrow">
          <span className="dot" />
          for investors &amp; collaborators
        </span>
        <h2 className="section-title" style={{ textAlign: 'left', margin: '16px 0 18px' }}>
          Organic deal-flow,
          <br />
          without the cold-DM cringe.
        </h2>
        <p className="section-sub" style={{ textAlign: 'left', margin: '0 0 28px' }}>
          See what people are actually building today. Reach out with role and intent attached.
          Builders see exactly why you&apos;re knocking.
        </p>
        <div className="feature-list">
          <div className="feature-item">
            <div className="ico">
              <Bolt size={16} />
            </div>
            <div>
              <h4>Earliest possible signal</h4>
              <p>Hot ranking surfaces projects with traction in hours, not weeks.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="ico">
              <Lock size={16} />
            </div>
            <div>
              <h4>Respectful contact</h4>
              <p>Builders accept or decline. No spam, no ghost-inboxes.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="ico">
              <Layers size={16} />
            </div>
            <div>
              <h4>Clear intent labels</h4>
              <p>Invest · Collab · Hire — your role is visible before the first message.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LandingAvatar name="AK" hue={20} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>alex.k</div>
              <div className="mono" style={{ fontSize: 10 }}>
                Lumen.fm
              </div>
            </div>
          </div>
          <span
            className="role-pill active"
            style={{
              background: 'var(--ax)',
              color: '#fff',
              borderColor: 'transparent',
            }}
          >
            INVEST
          </span>
        </div>
        <div
          style={{
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                background: 'var(--ax)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '14px 14px 4px 14px',
                maxWidth: '75%',
                fontSize: 13,
              }}
            >
              Loved the demo. Pre-seed check, no pressure to reply. 30 min next week?
            </div>
          </div>
          <div
            className="mono"
            style={{ fontSize: 10, color: 'var(--muted)', alignSelf: 'flex-end' }}
          >
            delivered · 11:42
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '8px 12px',
                borderRadius: '14px 14px 14px 4px',
                maxWidth: '75%',
                fontSize: 13,
              }}
            >
              Yes — Thursday 3pm? I&apos;ll send a Cal link 🚀
            </div>
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            typing…
          </div>
        </div>
      </div>
    </div>
  </section>
);

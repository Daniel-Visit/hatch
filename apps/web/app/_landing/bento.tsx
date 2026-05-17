// Hatch landing — Bento feature grid.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx Bento (lines 169-225).
// Composes the 5 vis cells (Publish / Art / Contact / Notifs / Ranking).

import { ArtVis } from '@/app/_landing/bento/art-vis';
import { ContactVis } from '@/app/_landing/bento/contact-vis';
import { NotifsVis } from '@/app/_landing/bento/notifs-vis';
import { PublishVis } from '@/app/_landing/bento/publish-vis';
import { RankingVis } from '@/app/_landing/bento/ranking-vis';

export const Bento = () => (
  <section id="features" className="sect" style={{ background: 'var(--surface-2)' }}>
    <div className="container">
      <div className="section-head">
        <span className="section-eyebrow">
          <span className="dot" />
          features
        </span>
        <h2 className="section-title">Everything a side-project needs to be seen</h2>
        <p className="section-sub">
          A complete toolkit for shipping, surfacing, and connecting — built for the way builders
          actually work.
        </p>
      </div>

      <div className="bento">
        <div
          className="card bento-cell b-publish"
          style={{
            background: 'linear-gradient(135deg, var(--surface), var(--ax-tint))',
          }}
        >
          <div className="bento-tag">01 / publish</div>
          <div className="bento-copy">
            <h3>Ship it in 60 seconds</h3>
            <p>
              Name it, describe it, pick a vibe — you&apos;re live. No polished decks, no asset
              wrangling, no design pressure.
            </p>
          </div>
          <PublishVis />
        </div>

        <div
          className="card bento-cell b-art"
          style={{
            background: '#0f0c08',
            color: '#fff',
            borderColor: 'transparent',
            boxShadow: 'none',
          }}
        >
          <div
            className="bento-tag"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            02 / art
          </div>
          <div className="bento-copy">
            <h3 style={{ color: '#fff' }}>3 generative covers, custom uploads</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)' }}>
              Every project gets a unique generative cover. Re-roll until it sings.
            </p>
          </div>
          <ArtVis />
        </div>

        <div className="card bento-cell b-contact">
          <div className="bento-tag">03 / contact</div>
          <div className="bento-copy">
            <h3>Consent-based outreach</h3>
            <p>Investors and collaborators reach out with clear intent — never a cold DM.</p>
          </div>
          <ContactVis />
        </div>

        <div className="card bento-cell b-notifs">
          <div className="bento-tag">04 / signal</div>
          <div className="bento-copy">
            <h3>Real-time signal</h3>
            <p>Know instantly when someone likes, comments, or wants to talk.</p>
          </div>
          <NotifsVis />
        </div>

        <div className="card bento-cell b-ranking">
          <div className="bento-tag">05 / ranking</div>
          <div className="bento-copy">
            <h3>The best work surfaces</h3>
            <p>Community-driven hot ranking — no hunters, no gatekeepers.</p>
          </div>
          <RankingVis />
        </div>
      </div>
    </div>
  </section>
);

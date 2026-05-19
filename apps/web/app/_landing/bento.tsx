// Hatch landing — Bento feature grid.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx Bento (lines 169-225).
// Composes the 5 vis cells (Publish / Art / Contact / Notifs / Ranking).

import { getTranslations } from 'next-intl/server';
import { ScrollReveal } from './scroll-reveal';
import { PublishVis } from './bento/publish-vis';
import { ArtVis } from './bento/art-vis';
import { ContactVis } from './bento/contact-vis';
import { NotifsVis } from './bento/notifs-vis';
import { RankingVis } from './bento/ranking-vis';

export const Bento = async () => {
  const t = await getTranslations('Landing.Bento');
  return (
    <>
      <section className="snap-section sect" id="features" style={{ background: 'var(--surface-2)' }}>
        <div className="container">
          <ScrollReveal>
            <div className="section-head">
              <span className="section-eyebrow">
                <span className="dot" />
                {t('Eyebrow')}
              </span>
              <h2 className="section-title">{t('Title')}</h2>
              <p className="section-sub">{t('Subtitle')}</p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="bento">
              <div
                className="card bento-cell b-publish"
                style={{
                  background: 'linear-gradient(135deg, var(--surface), var(--ax-tint))',
                }}
              >
                <div className="bento-tag">{t('Publish.Tag')}</div>
                <div className="bento-copy">
                  <h3>{t('Publish.Title')}</h3>
                  <p>{t('Publish.Body')}</p>
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
                  {t('Art.Tag')}
                </div>
                <div className="bento-copy">
                  <h3 style={{ color: '#fff' }}>{t('Art.Title')}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.65)' }}>{t('Art.Body')}</p>
                </div>
                <ArtVis />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="snap-section sect" style={{ background: 'var(--surface-2)' }}>
        <div className="container">
          <ScrollReveal>
            <div className="bento">
              <div className="card bento-cell b-contact">
                <div className="bento-tag">{t('Contact.Tag')}</div>
                <div className="bento-copy">
                  <h3>{t('Contact.Title')}</h3>
                  <p>{t('Contact.Body')}</p>
                </div>
                <ContactVis />
              </div>

              <div className="card bento-cell b-notifs">
                <div className="bento-tag">{t('Notifs.Tag')}</div>
                <div className="bento-copy">
                  <h3>{t('Notifs.Title')}</h3>
                  <p>{t('Notifs.Body')}</p>
                </div>
                <NotifsVis />
              </div>

              <div className="card bento-cell b-ranking">
                <div className="bento-tag">{t('Ranking.Tag')}</div>
                <div className="bento-copy">
                  <h3>{t('Ranking.Title')}</h3>
                  <p>{t('Ranking.Body')}</p>
                </div>
                <RankingVis />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
};

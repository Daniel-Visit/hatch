// Hatch landing — Brief & Match section.
// Advertises the Wanted / Brief & Match service in the landing's design language.
// Dual-sided (seeker + builder); the two preview cards mock the real feature UI —
// the seeker match deck (brief → matched app, confidence %) and the builder inbox
// request card. Sits in page.tsx between <HowItWorks /> and <ForInvestors />.

import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Arrow, Bolt, Send } from '@/app/_landing/icons';

const GRAD: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f97316, #ec4899 45%, #a855f7 80%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
};

const ICO_BOX: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};

const CONF_PILL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  fontWeight: 600,
  color: 'var(--ax)',
  background: 'var(--ax-tint)',
  border: '1px solid var(--border)',
  padding: '3px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

export const BriefMatch = async () => {
  const t = await getTranslations('Landing.BriefMatch');

  return (
    <section id="match" className="sect">
      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow">
            <span className="dot" />
            {t('Eyebrow')}
          </span>
          <h2 className="section-title">
            {t.rich('Title', { grad: (chunks) => <span style={GRAD}>{chunks}</span> })}
          </h2>
          <p className="section-sub">{t('Subhead')}</p>
        </div>

        <div className="agents-wrap">
          <div className="bm-split">
            {/* ───────────────── Seeker ───────────────── */}
            <div className="bm-side bm-side--seeker">
              <div className="row" style={{ gap: 10 }}>
                <div style={{ ...ICO_BOX, background: 'var(--ax-tint)', color: 'var(--ax)' }}>
                  <Send size={16} />
                </div>
                <span className="bm-tag">{t('Seeker.Tag')}</span>
              </div>
              <h3>{t('Seeker.Heading')}</h3>
              <p>{t('Seeker.Body')}</p>

              {/* preview: brief → matched app (echoes the match deck) */}
              <div className="card" style={{ padding: 14, background: 'var(--surface)' }}>
                <div
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}
                >
                  {t('Seeker.BriefLabel')}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    marginBottom: 4,
                  }}
                >
                  {t('Seeker.BriefTitle')}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--muted)',
                    lineHeight: 1.4,
                    marginBottom: 12,
                  }}
                >
                  {t('Seeker.BriefDesc')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    paddingTop: 11,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>Lumen.fm</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {t('Seeker.AppKind')}
                    </div>
                  </div>
                  <span style={CONF_PILL}>92% match</span>
                </div>
              </div>

              <div className="bm-flow">
                <span className="bm-step">{t('Seeker.FlowDescribe')}</span>
                <span className="bm-sep">→</span>
                <span className="bm-step">{t('Seeker.FlowRefine')}</span>
                <span className="bm-sep">→</span>
                <span className="bm-step">{t('Seeker.FlowMatched')}</span>
              </div>

              <Link href={'/wanted/new' as Route} className="btn btn--primary btn--lg">
                {t('Seeker.Cta')} <Arrow size={14} />
              </Link>
            </div>

            {/* ───────────────── Builder ───────────────── */}
            <div className="bm-side bm-side--builder">
              <div className="row" style={{ gap: 10 }}>
                <div
                  style={{
                    ...ICO_BOX,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  <Bolt size={16} />
                </div>
                <span className="bm-tag">{t('Builder.Tag')}</span>
              </div>
              <h3>{t('Builder.Heading')}</h3>
              <p>{t('Builder.Body')}</p>

              {/* preview: incoming request (echoes the /requests inbox card) */}
              <div className="card" style={{ padding: 14, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span
                    className="avatar"
                    style={{
                      background: 'linear-gradient(135deg, hsl(255,68%,62%), hsl(290,60%,58%))',
                      width: 30,
                      height: 30,
                      fontSize: 12,
                    }}
                  >
                    MR
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>maya.r</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {t('Builder.Proposed')}
                    </div>
                  </div>
                  <span style={CONF_PILL}>78% match</span>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-2)',
                    lineHeight: 1.45,
                    marginBottom: 12,
                  }}
                >
                  {t('Builder.Rationale')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: 'var(--muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '6px 0',
                    }}
                  >
                    {t('Builder.Skip')}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#fff',
                      background: 'var(--ax)',
                      borderRadius: 8,
                      padding: '6px 0',
                    }}
                  >
                    {t('Builder.Connect')}
                  </span>
                </div>
              </div>

              <div className="bm-flow">
                <span className="bm-step">{t('Builder.FlowOptIn')}</span>
                <span className="bm-sep">→</span>
                <span className="bm-step">{t('Builder.FlowMatched')}</span>
                <span className="bm-sep">→</span>
                <span className="bm-step">{t('Builder.FlowAccept')}</span>
              </div>

              <Link href={'/settings/requests' as Route} className="btn btn--lg">
                {t('Builder.Cta')} <Arrow size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Hatch landing — For investors & collaborators.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx ForInvestors (lines 266-344).
// Mock conversation preview stays — this is a marketing/decoration section.

import { getTranslations } from 'next-intl/server';
import { ScrollReveal } from './scroll-reveal';
import { LandingAvatar } from '@/app/_landing/avatar';
import { Bolt, Layers, Lock } from '@/app/_landing/icons';

export const ForInvestors = async () => {
  const t = await getTranslations('Landing.ForInvestors');
  return (
    <section className="sect" style={{ background: 'var(--surface-2)' }}>
      <ScrollReveal>
        <div className="container two-col">
          <div>
            <span className="section-eyebrow">
              <span className="dot" />
              {t('Eyebrow')}
            </span>
            <h2 className="section-title" style={{ textAlign: 'left', margin: '16px 0 18px' }}>
              {t.rich('Title', { br: () => <br /> })}
            </h2>
            <p className="section-sub" style={{ textAlign: 'left', margin: '0 0 28px' }}>
              {t('Subhead')}
            </p>
            <div className="feature-list">
              <div className="feature-item">
                <div className="ico">
                  <Bolt size={16} />
                </div>
                <div>
                  <h4>{t('Features.Signal.Title')}</h4>
                  <p>{t('Features.Signal.Description')}</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="ico">
                  <Lock size={16} />
                </div>
                <div>
                  <h4>{t('Features.Contact.Title')}</h4>
                  <p>{t('Features.Contact.Description')}</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="ico">
                  <Layers size={16} />
                </div>
                <div>
                  <h4>{t('Features.Intent.Title')}</h4>
                  <p>{t('Features.Intent.Description')}</p>
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
                  <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {t('Preview.Handle')}
                  </div>
                  <div className="mono" style={{ fontSize: 10 }}>
                    {t('Preview.App')}
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
                {t('Preview.RoleInvest')}
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
                  {t('Preview.OutboundMessage')}
                </div>
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: 'var(--muted)', alignSelf: 'flex-end' }}
              >
                {t('Preview.DeliveredAt')}
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
                  {t('Preview.ReplyMessage')}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                {t('Preview.Typing')}
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

// Hatch landing — For investors & collaborators.
// Live-signal redesign (2026-06-30): the right column is a floating "stage"
// (notification + trending project + intent-tagged chat) with real depth,
// replacing the single flat chat card. Left column keeps the copy and gains
// intent role pills. Decoration only — no live data.

import { getTranslations } from 'next-intl/server';
import { LandingAvatar } from '@/app/_landing/avatar';
import { Bolt, Flame, HeartFill, Layers, Lock } from '@/app/_landing/icons';

export const ForInvestors = async () => {
  const t = await getTranslations('Landing.ForInvestors');

  return (
    <section className="sect sect-glow" style={{ background: 'var(--surface-2)' }}>
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
            <div className="di-feature">
              <div className="ico a">
                <Bolt size={17} />
              </div>
              <div>
                <h4>{t('Features.Signal.Title')}</h4>
                <p>{t('Features.Signal.Description')}</p>
              </div>
            </div>
            <div className="di-feature">
              <div className="ico b">
                <Lock size={17} />
              </div>
              <div>
                <h4>{t('Features.Contact.Title')}</h4>
                <p>{t('Features.Contact.Description')}</p>
              </div>
            </div>
            <div className="di-feature">
              <div className="ico c">
                <Layers size={17} />
              </div>
              <div>
                <h4>{t('Features.Intent.Title')}</h4>
                <p>{t('Features.Intent.Description')}</p>
                <div className="di-roles">
                  <span className="rp ax">{t('Roles.Invest')}</span>
                  <span className="rp">{t('Roles.Collab')}</span>
                  <span className="rp">{t('Roles.Hire')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* floating live-signal stage */}
        <div className="di-stage">
          {/* incoming intent notification */}
          <div className="di-float di-notif">
            <div className="nrow">
              <LandingAvatar name="JL" hue={150} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                  <b style={{ fontWeight: 600 }}>j.lee</b> {t('Stage.NotifAction')}
                </div>
                <div className="di-meta" style={{ marginTop: 3 }}>
                  {t('Stage.NotifWhen')}
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                  color: 'var(--ax)',
                  background: 'var(--ax-tint)',
                  border: '1px solid var(--border)',
                  padding: '2px 6px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('Stage.New')}
              </span>
            </div>
          </div>

          {/* trending project */}
          <div className="di-float di-proj">
            <div className="art">
              <span className="ring" />
              <span className="ring s" />
            </div>
            <div className="pbody">
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {t('Preview.App')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {t('Stage.By', { handle: t('Preview.Handle') })}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 9,
                  color: 'var(--muted)',
                  fontSize: 11.5,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: 'var(--red)',
                  }}
                >
                  <HeartFill size={13} /> 284
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--orange)',
                  }}
                >
                  <Flame size={12} /> {t('Stage.Hot')}
                </span>
              </div>
            </div>
          </div>

          {/* intent-tagged chat */}
          <div className="di-float di-chat">
            <div className="hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LandingAvatar name="AK" hue={20} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {t('Preview.Handle')}
                  </div>
                  <div className="di-meta">{t('Preview.App')}</div>
                </div>
              </div>
              <span
                className="role-pill active"
                style={{ background: 'var(--ax)', color: '#fff', borderColor: 'transparent' }}
              >
                {t('Roles.Invest')}
              </span>
            </div>
            <div className="bd">
              <div className="di-bub out">{t('Preview.OutboundMessage')}</div>
              <div className="di-meta" style={{ alignSelf: 'flex-end' }}>
                {t('Preview.DeliveredAt')}
              </div>
              <div className="di-bub in">{t('Preview.ReplyMessage')}</div>
              <div className="di-meta">{t('Preview.Typing')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Hatch landing — PublishVis bento cell.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx PublishVis (lines 10-47).
// Decorative; Server Component, no props, no state.

import { getTranslations } from 'next-intl/server';

export const PublishVis = async () => {
  const t = await getTranslations('Landing.Bento.Publish.Mini');
  return (
    <div
      className="bento-vis"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        margin: '8px -20px -20px -20px',
        paddingTop: 0,
        minHeight: 200,
        maxHeight: 220,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '70%',
          margin: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md) 0 0 0',
          boxShadow: 'var(--sh-2)',
          transform: 'translateX(20px) scale(0.88)',
          transformOrigin: 'bottom right',
        }}
      >
        <div className="publish-mini">
          <h5>{t('Heading')}</h5>
          <div className="input-row">
            <label>{t('NameLabel')}</label>
            <div className="fake-input">{t('NameValue')}</div>
          </div>
          <div className="input-row">
            <label>{t('OneLinerLabel')}</label>
            <div className="fake-input" style={{ color: 'var(--muted)' }}>
              {t('OneLinerValue')}
            </div>
          </div>
          <div className="input-row">
            <label>{t('VibeLabel')}</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['calm', 'focus', 'retro', 'glow'].map((v, i) => (
                <span
                  key={v}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: i === 1 ? 'var(--ax)' : 'var(--surface-2)',
                    color: i === 1 ? '#fff' : 'var(--text-2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div className="publish-progress">
            <div className="bar" />
          </div>
        </div>
      </div>
    </div>
  );
};

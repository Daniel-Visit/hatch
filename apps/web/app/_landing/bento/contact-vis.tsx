// Hatch landing — ContactVis bento cell.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx ContactVis (lines 69-89).
// Decorative; Server Component, no props, no state.

import { getTranslations } from 'next-intl/server';
import { Send } from '@/app/_landing/icons';

export const ContactVis = async () => {
  const t = await getTranslations('Landing.Bento.Contact.Card');
  return (
    <div
      className="bento-vis"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        margin: '8px 0 0px',
        paddingTop: 0,
        minHeight: 200,
        maxHeight: 230,
        overflow: 'hidden',
      }}
    >
      <div
        className="contact-modal"
        style={{
          margin: 0,
          width: '88%',
          borderRadius: 'var(--r-md)',
          transform: 'scale(0.82)',
          transformOrigin: 'bottom center',
        }}
      >
        <div className="mono" style={{ fontSize: 10, color: 'var(--ax)' }}>
          {t('Eyebrow')}
        </div>
        <h5>{t('Title')}</h5>
        <div className="role-pills">
          <span className="role-pill active">{t('RoleInvest')}</span>
          <span className="role-pill">{t('RoleCollab')}</span>
          <span className="role-pill">{t('RoleHire')}</span>
        </div>
        <div className="contact-input" style={{ fontFamily: 'var(--font-sans)' }}>
          {t('InputText')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
          <button
            type="button"
            className="btn"
            style={{ height: 28, fontSize: 11, padding: '0 10px' }}
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{ height: 28, fontSize: 11, padding: '0 10px' }}
          >
            <Send size={11} /> {t('Send')}
          </button>
        </div>
      </div>
    </div>
  );
};

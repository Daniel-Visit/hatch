// Hatch landing — NotifsVis bento cell.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx NotifsVis (lines 92-131).
// Decorative; Server Component, no props, no state.

import { getTranslations } from 'next-intl/server';
import { LandingAvatar } from '@/app/_landing/avatar';
import { Comment, HeartFill } from '@/app/_landing/icons';

export const NotifsVis = async () => {
  const t = await getTranslations('Landing.Bento.Notifs.Card');
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
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--sh-2)',
          width: '88%',
          margin: 0,
          transform: 'scale(0.82)',
          transformOrigin: 'bottom center',
        }}
      >
        <div className="notif-head">
          <span className="ttl">{t('Title')}</span>
          <span className="ct">{t('Count')}</span>
        </div>
        <div className="notif">
          <LandingAvatar name="MR" hue={290} size={24} />
          <div className="body">
            {t.rich('LikedYourProject', {
              b: (chunks) => <b>{chunks}</b>,
              name: 'maria.r',
            })}
            <br />
            <span style={{ color: 'var(--muted)' }}>{t('LikedMeta')}</span>
          </div>
          <HeartFill size={12} stroke={0} />
        </div>
        <div className="notif">
          <LandingAvatar name="JL" hue={140} size={24} />
          <div className="body">
            {t.rich('WantsToInvest', {
              b: (chunks) => <b>{chunks}</b>,
              name: 'j.lee',
            })}
            <br />
            <span style={{ color: 'var(--muted)' }}>{t('WantsToInvestMeta')}</span>
          </div>
          <span className="mono" style={{ fontSize: 9, color: 'var(--ax)' }}>
            {t('NewBadge')}
          </span>
        </div>
        <div className="notif">
          <LandingAvatar name="SO" hue={20} size={24} />
          <div className="body">
            {t.rich('Commented', {
              b: (chunks) => <b>{chunks}</b>,
              name: 's.okoye',
            })}
            <br />
            <span style={{ color: 'var(--muted)' }}>{t('CommentSnippet')}</span>
          </div>
          <Comment size={12} />
        </div>
      </div>
    </div>
  );
};

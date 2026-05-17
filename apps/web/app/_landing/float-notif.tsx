// Hatch landing floating notification — verbatim port of /tmp/hatch-landing-v2/src/sections-1.jsx FloatNotif.
// Avatar → LandingAvatar, Icons.Heart → Heart from this dir.

import { getTranslations } from 'next-intl/server';
import { LandingAvatar } from '@/app/_landing/avatar';
import { Heart } from '@/app/_landing/icons';

export const FloatNotif = async () => {
  const t = await getTranslations('Landing.Hero.FloatNotif');
  return (
    <div
      className="float-card float-card--notif"
      style={{ padding: '10px 12px' }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <LandingAvatar name="MR" hue={290} />
          <span
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--ax)',
              border: '2px solid var(--surface)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontSize: 8,
            }}
          >
            <Heart size={7} stroke={3} />
          </span>
        </div>
        <div style={{ fontSize: 12, flex: 1 }}>
          <b>maria.r</b> <span style={{ color: 'var(--muted)' }}>{t('Liked')}</span>
          <br />
          <span style={{ color: 'var(--text-2)' }}>{t('YourProject', { app: 'Lumen.fm' })}</span>
        </div>
      </div>
    </div>
  );
};

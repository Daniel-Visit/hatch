// Hatch landing — RankingVis bento cell.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx RankingVis (lines 134-167).
// Decorative; Server Component. The 4 mock items stay verbatim per spec (this is a
// decoration cell, not a live preview).

import { getTranslations } from 'next-intl/server';
import { Flame, Heart } from '@/app/_landing/icons';

type RankItem = { n: string; p: string; lead?: boolean };

const items: RankItem[] = [
  { n: 'Lumen.fm', p: '284', lead: true },
  { n: 'Orbital CRM', p: '212' },
  { n: 'Threadwise', p: '196' },
  { n: 'Pivot.ai', p: '148' },
];

export const RankingVis = async () => {
  const t = await getTranslations('Landing.Bento.Ranking.Card');
  return (
    <div
      className="bento-vis"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        margin: '8px 0 0px',
        paddingTop: 0,
        minHeight: 220,
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
          padding: '12px',
          transform: 'scale(0.86)',
          transformOrigin: 'bottom center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Flame size={13} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{t('HotToday')}</span>
        </div>
        <div className="rank-list">
          {items.map((it, i) => (
            <div className={'rank-item ' + (it.lead ? 'lead' : '')} key={it.n}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <span className="name">{it.n}</span>
              <span className="pts">
                {it.p}
                <Heart size={10} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

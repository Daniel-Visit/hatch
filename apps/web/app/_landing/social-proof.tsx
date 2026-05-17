// Hatch landing social-proof — verbatim port of /tmp/hatch-landing-v2/src/sections-1.jsx
// (Stat lines 203-208, builders array lines 210-223, SocialProof lines 225-247).
// Stats numbers (builders, apps published, connections made) come from real DB via `counts` prop.
// "12.4M agent calls / mo" stays mock — no MCP call metric exists yet.
// Builder marquee stays mock (decorative).

import { getTranslations } from 'next-intl/server';
import { LandingAvatar } from '@/app/_landing/avatar';

type StatProps = { num: string; label: string };

const Stat = ({ num, label }: StatProps) => (
  <div className="stat-block">
    <div className="stat-num">{num}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const builders = [
  { n: 'AK', name: 'alex.k', role: 'audio · indie' },
  { n: 'MR', name: 'maria.r', role: 'design · solo' },
  { n: 'JL', name: 'j.lee', role: 'ai · pre-seed' },
  { n: 'SO', name: 's.okoye', role: 'devtools' },
  { n: 'NT', name: 'nat.t', role: 'games · 2-person' },
  { n: 'PV', name: 'priya.v', role: 'hardware' },
  { n: 'DM', name: 'd.morales', role: 'fintech' },
  { n: 'YC', name: 'yuki.c', role: 'creator tools' },
  { n: 'EB', name: 'e.boateng', role: 'ai · seed' },
  { n: 'RK', name: 'r.kapoor', role: 'productivity' },
  { n: 'LF', name: 'l.fischer', role: 'data · indie' },
  { n: 'OC', name: 'o.costa', role: 'social' },
];

type SocialProofProps = {
  counts: { builders: number; apps: number; connections: number };
};

export const SocialProof = async ({ counts }: SocialProofProps) => {
  const t = await getTranslations('Landing.SocialProof');
  return (
    <section className="marquee-section">
      <div className="container">
        <div className="stats-row">
          <Stat num={counts.builders.toLocaleString()} label={t('BuildersShipping')} />
          <Stat num={counts.apps.toLocaleString()} label={t('AppsPublished')} />
          <Stat num={counts.connections.toLocaleString()} label={t('ConnectionsMade')} />
          <Stat num={t('AgentCallsValue')} label={t('AgentCalls')} />
        </div>
      </div>
      <div className="marquee">
        <div className="marquee-track">
          {[...builders, ...builders].map((b, i) => (
            <div className="marquee-item" key={i}>
              <LandingAvatar name={b.n} hue={(i * 47) % 360} />
              <span>{b.name}</span>
              <span className="role">{b.role}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

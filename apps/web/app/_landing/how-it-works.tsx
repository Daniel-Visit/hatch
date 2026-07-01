// Hatch landing — How it works.
// Connected-timeline redesign (2026-06-30): the four steps sit on a single
// gradient rail with icon "nodes", replacing the four flat identical cards.

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { Flame, GitHub, Plus, Send } from '@/app/_landing/icons';

type Step = { ico: ReactNode; n: string; t: string; d: string };

export const HowItWorks = async () => {
  const t = await getTranslations('Landing.HowItWorks');

  const steps: Step[] = [
    {
      ico: <GitHub size={20} />,
      n: '01',
      t: t('Steps.SignIn.Title'),
      d: t('Steps.SignIn.Description'),
    },
    {
      ico: <Plus size={20} />,
      n: '02',
      t: t('Steps.Publish.Title'),
      d: t('Steps.Publish.Description'),
    },
    {
      ico: <Flame size={20} />,
      n: '03',
      t: t('Steps.GetDiscovered.Title'),
      d: t('Steps.GetDiscovered.Description'),
    },
    {
      ico: <Send size={20} />,
      n: '04',
      t: t('Steps.Connect.Title'),
      d: t('Steps.Connect.Description'),
    },
  ];

  return (
    <section id="how" className="sect sect-glow">
      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow">
            <span className="dot" />
            {t('Eyebrow')}
          </span>
          <h2 className="section-title">{t('Title')}</h2>
          <p className="section-sub">{t('Subhead')}</p>
        </div>

        <div className="hiw-timeline">
          <div className="hiw-rail" />
          {steps.map((s) => (
            <div className="hiw-node" key={s.n}>
              <div className="hiw-dot">{s.ico}</div>
              <div className="hiw-num">{t('StepLabel', { n: s.n })}</div>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

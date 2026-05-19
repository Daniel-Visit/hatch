// Hatch landing — How it works.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx HowItWorks (lines 232-260).

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { ScrollReveal } from './scroll-reveal';
import { Flame, GitHub, Plus, Send } from '@/app/_landing/icons';

type Step = { ico: ReactNode; n: string; t: string; d: string };

export const HowItWorks = async () => {
  const t = await getTranslations('Landing.HowItWorks');

  const steps: Step[] = [
    {
      ico: <GitHub size={18} />,
      n: '01',
      t: t('Steps.SignIn.Title'),
      d: t('Steps.SignIn.Description'),
    },
    {
      ico: <Plus size={18} />,
      n: '02',
      t: t('Steps.Publish.Title'),
      d: t('Steps.Publish.Description'),
    },
    {
      ico: <Flame size={18} />,
      n: '03',
      t: t('Steps.GetDiscovered.Title'),
      d: t('Steps.GetDiscovered.Description'),
    },
    {
      ico: <Send size={18} />,
      n: '04',
      t: t('Steps.Connect.Title'),
      d: t('Steps.Connect.Description'),
    },
  ];

  return (
    <section id="how" className="sect snap-section">
      <ScrollReveal>
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">
              <span className="dot" />
              {t('Eyebrow')}
            </span>
            <h2 className="section-title">{t('Title')}</h2>
            <p className="section-sub">{t('Subhead')}</p>
          </div>
          <div className="steps">
            {steps.map((s) => (
              <div className="card step" key={s.n}>
                <div className="step-icon">{s.ico}</div>
                <div className="step-num">{t('StepLabel', { n: s.n })}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

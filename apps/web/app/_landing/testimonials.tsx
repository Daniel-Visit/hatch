// Hatch landing testimonials — verbatim port of /tmp/hatch-landing-v2/src/sections-3.jsx
// (Testimonials, lines 211-253). The 3 mock quotes are intentional copy placeholders.

import { getTranslations } from 'next-intl/server';
import { ScrollReveal } from './scroll-reveal';
import { LandingAvatar } from '@/app/_landing/avatar';
import { Diamond } from '@/app/_landing/icons';

export const Testimonials = async () => {
  const t = await getTranslations('Landing.Testimonials');

  const quotes = [
    {
      q: t('Quotes.One.Quote'),
      n: t('Quotes.One.Name'),
      r: t('Quotes.One.Role'),
      hue: 20,
      av: 'AK',
    },
    {
      q: t('Quotes.Two.Quote'),
      n: t('Quotes.Two.Name'),
      r: t('Quotes.Two.Role'),
      hue: 280,
      av: 'JL',
    },
    {
      q: t('Quotes.Three.Quote'),
      n: t('Quotes.Three.Name'),
      r: t('Quotes.Three.Role'),
      hue: 210,
      av: 'MC',
    },
  ];

  return (
    <section className="sect">
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
          <div className="tests">
            {quotes.map((q, i) => (
              <div className="card test" key={i}>
                <Diamond size={20} />
                <p className="test-quote">&quot;{q.q}&quot;</p>
                <div className="test-author">
                  <LandingAvatar name={q.av} hue={q.hue} />
                  <div className="meta">
                    <div className="n">{q.n}</div>
                    <div className="r">{q.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

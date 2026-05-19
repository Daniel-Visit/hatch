// Hatch landing final-cta — verbatim port of /tmp/hatch-landing-v2/src/sections-3.jsx
// (FinalCta, lines 258-274). CTA anchors converted to Next Link targeting /sign-in and /gallery.

import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { ScrollReveal } from './scroll-reveal';
import { Arrow } from '@/app/_landing/icons';

export const FinalCta = async () => {
  const t = await getTranslations('Landing.FinalCta');
  return (
    <section className="final-cta snap-section">
      <div className="final-cta-bg" />
      <ScrollReveal>
        <div className="container">
        <span className="section-eyebrow">
          <span className="dot" />
          {t('Eyebrow')}
        </span>
        <h2>
          {t.rich('Title', {
            br: () => <br />,
            grad: (chunks) => <span className="grad">{chunks}</span>,
          })}
        </h2>
        <p>{t('Subtitle')}</p>
        <div className="hero-cta-row">
          <Link href={'/sign-in' as Route} className="btn btn--primary btn--lg">
            {t('CtaStart')} <Arrow size={14} />
          </Link>
          <Link href={'/gallery' as Route} className="btn btn--lg">
            {t('CtaExplore')}
          </Link>
        </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

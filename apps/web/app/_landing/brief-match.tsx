// Hatch landing — Brief & Match section.
// AI-search redesign (2026-06-30): a search bar states the need in plain words,
// and the matched results render as gallery cards with generative cover art +
// a match %, echoing the bento cover-art visual language. The last card routes
// to the builder side ("nothing fits? a builder makes it"). Sits between
// <HowItWorks /> and <ForInvestors /> in page.tsx.

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Arrow, Search } from '@/app/_landing/icons';

// Generative cover art (same language as the bento covers).
const RingsArt = () => (
  <div className="gen ms-art" style={{ background: '#fbeede' }}>
    <span className="rng" style={{ width: 34, height: 34, border: '2px solid #f59e0b' }} />
    <span className="rng" style={{ width: 62, height: 62, border: '2px solid #f472b6' }} />
    <span className="rng" style={{ width: 90, height: 90, border: '2px solid #fb923c' }} />
    <span className="dotc" style={{ width: 14, height: 14, background: '#f97316' }} />
  </div>
);

const StripesArt = () => (
  <div className="gen ms-art" style={{ background: 'linear-gradient(125deg, #6366f1, #a855f7)' }}>
    <span className="stp" />
  </div>
);

const BokehArt = () => (
  <div className="gen ms-art" style={{ background: '#0e1512' }}>
    <span
      className="bk"
      style={{ width: 48, height: 48, background: '#22c55e', left: '16%', top: '26%' }}
    />
    <span
      className="bk"
      style={{ width: 62, height: 62, background: '#14b8a6', left: '56%', top: '52%' }}
    />
    <span
      className="bk"
      style={{ width: 30, height: 30, background: '#34d399', left: '74%', top: '18%' }}
    />
  </div>
);

type Result = { name: string; category: string; pct: string; art: ReactNode };

export const BriefMatch = async () => {
  const t = await getTranslations('Landing.BriefMatch');

  const existing = t('Results.ExistingApp');
  const results: Result[] = [
    { name: 'Lumen.fm', category: t('Results.Audio'), pct: '92%', art: <RingsArt /> },
    { name: 'Focusflow', category: t('Results.Productivity'), pct: '74%', art: <StripesArt /> },
    { name: 'Calm Canvas', category: t('Results.Wellbeing'), pct: '61%', art: <BokehArt /> },
  ];

  return (
    <section id="match" className="sect">
      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow">
            <span className="dot" />
            {t('Eyebrow')}
          </span>
          <h2 className="section-title">
            {t.rich('Title', {
              grad: (chunks) => <span style={{ color: 'var(--ax)' }}>{chunks}</span>,
            })}
          </h2>
          <p className="section-sub">{t('Subhead')}</p>
        </div>

        <div className="ms-search">
          <span className="si">
            <Search size={19} />
          </span>
          <span className="st">
            {t('SearchQuery')}
            <span className="cs" />
          </span>
          <Link href={'/wanted/new' as Route} className="btn btn--primary" style={{ height: 40 }}>
            {t('SearchCta')}
          </Link>
        </div>

        <div className="ms-grid">
          {results.map((r) => (
            <div className="card ms-card" key={r.name}>
              <span className="ms-badge">{r.pct}</span>
              {r.art}
              <div className="ms-body">
                <div className="t">{r.name}</div>
                <div className="k">
                  {existing} · {r.category}
                </div>
              </div>
            </div>
          ))}

          <Link href={'/wanted/new' as Route} className="card ms-card ms-builder">
            <span
              className="avatar"
              style={{
                background: 'linear-gradient(135deg, hsl(255,68%,62%), hsl(290,60%,58%))',
                width: 38,
                height: 38,
                fontSize: 13,
              }}
            >
              MR
            </span>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {t('BuilderCard.Heading')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>
              {t('BuilderCard.Body')}
            </div>
          </Link>
        </div>

        <div className="ms-cta">
          <Link href={'/wanted/new' as Route} className="btn btn--primary btn--lg">
            {t('CtaSeeker')} <Arrow size={14} />
          </Link>
          <Link href={'/settings/requests' as Route} className="link">
            {t('CtaBuilder')} <Arrow size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
};

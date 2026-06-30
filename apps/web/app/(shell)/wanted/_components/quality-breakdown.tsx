'use client';

// Per-section quality bars for the Brief Health Card (§4.4.5).
//
// Verbatim prototype-port of the `.health-section-list` / `.health-section-row`
// markup from new/mockups.html (#healthcard). A score of null renders as "—"
// with a 0% bar and the "missing" badge.

import { useTranslations } from 'next-intl';
import { healthBadgeFor } from './health-badges';

export type SectionScore = {
  /** The brief content path or grouping label shown in the `.name` column. */
  name: string;
  /** 0–1 score, or null when the section was not scored (missing). */
  score: number | null;
};

export function QualityBreakdown({ sections }: { sections: SectionScore[] }) {
  const t = useTranslations('Wanted.HealthCard');

  return (
    <div className="health-section-list">
      <h3>{t('qualityBySection')}</h3>
      {sections.map((section) => {
        const badge = healthBadgeFor(section.score);
        const ok = badge.key === 'good';
        return (
          <div className={`health-section-row ${ok ? 'is-ok' : 'is-attn'}`} key={section.name}>
            <span className="health-section-ico">{ok ? '✓' : '○'}</span>
            <span className="name">{section.name}</span>
            <span className="health-section-note">{t(`note.${badge.key}`)}</span>
          </div>
        );
      })}
    </div>
  );
}

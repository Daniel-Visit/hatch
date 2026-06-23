'use client';

// Match-potential "current → with suggestions" block for the Brief Health Card
// (§4.4.5). Verbatim prototype-port of the `.match-potential*` markup from
// new/mockups.html (#healthcard). The delta pill is hidden when the gap is 0.

import { useTranslations } from 'next-intl';

type MatchPotentialDeltaProps = {
  current: number;
  withSuggestions: number;
};

export function MatchPotentialDelta({ current, withSuggestions }: MatchPotentialDeltaProps) {
  const t = useTranslations('Wanted.HealthCard');
  const delta = withSuggestions - current;

  return (
    <div className="match-potential">
      <div className="match-potential-glyph">✨</div>
      <div className="match-potential-content">
        <div className="match-potential-side">
          <span className="label">{t('matchPotentialCurrentLabel')}</span>
          <span className="value">{current}</span>
          <span className="hint">{t('matchPotentialHint')}</span>
        </div>
        <span className="match-potential-arrow">→</span>
        <div className="match-potential-side">
          <span className="label">{t('matchPotentialWithSuggestions')}</span>
          <span className="value">{withSuggestions}</span>
          <span className="hint">{t('matchPotentialHint')}</span>
        </div>
        {delta > 0 && <span className="match-potential-delta">↑ +{delta}</span>}
      </div>
    </div>
  );
}

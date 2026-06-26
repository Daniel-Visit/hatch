'use client';

// Brief Health Card client (§4.4.5). Full-page review of the Validator output.
//
// Behaviors:
//   - Overall quality bar + per-section breakdown (QualityBreakdown).
//   - Match-potential current → withSuggestions (MatchPotentialDelta), updated
//     live as suggestions are applied (cheap heuristic returned by the apply
//     endpoint — no LLM re-call).
//   - Each suggestion: Apply (PATCHes content via the apply endpoint, collapses
//     to "✓ Applied") / Dismiss (hides it).
//   - "Publish as-is": enabled only when qualityScore >= 0.5 → POST /approve →
//     /wanted/[id]/matches. Disabled below the floor with a tooltip.
//   - "Apply all & re-validate": applies every pending suggestion, then publishes.
//
// Verbatim prototype-port: `.health-card*` / `.health-foot` / `.suggestions-*`
// markup from new/mockups.html (#healthcard). No Tailwind.

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { QualityBreakdown, type SectionScore } from '../../_components/quality-breakdown';
import { MatchPotentialDelta } from '../../_components/match-potential-delta';
import { SuggestionRow, type SuggestionView } from '../../_components/suggestion-row';

export type InitialHealth = {
  briefId: string;
  qualityScore: number;
  qualityBySection: Record<string, number>;
  matchPotential: { current: number; withSuggestions: number };
  suggestions: SuggestionView[];
};

const PUBLISH_FLOOR = 0.5;

export function HealthCardClient({ initial }: { initial: InitialHealth }) {
  const t = useTranslations('Wanted.HealthCard');
  const router = useRouter();

  const [qualityScore] = useState(initial.qualityScore);
  const [matchPotential, setMatchPotential] = useState(initial.matchPotential);
  const [suggestions, setSuggestions] = useState<SuggestionView[]>(initial.suggestions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const sections: SectionScore[] = useMemo(
    () =>
      Object.entries(initial.qualityBySection).map(([name, score]) => ({
        name,
        score: typeof score === 'number' ? score : null,
      })),
    [initial.qualityBySection],
  );

  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING');

  const applyOne = useCallback(
    async (id: string, customValue: string): Promise<boolean> => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/v1/briefs/${initial.briefId}/suggestions/${id}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ customValue }),
        });
        if (!res.ok) {
          setNotice(t('suggestionApply'));
          return false;
        }
        const j = (await res.json()) as {
          appliedValue: string;
          newMatchPotentialEstimate?: { current: number; withSuggestions: number };
        };
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, status: 'APPLIED', appliedValue: j.appliedValue } : s,
          ),
        );
        if (j.newMatchPotentialEstimate) {
          setMatchPotential(j.newMatchPotentialEstimate);
        }
        return true;
      } catch {
        setNotice(t('suggestionApply'));
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [initial.briefId, t],
  );

  const handleApply = useCallback(
    (id: string, customValue: string) => void applyOne(id, customValue),
    [applyOne],
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/v1/briefs/${initial.briefId}/suggestions/${id}/dismiss`, {
          method: 'POST',
        });
        if (!res.ok) {
          setNotice(t('suggestionDismiss'));
          return;
        }
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      } catch {
        setNotice(t('suggestionDismiss'));
      } finally {
        setBusyId(null);
      }
    },
    [initial.briefId, t],
  );

  const publish = useCallback(async () => {
    if (qualityScore < PUBLISH_FLOOR || publishing) return;
    setNotice(null);
    setPublishing(true);
    try {
      const res = await fetch(`/api/v1/briefs/${initial.briefId}/approve`, { method: 'POST' });
      if (!res.ok) {
        setPublishing(false);
        setNotice(t('publishAsIsCta'));
        return;
      }
      router.push(`/wanted/${initial.briefId}/matches` as Route);
    } catch {
      setPublishing(false);
      setNotice(t('publishAsIsCta'));
    }
  }, [qualityScore, publishing, initial.briefId, router, t]);

  const handleApplyAll = useCallback(async () => {
    setNotice(null);
    setPublishing(true);
    // Apply each pending suggestion sequentially so each match-potential update
    // lands in order. Then publish — publish() manages setPublishing(false) on
    // failure and navigates on success, so we must NOT clear the flag before it.
    for (const s of pendingSuggestions) {
      await applyOne(s.id, s.exampleBetter);
    }
    await publish();
  }, [pendingSuggestions, applyOne, publish]);

  const pct = Math.round(qualityScore * 100);
  const canPublish = qualityScore >= PUBLISH_FLOOR && !publishing;

  return (
    <div className="health-card">
      {/* Header */}
      <div className="health-card-head">
        <div className="health-card-head-text">
          <h1>{t('pageTitle')}</h1>
          <p>{t('pageSubtitle')}</p>
        </div>
        <div className="health-overall-score">
          <span className="health-overall-score-label">{t('qualityLabel')}</span>
          <div className="health-overall-score-value">
            <span className="health-overall-score-num">{qualityScore.toFixed(2)}</span>
            <span className="health-score-bar">
              <span className="health-score-bar-fill" style={{ width: `${pct}%` }} />
            </span>
          </div>
        </div>
      </div>

      {/* Per-section breakdown */}
      {sections.length > 0 && <QualityBreakdown sections={sections} />}

      {/* Match potential */}
      <MatchPotentialDelta
        current={matchPotential.current}
        withSuggestions={matchPotential.withSuggestions}
      />

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="suggestions-section">
          <div className="suggestions-head">
            <h3>
              {pendingSuggestions.length} {t('suggestionsTitle')}
            </h3>
          </div>
          {suggestions.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              busy={busyId === s.id || publishing}
              onApply={handleApply}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {notice && (
        <div className="health-foot" role="status">
          <span className="secondary-note" style={{ color: '#dc2626' }}>
            {notice}
          </span>
        </div>
      )}

      {/* Footer CTAs */}
      <div className="health-foot">
        <span className="secondary-note">
          {canPublish ? t('secondaryNote') : t('publishAsIsDisabledTooltip')}
        </span>
        <button
          className="btn btn-ghost-2"
          onClick={publish}
          disabled={!canPublish}
          title={canPublish ? undefined : t('publishAsIsDisabledTooltip')}
        >
          {t('publishAsIsCta')}
        </button>
        {pendingSuggestions.length > 0 && (
          <button className="btn btn-primary" onClick={handleApplyAll} disabled={publishing}>
            {t('applyAllCta')}
          </button>
        )}
      </div>
    </div>
  );
}

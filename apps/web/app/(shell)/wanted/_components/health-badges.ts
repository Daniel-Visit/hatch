// Pure helper: classify a per-section quality score into a Health Card badge
// (§4.4.5 / §3.4.3). good >= 0.6, weak below, missing when unscored (null).
// Extracted from quality-breakdown.tsx so the threshold is unit-testable.

export type HealthBadgeKey = 'good' | 'weak' | 'missing';

export function healthBadgeFor(score: number | null): {
  cls: string;
  key: HealthBadgeKey;
} {
  if (score === null) return { cls: 'health-badge-missing', key: 'missing' };
  if (score >= 0.6) return { cls: 'health-badge-good', key: 'good' };
  return { cls: 'health-badge-weak', key: 'weak' };
}

import { ACTIVE_BRIEF_STATUSES, type BriefEntryMode } from '@hatch/shared';

// Re-export for brief-repo convenience — callers can also import directly from '@hatch/shared'.
export { ACTIVE_BRIEF_STATUSES };

/** Maximum number of briefs a seeker may hold in active statuses simultaneously. §1.7 */
export const MAX_ACTIVE_BRIEFS = 3;

/**
 * Returns true when the seeker has met or exceeded the active-brief quota.
 *
 * §1.7: a seeker may have at most 3 briefs in statuses:
 * REFINING | PARSING | AWAITING_VALIDATION | REVIEW_HEALTH | MATCHING | PRIVATE.
 *
 * `activeCount` is expected to be the result of a DB count filtered by
 * `ACTIVE_BRIEF_STATUSES` for the relevant user.
 */
export function isQuotaExceeded(activeCount: number): boolean {
  return activeCount >= MAX_ACTIVE_BRIEFS;
}

/**
 * Returns true when both scores satisfy the quality gate required for a brief
 * to reach MATCHING / PRIVATE / PUBLIC status.
 *
 * §1.7: `Brief.status IN (MATCHING, PRIVATE, PUBLIC)` requires
 * `completenessScore >= 0.5 AND qualityScore >= 0.5`.
 *
 * `completenessScore` comes from `computeCompletenessScore` (pure function).
 * `qualityScore` comes from the Validator agent (one LLM call, §3.4).
 */
export function meetsQualityGate(
  completenessScore: number,
  qualityScore: number,
): boolean {
  return completenessScore >= 0.5 && qualityScore >= 0.5;
}

/**
 * Returns true when the CHAT-mode invariant is satisfied (ok to proceed).
 *
 * §1.7: `Brief.entryMode = CHAT` requires at least one `BriefRefinementTurn`
 * with `role = USER`. For non-CHAT entry modes the invariant does not apply
 * and this function always returns true.
 *
 * `userTurnCount` should be the count of turns with role USER for this brief.
 */
export function chatRequiresUserTurn(
  entryMode: BriefEntryMode,
  userTurnCount: number,
): boolean {
  if (entryMode !== 'CHAT') return true;
  return userTurnCount >= 1;
}

/**
 * Thrown by the brief repository when `createBrief` would push the seeker's
 * active-brief count past the quota.
 */
export class BriefQuotaExceededError extends Error {
  constructor(activeCount: number) {
    super(
      `Brief quota exceeded: ${activeCount} active briefs (max ${MAX_ACTIVE_BRIEFS}).`,
    );
    this.name = 'BriefQuotaExceededError';
  }
}

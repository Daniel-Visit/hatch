import { type BriefContent } from './brief-content';

/**
 * Computes a completeness score for a BriefContent draft.
 *
 * Score is in [0, 1] — the fraction of 10 boolean presence checks that pass.
 * It measures whether required fields are *present and non-empty*, NOT whether
 * they are semantically specific or actionable. Semantic quality is a separate
 * concern handled by the Validator agent (§1.7.1 / §3.4).
 *
 * Used by:
 * - The Refiner agent after each turn to decide whether to stop (score >= 0.7).
 * - The server to enforce the quality gate before publishing (score >= 0.5).
 *
 * Reference: 03-agents.md §3.1.6.
 */
export function computeCompletenessScore(content: BriefContent): number {
  const checks = [
    !!content.title,
    !!content.problem?.trigger,
    !!content.problem?.currentWorkaround,
    !!content.desiredOutcome?.definitionOfGoodEnough,
    (content.desiredOutcome?.mustHaves?.length ?? 0) >= 1,
    (content.desiredOutcome?.outOfScope?.length ?? 0) >= 1, // critical signal
    !!content.context?.technicalLevel,
    !!content.constraints?.budgetBand,
    !!content.constraints?.timeline,
    (content.preferredSolutionType?.length ?? 0) >= 1,
  ];
  return checks.filter(Boolean).length / checks.length;
}

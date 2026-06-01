import { describe, it, expect } from 'vitest';
import { type BriefContent } from '@hatch/shared';
import { computeCompletenessScore } from './completeness';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** All 10 checks fail — parsed via the schema defaults, or just typed directly. */
const emptyContent: BriefContent = {
  title: undefined,
  problem: {
    trigger: undefined,
    affected: undefined,
    currentWorkaround: undefined,
    costOfNotSolving: undefined,
  },
  desiredOutcome: {
    definitionOfGoodEnough: undefined,
    mustHaves: [],
    niceToHaves: [],
    outOfScope: [],
  },
  context: {
    industry: undefined,
    useCase: undefined,
    technicalLevel: undefined,
    existingStack: [],
  },
  constraints: {
    budgetBand: undefined,
    timeline: undefined,
    licensing: 'no_pref',
    geography: null,
  },
  preferredSolutionType: [],
};

/**
 * Exactly 5 of the 10 checks pass:
 *   1. title ✓
 *   2. problem.trigger ✓
 *   3. problem.currentWorkaround ✗
 *   4. desiredOutcome.definitionOfGoodEnough ✗
 *   5. desiredOutcome.mustHaves >= 1 ✓
 *   6. desiredOutcome.outOfScope >= 1 ✗
 *   7. context.technicalLevel ✗
 *   8. constraints.budgetBand ✓
 *   9. constraints.timeline ✓
 *  10. preferredSolutionType >= 1 ✗
 */
const halfContent: BriefContent = {
  title: 'My project',
  problem: {
    trigger: 'Something triggered this',
    affected: undefined,
    currentWorkaround: undefined,
    costOfNotSolving: undefined,
  },
  desiredOutcome: {
    definitionOfGoodEnough: undefined,
    mustHaves: ['Must do X'],
    niceToHaves: [],
    outOfScope: [],
  },
  context: {
    industry: undefined,
    useCase: undefined,
    technicalLevel: undefined,
    existingStack: [],
  },
  constraints: {
    budgetBand: 'lt_500',
    timeline: 'weeks',
    licensing: 'no_pref',
    geography: null,
  },
  preferredSolutionType: [],
};

/**
 * All 10 checks pass:
 *   1. title ✓
 *   2. problem.trigger ✓
 *   3. problem.currentWorkaround ✓
 *   4. desiredOutcome.definitionOfGoodEnough ✓
 *   5. desiredOutcome.mustHaves >= 1 ✓
 *   6. desiredOutcome.outOfScope >= 1 ✓
 *   7. context.technicalLevel ✓
 *   8. constraints.budgetBand ✓
 *   9. constraints.timeline ✓
 *  10. preferredSolutionType >= 1 ✓
 */
const fullContent: BriefContent = {
  title: 'My complete brief',
  problem: {
    trigger: 'I hit this problem every week',
    affected: 'Just me',
    currentWorkaround: 'I do it manually in a spreadsheet',
    costOfNotSolving: 'Wastes 2 hours per week',
  },
  desiredOutcome: {
    definitionOfGoodEnough: 'Saves at least 1 hour per week',
    mustHaves: ['Single-sign-on', 'Mobile responsive'],
    niceToHaves: ['Dark mode'],
    outOfScope: ['Native mobile app'],
  },
  context: {
    industry: 'SaaS',
    useCase: 'team',
    technicalLevel: 'semi_technical',
    existingStack: ['Postgres', 'React'],
  },
  constraints: {
    budgetBand: 'from_500_2k',
    timeline: 'months',
    licensing: 'saas_ok',
    geography: null,
  },
  preferredSolutionType: ['existing_app', 'custom_build'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeCompletenessScore', () => {
  it('returns 0 for empty content (all 10 checks fail)', () => {
    expect(computeCompletenessScore(emptyContent)).toBe(0);
  });

  it('returns 0.5 for content where exactly 5 of 10 checks pass', () => {
    expect(computeCompletenessScore(halfContent)).toBe(0.5);
  });

  it('returns 1 for fully populated content (all 10 checks pass)', () => {
    expect(computeCompletenessScore(fullContent)).toBe(1);
  });

  it('each present field increments the score by 0.1', () => {
    // Build incrementally — each step adds exactly one passing check.
    const base = computeCompletenessScore(emptyContent); // 0
    const withTitle = computeCompletenessScore({ ...emptyContent, title: 'T' });
    expect(withTitle - base).toBeCloseTo(0.1);
  });

  it('mustHaves: [] does not satisfy the mustHaves>=1 check', () => {
    const content: BriefContent = { ...fullContent, desiredOutcome: { ...fullContent.desiredOutcome, mustHaves: [] } };
    // 9 out of 10
    expect(computeCompletenessScore(content)).toBeCloseTo(0.9);
  });

  it('outOfScope: [] does not satisfy the outOfScope>=1 check', () => {
    const content: BriefContent = { ...fullContent, desiredOutcome: { ...fullContent.desiredOutcome, outOfScope: [] } };
    // 9 out of 10
    expect(computeCompletenessScore(content)).toBeCloseTo(0.9);
  });

  it('preferredSolutionType: [] does not satisfy the preferredSolutionType>=1 check', () => {
    const content: BriefContent = { ...fullContent, preferredSolutionType: [] };
    expect(computeCompletenessScore(content)).toBeCloseTo(0.9);
  });
});

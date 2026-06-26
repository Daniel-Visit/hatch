import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import { applyDraftPatch } from './brief-state';

// Deep partial helper — relaxes nested object shapes for test patch fixtures.
// applyDraftPatch accepts Partial<BriefContent>, but BriefContent's sub-types
// (desiredOutcome, context, constraints) have required array/object fields that
// are awkward to repeat in partial patches.  Casting via this alias is safe
// because applyDraftPatch spreads sub-objects, so absent sub-fields come from
// the existing content rather than the patch.
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
type Patch = DeepPartial<BriefContent>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const emptyContent: BriefContent = {
  problem: {},
  desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
  context: { existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

const fullContent: BriefContent = {
  title: 'Invoicing tool',
  problem: {
    trigger: 'End of month chaos',
    affected: 'Freelancer',
    currentWorkaround: 'Google Sheets',
    costOfNotSolving: '3 hours/month',
  },
  desiredOutcome: {
    definitionOfGoodEnough: 'PDF invoice in 2 minutes',
    mustHaves: ['a', 'b'],
    niceToHaves: ['c'],
    outOfScope: ['d'],
  },
  context: {
    industry: 'Design',
    useCase: 'personal',
    technicalLevel: 'non_technical',
    existingStack: ['Figma'],
  },
  constraints: {
    budgetBand: 'lt_500',
    timeline: 'weeks',
    licensing: 'saas_ok',
    geography: null,
  },
  preferredSolutionType: ['existing_app'],
};

// ---------------------------------------------------------------------------
// applyDraftPatch — pure function, no DB
// ---------------------------------------------------------------------------

describe('applyDraftPatch', () => {
  // -------------------------------------------------------------------------
  // Nested object merge — patch wins, absent fields preserved
  // -------------------------------------------------------------------------
  it('merges nested objects field-by-field (patch wins, absent patch fields preserved)', () => {
    const patch: Patch = {
      problem: { trigger: 'New trigger' },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    // Patched field wins
    expect(result.problem.trigger).toBe('New trigger');
    // Absent patch fields preserved from original
    expect(result.problem.affected).toBe('Freelancer');
    expect(result.problem.currentWorkaround).toBe('Google Sheets');
    expect(result.problem.costOfNotSolving).toBe('3 hours/month');
  });

  it('merges desiredOutcome object field-by-field', () => {
    const patch: Patch = {
      desiredOutcome: { definitionOfGoodEnough: 'Done in 1 minute' },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(result.desiredOutcome.definitionOfGoodEnough).toBe('Done in 1 minute');
    // Existing arrays preserved when not in patch (arrays in desiredOutcome
    // are preserved because the whole sub-object spread merges them in)
    expect(result.desiredOutcome.mustHaves).toEqual(['a', 'b']);
  });

  it('merges constraints field-by-field', () => {
    const patch: Patch = {
      constraints: { budgetBand: 'from_500_2k' },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(result.constraints.budgetBand).toBe('from_500_2k');
    // Other constraint fields preserved
    expect(result.constraints.timeline).toBe('weeks');
    expect(result.constraints.licensing).toBe('saas_ok');
  });

  it('merges context field-by-field', () => {
    const patch: Patch = {
      context: { industry: 'Legal' },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(result.context.industry).toBe('Legal');
    expect(result.context.useCase).toBe('personal');
    expect(result.context.technicalLevel).toBe('non_technical');
  });

  // -------------------------------------------------------------------------
  // Arrays replaced entirely, NOT concatenated
  // -------------------------------------------------------------------------
  it('replaces mustHaves array entirely (not concatenated)', () => {
    const patch: Patch = {
      desiredOutcome: { mustHaves: ['x'] },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    // Must be ['x'], NOT ['a', 'b', 'x']
    expect(result.desiredOutcome.mustHaves).toEqual(['x']);
  });

  it('replaces niceToHaves array entirely', () => {
    const patch: Patch = {
      desiredOutcome: { niceToHaves: ['z'] },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(result.desiredOutcome.niceToHaves).toEqual(['z']);
  });

  it('replaces outOfScope array entirely', () => {
    const patch: Patch = {
      desiredOutcome: { outOfScope: ['y'] },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(result.desiredOutcome.outOfScope).toEqual(['y']);
  });

  it('replaces existingStack array entirely', () => {
    const patch: Patch = {
      context: { existingStack: ['React', 'Postgres'] },
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(result.context.existingStack).toEqual(['React', 'Postgres']);
  });

  it('replaces preferredSolutionType array entirely', () => {
    const patch: Patch = {
      preferredSolutionType: ['custom_build'],
    };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    // Must be ['custom_build'], NOT ['existing_app', 'custom_build']
    expect(result.preferredSolutionType).toEqual(['custom_build']);
  });

  // -------------------------------------------------------------------------
  // Scalar (top-level) field replacement
  // -------------------------------------------------------------------------
  it('replaces title scalar when present in patch', () => {
    const patch: Patch = { title: 'New title' };
    const result = applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(result.title).toBe('New title');
  });

  // -------------------------------------------------------------------------
  // Immutability — original content must NOT be mutated
  // -------------------------------------------------------------------------
  it('does NOT mutate the input content object', () => {
    const original = JSON.parse(JSON.stringify(fullContent)) as BriefContent;
    const patch: Patch = {
      title: 'Mutated?',
      problem: { trigger: 'Mutated trigger' },
      desiredOutcome: { mustHaves: ['mutated'] },
    };

    applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    // fullContent must be unchanged
    expect(fullContent).toEqual(original);
  });

  it('does NOT mutate nested objects on the input', () => {
    const originalProblem = { ...fullContent.problem };
    const patch: Patch = {
      problem: { trigger: 'Changed' },
    };

    applyDraftPatch(fullContent, patch as Partial<BriefContent>);

    expect(fullContent.problem.trigger).toBe(originalProblem.trigger);
  });

  // -------------------------------------------------------------------------
  // Edge cases — empty inputs
  // -------------------------------------------------------------------------
  it('returns content unchanged when patch is {}', () => {
    const result = applyDraftPatch(fullContent, {});

    expect(result.title).toBe(fullContent.title);
    expect(result.problem).toEqual(fullContent.problem);
    expect(result.desiredOutcome).toEqual(fullContent.desiredOutcome);
    expect(result.context).toEqual(fullContent.context);
    expect(result.constraints).toEqual(fullContent.constraints);
    expect(result.preferredSolutionType).toEqual(fullContent.preferredSolutionType);
  });

  it('handles empty {} content with a non-empty patch', () => {
    const patch: Patch = {
      title: 'First title',
      problem: { trigger: 'Initial trigger' },
    };
    const result = applyDraftPatch(emptyContent, patch as Partial<BriefContent>);

    expect(result.title).toBe('First title');
    expect(result.problem.trigger).toBe('Initial trigger');
    // Empty sections should still exist as objects
    expect(result.desiredOutcome).toBeDefined();
    expect(result.preferredSolutionType).toEqual([]);
  });

  it('handles empty {} content with empty {} patch', () => {
    const result = applyDraftPatch(emptyContent, {});

    expect(result.preferredSolutionType).toEqual([]);
    expect(result.problem).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Multi-field patch — all sections updated in one call
  // -------------------------------------------------------------------------
  it('applies a multi-section patch correctly', () => {
    const patch: Patch = {
      title: 'Multi patch',
      problem: { trigger: 'T', affected: 'A' },
      desiredOutcome: { mustHaves: ['must1', 'must2'], outOfScope: ['out1'] },
      context: { technicalLevel: 'developer', existingStack: ['Node'] },
      constraints: { budgetBand: 'gt_10k', timeline: 'months' },
      preferredSolutionType: ['fork_and_modify'],
    };

    const result = applyDraftPatch(emptyContent, patch as Partial<BriefContent>);

    expect(result.title).toBe('Multi patch');
    expect(result.problem.trigger).toBe('T');
    expect(result.problem.affected).toBe('A');
    expect(result.desiredOutcome.mustHaves).toEqual(['must1', 'must2']);
    expect(result.desiredOutcome.outOfScope).toEqual(['out1']);
    expect(result.context.technicalLevel).toBe('developer');
    expect(result.context.existingStack).toEqual(['Node']);
    expect(result.constraints.budgetBand).toBe('gt_10k');
    expect(result.constraints.timeline).toBe('months');
    expect(result.preferredSolutionType).toEqual(['fork_and_modify']);
  });
});

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import { setContentPath, BRIEF_CONTENT_PATHS } from './brief-state';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseContent: BriefContent = {
  title: 'Original title',
  problem: {
    trigger: 'Original trigger',
    affected: 'Original affected',
    currentWorkaround: 'Spreadsheet',
    costOfNotSolving: '2h/week',
  },
  desiredOutcome: {
    definitionOfGoodEnough: 'Done in 1 click',
    mustHaves: ['a', 'b'],
    niceToHaves: ['c'],
    outOfScope: ['d'],
  },
  context: {
    industry: 'Finance',
    useCase: 'personal',
    technicalLevel: 'developer',
    existingStack: ['React'],
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
// setContentPath — pure function, no network / DB
// ---------------------------------------------------------------------------

describe('setContentPath', () => {
  // -------------------------------------------------------------------------
  // 1-level paths
  // -------------------------------------------------------------------------
  it('sets a 1-level scalar field (title)', () => {
    const result = setContentPath(baseContent, 'title', 'New title');
    expect(result.title).toBe('New title');
  });

  it('sets the top-level preferredSolutionType array', () => {
    const result = setContentPath(baseContent, 'preferredSolutionType', [
      'custom_build',
      'consulting',
    ]);
    expect(result.preferredSolutionType).toEqual(['custom_build', 'consulting']);
  });

  it('replaces preferredSolutionType array entirely (not concatenated)', () => {
    const result = setContentPath(baseContent, 'preferredSolutionType', ['fork_and_modify']);
    // Must be the new array only, not merged with ['existing_app']
    expect(result.preferredSolutionType).toEqual(['fork_and_modify']);
  });

  // -------------------------------------------------------------------------
  // 2-level paths — problem.*
  // -------------------------------------------------------------------------
  it('sets problem.trigger', () => {
    const result = setContentPath(baseContent, 'problem.trigger', 'New trigger text');
    expect(result.problem.trigger).toBe('New trigger text');
  });

  it('preserves other problem fields when setting problem.trigger', () => {
    const result = setContentPath(baseContent, 'problem.trigger', 'Changed');
    expect(result.problem.affected).toBe('Original affected');
    expect(result.problem.currentWorkaround).toBe('Spreadsheet');
    expect(result.problem.costOfNotSolving).toBe('2h/week');
  });

  // -------------------------------------------------------------------------
  // 2-level paths — desiredOutcome.*
  // -------------------------------------------------------------------------
  it('sets desiredOutcome.mustHaves (array replacement)', () => {
    const result = setContentPath(baseContent, 'desiredOutcome.mustHaves', ['x', 'y']);
    expect(result.desiredOutcome.mustHaves).toEqual(['x', 'y']);
    // Must be replaced, not concatenated: original was ['a', 'b']
    expect(result.desiredOutcome.mustHaves).not.toContain('a');
  });

  it('sets desiredOutcome.definitionOfGoodEnough', () => {
    const result = setContentPath(baseContent, 'desiredOutcome.definitionOfGoodEnough', 'Fast');
    expect(result.desiredOutcome.definitionOfGoodEnough).toBe('Fast');
    // Other fields preserved
    expect(result.desiredOutcome.mustHaves).toEqual(['a', 'b']);
    expect(result.desiredOutcome.niceToHaves).toEqual(['c']);
  });

  // -------------------------------------------------------------------------
  // Immutability — input must NOT be mutated
  // -------------------------------------------------------------------------
  it('does NOT mutate the input content object (1-level)', () => {
    const snapshot = JSON.parse(JSON.stringify(baseContent)) as BriefContent;
    setContentPath(baseContent, 'title', 'Should not mutate');
    expect(baseContent).toEqual(snapshot);
  });

  it('does NOT mutate the input content object (2-level)', () => {
    const snapshot = JSON.parse(JSON.stringify(baseContent)) as BriefContent;
    setContentPath(baseContent, 'problem.trigger', 'Should not mutate');
    expect(baseContent).toEqual(snapshot);
  });

  it('does NOT mutate nested sections on input', () => {
    const originalProblem = { ...baseContent.problem };
    setContentPath(baseContent, 'problem.affected', 'Changed');
    expect(baseContent.problem.affected).toBe(originalProblem.affected);
  });

  // -------------------------------------------------------------------------
  // Non-whitelisted paths — must throw
  // -------------------------------------------------------------------------
  it('throws Error("invalid_path") for a completely unknown path', () => {
    expect(() => setContentPath(baseContent, 'malicious', 'x')).toThrow('invalid_path');
  });

  it('throws Error("invalid_path") for a partially valid but non-whitelisted path', () => {
    expect(() => setContentPath(baseContent, 'problem.nonExistentField', 'x')).toThrow(
      'invalid_path',
    );
  });

  it('throws Error("invalid_path") for a 3-level deep path (too deep)', () => {
    expect(() => setContentPath(baseContent, 'problem.trigger.nested', 'x')).toThrow(
      'invalid_path',
    );
  });

  it('throws Error("invalid_path") for an empty string path', () => {
    expect(() => setContentPath(baseContent, '', 'x')).toThrow('invalid_path');
  });

  // -------------------------------------------------------------------------
  // BRIEF_CONTENT_PATHS whitelist is exported and complete
  // -------------------------------------------------------------------------
  it('BRIEF_CONTENT_PATHS includes all expected paths', () => {
    const expected = [
      'title',
      'problem.trigger',
      'problem.affected',
      'problem.currentWorkaround',
      'problem.costOfNotSolving',
      'desiredOutcome.definitionOfGoodEnough',
      'desiredOutcome.mustHaves',
      'desiredOutcome.niceToHaves',
      'desiredOutcome.outOfScope',
      'context.industry',
      'context.useCase',
      'context.technicalLevel',
      'context.existingStack',
      'constraints.budgetBand',
      'constraints.timeline',
      'constraints.licensing',
      'constraints.geography',
      'preferredSolutionType',
    ];
    for (const p of expected) {
      expect(BRIEF_CONTENT_PATHS).toContain(p);
    }
  });

  // -------------------------------------------------------------------------
  // All whitelisted paths are settable without throwing
  // -------------------------------------------------------------------------
  it('accepts every path in BRIEF_CONTENT_PATHS without throwing', () => {
    for (const p of BRIEF_CONTENT_PATHS) {
      expect(() => setContentPath(baseContent, p, 'test_value')).not.toThrow();
    }
  });
});

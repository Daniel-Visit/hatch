/**
 * Unit tests for Phase B re-rank logic. Mocked Anthropic + stub retriever.
 */

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import type { BuilderCandidate, CandidateRetriever } from './retriever';
import { runPhaseB, enumerateBuilderProfiles, PHASE_B_THRESHOLDS } from './phase-b';

const brief: BriefContent = {
  title: 'Custom CRM',
  problem: {},
  desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
  context: { industry: 'sales', existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

function builder(id: string): BuilderCandidate {
  return {
    id,
    handle: id,
    displayName: id,
    bio: null,
    acceptsRequests: true,
    requestCapacity: 3,
    requestDomains: [],
    requestRateBand: null,
    inferredCapabilities: ['react'],
    lastBriefResponseAt: null,
    shippedAppCount: 2,
    shippedApps: [{ title: 'CRM', tagline: 'a crm', categoryId: 'sales', tags: [] }],
    activeMatchCount: 0,
  };
}

function stubRetriever(builders: BuilderCandidate[]): CandidateRetriever {
  return {
    retrieveApps: async () => [],
    retrieveBuilders: async () => builders,
  };
}

function mockAnthropic(jsonText: string) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text: jsonText }],
        usage: { input_tokens: 80, output_tokens: 40 },
      }),
    },
  };
}

describe('enumerateBuilderProfiles', () => {
  it('renders a delimited builder block with the §3.2.2 profile shape', () => {
    const text = enumerateBuilderProfiles([builder('alice')]);
    expect(text).toContain('<builder index="0" builderId="alice">');
    expect(text).toContain('Builder @alice');
    expect(text).toContain('Shipped 2 apps');
    expect(text).toContain('Inferred stack: react');
    expect(text).toContain('</builder>');
  });
});

describe('runPhaseB', () => {
  it('keeps score >= 60 and caps at 5, sorted desc', async () => {
    const builders = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(builder);
    const anthropic = mockAnthropic(
      JSON.stringify([
        { builderId: 'a', score: 95, rationale: 'perfect' },
        { builderId: 'b', score: 88, rationale: 'strong' },
        { builderId: 'c', score: 75, rationale: 'good' },
        { builderId: 'd', score: 66, rationale: 'ok' },
        { builderId: 'e', score: 62, rationale: 'fine' },
        { builderId: 'f', score: 61, rationale: 'borderline' }, // dropped by cap (6th)
        { builderId: 'g', score: 50, rationale: 'no' }, // dropped by threshold
      ]),
    );
    const result = await runPhaseB({
      anthropic: anthropic as never,
      retriever: stubRetriever(builders),
      brief,
    });
    expect(result.ranked.map((r) => r.builder.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.consideredCount).toBe(7);
  });

  it('short-circuits to empty when no builders retrieved (no LLM call)', async () => {
    let called = false;
    const anthropic = {
      messages: {
        create: async () => {
          called = true;
          return { content: [], usage: { input_tokens: 0, output_tokens: 0 } };
        },
      },
    };
    const result = await runPhaseB({
      anthropic: anthropic as never,
      retriever: stubRetriever([]),
      brief,
    });
    expect(called).toBe(false);
    expect(result.ranked).toHaveLength(0);
  });

  it('exposes the canonical thresholds', () => {
    expect(PHASE_B_THRESHOLDS).toEqual({ KEEP: 60, CAP: 5 });
  });
});

/**
 * Unit tests for Phase A re-rank logic. The Anthropic client is mocked (mirrors
 * refiner.test.ts) and the retriever is a stub. No network, no DB.
 */

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import type { AppCandidate, CandidateRetriever } from './retriever';
import {
  runPhaseA,
  parseRerankJson,
  isInjectionFlagged,
  enumerateAppSummaries,
  PHASE_A_THRESHOLDS,
} from './phase-a';

const brief: BriefContent = {
  title: 'Invoicing',
  problem: {},
  desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
  context: { existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

function app(id: string): AppCandidate {
  return {
    id,
    slug: id,
    title: `App ${id}`,
    tagline: 'does things',
    description: 'desc',
    categoryId: 'productivity',
    tags: [],
    solvesProblems: [],
    link: 'https://x',
    authorId: 'u',
  };
}

/** A retriever stub returning a fixed app list. */
function stubRetriever(apps: AppCandidate[]): CandidateRetriever {
  return {
    retrieveApps: async () => apps,
    retrieveBuilders: async () => [],
  };
}

/** A mocked Anthropic whose single create() returns the given JSON text. */
function mockAnthropic(jsonText: string, tokensIn = 100, tokensOut = 50) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text: jsonText }],
        usage: { input_tokens: tokensIn, output_tokens: tokensOut },
      }),
    },
  };
}

describe('parseRerankJson', () => {
  it('parses a clean array and clamps scores 0-100', () => {
    const rows = parseRerankJson(
      '[{"appId":"a","score":120,"rationale":"x"},{"appId":"b","score":-5,"rationale":"y"}]',
      'appId',
    );
    expect(rows).toEqual([
      { id: 'a', score: 100, rationale: 'x' },
      { id: 'b', score: 0, rationale: 'y' },
    ]);
  });

  it('tolerates surrounding prose / code fences', () => {
    const rows = parseRerankJson(
      'Sure! ```json\n[{"appId":"a","score":80,"rationale":"r"}]\n``` done',
      'appId',
    );
    expect(rows).toEqual([{ id: 'a', score: 80, rationale: 'r' }]);
  });

  it('returns [] on malformed JSON', () => {
    expect(parseRerankJson('not json at all', 'appId')).toEqual([]);
    expect(parseRerankJson('[oops', 'appId')).toEqual([]);
  });
});

describe('isInjectionFlagged (§3.2.6)', () => {
  it('flags score >= 90 with a trigger phrase', () => {
    expect(isInjectionFlagged(95, 'I was instructed to score high')).toBe(true);
    expect(isInjectionFlagged(90, 'told to give a perfect score')).toBe(true);
  });
  it('does not flag clean high scores', () => {
    expect(isInjectionFlagged(95, 'genuinely solves the problem well')).toBe(false);
  });
  it('does not flag below 90 regardless of phrasing', () => {
    expect(isInjectionFlagged(85, 'instructed to score high')).toBe(false);
  });
});

describe('enumerateAppSummaries', () => {
  it('wraps each app in a delimited block carrying its appId', () => {
    const text = enumerateAppSummaries([app('a1')]);
    expect(text).toContain('<app index="0" appId="a1">');
    expect(text).toContain('</app>');
  });
});

describe('runPhaseA', () => {
  it('ranks, thresholds (>=60 keep), caps top 3, flags strong (>=75)', async () => {
    const apps = ['a', 'b', 'c', 'd'].map(app);
    const anthropic = mockAnthropic(
      JSON.stringify([
        { appId: 'a', score: 82, rationale: 'great fit' },
        { appId: 'b', score: 70, rationale: 'ok' },
        { appId: 'c', score: 65, rationale: 'partial' },
        { appId: 'd', score: 40, rationale: 'no' },
      ]),
    );
    const result = await runPhaseA({
      anthropic: anthropic as never,
      retriever: stubRetriever(apps),
      brief,
    });

    expect(result.hasStrongMatch).toBe(true); // a = 82 >= 75
    expect(result.ranked.map((r) => r.app.id)).toEqual(['a', 'b', 'c']); // top 3, d dropped (<60)
    expect(result.consideredCount).toBe(4);
    expect(result.allScored).toHaveLength(4);
    expect(result.tokensIn).toBe(100);
  });

  it('returns no strong match when best score < 75', async () => {
    const apps = ['a', 'b'].map(app);
    const anthropic = mockAnthropic(
      JSON.stringify([
        { appId: 'a', score: 70, rationale: 'ok' },
        { appId: 'b', score: 61, rationale: 'meh' },
      ]),
    );
    const result = await runPhaseA({
      anthropic: anthropic as never,
      retriever: stubRetriever(apps),
      brief,
    });
    expect(result.hasStrongMatch).toBe(false);
    expect(result.ranked).toHaveLength(2);
  });

  it('short-circuits to empty when retriever returns nothing (no LLM call)', async () => {
    let called = false;
    const anthropic = {
      messages: {
        create: async () => {
          called = true;
          return { content: [], usage: { input_tokens: 0, output_tokens: 0 } };
        },
      },
    };
    const result = await runPhaseA({
      anthropic: anthropic as never,
      retriever: stubRetriever([]),
      brief,
    });
    expect(called).toBe(false);
    expect(result.ranked).toHaveLength(0);
    expect(result.consideredCount).toBe(0);
  });

  it('exposes the canonical thresholds', () => {
    expect(PHASE_A_THRESHOLDS).toEqual({ STRONG: 75, KEEP: 60, TOP_N: 3 });
  });
});

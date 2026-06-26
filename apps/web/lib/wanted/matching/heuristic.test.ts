/**
 * Unit tests for computeMatchPotential — fed a FAKE CandidateRetriever returning
 * canned candidates. NO LLM, NO embeddings, NO DB. Asserts the estimate is
 * deterministic and reflects lexical overlap + liveness per §3.4.5.
 */

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import { computeMatchPotential, CONFIDENCE_THRESHOLD } from './heuristic';
import type { AppCandidate, BuilderCandidate, CandidateRetriever } from './retriever';

const brief: BriefContent = {
  title: 'Invoicing tool for a growing agency',
  problem: { trigger: 'After we grew to 8 people invoicing broke' },
  desiredOutcome: {
    definitionOfGoodEnough: 'send invoices fast',
    mustHaves: ['invoicing', 'pdf export'],
    niceToHaves: [],
    outOfScope: [],
  },
  context: { industry: 'agency', existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

function app(id: string, text: string): AppCandidate {
  return {
    id,
    slug: id,
    title: text,
    tagline: text,
    description: text,
    categoryId: 'cat',
    tags: [],
    solvesProblems: [],
    link: 'https://x',
    authorId: 'a',
  };
}

function builder(
  id: string,
  text: string,
  opts: { lastBriefResponseAt?: string | null; activeMatchCount?: number } = {},
): BuilderCandidate {
  return {
    id,
    handle: id,
    displayName: text,
    bio: text,
    acceptsRequests: true,
    requestCapacity: 5,
    requestDomains: [],
    requestRateBand: null,
    inferredCapabilities: [],
    lastBriefResponseAt: opts.lastBriefResponseAt ?? null,
    shippedAppCount: 1,
    shippedApps: [{ title: text, tagline: text, categoryId: 'cat', tags: [] }],
    activeMatchCount: opts.activeMatchCount ?? 0,
  };
}

/** A fake retriever returning fixed candidate lists. */
function fakeRetriever(apps: AppCandidate[], builders: BuilderCandidate[]): CandidateRetriever {
  return {
    retrieveApps: async () => apps,
    retrieveBuilders: async () => builders,
  };
}

describe('computeMatchPotential — determinism', () => {
  it('returns identical results across repeated runs with the same retriever', async () => {
    const retriever = fakeRetriever(
      [app('a1', 'invoicing tool agency pdf export'), app('a2', 'unrelated weather widget')],
      [builder('b1', 'invoicing agency builder pdf', { activeMatchCount: 2 })],
    );

    const r1 = await computeMatchPotential(brief, retriever, { now: 1_000_000_000_000 });
    const r2 = await computeMatchPotential(brief, retriever, { now: 1_000_000_000_000 });

    expect(r1).toEqual(r2);
  });
});

describe('computeMatchPotential — overlap discriminates relevant from irrelevant', () => {
  it('counts a high-overlap app and excludes a zero-overlap one', async () => {
    const retriever = fakeRetriever(
      [
        // Overlaps title/trigger/must-haves heavily → high confidence.
        app('relevant', 'invoicing tool growing agency send invoices pdf export people'),
        // No shared tokens with the brief → low overlap.
        app('irrelevant', 'zzz qqq xyz nonsense'),
      ],
      [],
    );

    const result = await computeMatchPotential(brief, retriever, { now: 0 });

    // Only the relevant app should clear the threshold.
    expect(result.appCandidateCount).toBe(1);
    expect(result.builderCandidateCount).toBe(0);
    // estimate = clearing / retrieved = 1 / 2 = 0.5
    expect(result.estimate).toBeCloseTo(0.5);
    expect(result.basis).toContain('FTS lexical-overlap heuristic');
  });
});

describe('computeMatchPotential — builder liveness raises confidence', () => {
  it('a recently-active builder with active matches clears where a stale one does not', async () => {
    const now = Date.parse('2026-06-01T00:00:00Z');
    const recent = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
    const stale = new Date(now - 200 * 24 * 60 * 60 * 1000).toISOString(); // 200 days ago

    // Same modest lexical overlap for both — only liveness differs.
    const sharedText = 'agency';
    const retriever = fakeRetriever(
      [],
      [
        builder('live', sharedText, { lastBriefResponseAt: recent, activeMatchCount: 3 }),
        builder('dead', sharedText, { lastBriefResponseAt: stale, activeMatchCount: 0 }),
      ],
    );

    const result = await computeMatchPotential(brief, retriever, { now });

    // Live builder: 0.4*overlap + 0.3 + 0.2*1 + 0.1*1 = 0.6 + 0.4*overlap >= 0.6
    // Dead builder: 0.4*overlap + 0.3 + 0.2*0.5 + 0.1*0.5 = 0.45 + 0.4*overlap
    //   overlap here is small (1 shared token / brief tokens), so dead < 0.6.
    expect(result.builderCandidateCount).toBe(1);
  });
});

describe('computeMatchPotential — empty pools', () => {
  it('returns estimate 0 and zero counts when nothing is retrieved', async () => {
    const result = await computeMatchPotential(brief, fakeRetriever([], []), { now: 0 });
    expect(result.estimate).toBe(0);
    expect(result.appCandidateCount).toBe(0);
    expect(result.builderCandidateCount).toBe(0);
  });

  it('returns estimate 0 with a no-signal basis when the brief has no high-signal text', async () => {
    const emptyBrief: BriefContent = {
      problem: {},
      desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
      context: { existingStack: [] },
      constraints: { licensing: 'no_pref', geography: null },
      preferredSolutionType: [],
    };
    const retriever = fakeRetriever([app('a1', 'some app text')], []);
    const result = await computeMatchPotential(emptyBrief, retriever, { now: 0 });
    // No brief tokens → overlap 0 for every candidate; an app still gets
    // 0.3 (hard filter) + 0.2*0.5 + 0.1*0.5 = 0.45 < threshold → not counted.
    expect(result.appCandidateCount).toBe(0);
    expect(result.estimate).toBe(0);
    expect(result.basis).toContain('No high-signal brief text');
  });
});

describe('computeMatchPotential — threshold sanity', () => {
  it('an app with near-total overlap clears the confidence threshold', async () => {
    // Brief tokens are all present → overlap ~1 → confidence well above threshold.
    const allTokens = 'invoicing tool growing agency send invoices fast pdf export people broke';
    const retriever = fakeRetriever([app('a1', allTokens)], []);
    const result = await computeMatchPotential(brief, retriever, { now: 0 });
    expect(result.appCandidateCount).toBe(1);
    expect(result.estimate).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD - 0.0001);
  });
});

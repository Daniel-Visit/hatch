/**
 * Unit tests for runMatching orchestration. Anthropic, retriever, and the admin
 * client are all injected, so no network/DB. We verify:
 *  - the Phase A -> B conditional (§3.2.2),
 *  - matches written with the XOR-correct candidate ids,
 *  - one audit log per phase that ran.
 */

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import type { AppCandidate, BuilderCandidate, CandidateRetriever } from './retriever';
import { runMatching } from './run';

// --- Fakes ---------------------------------------------------------------

function appCand(id: string): AppCandidate {
  return {
    id,
    slug: id,
    title: id,
    tagline: 't',
    description: 'd',
    categoryId: 'c',
    tags: [],
    solvesProblems: [],
    link: 'l',
    authorId: 'u',
  };
}

function builderCand(id: string): BuilderCandidate {
  return {
    id,
    handle: id,
    displayName: id,
    bio: null,
    acceptsRequests: true,
    requestCapacity: 3,
    requestDomains: [],
    requestRateBand: null,
    inferredCapabilities: [],
    lastBriefResponseAt: null,
    shippedAppCount: 1,
    shippedApps: [],
    activeMatchCount: 0,
  };
}

function stubRetriever(apps: AppCandidate[], builders: BuilderCandidate[]): CandidateRetriever {
  return {
    retrieveApps: async () => apps,
    retrieveBuilders: async () => builders,
  };
}

/** Mocked Anthropic: returns appScores for the first call, builderScores next. */
function mockAnthropic(responses: string[]) {
  let i = 0;
  return {
    messages: {
      create: async () => {
        const text = responses[Math.min(i, responses.length - 1)];
        i += 1;
        return { content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } };
      },
    },
  };
}

/**
 * Faked admin client. Records audit inserts + match inserts; returns the brief
 * content on `.from('briefs').select(...).eq(...).single()`.
 */
function makeFakeAdmin(briefContent: BriefContent) {
  const auditInserts: Array<Record<string, unknown>> = [];
  const matchInserts: Array<Array<Record<string, unknown>>> = [];

  const client = {
    from(table: string) {
      if (table === 'briefs') {
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.single = () => Promise.resolve({ data: { content: briefContent }, error: null });
        return b;
      }
      if (table === 'brief_match_audit_logs') {
        const b: Record<string, unknown> = {};
        b.insert = (payload: Record<string, unknown>) => {
          auditInserts.push(payload);
          return b;
        };
        b.select = () => b;
        b.single = () => Promise.resolve({ data: { id: 'log' }, error: null });
        return b;
      }
      if (table === 'matches') {
        const b: Record<string, unknown> = {};
        b.insert = (payload: Array<Record<string, unknown>>) => {
          matchInserts.push(payload);
          return b;
        };
        b.select = () => b;
        (b as { then?: unknown }).then = (
          onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
        ) =>
          Promise.resolve({
            data: matchInserts.at(-1)?.map((r, idx) => ({ id: `m${idx}`, ...r })) ?? [],
            error: null,
          }).then(onFulfilled);
        return b;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, auditInserts, matchInserts };
}

const baseBrief: BriefContent = {
  title: 'X',
  problem: {},
  desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
  context: { existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

// --- Tests ---------------------------------------------------------------

describe('runMatching — Phase A -> B conditional (§3.2.2)', () => {
  it('SKIPS Phase B when a strong (>=75) app match exists and no custom build wanted', async () => {
    const { client, auditInserts, matchInserts } = makeFakeAdmin(baseBrief);
    const anthropic = mockAnthropic([
      JSON.stringify([{ appId: 'app1', score: 90, rationale: 'perfect' }]),
    ]);
    const result = await runMatching('brief1', 'both', {
      anthropic: anthropic as never,
      retriever: stubRetriever([appCand('app1')], [builderCand('b1')]),
      admin: client as never,
    });

    expect(result.hasStrongAppMatch).toBe(true);
    expect(result.phaseBRan).toBe(false);
    // Only Phase A audit written.
    expect(auditInserts.map((a) => a.phase)).toEqual(['APP']);
    // One app match, XOR-correct.
    const inserted = matchInserts.flat();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      candidate_type: 'APP',
      candidate_app_id: 'app1',
      candidate_builder_id: null,
    });
    expect(inserted[0].agent_confidence).toBeCloseTo(0.9);
  });

  it('RUNS Phase B when seeker wants a custom build even with a strong app', async () => {
    const brief: BriefContent = { ...baseBrief, preferredSolutionType: ['custom_build'] };
    const { client, auditInserts, matchInserts } = makeFakeAdmin(brief);
    const anthropic = mockAnthropic([
      JSON.stringify([{ appId: 'app1', score: 90, rationale: 'perfect' }]),
      JSON.stringify([{ builderId: 'b1', score: 80, rationale: 'great builder' }]),
    ]);
    const result = await runMatching('brief1', 'both', {
      anthropic: anthropic as never,
      retriever: stubRetriever([appCand('app1')], [builderCand('b1')]),
      admin: client as never,
    });

    expect(result.phaseBRan).toBe(true);
    expect(auditInserts.map((a) => a.phase)).toEqual(['APP', 'BUILDER']);
    const inserted = matchInserts.flat();
    // One app + one builder match.
    expect(inserted.map((m) => m.candidate_type).sort()).toEqual(['APP', 'BUILDER']);
    const builderRow = inserted.find((m) => m.candidate_type === 'BUILDER')!;
    expect(builderRow).toMatchObject({ candidate_builder_id: 'b1', candidate_app_id: null });
  });

  it('RUNS Phase B when no strong app match exists', async () => {
    const { client, auditInserts } = makeFakeAdmin(baseBrief);
    const anthropic = mockAnthropic([
      JSON.stringify([{ appId: 'app1', score: 65, rationale: 'partial' }]),
      JSON.stringify([{ builderId: 'b1', score: 70, rationale: 'ok' }]),
    ]);
    const result = await runMatching('brief1', 'both', {
      anthropic: anthropic as never,
      retriever: stubRetriever([appCand('app1')], [builderCand('b1')]),
      admin: client as never,
    });
    expect(result.hasStrongAppMatch).toBe(false);
    expect(result.phaseBRan).toBe(true);
    expect(auditInserts.map((a) => a.phase)).toEqual(['APP', 'BUILDER']);
  });

  it("mode 'apps' runs only Phase A", async () => {
    const { client, auditInserts } = makeFakeAdmin(baseBrief);
    const anthropic = mockAnthropic([
      JSON.stringify([{ appId: 'app1', score: 65, rationale: 'partial' }]),
    ]);
    const result = await runMatching('brief1', 'apps', {
      anthropic: anthropic as never,
      retriever: stubRetriever([appCand('app1')], [builderCand('b1')]),
      admin: client as never,
    });
    expect(result.phaseBRan).toBe(false);
    expect(result.phaseA).not.toBeNull();
    expect(result.phaseB).toBeNull();
    expect(auditInserts.map((a) => a.phase)).toEqual(['APP']);
  });

  it("mode 'builders' skips Phase A and runs Phase B", async () => {
    const { client, auditInserts } = makeFakeAdmin(baseBrief);
    const anthropic = mockAnthropic([
      JSON.stringify([{ builderId: 'b1', score: 70, rationale: 'ok' }]),
    ]);
    const result = await runMatching('brief1', 'builders', {
      anthropic: anthropic as never,
      retriever: stubRetriever([appCand('app1')], [builderCand('b1')]),
      admin: client as never,
    });
    expect(result.phaseA).toBeNull();
    expect(result.phaseBRan).toBe(true);
    expect(auditInserts.map((a) => a.phase)).toEqual(['BUILDER']);
  });
});

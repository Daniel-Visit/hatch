/**
 * Unit tests for match-repo. A faked admin client records the insert/update
 * payload shape. No live DB.
 */

import { describe, it, expect } from 'vitest';
import {
  insertMatches,
  updateMatchAction,
  MatchInvariantError,
  listBuilderRequests,
  type InsertMatchParams,
  type BuilderRequest,
} from './match-repo';

/** Faked client that records the .from()/.insert()/.update() payloads. */
function makeFakeAdmin(returnRows: unknown[] = []) {
  const recorded: { table?: string; insert?: unknown; update?: unknown; eq?: unknown[] } = {};
  const builder: Record<string, unknown> = {};
  builder.insert = (payload: unknown) => {
    recorded.insert = payload;
    return builder;
  };
  builder.update = (payload: unknown) => {
    recorded.update = payload;
    return builder;
  };
  builder.eq = (...args: unknown[]) => {
    recorded.eq = args;
    return builder;
  };
  builder.select = () => builder;
  builder.single = () => Promise.resolve({ data: returnRows[0] ?? {}, error: null });
  // For insertMatches: `.insert().select()` resolves to many rows.
  (builder as { then?: unknown }).then = (
    onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
  ) => Promise.resolve({ data: returnRows, error: null }).then(onFulfilled);

  const client = {
    from(table: string) {
      recorded.table = table;
      return builder;
    },
  };
  return { client, recorded };
}

const appMatch: InsertMatchParams = {
  briefId: 'brief1',
  candidateType: 'APP',
  candidateAppId: 'app1',
  agentConfidence: 0.82,
  agentRationale: 'great',
};

const builderMatch: InsertMatchParams = {
  briefId: 'brief1',
  candidateType: 'BUILDER',
  candidateBuilderId: 'b1',
  agentConfidence: 0.7,
};

describe('insertMatches — XOR invariant', () => {
  it('rejects a match with neither candidate id', async () => {
    const { client } = makeFakeAdmin();
    await expect(
      insertMatches(client as never, [
        { briefId: 'b', candidateType: 'APP', agentConfidence: 0.5 },
      ]),
    ).rejects.toBeInstanceOf(MatchInvariantError);
  });

  it('rejects a match with BOTH candidate ids', async () => {
    const { client } = makeFakeAdmin();
    await expect(
      insertMatches(client as never, [
        {
          briefId: 'b',
          candidateType: 'APP',
          candidateAppId: 'a',
          candidateBuilderId: 'x',
          agentConfidence: 0.5,
        },
      ]),
    ).rejects.toBeInstanceOf(MatchInvariantError);
  });

  it('rejects candidateType/id disagreement', async () => {
    const { client } = makeFakeAdmin();
    await expect(
      insertMatches(client as never, [
        { briefId: 'b', candidateType: 'BUILDER', candidateAppId: 'a', agentConfidence: 0.5 },
      ]),
    ).rejects.toBeInstanceOf(MatchInvariantError);
  });

  it('no-ops on empty input (no DB call)', async () => {
    const { client, recorded } = makeFakeAdmin();
    const rows = await insertMatches(client as never, []);
    expect(rows).toEqual([]);
    expect(recorded.table).toBeUndefined();
  });
});

describe('insertMatches — insert shape', () => {
  it('maps app match: candidate_action defaults to CONNECT (auto-accept)', async () => {
    const { client, recorded } = makeFakeAdmin([{ id: 'm1' }]);
    await insertMatches(client as never, [appMatch]);
    expect(recorded.table).toBe('matches');
    const payload = recorded.insert as Array<Record<string, unknown>>;
    expect(payload[0]).toMatchObject({
      brief_id: 'brief1',
      candidate_type: 'APP',
      candidate_app_id: 'app1',
      candidate_builder_id: null,
      agent_confidence: 0.82,
      agent_rationale: 'great',
      candidate_action: 'CONNECT',
    });
  });

  it('maps builder match: candidate_action defaults to PENDING', async () => {
    const { client, recorded } = makeFakeAdmin([{ id: 'm2' }]);
    await insertMatches(client as never, [builderMatch]);
    const payload = recorded.insert as Array<Record<string, unknown>>;
    expect(payload[0]).toMatchObject({
      candidate_type: 'BUILDER',
      candidate_builder_id: 'b1',
      candidate_app_id: null,
      candidate_action: 'PENDING',
      agent_rationale: '',
    });
  });
});

describe('updateMatchAction — stamps acted_at', () => {
  it('sets seeker_action + seeker_acted_at', async () => {
    const { client, recorded } = makeFakeAdmin([{ id: 'm1' }]);
    await updateMatchAction(client as never, 'm1', { seekerAction: 'CONNECT' });
    const patch = recorded.update as Record<string, unknown>;
    expect(patch.seeker_action).toBe('CONNECT');
    expect(typeof patch.seeker_acted_at).toBe('string');
    expect(recorded.eq).toEqual(['id', 'm1']);
  });

  it('sets thread_id without forcing an action stamp', async () => {
    const { client, recorded } = makeFakeAdmin([{ id: 'm1' }]);
    await updateMatchAction(client as never, 'm1', { threadId: 'th1' });
    const patch = recorded.update as Record<string, unknown>;
    expect(patch.thread_id).toBe('th1');
    expect(patch.seeker_acted_at).toBeUndefined();
  });
});

// ── listBuilderRequests ───────────────────────────────────────────────────────

/**
 * Faked session client for listBuilderRequests. Tracks all .eq() calls and the
 * .order() call so tests can assert every filter and the sort direction.
 * Same hand-rolled builder pattern as makeFakeAdmin above.
 */
function makeFakeSession(returnRows: unknown[] = []) {
  const recorded: {
    table?: string;
    eqs: unknown[][];
    orderArgs?: unknown[];
  } = { eqs: [] };

  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (...args: unknown[]) => {
    recorded.eqs.push(args);
    return builder;
  };
  builder.order = (...args: unknown[]) => {
    recorded.orderArgs = args;
    return builder;
  };
  (builder as { then?: unknown }).then = (
    onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
  ) => Promise.resolve({ data: returnRows, error: null }).then(onFulfilled);

  const client = {
    from(table: string) {
      recorded.table = table;
      return builder;
    },
  };
  return { client, recorded };
}

const mockBriefSummary = {
  id: 'brief-1',
  title: 'Need a data pipeline',
  content: { problem: { trigger: 'too slow' } },
  budget_band: 'UNDER_5K',
  timeline: 'ONE_TO_THREE_MONTHS',
  solution_types: ['CUSTOM_BUILD'],
  expires_at: '2026-09-01T00:00:00.000Z',
  author_id: 'author-1',
};

const mockMatchWithBrief = {
  id: 'match-1',
  brief_id: 'brief-1',
  candidate_type: 'BUILDER',
  candidate_builder_id: 'builder-1',
  candidate_app_id: null,
  candidate_action: 'PENDING',
  seeker_action: 'PENDING',
  agent_confidence: 0.88,
  agent_rationale: 'Strong domain expertise',
  seeker_acted_at: null,
  candidate_acted_at: null,
  thread_id: null,
  candidate_feedback: null,
  candidate_feedback_note: null,
  commercial_status: 'STANDARD',
  created_at: '2026-06-27T00:00:00.000Z',
  brief: mockBriefSummary,
};

describe('listBuilderRequests', () => {
  it('applies candidate_builder_id, candidate_type, and candidate_action filters', async () => {
    const { client, recorded } = makeFakeSession([mockMatchWithBrief]);
    await listBuilderRequests(client as never, 'builder-1');
    expect(recorded.table).toBe('matches');
    expect(recorded.eqs).toContainEqual(['candidate_builder_id', 'builder-1']);
    expect(recorded.eqs).toContainEqual(['candidate_type', 'BUILDER']);
    expect(recorded.eqs).toContainEqual(['candidate_action', 'PENDING']);
  });

  it('orders by agent_confidence descending', async () => {
    const { client, recorded } = makeFakeSession([mockMatchWithBrief]);
    await listBuilderRequests(client as never, 'builder-1');
    expect(recorded.orderArgs).toEqual(['agent_confidence', { ascending: false }]);
  });

  it('maps DB rows to camelCase BuilderRequest shape', async () => {
    const { client } = makeFakeSession([mockMatchWithBrief]);
    const result: BuilderRequest[] = await listBuilderRequests(client as never, 'builder-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'match-1',
      agentConfidence: 0.88,
      agentRationale: 'Strong domain expertise',
      candidateAction: 'PENDING',
      briefId: 'brief-1',
      title: 'Need a data pipeline',
      budgetBand: 'UNDER_5K',
      timeline: 'ONE_TO_THREE_MONTHS',
      solutionTypes: ['CUSTOM_BUILD'],
      expiresAt: '2026-09-01T00:00:00.000Z',
    });
    expect(result[0]?.content).toMatchObject({ problem: { trigger: 'too slow' } });
  });

  it('returns empty array when no rows', async () => {
    const { client, recorded } = makeFakeSession([]);
    const result = await listBuilderRequests(client as never, 'builder-uuid');
    expect(result).toEqual([]);
    expect(recorded.table).toBe('matches');
  });
});

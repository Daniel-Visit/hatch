/**
 * Unit tests for suggestion-repo. Faked admin client records insert/update shape.
 */

import { describe, it, expect } from 'vitest';
import {
  insertSuggestions,
  updateSuggestionStatus,
  type InsertSuggestionParams,
} from './suggestion-repo';

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

const sugg: InsertSuggestionParams = {
  briefId: 'brief1',
  sectionPath: 'problem.trigger',
  diagnosis: 'too vague',
  exampleBetter: 'After we grew to 8 people, scheduling broke down.',
  modelUsed: 'claude-sonnet-4-6',
};

describe('insertSuggestions', () => {
  it('maps params to row columns', async () => {
    const { client, recorded } = makeFakeAdmin([{ id: 's1' }]);
    await insertSuggestions(client as never, [sugg]);
    expect(recorded.table).toBe('validator_suggestions');
    const payload = recorded.insert as Array<Record<string, unknown>>;
    expect(payload[0]).toMatchObject({
      brief_id: 'brief1',
      section_path: 'problem.trigger',
      diagnosis: 'too vague',
      example_better: 'After we grew to 8 people, scheduling broke down.',
      model_used: 'claude-sonnet-4-6',
    });
  });

  it('no-ops on empty input', async () => {
    const { client, recorded } = makeFakeAdmin();
    const rows = await insertSuggestions(client as never, []);
    expect(rows).toEqual([]);
    expect(recorded.table).toBeUndefined();
  });
});

describe('updateSuggestionStatus', () => {
  it('stamps resolved_at for terminal status', async () => {
    const { client, recorded } = makeFakeAdmin([{ id: 's1' }]);
    await updateSuggestionStatus(client as never, 's1', {
      status: 'APPLIED',
      appliedValue: 'the better sentence',
    });
    const patch = recorded.update as Record<string, unknown>;
    expect(patch.status).toBe('APPLIED');
    expect(typeof patch.resolved_at).toBe('string');
    expect(patch.applied_value).toBe('the better sentence');
    expect(recorded.eq).toEqual(['id', 's1']);
  });

  it('clears resolved_at when reverting to PENDING', async () => {
    const { client, recorded } = makeFakeAdmin([{ id: 's1' }]);
    await updateSuggestionStatus(client as never, 's1', { status: 'PENDING' });
    const patch = recorded.update as Record<string, unknown>;
    expect(patch.status).toBe('PENDING');
    expect(patch.resolved_at).toBeNull();
  });
});

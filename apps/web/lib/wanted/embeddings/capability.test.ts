/**
 * Unit tests for capability.ts — recompute + NULL-embedding backfill.
 *
 * NO live DB, NO network:
 *  - Supabase client is faked with a chainable query-builder stub.
 *  - `./embed` is mocked so embed helpers return canned vectors or null.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ./embed before importing the module under test.
// ---------------------------------------------------------------------------

const mockEmbedCapabilityBestEffort = vi.fn<(appTexts: string[]) => Promise<number[] | null>>();
const mockEmbedBriefBestEffort = vi.fn<(input: unknown) => Promise<number[] | null>>();
const mockEmbedAppBestEffort = vi.fn<(input: unknown) => Promise<number[] | null>>();

vi.mock('./embed', () => ({
  embedCapabilityBestEffort: (appTexts: string[]) => mockEmbedCapabilityBestEffort(appTexts),
  embedBriefBestEffort: (input: unknown) => mockEmbedBriefBestEffort(input),
  embedAppBestEffort: (input: unknown) => mockEmbedAppBestEffort(input),
}));

import { recomputeCapability, recomputeAllCapabilities, sweepNullEmbeddings } from './capability';

// ---------------------------------------------------------------------------
// Fake Supabase query-builder helpers (mirrors retriever.test.ts pattern).
// ---------------------------------------------------------------------------

type Call = { method: string; args: unknown[] };

/**
 * Build a chainable query-builder stub. Terminals (limit, update → awaited)
 * resolve to `{ data, error: null }`. All other chainable methods return the
 * builder itself so call chains work.
 */
function makeQueryBuilder(result: {
  data?: unknown;
  error?: { message: string } | null;
  count?: number;
}) {
  const calls: Call[] = [];
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };

  for (const m of ['select', 'eq', 'is', 'in', 'order', 'update']) {
    builder[m] = chain(m);
  }

  builder.limit = (...args: unknown[]) => {
    calls.push({ method: 'limit', args });
    return Promise.resolve(resolved);
  };

  // Make the builder directly awaitable (for `.update(...).eq(...)` terminals).
  (builder as { then?: unknown }).then = (onFulfilled: (v: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled);

  return { builder, calls, resolved };
}

/**
 * A fake Supabase client whose `.from(table)` responses are keyed by a
 * registration queue: each call to `.from(table)` pops the first entry
 * registered for that table. This lets tests control multi-call sequences.
 */
type TableEntry = { data?: unknown; error?: { message: string } | null };

function makeFakeClient(tableQueues: Record<string, TableEntry[]>) {
  const fromCalls: string[] = [];
  const builders: Array<{ table: string; b: ReturnType<typeof makeQueryBuilder> }> = [];

  const client = {
    from(table: string) {
      fromCalls.push(table);
      const queue = tableQueues[table] ?? [];
      const entry = queue.shift() ?? { data: null };
      const b = makeQueryBuilder(entry);
      builders.push({ table, b });
      return b.builder;
    },
  };

  return { client, fromCalls, builders };
}

// ---------------------------------------------------------------------------
// Canned test data
// ---------------------------------------------------------------------------

const FAKE_VEC = [0.1, 0.2, 0.3];
const VECTOR_LITERAL = '[0.1,0.2,0.3]';

const APP_ROWS = [
  {
    title: 'App A',
    tagline: 'Fast invoicing',
    description: 'Invoice quickly',
    solves_problems: ['billing'],
    category_id: 'finance',
    likes_count: 50,
    created_at: '2024-01-01',
  },
  {
    title: 'App B',
    tagline: 'HR bot',
    description: 'Employee management',
    solves_problems: ['HR'],
    category_id: 'hr',
    likes_count: 30,
    created_at: '2024-01-02',
  },
];

// ---------------------------------------------------------------------------
// recomputeCapability
// ---------------------------------------------------------------------------

describe('recomputeCapability', () => {
  beforeEach(() => {
    mockEmbedCapabilityBestEffort.mockReset();
    mockEmbedBriefBestEffort.mockReset();
    mockEmbedAppBestEffort.mockReset();
  });

  it('fetches top-5 published apps ordered by likes_count desc then created_at desc', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(FAKE_VEC);

    const { client, builders } = makeFakeClient({
      apps: [{ data: APP_ROWS }],
      profiles: [{ data: null }],
    });

    await recomputeCapability(client as never, 'builder-1');

    const appBuilder = builders.find((b) => b.table === 'apps')!;
    const methods = appBuilder.b.calls.map((c) => c.method);

    expect(methods).toContain('select');
    expect(methods).toContain('eq'); // author_id + is_published

    // Verify both eq() calls are present (author_id and is_published).
    const eqCalls = appBuilder.b.calls.filter((c) => c.method === 'eq');
    const eqArgs = eqCalls.map((c) => c.args[0]);
    expect(eqArgs).toContain('author_id');
    expect(eqArgs).toContain('is_published');

    // Verify ordering: likes_count desc, then created_at desc.
    const orderCalls = appBuilder.b.calls.filter((c) => c.method === 'order');
    expect(orderCalls[0].args[0]).toBe('likes_count');
    expect(orderCalls[0].args[1]).toMatchObject({ ascending: false });
    expect(orderCalls[1].args[0]).toBe('created_at');
    expect(orderCalls[1].args[1]).toMatchObject({ ascending: false });

    // Verify limit 5.
    const limitCall = appBuilder.b.calls.find((c) => c.method === 'limit');
    expect(limitCall?.args[0]).toBe(5);
  });

  it('calls embedCapabilityBestEffort with app texts built from all returned rows', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(FAKE_VEC);

    const { client } = makeFakeClient({
      apps: [{ data: APP_ROWS }],
      profiles: [{ data: null }],
    });

    await recomputeCapability(client as never, 'builder-1');

    expect(mockEmbedCapabilityBestEffort).toHaveBeenCalledOnce();
    const [appTexts] = mockEmbedCapabilityBestEffort.mock.calls[0];
    expect(appTexts).toHaveLength(2);
    expect(appTexts[0]).toContain('App A');
    expect(appTexts[1]).toContain('App B');
  });

  it('UPDATEs profiles.capability_embedding with the vector literal', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(FAKE_VEC);

    const { client, builders } = makeFakeClient({
      apps: [{ data: APP_ROWS }],
      profiles: [{ data: null }],
    });

    const result = await recomputeCapability(client as never, 'builder-1');

    expect(result).toBe(true);
    const profileBuilder = builders.find((b) => b.table === 'profiles')!;
    const updateCall = profileBuilder.b.calls.find((c) => c.method === 'update');
    expect(updateCall?.args[0]).toEqual({ capability_embedding: VECTOR_LITERAL });

    const eqCall = profileBuilder.b.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'builder-1']);
  });

  it('returns false when the builder has no published apps', async () => {
    const { client } = makeFakeClient({
      apps: [{ data: [] }],
    });

    const result = await recomputeCapability(client as never, 'builder-empty');

    expect(result).toBe(false);
    expect(mockEmbedCapabilityBestEffort).not.toHaveBeenCalled();
  });

  it('returns false when embedCapabilityBestEffort returns null', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(null);

    const { client } = makeFakeClient({
      apps: [{ data: APP_ROWS }],
    });

    const result = await recomputeCapability(client as never, 'builder-1');

    expect(result).toBe(false);
  });

  it('returns false when the apps query errors', async () => {
    const { client } = makeFakeClient({
      apps: [{ data: null, error: { message: 'DB error' } }],
    });

    const result = await recomputeCapability(client as never, 'builder-1');

    expect(result).toBe(false);
    expect(mockEmbedCapabilityBestEffort).not.toHaveBeenCalled();
  });

  it('returns false when the profiles UPDATE errors', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(FAKE_VEC);

    // apps query succeeds; profiles update errors.
    // The profile builder needs to resolve the update chain with an error.
    // We override makeFakeClient to inject an error on the profiles table.
    const { client } = makeFakeClient({
      apps: [{ data: APP_ROWS }],
      profiles: [{ data: null, error: { message: 'update failed' } }],
    });

    const result = await recomputeCapability(client as never, 'builder-1');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recomputeAllCapabilities
// ---------------------------------------------------------------------------

describe('recomputeAllCapabilities', () => {
  beforeEach(() => {
    mockEmbedCapabilityBestEffort.mockReset();
  });

  it('deduplicates builder IDs and recomputes each once', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(FAKE_VEC);

    // apps listing returns 3 rows but only 2 distinct author_ids.
    const { client } = makeFakeClient({
      // First call: listing all apps (author_id only, dedup pass).
      apps: [
        {
          data: [
            { author_id: 'b1' },
            { author_id: 'b2' },
            { author_id: 'b1' }, // duplicate
          ],
        },
        // Per-builder recompute calls (one per unique builder).
        { data: APP_ROWS }, // b1's top-5
        { data: APP_ROWS }, // b2's top-5
      ],
      profiles: [{ data: null }, { data: null }],
    });

    const { updated, failed } = await recomputeAllCapabilities(client as never, 100);

    expect(updated).toBe(2);
    expect(failed).toBe(0);
    // embedCapabilityBestEffort called once per distinct builder.
    expect(mockEmbedCapabilityBestEffort).toHaveBeenCalledTimes(2);
  });

  it('counts a builder as failed when recompute returns false (no apps)', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(FAKE_VEC);

    const { client } = makeFakeClient({
      apps: [
        { data: [{ author_id: 'b1' }] },
        { data: [] }, // b1 has no published apps in the recompute sub-query
      ],
    });

    const { updated, failed } = await recomputeAllCapabilities(client as never, 100);

    expect(updated).toBe(0);
    expect(failed).toBe(1);
  });

  it('counts a builder as failed when recompute throws unexpectedly', async () => {
    // Simulate an apps query error inside recomputeCapability.
    const { client } = makeFakeClient({
      apps: [
        { data: [{ author_id: 'b1' }] },
        { data: null, error: { message: 'unexpected crash' } },
      ],
    });

    const { updated, failed } = await recomputeAllCapabilities(client as never, 100);

    // The error is counted as failed, not thrown out of the loop.
    expect(updated + failed).toBe(1);
  });

  it('respects batchLimit by slicing deduplicated builder IDs', async () => {
    mockEmbedCapabilityBestEffort.mockResolvedValue(FAKE_VEC);

    // 4 distinct builders but batchLimit = 2.
    const appListRows = ['b1', 'b2', 'b3', 'b4'].map((id) => ({ author_id: id }));
    const { client } = makeFakeClient({
      apps: [
        { data: appListRows }, // listing pass
        { data: APP_ROWS }, // b1 recompute
        { data: APP_ROWS }, // b2 recompute
        // b3 and b4 should NOT be called
      ],
      profiles: [{ data: null }, { data: null }],
    });

    const { updated } = await recomputeAllCapabilities(client as never, 2);

    expect(updated).toBe(2);
    // Only called for 2 builders.
    expect(mockEmbedCapabilityBestEffort).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// sweepNullEmbeddings
// ---------------------------------------------------------------------------

describe('sweepNullEmbeddings', () => {
  beforeEach(() => {
    mockEmbedBriefBestEffort.mockReset();
    mockEmbedAppBestEffort.mockReset();
  });

  it('fills null-embedding briefs and returns updated count', async () => {
    mockEmbedBriefBestEffort.mockResolvedValue(FAKE_VEC);

    const briefRow = {
      id: 'brief-1',
      title: 'My Brief',
      content: {
        title: 'My Brief',
        problem: { trigger: 'end of month', affected: 'finance team' },
        desiredOutcome: { definitionOfGoodEnough: 'fast invoicing', mustHaves: ['PDF'] },
      },
    };

    const { client } = makeFakeClient({
      briefs: [{ data: [briefRow] }, { data: null }],
      apps: [{ data: [] }], // no null-embedding apps
    });

    const { updated, failed } = await sweepNullEmbeddings(client as never, 100);

    expect(updated).toBe(1);
    expect(failed).toBe(0);
    expect(mockEmbedBriefBestEffort).toHaveBeenCalledOnce();
  });

  it('fills null-embedding apps and returns updated count', async () => {
    mockEmbedAppBestEffort.mockResolvedValue(FAKE_VEC);

    const appRow = {
      id: 'app-x',
      title: 'App X',
      tagline: 'Does things',
      description: 'Full description',
      solves_problems: ['thing'],
      category_id: 'productivity',
    };

    const { client } = makeFakeClient({
      briefs: [{ data: [] }], // no null-embedding briefs
      apps: [{ data: [appRow] }, { data: null }],
    });

    const { updated, failed } = await sweepNullEmbeddings(client as never, 100);

    expect(updated).toBe(1);
    expect(failed).toBe(0);
    expect(mockEmbedAppBestEffort).toHaveBeenCalledOnce();

    // Confirm the correct fields were passed to the embed helper.
    const [input] = mockEmbedAppBestEffort.mock.calls[0];
    expect(input).toMatchObject({
      name: 'App X',
      oneLiner: 'Does things',
      description: 'Full description',
      solvesProblems: ['thing'],
      category: 'productivity',
    });
  });

  it('isolates per-row brief failures — one embed returning null does not abort the batch', async () => {
    // Brief 1 fails, Brief 2 succeeds.
    mockEmbedBriefBestEffort
      .mockResolvedValueOnce(null) // brief-1 fails
      .mockResolvedValueOnce(FAKE_VEC); // brief-2 succeeds

    const briefRows = [
      { id: 'brief-1', title: 'A', content: {} },
      { id: 'brief-2', title: 'B', content: {} },
    ];

    const { client } = makeFakeClient({
      briefs: [
        { data: briefRows }, // initial fetch
        { data: null }, // UPDATE for brief-2
      ],
      apps: [{ data: [] }],
    });

    const { updated, failed } = await sweepNullEmbeddings(client as never, 100);

    expect(updated).toBe(1);
    expect(failed).toBe(1);
  });

  it('isolates per-row app failures — one embed returning null does not abort the batch', async () => {
    // App 1 fails, App 2 succeeds.
    mockEmbedAppBestEffort
      .mockResolvedValueOnce(null) // app-1 fails
      .mockResolvedValueOnce(FAKE_VEC); // app-2 succeeds

    const appRows = [
      {
        id: 'app-1',
        title: 'A1',
        tagline: 't',
        description: '',
        solves_problems: [],
        category_id: 'c',
      },
      {
        id: 'app-2',
        title: 'A2',
        tagline: 't',
        description: '',
        solves_problems: [],
        category_id: 'c',
      },
    ];

    const { client } = makeFakeClient({
      briefs: [{ data: [] }],
      apps: [
        { data: appRows }, // initial fetch
        { data: null }, // UPDATE for app-2
      ],
    });

    const { updated, failed } = await sweepNullEmbeddings(client as never, 100);

    expect(updated).toBe(1);
    expect(failed).toBe(1);
  });

  it('processes both briefs and apps in a single call and totals counts', async () => {
    mockEmbedBriefBestEffort.mockResolvedValue(FAKE_VEC);
    mockEmbedAppBestEffort.mockResolvedValue(FAKE_VEC);

    const briefRows = [{ id: 'b1', title: 'B', content: {} }];
    const appRows = [
      {
        id: 'a1',
        title: 'A',
        tagline: 't',
        description: '',
        solves_problems: [],
        category_id: 'c',
      },
    ];

    const { client } = makeFakeClient({
      briefs: [{ data: briefRows }, { data: null }], // fetch + update
      apps: [{ data: appRows }, { data: null }], // fetch + update
    });

    const { updated, failed } = await sweepNullEmbeddings(client as never, 100);

    expect(updated).toBe(2);
    expect(failed).toBe(0);
  });

  it('UPDATEs briefs.embedding with the vector literal string', async () => {
    mockEmbedBriefBestEffort.mockResolvedValue(FAKE_VEC);

    const { client, builders } = makeFakeClient({
      briefs: [{ data: [{ id: 'brief-1', title: 'T', content: {} }] }, { data: null }],
      apps: [{ data: [] }],
    });

    await sweepNullEmbeddings(client as never, 100);

    // The second briefs builder is for the UPDATE call.
    const updateBuilders = builders.filter((b) => b.table === 'briefs');
    // First builder is the fetch (has .is() call); second is the update.
    const updateBuilder = updateBuilders[1];
    const updateCall = updateBuilder.b.calls.find((c) => c.method === 'update');
    expect(updateCall?.args[0]).toEqual({ embedding: VECTOR_LITERAL });
  });

  it('UPDATEs apps.embedding with the vector literal string', async () => {
    mockEmbedAppBestEffort.mockResolvedValue(FAKE_VEC);

    const appRow = {
      id: 'app-z',
      title: 'Z',
      tagline: 't',
      description: '',
      solves_problems: [],
      category_id: 'c',
    };

    const { client, builders } = makeFakeClient({
      briefs: [{ data: [] }],
      apps: [{ data: [appRow] }, { data: null }],
    });

    await sweepNullEmbeddings(client as never, 100);

    const updateBuilders = builders.filter((b) => b.table === 'apps');
    const updateBuilder = updateBuilders[1];
    const updateCall = updateBuilder.b.calls.find((c) => c.method === 'update');
    expect(updateCall?.args[0]).toEqual({ embedding: VECTOR_LITERAL });
  });
});

/**
 * Unit tests for the SemanticCandidateRetriever (RRF over FTS + pgvector). No
 * live DB: a faked Supabase client routes `.from(table)` to per-table canned
 * rows AND `.rpc(name, args)` to canned `{ id, distance }` arrays.
 *
 * We assert the fusion behavior, the null-embedding degradation path, vector-
 * only materialization, the existingStack drop, and the builder intersection
 * (structured arm is authoritative on eligibility).
 */

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import { SemanticCandidateRetriever } from './semantic-retriever';

// ---------------------------------------------------------------------------
// Faked query builder (mirrors retriever.test.ts) + a chainable .rpc().
// ---------------------------------------------------------------------------

type Call = { method: string; args: unknown[] };

function makeQueryBuilder(result: { data?: unknown }) {
  const calls: Call[] = [];
  const resolved = { data: result.data ?? null, error: null };
  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  for (const m of ['select', 'eq', 'in', 'order', 'textSearch', 'overlaps', 'contains', 'or']) {
    builder[m] = chain(m);
  }
  builder.limit = (...args: unknown[]) => {
    calls.push({ method: 'limit', args });
    return Promise.resolve(resolved);
  };
  builder.maybeSingle = () => Promise.resolve(resolved);
  builder.single = () => Promise.resolve(resolved);
  (builder as { then?: unknown }).then = (onFulfilled: (v: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled);
  return { builder, calls };
}

type RpcRow = { id: string; distance: number };

/**
 * Faked client. `tableResults` maps table → rows for `.from()` chains.
 * `rpcResults` maps RPC name → canned `{ id, distance }[]`. `rpcCalls` records
 * each `.rpc()` invocation so tests can assert the vector arm is/ isn't called.
 */
function makeFakeClient(opts: {
  // A table maps to either a single canned result reused for every `.from()`
  // call, or an array of per-call results consumed in order (so the FTS arm and
  // the materialization arm can return different rows for the same table).
  tableResults?: Record<string, { data?: unknown } | Array<{ data?: unknown }>>;
  rpcResults?: Record<string, RpcRow[]>;
}) {
  const { tableResults = {}, rpcResults = {} } = opts;
  const fromCalls: string[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const tableBuilders: Record<string, ReturnType<typeof makeQueryBuilder>> = {};
  const perTableCallCount: Record<string, number> = {};

  function resultFor(table: string): { data?: unknown } {
    const entry = tableResults[table];
    if (entry === undefined) return { data: [] };
    const n = perTableCallCount[table] ?? 0;
    perTableCallCount[table] = n + 1;
    if (Array.isArray(entry)) return entry[n] ?? entry[entry.length - 1] ?? { data: [] };
    return entry;
  }

  const client = {
    from(table: string) {
      fromCalls.push(table);
      const b = makeQueryBuilder(resultFor(table));
      tableBuilders[`${table}#${fromCalls.length}`] = b;
      return b.builder;
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: rpcResults[name] ?? [], error: null });
    },
  };
  return { client, fromCalls, rpcCalls, tableBuilders };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseBrief: BriefContent = {
  title: 'Invoicing for freelancers',
  problem: { trigger: 'started freelancing', affected: 'me' },
  desiredOutcome: {
    definitionOfGoodEnough: 'send invoices fast',
    mustHaves: ['recurring invoices'],
    niceToHaves: [],
    outOfScope: [],
  },
  context: { industry: 'fintech', existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

function appRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'app1',
    slug: 'lumen',
    title: 'Lumen',
    tagline: 'invoices',
    description: 'invoicing app',
    category_id: 'productivity',
    tags: ['invoice'],
    solves_problems: ['invoicing'],
    link: 'https://x',
    author_id: 'u1',
    ...over,
  };
}

const EMB = '[0.1,0.2,0.3]';

// ---------------------------------------------------------------------------
// retrieveApps
// ---------------------------------------------------------------------------

describe('SemanticCandidateRetriever.retrieveApps', () => {
  it('null briefEmbedding → returns the FTS result; vector RPC not called', async () => {
    const { client, rpcCalls } = makeFakeClient({
      tableResults: { apps: { data: [appRow({ id: 'a1', slug: 's1', title: 'T1' })] } },
    });
    const retriever = new SemanticCandidateRetriever(client as never, null);
    const apps = await retriever.retrieveApps(baseBrief, 30);

    expect(apps.map((a) => a.id)).toEqual(['a1']);
    expect(rpcCalls).toHaveLength(0); // vector arm skipped entirely
  });

  it('fuses FTS + vector ranks via RRF (id high in both arms wins)', async () => {
    // FTS order: [a1, a2]. Vector order: [a2, a1]. a2 is rank2/rank1, a1 is
    // rank1/rank2 → tied scores; RRF tie-break keeps first-seen (a1 first in
    // the FTS list). But put a2 rank1 in BOTH would force a2 first; here we use
    // an asymmetric setup where a2 is clearly boosted.
    const { client, rpcCalls } = makeFakeClient({
      tableResults: {
        apps: {
          data: [
            appRow({ id: 'a1', slug: 's1', title: 'T1' }),
            appRow({ id: 'a2', slug: 's2', title: 'T2' }),
          ],
        },
      },
      // Vector ranks a2 first, a1 second.
      rpcResults: {
        match_apps_by_embedding: [
          { id: 'a2', distance: 0.1 },
          { id: 'a1', distance: 0.2 },
        ],
      },
    });
    const retriever = new SemanticCandidateRetriever(client as never, EMB);
    const apps = await retriever.retrieveApps(baseBrief, 30);

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe('match_apps_by_embedding');
    // Both present, both arms agree on the set; order is the fused order.
    expect(apps.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('strongly reorders when vector promotes an FTS-trailing id', async () => {
    // FTS order: [a1, a2, a3]. Vector ranks a3 #1 and a3 also high → a3 climbs.
    const { client } = makeFakeClient({
      tableResults: {
        apps: {
          data: [
            appRow({ id: 'a1', slug: 's1', title: 'T1' }),
            appRow({ id: 'a2', slug: 's2', title: 'T2' }),
            appRow({ id: 'a3', slug: 's3', title: 'T3' }),
          ],
        },
      },
      rpcResults: {
        match_apps_by_embedding: [
          { id: 'a3', distance: 0.05 },
          { id: 'a2', distance: 0.5 },
        ],
      },
    });
    const retriever = new SemanticCandidateRetriever(client as never, EMB);
    const apps = await retriever.retrieveApps(baseBrief, 30);
    // a3: FTS rank3 + vector rank1; a1: FTS rank1 only.
    // score(a3)=1/63+1/61, score(a1)=1/61 → a3 ahead of a1.
    expect(apps.indexOf(apps.find((a) => a.id === 'a3')!)).toBeLessThan(
      apps.indexOf(apps.find((a) => a.id === 'a1')!),
    );
  });

  it('materializes a vector-only id that FTS never returned', async () => {
    // FTS returns only a1. Vector returns a1 + a9 (vector-only). a9 must get
    // fetched + included.
    const { client, fromCalls } = makeFakeClient({
      tableResults: {
        // First .from('apps') = FTS arm (only a1). Second = materialize (a9).
        apps: [
          { data: [appRow({ id: 'a1', slug: 's1', title: 'T1' })] },
          { data: [appRow({ id: 'a9', slug: 's9', title: 'T9' })] },
        ],
      },
      rpcResults: {
        match_apps_by_embedding: [
          { id: 'a9', distance: 0.05 },
          { id: 'a1', distance: 0.2 },
        ],
      },
    });
    const retriever = new SemanticCandidateRetriever(client as never, EMB);
    const apps = await retriever.retrieveApps(baseBrief, 30);

    expect(apps.map((a) => a.id).sort()).toEqual(['a1', 'a9']);
    // from('apps') called for FTS arm AND for materialization of missing ids.
    expect(fromCalls.filter((t) => t === 'apps').length).toBeGreaterThanOrEqual(2);
  });

  it('applies the existingStack drop to materialized vector-only ids', async () => {
    const brief: BriefContent = {
      ...baseBrief,
      context: { ...baseBrief.context, existingStack: ['T9'] },
    };
    const { client } = makeFakeClient({
      tableResults: {
        apps: {
          data: [
            appRow({ id: 'a1', slug: 's1', title: 'T1' }),
            appRow({ id: 'a9', slug: 's9', title: 'T9' }), // in existingStack
          ],
        },
      },
      rpcResults: {
        match_apps_by_embedding: [
          { id: 'a9', distance: 0.05 },
          { id: 'a1', distance: 0.2 },
        ],
      },
    });
    const retriever = new SemanticCandidateRetriever(client as never, EMB);
    const apps = await retriever.retrieveApps(brief, 30);
    // a9 dropped both in FTS arm AND in materialization (title matches stack).
    expect(apps.map((a) => a.id)).toEqual(['a1']);
  });

  it('passes licensing flags to the RPC (self_hosted_only → exclude_saas)', async () => {
    const brief: BriefContent = {
      ...baseBrief,
      constraints: { ...baseBrief.constraints, licensing: 'self_hosted_only' },
    };
    const { client, rpcCalls } = makeFakeClient({
      tableResults: { apps: { data: [appRow({ id: 'a1' })] } },
      rpcResults: { match_apps_by_embedding: [{ id: 'a1', distance: 0.1 }] },
    });
    const retriever = new SemanticCandidateRetriever(client as never, EMB);
    await retriever.retrieveApps(brief, 30);
    const args = rpcCalls[0].args as {
      exclude_saas: boolean;
      oss_only: boolean;
      query_embedding: string;
    };
    expect(args.exclude_saas).toBe(true);
    expect(args.oss_only).toBe(false);
    expect(args.query_embedding).toBe(EMB); // raw pgvector string passed through
  });
});

// ---------------------------------------------------------------------------
// retrieveBuilders
// ---------------------------------------------------------------------------

describe('SemanticCandidateRetriever.retrieveBuilders', () => {
  function profileRow(over: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'b1',
      handle: 'alice',
      display_name: 'Alice',
      bio: 'builds',
      accepts_requests: true,
      request_capacity: 3,
      request_domains: [] as string[],
      request_rate_band: null,
      inferred_capabilities: ['react'],
      last_brief_response_at: null,
      ...over,
    };
  }
  function builderAppRow(authorId: string, title = 'App') {
    return { author_id: authorId, title, tagline: 'tg', category_id: 'c', tags: ['react'] };
  }

  it('null briefEmbedding → returns the structured result; vector RPC not called', async () => {
    const { client, rpcCalls } = makeFakeClient({
      tableResults: {
        profiles: { data: [profileRow()] },
        apps: { data: [builderAppRow('b1')] },
        matches: { data: [] },
      },
    });
    const retriever = new SemanticCandidateRetriever(client as never, null);
    const builders = await retriever.retrieveBuilders(baseBrief, 50);
    expect(builders.map((b) => b.id)).toEqual(['b1']);
    expect(rpcCalls).toHaveLength(0);
  });

  it('fuses structured + vector ranks (vector promotes an eligible builder)', async () => {
    // Structured order: [b1, b2]. Vector ranks b2 first → b2 climbs.
    const { client, rpcCalls } = makeFakeClient({
      tableResults: {
        profiles: { data: [profileRow(), profileRow({ id: 'b2', handle: 'bob' })] },
        apps: { data: [builderAppRow('b1'), builderAppRow('b2')] },
        matches: { data: [] },
      },
      rpcResults: {
        match_builders_by_embedding: [
          { id: 'b2', distance: 0.05 },
          { id: 'b1', distance: 0.5 },
        ],
      },
    });
    const retriever = new SemanticCandidateRetriever(client as never, EMB);
    const builders = await retriever.retrieveBuilders(baseBrief, 50);

    expect(rpcCalls[0].name).toBe('match_builders_by_embedding');
    expect(builders.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
    // b2: struct rank2 + vector rank1; b1: struct rank1 + vector rank2.
    // score(b2)=1/62+1/61, score(b1)=1/61+1/62 → equal; tie-break keeps b1
    // first-seen (structured list scanned first). So b1 leads here.
    expect(builders[0].id).toBe('b1');
  });

  it('NEVER surfaces a builder the structured arm rejected, even if vector returns it', async () => {
    // b2 is over capacity (structured drops it). Vector ranks b2 #1 — must be
    // intersected out.
    const { client } = makeFakeClient({
      tableResults: {
        profiles: {
          data: [profileRow(), profileRow({ id: 'b2', handle: 'bob', request_capacity: 1 })],
        },
        apps: { data: [builderAppRow('b1'), builderAppRow('b2')] },
        // b2 has 1 active match == capacity 1 → structured drops b2.
        matches: { data: [{ candidate_builder_id: 'b2' }] },
      },
      rpcResults: {
        match_builders_by_embedding: [
          { id: 'b2', distance: 0.01 }, // vector loves b2…
          { id: 'b1', distance: 0.5 },
        ],
      },
    });
    const retriever = new SemanticCandidateRetriever(client as never, EMB);
    const builders = await retriever.retrieveBuilders(baseBrief, 50);
    // …but b2 was rejected structurally → must not appear.
    expect(builders.map((b) => b.id)).toEqual(['b1']);
  });
});

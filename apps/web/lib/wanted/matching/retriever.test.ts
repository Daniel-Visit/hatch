/**
 * Unit tests for the FTS CandidateRetriever. No live DB: a small faked Supabase
 * client records the query-builder chain (.from().select().textSearch()...) and
 * returns canned rows. We assert query CONSTRUCTION and FILTER application.
 */

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import {
  FtsCandidateRetriever,
  buildAppSearchQuery,
  rateBandOverlaps,
  briefBudgetBand,
} from './retriever';

// ---------------------------------------------------------------------------
// Faked Supabase client — a chainable query builder that records calls.
// ---------------------------------------------------------------------------

type Call = { method: string; args: unknown[] };

/**
 * Build a thenable query-builder stub. Every chained method records its call
 * and returns the builder; awaiting it (or `.limit()` / `.maybeSingle()` etc.)
 * resolves to `{ data, error: null }`. `count` is returned for head:true reads.
 */
function makeQueryBuilder(result: { data?: unknown; count?: number }) {
  const calls: Call[] = [];
  const resolved = { data: result.data ?? null, error: null, count: result.count ?? null };

  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  for (const m of ['select', 'eq', 'in', 'order', 'textSearch', 'overlaps', 'contains']) {
    builder[m] = chain(m);
  }
  // Terminal-ish methods resolve to the result (but also chainable).
  builder.limit = (...args: unknown[]) => {
    calls.push({ method: 'limit', args });
    return Promise.resolve(resolved);
  };
  builder.maybeSingle = () => Promise.resolve(resolved);
  builder.single = () => Promise.resolve(resolved);
  // Make the builder awaitable directly (e.g. count head reads end on .eq/.in).
  (builder as { then?: unknown }).then = (onFulfilled: (v: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled);

  return { builder, calls, resolved };
}

/**
 * Faked client: routes `.from(table)` to a per-table builder. `tableResults`
 * maps table name → the data/count that table's queries resolve to.
 */
function makeFakeClient(tableResults: Record<string, { data?: unknown; count?: number }>) {
  const fromCalls: string[] = [];
  const builders: Record<string, ReturnType<typeof makeQueryBuilder>> = {};
  const client = {
    from(table: string) {
      fromCalls.push(table);
      // Fresh builder per call so per-call chains are isolated.
      const b = makeQueryBuilder(tableResults[table] ?? { data: [] });
      builders[`${table}#${fromCalls.length}`] = b;
      return b.builder;
    },
  };
  return { client, fromCalls, builders };
}

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

// ---------------------------------------------------------------------------
// buildAppSearchQuery
// ---------------------------------------------------------------------------

describe('buildAppSearchQuery', () => {
  it('assembles high-signal brief fields into a websearch query', () => {
    const q = buildAppSearchQuery(baseBrief);
    expect(q).toContain('Invoicing for freelancers');
    expect(q).toContain('started freelancing');
    expect(q).toContain('send invoices fast');
    expect(q).toContain('recurring invoices');
    expect(q).toContain('fintech');
  });

  it('returns empty string for an empty brief', () => {
    const q = buildAppSearchQuery({
      problem: {},
      desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
      context: { existingStack: [] },
      constraints: { licensing: 'no_pref', geography: null },
      preferredSolutionType: [],
    });
    expect(q).toBe('');
  });
});

// ---------------------------------------------------------------------------
// rateBandOverlaps / briefBudgetBand
// ---------------------------------------------------------------------------

describe('rateBandOverlaps', () => {
  it('treats null on either side as compatible', () => {
    expect(rateBandOverlaps(null, 'GT_10K')).toBe(true);
    expect(rateBandOverlaps('LT_500', null)).toBe(true);
  });
  it('treats OPEN on either side as compatible', () => {
    expect(rateBandOverlaps('OPEN', 'GT_10K')).toBe(true);
    expect(rateBandOverlaps('LT_500', 'OPEN')).toBe(true);
  });
  it('requires equality otherwise', () => {
    expect(rateBandOverlaps('LT_500', 'LT_500')).toBe(true);
    expect(rateBandOverlaps('LT_500', 'GT_10K')).toBe(false);
  });
});

describe('briefBudgetBand', () => {
  it('uppercases the lowercase content enum', () => {
    expect(
      briefBudgetBand({
        ...baseBrief,
        constraints: { ...baseBrief.constraints, budgetBand: 'from_2k_10k' },
      }),
    ).toBe('FROM_2K_10K');
  });
  it('returns null when unset', () => {
    expect(briefBudgetBand(baseBrief)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// retrieveApps
// ---------------------------------------------------------------------------

describe('FtsCandidateRetriever.retrieveApps', () => {
  it('filters is_published, applies websearch textSearch, and limits', async () => {
    const { client, builders } = makeFakeClient({
      apps: {
        data: [
          {
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
          },
        ],
      },
    });

    const retriever = new FtsCandidateRetriever(client as never);
    const apps = await retriever.retrieveApps(baseBrief, 30);

    expect(apps).toHaveLength(1);
    expect(apps[0].id).toBe('app1');

    const calls = builders['apps#1'].calls;
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('select');
    expect(methods).toContain('eq'); // is_published = true
    expect(methods).toContain('textSearch');
    expect(methods).toContain('limit');

    const ts = calls.find((c) => c.method === 'textSearch')!;
    expect(ts.args[0]).toBe('search_vector');
    expect(ts.args[2]).toEqual({ type: 'websearch' });

    const limit = calls.find((c) => c.method === 'limit')!;
    expect(limit.args[0]).toBe(30);
  });

  it('drops apps in the seeker existingStack (by title or slug)', async () => {
    const { client } = makeFakeClient({
      apps: {
        data: [
          {
            id: 'a1',
            slug: 'lumen',
            title: 'Lumen',
            tagline: 't',
            description: '',
            category_id: 'c',
            tags: [],
            solves_problems: [],
            link: 'l',
            author_id: 'u',
          },
          {
            id: 'a2',
            slug: 'other',
            title: 'Other',
            tagline: 't',
            description: '',
            category_id: 'c',
            tags: [],
            solves_problems: [],
            link: 'l',
            author_id: 'u',
          },
        ],
      },
    });
    const brief: BriefContent = {
      ...baseBrief,
      context: { ...baseBrief.context, existingStack: ['Lumen'] },
    };
    const retriever = new FtsCandidateRetriever(client as never);
    const apps = await retriever.retrieveApps(brief);
    expect(apps.map((a) => a.id)).toEqual(['a2']);
  });

  it('skips textSearch when the brief yields an empty query', async () => {
    const empty: BriefContent = {
      problem: {},
      desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
      context: { existingStack: [] },
      constraints: { licensing: 'no_pref', geography: null },
      preferredSolutionType: [],
    };
    const { client, builders } = makeFakeClient({ apps: { data: [] } });
    const retriever = new FtsCandidateRetriever(client as never);
    await retriever.retrieveApps(empty);
    const methods = builders['apps#1'].calls.map((c) => c.method);
    expect(methods).not.toContain('textSearch');
  });
});

// ---------------------------------------------------------------------------
// retrieveBuilders — batched implementation
//
// The batched retriever always issues exactly 3 DB calls in this order:
//   1. profiles  (.eq('accepts_requests', true).limit(k))
//   2. apps      (.in('author_id', ids).eq('is_published', true))   ← ONE batch
//   3. matches   (.in('candidate_builder_id', ids).in('candidate_action', ...)) ← ONE batch
//
// Rate-band / domain / capacity / shipped-app filters are all applied in memory
// after the three queries resolve. The faked client below routes by table name
// so each test can supply canned results without caring about call ordering.
// ---------------------------------------------------------------------------

describe('FtsCandidateRetriever.retrieveBuilders', () => {
  function profileRow(over: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'b1',
      handle: 'alice',
      display_name: 'Alice',
      bio: 'builds things',
      accepts_requests: true,
      request_capacity: 3,
      request_domains: [] as string[],
      request_rate_band: null,
      inferred_capabilities: ['react'],
      last_brief_response_at: null,
      ...over,
    };
  }

  /**
   * Build a table-routed fake client for retrieveBuilders tests.
   * `profileRows`  → returned by the `profiles` query.
   * `appRows`      → returned by the batched `apps` query.
   * `matchRows`    → returned by the batched `matches` query.
   */
  function makeBuilderClient(opts: {
    profileRows?: unknown[];
    appRows?: unknown[];
    matchRows?: unknown[];
  }) {
    const { profileRows = [], appRows = [], matchRows = [] } = opts;
    const tableCalls: string[] = [];

    const client = {
      from(table: string) {
        tableCalls.push(table);
        if (table === 'profiles') {
          return makeQueryBuilder({ data: profileRows }).builder;
        }
        if (table === 'apps') {
          return makeQueryBuilder({ data: appRows }).builder;
        }
        if (table === 'matches') {
          return makeQueryBuilder({ data: matchRows }).builder;
        }
        return makeQueryBuilder({ data: [] }).builder;
      },
    };
    return { client, tableCalls };
  }

  it('keeps a builder with >=1 shipped app, capacity, and matching filters', async () => {
    const { client, tableCalls } = makeBuilderClient({
      profileRows: [profileRow()],
      appRows: [
        { author_id: 'b1', title: 'App', tagline: 'tg', category_id: 'c', tags: ['react'] },
      ],
      matchRows: [], // 0 active matches
    });
    const retriever = new FtsCandidateRetriever(client as never);
    const builders = await retriever.retrieveBuilders(baseBrief, 50);

    expect(builders).toHaveLength(1);
    expect(builders[0].id).toBe('b1');
    expect(builders[0].shippedAppCount).toBe(1);
    expect(builders[0].activeMatchCount).toBe(0);
    // Exactly 3 DB calls in the correct table order.
    expect(tableCalls).toEqual(['profiles', 'apps', 'matches']);
  });

  it('issues exactly one apps query and one matches query (not per-builder)', async () => {
    // Two profiles → still only 3 total from() calls.
    const { client, tableCalls } = makeBuilderClient({
      profileRows: [profileRow(), profileRow({ id: 'b2', handle: 'bob' })],
      appRows: [
        { author_id: 'b1', title: 'A1', tagline: 't', category_id: 'c', tags: [] },
        { author_id: 'b2', title: 'A2', tagline: 't', category_id: 'c', tags: [] },
      ],
      matchRows: [],
    });
    const retriever = new FtsCandidateRetriever(client as never);
    await retriever.retrieveBuilders(baseBrief, 50);
    // Still exactly 3 from() calls regardless of builder count — not N+1.
    expect(tableCalls).toEqual(['profiles', 'apps', 'matches']);
  });

  it('drops a builder at/over capacity', async () => {
    const { client } = makeBuilderClient({
      profileRows: [profileRow({ request_capacity: 2 })],
      appRows: [{ author_id: 'b1', title: 'App', tagline: 'tg', category_id: 'c', tags: [] }],
      // 2 active matches → active == capacity → drop
      matchRows: [{ candidate_builder_id: 'b1' }, { candidate_builder_id: 'b1' }],
    });
    const retriever = new FtsCandidateRetriever(client as never);
    const builders = await retriever.retrieveBuilders(baseBrief);
    expect(builders).toHaveLength(0);
  });

  it('drops a builder with zero shipped apps', async () => {
    const { client } = makeBuilderClient({
      profileRows: [profileRow()],
      appRows: [], // no apps at all
      matchRows: [],
    });
    const retriever = new FtsCandidateRetriever(client as never);
    const builders = await retriever.retrieveBuilders(baseBrief);
    expect(builders).toHaveLength(0);
  });

  it('drops a builder whose rate band mismatches the brief budget', async () => {
    const brief: BriefContent = {
      ...baseBrief,
      constraints: { ...baseBrief.constraints, budgetBand: 'lt_500' },
    };
    // Rate-band filter applied before batch queries → apps/matches never called.
    const { client, tableCalls } = makeBuilderClient({
      profileRows: [profileRow({ request_rate_band: 'GT_10K' })],
      appRows: [],
      matchRows: [],
    });
    const retriever = new FtsCandidateRetriever(client as never);
    const builders = await retriever.retrieveBuilders(brief);
    expect(builders).toHaveLength(0);
    // profiles queried, but apps+matches are skipped because no candidates survived.
    expect(tableCalls).toEqual(['profiles']);
  });

  it('drops a builder whose domains exclude the brief industry', async () => {
    // Domain filter also applied before batch queries.
    const { client, tableCalls } = makeBuilderClient({
      profileRows: [profileRow({ request_domains: ['gaming'] })],
      appRows: [],
      matchRows: [],
    });
    const retriever = new FtsCandidateRetriever(client as never);
    // baseBrief industry = 'fintech', builder domains = ['gaming'] → drop.
    const builders = await retriever.retrieveBuilders(baseBrief);
    expect(builders).toHaveLength(0);
    expect(tableCalls).toEqual(['profiles']);
  });

  it('caps shipped apps at 5 per builder', async () => {
    const manyApps = Array.from({ length: 8 }, (_, i) => ({
      author_id: 'b1',
      title: `App${i}`,
      tagline: 'tg',
      category_id: 'c',
      tags: [],
    }));
    const { client } = makeBuilderClient({
      profileRows: [profileRow()],
      appRows: manyApps,
      matchRows: [],
    });
    const retriever = new FtsCandidateRetriever(client as never);
    const builders = await retriever.retrieveBuilders(baseBrief);
    expect(builders[0].shippedApps).toHaveLength(5);
    expect(builders[0].shippedAppCount).toBe(5);
  });
});

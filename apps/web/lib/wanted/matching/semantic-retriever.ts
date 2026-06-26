import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BriefContent, Database } from '@hatch/shared';
import {
  FtsCandidateRetriever,
  type AppCandidate,
  type BuilderCandidate,
  type CandidateRetriever,
} from './retriever';
import { reciprocalRankFusion } from './rrf';

/**
 * Semantic (embedding) CandidateRetriever — Wanted Matcher, Task 5.
 *
 * `new/03-agents.md` §3.2 specifies cosine search over pgvector embeddings as
 * the retrieval step. This retriever HYBRIDISES that vector arm with the FTS /
 * structured arm ({@link FtsCandidateRetriever}) via Reciprocal Rank Fusion
 * (RRF). It plugs into the same {@link CandidateRetriever} seam — phase-a /
 * phase-b / run are unchanged.
 *
 * Design:
 * - The FTS retriever is COMPOSED, not duplicated: it already applies every
 *   cheap hard filter (is_published, existingStack drop, licensing class for
 *   apps; accepts_requests, rate band, domains, >=1 shipped app, capacity for
 *   builders). We reuse it verbatim so the hard-filter contract has ONE home.
 * - The vector arm calls migration-0040 RPCs (`match_apps_by_embedding`,
 *   `match_builders_by_embedding`) which return `{ id, distance }` ordered by
 *   ascending cosine distance. Those RPCs apply their OWN coarse SQL filters
 *   (is_published + licensing for apps; accepts_requests for builders) but NOT
 *   the per-candidate structured filters the FTS arm owns.
 * - Fusion: RRF over [ftsIds, vectorIds]. Apps then materialize vector-only ids
 *   (with the same existingStack drop). Builders INTERSECT the vector rank with
 *   the structured candidate set — a builder the structured arm rejected (over
 *   capacity, no shipped apps, wrong rate band) is NEVER surfaced.
 * - Degradation: if the brief has no embedding (`briefEmbedding === null`), the
 *   vector arm is skipped entirely and the FTS result is returned as-is. This is
 *   the same behavior as having no semantic provider configured.
 *
 * The brief embedding is passed as the RAW pgvector text form (`string | null`,
 * e.g. `"[0.1,0.2,...]"`) exactly as stored in `briefs.embedding`. Postgres
 * casts text→vector(1024) for the RPC arg, so we pass it through unparsed.
 */

type AnyClient = SupabaseClient<Database>;

/** Columns the FTS retriever selects for apps — mirrored for materialization. */
const APP_COLUMNS =
  'id, slug, title, tagline, description, category_id, tags, solves_problems, link, author_id';

/** Map the brief licensing preference to the app-embedding RPC filter flags. */
function appLicensingFlags(brief: BriefContent): {
  exclude_saas: boolean;
  oss_only: boolean;
} {
  const licensing = brief.constraints?.licensing;
  return {
    exclude_saas: licensing === 'self_hosted_only',
    oss_only: licensing === 'oss_only',
  };
}

export class SemanticCandidateRetriever implements CandidateRetriever {
  private readonly fts: FtsCandidateRetriever;

  constructor(
    private readonly client: AnyClient,
    private readonly briefEmbedding: string | null,
  ) {
    this.fts = new FtsCandidateRetriever(client);
  }

  async retrieveApps(brief: BriefContent, k = 30): Promise<AppCandidate[]> {
    // FTS arm: fully hard-filtered AppCandidate[] (the seam's authority).
    const ftsApps = await this.fts.retrieveApps(brief, k);

    // No brief embedding → degrade to FTS-only (vector arm not consulted).
    if (this.briefEmbedding === null) return ftsApps;

    // Vector arm: cosine search via the migration-0040 RPC.
    const { exclude_saas, oss_only } = appLicensingFlags(brief);
    const { data: vectorRows, error: vectorErr } = await this.client.rpc(
      'match_apps_by_embedding',
      {
        query_embedding: this.briefEmbedding,
        match_count: k,
        exclude_saas,
        oss_only,
      },
    );
    if (vectorErr) throw vectorErr;

    const ftsById = new Map(ftsApps.map((a) => [a.id, a]));
    const ftsIds = ftsApps.map((a) => a.id);
    const vectorIds = (vectorRows ?? []).map((r) => r.id);

    // Fuse the two ranked id lists.
    const fusedIds = reciprocalRankFusion([ftsIds, vectorIds]);

    // Materialize vector-only ids the FTS arm never returned.
    const missingIds = fusedIds.filter((id) => !ftsById.has(id));
    const materialized = await this.materializeApps(brief, missingIds);
    const byId = new Map<string, AppCandidate>([...ftsById, ...materialized]);

    // Emit in fused order; skip any id we couldn't materialize (e.g. a vector
    // hit that failed the existingStack drop or is no longer published).
    const out: AppCandidate[] = [];
    for (const id of fusedIds) {
      const app = byId.get(id);
      if (app) out.push(app);
      if (out.length >= k) break;
    }
    return out;
  }

  /**
   * Fetch + map vector-only app ids into AppCandidate[], applying the SAME
   * is_published guard and existingStack drop the FTS arm applies. Returns a
   * Map keyed by id for easy merge. Empty input → no query, empty map.
   */
  private async materializeApps(
    brief: BriefContent,
    ids: string[],
  ): Promise<Map<string, AppCandidate>> {
    const result = new Map<string, AppCandidate>();
    if (ids.length === 0) return result;

    const { data, error } = await this.client
      .from('apps')
      .select(APP_COLUMNS)
      .in('id', ids)
      .eq('is_published', true);
    if (error) throw error;

    const existing = new Set(
      (brief.context?.existingStack ?? []).map((s) => s.toLowerCase().trim()),
    );

    for (const row of data ?? []) {
      const title = row.title.toLowerCase().trim();
      const slug = row.slug.toLowerCase().trim();
      // Same existingStack drop as FtsCandidateRetriever.
      if (existing.has(title) || existing.has(slug)) continue;
      result.set(row.id, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        tagline: row.tagline,
        description: row.description,
        categoryId: row.category_id,
        tags: row.tags ?? [],
        solvesProblems: row.solves_problems ?? [],
        link: row.link,
        authorId: row.author_id,
      });
    }
    return result;
  }

  async retrieveBuilders(brief: BriefContent, k = 50): Promise<BuilderCandidate[]> {
    // Structured arm: fully hard-filtered BuilderCandidate[] (capacity, rate
    // band, domains, >=1 shipped app). This is the authority on WHO is eligible.
    const structured = await this.fts.retrieveBuilders(brief, k);

    // No brief embedding → degrade to structured-only.
    if (this.briefEmbedding === null) return structured;

    // Vector arm: cosine search over capability_embedding.
    const { data: vectorRows, error: vectorErr } = await this.client.rpc(
      'match_builders_by_embedding',
      {
        query_embedding: this.briefEmbedding,
        match_count: k,
      },
    );
    if (vectorErr) throw vectorErr;

    const structuredById = new Map(structured.map((b) => [b.id, b]));
    const structuredIds = structured.map((b) => b.id);
    // INTERSECT: the vector arm may surface builders that fail the structured
    // filters (capacity, shipped apps, …). Drop those — never surface a builder
    // the structured arm rejected.
    const vectorIds = (vectorRows ?? []).map((r) => r.id).filter((id) => structuredById.has(id));

    const fusedIds = reciprocalRankFusion([structuredIds, vectorIds]);

    const out: BuilderCandidate[] = [];
    for (const id of fusedIds) {
      const builder = structuredById.get(id);
      if (builder) out.push(builder);
      if (out.length >= k) break;
    }
    return out;
  }
}

/** Construct the semantic retriever from a client + the raw brief embedding. */
export function createSemanticRetriever(
  client: AnyClient,
  briefEmbedding: string | null,
): CandidateRetriever {
  return new SemanticCandidateRetriever(client, briefEmbedding);
}

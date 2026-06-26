import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BriefContent, Database } from '@hatch/shared';

/**
 * Candidate retrieval for the Matcher — Wanted feature, Task 3 (matcher-core).
 *
 * `new/03-agents.md` §3.2 specifies cosine search over pgvector embeddings as
 * the retrieval step for both phases. Embeddings are DEFERRED (Decision D1),
 * so v1 implements retrieval with Postgres full-text search (FTS) over
 * `apps.search_vector` (GIN-indexed, migration 0006) plus structured filters
 * over `profiles` (migration 0034).
 *
 * The {@link CandidateRetriever} interface is the SEAM where a semantic
 * (embedding) retriever plugs in later WITHOUT touching phase-a / phase-b /
 * run. Task 2 (heuristic.ts) imports this interface — keep it stable.
 *
 * Design:
 * - Retrievers do pure retrieval + cheap hard pre-filters that map to SQL
 *   (`is_published`, `existingStack`, `accepts_requests`, rate band, domains).
 *   They do NOT call the LLM and do NOT compute final scores — re-ranking lives
 *   in phase-a / phase-b.
 * - The Supabase client is injected so the FTS implementation is unit-testable
 *   with a faked client (no live DB).
 */

type AnyClient = SupabaseClient<Database>;

/** A retrieved app candidate — the subset of columns the re-ranker needs. */
export interface AppCandidate {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  categoryId: string;
  tags: string[];
  solvesProblems: string[];
  link: string;
  authorId: string;
}

/** A retrieved builder candidate — profile + lightweight shipped-app summary. */
export interface BuilderCandidate {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  acceptsRequests: boolean;
  requestCapacity: number;
  requestDomains: string[];
  requestRateBand: Database['public']['Enums']['budget_band'] | null;
  inferredCapabilities: string[];
  lastBriefResponseAt: string | null;
  /** Count of published apps this builder has shipped (>= 1 required). */
  shippedAppCount: number;
  /** Up to 5 shipped-app one-liners with categories, for the re-rank prompt. */
  shippedApps: Array<{
    title: string;
    tagline: string;
    categoryId: string;
    tags: string[];
  }>;
  /** Count of the builder's currently-active matches (CONNECT/PENDING). */
  activeMatchCount: number;
}

/**
 * The retrieval seam. v1 = FTS ({@link FtsCandidateRetriever}); a semantic
 * (embedding) implementation can replace it later with no caller changes.
 */
export interface CandidateRetriever {
  /** Retrieve up to `k` app candidates relevant to the brief (default 30). */
  retrieveApps(brief: BriefContent, k?: number): Promise<AppCandidate[]>;
  /** Retrieve up to `k` builder candidates relevant to the brief (default 50). */
  retrieveBuilders(brief: BriefContent, k?: number): Promise<BuilderCandidate[]>;
}

/**
 * Build a `websearch`-style FTS query string from the brief. We bias toward the
 * high-signal fields the App embedding recipe uses (§1.6): title, problem
 * trigger, definition-of-good-enough, must-haves, industry. The result is plain
 * search terms (NOT instructions) — anti-injection delimiting happens later at
 * the LLM boundary (§3.2.6); FTS itself cannot be prompt-injected.
 */
export function buildAppSearchQuery(brief: BriefContent): string {
  const parts: string[] = [];
  if (brief.title) parts.push(brief.title);
  if (brief.problem?.trigger) parts.push(brief.problem.trigger);
  if (brief.problem?.affected) parts.push(brief.problem.affected);
  if (brief.desiredOutcome?.definitionOfGoodEnough) {
    parts.push(brief.desiredOutcome.definitionOfGoodEnough);
  }
  for (const mh of brief.desiredOutcome?.mustHaves ?? []) parts.push(mh);
  if (brief.context?.industry) parts.push(brief.context.industry);
  // Collapse whitespace; websearch parser tolerates free text.
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** True if two budget bands are compatible (overlap, or either is OPEN). */
export function rateBandOverlaps(
  briefBand: Database['public']['Enums']['budget_band'] | null,
  builderBand: Database['public']['Enums']['budget_band'] | null,
): boolean {
  // Missing on either side = no constraint = compatible.
  if (briefBand === null || builderBand === null) return true;
  if (briefBand === 'OPEN' || builderBand === 'OPEN') return true;
  return briefBand === builderBand;
}

/**
 * Map a BriefContent lowercase budget enum to the UPPERCASE DB `budget_band`
 * enum. The content layer uses lowercase values (`brief-content.ts`); the DB
 * uses UPPERCASE (`enums.ts`). Returns null when unset.
 */
export function briefBudgetBand(
  brief: BriefContent,
): Database['public']['Enums']['budget_band'] | null {
  const b = brief.constraints?.budgetBand;
  if (!b) return null;
  return b.toUpperCase() as Database['public']['Enums']['budget_band'];
}

/**
 * FTS-backed retriever (v1). Implements {@link CandidateRetriever} using
 * `apps.search_vector` websearch + structured `profiles` filters.
 */
export class FtsCandidateRetriever implements CandidateRetriever {
  constructor(private readonly client: AnyClient) {}

  async retrieveApps(brief: BriefContent, k = 30): Promise<AppCandidate[]> {
    const q = buildAppSearchQuery(brief);

    // Pre-filters that map to SQL:
    // - is_published = true     (live only; apps has no `archived` column —
    //                            unpublished is the "not-live" proxy)
    // - existingStack drop      (don't surface apps the seeker already uses)
    // - licensing class         (§3.2.1 step 2, migration 0037 — below)
    let query = this.client
      .from('apps')
      .select(
        'id, slug, title, tagline, description, category_id, tags, solves_problems, link, author_id',
      )
      .eq('is_published', true);

    // Licensing pre-filter (§3.2.1 step 2, migration 0037): drop apps whose
    // delivery class is incompatible with an exclusionary seeker preference.
    // Unclassified apps (`licensing IS NULL`) are NEVER excluded — unknown
    // licensing is treated as a potential match. `saas_ok`/`no_pref` → no filter.
    const licensing = brief.constraints?.licensing;
    if (licensing === 'self_hosted_only') {
      query = query.or('licensing.is.null,licensing.neq.saas');
    } else if (licensing === 'oss_only') {
      query = query.or('licensing.is.null,licensing.eq.oss');
    }

    // Only apply textSearch when we have a non-empty query; an empty websearch
    // string matches nothing in Postgres, which would wrongly return zero apps.
    if (q.length > 0) {
      query = query.textSearch('search_vector', q, { type: 'websearch' });
    }

    // solves_problems overlap boost: if the brief names must-haves, prefer apps
    // whose `solves_problems` tags overlap. We OR this with the FTS hit set by
    // running it as an additional filter only when tags exist AND fall back to
    // FTS otherwise. We keep it as a soft signal by NOT hard-filtering here —
    // overlap is surfaced to the re-ranker via the `solvesProblems` field.

    const { data, error } = await query.limit(k);
    if (error) throw error;

    const existing = new Set(
      (brief.context?.existingStack ?? []).map((s) => s.toLowerCase().trim()),
    );

    return (data ?? [])
      .map(
        (row): AppCandidate => ({
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
        }),
      )
      .filter(
        (app) =>
          // Drop apps the seeker already uses (match on title or slug).
          !existing.has(app.title.toLowerCase().trim()) &&
          !existing.has(app.slug.toLowerCase().trim()),
      );
  }

  async retrieveBuilders(brief: BriefContent, k = 50): Promise<BuilderCandidate[]> {
    const briefBand = briefBudgetBand(brief);
    const industry = brief.context?.industry?.trim() ?? '';

    // --- Step 1: fetch candidate profiles (SQL filter: accepts_requests=true) ---
    const { data, error } = await this.client
      .from('profiles')
      .select(
        'id, handle, display_name, bio, accepts_requests, request_capacity, request_domains, request_rate_band, inferred_capabilities, last_brief_response_at',
      )
      .eq('accepts_requests', true)
      .limit(k);
    if (error) throw error;

    const rows = data ?? [];

    // --- Step 2: cheap in-memory filters (rate-band, domains) before batching ---
    // These are O(1) per row and require no DB round-trip, so we eliminate
    // non-candidates before issuing the two batch queries.
    const candidates = rows.filter((row) => {
      if (!rateBandOverlaps(briefBand, row.request_rate_band)) return false;
      const domains = row.request_domains ?? [];
      if (domains.length > 0 && industry.length > 0) {
        return domains.some((d) => d.toLowerCase().trim() === industry.toLowerCase());
      }
      return true;
    });

    if (candidates.length === 0) return [];

    const ids = candidates.map((r) => r.id);

    // --- Step 3: ONE batch apps query for all surviving candidates ---
    // We fetch at most 5 apps per builder; since we need per-builder grouping
    // we fetch all rows and group in memory. Supabase doesn't support GROUP BY
    // + LIMIT-per-group, so we pull a flat result and slice per builder.
    const { data: appsData, error: appsErr } = await this.client
      .from('apps')
      .select('author_id, title, tagline, category_id, tags')
      .in('author_id', ids)
      .eq('is_published', true);
    if (appsErr) throw appsErr;

    // Group shipped apps by builder id (up to 5 per builder).
    const appsByBuilder = new Map<
      string,
      Array<{ title: string; tagline: string; categoryId: string; tags: string[] }>
    >();
    for (const a of appsData ?? []) {
      const bucket = appsByBuilder.get(a.author_id) ?? [];
      if (bucket.length < 5) {
        bucket.push({
          title: a.title,
          tagline: a.tagline,
          categoryId: a.category_id,
          tags: a.tags ?? [],
        });
      }
      appsByBuilder.set(a.author_id, bucket);
    }

    // --- Step 4: ONE batch matches query for active-capacity counts ---
    const { data: matchRows, error: matchErr } = await this.client
      .from('matches')
      .select('candidate_builder_id')
      .in('candidate_builder_id', ids)
      .in('candidate_action', ['PENDING', 'CONNECT']);
    if (matchErr) throw matchErr;

    const activeCountByBuilder = new Map<string, number>();
    for (const m of matchRows ?? []) {
      if (m.candidate_builder_id === null) continue;
      activeCountByBuilder.set(
        m.candidate_builder_id,
        (activeCountByBuilder.get(m.candidate_builder_id) ?? 0) + 1,
      );
    }

    // --- Step 5: apply per-builder filters (>=1 shipped app, capacity) ---
    const out: BuilderCandidate[] = [];
    for (const row of candidates) {
      const shippedApps = appsByBuilder.get(row.id) ?? [];
      if (shippedApps.length === 0) continue;

      const activeMatchCount = activeCountByBuilder.get(row.id) ?? 0;
      if (row.request_capacity <= activeMatchCount) continue;

      out.push({
        id: row.id,
        handle: row.handle,
        displayName: row.display_name,
        bio: row.bio,
        acceptsRequests: row.accepts_requests,
        requestCapacity: row.request_capacity,
        requestDomains: row.request_domains ?? [],
        requestRateBand: row.request_rate_band,
        inferredCapabilities: row.inferred_capabilities ?? [],
        lastBriefResponseAt: row.last_brief_response_at,
        shippedAppCount: shippedApps.length,
        shippedApps,
        activeMatchCount,
      });
    }

    return out;
  }
}

/** Construct the default (FTS) retriever from a Supabase client. */
export function createFtsRetriever(client: AnyClient): CandidateRetriever {
  return new FtsCandidateRetriever(client);
}

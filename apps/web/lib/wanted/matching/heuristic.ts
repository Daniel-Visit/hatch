import 'server-only';
import type { BriefContent } from '@hatch/shared';
import type { AppCandidate, BuilderCandidate, CandidateRetriever } from './retriever';

/**
 * Match-potential heuristic — Wanted feature, Task 2 (agents-pv).
 * `new/03-agents.md` §3.4.5.
 *
 * A CHEAP, DETERMINISTIC estimate of how many matches a brief is likely to
 * yield, with NO LLM call and NO embeddings. The Validator route runs this
 * twice — once on the brief as-is ("current") and once on a hypothetical brief
 * with all suggestions applied ("withSuggestions") — and shows the delta on the
 * Brief Health Card. Re-validation on each Apply (§3.4.9) re-runs THIS function
 * only (no agent call), so it must be fast and side-effect-free.
 *
 * Why a heuristic and not §3.4.5's literal formula? §3.4.5 specifies:
 *
 *     confidence = 0.4 * cosine_similarity
 *                + 0.3 * (1 if hard_filters_pass else 0)
 *                + 0.2 * (last_active_days < 30 ? 1 : 0.5)
 *                + 0.1 * (matches_in_last_30d > 0 ? 1 : 0.5)
 *
 * Cosine similarity is N/A — embeddings are DEFERRED (retriever Decision D1; v1
 * retrieval is FTS). So the 0.4 cosine term is replaced by an FTS-derived
 * lexical-overlap proxy in [0,1]: how much of the brief's high-signal text the
 * retrieved candidate already surfaces. The remaining terms are preserved:
 * - hard_filters_pass: the FtsCandidateRetriever ONLY returns candidates that
 *   passed its SQL/JS hard filters (published apps; builders with capacity +
 *   rate-band + domain + >=1 shipped app), so a returned candidate scores 1 on
 *   this term by construction.
 * - liveness: builders carry `lastBriefResponseAt`; apps have no per-candidate
 *   activity timestamp, so app liveness defaults to the neutral 0.5 (an app
 *   being published is its liveness signal, already captured by the filter).
 * - recent matches: builders' `activeMatchCount` (currently-active matches) is
 *   the available proxy for "responsive in the last 30d".
 *
 * The estimate intentionally approximates "candidates at confidence >= 0.6"
 * (§3.4.5): we score each retrieved candidate with the per-candidate confidence
 * above and COUNT those clearing 0.6. The result is a direction, not a promise.
 *
 * Determinism: given identical retriever outputs, the numbers are identical —
 * pure arithmetic over the candidate fields, no randomness, no time-of-day
 * dependence (we do NOT read `Date.now()` here; the route stamps `computedAt`).
 */

/** Per-§3.4.5 confidence threshold a candidate must clear to be counted. */
export const CONFIDENCE_THRESHOLD = 0.6;

/** Term weights — mirror §3.4.5 (cosine term repurposed as lexical overlap). */
const W_OVERLAP = 0.4;
const W_HARD_FILTER = 0.3;
const W_LIVENESS = 0.2;
const W_RECENT = 0.1;

/** A candidate that passed retrieval is, by construction, hard-filter-clean. */
const HARD_FILTER_PASS = 1;
/** Neutral liveness when no per-candidate activity timestamp exists. */
const NEUTRAL_LIVENESS = 0.5;
/** "Recent activity within 30 days" window. */
const LIVENESS_WINDOW_DAYS = 30;

/** The structured result the Validator route stitches into matchPotentialEstimate. */
export interface MatchPotential {
  /**
   * Estimate 0–1: the share of retrieved candidates clearing the §3.4.5
   * confidence threshold, blended across apps + builders. The route turns the
   * raw COUNTS (below) into the seeker-facing `current` / `withSuggestions`
   * integers; `estimate` is the normalized signal for internal comparison.
   */
  estimate: number;
  /** Count of app candidates clearing CONFIDENCE_THRESHOLD. */
  appCandidateCount: number;
  /** Count of builder candidates clearing CONFIDENCE_THRESHOLD. */
  builderCandidateCount: number;
  /** Human-readable explanation of how the estimate was derived (for the audit log). */
  basis: string;
}

/**
 * High-signal brief tokens (lowercased, >= 3 chars) used for the lexical-overlap
 * proxy that stands in for cosine similarity. Drawn from the same fields the App
 * embedding recipe / FTS query weight: title, problem trigger/affected,
 * definition-of-good-enough, must-haves, industry.
 */
function briefTokens(brief: BriefContent): Set<string> {
  const parts: string[] = [];
  if (brief.title) parts.push(brief.title);
  if (brief.problem?.trigger) parts.push(brief.problem.trigger);
  if (brief.problem?.affected) parts.push(brief.problem.affected);
  if (brief.desiredOutcome?.definitionOfGoodEnough) {
    parts.push(brief.desiredOutcome.definitionOfGoodEnough);
  }
  for (const mh of brief.desiredOutcome?.mustHaves ?? []) parts.push(mh);
  if (brief.context?.industry) parts.push(brief.context.industry);

  return tokenize(parts.join(' '));
}

function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const tok of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length >= 3) out.add(tok);
  }
  return out;
}

/**
 * Lexical overlap proxy in [0,1]: fraction of the brief's high-signal tokens
 * that appear in the candidate's text. This stands in for cosine_similarity.
 * Empty brief tokens → 0 (no signal to match on).
 */
function lexicalOverlap(briefToks: Set<string>, candidateText: string): number {
  if (briefToks.size === 0) return 0;
  const candToks = tokenize(candidateText);
  let hits = 0;
  for (const t of briefToks) if (candToks.has(t)) hits++;
  return hits / briefToks.size;
}

/** Days since an ISO timestamp relative to `now` (deterministic given inputs). */
function daysSince(iso: string | null, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (now - t) / (1000 * 60 * 60 * 24);
}

/** Per-candidate confidence for an app (§3.4.5, cosine → lexical overlap). */
function appConfidence(app: AppCandidate, briefToks: Set<string>): number {
  const text = [
    app.title,
    app.tagline,
    app.description,
    app.solvesProblems.join(' '),
    app.tags.join(' '),
  ].join(' ');
  const overlap = lexicalOverlap(briefToks, text);
  return (
    W_OVERLAP * overlap +
    W_HARD_FILTER * HARD_FILTER_PASS +
    // Apps carry no per-candidate activity timestamp → neutral liveness; being
    // published (which the filter already guaranteed) is the liveness signal.
    W_LIVENESS * NEUTRAL_LIVENESS +
    W_RECENT * NEUTRAL_LIVENESS
  );
}

/** Per-candidate confidence for a builder (§3.4.5, cosine → lexical overlap). */
function builderConfidence(builder: BuilderCandidate, briefToks: Set<string>, now: number): number {
  const text = [
    builder.displayName,
    builder.bio ?? '',
    builder.inferredCapabilities.join(' '),
    builder.requestDomains.join(' '),
    builder.shippedApps.map((a) => `${a.title} ${a.tagline} ${a.tags.join(' ')}`).join(' '),
  ].join(' ');
  const overlap = lexicalOverlap(briefToks, text);

  const liveness =
    daysSince(builder.lastBriefResponseAt, now) < LIVENESS_WINDOW_DAYS ? 1 : NEUTRAL_LIVENESS;
  // "matches_in_last_30d > 0" proxy: the builder currently has active matches.
  const recent = builder.activeMatchCount > 0 ? 1 : NEUTRAL_LIVENESS;

  return (
    W_OVERLAP * overlap +
    W_HARD_FILTER * HARD_FILTER_PASS +
    W_LIVENESS * liveness +
    W_RECENT * recent
  );
}

type Options = {
  /** App retrieval cap (§3.4.5 top-30). */
  appK?: number;
  /** Builder retrieval cap (§3.4.5 top-30; default matches the spec's estimate pass). */
  builderK?: number;
  /**
   * Reference "now" (ms) for liveness. **Required** — the route passes
   * `Date.now()`. This module never calls `Date.now()` itself so the function
   * stays deterministic for tests and replay. Making it required prevents the
   * trap where a forgotten `now` defaults to epoch 0 and makes every builder
   * look maximally live (daysSince(ts, 0) is always negative → "< 30 days").
   */
  now: number;
};

/**
 * Compute the match-potential estimate for a brief. Deterministic given the
 * retriever's outputs (and the injected `now`). NO LLM, NO embeddings.
 *
 * Retrieves apps + builders (the retriever applies all cheap hard filters),
 * scores each with the §3.4.5 heuristic confidence (cosine repurposed as FTS
 * lexical overlap), counts those clearing CONFIDENCE_THRESHOLD, and returns the
 * counts + a normalized 0–1 estimate + a human-readable basis string.
 */
export async function computeMatchPotential(
  brief: BriefContent,
  retriever: CandidateRetriever,
  options: Options,
): Promise<MatchPotential> {
  const { appK = 30, builderK = 30, now } = options;

  const briefToks = briefTokens(brief);

  const [apps, builders] = await Promise.all([
    retriever.retrieveApps(brief, appK),
    retriever.retrieveBuilders(brief, builderK),
  ]);

  const appCandidateCount = apps.filter(
    (a) => appConfidence(a, briefToks) >= CONFIDENCE_THRESHOLD,
  ).length;

  const builderCandidateCount = builders.filter(
    (b) => builderConfidence(b, briefToks, now) >= CONFIDENCE_THRESHOLD,
  ).length;

  // Normalized estimate: share of all retrieved candidates clearing the bar.
  // 0 when nothing was retrieved (no signal).
  const totalRetrieved = apps.length + builders.length;
  const totalClearing = appCandidateCount + builderCandidateCount;
  const estimate =
    totalRetrieved === 0 ? 0 : Math.round((totalClearing / totalRetrieved) * 100) / 100;

  const basis =
    briefToks.size === 0
      ? `No high-signal brief text to match on; ${apps.length} apps + ${builders.length} builders retrieved, ` +
        `${appCandidateCount} apps + ${builderCandidateCount} builders cleared confidence ${CONFIDENCE_THRESHOLD}.`
      : `FTS lexical-overlap heuristic (no embeddings): ${apps.length} apps + ${builders.length} builders retrieved; ` +
        `${appCandidateCount} apps + ${builderCandidateCount} builders cleared confidence ${CONFIDENCE_THRESHOLD} ` +
        `(weights: overlap ${W_OVERLAP}, hard-filter ${W_HARD_FILTER}, liveness ${W_LIVENESS}, recent ${W_RECENT}).`;

  return { estimate, appCandidateCount, builderCandidateCount, basis };
}

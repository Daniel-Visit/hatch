import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import {
  MATCHER_RERANK_MODEL,
  MATCHER_PHASE_B_RERANK_PROMPT,
  type BriefContent,
} from '@hatch/shared';
import type { BuilderCandidate, CandidateRetriever } from './retriever';
import { isInjectionFlagged, runRerank, serializeBriefForRerank } from './phase-a';

/**
 * Matcher Phase B — Builder-match (`new/03-agents.md` §3.2.2).
 *
 * retrieve builders → hard filter (in the retriever) → single batched Haiku
 * re-rank → keep score >= 60 → cap top 5 → produce match rows.
 *
 * Anthropic client + retriever are INJECTED (mirrors Phase A / refiner.ts).
 * Performs NO DB writes; `run.ts` persists matches + audit. Anti-injection
 * (§3.2.6) is inherited from the shared `runRerank` path + the Phase B prompt's
 * `<brief>` delimiter reminder.
 */

const KEEP_THRESHOLD = 60;
const CAP = 5;

/** A scored builder candidate after the Haiku re-rank. */
export interface ScoredBuilder {
  builder: BuilderCandidate;
  score: number;
  rationale: string;
  /** True if this score tripped the §3.2.6 injection heuristic. */
  flagged: boolean;
}

export interface PhaseBResult {
  /** Kept builders (score >= 60), capped at 5, sorted desc by score. */
  ranked: ScoredBuilder[];
  /** All scored builders (for the audit log), sorted desc. */
  allScored: ScoredBuilder[];
  consideredCount: number;
  modelUsed: string;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Build the §3.2.2 builder profile block for one candidate. Wrapped in a
 * delimited `<builder>` element so the model treats it as DATA.
 */
export function enumerateBuilderProfiles(builders: BuilderCandidate[]): string {
  return builders
    .map((b, i) => {
      const lastActive =
        b.lastBriefResponseAt !== null ? `${daysAgo(b.lastBriefResponseAt)} days ago` : 'unknown';
      const apps =
        b.shippedApps.length > 0
          ? b.shippedApps.map((a) => `    - ${a.title} (${a.categoryId}): ${a.tagline}`).join('\n')
          : '    - (none listed)';
      const stack =
        b.inferredCapabilities.length > 0 ? b.inferredCapabilities.join(', ') : 'unspecified';
      const domains = b.requestDomains.length > 0 ? b.requestDomains.join(', ') : 'any';
      const rate = b.requestRateBand ?? 'unspecified';
      return [
        `<builder index="${i}" builderId="${b.id}">`,
        `  Builder @${b.handle} — last active ${lastActive}`,
        `  Shipped ${b.shippedAppCount} apps:`,
        apps,
        `  Inferred stack: ${stack}`,
        `  Domains of interest: ${domains}`,
        `  Rate band: ${rate}`,
        `</builder>`,
      ].join('\n');
    })
    .join('\n');
}

/** Whole days since an ISO timestamp (clamped at >= 0). */
function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** Fill the Phase B prompt template with the delimited brief + builders. */
export function buildPhaseBPrompt(brief: BriefContent, builders: BuilderCandidate[]): string {
  return MATCHER_PHASE_B_RERANK_PROMPT.replace(
    '{briefContent}',
    serializeBriefForRerank(brief),
  ).replace('{enumeratedBuilderProfiles}', enumerateBuilderProfiles(builders));
}

/**
 * Run Phase B end-to-end (retrieve → re-rank → keep >= 60 → cap 5). Pure of DB
 * writes; `run.ts` persists the result and fires notifications.
 */
export async function runPhaseB(args: {
  anthropic: Anthropic;
  retriever: CandidateRetriever;
  brief: BriefContent;
  k?: number;
}): Promise<PhaseBResult> {
  const { anthropic, retriever, brief, k = 50 } = args;
  const startedAt = Date.now();

  const builders = await retriever.retrieveBuilders(brief, k);

  if (builders.length === 0) {
    return {
      ranked: [],
      allScored: [],
      consideredCount: 0,
      modelUsed: MATCHER_RERANK_MODEL,
      durationMs: Date.now() - startedAt,
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  const { rows, tokensIn, tokensOut } = await runRerank({
    anthropic,
    rerankPrompt: buildPhaseBPrompt(brief, builders),
    idKey: 'builderId',
  });

  const scoreById = new Map(rows.map((r) => [r.id, r]));

  const allScored: ScoredBuilder[] = builders
    .map((builder): ScoredBuilder => {
      const row = scoreById.get(builder.id);
      const score = row?.score ?? 0;
      const rationale = row?.rationale ?? '';
      return {
        builder,
        score,
        rationale,
        flagged: isInjectionFlagged(score, rationale),
      };
    })
    .sort((a, b) => b.score - a.score);

  const ranked = allScored.filter((s) => s.score >= KEEP_THRESHOLD).slice(0, CAP);

  return {
    ranked,
    allScored,
    consideredCount: builders.length,
    modelUsed: MATCHER_RERANK_MODEL,
    durationMs: Date.now() - startedAt,
    tokensIn,
    tokensOut,
  };
}

export const PHASE_B_THRESHOLDS = {
  KEEP: KEEP_THRESHOLD,
  CAP,
} as const;

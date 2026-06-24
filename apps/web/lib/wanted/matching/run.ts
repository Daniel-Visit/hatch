import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { BriefContentSchema, type BriefContent } from '@hatch/shared';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createAnthropic } from '@/lib/wanted/anthropic';
import { insertMatches, type InsertMatchParams, type MatchRow } from '@/lib/wanted/match-repo';
import { insertAuditLog, type AuditCandidate } from '@/lib/wanted/match-audit-repo';
import { createFtsRetriever, type CandidateRetriever } from './retriever';
import { createSemanticRetriever } from './semantic-retriever';
import { runPhaseA, type PhaseAResult, type ScoredApp } from './phase-a';
import { runPhaseB, type PhaseBResult, type ScoredBuilder } from './phase-b';

/**
 * Matcher orchestrator — `runMatching` (Wanted feature, Task 3 / §3.2).
 *
 * Sequences Phase A (apps) then CONDITIONALLY Phase B (builders), persists the
 * resulting matches (XOR-enforced) via match-repo, and writes one audit log per
 * phase via match-audit-repo. All writes use the admin (service-role) client —
 * `matches` / `brief_match_audit_logs` are SELECT-only under RLS.
 *
 * Testability: the Anthropic client and the retriever are INJECTABLE (mirrors
 * refiner.ts). When omitted they default to the real client factory + the real
 * FTS retriever bound to a fresh admin client.
 *
 * §3.2.2 conditional: Phase B is SKIPPED when Phase A produced a >= 75 ("strong")
 * app match AND the seeker did not explicitly request `custom_build` or
 * `fork_and_modify`. `mode` overrides:
 *   - 'apps'     → Phase A only.
 *   - 'builders' → Phase B only (skip A).
 *   - 'both'     → Phase A, then conditional Phase B (default).
 */

export type MatchMode = 'apps' | 'builders' | 'both';

export interface RunMatchingArgs {
  /** Injected for tests; defaults to the real Anthropic client. */
  anthropic?: Anthropic;
  /** Injected for tests; defaults to the real FTS retriever over admin. */
  retriever?: CandidateRetriever;
  /**
   * Injected for tests; defaults to a fresh admin client. Used for both the
   * retriever (when not overridden) AND all repo writes.
   */
  admin?: ReturnType<typeof createSupabaseAdminClient>;
}

export interface RunMatchingResult {
  briefId: string;
  mode: MatchMode;
  /** True if Phase A surfaced a >= 75 app ("this might already exist"). */
  hasStrongAppMatch: boolean;
  /** Whether Phase B actually ran (vs. skipped by the §3.2.2 conditional). */
  phaseBRan: boolean;
  /** Persisted match rows (app + builder). */
  matches: MatchRow[];
  phaseA: PhaseAResult | null;
  phaseB: PhaseBResult | null;
}

/**
 * Pick the default retriever for a run. When a semantic embedding provider is
 * configured (`VOYAGE_API_KEY` present) we use the hybrid semantic retriever
 * (RRF over FTS + pgvector cosine); otherwise we fall back to FTS-only. The
 * semantic retriever itself degrades to FTS-only when the brief has no
 * embedding, so a missing `briefEmbedding` is safe.
 */
export function createDefaultRetriever(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  briefEmbedding: string | null,
): CandidateRetriever {
  return process.env.VOYAGE_API_KEY
    ? createSemanticRetriever(admin, briefEmbedding)
    : createFtsRetriever(admin);
}

/** True if the brief explicitly wants a custom build / fork (forces Phase B). */
function wantsCustomBuild(brief: BriefContent): boolean {
  const types = brief.preferredSolutionType ?? [];
  return types.includes('custom_build') || types.includes('fork_and_modify');
}

/** Map a ScoredApp to an InsertMatchParams (APP candidate; auto-accepts). */
function appMatchParams(briefId: string, s: ScoredApp): InsertMatchParams {
  return {
    briefId,
    candidateType: 'APP',
    candidateAppId: s.app.id,
    candidateBuilderId: null,
    // Re-rank scores are 0-100; agent_confidence is stored 0-1.
    agentConfidence: s.score / 100,
    agentRationale: s.rationale,
    candidateAction: 'CONNECT', // app candidates auto-accept (§ matches schema)
  };
}

/** Map a ScoredBuilder to an InsertMatchParams (BUILDER candidate; PENDING). */
function builderMatchParams(briefId: string, s: ScoredBuilder): InsertMatchParams {
  return {
    briefId,
    candidateType: 'BUILDER',
    candidateAppId: null,
    candidateBuilderId: s.builder.id,
    agentConfidence: s.score / 100,
    agentRationale: s.rationale,
    candidateAction: 'PENDING',
  };
}

/** Build the per-candidate audit trail for a Phase A run. */
function phaseAAudit(result: PhaseAResult): AuditCandidate[] {
  const keptIds = new Set(result.ranked.map((r) => r.app.id));
  return result.allScored.map((s) => ({
    candidateId: s.app.id,
    score: s.score,
    rationale: s.rationale,
    flagged: s.flagged,
    kept: keptIds.has(s.app.id),
  }));
}

/** Build the per-candidate audit trail for a Phase B run. */
function phaseBAudit(result: PhaseBResult): AuditCandidate[] {
  const keptIds = new Set(result.ranked.map((r) => r.builder.id));
  return result.allScored.map((s) => ({
    candidateId: s.builder.id,
    score: s.score,
    rationale: s.rationale,
    flagged: s.flagged,
    kept: keptIds.has(s.builder.id),
  }));
}

/**
 * Run the matcher for a brief. Reads the brief's content via the admin client,
 * runs the phases per `mode`, persists matches + audit logs, and returns a
 * structured summary.
 */
export async function runMatching(
  briefId: string,
  mode: MatchMode = 'both',
  args: RunMatchingArgs = {},
): Promise<RunMatchingResult> {
  const admin = args.admin ?? createSupabaseAdminClient();
  const anthropic = args.anthropic ?? createAnthropic();

  // Read the brief content + embedding (admin: matcher runs server-side, no RLS
  // context). The embedding is the raw pgvector text form (`string | null`).
  const { data: briefRow, error: briefErr } = await admin
    .from('briefs')
    .select('content, embedding')
    .eq('id', briefId)
    .single();
  if (briefErr) throw briefErr;

  // Construct the retriever AFTER the brief read so the semantic retriever can
  // be seeded with the brief embedding. An injected retriever (tests) wins.
  const retriever = args.retriever ?? createDefaultRetriever(admin, briefRow.embedding);

  // The stored content is a JSON partial; parse through the schema so defaults
  // (mustHaves: [], licensing: 'no_pref', etc.) are applied consistently.
  const brief: BriefContent = BriefContentSchema.parse(briefRow.content ?? {});

  let phaseA: PhaseAResult | null = null;
  let phaseB: PhaseBResult | null = null;
  let hasStrongAppMatch = false;
  let phaseBRan = false;
  const matchParams: InsertMatchParams[] = [];

  // --- Phase A (apps) ---
  if (mode === 'apps' || mode === 'both') {
    phaseA = await runPhaseA({ anthropic, retriever, brief });
    hasStrongAppMatch = phaseA.hasStrongMatch;
    for (const s of phaseA.ranked) matchParams.push(appMatchParams(briefId, s));

    await insertAuditLog(admin, {
      briefId,
      phase: 'APP',
      candidatesConsidered: phaseA.consideredCount,
      candidatesShortlisted: phaseA.allScored.filter((s) => s.score >= 60).length,
      candidatesFinal: phaseA.ranked.length,
      modelUsed: phaseA.modelUsed,
      durationMs: phaseA.durationMs,
      candidates: phaseAAudit(phaseA),
    });
  }

  // --- Phase B (builders), conditional per §3.2.2 ---
  const phaseBForced = mode === 'builders';
  const phaseBEligible = mode === 'builders' || mode === 'both';
  // Skip B when a strong app match exists AND the seeker didn't ask to build.
  const skipBForStrongApp = mode === 'both' && hasStrongAppMatch && !wantsCustomBuild(brief);

  if (phaseBEligible && (phaseBForced || !skipBForStrongApp)) {
    phaseB = await runPhaseB({ anthropic, retriever, brief });
    phaseBRan = true;
    for (const s of phaseB.ranked) matchParams.push(builderMatchParams(briefId, s));

    await insertAuditLog(admin, {
      briefId,
      phase: 'BUILDER',
      candidatesConsidered: phaseB.consideredCount,
      candidatesShortlisted: phaseB.allScored.filter((s) => s.score >= 60).length,
      candidatesFinal: phaseB.ranked.length,
      modelUsed: phaseB.modelUsed,
      durationMs: phaseB.durationMs,
      candidates: phaseBAudit(phaseB),
    });
  }

  // --- Persist matches (XOR enforced inside insertMatches) ---
  const matches = await insertMatches(admin, matchParams);

  return {
    briefId,
    mode,
    hasStrongAppMatch,
    phaseBRan,
    matches,
    phaseA,
    phaseB,
  };
}

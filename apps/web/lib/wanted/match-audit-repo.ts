import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hatch/shared';

/**
 * match-audit-repo — append-only writes to `public.brief_match_audit_logs`
 * (Wanted feature, Task 3 / `new/03-agents.md` §3.2.1 step 5, §3.2.2 step 6).
 *
 * The table has SELECT-only RLS (brief author reads). All writes go through the
 * admin (service-role) client, mirroring `turn-repo.ts`.
 *
 * Per-candidate scores + rationales (and any §3.2.6 injection flags) are stored
 * in the `rationale_json` jsonb column — the table intentionally keeps only
 * aggregate counts as first-class columns and the full decision trail as JSON.
 */

type AdminClient = SupabaseClient<Database>;

export type MatchAuditLogRow = Database['public']['Tables']['brief_match_audit_logs']['Row'];

type MatchPhase = Database['public']['Enums']['match_phase'];

/** Per-candidate decision row stored inside `rationale_json`. */
export interface AuditCandidate {
  /** App id or builder id, depending on phase. */
  candidateId: string;
  score: number;
  rationale: string;
  /** True if the §3.2.6 high-score injection heuristic tripped. */
  flagged?: boolean;
  /** True if kept after thresholding. */
  kept?: boolean;
}

export interface InsertAuditLogParams {
  briefId: string;
  phase: MatchPhase;
  candidatesConsidered: number;
  candidatesShortlisted: number;
  candidatesFinal: number;
  modelUsed?: string | null;
  durationMs?: number;
  /** Full per-candidate decision trail (scores, rationales, flags). */
  candidates: AuditCandidate[];
}

/**
 * Append one matcher-run audit log row (admin client). The `candidates` trail
 * plus run metadata are serialized into `rationale_json`.
 */
export async function insertAuditLog(
  admin: AdminClient,
  params: InsertAuditLogParams,
): Promise<MatchAuditLogRow> {
  const rationaleJson = {
    candidates: params.candidates,
    flaggedCount: params.candidates.filter((c) => c.flagged).length,
  } as unknown as Database['public']['Tables']['brief_match_audit_logs']['Insert']['rationale_json'];

  const { data, error } = await admin
    .from('brief_match_audit_logs')
    .insert({
      brief_id: params.briefId,
      phase: params.phase,
      candidates_considered: params.candidatesConsidered,
      candidates_shortlisted: params.candidatesShortlisted,
      candidates_final: params.candidatesFinal,
      model_used: params.modelUsed ?? null,
      duration_ms: params.durationMs ?? 0,
      rationale_json: rationaleJson,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

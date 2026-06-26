import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hatch/shared';
import type { TurnRole } from '@hatch/shared';

type AdminClient = SupabaseClient<Database>;
type AnyClient = SupabaseClient<Database>;

export type BriefRefinementTurnRow = Database['public']['Tables']['brief_refinement_turns']['Row'];

export interface AppendTurnParams {
  briefId: string;
  round: number;
  turnIndex: number;
  role: TurnRole;
  content?: string;
  contentJson?: unknown;
  modelUsed?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  /**
   * The agent's declarative UI invocation envelope ({ kind:'ui_call', component,
   * props }), stored on the `ui_component_invocation` column. The ui-response
   * endpoint reads this column to find a pending UI call (§3.1.5.1 / §3.1.5.2).
   */
  uiComponentInvocation?: unknown;
}

/** Max times appendTurn recomputes turn_index after a unique-violation race. */
const APPEND_TURN_MAX_RETRIES = 3;

/**
 * Insert a new turn row into brief_refinement_turns.
 *
 * IMPORTANT: Must be called with the admin client — this table has NO INSERT
 * RLS policy. The route handler is responsible for authenticating + authorizing
 * the author before calling this function.
 *
 * Concurrency: `nextTurnIndex` reads the current max then the caller inserts, so
 * two concurrent turns in the same (brief_id, round) can compute the same index.
 * Migration 0038's UNIQUE index makes the loser's insert fail with 23505; we
 * recover by recomputing the next index and retrying (bounded), which serialises
 * concurrent appends without a transaction.
 */
export async function appendTurn(
  admin: AdminClient,
  params: AppendTurnParams,
): Promise<BriefRefinementTurnRow> {
  const {
    briefId,
    round,
    turnIndex,
    role,
    content = '',
    contentJson,
    modelUsed,
    tokensIn,
    tokensOut,
    uiComponentInvocation,
  } = params;

  const basePayload = {
    brief_id: briefId,
    round,
    role: role as Database['public']['Enums']['turn_role'],
    content,
    content_json:
      contentJson !== undefined
        ? (contentJson as Database['public']['Tables']['brief_refinement_turns']['Insert']['content_json'])
        : null,
    ui_component_invocation:
      uiComponentInvocation !== undefined
        ? (uiComponentInvocation as Database['public']['Tables']['brief_refinement_turns']['Insert']['ui_component_invocation'])
        : null,
    model_used: modelUsed ?? null,
    tokens_in: tokensIn ?? null,
    tokens_out: tokensOut ?? null,
  };

  let candidateIndex = turnIndex;
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await admin
      .from('brief_refinement_turns')
      .insert({ ...basePayload, turn_index: candidateIndex })
      .select()
      .single();

    if (!error) return data;

    // 23505 = unique_violation: another concurrent insert took this turn_index.
    if (error.code === '23505' && attempt < APPEND_TURN_MAX_RETRIES) {
      candidateIndex = await nextTurnIndex(admin, briefId, round);
      continue;
    }
    throw error;
  }
}

/**
 * Count the total number of turns for a brief.
 * Uses exact count with head:true (no row data returned).
 * Used to enforce the 12-turn cap.
 */
export async function countTurns(client: AnyClient, briefId: string): Promise<number> {
  const { count, error } = await client
    .from('brief_refinement_turns')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Return the next available turn_index for a given brief + round.
 * Returns (max existing turn_index + 1), or 0 if no turns exist for this round.
 */
export async function nextTurnIndex(
  client: AnyClient,
  briefId: string,
  round: number,
): Promise<number> {
  const { data, error } = await client
    .from('brief_refinement_turns')
    .select('turn_index')
    .eq('brief_id', briefId)
    .eq('round', round)
    .order('turn_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data === null) return 0;
  return data.turn_index + 1;
}

/**
 * List all turns for a brief, ordered by (round, turn_index) ascending.
 * When `round` is provided, filters to that round only.
 * Used to build the agent's conversation history.
 */
export async function listTurns(
  client: AnyClient,
  briefId: string,
  round?: number,
): Promise<BriefRefinementTurnRow[]> {
  let query = client
    .from('brief_refinement_turns')
    .select('*')
    .eq('brief_id', briefId)
    .order('round', { ascending: true })
    .order('turn_index', { ascending: true });

  if (round !== undefined) {
    query = query.eq('round', round);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

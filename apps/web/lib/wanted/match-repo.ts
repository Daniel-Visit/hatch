import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, BriefContent } from '@hatch/shared';

/**
 * match-repo — reads/writes over `public.matches` (Wanted feature, Task 3).
 *
 * `public.matches` has SELECT-only RLS (brief author + matched builder can
 * read; NO insert/update policy). All WRITES therefore go through the admin
 * (service-role) client, mirroring `turn-repo.ts`. The caller is responsible
 * for authorizing the actor before invoking a write.
 *
 * The DB enforces the XOR invariant (`matches_candidate_xor`: exactly one of
 * candidate_app_id / candidate_builder_id), but we ALSO enforce it in JS before
 * the insert so callers get a clear error instead of a Postgres constraint
 * violation, and so a malformed payload never reaches the DB.
 */

type AdminClient = SupabaseClient<Database>;
type AnyClient = SupabaseClient<Database>;

export type MatchRow = Database['public']['Tables']['matches']['Row'];
type SwipeAction = Database['public']['Enums']['swipe_action'];
type CandidateType = Database['public']['Enums']['candidate_type'];

/** A single match to insert. Exactly one candidate id must be present. */
export interface InsertMatchParams {
  briefId: string;
  candidateType: CandidateType;
  /** Set iff candidateType === 'APP'. */
  candidateAppId?: string | null;
  /** Set iff candidateType === 'BUILDER'. */
  candidateBuilderId?: string | null;
  agentConfidence: number;
  agentRationale?: string;
  /** App candidates auto-accept on the candidate side. */
  candidateAction?: SwipeAction;
}

/** Thrown when an InsertMatchParams violates the candidate XOR invariant. */
export class MatchInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchInvariantError';
  }
}

/** Validate the XOR invariant + candidateType/id agreement for one match. */
function assertCandidateXor(p: InsertMatchParams): void {
  const hasApp = p.candidateAppId != null;
  const hasBuilder = p.candidateBuilderId != null;
  if (hasApp === hasBuilder) {
    throw new MatchInvariantError(
      'matches: exactly one of candidateAppId / candidateBuilderId must be set',
    );
  }
  if (p.candidateType === 'APP' && !hasApp) {
    throw new MatchInvariantError("matches: candidateType 'APP' requires candidateAppId");
  }
  if (p.candidateType === 'BUILDER' && !hasBuilder) {
    throw new MatchInvariantError("matches: candidateType 'BUILDER' requires candidateBuilderId");
  }
}

/**
 * Insert a batch of matches (admin client). Validates the XOR invariant for
 * each row first. Returns the inserted rows. Empty input is a no-op returning
 * `[]` (no DB call).
 */
export async function insertMatches(
  admin: AdminClient,
  matches: InsertMatchParams[],
): Promise<MatchRow[]> {
  if (matches.length === 0) return [];
  for (const m of matches) assertCandidateXor(m);

  const rows: Database['public']['Tables']['matches']['Insert'][] = matches.map((m) => ({
    brief_id: m.briefId,
    candidate_type: m.candidateType,
    candidate_app_id: m.candidateAppId ?? null,
    candidate_builder_id: m.candidateBuilderId ?? null,
    agent_confidence: m.agentConfidence,
    agent_rationale: m.agentRationale ?? '',
    // App candidates auto-accept; builder candidates default PENDING.
    candidate_action: m.candidateAction ?? (m.candidateType === 'APP' ? 'CONNECT' : 'PENDING'),
  }));

  const { data, error } = await admin.from('matches').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

/**
 * List matches for a brief, sorted by agent_confidence desc (matches the
 * `matches_brief_confidence_idx` index ordering). Reads may use a session
 * client (author RLS scopes visibility); the caller decides which client.
 */
export async function listMatchesForBrief(
  client: AnyClient,
  briefId: string,
  candidateType?: CandidateType,
): Promise<MatchRow[]> {
  let query = client
    .from('matches')
    .select('*')
    .eq('brief_id', briefId)
    .order('agent_confidence', { ascending: false });
  if (candidateType !== undefined) {
    query = query.eq('candidate_type', candidateType);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── Builder inbox ─────────────────────────────────────────────────────────────

type BriefRow = Database['public']['Tables']['briefs']['Row'];
type BriefSummary = Pick<
  BriefRow,
  | 'id'
  | 'title'
  | 'content'
  | 'budget_band'
  | 'timeline'
  | 'solution_types'
  | 'expires_at'
  | 'author_id'
>;

/** Raw DB row shape returned by the nested join in listBuilderRequests. */
type MatchWithBrief = MatchRow & { brief: BriefSummary | null };

/** The inbox card shape the builder-side UI needs — match fields + embedded brief summary. */
export interface BuilderRequest {
  id: string;
  agentConfidence: number;
  agentRationale: string | null;
  candidateAction: SwipeAction;
  briefId: string;
  title: string | null;
  content: BriefContent;
  budgetBand: Database['public']['Enums']['budget_band'] | null;
  timeline: Database['public']['Enums']['brief_timeline'] | null;
  solutionTypes: Database['public']['Enums']['solution_type'][];
  expiresAt: string;
}

/**
 * List a builder's incoming PENDING matches, joined to the brief summary they
 * need to decide on. Sorted by agent_confidence descending.
 *
 * Reads with the caller's session client (RLS "matches candidate builder read
 * own" + "briefs matched builder read" scope visibility). The nested join uses
 * the FK `matches_brief_id_fkey` (migration 0032).
 */
export async function listBuilderRequests(
  client: AnyClient,
  builderId: string,
): Promise<BuilderRequest[]> {
  const { data, error } = await client
    .from('matches')
    .select(
      '*, brief:briefs!matches_brief_id_fkey(id, title, content, budget_band, timeline, solution_types, expires_at, author_id)',
    )
    .eq('candidate_builder_id', builderId)
    .eq('candidate_type', 'BUILDER')
    .eq('candidate_action', 'PENDING')
    .order('agent_confidence', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as MatchWithBrief[];
  return rows.map((r) => ({
    id: r.id,
    agentConfidence: r.agent_confidence,
    agentRationale: r.agent_rationale,
    candidateAction: r.candidate_action,
    briefId: r.brief_id,
    title: r.brief?.title ?? null,
    content: (r.brief?.content ?? {}) as unknown as BriefContent,
    budgetBand: r.brief?.budget_band ?? null,
    timeline: r.brief?.timeline ?? null,
    solutionTypes: r.brief?.solution_types ?? [],
    expiresAt: r.brief?.expires_at ?? '',
  }));
}

/** Read a single match by id. Returns null if not found / not visible. */
export async function getMatch(client: AnyClient, id: string): Promise<MatchRow | null> {
  const { data, error } = await client.from('matches').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface UpdateMatchActionParams {
  /** Update the seeker's side. */
  seekerAction?: SwipeAction;
  /** Update the candidate (builder) side. */
  candidateAction?: SwipeAction;
  /** Set when a thread is created on CONNECT. */
  threadId?: string | null;
  /** Builder's SKIP feedback reason (§2.1). Recorded against the match. */
  candidateFeedback?: Database['public']['Enums']['match_feedback'] | null;
  /** Optional free-text note accompanying `candidateFeedback`. */
  candidateFeedbackNote?: string | null;
}

/**
 * Update a match's action fields (admin client — matches has no UPDATE RLS).
 * Stamps the corresponding `*_acted_at` timestamp when an action is set.
 */
export async function updateMatchAction(
  admin: AdminClient,
  id: string,
  params: UpdateMatchActionParams,
): Promise<MatchRow> {
  const now = new Date().toISOString();
  const patch: Database['public']['Tables']['matches']['Update'] = {};
  if (params.seekerAction !== undefined) {
    patch.seeker_action = params.seekerAction;
    patch.seeker_acted_at = now;
  }
  if (params.candidateAction !== undefined) {
    patch.candidate_action = params.candidateAction;
    patch.candidate_acted_at = now;
  }
  if (params.threadId !== undefined) {
    patch.thread_id = params.threadId;
  }
  if (params.candidateFeedback !== undefined) {
    patch.candidate_feedback = params.candidateFeedback;
  }
  if (params.candidateFeedbackNote !== undefined) {
    patch.candidate_feedback_note = params.candidateFeedbackNote;
  }

  const { data, error } = await admin.from('matches').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

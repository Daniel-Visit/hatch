import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hatch/shared';

/**
 * suggestion-repo — reads/writes over `public.validator_suggestions`
 * (Wanted feature, Task 3 / Validator output, §3.4).
 *
 * SELECT-only RLS (brief author reads). All writes go through the admin
 * (service-role) client, mirroring `turn-repo.ts`. Suggestions are persisted
 * even after dismissal (analytics signal — §1.2), so updates change `status`
 * + `resolved_at` rather than deleting rows.
 */

type AdminClient = SupabaseClient<Database>;
type AnyClient = SupabaseClient<Database>;

export type ValidatorSuggestionRow = Database['public']['Tables']['validator_suggestions']['Row'];

type SuggestionStatus = Database['public']['Enums']['suggestion_status'];

export interface InsertSuggestionParams {
  briefId: string;
  sectionPath: string;
  diagnosis: string;
  exampleBetter: string;
  modelUsed?: string | null;
}

/**
 * Insert a batch of validator suggestions (admin client). Empty input is a
 * no-op returning `[]`.
 */
export async function insertSuggestions(
  admin: AdminClient,
  suggestions: InsertSuggestionParams[],
): Promise<ValidatorSuggestionRow[]> {
  if (suggestions.length === 0) return [];

  const rows: Database['public']['Tables']['validator_suggestions']['Insert'][] = suggestions.map(
    (s) => ({
      brief_id: s.briefId,
      section_path: s.sectionPath,
      diagnosis: s.diagnosis,
      example_better: s.exampleBetter,
      model_used: s.modelUsed ?? null,
      // status defaults to 'PENDING' in the DB.
    }),
  );

  const { data, error } = await admin.from('validator_suggestions').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

/**
 * List suggestions for a brief, newest first. Reads may use a session client
 * (author RLS scopes visibility).
 */
export async function listSuggestions(
  client: AnyClient,
  briefId: string,
  status?: SuggestionStatus,
): Promise<ValidatorSuggestionRow[]> {
  let query = client
    .from('validator_suggestions')
    .select('*')
    .eq('brief_id', briefId)
    .order('created_at', { ascending: false });
  if (status !== undefined) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface UpdateSuggestionStatusParams {
  status: SuggestionStatus;
  /** The value the seeker applied (for APPLIED), retained for analytics. */
  appliedValue?: string | null;
}

/**
 * Update a suggestion's lifecycle status (admin client — no UPDATE RLS).
 * Stamps `resolved_at` for any terminal status (anything other than PENDING).
 */
export async function updateSuggestionStatus(
  admin: AdminClient,
  id: string,
  params: UpdateSuggestionStatusParams,
): Promise<ValidatorSuggestionRow> {
  const patch: Database['public']['Tables']['validator_suggestions']['Update'] = {
    status: params.status,
    resolved_at: params.status === 'PENDING' ? null : new Date().toISOString(),
  };
  if (params.appliedValue !== undefined) {
    patch.applied_value = params.appliedValue;
  }

  const { data, error } = await admin
    .from('validator_suggestions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

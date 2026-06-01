import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hatch/shared';
import { type BriefContent, type BriefEntryMode, ACTIVE_BRIEF_STATUSES } from '@hatch/shared';
import { isQuotaExceeded, BriefQuotaExceededError } from './invariants';

type Client = SupabaseClient<Database>;
type BriefRow = Database['public']['Tables']['briefs']['Row'];

/** Count the seeker's briefs currently in an active (quota-counting) status. */
export async function countActiveBriefs(client: Client, authorId: string): Promise<number> {
  const { count, error } = await client
    .from('briefs')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .in('status', ACTIVE_BRIEF_STATUSES as unknown as Database['public']['Enums']['brief_status'][]);
  if (error) throw error;
  return count ?? 0;
}

export interface CreateBriefInput {
  entryMode: BriefEntryMode;
  content?: BriefContent;
  /** Raw pasted text — required when entryMode === 'PASTE'. */
  parsedFrom?: string;
}

/**
 * Create a DRAFT brief (PARSING when entryMode === 'PASTE'). Enforces the active-brief
 * quota (§1.7) BEFORE inserting; throws BriefQuotaExceededError if the seeker is at the cap.
 */
export async function createBrief(
  client: Client,
  authorId: string,
  input: CreateBriefInput,
): Promise<BriefRow> {
  const activeCount = await countActiveBriefs(client, authorId);
  if (isQuotaExceeded(activeCount)) throw new BriefQuotaExceededError(activeCount);

  const status = (
    input.entryMode === 'PASTE' ? 'PARSING' : 'DRAFT'
  ) as Database['public']['Enums']['brief_status'];

  const { data, error } = await client
    .from('briefs')
    .insert({
      author_id: authorId,
      entry_mode: input.entryMode as Database['public']['Enums']['brief_entry_mode'],
      status,
      content: (input.content ?? {}) as Database['public']['Tables']['briefs']['Insert']['content'],
      parsed_from: input.parsedFrom ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Read a single brief by id (RLS scopes visibility to the caller). Returns null if not found. */
export async function getBrief(client: Client, id: string): Promise<BriefRow | null> {
  const { data, error } = await client
    .from('briefs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

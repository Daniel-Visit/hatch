import bcrypt from 'bcryptjs';
import { getSupabase } from './supabase.js';

const TOKEN_PREFIX_LEN = 12;
const BEARER_PREFIX = 'Bearer ';

/**
 * Resolve a Bearer token to a user_id by bcrypt-comparing against the api_keys table.
 * Returns null on any failure (missing header, malformed, no match, revoked).
 * Logging hygiene: NEVER log plain token or token_hash. Logging token_prefix is OK.
 */
export async function resolveUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) return null;
  const plain = authHeader.slice(BEARER_PREFIX.length).trim();
  if (!plain.startsWith('hatch_pat_') || plain.length < TOKEN_PREFIX_LEN + 4) return null;

  const prefix = plain.slice(0, TOKEN_PREFIX_LEN);
  const sb = getSupabase();

  const { data: rows, error } = await sb
    .from('api_keys')
    .select('id, user_id, token_hash')
    .eq('token_prefix', prefix)
    .is('revoked_at', null);

  if (error || !rows || rows.length === 0) return null;

  for (const row of rows) {
    const match = await bcrypt.compare(plain, row.token_hash);
    if (match) {
      // Await the last_used_at update — cheap and avoids tearing connections mid-request
      await sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);
      return row.user_id;
    }
  }
  return null;
}

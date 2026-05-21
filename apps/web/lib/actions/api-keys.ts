'use server';

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import {
  ApiKeyGenerate,
  type ApiKeyGenerateT,
  ApiKeyRevoke,
  type ApiKeyRevokeT,
} from '@/lib/zod/api-key';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const TOKEN_PREFIX_LEN = 12;
const BCRYPT_COST = 10;

export async function generateApiKey(
  input: ApiKeyGenerateT,
): Promise<Result<{ plainToken: string; label: string }>> {
  const parsed = ApiKeyGenerate.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();

  // Enforce one-active-per-user at the app layer too (the unique partial index
  // is the hard guard, but this gives a clean error before the DB rejects)
  const { data: existing } = await sb
    .from('api_keys')
    .select('id')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();

  if (existing) return { ok: false, error: 'active_key_exists' };

  // Generate token: hatch_pat_ + 32 bytes base64url (~43 chars)
  const plainToken = `hatch_pat_${randomBytes(32).toString('base64url')}`;
  const tokenPrefix = plainToken.slice(0, TOKEN_PREFIX_LEN);
  const tokenHash = await bcrypt.hash(plainToken, BCRYPT_COST);

  const { error } = await sb.from('api_keys').insert({
    user_id: user.id,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    label: parsed.data.label,
  });

  if (error) return { ok: false, error: 'db_error' };

  revalidatePath('/developers');
  return { ok: true, data: { plainToken, label: parsed.data.label } };
}

export async function revokeApiKey(input: ApiKeyRevokeT): Promise<Result<{ id: string }>> {
  const parsed = ApiKeyRevoke.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error || !data) return { ok: false, error: 'not_found' };

  revalidatePath('/developers');
  return { ok: true, data: { id: data.id } };
}

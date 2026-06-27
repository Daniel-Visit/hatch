'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import type { Database } from '@/lib/supabase/types';
import {
  RequestPreferencesInput,
  type RequestPreferencesInputType,
} from '@/lib/zod/request-preferences';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export async function updateRequestPreferences(
  input: RequestPreferencesInputType,
): Promise<ActionResult<{ id: string }>> {
  const parsed = RequestPreferencesInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const payload: ProfileUpdate = {
    accepts_requests: parsed.data.accepts_requests,
    request_capacity: parsed.data.request_capacity,
    request_domains: parsed.data.request_domains,
    request_rate_band: parsed.data.request_rate_band,
    inferred_capabilities: parsed.data.inferred_capabilities,
  };
  const { error } = await sb.from('profiles').update(payload).eq('id', user.id);

  if (error) {
    console.error('updateRequestPreferences db_error', {
      message: error.message,
      code: error.code,
    });
    return { ok: false, error: 'db_error' };
  }

  revalidatePath('/settings/requests');
  return { ok: true, data: { id: user.id } };
}

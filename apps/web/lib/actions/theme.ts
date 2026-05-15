'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { z } from 'zod';

const ThemePrefSchema = z.enum(['light', 'dark', 'system']);
type ThemePref = z.infer<typeof ThemePrefSchema>;

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function setThemePref(theme: ThemePref): Promise<ActionResult<{ theme: ThemePref }>> {
  const parsed = ThemePrefSchema.safeParse(theme);
  if (!parsed.success) return { ok: false, error: 'invalid_theme' };

  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    return { ok: false, error: 'unauthorized' };
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb.from('profiles').update({ theme_pref: parsed.data }).eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/');
  return { ok: true, data: { theme: parsed.data } };
}

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import { LocaleInput, type LocaleInputType } from '@/lib/zod/locale';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function setLocale(
  locale: string,
): Promise<ActionResult<{ locale: LocaleInputType }>> {
  const parsed = LocaleInput.safeParse(locale);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID_LOCALE' };
  }
  const valid = parsed.data;

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', valid, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  // Best-effort profile persistence — don't fail the action if DB is unhappy.
  try {
    const result = await getUser();
    if (result?.user) {
      const supabase = await createSupabaseServerClient();
      await supabase
        .from('profiles')
        .update({ locale_pref: valid } as never)
        .eq('id', result.user.id);
    }
  } catch {
    // swallow — cookie is already set, UX succeeds
  }

  revalidatePath('/', 'layout');
  return { ok: true, data: { locale: valid } };
}

import { createSupabaseServerClient } from './supabase/server';

export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (!profile) return null;
  return { user, profile };
}

export async function requireUser() {
  const result = await getUser();
  if (!result) throw new Error('UNAUTHORIZED');
  return result;
}

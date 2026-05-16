import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/settings/profile';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      // Seed NEXT_LOCALE cookie from profiles.locale_pref so the next request
      // renders in the user's preferred language without a flicker.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('locale_pref')
            .eq('id', user.id)
            .single();
          const pref = (profile as { locale_pref?: string | null } | null)?.locale_pref;
          if (pref === 'en' || pref === 'es') {
            response.cookies.set('NEXT_LOCALE', pref, {
              path: '/',
              maxAge: 60 * 60 * 24 * 365,
              sameSite: 'lax',
            });
          }
        }
      } catch {
        // Cookie seed is best-effort — never block sign-in on DB hiccup
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}

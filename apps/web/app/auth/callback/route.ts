import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// HATCH-003 fix: only accept same-origin, leading-slash, non-protocol-relative
// redirect targets. Anything else (`//evil.com`, `https://evil.com`,
// `/\\evil.com`, backslash-prefixed, etc.) falls back to /settings/profile.
function sanitizeNext(raw: string | null): string {
  const fallback = '/settings/profile';
  if (!raw) return fallback;
  // Must start with a single forward slash; reject //, /\, and any non-relative URL.
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNext(searchParams.get('next'));

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

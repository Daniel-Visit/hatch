import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './lib/supabase/types';

export async function middleware(request: NextRequest) {
  // Expose pathname to RSC via header so the root layout can branch on route
  // (e.g., skip the Shell on /sign-in to allow full-bleed layouts).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({ request: { headers: requestHeaders } });
            response.cookies.set(name, value, options as CookieOptions);
          });
        },
      },
    },
  );

  // CRITICAL: refresh session cookie. Do not remove this line.
  await supabase.auth.getUser();

  const protectedPrefixes = ['/publish', '/messages', '/settings'];
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isProtected) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const url = new URL('/sign-in', request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, ipFromRequest } from '@/lib/rate-limit';
import { ApiProfileDetail } from '@/lib/zod/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // HATCH-009: hint shared caches not to mix responses across origins.
  Vary: 'Origin',
};

function jsonResponse(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  // 1. Rate-limit
  const ip = ipFromRequest(req);
  const rl = await checkRateLimit(ip);
  if (!rl.ok) {
    return jsonResponse({ error: 'rate_limit_exceeded' }, 429, {
      'X-RateLimit-Reset': String(rl.resetAt),
      'Retry-After': '60',
    });
  }

  // 2. Validate path param
  const { handle } = await ctx.params;
  const parsed = ApiProfileDetail.safeParse({ handle });

  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_params', details: parsed.error.flatten().fieldErrors },
      400,
      {
        'X-RateLimit-Remaining': String(rl.remaining),
        'X-RateLimit-Reset': String(rl.resetAt),
      },
    );
  }

  // 3. Query Supabase — profile
  const sb = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id, handle, display_name, bio, avatar_url, hue, emoji, links, created_at')
    .eq('handle', parsed.data.handle)
    .single();

  if (profileError) {
    const status = profileError.code === 'PGRST116' ? 404 : 500;
    return jsonResponse({ error: status === 404 ? 'not_found' : 'db_error' }, status, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  if (!profile) {
    return jsonResponse({ error: 'not_found' }, 404, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  // 4. Query their published apps (no nested author)
  const { data: appsData, error: appsError } = await sb
    .from('apps')
    .select(
      'id, slug, title, tagline, description, link, category_id, cover_url, art_kind, accent, tags, built_with, published_at, likes_count, comments_count, saves_count, views_count, hot_score',
    )
    .eq('author_id', profile.id)
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  if (appsError) {
    return jsonResponse({ error: 'db_error' }, 500, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  const apps = (appsData ?? []).map((app) => ({
    ...app,
    built_with: app.built_with ?? [],
  }));

  return jsonResponse({ profile, apps }, 200, {
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.resetAt),
  });
}

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, ipFromRequest } from '@/lib/rate-limit';
import { ApiAppDetail } from '@/lib/zod/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
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
  const { slug } = await ctx.params;
  const parsed = ApiAppDetail.safeParse({ slug });

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

  // 3. Query Supabase
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from('apps')
    .select(
      'id, slug, title, tagline, description, link, category_id, cover_url, art_kind, accent, tags, published_at, likes_count, comments_count, saves_count, views_count, hot_score, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)',
    )
    .eq('slug', parsed.data.slug)
    .eq('is_published', true)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return jsonResponse({ error: status === 404 ? 'not_found' : 'db_error' }, status, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  if (!data) {
    return jsonResponse({ error: 'not_found' }, 404, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  // 4. Shape response
  const app = {
    id: data.id,
    slug: data.slug,
    title: data.title,
    tagline: data.tagline,
    description: data.description,
    link: data.link,
    category_id: data.category_id,
    cover_url: data.cover_url,
    art_kind: data.art_kind,
    accent: data.accent,
    tags: data.tags,
    published_at: data.published_at,
    likes_count: data.likes_count,
    comments_count: data.comments_count,
    saves_count: data.saves_count,
    views_count: data.views_count,
    hot_score: data.hot_score,
    author: Array.isArray(data.author) ? (data.author[0] ?? null) : (data.author ?? null),
  };

  return jsonResponse({ app }, 200, {
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.resetAt),
  });
}

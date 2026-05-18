import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, ipFromRequest } from '@/lib/rate-limit';
import { ApiAppsList } from '@/lib/zod/api';

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

export async function GET(req: Request) {
  // 1. Rate-limit
  const ip = ipFromRequest(req);
  const rl = await checkRateLimit(ip);
  if (!rl.ok) {
    return jsonResponse({ error: 'rate_limit_exceeded' }, 429, {
      'X-RateLimit-Reset': String(rl.resetAt),
      'Retry-After': '60',
    });
  }

  // 2. Validate query params
  const url = new URL(req.url);
  const parsed = ApiAppsList.safeParse({
    category: url.searchParams.get('category') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  });

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

  const { category, limit, cursor } = parsed.data;

  // 3. Query Supabase
  const sb = await createSupabaseServerClient();
  let query = sb
    .from('apps')
    .select(
      'id, slug, title, tagline, description, link, category_id, cover_url, art_kind, accent, tags, built_with, published_at, likes_count, comments_count, saves_count, views_count, hot_score, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)',
    )
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category_id', category);
  }

  if (cursor) {
    query = query.lt('published_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    return jsonResponse({ error: 'db_error' }, 500, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  const rows = data ?? [];

  // Normalize author (FK join may return array)
  const apps = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    link: row.link,
    category_id: row.category_id,
    cover_url: row.cover_url,
    art_kind: row.art_kind,
    accent: row.accent,
    tags: row.tags,
    built_with: row.built_with ?? [],
    published_at: row.published_at,
    likes_count: row.likes_count,
    comments_count: row.comments_count,
    saves_count: row.saves_count,
    views_count: row.views_count,
    hot_score: row.hot_score,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : (row.author ?? null),
  }));

  // 4. Keyset pagination cursor
  const next_cursor =
    apps.length === limit ? (apps[apps.length - 1]?.published_at ?? undefined) : undefined;

  return jsonResponse({ apps, next_cursor }, 200, {
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.resetAt),
  });
}

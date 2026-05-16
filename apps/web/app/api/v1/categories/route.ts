import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, ipFromRequest } from '@/lib/rate-limit';

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

  // 2. Query Supabase
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from('categories')
    .select('id, label, icon, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    return jsonResponse({ error: 'db_error' }, 500, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  // 3. Shape response
  return jsonResponse({ categories: data ?? [] }, 200, {
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.resetAt),
  });
}

import { NextResponse } from 'next/server';
import { checkRateLimit, ipFromRequest } from '@/lib/rate-limit';
import { ApiSearch } from '@/lib/zod/api';
import { searchApps } from '@/lib/actions/search';

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
  const parsed = ApiSearch.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
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

  const { q, limit } = parsed.data;

  // 3. Delegate to existing searchApps action (reuses textSearch logic)
  const result = await searchApps({ query: q, limit });

  if (!result.ok) {
    return jsonResponse({ error: result.error }, 500, {
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': String(rl.resetAt),
    });
  }

  return jsonResponse({ apps: result.data.apps, query: result.data.query }, 200, {
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.resetAt),
  });
}

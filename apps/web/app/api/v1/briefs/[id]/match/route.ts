import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { checkRateLimit } from '@/lib/rate-limit';
import { getBrief } from '@/lib/wanted/brief-repo';
import { triggerMatching } from '@/lib/wanted/matching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

const BodySchema = z.object({
  mode: z.enum(['apps', 'builders', 'both']).default('both'),
});

/**
 * POST /api/v1/briefs/:id/match — re-trigger matching for a brief (§2.1).
 *
 * Author-only. The seeker calls this after refining a brief to re-run the
 * matcher with a chosen scope (`apps` | `builders` | `both`). Rate-limited to
 * 5/hour/brief (§2.4) so a seeker can't spin the (LLM-backed) matcher in a loop.
 *
 * AuthZ is enforced via the session client + RLS: `getBrief` only returns the
 * brief if the caller is the author (or a matched builder, but only the author
 * can re-trigger — RLS author-read is the relevant grant here, and a matched
 * builder has no way to mutate matches through this path either way). The
 * matcher's writes happen under the admin client inside `runMatching`, AFTER
 * this authZ check passes.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to run matching.');
  }

  // 2. Feature gate — flag-off yields 404.
  try {
    assertWantedEnabled(
      { feature_flags: profile.feature_flags as Record<string, unknown> | null },
      process.env as { WANTED_V1_ENABLED?: string },
    );
  } catch (err) {
    if (err instanceof WantedDisabledError) {
      return problemResponse(
        'wanted_disabled',
        'Not found',
        404,
        'The Wanted feature is not enabled for this account.',
      );
    }
    throw err;
  }

  // 3. Rate-limit: 5/hour/brief (§2.4 — re-trigger after refinement).
  const rl = await checkRateLimit(`briefs:match:${id}`, { limit: 5, windowSeconds: 3600 });
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are re-running matching on this brief too often. Try again shortly.',
    );
  }

  // 4. Validate the request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problemResponse('invalid_body', 'Invalid request body', 400, 'Body must be valid JSON.');
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse(
      'invalid_body',
      'Invalid request body',
      400,
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  const { mode } = parsed.data;

  // 5. AuthZ: the brief must exist AND be visible to the caller. RLS scopes the
  //    session read to the author (matched builders can also read, but they are
  //    not the author — guard on author_id below to keep re-trigger author-only).
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, `No brief with id ${id}.`);
  }
  if (brief.author_id !== profile.id) {
    // Don't reveal existence to non-authors who can read via the matched-builder
    // policy — re-triggering is an author-only capability.
    return problemResponse('brief_not_found', 'Brief not found', 404, `No brief with id ${id}.`);
  }

  // 6. Run the matcher (admin writes happen inside, after this authZ).
  const { matchingJobId } = await triggerMatching(id, mode);

  return jsonResponse({ briefId: id, status: brief.status, matchingJobId, mode }, 200);
}

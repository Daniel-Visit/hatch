import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { checkRateLimit } from '@/lib/rate-limit';
import { getMatch, updateMatchAction } from '@/lib/wanted/match-repo';
import { pushToUser } from '@/lib/push/server';

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
  action: z.enum(['CONNECT', 'SKIP']),
});

/**
 * POST /api/v1/matches/:id/swipe — seeker swipes on a match (§2.1, §4.4.1/§4.4.2).
 *
 * The seeker is the brief author. This records the seeker side (`seeker_action`).
 *
 * State machine:
 *  - SKIP            → record `seeker_action = SKIP`. No thread.
 *  - CONNECT on APP  → app candidates auto-accept (`candidate_action = CONNECT`),
 *                      so the seeker's CONNECT is immediately MUTUAL → create the
 *                      thread between seeker and the app's builder (reuse the
 *                      `find_or_create_conversation` primitive) and notify the
 *                      builder via `pushToUser`.
 *  - CONNECT on BLDR → record `seeker_action = CONNECT`. Thread is deferred until
 *                      the builder also CONNECTs (handled by /respond).
 *
 * Reads use the session client (RLS author-read). The mutation goes through the
 * admin client (matches has SELECT-only RLS), AFTER authZ is proven here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Authenticate.
  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ user, profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to swipe on a match.');
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

  // 3. Rate-limit: 200/hour/user (§2.4).
  const rl = await checkRateLimit(`matches:swipe:${user.id}`, { limit: 200, windowSeconds: 3600 });
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are swiping too quickly. Try again shortly.',
    );
  }

  // 4. Validate body.
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
  const { action } = parsed.data;

  // 5. Read the match (session client — RLS author-read scopes visibility).
  const session = await createSupabaseServerClient();
  const match = await getMatch(session, id);
  if (!match) {
    return problemResponse('match_not_found', 'Match not found', 404, `No match with id ${id}.`);
  }

  // 6. AuthZ: only the brief author (seeker) may swipe. RLS already lets a matched
  //    builder read their own rows, so the read above is not proof of authorship —
  //    confirm the caller authored the parent brief.
  const { data: briefRow, error: briefErr } = await session
    .from('briefs')
    .select('id, author_id')
    .eq('id', match.brief_id)
    .maybeSingle();
  if (briefErr) throw briefErr;
  if (!briefRow || briefRow.author_id !== profile.id) {
    return problemResponse(
      'forbidden',
      'Forbidden',
      403,
      'Only the brief author can swipe on this match.',
    );
  }

  // 7. Mutate via admin (matches has no client UPDATE policy). AuthZ proven above.
  const admin = createSupabaseAdminClient();

  // Idempotent thread reuse: if a thread already exists, keep it.
  let threadId: string | null = match.thread_id;
  let threadCreated = false;

  // A seeker CONNECT on an APP match is immediately mutual (apps auto-accept).
  const isMutualAppConnect =
    action === 'CONNECT' && match.candidate_type === 'APP' && match.candidate_action === 'CONNECT';

  if (isMutualAppConnect && !threadId && match.candidate_app_id) {
    // Find the app's builder (author) to open the thread with.
    const { data: app, error: appErr } = await admin
      .from('apps')
      .select('id, author_id, title')
      .eq('id', match.candidate_app_id)
      .maybeSingle();
    if (appErr) throw appErr;

    if (app && app.author_id && app.author_id !== profile.id) {
      // Reuse the canonical thread primitive (SECURITY DEFINER RPC). The app id
      // is the conversation context for an app match.
      const { data: convId, error: rpcErr } = await admin.rpc('find_or_create_conversation', {
        user_a: profile.id,
        user_b: app.author_id,
        app: app.id,
      });
      if (rpcErr) throw rpcErr;
      if (convId) {
        threadId = convId as string;
        threadCreated = true;

        // Notify the builder via the existing Hatch notification primitive (§4.7).
        try {
          await pushToUser(app.author_id, {
            title: `${profile.display_name} connected on a brief`,
            body: `Someone wants to talk to you about "${app.title}".`,
            url: `/messages/${threadId}`,
            tag: `wanted-match:${match.id}`,
          });
        } catch {
          // Push fan-out is best-effort; failures must not fail the action.
        }
      }
    }
  }

  await updateMatchAction(admin, match.id, {
    seekerAction: action,
    threadId: threadCreated ? threadId : undefined,
  });

  return jsonResponse(
    {
      matchId: match.id,
      seekerAction: action,
      threadCreated,
      threadId,
    },
    200,
  );
}

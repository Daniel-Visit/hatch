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
  feedback: z.enum(['not_my_area', 'no_capacity', 'budget_mismatch', 'other']).optional(),
  feedbackNote: z.string().max(2000).optional(),
});

/**
 * POST /api/v1/matches/:id/respond — builder responds to a match (§2.1, §4.4.3).
 *
 * The responder is the candidate builder (`candidate_builder_id`). This only
 * applies to BUILDER matches — app candidates auto-accept and have no human
 * responder.
 *
 * State machine:
 *  - SKIP    → record `candidate_action = SKIP`. Optional feedback is recorded
 *              against the builder's implicit profile (silently; see NOTE). No
 *              thread, no PII surfaced to the seeker (§2.1).
 *  - CONNECT → record `candidate_action = CONNECT`. If the seeker already
 *              CONNECTed (`seeker_action = CONNECT`) it is now MUTUAL → create
 *              the thread between seeker (brief author) and this builder (reuse
 *              `find_or_create_conversation`) and notify BOTH sides via
 *              `pushToUser` (§3.2.2 step 5, §4.7). If the seeker has not yet
 *              connected, the builder's acceptance waits for the seeker's swipe.
 *
 * Reads use the session client (RLS candidate-builder-read). The mutation goes
 * through the admin client (matches has SELECT-only RLS), AFTER authZ here.
 *
 * NOTE: §2.1 specifies that SKIP feedback "updates the builder's implicit
 * profile (silently)". Migration 0036 added `matches.candidate_feedback` +
 * `candidate_feedback_note`, so the reason + note are now persisted on the match
 * (the seed for the builder's implicit-profile signal). Feedback is only recorded
 * on SKIP; CONNECT leaves those columns untouched.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Authenticate.
  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ user, profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to respond to a match.');
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
  const rl = await checkRateLimit(`matches:respond:${user.id}`, {
    limit: 200,
    windowSeconds: 3600,
  });
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are responding too quickly. Try again shortly.',
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
  const { action, feedback, feedbackNote } = parsed.data;

  // 5. Read the match (session client — RLS candidate-builder-read scopes it).
  const session = await createSupabaseServerClient();
  const match = await getMatch(session, id);
  if (!match) {
    return problemResponse('match_not_found', 'Match not found', 404, `No match with id ${id}.`);
  }

  // 6. AuthZ: only the candidate builder may respond, and only on BUILDER matches.
  if (match.candidate_type !== 'BUILDER' || match.candidate_builder_id !== profile.id) {
    return problemResponse(
      'forbidden',
      'Forbidden',
      403,
      'Only the matched builder can respond to this match.',
    );
  }

  // 7. Mutate via admin (matches has no client UPDATE policy). AuthZ proven above.
  const admin = createSupabaseAdminClient();

  let threadId: string | null = match.thread_id;
  let threadCreated = false;

  // Mutual when the builder CONNECTs AND the seeker already CONNECTed.
  const isMutualConnect = action === 'CONNECT' && match.seeker_action === 'CONNECT';

  if (isMutualConnect && !threadId) {
    // The seeker is the brief author. Look them up to open the thread.
    const { data: brief, error: briefErr } = await admin
      .from('briefs')
      .select('id, author_id, title')
      .eq('id', match.brief_id)
      .maybeSingle();
    if (briefErr) throw briefErr;

    if (brief && brief.author_id && brief.author_id !== profile.id) {
      // Builder matches are not about a specific app. The generated type declares
      // `app: string` (non-optional) because the schema codegen doesn't distinguish
      // nullable params; the underlying PL/pgSQL function and `conversations.app_id`
      // both accept NULL. We omit `app` and widen the args object to the expected
      // RPC arg shape so the Supabase client sends `app` as absent/undefined,
      // which Postgres receives as NULL — a single `as` assertion, not a double cast.
      const { data: convId, error: rpcErr } = await admin.rpc('find_or_create_conversation', {
        user_a: brief.author_id,
        user_b: profile.id,
      } as { app: string; user_a: string; user_b: string });
      if (rpcErr) throw rpcErr;
      if (convId) {
        threadId = convId as string;
        threadCreated = true;

        // Notify BOTH sides via the existing Hatch notification primitive (§4.7).
        const briefLabel = brief.title ?? 'your brief';
        try {
          await pushToUser(brief.author_id, {
            title: `${profile.display_name} connected with you`,
            body: `You're now connected on "${briefLabel}".`,
            url: `/messages/${threadId}`,
            tag: `wanted-match:${match.id}`,
          });
        } catch {
          // best-effort
        }
        try {
          await pushToUser(profile.id, {
            title: 'You connected on a brief',
            body: `You're now connected on "${briefLabel}".`,
            url: `/messages/${threadId}`,
            tag: `wanted-match:${match.id}`,
          });
        } catch {
          // best-effort
        }
      }
    }
  }

  await updateMatchAction(admin, match.id, {
    candidateAction: action,
    threadId: threadCreated ? threadId : undefined,
    // Record SKIP feedback (§2.1, migration 0036). CONNECT leaves it untouched.
    candidateFeedback: action === 'SKIP' ? (feedback ?? null) : undefined,
    candidateFeedbackNote: action === 'SKIP' ? (feedbackNote ?? null) : undefined,
  });

  return jsonResponse(
    {
      matchId: match.id,
      // Mirror the /swipe response shape (§2.1: "same shape as /swipe").
      seekerAction: match.seeker_action,
      candidateAction: action,
      threadCreated,
      threadId,
    },
    200,
  );
}

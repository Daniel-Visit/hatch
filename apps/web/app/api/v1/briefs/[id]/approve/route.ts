import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { getBrief } from '@/lib/wanted/brief-repo';
import { transition } from '@/lib/wanted/brief-state';
import { triggerMatching } from '@/lib/wanted/matching';
import { chatRequiresUserTurn } from '@/lib/wanted/invariants';
import { computeCompletenessScore, type BriefContent } from '@hatch/shared';

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

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Require authenticated user
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    const result = await requireUser();
    profile = result.profile;
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to approve a brief.');
  }

  // 2. Assert Wanted feature is enabled for this user / environment
  // profile.feature_flags is typed as Json (string | number | boolean | null | object),
  // but assertWantedEnabled expects Record<string, unknown> | null. Narrow it safely.
  const featureFlags =
    profile.feature_flags !== null &&
    typeof profile.feature_flags === 'object' &&
    !Array.isArray(profile.feature_flags)
      ? (profile.feature_flags as Record<string, unknown>)
      : null;
  try {
    assertWantedEnabled(
      { feature_flags: featureFlags },
      process.env as { WANTED_V1_ENABLED?: string },
    );
  } catch (e) {
    if (e instanceof WantedDisabledError) {
      return problemResponse('wanted_disabled', 'Not found', 404, 'Feature unavailable.');
    }
    throw e;
  }

  // 3. Fetch the brief (RLS scopes to the authenticated user's own briefs)
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse(
      'brief_not_found',
      'Brief not found',
      404,
      'No brief with that ID was found.',
    );
  }

  // 4. Completeness gate: must be at least 0.5 to proceed to matching
  const score = computeCompletenessScore((brief.content ?? {}) as BriefContent);
  if (score < 0.5) {
    return problemResponse(
      'brief_incomplete',
      'Brief incomplete',
      400,
      'Fill in more details before publishing (completeness must be at least 0.5).',
    );
  }

  // 5. CHAT user-turn invariant: a chat brief needs at least one USER message
  const { count } = await session
    .from('brief_refinement_turns')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', id)
    .eq('role', 'USER');
  const userTurnCount = count ?? 0;

  if (!chatRequiresUserTurn(brief.entry_mode, userTurnCount)) {
    return problemResponse(
      'chat_requires_user_turn',
      'No conversation',
      400,
      'A chat brief needs at least one message before approval.',
    );
  }

  // 6. Transition brief status to MATCHING
  try {
    await transition(session, brief, 'approve');
  } catch {
    return problemResponse(
      'invalid_state',
      'Cannot approve',
      409,
      'This brief is not in an approvable state.',
    );
  }

  // 7. Trigger matching (stub — no-op until Phase 2)
  const { matchingJobId } = await triggerMatching(id);

  // 8. Return 200 with the new status and matching job ID
  return jsonResponse({ briefId: id, status: 'MATCHING', matchingJobId }, 200);
}

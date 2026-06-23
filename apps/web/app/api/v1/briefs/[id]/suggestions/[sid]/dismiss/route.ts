import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { getBrief } from '@/lib/wanted/brief-repo';
import { listSuggestions, updateSuggestionStatus } from '@/lib/wanted/suggestion-repo';

/**
 * `POST /api/v1/briefs/:id/suggestions/:sid/dismiss` — Wanted feature, Task 4
 * (api-15). §2.1.
 *
 * Dismiss a Validator suggestion without applying it. No body. The row is
 * retained (status → DISMISSED) for offline calibration of the Validator prompt
 * (§3.4.8). Reads use the session client (author RLS); the status update uses
 * the admin client (no UPDATE RLS) AFTER the author-only brief read.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  Vary: 'Origin',
};

function jsonResponse(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, ...extraHeaders } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { id, sid } = await params;

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to dismiss a suggestion.');
  }

  // 2. Feature gate. `feature_flags` is the broad Supabase `Json`
  //    (string | number | boolean | null | object); narrow it safely before passing
  //    to assertWantedEnabled which expects Record<string, unknown> | null.
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

  // 3. Rate-limit: 50/hour/brief.
  const rl = await checkRateLimit(`briefs:suggestions:dismiss:${id}`, {
    limit: 50,
    windowSeconds: 3600,
  });
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are dismissing suggestions too quickly. Try again shortly.',
    );
  }

  // 4. Load the brief (RLS → author-only) — authZ gate before the admin write.
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, 'No such brief.');
  }

  // 5. Load the suggestion + verify it belongs to THIS brief.
  const suggestions = await listSuggestions(session, id);
  const suggestion = suggestions.find((s) => s.id === sid);
  if (!suggestion) {
    return problemResponse(
      'suggestion_not_found',
      'Suggestion not found',
      404,
      'No such suggestion for this brief.',
    );
  }

  // 6. Only PENDING suggestions can be dismissed (idempotent guard).
  if (suggestion.status !== 'PENDING') {
    return problemResponse(
      'suggestion_not_pending',
      'Suggestion already resolved',
      409,
      `This suggestion is already ${suggestion.status.toLowerCase()}.`,
    );
  }

  // 7. Mark DISMISSED (admin client — no UPDATE RLS).
  const admin = createSupabaseAdminClient();
  await updateSuggestionStatus(admin, sid, { status: 'DISMISSED' });

  // 8. Return the dismissed result (§2.1).
  return jsonResponse({ suggestionId: sid, status: 'DISMISSED' }, 200);
}

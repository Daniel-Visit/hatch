import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { checkRateLimit } from '@/lib/rate-limit';
import { getBrief } from '@/lib/wanted/brief-repo';
import { setContentPath, BRIEF_CONTENT_PATHS } from '@/lib/wanted/brief-state';
import { type BriefContent, computeCompletenessScore } from '@hatch/shared';
import type { Database } from '@hatch/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
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

const PatchBodySchema = z.object({
  path: z.string(),
  value: z.unknown(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Require authenticated user
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    const result = await requireUser();
    profile = result.profile;
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to update a brief');
  }

  // 2. Assert Wanted feature is enabled for this user / environment.
  // profile.feature_flags is typed as Json — narrow to Record<string, unknown> | null.
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
      return problemResponse('wanted_disabled', 'Not found', 404, 'Feature unavailable');
    }
    throw e;
  }

  // 3. Rate-limit: 200 actions per hour per brief
  const rl = await checkRateLimit(`briefs:content:${id}`);
  if (!rl.ok) {
    return problemResponse(
      'too_many_requests',
      'Too many requests',
      429,
      'You have made too many updates to this brief recently. Please wait before trying again.',
    );
  }

  // 4. Parse + validate JSON body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return problemResponse(
      'invalid_body',
      'Invalid request body',
      400,
      'Request body must be valid JSON',
    );
  }

  const parsed = PatchBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemResponse(
      'invalid_body',
      'Invalid request body',
      400,
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }

  const { path, value } = parsed.data;

  // 5. Fetch the brief (RLS ensures author-only access)
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, `No brief with id ${id}`);
  }

  // 6. Validate path against whitelist
  if (!BRIEF_CONTENT_PATHS.includes(path)) {
    return problemResponse(
      'invalid_path',
      'Invalid path',
      400,
      `'${path}' is not a valid content path`,
    );
  }

  // 7. Apply the single-field update immutably
  let newContent: BriefContent;
  try {
    newContent = setContentPath((brief.content ?? {}) as BriefContent, path, value);
  } catch {
    return problemResponse(
      'invalid_path',
      'Invalid path',
      400,
      `'${path}' is not a valid content path`,
    );
  }

  // 8. Compute derived fields: manually_edited_fields union + completeness score
  const existingEdited: string[] = Array.isArray(brief.manually_edited_fields)
    ? (brief.manually_edited_fields as string[])
    : [];
  const manuallyEditedFields: string[] = Array.from(new Set([...existingEdited, path]));
  const completenessScore = computeCompletenessScore(newContent);

  // 9. Persist to DB
  const { error } = await session
    .from('briefs')
    .update({
      content: newContent as Database['public']['Tables']['briefs']['Update']['content'],
      manually_edited_fields: manuallyEditedFields,
      completeness_score: completenessScore,
    })
    .eq('id', id);

  if (error) {
    throw error;
  }

  // 10. Return success
  return jsonResponse({ briefId: id, manuallyEditedFields, completenessScore }, 200);
}

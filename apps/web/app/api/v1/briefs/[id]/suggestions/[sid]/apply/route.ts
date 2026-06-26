import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeCompletenessScore, type BriefContent } from '@hatch/shared';
import type { Database } from '@hatch/shared';

import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { embedBriefBestEffort } from '@/lib/wanted/embeddings/embed';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { getBrief } from '@/lib/wanted/brief-repo';
import { setContentPath, BRIEF_CONTENT_PATHS } from '@/lib/wanted/brief-state';
import { listSuggestions, updateSuggestionStatus } from '@/lib/wanted/suggestion-repo';
import { createFtsRetriever } from '@/lib/wanted/matching/retriever';
import { computeMatchPotential } from '@/lib/wanted/matching/heuristic';

/**
 * `POST /api/v1/briefs/:id/suggestions/:sid/apply` — Wanted feature, Task 4
 * (api-15). §2.1 + §3.4.9.
 *
 * Apply a single Validator suggestion: patch `Brief.content` at the
 * suggestion's `sectionPath` with the seeker's `customValue` (if supplied) or
 * the suggestion's `exampleBetter` verbatim; mark the suggestion `APPLIED`
 * (retaining `applied_value` for analytics); re-run the cheap, no-LLM match
 * potential heuristic (§3.4.9) and return the updated estimate.
 *
 * Reads use the session client (RLS author scoping); the suggestion status
 * update uses the admin client (no UPDATE RLS). Author-only access is enforced
 * by the session-scoped brief read before any admin write.
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

const BodySchema = z.object({ customValue: z.string().optional() });

/** Section paths whose value is an array of strings (§3.1.4). */
const ARRAY_PATHS = new Set<string>([
  'desiredOutcome.mustHaves',
  'desiredOutcome.niceToHaves',
  'desiredOutcome.outOfScope',
  'context.existingStack',
  'preferredSolutionType',
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { id, sid } = await params;

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to apply a suggestion.');
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
  const rl = await checkRateLimit(`briefs:suggestions:apply:${id}`, {
    limit: 50,
    windowSeconds: 3600,
  });
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are applying suggestions too quickly. Try again shortly.',
    );
  }

  // 4. Parse body (customValue optional).
  let rawBody: unknown = {};
  try {
    const text = await req.text();
    rawBody = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return problemResponse('invalid_body', 'Invalid request body', 400, 'Body must be valid JSON.');
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemResponse(
      'invalid_body',
      'Invalid request body',
      400,
      'customValue must be a string when present.',
    );
  }
  const { customValue } = parsed.data;

  // 5. Load the brief (RLS → author-only). This is the authZ gate before any
  //    admin write to the suggestion.
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, 'No such brief.');
  }

  // 6. Load the suggestion (session client → author RLS) and verify it belongs
  //    to THIS brief.
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

  // 7. Only PENDING suggestions can be applied.
  if (suggestion.status !== 'PENDING') {
    return problemResponse(
      'suggestion_not_pending',
      'Suggestion already resolved',
      409,
      `This suggestion is already ${suggestion.status.toLowerCase()}.`,
    );
  }

  // 8. Validate the suggestion's section path against the content whitelist.
  if (!BRIEF_CONTENT_PATHS.includes(suggestion.section_path)) {
    return problemResponse(
      'invalid_path',
      'Invalid path',
      400,
      `'${suggestion.section_path}' is not a valid content path.`,
    );
  }

  // 9. Resolve the value to apply: seeker's customValue (if any) else the
  //    suggestion's exampleBetter. Array-valued sections wrap the string.
  const appliedValue = customValue !== undefined ? customValue : suggestion.example_better;
  const value = ARRAY_PATHS.has(suggestion.section_path) ? [appliedValue] : appliedValue;

  // 10. Patch the brief content immutably + recompute completeness.
  let newContent: BriefContent;
  try {
    newContent = setContentPath(
      (brief.content ?? {}) as BriefContent,
      suggestion.section_path,
      value,
    );
  } catch {
    return problemResponse(
      'invalid_path',
      'Invalid path',
      400,
      `'${suggestion.section_path}' is not a valid content path.`,
    );
  }
  const newCompletenessScore = computeCompletenessScore(newContent);

  // 11. Append the patched section to manually_edited_fields (the seeker
  //     accepted/edited this field — the Refiner must respect it going forward).
  const existingEdited: string[] = Array.isArray(brief.manually_edited_fields)
    ? (brief.manually_edited_fields as string[])
    : [];
  const manuallyEditedFields = Array.from(new Set([...existingEdited, suggestion.section_path]));

  const { error: updateErr } = await session
    .from('briefs')
    .update({
      content: newContent as Database['public']['Tables']['briefs']['Update']['content'],
      completeness_score: newCompletenessScore,
      manually_edited_fields: manuallyEditedFields,
    })
    .eq('id', id);
  if (updateErr) throw updateErr;

  // 12. Mark the suggestion APPLIED (admin client — no UPDATE RLS).
  const admin = createSupabaseAdminClient();

  // Synchronous best-effort embedding of the updated content (spec E2). Awaited
  // so it reliably completes on serverless. The try/catch swallows every failure
  // so it can never change the response, status code, or rate-limit behavior.
  try {
    const vec = await embedBriefBestEffort({
      title: newContent.title,
      trigger: newContent.problem?.trigger,
      affected: newContent.problem?.affected,
      costOfNotSolving: newContent.problem?.costOfNotSolving,
      definitionOfGoodEnough: newContent.desiredOutcome?.definitionOfGoodEnough,
      mustHaves: newContent.desiredOutcome?.mustHaves,
    });
    if (vec !== null) {
      await admin
        .from('briefs')
        .update({ embedding: '[' + vec.join(',') + ']' })
        .eq('id', id);
    }
  } catch (err) {
    console.warn('[wanted/embed] suggestions/apply route: brief embedding update failed', err);
  }
  await updateSuggestionStatus(admin, sid, { status: 'APPLIED', appliedValue });

  // 13. Re-run the match-potential heuristic (§3.4.9; cheap, NO LLM). `current`
  //     is the new content; `withSuggestions` applies the REMAINING pending
  //     suggestions (this one is now applied/folded into content).
  const now = Date.now();
  const retriever = createFtsRetriever(admin);
  const currentPotential = await computeMatchPotential(newContent, retriever, { now });

  let hypothetical = newContent;
  for (const s of suggestions) {
    if (s.id === sid) continue; // just applied
    if (s.status !== 'PENDING') continue;
    if (!BRIEF_CONTENT_PATHS.includes(s.section_path)) continue;
    const v = ARRAY_PATHS.has(s.section_path) ? [s.example_better] : s.example_better;
    try {
      hypothetical = setContentPath(hypothetical, s.section_path, v);
    } catch {
      // ignore non-whitelisted paths
    }
  }
  const withPotential = await computeMatchPotential(hypothetical, retriever, { now });

  const current = currentPotential.appCandidateCount + currentPotential.builderCandidateCount;
  const withSuggestions = withPotential.appCandidateCount + withPotential.builderCandidateCount;

  // 14. Return the applied result + updated estimate (§2.1).
  return jsonResponse(
    {
      suggestionId: sid,
      status: 'APPLIED',
      appliedValue,
      newCompletenessScore,
      newMatchPotentialEstimate: { current, withSuggestions },
    },
    200,
  );
}

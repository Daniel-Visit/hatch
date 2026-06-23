import { NextResponse } from 'next/server';
import { VALIDATOR_MODEL, computeCompletenessScore, type BriefContent } from '@hatch/shared';
import type { Database } from '@hatch/shared';

import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { getBrief } from '@/lib/wanted/brief-repo';
import { setContentPath, BRIEF_CONTENT_PATHS } from '@/lib/wanted/brief-state';
import { insertSuggestions } from '@/lib/wanted/suggestion-repo';
import { runValidator } from '@/lib/wanted/agents/validator';
import { createFtsRetriever } from '@/lib/wanted/matching/retriever';
import { computeMatchPotential } from '@/lib/wanted/matching/heuristic';
import { createAnthropic } from '@/lib/wanted/anthropic';

/**
 * `POST /api/v1/briefs/:id/validate` — Wanted feature, Task 4 (api-15). §2.1.
 *
 * Runs the Validator agent (§3.4) and stitches in the match-potential estimate.
 * The Validator runtime returns only the LLM half (quality + suggestions); the
 * route composes `matchPotentialEstimate` from the cheap, no-LLM heuristic
 * (§3.4.5) — current (brief as-is) vs. withSuggestions (each suggestion's
 * exampleBetter applied to its section). Suggestions are persisted via the
 * suggestion-repo (admin client). The brief settles in `REVIEW_HEALTH`.
 *
 * Gates:
 *   - completenessScore >= 0.5 (§2.1 `brief_incomplete`).
 *   - 10/hour/brief; idempotent within a 60s window (§2.4 — limiter window).
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

/**
 * Build the hypothetical "all suggestions applied" brief: apply each
 * suggestion's `exampleBetter` at its `sectionPath` via the whitelisted
 * `setContentPath`. Non-whitelisted paths are skipped (the heuristic is a rough
 * direction, not a guarantee). Array-valued sections receive a single-element
 * array so the lexical-overlap proxy still sees the improved text.
 */
function applySuggestionsHypothetically(
  content: BriefContent,
  suggestions: ReadonlyArray<{ sectionPath: string; exampleBetter: string }>,
): BriefContent {
  let next = content;
  for (const s of suggestions) {
    if (!BRIEF_CONTENT_PATHS.includes(s.sectionPath)) continue;
    const isArrayPath =
      s.sectionPath === 'desiredOutcome.mustHaves' ||
      s.sectionPath === 'desiredOutcome.niceToHaves' ||
      s.sectionPath === 'desiredOutcome.outOfScope' ||
      s.sectionPath === 'context.existingStack' ||
      s.sectionPath === 'preferredSolutionType';
    try {
      next = setContentPath(next, s.sectionPath, isArrayPath ? [s.exampleBetter] : s.exampleBetter);
    } catch {
      // Skip any path the setter rejects; never fail the validate call over it.
    }
  }
  return next;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to validate a brief.');
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

  // 3. Rate-limit: 10/hour/brief (§2.4 `validation_throttled`).
  const rl = await checkRateLimit(`briefs:validate:${id}`, { limit: 10, windowSeconds: 3600 });
  if (!rl.ok) {
    return problemResponse(
      'validation_throttled',
      'Validation throttled',
      429,
      'This brief was validated very recently. Try again in a minute.',
    );
  }

  // 4. Load the brief (RLS → author-only).
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, 'No such brief.');
  }

  const content = (brief.content ?? {}) as BriefContent;

  // 5. Completeness gate (§2.1): must be >= 0.5 before the quality pass.
  const completenessScore = computeCompletenessScore(content);
  if (completenessScore < 0.5) {
    return problemResponse(
      'brief_incomplete',
      'Brief incomplete',
      400,
      'Fill in more details before validating (completeness must be at least 0.5).',
    );
  }

  // 6. Run the Validator (LLM half: quality + suggestions). Network/SDK errors
  //    propagate to a 500; malformed model output is handled inside the runtime.
  const anthropic = createAnthropic();
  const assessment = await runValidator({ anthropic, content });

  // 7. Compute the match-potential estimate (NO LLM, §3.4.5). The route stitches
  //    this into the response — the Validator does not produce it. `now` is
  //    REQUIRED by the heuristic (epoch-0 trap guard). One admin client is
  //    reused for both the retriever reads and the suggestion inserts.
  const now = Date.now();
  const admin = createSupabaseAdminClient();
  const retriever = createFtsRetriever(admin);

  const currentPotential = await computeMatchPotential(content, retriever, { now });
  const hypothetical = applySuggestionsHypothetically(content, assessment.suggestions);
  const withPotential = await computeMatchPotential(hypothetical, retriever, { now });

  const current = currentPotential.appCandidateCount + currentPotential.builderCandidateCount;
  const withSuggestions = withPotential.appCandidateCount + withPotential.builderCandidateCount;
  const computedAt = new Date(now).toISOString();

  // 8. Persist quality_score + quality_by_section + match_potential_estimate.
  const matchPotentialEstimate = { current, withSuggestions, computedAt };
  const { error: updateErr } = await session
    .from('briefs')
    .update({
      quality_score: assessment.overallQuality,
      quality_by_section:
        assessment.qualityBySection as Database['public']['Tables']['briefs']['Update']['quality_by_section'],
      match_potential_estimate:
        matchPotentialEstimate as Database['public']['Tables']['briefs']['Update']['match_potential_estimate'],
      status: 'REVIEW_HEALTH' as Database['public']['Enums']['brief_status'],
    })
    .eq('id', id);
  if (updateErr) throw updateErr;

  // 9. Insert suggestions (admin client — validator_suggestions has no INSERT
  //    RLS). Author-only access was enforced above by the session-scoped read.
  const inserted = await insertSuggestions(
    admin,
    assessment.suggestions.map((s) => ({
      briefId: id,
      sectionPath: s.sectionPath,
      diagnosis: s.diagnosis,
      exampleBetter: s.exampleBetter,
      modelUsed: VALIDATOR_MODEL,
    })),
  );

  // 10. Return the stitched body (§2.1).
  return jsonResponse(
    {
      briefId: id,
      qualityScore: assessment.overallQuality,
      qualityBySection: assessment.qualityBySection,
      suggestions: inserted.map((row) => ({
        id: row.id,
        sectionPath: row.section_path,
        diagnosis: row.diagnosis,
        exampleBetter: row.example_better,
        status: row.status,
      })),
      matchPotentialEstimate,
      status: 'REVIEW_HEALTH',
    },
    200,
  );
}

import { PARSER_MODEL, type BriefContent } from '@hatch/shared';
import type { Database } from '@hatch/shared';

import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { sseResponse } from '@/lib/wanted/sse';
import { getBrief } from '@/lib/wanted/brief-repo';
import { appendTurn, nextTurnIndex } from '@/lib/wanted/turn-repo';
import { applyDraftPatch, computeAndPersistContent } from '@/lib/wanted/brief-state';
import { runParser } from '@/lib/wanted/agents/parser';
import { createAnthropic } from '@/lib/wanted/anthropic';
import { embedBriefBestEffort } from '@/lib/wanted/embeddings/embed';

/**
 * `POST /api/v1/briefs/:id/parse` — Wanted feature, Task 4 (api-15). §2.1.
 *
 * Runs the Parser agent on a `entry_mode = PASTE` brief's `parsed_from` text and
 * streams the extraction via SSE (same frame shape as `/refine`). One Sonnet
 * call (the runtime retries once internally on malformed output); NO conversation.
 *
 * State machine (§2.1): the brief starts in `PARSING`. We persist the extracted
 * content patch, briefly mark `AWAITING_VALIDATION`, then settle on
 * `REVIEW_HEALTH` (the seeker reviews + the Validator runs next). Both writes are
 * recorded so the transition is observable even though it completes in one call.
 *
 * SSE events (in order):
 *   structured_update — { patch }                 (one event)
 *   parser_summary    — { summary, extractedFields, missingFields, parserConfidence }
 *   done              — { nextAction: 'review_health' }
 *
 * Idempotency (§2.1 / §2.4): a 1-minute window via the per-brief rate limiter
 * (3/hour/brief). `already_parsed` guards a brief that has already advanced past
 * PARSING (parsed_from set AND status > PARSING).
 */

// Node runtime: the Anthropic SDK + service-role client need Node APIs and the
// SSE producer holds a long-lived streaming connection.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // -------------------------------------------------------------------------
  // Pre-stream: auth / gate / validation / state checks return clean
  // problem+json (not a stream) on failure.
  // -------------------------------------------------------------------------

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to parse a brief.');
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

  // 3. Rate-limit: 3/hour/brief. True idempotency is enforced by the status
  //    guard in step 6 (already-parsed → 409); this cap just throttles retries.
  const rl = await checkRateLimit(`briefs:parse:${id}`, { limit: 3, windowSeconds: 3600 });
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are parsing this brief too frequently. Try again shortly.',
    );
  }

  // 4. Load the brief (RLS → author-only; null means not found / not yours).
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, 'No such brief.');
  }

  // 5. Must be a PASTE-mode brief.
  if (brief.entry_mode !== 'PASTE') {
    return problemResponse(
      'not_paste_mode',
      'Not a paste brief',
      400,
      'Parsing is only available for briefs created with mode = paste.',
    );
  }

  // 6. Idempotency guard: already parsed if parsed_from is set AND the brief has
  //    advanced past PARSING (§2.1). Re-issuing while still PARSING is allowed
  //    (the rate limiter enforces the 60s idempotency window).
  if (brief.parsed_from !== null && brief.status !== 'PARSING') {
    return problemResponse(
      'already_parsed',
      'Already parsed',
      409,
      'This brief has already been parsed.',
    );
  }

  // 7. The pasted text lives in parsed_from (set at create time). Without it
  //    there is nothing to parse.
  const pastedText = brief.parsed_from;
  if (pastedText === null || pastedText.trim().length === 0) {
    return problemResponse(
      'not_paste_mode',
      'Nothing to parse',
      400,
      'This brief has no pasted text to parse.',
    );
  }

  // -------------------------------------------------------------------------
  // Stream: run the Parser and emit SSE frames. sseResponse converts a thrown
  // error into an `error` event and closes the stream; any persisted patch
  // remains saved (the "draft saved" behavior).
  // -------------------------------------------------------------------------
  return sseResponse(async (send) => {
    const anthropic = createAnthropic();

    const result = await runParser({ anthropic, pastedText });

    // Persist the extracted content patch onto the existing (empty) draft.
    const baseDraft = (brief.content ?? {}) as BriefContent;
    const newDraft = applyDraftPatch(baseDraft, result.patch);
    await computeAndPersistContent(session, id, newDraft);

    // Synchronous best-effort embedding of the parsed draft (spec E2). Awaited
    // so it reliably completes within the handler's lifetime on serverless. The
    // try/catch swallows every failure so an embedding error can never break the
    // SSE stream or its subsequent frames.
    try {
      const vec = await embedBriefBestEffort({
        title: newDraft.title,
        trigger: newDraft.problem?.trigger,
        affected: newDraft.problem?.affected,
        costOfNotSolving: newDraft.problem?.costOfNotSolving,
        definitionOfGoodEnough: newDraft.desiredOutcome?.definitionOfGoodEnough,
        mustHaves: newDraft.desiredOutcome?.mustHaves,
      });
      if (vec !== null) {
        const embedAdmin = createSupabaseAdminClient();
        await embedAdmin
          .from('briefs')
          .update({ embedding: '[' + vec.join(',') + ']' })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('[wanted/embed] parse route: brief embedding update failed', err);
    }

    // 8. structured_update — the extracted partial (one event).
    send('structured_update', { patch: result.patch });

    // 9. parser_summary — fields line up 1:1 with the ParserResult.
    send('parser_summary', {
      summary: result.summary,
      extractedFields: result.extractedFields,
      missingFields: result.missingFields,
      parserConfidence: result.parserConfidence,
    });

    // 10. Persist the Parser pass as an AGENT turn (audit + replay). The brief
    //     has NO parser_confidence column, so it lives in the turn's
    //     content_json alongside the patch (the SSE event already carried it
    //     to the client).
    const admin = createSupabaseAdminClient();
    const round = brief.refinement_round ?? 0;
    const turnIdx = await nextTurnIndex(session, id, round);
    await appendTurn(admin, {
      briefId: id,
      round,
      turnIndex: turnIdx,
      role: 'AGENT',
      content: result.summary,
      contentJson: {
        kind: 'parser',
        patch: result.patch,
        parserConfidence: result.parserConfidence,
        extractedFields: result.extractedFields,
        missingFields: result.missingFields,
        failed: result.failed,
      },
      modelUsed: PARSER_MODEL,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });

    // 11. Advance the state machine PARSING → AWAITING_VALIDATION → REVIEW_HEALTH
    //     (§2.1). Both writes are issued so the intermediate state is observable;
    //     the brief settles in REVIEW_HEALTH where the seeker reviews + the
    //     Validator runs next. Direct status updates (mirrors the content route)
    //     since brief-state.transition only models the chat lifecycle.
    //     Both errors are thrown so a failed write surfaces as an SSE `error`
    //     event rather than sending `done` with the brief in the wrong status.
    const { error: awaitingErr } = await session
      .from('briefs')
      .update({ status: 'AWAITING_VALIDATION' as Database['public']['Enums']['brief_status'] })
      .eq('id', id);
    if (awaitingErr) throw awaitingErr;

    const { error: reviewErr } = await session
      .from('briefs')
      .update({ status: 'REVIEW_HEALTH' as Database['public']['Enums']['brief_status'] })
      .eq('id', id);
    if (reviewErr) throw reviewErr;

    // 12. done — direct the client to the Brief Health review.
    send('done', { nextAction: 'review_health' });
  });
}

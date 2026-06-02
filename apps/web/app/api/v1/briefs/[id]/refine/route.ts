import { z } from 'zod';
import {
  REFINER_MAX_TURNS,
  MARK_READY_COMPLETENESS_FLOOR,
  REFINER_MODEL,
  computeCompletenessScore,
  type BriefContent,
} from '@hatch/shared';

import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { sseResponse } from '@/lib/wanted/sse';
import { getBrief } from '@/lib/wanted/brief-repo';
import { appendTurn, countTurns, nextTurnIndex, listTurns } from '@/lib/wanted/turn-repo';
import { applyDraftPatch, computeAndPersistContent, transition } from '@/lib/wanted/brief-state';
import { runRefinerTurn, type RefinerHistoryTurn } from '@/lib/wanted/agents/refiner';
import { createAnthropic } from '@/lib/wanted/anthropic';

// Node runtime: the Anthropic SDK + service-role Supabase client require Node APIs,
// and the SSE producer holds a long-lived streaming connection.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  userMessage: z.string().min(1),
  round: z.number().int().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // -------------------------------------------------------------------------
  // Pre-stream: all auth / validation / state checks run BEFORE we open the
  // SSE stream so failures return a clean problem+json response (not a stream).
  // -------------------------------------------------------------------------

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to refine a brief.');
  }

  // 2. Feature gate. The profile's `feature_flags` is typed as the broad Supabase
  //    `Json`; the gate wants the object/null shape it is at runtime — narrow here.
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

  // 3. Rate-limit: 60/hour/brief (one refine turn can take many seconds, so a
  //    per-brief hourly cap is the right granularity, not a per-IP burst cap).
  const rl = await checkRateLimit(`briefs:refine:${id}`);
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are refining this brief too quickly. Try again shortly.',
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
      'A non-empty `userMessage` string is required.',
    );
  }
  const { userMessage } = parsed.data;

  // 5. Load the brief (RLS scopes to the author → null means not found / not yours).
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, 'No such brief.');
  }

  // 6. 12-turn cap.
  const turnCount = await countTurns(session, id);
  if (turnCount >= REFINER_MAX_TURNS) {
    return problemResponse(
      'refine_turn_cap_exceeded',
      'Turn cap reached',
      409,
      'This brief reached the 12-turn refinement limit.',
    );
  }

  // 7. First refine moves the brief DRAFT → REFINING (idempotent thereafter).
  if (brief.status === 'DRAFT') {
    await transition(session, brief, 'first_refine');
  }

  // 8. Refinement round (a single conversation lives within one round).
  const round = brief.refinement_round ?? 0;

  // 9. Persist the USER turn (admin client — brief_refinement_turns has no INSERT RLS).
  //    Build the agent history from turns that existed BEFORE this message so the
  //    new userMessage is passed to the refiner separately (not duplicated).
  const admin = createSupabaseAdminClient();
  const priorTurns = await listTurns(session, id, round);
  const history: RefinerHistoryTurn[] = priorTurns
    .filter((row) => row.role === 'USER' || row.role === 'AGENT')
    .map((row) => ({
      role: row.role === 'AGENT' ? 'AGENT' : 'USER',
      content: row.content,
    }));

  const userIdx = await nextTurnIndex(session, id, round);
  await appendTurn(admin, {
    briefId: id,
    round,
    turnIndex: userIdx,
    role: 'USER',
    content: userMessage,
  });

  // -------------------------------------------------------------------------
  // Stream: run the refiner turn and emit SSE frames. The sseResponse wrapper
  // converts any thrown error into an `error` event and closes the stream. The
  // USER turn + any persisted patches above remain saved (the "draft saved"
  // behavior) even if the model call fails.
  // -------------------------------------------------------------------------
  return sseResponse(async (send) => {
    const anthropic = createAnthropic();

    let draft = (brief.content ?? {}) as BriefContent;
    let lastCompleteness = computeCompletenessScore(draft);

    let agentText = '';
    let tokensIn = 0;
    let tokensOut = 0;
    let toolCall: unknown = null;
    let markedReady = false;

    for await (const ev of runRefinerTurn({ anthropic, history, draft, userMessage })) {
      switch (ev.type) {
        case 'token': {
          agentText += ev.delta;
          send('token', { delta: ev.delta });
          break;
        }
        case 'structured_update': {
          draft = applyDraftPatch(draft, ev.patch);
          const { completenessScore } = await computeAndPersistContent(session, id, draft);
          lastCompleteness = completenessScore;
          send('structured_update', { patch: ev.patch });
          send('completeness_score', { score: completenessScore });
          break;
        }
        case 'mark_ready': {
          // Defer until after the loop — the final completeness gates whether
          // the agent's request to stop is honored.
          markedReady = true;
          break;
        }
        case 'agent_message_done': {
          agentText = ev.text || agentText;
          tokensIn = ev.tokensIn;
          tokensOut = ev.tokensOut;
          toolCall = ev.toolCall;
          break;
        }
      }
    }

    // Persist the AGENT turn.
    const agentIdx = await nextTurnIndex(session, id, round);
    await appendTurn(admin, {
      briefId: id,
      round,
      turnIndex: agentIdx,
      role: 'AGENT',
      content: agentText,
      contentJson: toolCall,
      modelUsed: REFINER_MODEL,
      tokensIn,
      tokensOut,
    });

    // The agent may only stop the conversation once the brief is complete
    // enough. Below the floor, the server overrides the agent and keeps refining.
    const shouldStop = markedReady && lastCompleteness >= MARK_READY_COMPLETENESS_FLOOR;
    send('done', {
      shouldStop,
      completeness: lastCompleteness,
      nextAction: shouldStop ? 'review_brief' : 'continue',
    });
  });
}

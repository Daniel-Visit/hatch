import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UI_TOOLS } from '@hatch/shared';

import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { getBrief } from '@/lib/wanted/brief-repo';
import { appendTurn, listTurns, nextTurnIndex } from '@/lib/wanted/turn-repo';
import {
  readUiCall,
  readUiResponse,
  validateAgainstSchema,
  synthesizeUserMessage,
  type UiResponseEnvelope,
} from './helpers';

/**
 * `POST /api/v1/briefs/:id/turns/:turnId/ui-response` — Wanted feature, Task 4
 * (api-15). §2.1.1.
 *
 * Submit the output of a UI component invocation. Pairs with the `ui_call` SSE
 * event emitted on a previous Refiner turn. This endpoint does NOT stream — it
 * synthesizes a natural-language user message from the structured `output`,
 * records it as a new USER turn (carrying the structured payload in turn
 * metadata, §3.1.5.2), and returns the id of the agent's response turn that the
 * frontend then opens a fresh `/refine` SSE for (§2.1.1 sequence). The agent
 * resumes with that synthesized message as the next turn's content.
 *
 * Validation (§2.1.1):
 *   - the `turnId` turn must carry a `ui_call` envelope in
 *     `ui_component_invocation` → else `turn_not_pending_ui_response`.
 *   - that ui_call must not already have a recorded response → else
 *     `ui_call_already_resolved`.
 *   - `component` must match the ui_call's component → else `component_mismatch`.
 *   - `output` must validate against the component's `output_schema` (from
 *     UI_TOOLS) → else `output_schema_invalid`.
 *   - hard cap of 3 ui-responses per refinement session (round) — §2.4.
 *
 * Reads use the session client (author RLS); the new turn is written with the
 * admin client (brief_refinement_turns has no INSERT RLS) AFTER the author-only
 * brief read.
 *
 * Storage note: the agent's ORIGINAL ui_call lives on the triggering turn's
 * `ui_component_invocation` column (emitted by the Refiner). The synthesized
 * USER response turn this route writes carries its ui_response envelope in
 * `content_json` — the only metadata column the shared `appendTurn` writes — so
 * resolution + per-session counting read `content_json`, while the ui_call is
 * read from `ui_component_invocation`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hard cap on UI invocations per refinement session (§2.4 / §3.1.5.1). */
const MAX_UI_INVOCATIONS_PER_SESSION = 3;

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

const BodySchema = z.object({
  component: z.string().min(1),
  output: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; turnId: string }> },
) {
  const { id, turnId } = await params;

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to submit a UI response.');
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

  // 3. Rate-limit: 100/hour/brief (the per-session cap below is the hard limit).
  const rl = await checkRateLimit(`briefs:ui-response:${id}`, { limit: 100, windowSeconds: 3600 });
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      'You are submitting UI responses too quickly. Try again shortly.',
    );
  }

  // 4. Validate body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return problemResponse('invalid_body', 'Invalid request body', 400, 'Body must be valid JSON.');
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemResponse(
      'invalid_body',
      'Invalid request body',
      400,
      'A `component` string and an `output` object are required.',
    );
  }
  const { component, output } = parsed.data;

  // 5. Load the brief (RLS → author-only).
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) {
    return problemResponse('brief_not_found', 'Brief not found', 404, 'No such brief.');
  }

  // 6. Load the brief's turns and locate the ui_call turn by id.
  const turns = await listTurns(session, id);
  const callTurn = turns.find((t) => t.id === turnId);
  if (!callTurn) {
    return problemResponse('turn_not_found', 'Turn not found', 404, 'No such turn for this brief.');
  }

  const uiCall = readUiCall(callTurn.ui_component_invocation);
  if (uiCall === null) {
    return problemResponse(
      'turn_not_pending_ui_response',
      'Turn not pending a UI response',
      400,
      'This turn did not emit a UI component invocation.',
    );
  }

  // 7. Already resolved? A USER turn (in content_json) linking back to this
  //    turn means resolved.
  const alreadyResolved = turns.some((t) => {
    const r = readUiResponse(t.content_json);
    return r !== null && r.inResponseToTurnId === turnId;
  });
  if (alreadyResolved) {
    return problemResponse(
      'ui_call_already_resolved',
      'UI call already resolved',
      409,
      'A response for this UI invocation was already recorded.',
    );
  }

  // 8. Component must match the original ui_call.
  if (uiCall.component !== component) {
    return problemResponse(
      'component_mismatch',
      'Component mismatch',
      400,
      `Expected component '${uiCall.component}', got '${component}'.`,
    );
  }

  // 9. Validate `output` against the component's output_schema (from UI_TOOLS).
  const tool = UI_TOOLS.find((t) => t.name === component);
  if (!tool) {
    return problemResponse(
      'component_mismatch',
      'Unknown component',
      400,
      `'${component}' is not a known UI component.`,
    );
  }
  if (!validateAgainstSchema(tool.output_schema, output)) {
    return problemResponse(
      'output_schema_invalid',
      'Output schema invalid',
      400,
      `The output does not conform to the ${component} component's output schema.`,
    );
  }

  // 10. Per-session (round) hard cap of 3 UI invocations resolved (§2.4).
  const round = callTurn.round;
  const resolvedThisSession = turns.filter((t) => {
    if (t.round !== round) return false;
    return readUiResponse(t.content_json) !== null;
  }).length;
  if (resolvedThisSession >= MAX_UI_INVOCATIONS_PER_SESSION) {
    return problemResponse(
      'ui_invocation_cap_exceeded',
      'UI invocation cap reached',
      409,
      `This session reached the ${MAX_UI_INVOCATIONS_PER_SESSION}-UI-response limit.`,
    );
  }

  // 11. Synthesize the user message + record the new USER turn (admin client —
  //     no INSERT RLS). The structured output is preserved in turn metadata so
  //     the agent patches the draft from it rather than the synthesized prose
  //     (§3.1.5.2).
  const synthesizedUserMessage = synthesizeUserMessage(component, output, {
    props: uiCall.props,
    locale: profile.locale_pref,
  });
  const responseEnvelope: UiResponseEnvelope = {
    kind: 'ui_response',
    inResponseToTurnId: turnId,
    component,
    output,
  };

  const admin = createSupabaseAdminClient();
  const userIdx = await nextTurnIndex(session, id, round);
  const newTurn = await appendTurn(admin, {
    briefId: id,
    round,
    turnIndex: userIdx,
    role: 'USER',
    content: synthesizedUserMessage,
    contentJson: responseEnvelope,
  });

  // The new turn's id is the correlation key for the agent's response turn the
  // frontend will open a fresh `/refine` SSE for (§2.1.1 sequence).
  const uiInvocationsUsed = resolvedThisSession + 1;

  return jsonResponse(
    {
      turnId: newTurn.id,
      synthesizedUserMessage,
      uiInvocationsUsed,
      status: 'agent_resuming',
    },
    200,
  );
}

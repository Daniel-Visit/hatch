import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { createBrief } from '@/lib/wanted/brief-repo';
import { BriefQuotaExceededError } from '@/lib/wanted/invariants';
import { appendTurn } from '@/lib/wanted/turn-repo';
import { BriefContentSchema, PARSE_MAX_CHARS } from '@hatch/shared';

/**
 * Minimum pasted-text length for `mode: paste` (§2.1 / §3.3.6). Shorter than
 * this and the Parser is skipped — the seeker is redirected to Chat mode.
 * (`PARSE_MAX_CHARS` is exported from shared; there is no shared min constant.)
 */
const PASTE_MIN_CHARS = 80;

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

const PostBodySchema = z.object({
  mode: z.enum(['chat', 'form', 'paste']),
  seed: z.string().max(2000).optional(),
  pastedText: z.string().optional(),
  source: z.enum(['web', 'mcp', 'agent']).optional(),
});

export async function POST(req: Request) {
  // 1. Require authenticated user
  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    const result = await requireUser();
    user = result.user;
    profile = result.profile;
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to create a brief');
  }

  // 2. Assert Wanted feature is enabled for this user / environment
  // profile.feature_flags is typed as Json (string | number | boolean | null | object),
  // but assertWantedEnabled expects Record<string, unknown> | null. We narrow it safely.
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

  // 3. Rate-limit: 10 create actions per hour per user (keyed by userId, not IP)
  const userKey = `briefs:create:${user.id}`;
  const rl = await checkRateLimit(userKey, { limit: 10, windowSeconds: 3600 });
  if (!rl.ok) {
    return problemResponse(
      'too_many_drafts',
      'Too many drafts',
      429,
      'You have created too many briefs recently. Please wait before creating another.',
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

  const parsed = PostBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return problemResponse(
      'invalid_body',
      'Invalid request body',
      400,
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }

  const { mode, seed, pastedText } = parsed.data;

  // 5. Mode-dependent field validation (§2.1). Each mode constrains which
  //    optional fields may be present so downstream agents get a clean input.
  if (mode === 'chat') {
    // chat: `seed` optional, `pastedText` must be absent.
    if (pastedText !== undefined) {
      return problemResponse(
        'mode_field_mismatch',
        'Field mismatch',
        400,
        'pastedText is not valid for chat mode.',
      );
    }
  } else if (mode === 'form') {
    // form: both `seed` and `pastedText` must be absent.
    if (seed !== undefined || pastedText !== undefined) {
      return problemResponse(
        'mode_field_mismatch',
        'Field mismatch',
        400,
        'seed and pastedText are not valid for form mode.',
      );
    }
  } else {
    // paste: `pastedText` required (80–4000 chars), `seed` must be absent.
    if (seed !== undefined) {
      return problemResponse(
        'mode_field_mismatch',
        'Field mismatch',
        400,
        'seed is not valid for paste mode.',
      );
    }
    if (pastedText === undefined) {
      return problemResponse(
        'mode_field_mismatch',
        'Field mismatch',
        400,
        'pastedText is required for paste mode.',
      );
    }
    const len = pastedText.length;
    if (len < PASTE_MIN_CHARS) {
      return problemResponse(
        'paste_too_short',
        'Paste too short',
        400,
        `Pasted text must be at least ${PASTE_MIN_CHARS} characters. Try Chat mode for short prompts.`,
      );
    }
    if (len > PARSE_MAX_CHARS) {
      return problemResponse(
        'paste_too_long',
        'Paste too long',
        400,
        `Pasted text must be at most ${PARSE_MAX_CHARS} characters. Trim it to the essentials.`,
      );
    }
  }

  // 6. Create the brief (RLS session client, scoped to the authenticated user).
  //    - chat → CHAT / DRAFT
  //    - form → FORM / DRAFT
  //    - paste → PASTE / PARSING (carries parsed_from; awaits the Parser pass)
  const session = await createSupabaseServerClient();
  let brief: Awaited<ReturnType<typeof createBrief>>;
  try {
    if (mode === 'paste') {
      brief = await createBrief(session, user.id, {
        entryMode: 'PASTE',
        content: BriefContentSchema.parse({}),
        parsedFrom: pastedText,
      });
    } else {
      brief = await createBrief(session, user.id, {
        entryMode: mode === 'form' ? 'FORM' : 'CHAT',
        content: BriefContentSchema.parse({}),
      });
    }
  } catch (e) {
    if (e instanceof BriefQuotaExceededError) {
      return problemResponse(
        'brief_quota_exceeded',
        'Brief quota exceeded',
        409,
        'You have 3 active briefs. Resolve or expire one to create a new brief.',
      );
    }
    throw e;
  }

  // 7. If a chat seed message was provided, append it as the first USER turn.
  if (mode === 'chat' && seed !== undefined && seed.trim().length > 0) {
    const admin = createSupabaseAdminClient();
    await appendTurn(admin, {
      briefId: brief.id,
      round: 0,
      turnIndex: 0,
      role: 'USER',
      content: seed,
    });
  }

  // 8. Return 201 with the created brief details + the mode's next action.
  if (mode === 'paste') {
    return jsonResponse({ briefId: brief.id, status: 'PARSING', nextAction: 'await_parse' }, 201);
  }
  if (mode === 'form') {
    return jsonResponse({ briefId: brief.id, status: 'DRAFT', nextAction: 'fill_form' }, 201);
  }
  return jsonResponse({ briefId: brief.id, status: 'DRAFT', nextAction: 'start_refinement' }, 201);
}

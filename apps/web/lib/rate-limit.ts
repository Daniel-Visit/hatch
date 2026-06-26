import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_S = 60;

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number };

export interface RateLimitOptions {
  /** Max requests allowed within the window before the caller is blocked. Default 60. */
  limit?: number;
  /** Bucket size in seconds. Default 60. */
  windowSeconds?: number;
}

/**
 * Check whether `key` has exceeded its rate limit within the current window.
 * Backed by a Postgres counter table (api_rate_limits) and the atomic
 * `increment_rate_limit_window` RPC (migration 0035), which computes the bucket
 * server-side and reports `limited` + `reset_at` for the given window/limit.
 *
 * Each route passes its own §2.4 limit (e.g. 10/hour create, 5/hour match,
 * 3/hour parse). Omitting `opts` keeps the historical 60-req/60-sec behaviour.
 *
 * HATCH-010 fix: fail CLOSED on RPC errors. Previously this returned
 * `{ ok: true }` on DB hiccups, which lets a misbehaving DB amplify any
 * abuse into a request flood with no rate limiting. Returning a 503-style
 * blocked result is the safe default for an abuse-control path.
 */
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_S;

  // Fallback reset boundary for the fail-closed path (RPC unavailable).
  const now = Math.floor(Date.now() / 1000);
  const fallbackResetAt = (Math.floor(now / windowSeconds) * windowSeconds + windowSeconds) * 1000;

  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.rpc('increment_rate_limit_window', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  // The RPC returns a single-row set: [{ count, limited, reset_at }].
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    // Fail CLOSED — never trust an unverifiable rate-limit counter.
    return { ok: false, remaining: 0, resetAt: fallbackResetAt };
  }

  const resetAt = new Date(row.reset_at).getTime();
  if (row.limited) {
    return { ok: false, remaining: 0, resetAt };
  }
  return { ok: true, remaining: Math.max(0, limit - row.count), resetAt };
}

/**
 * Extract the caller's IP from request headers.
 *
 * HATCH-010 fix: prefer `x-vercel-forwarded-for` (set by Vercel's edge and
 * not user-spoofable from the public internet) over `x-forwarded-for`
 * (which can be appended by attackers behind the edge). Falls back to XFF
 * for non-Vercel deploys and finally `x-real-ip`.
 */
export function ipFromRequest(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) {
    const first = vercel.split(',')[0].trim();
    if (first) return first;
  }
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

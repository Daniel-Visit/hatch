import { createSupabaseServerClient } from '@/lib/supabase/server';

const LIMIT = 60;
const WINDOW_S = 60;

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number };

/**
 * Check whether `ip` has exceeded the 60-req/60-sec rate limit.
 * Backed by a Postgres counter table (api_rate_limits) and an atomic RPC.
 *
 * HATCH-010 fix: fail CLOSED on RPC errors. Previously this returned
 * `{ ok: true }` on DB hiccups, which lets a misbehaving DB amplify any
 * abuse into a request flood with no rate limiting. Returning a 503-style
 * blocked result is the safe default for an abuse-control path.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / WINDOW_S) * WINDOW_S;
  const bucketStart = new Date(bucket * 1000).toISOString();
  const resetAt = (bucket + WINDOW_S) * 1000;

  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.rpc('increment_rate_limit', {
    p_ip: ip,
    p_bucket_start: bucketStart,
  });

  if (error || typeof data !== 'number') {
    // Fail CLOSED — never trust an unverifiable rate-limit counter.
    return { ok: false, remaining: 0, resetAt };
  }

  if (data > LIMIT) {
    return { ok: false, remaining: 0, resetAt };
  }
  return { ok: true, remaining: LIMIT - data, resetAt };
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

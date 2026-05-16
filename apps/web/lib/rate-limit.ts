import { createSupabaseServerClient } from '@/lib/supabase/server';

const LIMIT = 60;
const WINDOW_S = 60;

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number };

/**
 * Check whether `ip` has exceeded the 60-req/60-sec rate limit.
 * Backed by a Postgres counter table (api_rate_limits) and an atomic RPC.
 * Fails OPEN on DB errors — legit users should never be locked out by a transient DB hiccup.
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
    // Fail open
    return { ok: true, remaining: LIMIT, resetAt };
  }

  if (data > LIMIT) {
    return { ok: false, remaining: 0, resetAt };
  }
  return { ok: true, remaining: LIMIT - data, resetAt };
}

/**
 * Extract the caller's IP from request headers. Vercel sets `x-forwarded-for`
 * with the originating IP as the first comma-separated value.
 */
export function ipFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

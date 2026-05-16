// apps/web/lib/push/server.ts
// Server-only — uses VAPID_PRIVATE_KEY. NEVER import from a client component.
// The no_vapid_private_in_client.py validator enforces this.

import webpush from 'web-push';
import { createSupabaseAdminClient } from '@/lib/supabase/admin'; // service-role for unconditional read+delete

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    throw new Error(
      'VAPID keys not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY',
    );
  }
  webpush.setVapidDetails('mailto:hello@hatch.dev', pub, priv);
  vapidConfigured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    configureVapid();
  } catch {
    // If VAPID isn't configured (e.g., local dev without keys), no-op silently.
    return;
  }

  const sb = createSupabaseAdminClient(); // service role — bypasses RLS on push_subscriptions
  const { data: subs, error } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error || !subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        // 410 Gone → unsubscribe stale endpoint
        if (
          err instanceof Error &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 410
        ) {
          await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
        // Other errors (404, 5xx) → swallow; caller wraps in try/catch anyway. Future: add structured logging.
      }
    }),
  );
}

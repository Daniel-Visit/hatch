// apps/web/lib/push/vapid-key.ts
// Browser-safe — only the PUBLIC key. The private key lives in server.ts.

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function hasVapidConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

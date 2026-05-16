'use client';

// apps/web/lib/push/client.ts
// Browser-only. Handles permission request + service worker registration +
// pushManager.subscribe + posts subscription to server action.

// TODO: @/lib/actions/push is implemented in Task 15. If typecheck fails
// because that file doesn't exist yet, that's an expected dependency.
import { subscribeToPush, unsubscribeFromPush } from '@/lib/actions/push';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) out[i] = rawData.charCodeAt(i);
  return out;
}

export async function subscribeToBrowserPush(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no_window' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no_sw' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no_push' };

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pub) return { ok: false, reason: 'no_vapid_key' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast needed: TypeScript lib.dom types expect ArrayBuffer, not ArrayBufferLike
      applicationServerKey: urlBase64ToUint8Array(pub).buffer as ArrayBuffer,
    });
  }

  const json = subscription.toJSON();
  const result = await subscribeToPush({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    userAgent: navigator.userAgent,
  });

  if (!result.ok) return { ok: false, reason: 'server_error' };
  return { ok: true };
}

export async function unsubscribeFromBrowserPush(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no_window' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no_sw' };

  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!registration) return { ok: false, reason: 'no_registration' };

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: true }; // already unsubscribed

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await unsubscribeFromPush({ endpoint });
  return { ok: true };
}

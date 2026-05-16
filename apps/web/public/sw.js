// apps/web/public/sw.js — Hatch Web Push service worker
// Handles: push event (showNotification), notificationclick (focus/open tab),
//          pushsubscriptionchange (v1: log warning — refresh deferred to Phase 13).
/* global self */
/* eslint-disable no-console, no-undef */

self.addEventListener('install', (event) => {
  // Activate immediately on first install
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of all clients ASAP
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Hatch', body: event.data.text() };
  }

  const title = payload.title || 'Hatch';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png', // fallback to default if not present (Phase 13 polish)
    badge: '/badge-72.png', // fallback to default
    tag: payload.tag, // collapse multiple notifs with same tag
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab matching the target URL if found
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    }),
  );
});

self.addEventListener('pushsubscriptionchange', (_event) => {
  // v1: log warning — automatic re-subscription deferred to Phase 13.
  // To re-subscribe, the user must toggle the master switch in /settings/notifications.
  console.warn(
    '[sw.js] push subscription expired or changed — user must re-toggle /settings/notifications',
  );
});

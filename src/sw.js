import { precacheAndRoute } from 'workbox-precaching';

// vite-plugin-pwa injects the list of build assets to precache here at build
// time. Switching from the default "generateSW" strategy to "injectManifest"
// (this custom source file) is what lets us add our own push-notification
// handling below — generateSW's fully auto-generated service worker has no
// hook for that.
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fires when a push message arrives from our /api/send-push serverless
// function (via the browser's push service) — even if the app/tab is
// completely closed. Free, no FCM billing tier required: this is the
// standards-based Web Push API built into every modern browser.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Fintly AI Agent';
  const options = {
    body: data.body || '',
    icon: '/logo.svg',
    badge: '/logo.svg',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open Fintly tab if one exists,
// otherwise opens a new one — landing on whatever URL the push payload named
// (e.g. the relevant Settings section or the chat itself).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

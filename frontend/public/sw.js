// Service Worker for HumanPages push notifications — v1
// Bump the version comment above when changing this file

// Activate immediately on update (don't wait for all tabs to close)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Push event — show notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const options = {
      body: payload.body || 'You have a new notification.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/' },
    };

    event.waitUntil(
      self.registration.showNotification(payload.title || 'HumanPages', options)
    );
  } catch {
    // Malformed payload — show generic notification
    event.waitUntil(
      self.registration.showNotification('HumanPages', {
        body: 'You have a new notification.',
        data: { url: '/' },
      })
    );
  }
});

// Notification click — open or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  // Open redirect protection: only open same-origin URLs
  try {
    const url = new URL(targetUrl, self.location.origin);
    if (url.origin !== self.location.origin) {
      // Reject cross-origin URLs — fall back to dashboard
      event.waitUntil(clients.openWindow('/'));
      return;
    }

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Focus an existing tab if possible
        for (const client of windowClients) {
          if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
            client.navigate(url.pathname + url.search);
            return client.focus();
          }
        }
        // No existing tab — open a new one
        return clients.openWindow(url.pathname + url.search);
      })
    );
  } catch {
    event.waitUntil(clients.openWindow('/'));
  }
});

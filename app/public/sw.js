// Service Worker de SaleListo: Web Push nativo en segundo plano para Modo Pulsera (Xiaomi Smart Band).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data = { title: 'SaleListo', body: event.data.text() };
    }
  }

  const title = data.title || data.shortTitle || 'SaleListo';
  const body = data.body || data.shortBody || 'Nuevo aviso en tu sector';
  const tag = data.tag || ('salelisto-' + (data.id || Date.now()));
  const targetUrl = data.url || '/mozo.html';

  const options = {
    body,
    icon: '/mark.svg',
    badge: '/mark.svg',
    vibrate: [220, 90, 220, 90, 320],
    renotify: true,
    requireInteraction: false,
    tag,
    timestamp: data.ts || Date.now(),
    data: {
      url: targetUrl,
      waiterId: data.waiterId || '',
      tableId: data.tableId || '',
      kind: data.kind || '',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetRel = (event.notification.data && event.notification.data.url) || '/mozo.html';
  const targetUrl = new URL(targetRel, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          const u = new URL(client.url);
          if (u.origin === self.location.origin && u.pathname.endsWith('/mozo.html')) {
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});

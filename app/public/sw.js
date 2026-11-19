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
  const waiterId = data.waiterId || '';
  const targetUrl = data.url || (waiterId ? `/mozo.html?waiter=${encodeURIComponent(waiterId)}` : '/mozo.html');

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [220, 90, 220, 90, 320],
    renotify: true,
    requireInteraction: false,
    tag,
    timestamp: data.ts || Date.now(),
    data: {
      url: targetUrl,
      waiterId,
      tableId: data.tableId || '',
      kind: data.kind || '',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const waiterId = notifData.waiterId || '';
  let targetRel = notifData.url || '/mozo.html';
  if (waiterId && targetRel.indexOf('waiter=') === -1) {
    const sep = targetRel.indexOf('?') === -1 ? '?' : '&';
    targetRel = `${targetRel}${sep}waiter=${encodeURIComponent(waiterId)}`;
  }
  const desired = new URL(targetRel, self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        try {
          const u = new URL(client.url);
          if (u.origin === self.location.origin && u.pathname.endsWith('/mozo.html')) {
            const wantWaiter = desired.searchParams.get('waiter') || '';
            const curWaiter = u.searchParams.get('waiter') || '';
            if (wantWaiter && curWaiter !== wantWaiter && typeof client.navigate === 'function') {
              await client.navigate(desired.href);
            }
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(desired.href);
      }
      return null;
    })
  );
});

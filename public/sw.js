importScripts('/quarter.js');

const CACHE = 'goroadhub-shell-10';
const SHELL = ['/index.html', '/app.js', '/areas.js', '/quarter.js', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/oversight/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE);
        await cache.put('/index.html', fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request);
      if (fresh.ok && SHELL.includes(url.pathname)) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw err;
    }
  })());
});

function readPlan() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('goroadhub', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('alerts')) req.result.createObjectStore('alerts');
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('alerts', 'readonly').objectStore('alerts').get('plan');
      get.onsuccess = () => { db.close(); resolve(get.result || null); };
      get.onerror = () => reject(get.error);
    };
  });
}

function writePlan(plan) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('goroadhub', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('alerts')) req.result.createObjectStore('alerts');
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('alerts', 'readwrite');
      tx.objectStore('alerts').put(plan, 'plan');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function maybeNotify() {
  const plan = await readPlan();
  const item = reminderNow(new Date(), plan);
  if (!item || plan.lastNotified === item.tag) return;
  await self.registration.showNotification(item.title, { body: item.body, tag: item.tag, data: { cab: true } });
  plan.lastNotified = item.tag;
  await writePlan(plan);
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'goroadhub-quarter') event.waitUntil(maybeNotify());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL('/?cab=1', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        client.postMessage({ cab: true });
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

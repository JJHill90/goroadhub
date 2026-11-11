'use strict';
// The Drivers Advocate App moved to https://app.tdaau.com (11 Nov 2026).
// This Render copy now only sends people there: every path goes to the same path on the new address.
// /healthz still answers 200 so Render keeps the service healthy, and /sw.js is replaced by a tiny
// service worker that clears the old offline copy and moves open home-screen apps to the new address.
const DEFAULT_TARGET = 'https://app.tdaau.com';

function cleanTarget(value) {
  const t = String(value || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(t) ? t : DEFAULT_TARGET;
}

function killSwitchWorker(target) {
  return [
    "// The Drivers Advocate App has moved to " + target + ". This replaces the old offline copy.",
    "const TARGET = " + JSON.stringify(target) + ";",
    "self.addEventListener('install', () => self.skipWaiting());",
    "self.addEventListener('activate', event => event.waitUntil((async () => {",
    "  try { await self.clients.claim(); } catch (e) {}",
    "  try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch (e) {}",
    "  try {",
    "    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });",
    "    for (const c of wins) { try { const u = new URL(c.url); await c.navigate(TARGET + u.pathname + u.search + u.hash); } catch (e) {} }",
    "  } catch (e) {}",
    "  try { await self.registration.unregister(); } catch (e) {}",
    "})()));",
    ""
  ].join('\n');
}

function mountMoved(app, targetValue) {
  const target = cleanTarget(targetValue);
  app.get('/healthz', (req, res) => res.json({ status: 'ok', movedTo: target }));
  app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.type('application/javascript').send(killSwitchWorker(target));
  });
  app.use((req, res) => {
    const pathAndQuery = String(req.originalUrl || '/').startsWith('/') ? req.originalUrl : '/';
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(req.method === 'GET' || req.method === 'HEAD' ? 302 : 307, target + pathAndQuery);
  });
  return target;
}

module.exports = { mountMoved, cleanTarget, killSwitchWorker, DEFAULT_TARGET };

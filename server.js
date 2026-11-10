const express = require('express'), crypto = require('crypto'), path = require('path');
const { createStore, duplicateError } = require('./db');
const { sessionSecret, adminPassword, adminUser, createAuth, mountAuth, mountAdminEntry, secureCookie, cleanAccountName, hashPassword, verifyPassword } = require('./auth');
const { driverPost, driverReply, makeLimiter } = require('./community');
const { advocatePages } = require('./advocate');
const app = express(), PORT = process.env.PORT || 3000;
const auth = createAuth(sessionSecret(), adminPassword(), Date.now, adminUser());
const store = createStore(process.env.DATABASE_URL);
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self' blob:", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'", "form-action 'self'",
    "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:", "media-src 'self' https: blob:",
    "frame-src https://www.facebook.com", "connect-src 'self' https://tdaau.com https://nominatim.openstreetmap.org https://api.what3words.com"
  ].join('; '));
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const ct = String(req.headers['content-type'] || '');
  if (!ct.toLowerCase().includes('application/json')) return res.status(415).json({ error: 'JSON body required' });
  next();
});

async function lookupAccount(username, password) {
  const name = cleanAccountName(username);
  if (!name || typeof password !== 'string' || !password) return null;
  const row = await store.get('accounts', name.toLowerCase());
  if (!row || !verifyPassword(password, row.pass)) return null;
  return { user: row.user || name };
}
const isAdmin = mountAuth(app, auth, lookupAccount);
mountAdminEntry(app, auth, process.env.ADMIN_ENTRY);
const allowPost = makeLimiter(6, 10 * 60 * 1000), allowReply = makeLimiter(30, 10 * 60 * 1000), allowJoin = makeLimiter(5, 15 * 60 * 1000);
app.get('/healthz', (req, res) => res.send('ok'));

const wrap = f => (q, r, n) => f(q, r, n).catch(e => {
  if (e && e.status) return r.status(e.status).json({ error: e.message });
  console.error(e); r.status(500).json({ error: 'Server error' });
});
const need = (q, r, n) => isAdmin(q) ? n() : r.status(401).json({ error: 'Admin only' });
app.post('/api/register', wrap(async (q, r) => {
  if (!allowJoin(q.ip || 'unknown')) return r.status(429).json({ error: 'Too many attempts' });
  const username = cleanAccountName(q.body && q.body.username);
  const password = q.body && typeof q.body.password === 'string' ? q.body.password : '';
  if (!username) return r.status(400).json({ error: 'Use 2–40 letters or numbers, starting with a letter or number' });
  if (password.length < 8 || password.length > 72) return r.status(400).json({ error: 'Use a password of at least 8 characters' });
  const id = username.toLowerCase();
  const existing = await store.get('accounts', id);
  if (existing) return r.status(409).json({ error: 'That username is taken' });
  try {
    await store.insert('accounts', id, { user: username, pass: hashPassword(password), at: Date.now() });
  } catch (e) {
    if (duplicateError(e)) return r.status(409).json({ error: 'That username is taken' });
    throw e;
  }
  r.setHeader('Set-Cookie', [auth.cookie('', 0, secureCookie(q)), auth.userCookie(username, 604800, secureCookie(q))]);
  r.json({ admin: false, role: 'driver', user: username });
}));
app.get('/api/advocate', wrap(async (q, r) => { r.json({ pages: await advocatePages() }); }));
require('./feeds')(app, store, need);
require('./standard-dates').mount(app);
app.post('/api/community/posts', wrap(async (q, r) => {
  if (!allowPost(q.ip || 'unknown')) return r.status(429).json({ error: 'Too many posts' });
  const data = driverPost(q.body);
  const id = crypto.randomUUID();
  await store.insert('posts', id, data);
  r.json({ id });
}));
app.post('/api/community/replies', wrap(async (q, r) => {
  if (!allowReply(q.ip || 'unknown')) return r.status(429).json({ error: 'Too many replies' });
  const data = driverReply(q.body);
  const post = await store.get('posts', data.postId);
  if (!post) return r.status(404).json({ error: 'Unknown post' });
  const id = crypto.randomUUID();
  await store.insert('comments', id, data);
  await store.bumpCount('posts', data.postId, 'c', 1);
  r.json({ id });
}));
const COLLECTIONS = ['posts', 'ticker', 'feeds', 'episodes', 'comments', 'traffic'];
const BACKUP = [...COLLECTIONS, 'accounts'];
const rowData = row => {
  const data = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    data[k] = v;
  }
  return data;
};
app.get('/api/admin/backup', need, wrap(async (q, r) => {
  const collections = {};
  for (const coll of BACKUP) {
    const x = await store.all(coll);
    collections[coll] = x.map(o => ({ ...o.data, id: o.id }));
  }
  r.json({ exportedAt: Date.now(), collections });
}));
app.post('/api/admin/restore', need, wrap(async (q, r) => {
  const collections = q.body && q.body.collections;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) return r.status(400).json({ error: 'Missing collections' });
  const restored = {};
  for (const coll of BACKUP) {
    if (collections[coll] === undefined) continue;
    const rows = collections[coll];
    if (!Array.isArray(rows)) return r.status(400).json({ error: 'Bad collection' });
    if (rows.length > 5000) return r.status(400).json({ error: 'Too many rows' });
    let n = 0;
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const id = String(row.id || '').trim();
      if (!id || id.length > 80 || /[\u0000/\\]/.test(id)) continue;
      await store.put(coll, id, rowData(row));
      n++;
    }
    restored[coll] = n;
  }
  r.json({ ok: true, restored });
}));
app.use('/api/:c', (q, r, n) => COLLECTIONS.includes(q.params.c) ? n() : r.status(404).json({ error: 'Unknown collection' }));
const body = q => {
  const src = q.body && typeof q.body === 'object' && !Array.isArray(q.body) ? q.body : {};
  const d = { ...src }; delete d.id; return d;
};
app.get('/api/:c', wrap(async (q, r) => {
  const wide = q.params.c === 'posts' || q.params.c === 'episodes' || q.params.c === 'comments';
  const cap = wide ? 1000 : 200;
  const fallback = isAdmin(q) ? cap : (q.params.c === 'posts' ? 80 : q.params.c === 'comments' ? 200 : 60);
  const asked = Number(q.query.limit);
  const lim = Math.min(cap, Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : fallback);
  let rows;
  if (q.params.c === 'posts' && !isAdmin(q)) {
    const news = await store.list('posts', 24, true);
    const rest = await store.list('posts', lim, false);
    rows = [...news, ...rest].map(o => ({ ...o.data, id: o.id }));
  } else {
    const x = await store.list(q.params.c, lim);
    rows = x.map(o => ({ ...o.data, id: o.id }));
  }
  if (q.params.c === 'feeds' && !isAdmin(q)) rows = rows.map(({ url, ...rest }) => rest);
  r.json(rows);
}));
app.post('/api/:c', need, wrap(async (q, r) => {
  const id = crypto.randomUUID();
  await store.insert(q.params.c, id, body(q));
  r.json({ id });
}));
app.patch('/api/:c/:id', need, wrap(async (q, r) => {
  await store.merge(q.params.c, q.params.id, body(q));
  r.json({ ok: true });
}));
app.delete('/api/:c/:id', need, wrap(async (q, r) => {
  let postId = '';
  if (q.params.c === 'comments') {
    const cur = await store.get('comments', q.params.id);
    postId = cur && cur.postId || '';
  }
  await store.remove(q.params.c, q.params.id);
  if (postId) await store.bumpCount('posts', postId, 'c', -1);
  r.json({ ok: true });
}));

app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
    return res.status(err.status || 400).json({ error: err.type === 'entity.too.large' ? 'Request is too large' : 'Invalid JSON' });
  }
  next(err);
});
app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.webmanifest'));
});
app.use(express.static(path.join(__dirname, 'public')));
// Phusion Passenger (cPanel "Setup Node.js App") loads server.js through its own loader,
// so require.main is not this module there; start listening in that case too.
if (require.main === module || typeof PhusionPassenger !== 'undefined') {
  store.init()
    .then(() => app.listen(PORT, () => console.log('GoRoadHub running on ' + PORT)))
    .catch(e => { console.error('Database error:', e.message); process.exit(1); });
}

module.exports = { app, store };

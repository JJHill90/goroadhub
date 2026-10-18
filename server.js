const express = require('express'), { Pool } = require('pg'), crypto = require('crypto'), path = require('path');
const { sessionSecret, adminPassword, adminUser, createAuth, mountAuth, secureCookie, cleanAccountName, hashPassword, verifyPassword } = require('./auth');
const { driverPost, driverReply, makeLimiter } = require('./community');
const { advocatePages } = require('./advocate');
const app = express(), PORT = process.env.PORT || 3000;
const auth = createAuth(sessionSecret(), adminPassword(), Date.now, adminUser());
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false });
pool.on('error', err => console.error('Idle database client error:', err.message));
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'", "form-action 'self'",
    "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:", "media-src 'self' https: blob:",
    "frame-src https://www.facebook.com", "connect-src 'self'"
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
  const x = await pool.query("select data from docs where coll = 'accounts' and id = $1", [name.toLowerCase()]);
  const row = x.rows[0] && x.rows[0].data;
  if (!row || !verifyPassword(password, row.pass)) return null;
  return { user: row.user || name };
}
const isAdmin = mountAuth(app, auth, lookupAccount);
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
  const existing = await pool.query("select 1 from docs where coll = 'accounts' and id = $1", [id]);
  if (existing.rowCount) return r.status(409).json({ error: 'That username is taken' });
  try {
    await pool.query('insert into docs(coll, id, data) values($1,$2,$3)', ['accounts', id, { user: username, pass: hashPassword(password), at: Date.now() }]);
  } catch (e) {
    if (e && e.code === '23505') return r.status(409).json({ error: 'That username is taken' });
    throw e;
  }
  r.setHeader('Set-Cookie', [auth.cookie('', 0, secureCookie(q)), auth.userCookie(username, 604800, secureCookie(q))]);
  r.json({ admin: false, role: 'driver', user: username });
}));
app.get('/api/advocate', wrap(async (q, r) => { r.json({ pages: await advocatePages() }); }));
require('./feeds')(app, pool, need);
app.post('/api/community/posts', wrap(async (q, r) => {
  if (!allowPost(q.ip || 'unknown')) return r.status(429).json({ error: 'Too many posts' });
  const data = driverPost(q.body);
  const id = crypto.randomUUID();
  await pool.query('insert into docs(coll, id, data) values($1, $2, $3)', ['posts', id, data]);
  r.json({ id });
}));
app.post('/api/community/replies', wrap(async (q, r) => {
  if (!allowReply(q.ip || 'unknown')) return r.status(429).json({ error: 'Too many replies' });
  const data = driverReply(q.body);
  const post = await pool.query("select 1 from docs where coll = 'posts' and id = $1", [data.postId]);
  if (!post.rowCount) return r.status(404).json({ error: 'Unknown post' });
  const id = crypto.randomUUID();
  await pool.query('insert into docs(coll, id, data) values($1, $2, $3)', ['comments', id, data]);
  await pool.query("update docs set data = jsonb_set(data, '{c}', to_jsonb(coalesce((data->>'c')::int, 0) + 1)) where coll = 'posts' and id = $1", [data.postId]);
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
    const x = await pool.query('select id, data from docs where coll = $1 order by id', [coll]);
    collections[coll] = x.rows.map(o => ({ ...o.data, id: o.id }));
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
      await pool.query(
        'insert into docs(coll, id, data) values($1, $2, $3::jsonb) on conflict (coll, id) do update set data = excluded.data',
        [coll, id, JSON.stringify(rowData(row))]
      );
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
    const news = await pool.query(
      "select id, data from docs where coll = 'posts' and data->>'auto' = 'true' order by (data->>'at')::double precision desc nulls last limit 24"
    );
    const rest = await pool.query(
      "select id, data from docs where coll = 'posts' and coalesce(data->>'auto', '') <> 'true' order by coalesce((data->>'pin')::boolean, false) desc, (data->>'at')::double precision desc nulls last limit $1",
      [lim]
    );
    rows = [...news.rows, ...rest.rows].map(o => ({ ...o.data, id: o.id }));
  } else {
    const x = await pool.query(
      "select id, data from docs where coll = $1 order by coalesce((data->>'pin')::boolean, false) desc, (data->>'at')::double precision desc nulls last limit $2",
      [q.params.c, lim]
    );
    rows = x.rows.map(o => ({ ...o.data, id: o.id }));
  }
  if (q.params.c === 'feeds' && !isAdmin(q)) rows = rows.map(({ url, ...rest }) => rest);
  r.json(rows);
}));
app.post('/api/:c', need, wrap(async (q, r) => {
  const id = crypto.randomUUID();
  await pool.query('insert into docs(coll, id, data) values($1, $2, $3)', [q.params.c, id, body(q)]);
  r.json({ id });
}));
app.patch('/api/:c/:id', need, wrap(async (q, r) => {
  await pool.query('update docs set data = data || $3::jsonb where coll = $1 and id = $2', [q.params.c, q.params.id, JSON.stringify(body(q))]);
  r.json({ ok: true });
}));
app.delete('/api/:c/:id', need, wrap(async (q, r) => {
  let postId = '';
  if (q.params.c === 'comments') {
    const cur = await pool.query('select data from docs where coll = $1 and id = $2', ['comments', q.params.id]);
    postId = cur.rows[0] && cur.rows[0].data && cur.rows[0].data.postId || '';
  }
  await pool.query('delete from docs where coll = $1 and id = $2', [q.params.c, q.params.id]);
  if (postId) await pool.query("update docs set data = jsonb_set(data, '{c}', to_jsonb(greatest(coalesce((data->>'c')::int, 0) - 1, 0))) where coll = 'posts' and id = $1", [postId]);
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
if (require.main === module) {
  pool.query('create table if not exists docs(coll text not null, id text not null, data jsonb not null, primary key(coll, id))')
    .then(() => app.listen(PORT, () => console.log('GoRoadHub running on ' + PORT)))
    .catch(e => { console.error('Database error:', e.message); process.exit(1); });
}

module.exports = { app, pool };

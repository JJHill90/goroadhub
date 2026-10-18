const express = require('express'), { Pool } = require('pg'), crypto = require('crypto'), path = require('path');
const { sessionSecret, adminPassword, createAuth, mountAuth } = require('./auth');
const { driverPost, driverReply, makeLimiter } = require('./community');
const app = express(), PORT = process.env.PORT || 3000;
const auth = createAuth(sessionSecret(), adminPassword());
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
app.use(express.json({ limit: '100kb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const ct = String(req.headers['content-type'] || '');
  if (!ct.toLowerCase().includes('application/json')) return res.status(415).json({ error: 'JSON body required' });
  next();
});

const isAdmin = mountAuth(app, auth);
const allowPost = makeLimiter(6, 10 * 60 * 1000), allowReply = makeLimiter(30, 10 * 60 * 1000);
app.get('/healthz', (req, res) => res.send('ok'));

const wrap = f => (q, r, n) => f(q, r, n).catch(e => {
  if (e && e.status) return r.status(e.status).json({ error: e.message });
  console.error(e); r.status(500).json({ error: 'Server error' });
});
const need = (q, r, n) => isAdmin(q) ? n() : r.status(401).json({ error: 'Admin only' });
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
app.use('/api/:c', (q, r, n) => ['posts', 'ticker', 'feeds', 'episodes', 'comments'].includes(q.params.c) ? n() : r.status(404).json({ error: 'Unknown collection' }));
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
  const x = await pool.query(
    "select id, data from docs where coll = $1 order by coalesce((data->>'pin')::boolean, false) desc, (data->>'at')::double precision desc nulls last limit $2",
    [q.params.c, lim]
  );
  let rows = x.rows.map(o => ({ ...o.data, id: o.id }));
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
  await pool.query('delete from docs where coll = $1 and id = $2', [q.params.c, q.params.id]);
  r.json({ ok: true });
}));

app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
    return res.status(err.status || 400).json({ error: err.type === 'entity.too.large' ? 'Request is too large' : 'Invalid JSON' });
  }
  next(err);
});
app.use(express.static(path.join(__dirname, 'public')));
if (require.main === module) {
  pool.query('create table if not exists docs(coll text not null, id text not null, data jsonb not null, primary key(coll, id))')
    .then(() => app.listen(PORT, () => console.log('GoRoadHub running on ' + PORT)))
    .catch(e => { console.error('Database error:', e.message); process.exit(1); });
}

module.exports = { app, pool };

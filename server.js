const express = require('express'), { Pool } = require('pg'), crypto = require('crypto'), path = require('path');
const app = express(), PORT = process.env.PORT || 3000, PW = process.env.ADMIN_PASSWORD;
const SEC = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!PW) { console.error('ADMIN_PASSWORD env var is required'); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false });
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// --- admin session (signed cookie, 7 days) ---
const sign = e => crypto.createHmac('sha256', SEC).update('admin.' + e).digest('hex');
const token = () => { const e = Date.now() + 7 * 864e5; return e + '.' + sign(e); };
const isAdmin = req => {
  const c = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('rh_admin='));
  if (!c) return false;
  const [e, h] = c.slice(9).split('.');
  if (!e || !h || +e < Date.now()) return false;
  const a = Buffer.from(sign(e)), b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const cookie = (v, age) => 'rh_admin=' + v + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + age + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
const fails = new Map();
app.post('/api/login', (req, res) => {
  const ip = req.ip, f = fails.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 9e5) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 8) return res.status(429).json({ error: 'Too many attempts' });
  const h = s => crypto.createHash('sha256').update(String(s || '')).digest();
  if (!crypto.timingSafeEqual(h(req.body.password), h(PW))) { f.n++; fails.set(ip, f); return res.status(401).json({ error: 'Wrong password' }); }
  res.setHeader('Set-Cookie', cookie(token(), 604800)); res.json({ admin: true });
});
app.post('/api/logout', (req, res) => { res.setHeader('Set-Cookie', cookie('', 0)); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ admin: isAdmin(req) }));
app.get('/healthz', (req, res) => res.send('ok'));

// --- shared data: posts + ticker (anyone reads, only admin writes) ---
const wrap = f => (q, r, n) => f(q, r, n).catch(e => { console.error(e); r.status(500).json({ error: 'Server error' }); });
const need = (q, r, n) => isAdmin(q) ? n() : r.status(401).json({ error: 'Admin only' });
app.use('/api/:c', (q, r, n) => ['posts', 'ticker'].includes(q.params.c) ? n() : r.status(404).json({ error: 'Unknown collection' }));
const body = q => { const d = { ...q.body }; delete d.id; return d; };
app.get('/api/:c', wrap(async (q, r) => {
  const x = await pool.query('select id, data from docs where coll = $1', [q.params.c]);
  r.json(x.rows.map(o => ({ ...o.data, id: o.id })));
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

app.use(express.static(path.join(__dirname, 'public')));
pool.query('create table if not exists docs(coll text not null, id text not null, data jsonb not null, primary key(coll, id))')
  .then(() => app.listen(PORT, () => console.log('GoRoadHub running on ' + PORT)))
  .catch(e => { console.error('Database error:', e.message); process.exit(1); });

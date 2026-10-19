const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuth, mountAuth, mountAdminEntry, sessionSecret, adminPassword, hashPassword, verifyPassword, cleanAccountName } = require('../auth');

async function withServer(password, fn) {
  const app = express();
  app.use(express.json());
  const auth = createAuth('test-secret', password);
  mountAuth(app, auth);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await fn('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function login(base, password, username) {
  const body = username === undefined ? { password } : { username, password };
  return fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('a correct password sets an HttpOnly cookie that /api/me accepts', async () => {
  await withServer('s3cret', async base => {
    const bad = await login(base, 'nope');
    assert.equal(bad.status, 401);
    const ok = await login(base, 's3cret');
    assert.equal(ok.status, 200);
    const set = ok.headers.get('set-cookie') || '';
    assert.match(set, /HttpOnly/i);
    assert.match(set, /SameSite=Lax/i);
    assert.doesNotMatch(set, /Secure/i);
    const me = await fetch(base + '/api/me', { headers: { cookie: set.split(';')[0] } });
    assert.deepEqual(await me.json(), { admin: true, role: 'oversight', user: 'RoadHub_Admin' });
    const stranger = await fetch(base + '/api/me');
    assert.deepEqual(await stranger.json(), { admin: false });
  });
});

test('surrounding whitespace on the typed password still matches', async () => {
  await withServer('s3cret', async base => {
    const ok = await login(base, ' s3cret\n');
    assert.equal(ok.status, 200);
  });
});

test('RoadHub_Admin signs in even when the env password is different', async () => {
  await withServer('s3cret', async base => {
    const wrongName = await login(base, 'RoadHub_Admin', 'someone');
    assert.equal(wrongName.status, 401);
    const wrongPass = await login(base, 'nope', 'RoadHub_Admin');
    assert.equal(wrongPass.status, 401);
    const ok = await login(base, 'RoadHub_Admin', 'RoadHub_Admin');
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { admin: true, role: 'oversight', user: 'RoadHub_Admin' });
  });
});

test('a named login must use the oversight username', async () => {
  await withServer('s3cret', async base => {
    assert.equal((await login(base, 's3cret', 'other')).status, 401);
    assert.equal((await login(base, 's3cret', 'RoadHub_Admin')).status, 200);
  });
});

test('eight failures lock the client out', async () => {
  await withServer('s3cret', async base => {
    for (let i = 0; i < 8; i++) assert.equal((await login(base, 'nope')).status, 401);
    assert.equal((await login(base, 's3cret')).status, 429);
  });
});

test('expired and forged cookies are rejected', () => {
  let now = 1_700_000_000_000;
  const auth = createAuth('test-secret', 's3cret', () => now);
  const token = auth.token();
  const req = cookie => ({ headers: { cookie } });
  assert.equal(auth.isAdmin(req('rh_admin=' + token)), true);
  now += 8 * 864e5;
  assert.equal(auth.isAdmin(req('rh_admin=' + token)), false);
  assert.equal(auth.isAdmin(req('rh_admin=1.' + 'ab'.repeat(32))), false);
});

test('production refuses to start without SESSION_SECRET or ADMIN_PASSWORD', () => {
  const prevEnv = process.env.NODE_ENV, prevSecret = process.env.SESSION_SECRET, prevPw = process.env.ADMIN_PASSWORD;
  const exit = process.exit;
  process.exit = code => { throw new Error('exit ' + code); };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    assert.throws(() => sessionSecret(), /exit 1/);
    process.env.ADMIN_PASSWORD = '  secret  ';
    assert.equal(adminPassword(), 'secret');
    process.env.ADMIN_PASSWORD = '   ';
    assert.throws(() => adminPassword(), /exit 1/);
  } finally {
    process.exit = exit;
    if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prevSecret;
    if (prevPw === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = prevPw;
  }
});

test('a driver account signs in without oversight access', async () => {
  const app = express();
  app.use(express.json());
  const auth = createAuth('test-secret', 's3cret');
  mountAuth(app, auth, async (user, pass) => user === 'sam.jones' && pass === 'longpass1' ? { user: 'sam.jones' } : null);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const ok = await login(base, 'longpass1', 'sam.jones');
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { admin: false, role: 'driver', user: 'sam.jones' });
    const cookies = typeof ok.headers.getSetCookie === 'function' ? ok.headers.getSetCookie() : [ok.headers.get('set-cookie') || ''];
    const user = cookies.find(c => String(c).startsWith('rh_user='));
    assert.ok(user);
    const me = await fetch(base + '/api/me', { headers: { cookie: user.split(';')[0] } });
    assert.deepEqual(await me.json(), { admin: false, role: 'driver', user: 'sam.jones' });
    assert.equal(auth.isAdmin({ headers: { cookie: user.split(';')[0] } }), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('the secret address sets the admin cookie and a wrong address stays hidden', async () => {
  const app = express();
  const auth = createAuth('test-secret', 's3cret');
  mountAuth(app, auth);
  mountAdminEntry(app, auth, 'correct-entry-token');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const missing = await fetch(base + '/oversight/nope', { redirect: 'manual' });
    assert.equal(missing.status, 404);
    const ok = await fetch(base + '/oversight/correct-entry-token', { redirect: 'manual' });
    assert.equal(ok.status, 302);
    assert.equal(ok.headers.get('location'), '/?open=adm');
    const set = ok.headers.get('set-cookie') || '';
    assert.match(set, /rh_admin=/);
    assert.match(set, /HttpOnly/i);
    const me = await fetch(base + '/api/me', { headers: { cookie: set.split(';')[0] } });
    assert.equal((await me.json()).admin, true);
    for (let i = 0; i < 8; i++) assert.equal((await fetch(base + '/oversight/wrong-token', { redirect: 'manual' })).status, 404);
    const locked = await fetch(base + '/oversight/correct-entry-token', { redirect: 'manual' });
    assert.equal(locked.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('account passwords are hashed and the oversight name cannot be registered', () => {
  const stored = hashPassword('longpass1');
  assert.equal(stored.includes('longpass1'), false);
  assert.equal(verifyPassword('longpass1', stored), true);
  assert.equal(verifyPassword('wrongpass', stored), false);
  assert.equal(cleanAccountName('RoadHub_Admin'), '');
  assert.equal(cleanAccountName('ab'), 'ab');
  assert.equal(cleanAccountName('a'), '');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuth, mountAuth, sessionSecret, adminPassword } = require('../auth');

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

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mountMoved, cleanTarget, killSwitchWorker } = require('../moved');

async function withServer(fn) {
  const app = express();
  mountMoved(app);
  app.get('/never', (req, res) => res.send('old app'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await fn('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('every path goes to the same path on app.tdaau.com', async () => {
  await withServer(async base => {
    for (const p of ['/', '/?open=adm', '/api/posts?limit=5', '/oversight/abc', '/photo-credits.html', '/never']) {
      const r = await fetch(base + p, { redirect: 'manual' });
      assert.equal(r.status, 302, p);
      assert.equal(r.headers.get('location'), 'https://app.tdaau.com' + p);
    }
    const post = await fetch(base + '/api/login', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(post.status, 307);
    assert.equal(post.headers.get('location'), 'https://app.tdaau.com/api/login');
  });
});

test('Render health check still passes and the old offline copy is retired', async () => {
  await withServer(async base => {
    const h = await fetch(base + '/healthz');
    assert.equal(h.status, 200);
    assert.deepEqual(await h.json(), { status: 'ok', movedTo: 'https://app.tdaau.com' });
    const sw = await fetch(base + '/sw.js');
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get('content-type'), /javascript/);
    const body = await sw.text();
    assert.match(body, /caches\.delete/);
    assert.match(body, /registration\.unregister/);
    assert.match(body, /const TARGET = "https:\/\/app\.tdaau\.com";/);
  });
});

test('the target must be an https origin', () => {
  assert.equal(cleanTarget(''), 'https://app.tdaau.com');
  assert.equal(cleanTarget('https://example.com/'), 'https://example.com');
  assert.equal(cleanTarget('http://evil.test'), 'https://app.tdaau.com');
  assert.equal(cleanTarget('https://x.test/path'), 'https://app.tdaau.com');
  assert.doesNotThrow(() => new Function(killSwitchWorker('https://app.tdaau.com')));
});

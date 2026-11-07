const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { STATS_URL, loadStats, statsHtml, visibleStats } = require('../public/events.js');

const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('stats cards render in order and disappear when the list is empty', () => {
  const raw = {
    generated: '2026-11-08T00:00:00+11:00',
    stats: [
      { key: 'members', label: 'Members', value: 1200, note: 'All groups', order: 2 },
      { key: 'groups', label: 'Groups', value: 23, note: 'Split by topic', order: 0 },
      { key: 'blank', label: '', value: '', note: 'ignore', order: 1 },
      { key: 'posts', label: 'Posts', value: '—', order: 1 }
    ]
  };
  assert.deepEqual(visibleStats(raw).map(card => card.key), ['groups', 'posts', 'members']);
  const html = statsHtml(raw);
  assert.ok(html.indexOf('Groups') < html.indexOf('Posts') && html.indexOf('Posts') < html.indexOf('Members'));
  assert.match(html, /id="stats-strip"/);
  assert.match(html, /<p class="stat-value">23<\/p>/);
  assert.match(html, /Split by topic/);
  assert.match(html, /All groups/);
  assert.equal(html.includes('ignore'), false);
  assert.equal(statsHtml({ generated: 'x', stats: [] }), '');
  assert.equal(statsHtml(null), '');
  assert.equal(statsHtml({ generated: 'x' }), '');
  assert.equal(statsHtml({ stats: [{ key: 'n', label: 'Zero', value: 0, order: 1 }] }).includes('>0<'), true);
});

test('a failed or empty stats fetch stays completely hidden', async () => {
  assert.equal(STATS_URL, 'https://tdaau.com/stats.json');
  const calls = [];
  const storage = {
    getItem() { throw new Error('stats must not read storage'); },
    setItem() { throw new Error('stats must not write storage'); }
  };
  const missing = await loadStats({
    storage,
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      return jsonResponse(404, {});
    }
  });
  assert.deepEqual(calls, [{ url: STATS_URL, opts: { cache: 'no-store' } }]);
  assert.deepEqual(missing, { generated: '', stats: [] });
  assert.equal(statsHtml(missing), '');

  const down = await loadStats({
    storage,
    fetch: async () => { throw new Error('offline'); }
  });
  assert.equal(statsHtml(down), '');

  const empty = await loadStats({
    fetch: async () => jsonResponse(200, { generated: '2026-11-08T00:00:00+11:00', stats: [] })
  });
  assert.equal(statsHtml(empty), '');

  const live = await loadStats({
    fetch: async () => jsonResponse(200, { generated: '2026-11-08T00:00:00+11:00', stats: [{ key: 'groups', label: 'Groups', value: 23, note: 'Topics', order: 3 }] })
  });
  assert.equal(live.generated, '2026-11-08T00:00:00+11:00');
  assert.match(statsHtml(live), /Topics/);
});

test('the home view paints the stats strip from the public feed', () => {
  assert.match(app, /statsHtml\(STATS\)/);
  assert.match(app, /loadStats\(\)/);
  assert.match(app, /function paintStats\(\)/);
  assert.match(app, /if\(v==='mag'\)refreshStats\(\)/);
});

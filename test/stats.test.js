const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { STATS_URL, loadStats, statsHtml, visibleStats, GROUP_STATS, PODCAST_PROFILE, podcastStats, podcastStatsHtml, podcastHourRows, thankYouText, driverCountHtml, facebookCommunityHtml } = require('../public/events.js');
require('../public/listen-out');

const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

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

test('the Stats tab shows podcast facts from the feed and no group numbers', () => {
  assert.deepEqual(GROUP_STATS, []);
  assert.equal(PODCAST_PROFILE, 'https://soundcloud.com/the-drivers-advocate-podcast');
  const at = Date.parse('2026-11-01T12:00:00+11:00');
  const info = podcastStats([
    { h: 'Older show', at: at - 86400000 },
    { h: 'Latest show', at }
  ]);
  assert.equal(info.total, 2);
  assert.equal(info.latest.title, 'Latest show');
  assert.equal(info.groups, GROUP_STATS);
  const html = podcastStatsHtml([
    { h: 'Older show', at: at - 86400000 },
    { h: 'Latest show', at }
  ]);
  assert.match(html, /class="stat-grid"/);
  assert.match(html, /<p class="stat-value">2<\/p>/);
  assert.match(html, /Latest show/);
  assert.match(html, /1 Nov 2026/);
  assert.match(html, /href="https:\/\/soundcloud.com\/the-drivers-advocate-podcast"/);
  assert.match(html, /Thank You for being part of a truly unique group/);
  assert.equal(html.includes('Members'), false);
  assert.equal(html.includes('Groups'), false);
  assert.equal(html.includes("You're one of X drivers"), false);
  assert.equal(driverCountHtml({}), '');
  assert.equal(driverCountHtml([]), '');
  assert.match(html, /Hours published/);
  assert.match(html, /Last 24 months/);
  assert.match(html, /Pocket Casts/);
  assert.match(html, /Overcast/);
  assert.equal(thankYouText(''), 'Thank You for being part of a truly unique group');
  assert.equal(thankYouText(' Sam '), 'Thank You Sam for being part of a truly unique group');
  const named = podcastStatsHtml([{ h: 'Latest show', at }], 'Sam');
  assert.match(named, /Thank You Sam for being part of a truly unique group/);
  assert.match(named, /What's your first name\?/);
  assert.match(named, />Change name</);
  assert.match(driverCountHtml({ drivers: 1200 }), /You're one of 1200 drivers/);
  assert.equal(driverCountHtml({ drivers: 1200 }).includes('hidden'), false);
  const waiting = podcastStatsHtml([]);
  assert.equal(waiting.includes('stat-value'), false);
  assert.match(waiting, /when the feed can be reached/);
  assert.match(waiting, /Thank You for being part of a truly unique group/);
  assert.match(app, /\['sta','📊 Stats','Stats'\]/);
  assert.match(app, /function statsView\(\)/);
  assert.match(app, /podcastStatsHtml\(EPS,readFirstName\(\)\)/);
  assert.match(app, /localStorage\.setItem\('rh-first-name'/);
  const save = app.slice(app.indexOf('function saveFirstName'), app.indexOf('function statsView'));
  assert.equal(save.includes('fetch('), false);
  assert.equal(save.includes('api('), false);
  assert.match(index, /\.stats-page \.stat-grid\{[^}]*grid-template-columns:1fr;/);
  assert.match(index, /@media\(min-width:720px\)\{#eps\{grid-template-columns:1fr 1fr\}\.stats-page \.stat-grid\{grid-template-columns:1fr 1fr\}/);
  assert.match(index, /\.stat-link\{[^}]*background:#1877F2/);
});

test('the home view paints the stats strip from the public feed', () => {
  assert.match(app, /statsHtml\(STATS\)/);
  assert.match(app, /loadStats\(\)/);
  assert.match(app, /function paintStats\(\)/);
  assert.match(app, /if\(v==='mag'\)refreshStats\(\)/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  EVENTS_URL, CALENDAR_URL, EVENTS_POLL_MS, EVENTS_CACHE_KEY, REMINDER_SEEN_KEY,
  loadEvents, readCache, eventActions, formatEventWhen, eventsHtml, eventYmds, calendarHtml,
  reminderActive, selectReminders, reminderSession, remindersHtml, readSeen, writeSeen, parseEvents
} = require('../public/events.js');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function memoryStore(initial) {
  const box = Object.assign({}, initial);
  return {
    getItem: key => (Object.prototype.hasOwnProperty.call(box, key) ? box[key] : null),
    setItem: (key, value) => { box[key] = String(value); }
  };
}

function feed(extra) {
  return Object.assign({
    generated: '2026-11-08T00:15:22+11:00',
    timezone: 'Australia/Sydney',
    upcoming: [],
    recent: [],
    reminders: []
  }, extra);
}

const show = {
  id: 'show',
  title: 'Brisbane Truck Show',
  start: '2026-11-14T18:00:00+11:00',
  end: '2026-11-14T20:30:00+11:00',
  location: 'Brisbane',
  description: 'Gates at 6.',
  url: 'https://tdaau.com/events/show',
  updated: '2026-11-01T00:00:00+11:00',
  category: 'Show'
};

const yard = {
  id: 'yard',
  title: 'Yard talk <script>',
  start: '2026-12-02T09:00:00+11:00',
  end: '2026-12-02T11:00:00+11:00',
  location: 'Wetherill Park',
  link: 'https://tdaau.com/events/yard.ics',
  url: 'https://tdaau.com/events/yard',
  updated: '2026-11-01T00:00:00+11:00'
};

test('upcoming events show the date, title, location and category, with a calendar link', () => {
  assert.equal(formatEventWhen(show, 'Australia/Sydney'), 'Sat, 14 Nov 2026, 6:00 pm – 8:30 pm');
  assert.equal(eventActions(show).calendar, CALENDAR_URL);
  assert.equal(eventActions(yard).calendar, 'https://tdaau.com/events/yard.ics');
  assert.equal(eventActions(yard).page, 'https://tdaau.com/events/yard');
  assert.equal(eventActions({ link: '/events/meet.ics', url: 'https://tdaau.com/events/meet' }).calendar, 'https://tdaau.com/events/meet.ics');
  const html = eventsHtml(feed({ upcoming: [yard, show] }));
  const showAt = html.indexOf('data-event-id="show"');
  const yardAt = html.indexOf('data-event-id="yard"');
  assert.ok(showAt >= 0 && showAt < yardAt);
  assert.match(html, /Sat, 14 Nov 2026, 6:00 pm – 8:30 pm/);
  assert.match(html, /Brisbane Truck Show/);
  assert.match(html, /href="https:\/\/tdaau\.com\/events\/show"/);
  assert.match(html, /<p class="ev-loc">Brisbane<\/p>/);
  assert.match(html, /<span class="ev-cat">Show<\/span>/);
  assert.equal(html.includes('ev-cat">Yard'), false);
  assert.match(html, /Yard talk &lt;script&gt;/);
  assert.match(html, /href="https:\/\/tdaau\.com\/events\/yard\.ics">Add to my calendar/);
  assert.match(html, new RegExp('href="' + CALENDAR_URL.replace(/[.]/g, '\\.') + '">Add to my calendar'));
  assert.match(html, /Subscribe to the calendar/);
  assert.equal(html.includes('No upcoming events yet'), false);
  assert.equal(eventsHtml(feed()).includes('No upcoming events yet'), true);
});

test('a date-only event keeps the calendar day and skips a missing category', () => {
  const reunion = { id: 'reunion', title: 'Reunion', start: '2026-11-14', end: '2026-11-15', location: 'Dubbo', url: 'https://tdaau.com/events/reunion' };
  assert.equal(formatEventWhen(reunion, 'Australia/Sydney'), 'Sat, 14 Nov 2026 – Sun, 15 Nov 2026');
  const html = eventsHtml(feed({ upcoming: [reunion] }));
  assert.equal(html.includes('ev-cat'), false);
  assert.match(html, /Dubbo/);
  assert.match(html, /href="https:\/\/tdaau\.com\/events\.ics">Add to my calendar/);
});

test('the events poll uses the public feed and falls back to the last good response', async () => {
  assert.equal(EVENTS_URL, 'https://tdaau.com/events.json');
  assert.equal(CALENDAR_URL, 'https://tdaau.com/events.ics');
  assert.equal(EVENTS_POLL_MS, 15 * 60 * 1000);
  const storage = memoryStore();
  const calls = [];
  const payload = feed({ upcoming: [show], reminders: [{ id: 'rego', reminder_id: 'r1', message: 'Rego week', show_from: '2026-11-01', show_until: '2026-11-07', yearly: false, link: 'https://tdaau.com/fit-to-drive/' }] });
  const ok = await loadEvents({
    storage,
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, json: async () => payload };
    }
  });
  assert.deepEqual(calls, [{ url: EVENTS_URL, opts: { cache: 'no-store' } }]);
  assert.equal(ok.failed, false);
  assert.equal(ok.fromCache, false);
  assert.equal(ok.data.upcoming[0].id, 'show');
  assert.equal(ok.data.upcoming[0].category, 'Show');
  assert.equal(Object.prototype.hasOwnProperty.call(parseEvents(feed({ upcoming: [yard] })).upcoming[0], 'category'), false);
  assert.equal(readCache(storage).upcoming[0].title, show.title);

  const stale = await loadEvents({
    storage,
    fetch: async () => { throw new Error('offline'); }
  });
  assert.equal(stale.failed, true);
  assert.equal(stale.fromCache, true);
  assert.equal(stale.data.upcoming[0].id, 'show');
  assert.match(eventsHtml(stale.data, { failed: true, fromCache: true }), /Showing the last saved list/);
  assert.match(eventsHtml(stale.data, { failed: true, fromCache: true }), /Brisbane Truck Show/);

  const junk = await loadEvents({
    storage,
    fetch: async () => ({ ok: true, json: async () => ({ generated: 'nope' }) })
  });
  assert.equal(junk.fromCache, true);
  assert.equal(readCache(storage).reminders[0].id, 'rego');

  const emptyStore = memoryStore();
  const missed = await loadEvents({
    storage: emptyStore,
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) })
  });
  assert.equal(missed.failed, true);
  assert.equal(missed.fromCache, false);
  assert.deepEqual(missed.data.upcoming, []);
  assert.equal(readCache(emptyStore), null);
  const quiet = eventsHtml(missed.data, { failed: true, fromCache: false });
  assert.match(quiet, /Events will show here when the list can be reached/);
  assert.match(quiet, /Subscribe to the calendar/);
  assert.equal(quiet.includes('No upcoming events yet'), false);
});

test('an active reminder is shown once, and a dismissed id stays dismissed', () => {
  const reminders = [
    { id: 'rego', reminder_id: 'r1', message: 'Check your <rego>', show_from: '2026-11-01', show_until: '2026-11-07', yearly: false, link: 'https://tdaau.com/fit-to-drive/' },
    { id: 'medical', reminder_id: 'r2', message: 'Medical due', show_from: '2026-11-01', show_until: '2026-11-07', yearly: true, link: '' },
    { id: 'quiet', reminder_id: 'r3', message: 'Not yet', show_from: '2026-12-01', show_until: '2026-12-07', yearly: false }
  ];
  const data = feed({ reminders });
  const now = new Date('2026-11-03T10:00:00+11:00');
  assert.equal(reminderActive(reminders[0], new Date('2026-10-31T23:00:00+11:00'), 'Australia/Sydney'), false);
  assert.equal(reminderActive(reminders[0], new Date('2026-11-01T00:30:00+11:00'), 'Australia/Sydney'), true);
  assert.equal(reminderActive(reminders[0], new Date('2026-11-07T23:30:00+11:00'), 'Australia/Sydney'), true);
  assert.equal(reminderActive(reminders[0], new Date('2026-11-08T00:30:00+11:00'), 'Australia/Sydney'), false);
  assert.equal(reminderActive(reminders[1], new Date('2027-11-03T10:00:00+11:00'), 'Australia/Sydney'), true);
  assert.equal(reminderActive(reminders[1], new Date('2027-12-01T10:00:00+11:00'), 'Australia/Sydney'), false);
  const christmas = { id: 'xmas', message: 'Shutdown', show_from: '2025-12-20', show_until: '2026-01-05', yearly: true };
  assert.equal(reminderActive(christmas, new Date('2026-12-25T09:00:00+11:00'), 'Australia/Sydney'), true);
  assert.equal(reminderActive(christmas, new Date('2027-01-03T09:00:00+11:00'), 'Australia/Sydney'), true);
  assert.equal(reminderActive(christmas, new Date('2026-06-01T09:00:00+11:00'), 'Australia/Sydney'), false);
  const hours = { id: 'hours', message: 'Doors open', show_from: '2026-11-14T18:00:00+11:00', show_until: '2026-11-14T20:00:00+11:00', yearly: false };
  assert.equal(reminderActive(hours, new Date('2026-11-14T17:59:00+11:00'), 'Australia/Sydney'), false);
  assert.equal(reminderActive(hours, new Date('2026-11-14T18:00:00+11:00'), 'Australia/Sydney'), true);
  assert.equal(reminderActive(hours, new Date('2026-11-14T20:00:00+11:00'), 'Australia/Sydney'), true);
  assert.equal(reminderActive(hours, new Date('2026-11-14T20:01:00+11:00'), 'Australia/Sydney'), false);

  const shown = selectReminders(data, [], now);
  assert.deepEqual(shown.map(item => item.id), ['rego', 'medical']);
  const html = remindersHtml(shown);
  assert.match(html, /Check your &lt;rego&gt;/);
  assert.match(html, /href="https:\/\/tdaau\.com\/fit-to-drive\/"/);
  assert.match(html, /data-dismiss="rego"/);
  assert.match(html, /data-dismiss="medical"/);
  assert.equal(html.includes('Not yet'), false);
  const storage = memoryStore();
  assert.deepEqual(readSeen(storage), []);
  writeSeen(storage, ['rego']);
  assert.deepEqual(readSeen(storage), ['rego']);
  assert.equal(storage.getItem(REMINDER_SEEN_KEY), '["rego"]');
  assert.deepEqual(selectReminders(data, readSeen(storage), now).map(item => item.id), ['medical']);
  writeSeen(storage, ['rego', 'medical', 'medical']);
  assert.deepEqual(selectReminders(data, readSeen(storage), now), []);

  const fresh = memoryStore();
  const session = reminderSession();
  assert.deepEqual(session.visible(data, fresh, now).map(item => item.id), ['rego', 'medical']);
  assert.deepEqual(readSeen(fresh).sort(), ['medical', 'rego']);
  assert.deepEqual(session.visible(data, fresh, now).map(item => item.id), ['rego', 'medical']);
  session.dismiss('rego', fresh);
  assert.deepEqual(session.visible(data, fresh, now).map(item => item.id), ['medical']);
  const nextVisit = reminderSession();
  assert.deepEqual(nextVisit.visible(data, fresh, now), []);
});

test('the month calendar marks event days and the list is a compact grid', () => {
  const now = new Date('2026-11-08T10:00:00+11:00');
  assert.deepEqual(eventYmds(show, 'Australia/Sydney'), ['2026-11-14']);
  assert.deepEqual(eventYmds({ id: 'reunion', title: 'Reunion', start: '2026-11-14', end: '2026-11-15' }, 'Australia/Sydney'), ['2026-11-14', '2026-11-15']);
  const html = calendarHtml(feed({ upcoming: [show, yard] }), { now, year: 2026, month: 11, selected: '2026-11-14' });
  assert.match(html, /November 2026/);
  assert.match(html, /data-cal-nav="-1"/);
  assert.match(html, /data-cal-nav="1"/);
  assert.match(html, /class="ev-cal-day ev-cal-today" data-cal-day="2026-11-08"/);
  assert.match(html, /class="ev-cal-day ev-cal-has ev-cal-on" data-cal-day="2026-11-14"/);
  assert.match(html, /ev-cal-dot/);
  assert.match(html, /data-cal-all(?! hidden)/);
  const cleared = calendarHtml(feed({ upcoming: [show] }), { now, year: 2026, month: 11 });
  assert.match(cleared, /data-cal-all hidden/);
  const beforeFirst = html.split('data-cal-day="2026-11-01"')[0];
  assert.equal((beforeFirst.match(/ev-cal-pad/g) || []).length, 6);
  const page = eventsHtml(feed({ upcoming: [show] }), { now, year: 2026, month: 11 });
  assert.match(page, /class="ev-cal"/);
  assert.match(page, /data-ev-days="2026-11-14"/);
  assert.match(index, /\.ev-list\{[^}]*display:grid[^}]*grid-template-columns:1fr 1fr/);
  assert.match(index, /@media\(max-width:339px\)\{\.ev-list\{grid-template-columns:1fr\}/);
  assert.match(app, /data-cal-nav/);
  assert.match(app, /data-cal-day/);
  assert.match(app, /data-cal-all/);
  assert.match(app, /selectEventDay/);
  const personal = calendarHtml(null, {
    now, year: 2026, month: 11,
    mineItems: [
      { date: '2026-11-20', kind: 'reminder', id: 'lic1', label: 'Driver licence' },
      { date: '2026-11-22', kind: 'site', id: 'gate1', label: 'North gate' }
    ]
  });
  assert.match(personal, /data-cal-day="2026-11-20"[^>]*data-mine="reminder:lic1"/);
  assert.match(personal, /data-mine="site:gate1"/);
  assert.match(personal, /ev-cal-mine-day/);
  assert.match(personal, /Your dates/);
  assert.match(personal, /Public dates/);
  const phone = fs.readFileSync(path.join(root, 'public/phone-ui.js'), 'utf8');
  assert.equal(phone.includes('mineDays: []'), false);
  assert.match(phone, /kind: 'reminder'/);
  assert.match(phone, /kind: 'site'/);
  assert.match(app, /function openMineFromCalendar/);
  assert.match(app, /go\('sit'\)/);
  assert.match(index, /\.ev-cal-mine\{[^}]*background:#F5A524/);
});

test('the events tab is in the public nav and the page polls on open', () => {
  assert.match(index, /src="\/events\.js"/);
  assert.match(index, /id="ev-notes"/);
  assert.match(app, /\['mag','📰 Newsletter','Newsletter'\],\['pod','🎧 Podcast','Podcast'\],\['evt','📅 Events','Events'\],\['sta','📊 Stats','Stats'\],\['sit','My Sites','My Sites & Inductions'\]/);
  assert.match(app, /else if\(V\.view=='evt'\)\{eventsView\(\)\}/);
  assert.match(app, /if\(v==='evt'\)refreshEvents\(\)/);
  assert.match(app, /refreshEvents\(\);refreshStats\(\)/);
  assert.match(app, /setInterval\(\(\)=>\{refreshEvents\(\);refreshStats\(\)\},every\)/);
  assert.match(app, /loadEvents\(\{storage:localStorage\}\)/);
  assert.match(app, /EVENTS_POLL_MS/);
  assert.match(app, /data-dismiss/);
  assert.match(app, /reminderSession\(/);
  assert.match(app, /evSession\.dismiss/);
  assert.match(app, /querySelector\('\.contact-us'\)/);
  assert.match(app, /contact\.hidden=V\.view==='evt'\|\|V\.view==='pod'/);
  assert.match(index, /\.ev-cat\{[^}]*background:#1877F2/);
  assert.match(index, /\.events-card \.btn\{[^}]*background:#1877F2/);
  assert.match(index, /\.ev-dismiss:hover\{[^}]*background:#166FE5/);
  assert.equal(/\.ev-banner\{[^}]*#C80813/.test(index), false);
  assert.match(server, /connect-src 'self' https:\/\/tdaau\.com/);
  assert.equal(EVENTS_CACHE_KEY, 'rh-events');
});

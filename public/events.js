(function (root) {
const EVENTS_URL = 'https://tdaau.com/events.json';
const STATS_URL = 'https://tdaau.com/stats.json';
const CALENDAR_URL = 'https://tdaau.com/events.ics';
const EVENTS_POLL_MS = 15 * 60 * 1000;
const EVENTS_CACHE_KEY = 'rh-events';
const REMINDER_SEEN_KEY = 'rh-event-reminders';
const SITE = 'https://tdaau.com';

function text(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function callFetch(fetchImpl, url) {
  const doFetch = fetchImpl || function (href, options) { return fetch(href, options); };
  return doFetch(url, { cache: 'no-store' });
}

function storageGet(storage, key) {
  if (!storage) return null;
  try { return storage.getItem(key); } catch (e) { return null; }
}

function storageSet(storage, key, value) {
  if (!storage) return false;
  try { storage.setItem(key, value); return true; } catch (e) { return false; }
}

function safeZone(timeZone) {
  const zone = text(timeZone) || 'Australia/Sydney';
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: zone }).format(new Date());
    return zone;
  } catch (e) {
    return 'Australia/Sydney';
  }
}

function tzOffsetMs(timeZone, utcMs) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = {};
  fmt.formatToParts(new Date(utcMs)).forEach(part => { parts[part.type] = part.value; });
  let hour = +parts.hour;
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function zonedDate(year, month, day, hour, minute, second, ms, timeZone) {
  const zone = safeZone(timeZone);
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const guess = utc - tzOffsetMs(zone, utc);
  return new Date(utc - tzOffsetMs(zone, guess));
}

function ymdInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: safeZone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(date);
}

function formatDay(ymd) {
  const match = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], 12));
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }).format(date);
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-AU', { timeZone: safeZone(timeZone), hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatStamp(date, timeZone) {
  const zone = safeZone(timeZone);
  const day = new Intl.DateTimeFormat('en-AU', {
    timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }).format(date);
  return day + ', ' + formatTime(date, zone);
}

function isYearly(value) {
  if (value === true || value === 1) return true;
  const flag = text(value).toLowerCase();
  return flag === 'true' || flag === 'yes' || flag === '1';
}

function isEventsPayload(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
  return Array.isArray(json.upcoming) || Array.isArray(json.recent) || Array.isArray(json.reminders);
}

function cleanEvent(item) {
  if (!item || typeof item !== 'object') return null;
  const id = text(item.id);
  const title = text(item.title);
  if (!id && !title) return null;
  const event = {
    id, title,
    start: text(item.start),
    end: text(item.end),
    location: text(item.location),
    description: text(item.description),
    link: text(item.link),
    url: text(item.url),
    updated: text(item.updated)
  };
  const category = text(item.category);
  if (category) event.category = category;
  return event;
}

function cleanReminder(item) {
  if (!item || typeof item !== 'object') return null;
  const id = text(item.id);
  const message = text(item.message);
  if (!id || !message) return null;
  return {
    id,
    reminder_id: text(item.reminder_id),
    message,
    show_from: text(item.show_from),
    show_until: text(item.show_until),
    yearly: isYearly(item.yearly),
    link: text(item.link)
  };
}

function parseEvents(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    generated: text(data.generated),
    timezone: safeZone(data.timezone),
    upcoming: (Array.isArray(data.upcoming) ? data.upcoming : []).map(cleanEvent).filter(Boolean),
    recent: (Array.isArray(data.recent) ? data.recent : []).map(cleanEvent).filter(Boolean),
    reminders: (Array.isArray(data.reminders) ? data.reminders : []).map(cleanReminder).filter(Boolean)
  };
}

function emptyEvents() {
  return parseEvents({ timezone: 'Australia/Sydney', upcoming: [], recent: [], reminders: [] });
}

function readCache(storage) {
  const raw = storageGet(storage, EVENTS_CACHE_KEY);
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    if (!isEventsPayload(json)) return null;
    return parseEvents(json);
  } catch (e) {
    return null;
  }
}

function writeCache(storage, data) {
  return storageSet(storage, EVENTS_CACHE_KEY, JSON.stringify(parseEvents(data)));
}

async function loadEvents(opts) {
  const o = opts || {};
  try {
    const res = await callFetch(o.fetch, EVENTS_URL);
    if (!res || !res.ok) throw new Error('status');
    const json = await res.json();
    if (!isEventsPayload(json)) throw new Error('shape');
    const data = parseEvents(json);
    writeCache(o.storage, data);
    return { data, fromCache: false, failed: false };
  } catch (e) {
    const cached = readCache(o.storage);
    if (cached) return { data: cached, fromCache: true, failed: true };
    return { data: emptyEvents(), fromCache: false, failed: true };
  }
}

function absoluteHttp(value) {
  const href = text(value);
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return SITE + href;
  return '';
}

function isIcs(url) {
  return /\.ics(?:$|[?#])/i.test(String(url || ''));
}

function eventActions(event) {
  const link = absoluteHttp(event && event.link);
  const url = absoluteHttp(event && event.url);
  const perEvent = isIcs(link) ? link : (isIcs(url) ? url : '');
  const page = url && !isIcs(url) ? url : (link && !isIcs(link) ? link : '');
  return { calendar: perEvent || CALENDAR_URL, perEvent, subscribe: CALENDAR_URL, page };
}

function startMs(event, timeZone) {
  const raw = text(event && event.start);
  if (!raw) return Infinity;
  const day = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return zonedDate(+day[1], +day[2], +day[3], 0, 0, 0, 0, timeZone).getTime();
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? Infinity : time;
}

function orderEvents(list, timeZone, newestFirst) {
  return list.map((event, index) => ({ event, index, ms: startMs(event, timeZone) })).sort((a, b) => {
    const aMissing = a.ms === Infinity;
    const bMissing = b.ms === Infinity;
    if (aMissing || bMissing) return (aMissing - bMissing) || (a.index - b.index);
    return (newestFirst ? b.ms - a.ms : a.ms - b.ms) || (a.index - b.index);
  }).map(row => row.event);
}

function formatEventWhen(event, timeZone) {
  const zone = safeZone(timeZone);
  const startRaw = text(event && event.start);
  if (!startRaw) return '';
  const endRaw = text(event && event.end);
  const startDay = /^\d{4}-\d{2}-\d{2}$/.test(startRaw);
  const endDay = /^\d{4}-\d{2}-\d{2}$/.test(endRaw);
  if (startDay && (!endRaw || endDay)) {
    const startText = formatDay(startRaw);
    if (!endRaw || endRaw === startRaw) return startText;
    return startText + ' – ' + formatDay(endRaw);
  }
  const start = startDay ? zonedDate(+startRaw.slice(0, 4), +startRaw.slice(5, 7), +startRaw.slice(8, 10), 0, 0, 0, 0, zone) : new Date(startRaw);
  if (Number.isNaN(start.getTime())) return startRaw;
  let when = formatStamp(start, zone);
  if (!endRaw) return when;
  const end = endDay ? zonedDate(+endRaw.slice(0, 4), +endRaw.slice(5, 7), +endRaw.slice(8, 10), 0, 0, 0, 0, zone) : new Date(endRaw);
  if (Number.isNaN(end.getTime()) || end.getTime() === start.getTime()) return when;
  const sameDay = ymdInZone(start, zone) === ymdInZone(end, zone);
  return when + ' – ' + (sameDay ? formatTime(end, zone) : formatStamp(end, zone));
}

function eventCard(event, timeZone) {
  const actions = eventActions(event);
  const when = formatEventWhen(event, timeZone);
  const title = event.title || 'Event';
  const heading = actions.page
    ? `<a href="${esc(actions.page)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`
    : esc(title);
  const where = event.location ? `<p class="ev-loc">${esc(event.location)}</p>` : '';
  const badge = event.category ? `<span class="ev-cat">${esc(event.category)}</span>` : '';
  const about = event.description ? `<p class="ev-desc">${esc(event.description)}</p>` : '';
  return `<article class="ev-item" data-event-id="${esc(event.id)}">${when ? `<p class="ev-when">${esc(when)}</p>` : ''}<h4>${heading}</h4>${where}${badge}${about}<div class="ev-actions"><a class="btn" href="${esc(actions.calendar)}">Add to my calendar</a></div></article>`;
}

function eventsHtml(data, status) {
  const pack = parseEvents(data);
  const st = status || {};
  const zone = pack.timezone;
  const upcoming = orderEvents(pack.upcoming, zone, false);
  const recent = orderEvents(pack.recent, zone, true);
  let state = '';
  if (st.loading) state = '<p class="mut">Loading events…</p>';
  else if (st.failed && !st.fromCache) state = '<p class="mut">Events will show here when the list can be reached.</p>';
  else if (!upcoming.length) state = '<p class="mut">No upcoming events yet.</p>';
  const saved = st.fromCache ? '<p class="sub">Showing the last saved list.</p>' : '';
  const upcomingHtml = upcoming.map(event => eventCard(event, zone)).join('');
  const recentHtml = recent.length
    ? `<h4 class="ev-recent-head">Recent</h4><div class="ev-list ev-recent">${recent.map(event => eventCard(event, zone)).join('')}</div>`
    : '';
  return `<section class="card events-card"><h3>Events</h3><p class="sub">Times use ${esc(zone)}.</p><p class="ev-sub"><a class="btn" href="${esc(CALENDAR_URL)}">Subscribe to the calendar</a></p>${saved}${state}${upcomingHtml ? `<div class="ev-list">${upcomingHtml}</div>` : ''}${recentHtml}</section>`;
}

function nextDay(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
}

function boundInstant(value, edge, timeZone) {
  const raw = text(value);
  if (!raw) return null;
  const day = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) {
    const year = +day[1], month = +day[2], date = +day[3];
    if (edge === 'end') {
      const next = nextDay(year, month, date);
      return new Date(zonedDate(next[0], next[1], next[2], 0, 0, 0, 0, timeZone).getTime() - 1);
    }
    return zonedDate(year, month, date, 0, 0, 0, 0, timeZone);
  }
  const time = new Date(raw);
  return Number.isNaN(time.getTime()) ? null : time;
}

function ymdInWindow(today, from, until, yearly) {
  if (!yearly) return today >= from && today <= until;
  const t = today.slice(5), a = from.slice(5), b = until.slice(5);
  if (a <= b) return t >= a && t <= b;
  return t >= a || t <= b;
}

function addUtcYears(date, years) {
  const next = new Date(date.getTime());
  const month = next.getUTCMonth();
  next.setUTCFullYear(next.getUTCFullYear() + years);
  if (next.getUTCMonth() !== month) next.setUTCDate(0);
  return next;
}

function yearlyInstant(at, from, until) {
  const span = until.getUTCFullYear() - from.getUTCFullYear();
  const base = at.getUTCFullYear();
  for (let year = base - Math.max(span, 0) - 1; year <= base + 1; year++) {
    const delta = year - from.getUTCFullYear();
    const start = addUtcYears(from, delta);
    const end = addUtcYears(until, delta);
    if (at.getTime() >= start.getTime() && at.getTime() <= end.getTime()) return true;
  }
  return false;
}

function reminderActive(reminder, now, timeZone) {
  if (!reminder) return false;
  const zone = safeZone(timeZone);
  const at = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(at.getTime())) return false;
  const fromRaw = text(reminder.show_from);
  const untilRaw = text(reminder.show_until);
  if (!fromRaw || !untilRaw) return false;
  const yearly = isYearly(reminder.yearly);
  const fromDay = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw);
  const untilDay = /^\d{4}-\d{2}-\d{2}$/.test(untilRaw);
  if (fromDay && untilDay) return ymdInWindow(ymdInZone(at, zone), fromRaw, untilRaw, yearly);
  const from = boundInstant(fromRaw, 'start', zone);
  const until = boundInstant(untilRaw, 'end', zone);
  if (!from || !until || until.getTime() < from.getTime()) return false;
  if (!yearly) return at.getTime() >= from.getTime() && at.getTime() <= until.getTime();
  return yearlyInstant(at, from, until);
}

function readSeen(storage) {
  const raw = storageGet(storage, REMINDER_SEEN_KEY);
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.map(id => text(id)).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

function writeSeen(storage, ids) {
  const unique = [];
  (ids || []).forEach(id => {
    const clean = text(id);
    if (clean && !unique.includes(clean)) unique.push(clean);
  });
  return storageSet(storage, REMINDER_SEEN_KEY, JSON.stringify(unique));
}

function selectReminders(data, seen, now) {
  const pack = parseEvents(data);
  const skip = new Set((seen || []).map(id => text(id)).filter(Boolean));
  return pack.reminders.filter(reminder => reminder.id && !skip.has(reminder.id) && reminderActive(reminder, now, pack.timezone));
}

function reminderSession() {
  const showing = new Set();
  return {
    visible(data, storage, now) {
      const stored = readSeen(storage);
      const kept = new Set([...showing]);
      const rows = selectReminders(data, stored.filter(id => !kept.has(id)), now);
      rows.forEach(reminder => showing.add(reminder.id));
      writeSeen(storage, stored.concat(rows.map(reminder => reminder.id)));
      return rows;
    },
    dismiss(id, storage) {
      const clean = text(id);
      showing.delete(clean);
      const stored = readSeen(storage);
      if (clean && !stored.includes(clean)) writeSeen(storage, stored.concat(clean));
    }
  };
}

function remindersHtml(rows) {
  return (rows || []).map(reminder => {
    const href = absoluteHttp(reminder.link);
    const open = href ? `<a class="ev-open" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open</a>` : '';
    return `<div class="ev-banner" role="status"><p>${esc(reminder.message)}</p>${open}<button type="button" class="ev-dismiss" data-dismiss="${esc(reminder.id)}">Dismiss</button></div>`;
  }).join('');
}

function visibleStats(raw) {
  const list = raw && typeof raw === 'object' && Array.isArray(raw.stats) ? raw.stats : [];
  const cards = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const label = text(item.label);
    const value = item.value == null ? '' : String(item.value).trim();
    if (!label && !value) return;
    const orderRaw = item.order;
    const order = orderRaw === '' || orderRaw == null || !Number.isFinite(Number(orderRaw)) ? Infinity : Number(orderRaw);
    cards.push({ key: text(item.key), label, value, note: text(item.note), order, index });
  });
  cards.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.index - b.index));
  return cards;
}

function statsHtml(raw) {
  const cards = visibleStats(raw);
  if (!cards.length) return '';
  const body = cards.map(card => {
    const note = card.note ? `<p class="stat-note">${esc(card.note)}</p>` : '';
    return `<article class="stat-card" data-stat="${esc(card.key)}"><p class="stat-value">${esc(card.value)}</p><p class="stat-label">${esc(card.label)}</p>${note}</article>`;
  }).join('');
  return `<section class="stats-strip" id="stats-strip" aria-label="By the numbers"><h3 class="stats-head">By the numbers</h3><div class="stats-row">${body}</div></section>`;
}

async function loadStats(opts) {
  const o = opts || {};
  const empty = { generated: '', stats: [] };
  try {
    const res = await callFetch(o.fetch, STATS_URL);
    if (!res || !res.ok) return empty;
    const json = await res.json();
    if (!json || typeof json !== 'object' || Array.isArray(json) || !Array.isArray(json.stats)) return empty;
    return { generated: text(json.generated), stats: json.stats };
  } catch (e) {
    return empty;
  }
}

const api = {
  EVENTS_URL, STATS_URL, CALENDAR_URL, EVENTS_POLL_MS, EVENTS_CACHE_KEY, REMINDER_SEEN_KEY,
  parseEvents, loadEvents, readCache, writeCache, eventActions, formatEventWhen, eventsHtml,
  reminderActive, selectReminders, reminderSession, remindersHtml, readSeen, writeSeen,
  visibleStats, statsHtml, loadStats
};
Object.keys(api).forEach(key => { root[key] = api[key]; });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

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

function clock(date, zone) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(zone), hourCycle: 'h23', hour: '2-digit', minute: '2-digit'
  }).formatToParts(date).forEach(part => { parts[part.type] = part.value; });
  let hour = +parts.hour;
  if (hour === 24) hour = 0;
  return { hour, minute: +parts.minute };
}

function isMidnight(date, zone) {
  const time = clock(date, zone);
  return time.hour === 0 && time.minute === 0;
}

function plainDay(date, zone) {
  return formatDay(ymdInZone(date, zone)).replace(/,/g, '');
}

function allDayWhen(start, end, zone) {
  if (!end) return plainDay(start, zone) + ' · All day';
  const startYmd = ymdInZone(start, zone);
  const last = isMidnight(end, zone) ? new Date(end.getTime() - 1000) : end;
  const lastYmd = ymdInZone(last, zone);
  if (lastYmd === startYmd) return plainDay(start, zone) + ' · All day';
  return plainDay(start, zone) + ' – ' + plainDay(last, zone);
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
  const endDate = !endRaw ? null : endDay ? zonedDate(+endRaw.slice(0, 4), +endRaw.slice(5, 7), +endRaw.slice(8, 10), 0, 0, 0, 0, zone) : new Date(endRaw);
  if (!startDay && isMidnight(start, zone) && (!endDate || Number.isNaN(endDate.getTime()) || isMidnight(endDate, zone))) {
    return allDayWhen(start, endDate && !Number.isNaN(endDate.getTime()) ? endDate : null, zone);
  }
  let when = formatStamp(start, zone);
  if (!endRaw) return when;
  const end = endDate;
  if (Number.isNaN(end.getTime()) || end.getTime() === start.getTime()) return when;
  const sameDay = ymdInZone(start, zone) === ymdInZone(end, zone);
  return when + ' – ' + (sameDay ? formatTime(end, zone) : formatStamp(end, zone));
}

function ymdParts(ymd) {
  const match = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? [+match[1], +match[2], +match[3]] : null;
}

function padYmd(year, month, day) {
  return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function eventYmds(event, timeZone) {
  const zone = safeZone(timeZone);
  const startRaw = text(event && event.start);
  if (!startRaw) return [];
  const endRaw = text(event && event.end);
  const startDay = ymdParts(startRaw);
  const endDay = ymdParts(endRaw);
  let startYmd = '';
  let endYmd = '';
  if (startDay) startYmd = padYmd(startDay[0], startDay[1], startDay[2]);
  else {
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return [];
    startYmd = ymdInZone(start, zone);
  }
  if (!endRaw) endYmd = startYmd;
  else if (endDay) endYmd = padYmd(endDay[0], endDay[1], endDay[2]);
  else {
    const end = new Date(endRaw);
    endYmd = Number.isNaN(end.getTime()) ? startYmd : ymdInZone(end, zone);
  }
  if (endYmd < startYmd) endYmd = startYmd;
  const out = [];
  let cursor = ymdParts(startYmd);
  if (!cursor) return [];
  for (let i = 0; i < 370; i++) {
    const ymd = padYmd(cursor[0], cursor[1], cursor[2]);
    out.push(ymd);
    if (ymd >= endYmd) break;
    cursor = nextDay(cursor[0], cursor[1], cursor[2]);
  }
  return out;
}

function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= count; day++) cells.push({ day, ymd: padYmd(year, month, day) });
  while (cells.length % 7) cells.push(null);
  return cells;
}

function markedDays(data) {
  const pack = parseEvents(data);
  const days = new Set();
  pack.upcoming.concat(pack.recent).forEach(event => {
    eventYmds(event, pack.timezone).forEach(ymd => days.add(ymd));
  });
  return days;
}

const STD_STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const STD_KINDS = [['holiday', 'Holidays'], ['school', 'School holidays'], ['demerit', 'Double demerits'], ['daylight', 'Daylight saving']];

function defaultStdFilter() {
  return { state: 'ALL', kinds: { holiday: true, school: true, demerit: true, daylight: true } };
}
function readStdFilter(storage) {
  const filter = defaultStdFilter();
  try {
    const state = storage.getItem('rh-std-state') || 'ALL';
    if (STD_STATES.indexOf(state) >= 0) filter.state = state;
    const kinds = JSON.parse(storage.getItem('rh-std-kinds') || '');
    if (kinds && typeof kinds === 'object') STD_KINDS.forEach(pair => { if (typeof kinds[pair[0]] === 'boolean') filter.kinds[pair[0]] = kinds[pair[0]]; });
  } catch (e) {}
  return filter;
}
function writeStdFilter(storage, filter) {
  storage.setItem('rh-std-state', filter.state || 'ALL');
  storage.setItem('rh-std-kinds', JSON.stringify(filter.kinds || defaultStdFilter().kinds));
}
function filterStandardItems(items, filter) {
  const chosen = filter || defaultStdFilter();
  return (items || []).filter(item => item && chosen.kinds[item.kind] && (chosen.state === 'ALL' || item.state === chosen.state));
}
function itemsInMonth(items, year, month) {
  if (!year || !month) return items || [];
  const start = padYmd(year, month, 1);
  const end = padYmd(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
  return (items || []).filter(item => item.end >= start && item.start <= end);
}
function standardItemDays(items) {
  const days = [];
  (items || []).forEach(item => eventYmds({ start: item.start, end: item.end || item.start }).forEach(ymd => days.push(ymd)));
  return days;
}
function standardFilterHtml(filter) {
  const chosen = filter || defaultStdFilter();
  const states = STD_STATES.map(code => `<option value="${code}"${code === chosen.state ? ' selected' : ''}>${code === 'ALL' ? 'All' : code}</option>`).join('');
  const kinds = STD_KINDS.map(pair => `<label><input type="checkbox" data-std-kind="${pair[0]}"${chosen.kinds[pair[0]] ? ' checked' : ''}> ${pair[1]}</label>`).join('');
  return `<form class="std-filter"><label>State <select id="std-state">${states}</select></label>${kinds}</form>`;
}
function standardListHtml(items, status) {
  const st = status || {};
  if (!Array.isArray(st.standardItems)) return '';
  const notes = (st.standardNotes || []).filter(note => !note.kind || (st.stdFilter || defaultStdFilter()).kinds[note.kind]);
  const noteHtml = notes.map(note => `<p class="std-border">${esc(note.text)} <a href="${esc(note.source)}">Daylight saving rule</a></p>`).join('');
  const holiday = st.holidayNote ? `<p class="std-feed">${esc(st.holidayNote)}</p>` : '';
  const cards = (items || []).map(item => {
    const when = formatEventWhen({ start: item.start, end: item.end }, 'UTC');
    const days = eventYmds({ start: item.start, end: item.end || item.start }).join(' ');
    const kind = { holiday: 'Public holiday', school: 'School holidays', demerit: 'Double demerits', daylight: 'Daylight saving' }[item.kind] || item.kind;
    return `<article class="ev-item std-item" data-ev-days="${esc(days)}"><p class="std-kicker"><span class="std-state">${esc(item.state)}</span> ${esc(kind)}</p><h4>${esc(item.title)}</h4><p class="std-when">${esc(when)}</p>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}${item.note ? `<p>${esc(item.note)} <a href="${esc(item.noteSource)}">NHVR</a></p>` : ''}<p class="std-src"><a href="${esc(item.source)}">${esc(item.sourceLabel || 'Source')}</a></p></article>`;
  }).join('');
  const empty = cards ? '' : '<p class="mut">Nothing on this month for these filters.</p>';
  return `<h3 class="std-head">On this month</h3>${holiday}${noteHtml}${empty}${cards ? `<div class="ev-list">${cards}</div>` : ''}`;
}

function calendarHtml(data, opts) {
  const o = opts || {};
  const pack = parseEvents(data);
  const zone = pack.timezone;
  const now = o.now instanceof Date ? o.now : new Date();
  const today = ymdInZone(now, zone);
  const todayParts = ymdParts(today) || [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const year = Number(o.year) || todayParts[0];
  const month = Number(o.month) || todayParts[1];
  const selected = text(o.selected);
  const marks = markedDays(data);
  const standardDays = new Set(o.standardDays || []);
  const mineDays = new Set(o.mineDays || []);
  const mineByDay = {};
  (o.mineItems || []).forEach(item => {
    if (!item || !item.date || !item.id || !item.kind) return;
    if (!mineByDay[item.date]) mineByDay[item.date] = [];
    mineByDay[item.date].push(item);
    mineDays.add(item.date);
  });
  const title = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
  const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => `<span>${name}</span>`).join('');
  const cells = monthCells(year, month).map(cell => {
    if (!cell) return '<span class="ev-cal-pad"></span>';
    const classes = ['ev-cal-day'];
    if (cell.ymd === today) classes.push('ev-cal-today');
    if (marks.has(cell.ymd)) classes.push('ev-cal-has');
    if (standardDays.has(cell.ymd)) classes.push('ev-cal-std-day');
    if (mineDays.has(cell.ymd)) classes.push('ev-cal-mine-day');
    if (cell.ymd === selected) classes.push('ev-cal-on');
    const dots = [];
    if (marks.has(cell.ymd)) dots.push('<span class="ev-cal-dot" aria-hidden="true"></span>');
    if (standardDays.has(cell.ymd)) dots.push('<span class="ev-cal-std" aria-hidden="true"></span>');
    const mineHere = mineByDay[cell.ymd] || [];
    if (mineDays.has(cell.ymd)) dots.push('<span class="ev-cal-mine" aria-hidden="true"></span>');
    const dot = dots.length ? `<span class="ev-cal-marks">${dots.join('')}</span>` : '';
    const mineAttr = mineHere.length ? ` data-mine="${esc(mineHere.map(item => item.kind + ':' + item.id).join(' '))}"` : '';
    const mineLabel = mineHere.length ? ` aria-label="${esc(cell.ymd + ', ' + mineHere.map(item => item.label || 'Your date').join(', '))}"` : '';
    return `<button type="button" class="${classes.join(' ')}" data-cal-day="${cell.ymd}"${mineAttr}${mineLabel} aria-pressed="${cell.ymd === selected ? 'true' : 'false'}"><span class="ev-cal-num">${cell.day}</span>${dot}</button>`;
  }).join('');
  const showAll = `<button type="button" class="ev-cal-all" data-cal-all${selected ? '' : ' hidden'}>Show all</button>`;
  const key = `<ul class="ev-cal-key"><li><span class="ev-cal-dot"></span> Events</li><li><span class="ev-cal-mine"></span> Your dates</li><li><span class="ev-cal-std"></span> Public dates</li></ul>`;
  return `<div class="ev-cal" data-cal-month="${padYmd(year, month, 1).slice(0, 7)}"><div class="ev-cal-bar"><button type="button" class="ev-cal-nav" data-cal-nav="-1" aria-label="Previous month">‹</button><h4 class="ev-cal-title">${esc(title)}</h4><button type="button" class="ev-cal-nav" data-cal-nav="1" aria-label="Next month">›</button></div><div class="ev-cal-dow" aria-hidden="true">${week}</div><div class="ev-cal-grid">${cells}</div>${key}${showAll}</div>`;
}

function eventAbout(event) {
  let desc = text(event && event.description);
  const loc = text(event && event.location);
  const cat = text(event && event.category);
  if (!desc) return '';
  if (cat && loc) {
    const lead = new RegExp('^' + cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+in\\s+' + loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.?\\s*', 'i');
    desc = desc.replace(lead, '').trim();
  }
  return desc;
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
  const extra = eventAbout(event);
  const about = extra ? `<p class="ev-desc">${esc(extra)}</p>` : '';
  const days = eventYmds(event, timeZone).join(' ');
  return `<article class="ev-item" data-event-id="${esc(event.id)}" data-ev-days="${esc(days)}">${when ? `<p class="ev-when">${esc(when)}</p>` : ''}<h4>${heading}</h4>${where}${badge}${about}<div class="ev-actions"><a class="btn" href="${esc(actions.calendar)}">Add to my calendar</a></div></article>`;
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
  const filter = st.stdFilter || defaultStdFilter();
  const filtered = filterStandardItems(st.standardItems || [], filter);
  const monthItems = Array.isArray(st.standardItems) ? itemsInMonth(filtered, Number(st.year), Number(st.month)) : [];
  const cal = calendarHtml(data, { year: st.year, month: st.month, selected: st.selected || '', now: st.now instanceof Date ? st.now : new Date(), standardDays: Array.isArray(st.standardItems) ? standardItemDays(filtered) : (st.standardDays || []), mineDays: st.mineDays || [], mineItems: st.mineItems || [] });
  const extra = `${st.nearbyHtml || ''}${st.countdownHtml || ''}${standardFilterHtml(filter)}${cal}${standardListHtml(monthItems, st)}`;
  return `<section class="card events-card">${extra}<h3>Events</h3><p class="sub">Times use ${esc(zone)}.</p><p class="ev-sub"><a class="btn" href="${esc(CALENDAR_URL)}">Subscribe to the calendar</a></p>${saved}${state}<p class="mut ev-day-empty" hidden>No events on that day.</p>${upcomingHtml ? `<div class="ev-list">${upcomingHtml}</div>` : ''}${recentHtml}${st.personalHtml || ''}</section>`;
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

const PODCAST_PROFILE = 'https://soundcloud.com/the-drivers-advocate-podcast';
const PODCAST_FEED = 'https://feeds.soundcloud.com/users/soundcloud:users:877172068/sounds.rss';
const GROUP_STATS = [];
const FACEBOOK_URL = 'https://tdaau.com/facebook.json';
const FACEBOOK_API = '/api/facebook';
const FACEBOOK_CACHE_KEY = 'rh-facebook';
const PODCAST_LINKS = [
  { name: 'SoundCloud', href: PODCAST_PROFILE },
  { name: 'Pocket Casts', href: 'pktc://subscribe/' + PODCAST_FEED },
  { name: 'Overcast', href: 'overcast://x-callback-url/add?url=' + encodeURIComponent(PODCAST_FEED) }
];
const HOUR_WINDOWS = [
  { id: 'month', label: 'Last month', months: 1 },
  { id: '6', label: 'Last 6 months', months: 6 },
  { id: '12', label: 'Last 12 months', months: 12 },
  { id: '24', label: 'Last 24 months', months: 24 },
  { id: 'all', label: 'All time', months: 0 }
];

function durationSeconds(value) {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.round(Number(raw));
  const parts = raw.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(part => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

function sydneyParts(ms) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(ms));
  const pick = type => +parts.find(part => part.type === type).value;
  return { y: pick('year'), m: pick('month'), d: pick('day') };
}

function ymdKey(part) {
  return String(part.y).padStart(4, '0') + '-' + String(part.m).padStart(2, '0') + '-' + String(part.d).padStart(2, '0');
}

function shiftMonths(part, delta) {
  const base = new Date(Date.UTC(part.y, part.m - 1 + delta, 1));
  const days = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: Math.min(part.d, days) };
}

function formatYmd(part) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(Date.UTC(part.y, part.m - 1, part.d, 3)));
}

function formatHours(seconds) {
  const hours = (Number(seconds) || 0) / 3600;
  const rounded = Math.round(hours * 10) / 10;
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return shown + (rounded === 1 ? ' hour' : ' hours');
}

function missingNote(missing) {
  if (!missing) return '';
  if (missing === 1) return '1 episode has no length listed, so it is not in this total.';
  return missing + ' episodes have no length listed, so they are not in this total.';
}

function podcastHourRows(episodes, now) {
  const when = now instanceof Date ? now : new Date(now || Date.now());
  const today = sydneyParts(when.getTime());
  const todayKey = ymdKey(today);
  const dated = (Array.isArray(episodes) ? episodes : [])
    .filter(item => item && text(item.h || item.title) && Number(item.at) > 0)
    .map(item => ({ item, key: ymdKey(sydneyParts(Number(item.at))) }));
  return HOUR_WINDOWS.map(win => {
    let start = win.months ? shiftMonths(today, -win.months) : null;
    if (!start) {
      const oldest = dated.reduce((min, row) => row.key < min ? row.key : min, '9999-99-99');
      if (oldest !== '9999-99-99') start = { y: +oldest.slice(0, 4), m: +oldest.slice(5, 7), d: +oldest.slice(8, 10) };
    }
    const startKey = start ? ymdKey(start) : '';
    const picked = dated.filter(row => (!startKey || row.key >= startKey) && row.key <= todayKey);
    let seconds = 0;
    let missing = 0;
    picked.forEach(row => {
      const length = durationSeconds(row.item.dur);
      if (length == null) missing += 1;
      else seconds += length;
    });
    return {
      id: win.id,
      label: win.label,
      since: start ? 'Since ' + formatYmd(start) : '',
      episodes: picked.length,
      seconds: picked.length && missing === picked.length ? null : seconds,
      missing
    };
  });
}

function podcastHoursHtml(rows) {
  const body = (rows || []).map(row => {
    const note = row.missing ? `<p class="stat-note">${esc(missingNote(row.missing))}</p>` : '';
    const hours = !row.episodes ? '0 hours' : (row.seconds == null ? 'Not listed' : formatHours(row.seconds));
    return `<tr><th scope="row">${esc(row.label)}</th><td>${esc(row.since)}</td><td>${esc(row.episodes)}</td><td>${hours}${note}</td></tr>`;
  }).join('');
  return `<table class="pod-hours"><caption>Hours published</caption><thead><tr><th scope="col">Period</th><th scope="col">From</th><th scope="col">Episodes</th><th scope="col">Hours</th></tr></thead><tbody>${body}</tbody></table>`;
}

function podcastStats(episodes, summary) {
  const rows = (Array.isArray(episodes) ? episodes : []).filter(item => item && text(item.h || item.title));
  const sorted = rows.slice().sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
  const latest = sorted[0] || null;
  const oldest = sorted.length ? sorted[sorted.length - 1] : null;
  const extra = summary && typeof summary === 'object' ? summary : null;
  const periods = extra && Array.isArray(extra.periods) && extra.periods.length ? extra.periods : podcastHourRows(rows);
  const fromFeed = extra && extra.latest && text(extra.latest.title)
    ? { title: text(extra.latest.title), at: Number(extra.latest.at) || 0 }
    : (latest ? { title: text(latest.h || latest.title), at: Number(latest.at) || 0 } : null);
  const first = extra && extra.first && Number(extra.first.at) > 0
    ? { title: text(extra.first.title), at: Number(extra.first.at) || 0 }
    : (oldest ? { title: text(oldest.h || oldest.title), at: Number(oldest.at) || 0 } : null);
  return {
    total: extra && Number(extra.total) > 0 ? Number(extra.total) : rows.length,
    latest: fromFeed,
    first,
    periods,
    profile: PODCAST_PROFILE,
    links: PODCAST_LINKS,
    groups: GROUP_STATS
  };
}

function suppliedNumber(value) {
  const clean = text(value).replace(/[—–]/g, '').trim();
  if (!clean || clean === '-' || /^n\/?a$/i.test(clean) || /^x$/i.test(clean)) return null;
  if (!/^[\d,]+(\.\d+)?$/.test(clean)) return null;
  return clean;
}

function facebookStatList(raw) {
  const source = raw && Array.isArray(raw.stats) ? raw.stats : (Array.isArray(raw) ? raw : []);
  const cards = [];
  source.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const value = suppliedNumber(item.value);
    const label = text(item.label);
    if (value == null || !label) return;
    const orderRaw = item.order;
    const order = orderRaw === '' || orderRaw == null || !Number.isFinite(Number(orderRaw)) ? index : Number(orderRaw);
    cards.push({ key: text(item.key) || label.toLowerCase(), label, value, note: text(item.note), order });
  });
  cards.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  return cards;
}

function normaliseGroups(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.groups) ? raw.groups : (raw && Array.isArray(raw.pages) ? raw.pages : []));
  const seen = new Set();
  const groups = [];
  list.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const name = text(item.name);
    const facebook = text(item.facebook || item.url || item.href);
    if (!name || !/^https:\/\/(www\.)?facebook\.com\//i.test(facebook)) return;
    const key = facebook.toLowerCase().replace(/\/+$/, '');
    if (seen.has(key)) return;
    seen.add(key);
    const members = suppliedNumber(item.members);
    groups.push(members == null ? { name, facebook } : { name, facebook, members });
  });
  return groups;
}

function shopLink() {
  const href = typeof root.SHOP_URL === 'string' ? root.SHOP_URL.trim() : '';
  if (!/^https:\/\//i.test(href)) return '';
  return `<p class="shop-row"><a class="tool-pill" href="${esc(href)}" target="_blank" rel="noopener noreferrer">TDA Shop</a></p>`;
}

function facebookCommunityHtml(groups, stats) {
  const cards = facebookStatList(stats && stats.stats ? stats : { stats: stats || [] });
  const statBlock = cards.map(card => {
    const note = card.note ? `<p class="stat-note">${esc(card.note)}</p>` : '';
    return `<article class="stat-tile" data-stat="${esc(card.key)}"><p class="stat-value">${esc(card.value)}</p><p class="stat-label">${esc(card.label)}</p>${note}</article>`;
  }).join('');
  const rows = normaliseGroups(groups).map(group => {
    const count = group.members ? `<span class="fb-count">${esc(group.members)}</span>` : '';
    return `<a class="fb-row" href="${esc(group.facebook)}" target="_blank" rel="noopener noreferrer"><span class="fb-name">${esc(group.name)}</span>${count}<span class="fb-go">Open</span></a>`;
  }).join('');
  const numbers = statBlock ? `<div class="stat-grid fb-stats">${statBlock}</div>` : '';
  const list = rows ? `<div class="fb-list">${rows}</div>` : '<p class="mut">Groups will show here when the list can be reached.</p>';
  return `<section class="card fb-community"><h3>Our Facebook community</h3>${shopLink()}${numbers}${list}</section>`;
}

async function loadFacebook(opts) {
  const o = opts || {};
  const storage = o.storage;
  let groups = [];
  let stats = [];
  async function read(url) {
    const res = await callFetch(o.fetch, url);
    if (!res || !res.ok) return null;
    return res.json();
  }
  try {
    const json = await read(FACEBOOK_URL);
    if (json) {
      groups = normaliseGroups(json);
      stats = facebookStatList(json);
    }
  } catch (e) {}
  if (!groups.length) {
    try {
      const json = await read(FACEBOOK_API);
      if (json) {
        groups = normaliseGroups(json);
        if (!stats.length) stats = facebookStatList(json);
      }
    } catch (e) {}
  }
  if (groups.length) {
    storageSet(storage, FACEBOOK_CACHE_KEY, JSON.stringify({ groups, stats }));
    return { groups, stats };
  }
  try {
    const cached = JSON.parse(storageGet(storage, FACEBOOK_CACHE_KEY) || 'null');
    const cachedGroups = normaliseGroups(cached);
    if (cachedGroups.length) return { groups: cachedGroups, stats: facebookStatList(cached) };
  } catch (e) {}
  try {
    groups = normaliseGroups(await read('/advocate.json'));
  } catch (e) {}
  return { groups, stats: [] };
}

function formatStatDate(at) {
  const n = Number(at);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(n));
}

function cleanFirstName(value) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function thankYouText(name) {
  const clean = cleanFirstName(name);
  return clean
    ? 'Thank You ' + clean + ' for being part of a truly unique group'
    : 'Thank You for being part of a truly unique group';
}

function driverCountHtml(groupStats) {
  const count = groupStats && !Array.isArray(groupStats) ? Number(groupStats.drivers) : NaN;
  if (Number.isFinite(count) && count > 0) return `<p class="driver-count">You're one of ${esc(count)} drivers</p>`;
  return '';
}

function thankYouBlock(name, groupStats) {
  const saved = cleanFirstName(name);
  return `<div class="thanks-banner"><p class="thanks-line">${esc(thankYouText(saved))}</p>${driverCountHtml(groupStats)}<form class="name-ask" onsubmit="return saveFirstName(event)"><label>What's your first name? <input class="f" id="first-name" name="first-name" maxlength="40" autocomplete="given-name" value="${esc(saved)}"></label><button type="submit" class="btn stat-link">${saved ? 'Change name' : 'Save name'}</button></form></div>`;
}

function podcastStatsHtml(episodes, name, summary) {
  const info = podcastStats(episodes, summary);
  const thanks = thankYouBlock(name, info.groups);
  const links = `<div class="stat-actions">${(info.links || []).map(link => `<a class="btn stat-link" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">${esc(link.name)}</a>`).join('')}</div>`;
  const table = podcastHoursHtml(info.periods);
  if (!info.total || !info.latest) {
    return `<section class="card stats-page">${thanks}<h3>Podcast</h3><p class="mut">Episodes will show here when the feed can be reached.</p>${table}${links}</section>`;
  }
  const when = formatStatDate(info.latest.at);
  const firstWhen = info.first ? formatStatDate(info.first.at) : '';
  const all = (info.periods || []).find(row => row.id === 'all');
  const hoursTile = all && all.seconds > 0 ? `<article class="stat-tile"><p class="stat-value">${esc(formatHours(all.seconds).replace(/ hours?$/, ''))}</p><p class="stat-label">Listening hours</p></article>` : '';
  const firstTile = firstWhen ? `<article class="stat-tile"><p class="stat-label">First episode</p>${info.first.title ? `<p class="stat-title">${esc(info.first.title)}</p>` : ''}<p class="stat-note">${esc(firstWhen)}</p></article>` : '';
  return `<section class="card stats-page">${thanks}<h3>Podcast</h3><div class="stat-grid"><article class="stat-tile"><p class="stat-value">${esc(info.total)}</p><p class="stat-label">Episodes</p></article>${hoursTile}<article class="stat-tile"><p class="stat-label">Latest episode</p><p class="stat-title">${esc(info.latest.title)}</p>${when ? `<p class="stat-note">${esc(when)}</p>` : ''}</article>${firstTile}</div>${table}${links}</section>`;
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
  eventYmds, monthCells, calendarHtml, readStdFilter, writeStdFilter, filterStandardItems, standardItemDays, defaultStdFilter,
  reminderActive, selectReminders, reminderSession, remindersHtml, readSeen, writeSeen,
  visibleStats, statsHtml, loadStats,
  GROUP_STATS, PODCAST_PROFILE, PODCAST_FEED, podcastStats, podcastStatsHtml, podcastHourRows, durationSeconds, formatHours,
  thankYouText, driverCountHtml, cleanFirstName,
  FACEBOOK_URL, FACEBOOK_API, loadFacebook, facebookCommunityHtml, facebookStatList, suppliedNumber
};
Object.keys(api).forEach(key => { root[key] = api[key]; });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

'use strict';

const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOLIDAY_CSV_URL = 'https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/33673aca-0857-42e5-b8f0-9981b4755686/download/australian-public-holidays-combined-2021-2025.csv';
const ACT_CSV_URL = 'https://www.data.act.gov.au/api/views/4kcq-44ad/rows.csv?accessType=DOWNLOAD';
const DST_SOURCE = 'https://www.nsw.gov.au/about-nsw/daylight-saving';
const NHVR_URL = 'https://www.nhvr.gov.au/safety-accreditation-compliance/fatigue-management/counting-time/managing-fatigue-work-and-rest-requirements-under-daylight-saving-time';
const NHVR_NOTE = 'Work diary / EWD: record times in the time zone of your base, per the NHVR. Check your EWD has updated.';
const HOLIDAY_NOTE = 'Public holidays are from the Australian Government data.gov.au file, which stops at 2025. Later ACT public holidays are shown only when the ACT open-data calendar returns them.';
const DST_BORDER = 'Queensland, Western Australia and the Northern Territory do not change clocks. That matters if you cross a border.';
const DST_STATES = ['NSW', 'VIC', 'ACT', 'TAS', 'SA'];
const STATE_CODES = { act: 'ACT', nsw: 'NSW', vic: 'VIC', qld: 'QLD', sa: 'SA', wa: 'WA', tas: 'TAS', nt: 'NT' };

const SCHOOL_FILE = path.join(__dirname, 'data', 'school-holidays.json');
const DEMERIT_FILE = path.join(__dirname, 'data', 'double-demerits.json');
const CACHE_FILE = path.join(__dirname, 'data', 'standard-dates-cache.json');

let memory = null;

function pad(year, month, day) {
  return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map(cell => cell.trim());
  return rows.slice(1).filter(cells => cells.some(cell => String(cell || '').trim())).map(cells => {
    const obj = {};
    header.forEach((name, index) => { obj[name] = cells[index] == null ? '' : String(cells[index]).trim(); });
    return obj;
  });
}

function httpsUrl(value) {
  const href = String(value || '').trim();
  return /^https:\/\//i.test(href) ? href : '';
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function parseHolidayCsv(text) {
  return parseCsv(text).map(row => {
    const raw = String(row.Date || '');
    const state = STATE_CODES[String(row.Jurisdiction || '').toLowerCase()];
    const title = String(row['Holiday Name'] || '').trim();
    if (!/^\d{8}$/.test(raw) || !state || !title) return null;
    const start = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
    return {
      id: 'holiday-' + state + '-' + start + '-' + slug(title),
      kind: 'holiday',
      state,
      title,
      start,
      end: start,
      source: httpsUrl(row['More Information']) || HOLIDAY_CSV_URL,
      sourceLabel: 'data.gov.au Australian Public Holidays'
    };
  }).filter(Boolean);
}

function actYmd(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return '';
  const month = +match[1];
  const day = +match[2];
  const year = +match[3];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return pad(year, month, day);
}

function shiftYmd(ymd, delta) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length !== 3) return '';
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + delta);
  return pad(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseActCalendar(text) {
  const holidays = [];
  const school = [];
  const terms = [];
  parseCsv(text).forEach(row => {
    const ymd = actYmd(row.Date);
    const title = String(row['Term Information/Holiday Name'] || '').trim();
    if (!ymd || !title) return;
    const source = httpsUrl(row['website URL']) || 'https://www.act.gov.au/living-in-the-act/public-holidays-school-terms-and-daylight-saving';
    if (/pupil free/i.test(title)) {
      school.push({
        id: 'school-ACT-' + ymd + '-' + slug(title),
        kind: 'school',
        state: 'ACT',
        title,
        start: ymd,
        end: ymd,
        derived: false,
        source,
        sourceLabel: 'ACT open data calendar'
      });
      return;
    }
    if (/term/i.test(title)) {
      const role = /ends/i.test(title) ? 'end' : (/begins/i.test(title) ? 'start' : '');
      if (role) terms.push({ ymd, role, title });
      return;
    }
    holidays.push({
      id: 'holiday-ACT-' + ymd + '-' + slug(title),
      kind: 'holiday',
      state: 'ACT',
      title,
      start: ymd,
      end: ymd,
      source,
      sourceLabel: 'ACT open data calendar'
    });
  });
  terms.sort((a, b) => a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0);
  terms.forEach((row, index) => {
    if (row.role !== 'end') return;
    let next = index + 1;
    while (next < terms.length && terms[next].role !== 'start' && terms[next].role !== 'end') next++;
    if (next >= terms.length || terms[next].role !== 'start') return;
    const start = shiftYmd(row.ymd, 1);
    const end = shiftYmd(terms[next].ymd, -1);
    if (!start || !end || start > end) return;
    school.push({
      id: 'school-ACT-' + start + '-' + end,
      kind: 'school',
      state: 'ACT',
      title: 'School holidays',
      start,
      end,
      derived: true,
      detail: 'Derived from ACT term dates (' + row.title + ' to ' + terms[next].title + ').',
      source: 'https://www.act.gov.au/living-in-the-act/public-holidays-school-terms-and-daylight-saving',
      sourceLabel: 'ACT open data calendar'
    });
  });
  return { holidays, school };
}

function firstSunday(year, month) {
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = weekday === 0 ? 1 : 8 - weekday;
  return pad(year, month, day);
}

function inWindow(ymd, now) {
  const at = Date.parse(ymd + 'T00:00:00Z');
  const start = now.getTime() - 365 * DAY_MS;
  const end = now.getTime() + 730 * DAY_MS;
  return at >= start && at <= end;
}

function daylightItems(now) {
  const when = now instanceof Date ? now : new Date(now);
  const year = when.getUTCFullYear();
  const items = [];
  for (let y = year - 1; y <= year + 3; y++) {
    [{ ymd: firstSunday(y, 10), end: false }, { ymd: firstSunday(y, 4), end: true }].forEach(row => {
      if (!inWindow(row.ymd, when)) return;
      DST_STATES.forEach(state => {
        items.push({
          id: 'daylight-' + state + '-' + (row.end ? 'end-' : 'start-') + row.ymd,
          kind: 'daylight',
          state,
          title: row.end ? 'Daylight saving ends' : 'Daylight saving starts',
          start: row.ymd,
          end: row.ymd,
          detail: row.end ? '3:00 am daylight time. Clocks move back to 2:00 am.' : '2:00 am local. Clocks move forward one hour.',
          source: DST_SOURCE,
          sourceLabel: 'NSW Government daylight saving',
          note: NHVR_NOTE,
          noteSource: NHVR_URL
        });
      });
    });
  }
  return items;
}

function fileItems(file, kind) {
  const periods = file && Array.isArray(file.periods) ? file.periods : [];
  return periods.map(row => ({
    id: [kind, row.state, row.start, row.end, slug(row.title), slug(row.division || '')].filter(Boolean).join('-'),
    kind,
    state: row.state,
    title: row.title,
    start: row.start,
    end: row.end,
    detail: [row.division, row.detail].filter(Boolean).join('. '),
    derived: !!row.derived,
    source: row.source,
    sourceLabel: kind === 'school' ? 'Official school calendar' : 'Official demerit page'
  })).filter(item => item.state && item.start && item.end && item.title && item.start <= item.end);
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = [item.kind, item.state, item.start, item.end, String(item.title || '').toLowerCase(), item.detail || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { periods: [] }; }
}

async function fetchText(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { accept: 'text/csv,*/*' } });
  if (!res || !res.ok) throw new Error('status');
  return res.text();
}

async function readCache(opts) {
  if (opts && Object.prototype.hasOwnProperty.call(opts, 'cache')) return opts.cache;
  if (memory) return memory;
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); }
  catch (e) { return null; }
}

async function writeCache(opts, payload) {
  memory = payload;
  if (opts && opts.writeCache) return opts.writeCache(payload);
  if (opts && opts.cache !== undefined && !opts.persist) return payload;
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload));
  } catch (e) { /* keep the in-memory copy */ }
  return payload;
}

async function loadStandardDates(opts) {
  const options = opts || {};
  const now = options.now instanceof Date ? options.now : new Date();
  const fetchImpl = options.fetch || global.fetch;
  const cache = await readCache(options);
  const fresh = cache && cache.fetchedAt && (now.getTime() - Date.parse(cache.fetchedAt) < DAY_MS) && Array.isArray(cache.holidays);
  let holidays = fresh ? cache.holidays : null;
  let act = fresh ? (cache.act || { holidays: [], school: [] }) : null;
  let stale = false;
  if (!holidays) {
    try {
      const holidayCsv = await fetchText(fetchImpl, HOLIDAY_CSV_URL);
      let actCsv = '';
      try { actCsv = await fetchText(fetchImpl, ACT_CSV_URL); } catch (e) { actCsv = ''; }
      holidays = parseHolidayCsv(holidayCsv);
      act = actCsv ? parseActCalendar(actCsv) : ((cache && cache.act) || { holidays: [], school: [] });
      if (!actCsv && cache && cache.act) stale = true;
      await writeCache(options, { fetchedAt: now.toISOString(), holidays, act });
    } catch (e) {
      stale = true;
      holidays = (cache && cache.holidays) || [];
      act = (cache && cache.act) || { holidays: [], school: [] };
    }
  }
  const schoolFile = options.school || readJson(options.schoolFile || SCHOOL_FILE);
  const demeritFile = options.demerit || readJson(options.demeritFile || DEMERIT_FILE);
  const items = dedupe([].concat(holidays, act.holidays || [], fileItems(schoolFile, 'school'), act.school || [], fileItems(demeritFile, 'demerit'), daylightItems(now)));
  return {
    fetchedAt: (fresh && cache.fetchedAt) || now.toISOString(),
    stale,
    holidayNote: HOLIDAY_NOTE,
    schoolNote: schoolFile.note || '',
    demeritNote: demeritFile.note || '',
    notes: [{ kind: 'daylight', text: DST_BORDER, source: DST_SOURCE }],
    items
  };
}

function mount(app) {
  app.get('/api/standard-dates', (req, res) => {
    loadStandardDates().then(body => res.json(body)).catch(() => {
      res.json({ items: [], notes: [], stale: true, holidayNote: HOLIDAY_NOTE });
    });
  });
}

module.exports = {
  HOLIDAY_CSV_URL, ACT_CSV_URL, DST_SOURCE, NHVR_URL, NHVR_NOTE, HOLIDAY_NOTE, DST_BORDER, DST_STATES,
  parseCsv, parseHolidayCsv, parseActCalendar, firstSunday, daylightItems, fileItems, loadStandardDates, mount
};

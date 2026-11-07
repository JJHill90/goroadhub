(function (root) {
'use strict';

const MY_REMINDERS_KEY = 'rh-my-reminders';
const MY_SITES_KEY = 'rh-my-sites';
const MY_CONTACTS_KEY = 'rh-my-contacts';
const MY_EMPLOYERS_KEY = 'rh-my-employers';
const MY_INCIDENTS_KEY = 'rh-my-incidents';
const DRAFT_KEY = 'rh-incident-draft';
const W3W_KEY = 'rh-w3w-key';
const WARN_PRESETS = [30, 60, 90, 120, 160];
const NEAR_METRES = 1000;
const BACKUP_KIND = 'goroadhub-phone-backup';
const PHONE_NOTE = 'Saved on this phone only. Nothing is sent to an account or a server.';
const DISCLAIMER = 'Not a substitute for first aid training. Follow 000 operator instructions.';
const EMERGENCY_NOTE = 'Shows your GPS and what3words to read out to 000.';
const EMERGENCY_PAGE = 'https://emergencyapp.triplezero.gov.au/';
const IOS_APP = 'https://apps.apple.com/au/app/emergency-plus/id691814685';
const ANDROID_APP = 'https://play.google.com/store/apps/details?id=com.threesixtyentertainment.nesn';
const ANZCOR_8 = 'https://www.anzcor.org/home/basic-life-support/guideline-8-cardiopulmonary-resuscitation-cpr';
const ANZCOR_2 = 'https://www.anzcor.org/home/basic-life-support/guideline-2-managing-an-emergency';
const ANZCOR_4 = 'https://www.anzcor.org/home/basic-life-support/guideline-4-airway';
const ANZCOR_7 = 'https://www.anzcor.org/home/basic-life-support/guideline-7-automated-external-defibrillation-in-basic-life-support';
const ANZCOR_BLEED = 'https://www.anzcor.org/home/first-aid/guideline-9-1-1-first-aid-for-management-of-bleeding';

const BYSTANDER_STEPS = [
  { id: 'danger', title: 'Danger', text: 'Check for danger. Assess and manage risks to yourself, the people involved, and others. Making it safe may mean moving a person.', sources: [{ href: ANZCOR_8, label: 'ANZCOR Guideline 8' }, { href: ANZCOR_2, label: 'ANZCOR Guideline 2' }] },
  { id: 'response', title: 'Response', text: 'Check for a response: talk and touch.', sources: [{ href: ANZCOR_8, label: 'ANZCOR Guideline 8' }, { href: ANZCOR_2, label: 'ANZCOR Guideline 2' }] },
  { id: 'send', title: 'Send for help', text: 'Send for help. Call an ambulance on Triple Zero (000).', sources: [{ href: ANZCOR_8, label: 'ANZCOR Guideline 8' }, { href: 'https://www.triplezero.gov.au/triple-zero/How-to-Call-000', label: 'Triple Zero: How to call 000' }] },
  { id: 'airway', title: 'Airway', text: 'Open the airway. For an unresponsive adult or child, use a head tilt and chin lift. Leave the person as you found them unless fluid or matter is blocking the airway. Care of the airway comes before a possible spinal injury.', sources: [{ href: ANZCOR_4, label: 'ANZCOR Guideline 4' }, { href: ANZCOR_8, label: 'ANZCOR Guideline 8' }] },
  { id: 'breathing', title: 'Breathing', text: 'Check breathing. If they are not breathing normally, start CPR.', sources: [{ href: ANZCOR_8, label: 'ANZCOR Guideline 8' }] },
  { id: 'cpr', title: 'CPR', text: 'If the person is unresponsive and not breathing normally, start CPR: 30 chest compressions, then 2 breaths, at about 100 to 120 compressions a minute. Give breaths if you are trained and willing. Continue until they respond or breathe normally, you cannot keep going, or a health professional takes over.', sources: [{ href: ANZCOR_8, label: 'ANZCOR Guideline 8' }] },
  { id: 'defib', title: 'Defibrillator', text: 'Attach an AED as soon as you have one and follow its prompts. Use it only if the person is unresponsive and not breathing normally. Do not touch them while a shock is delivered.', sources: [{ href: ANZCOR_7, label: 'ANZCOR Guideline 7' }, { href: ANZCOR_8, label: 'ANZCOR Guideline 8' }] },
  { id: 'bleeding', title: 'Bleeding', text: 'Press firmly on or around the wound. If an object is stuck in the wound, press around the object. If bleeding is life-threatening, controlling it comes before airway and breathing. A tourniquet or haemostatic dressing is only for life-threatening bleeding that pressure has not stopped, and only if you are trained and have one.', sources: [{ href: ANZCOR_BLEED, label: 'ANZCOR Guideline 9.1.1' }] },
  { id: 'move', title: 'Moving a person', text: 'Move someone only when needed: to keep you or them safe, to protect them from extreme weather, to get them out of difficult terrain, to care for the airway and breathing, or to control severe bleeding. Checking the neck must not delay life-saving care.', sources: [{ href: ANZCOR_2, label: 'ANZCOR Guideline 2' }, { href: ANZCOR_4, label: 'ANZCOR Guideline 4' }] }
];

const REMOTE_NOTES = [
  { text: 'In rural areas give the full address, distances from landmarks and roads, and the property name. If you are moving, say your direction and the last exit or town you passed. Stay on the line until the operator says to hang up.', source: 'https://www.triplezero.gov.au/triple-zero/How-to-Call-000', sourceLabel: 'Triple Zero: How to call 000' },
  { text: 'UHF CB channels 5 and 35 are only for emergency messages. Using them is not a substitute for calling Triple Zero. Emergency services do not monitor these channels.', source: 'https://www.acma.gov.au/licences/citizen-band-radio-stations-class-licence', sourceLabel: 'ACMA CB class licence', also: { href: 'https://www.legislation.gov.au/F2025L01088', label: 'CB class licence instrument' } },
  { text: 'A satellite phone can call Triple Zero (000) when that operator provides access. A mobile cannot reach 000 or 112 by satellite. If no mobile network has coverage, neither 000 nor 112 will connect from a mobile. 112 reaches the same service as 000, does not need a SIM, and still needs coverage on some network.', source: 'https://www.triplezero.gov.au/triple-zero/other-emergency-numbers', sourceLabel: 'Triple Zero: other emergency numbers' },
  { text: 'iPhone Emergency SOS via satellite, on iPhone 14 or later, can connect a 000 call or text when there is no mobile and no Wi-Fi coverage, if you are outside with a clear view of the sky.', source: 'https://support.apple.com/en-au/101573', sourceLabel: 'Apple Support: Emergency SOS via satellite' },
  { text: 'Telstra Satellite Messaging uses Starlink Direct to Cell for ordinary text messages outside mobile coverage. Telstra says it cannot call 000 or 112 and cannot text Triple Zero. Do not rely on it in an emergency.', source: 'https://www.telstra.com.au/support/mobiles-devices/satellite-to-mobile', sourceLabel: 'Telstra Satellite Messaging' }
];

const SUPPORT_LINES = [
  { name: 'Lifeline', phone: '13 11 14', tel: 'tel:131114', href: 'https://www.lifeline.org.au/', note: '24 hours' },
  { name: 'Beyond Blue', phone: '1300 22 4636', tel: 'tel:1300224636', href: 'https://www.beyondblue.org.au/', note: '24/7' },
  { name: '13YARN', phone: '13 92 76', tel: 'tel:139276', href: 'https://www.13yarn.org.au/', note: '24/7' }
];
const HEALTHY_HEADS = { name: 'Healthy Heads in Trucks & Sheds', href: 'https://www.healthyheads.org.au/' };
const SERVICE_FINDER_URL = 'https://www.healthdirect.gov.au/australian-health-services';
const HEALTH_ADVICE = [
  { state: 'ALL', name: 'healthdirect', phone: '1800 022 222', tel: 'tel:1800022222', href: 'https://www.healthdirect.gov.au/how-healthdirect-can-help-you', note: 'Registered nurses, 24/7. After hours, the nurse may offer a call back from a GP.' },
  { state: 'QLD', name: '13 HEALTH', phone: '13 43 25 84', tel: 'tel:13432584', href: 'https://www.qld.gov.au/health/contacts/advice/13health', note: 'Queensland. Registered nurses, 24/7.' },
  { state: 'VIC', name: 'NURSE-ON-CALL', phone: '1300 60 60 24', tel: 'tel:1300606024', href: 'https://www.health.vic.gov.au/primary-care/nurse-on-call', note: 'Victoria. Registered nurses, 24/7.' }
];

const AFTER_SCENE = {
  title: 'After the scene',
  text: "It's normal to be affected after a serious or fatal crash. If life is in danger, call 000.",
  lines: SUPPORT_LINES.concat([
    { name: 'TIACS, listed by Healthy Heads', phone: '0488 846 988', tel: 'tel:0488846988', note: 'Mon–Fri, 8am–10pm AEST', href: 'https://www.healthyheads.org.au/about-us/contact-us/' }
  ]),
  orgs: [
    HEALTHY_HEADS,
    { name: 'TruckSafe', href: 'https://trucksafe.com.au/' }
  ],
  sources: [
    { href: 'https://www.healthyheads.org.au/about-us/contact-us/', label: 'Healthy Heads contact' },
    { href: 'https://www.healthyheads.org.au/wp-content/uploads/2026/03/20250318_Latest-Version_HHTS0035_Z-Card_OP-RJ-Edits-1.pdf', label: 'Healthy Heads support card' }
  ]
};

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
function clip(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function cleanId(value, prefix) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : newId(prefix);
}
function ymdOk(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const year = +match[1];
  const month = +match[2];
  const day = +match[3];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  if (year < 2000 || year > 2100) return '';
  return match[0];
}
function warnDays(value) {
  const n = Math.round(Number(value));
  return n >= 1 && n <= 366 ? n : 0;
}
function httpUrl(value) {
  const href = String(value || '').trim();
  return /^https?:\/\//i.test(href) ? href : '';
}
function telHref(phone) {
  const clean = String(phone || '').trim();
  if (!/^[0-9+().\-\s]{3,40}$/.test(clean)) return '';
  const href = 'tel:' + clean.replace(/[^\d+]/g, '');
  return /^tel:\+?\d{3,20}$/.test(href) ? href : '';
}
function mailHref(email) {
  const clean = String(email || '').trim();
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(clean) ? 'mailto:' + clean : '';
}
function readList(storage, key) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}
function writeList(storage, key, rows) {
  storage.setItem(key, JSON.stringify(rows));
}
function coord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function trimCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(6) : '';
}

function normaliseContact(input) {
  if (!input || typeof input !== 'object') return null;
  const name = clip(input.name, 80);
  const role = clip(input.role, 40);
  const phone = clip(input.phone, 40);
  const email = clip(input.email, 80);
  if (!name && !phone && !email) return null;
  return { id: cleanId(input.id, 'c'), name, role, phone, email };
}
function normaliseReminder(input) {
  if (!input || typeof input !== 'object') return null;
  const kind = ['licence', 'medical', 'other'].indexOf(input.kind) >= 0 ? input.kind : 'other';
  let label = clip(input.label, 80);
  if (!label && kind === 'licence') label = 'Driver licence';
  if (!label && kind === 'medical') label = 'Medical';
  const date = ymdOk(input.date);
  const warn = warnDays(input.warnDays);
  if (!label || !date || !warn) return null;
  return { id: cleanId(input.id, 'r'), kind, label, date, warnDays: warn };
}
function normaliseSite(input) {
  if (!input || typeof input !== 'object') return null;
  const name = clip(input.name, 80);
  if (!name) return null;
  const lat = coord(input.lat);
  const lng = coord(input.lng);
  const contacts = (Array.isArray(input.contacts) ? input.contacts : []).map(normaliseContact).filter(Boolean).slice(0, 8);
  return {
    id: cleanId(input.id, 's'),
    name,
    location: clip(input.location, 160),
    lat: lat != null && lat >= -90 && lat <= 90 ? lat : null,
    lng: lng != null && lng >= -180 && lng <= 180 ? lng : null,
    inductionLabel: clip(input.inductionLabel, 80),
    inductionUrl: httpUrl(input.inductionUrl),
    completed: ymdOk(input.completed),
    expiry: ymdOk(input.expiry),
    warnDays: warnDays(input.warnDays) || (ymdOk(input.expiry) ? 30 : 0),
    notes: clip(input.notes, 500),
    qrText: clip(input.qrText, 2000),
    contacts
  };
}
function normaliseEmployer(input) {
  if (!input || typeof input !== 'object') return null;
  const label = clip(input.label, 80);
  if (!label) return null;
  return {
    id: cleanId(input.id, 'e'),
    label,
    reportPhone: clip(input.reportPhone, 40),
    reportEmail: clip(input.reportEmail, 80),
    afterHoursName: clip(input.afterHoursName, 80),
    afterHoursPhone: clip(input.afterHoursPhone, 40),
    insurer: clip(input.insurer, 80),
    claimPhone: clip(input.claimPhone, 40),
    policyNumber: clip(input.policyNumber, 40),
    fleetUnit: clip(input.fleetUnit, 40),
    rego: clip(input.rego, 20),
    companyName: clip(input.companyName, 80),
    abn: clip(input.abn, 20),
    instructions: clip(input.instructions, 800)
  };
}
function partyOf(input) {
  const row = input && typeof input === 'object' ? input : {};
  return {
    name: clip(row.name, 80), phone: clip(row.phone, 40), address: clip(row.address, 160),
    licence: clip(row.licence, 40), rego: clip(row.rego, 20), vehicle: clip(row.vehicle, 80), insurer: clip(row.insurer, 80)
  };
}
function normaliseIncident(input) {
  if (!input || typeof input !== 'object') return null;
  const witnesses = (Array.isArray(input.witnesses) ? input.witnesses : []).map(row => {
    if (!row || typeof row !== 'object') return null;
    const name = clip(row.name, 80);
    const phone = clip(row.phone, 40);
    const note = clip(row.note, 200);
    if (!name && !phone && !note) return null;
    return { id: cleanId(row.id, 'w'), name, phone, note };
  }).filter(Boolean).slice(0, 8);
  return {
    id: cleanId(input.id, 'i'),
    path: ['involved', 'witness'].indexOf(input.path) >= 0 ? input.path : '',
    employerId: clip(input.employerId, 40),
    startedAt: clip(input.startedAt, 40),
    lat: coord(input.lat),
    lng: coord(input.lng),
    accuracy: coord(input.accuracy),
    address: clip(input.address, 240),
    where: clip(input.where, 160),
    words: clip(input.words, 80),
    party: partyOf(input.party),
    witnesses,
    police: ['yes', 'no', 'unsure'].indexOf(input.police) >= 0 ? input.police : '',
    policeEvent: clip(input.policeEvent, 40),
    notes: clip(input.notes, 2000),
    photoKeys: (Array.isArray(input.photoKeys) ? input.photoKeys : []).map(key => clip(key, 80)).filter(Boolean).slice(0, 40),
    savedAt: clip(input.savedAt, 40)
  };
}

function readReminders(storage) { return readList(storage, MY_REMINDERS_KEY).map(normaliseReminder).filter(Boolean); }
function readSites(storage) { return readList(storage, MY_SITES_KEY).map(normaliseSite).filter(Boolean); }
function readContacts(storage) { return readList(storage, MY_CONTACTS_KEY).map(normaliseContact).filter(Boolean); }
function readEmployers(storage) { return readList(storage, MY_EMPLOYERS_KEY).map(normaliseEmployer).filter(Boolean); }
function readIncidents(storage) { return readList(storage, MY_INCIDENTS_KEY).map(normaliseIncident).filter(Boolean); }
function saveRow(storage, key, read, normalise, input, cap) {
  const row = normalise(input);
  if (!row) return null;
  const rows = read(storage).filter(item => item.id !== row.id);
  rows.push(row);
  writeList(storage, key, rows.slice(-cap));
  return row;
}
function saveReminder(storage, input) { return saveRow(storage, MY_REMINDERS_KEY, readReminders, normaliseReminder, input, 40); }
function saveSite(storage, input) { return saveRow(storage, MY_SITES_KEY, readSites, normaliseSite, input, 40); }
function saveContact(storage, input) { return saveRow(storage, MY_CONTACTS_KEY, readContacts, normaliseContact, input, 80); }
function saveEmployer(storage, input) { return saveRow(storage, MY_EMPLOYERS_KEY, readEmployers, normaliseEmployer, input, 20); }
function deleteRow(storage, key, read, id) {
  writeList(storage, key, read(storage).filter(item => item.id !== id));
}
function deleteReminder(storage, id) { deleteRow(storage, MY_REMINDERS_KEY, readReminders, id); }
function deleteSite(storage, id) { deleteRow(storage, MY_SITES_KEY, readSites, id); }
function deleteContact(storage, id) { deleteRow(storage, MY_CONTACTS_KEY, readContacts, id); }
function deleteEmployer(storage, id) { deleteRow(storage, MY_EMPLOYERS_KEY, readEmployers, id); }

function localYmd(now) {
  const date = now instanceof Date ? now : new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
function daysUntil(ymd, now) {
  const target = ymdOk(ymd);
  const today = ymdOk(localYmd(now));
  if (!target || !today) return null;
  const a = Date.parse(today + 'T00:00:00Z');
  const b = Date.parse(target + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}
function addDays(ymd, delta) {
  const parts = ymdOk(ymd);
  if (!parts) return '';
  const date = new Date(parts + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
function dueText(days) {
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due in 1 day';
  return 'Due in ' + days + ' days';
}
function dueEntries(reminders, sites, now) {
  const rows = [];
  (reminders || []).forEach(item => {
    const days = daysUntil(item.date, now);
    if (days != null && days >= 0 && days <= item.warnDays) rows.push({ kind: 'reminder', id: item.id, label: item.label, date: item.date, days, warnDays: item.warnDays });
  });
  (sites || []).forEach(item => {
    if (!item.expiry) return;
    const days = daysUntil(item.expiry, now);
    if (days != null && days >= 0 && days <= item.warnDays) rows.push({ kind: 'site', id: item.id, label: item.name, date: item.expiry, days, warnDays: item.warnDays });
  });
  rows.sort((a, b) => a.days - b.days || a.label.localeCompare(b.label));
  return rows;
}
function mineDays(reminders, sites) {
  const days = [];
  (reminders || []).forEach(item => { if (item.date) days.push(item.date); });
  (sites || []).forEach(item => { if (item.expiry) days.push(item.expiry); });
  return days;
}
function icsEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function reminderIcs(entry) {
  const alarm = addDays(entry.date, -entry.warnDays);
  const end = addDays(entry.date, 1);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Drivers Advocate App//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', 'UID:' + entry.id + '@goroadhub.phone', 'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + entry.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + end.replace(/-/g, ''),
    'SUMMARY:' + icsEscape(entry.label + ' expires'), 'DESCRIPTION:' + icsEscape('Saved on this phone only.'),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(entry.label),
    'TRIGGER;VALUE=DATE-TIME:' + alarm.replace(/-/g, '') + 'T090000', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''
  ].join('\r\n');
}

function distanceMetres(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}
function sitesWithin(sites, here, metres) {
  return (sites || []).map(site => ({ site, metres: distanceMetres(here, site) })).filter(row => row.metres <= (metres || NEAR_METRES)).sort((a, b) => a.metres - b.metres);
}
function sortSites(sites, mode, here) {
  const rows = (sites || []).slice();
  if (mode === 'za') return rows.sort((a, b) => b.name.localeCompare(a.name));
  if ((mode === 'near' || !mode) && here) {
    return rows.sort((a, b) => {
      const da = a.lat == null ? Infinity : distanceMetres(here, a);
      const db = b.lat == null ? Infinity : distanceMetres(here, b);
      return da - db || a.name.localeCompare(b.name);
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
function sitesHavePins(storage) {
  return readSites(storage).some(site => site.lat != null && site.lng != null);
}

function cleanWords(value) {
  const text = String(value || '').trim().toLowerCase().replace(/^\/+/, '');
  return /^[a-z]+\.[a-z]+\.[a-z]+$/.test(text) ? text : '';
}
function mapsLink(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
  return 'https://maps.google.com/?q=' + trimCoord(lat) + ',' + trimCoord(lng);
}
function w3wLink(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
  return 'https://what3words.com/' + trimCoord(lat) + ',' + trimCoord(lng);
}
function w3wApiUrl(lat, lng, key) {
  const clean = clip(key, 80);
  if (!clean || !Number.isFinite(Number(lat))) return '';
  return 'https://api.what3words.com/v3/convert-to-3wa?coordinates=' + trimCoord(lat) + ',' + trimCoord(lng) + '&key=' + encodeURIComponent(clean);
}
function reverseGeocodeUrl(lat, lng) {
  return 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + encodeURIComponent(trimCoord(lat)) + '&lon=' + encodeURIComponent(trimCoord(lng));
}
async function reverseGeocode(lat, lng, fetchImpl) {
  const res = await fetchImpl(reverseGeocodeUrl(lat, lng), { headers: { Accept: 'application/json' } });
  if (!res || !res.ok) throw new Error('geocode');
  const json = await res.json();
  return clip(json && json.display_name, 240);
}
async function fillWords(lat, lng, key, fetchImpl) {
  const url = w3wApiUrl(lat, lng, key);
  if (!url) return '';
  const res = await fetchImpl(url);
  if (!res || !res.ok) throw new Error('w3w');
  const json = await res.json();
  return cleanWords(json && json.words);
}
function tilePreview(lat, lng) {
  const zoom = 16;
  const n = 2 ** zoom;
  const xFloat = (Number(lng) + 180) / 360 * n;
  const latRad = Number(lat) * Math.PI / 180;
  const yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  const x = Math.floor(xFloat);
  const y = Math.floor(yFloat);
  return {
    src: 'https://tile.openstreetmap.org/' + zoom + '/' + x + '/' + y + '.png',
    left: ((xFloat - x) * 100).toFixed(1),
    top: ((yFloat - y) * 100).toFixed(1)
  };
}
function emergencyLinks(ua) {
  const text = String(ua || '');
  const ios = /iPad|iPhone|iPod/i.test(text);
  const android = /Android/i.test(text);
  return { page: EMERGENCY_PAGE, ios: IOS_APP, android: ANDROID_APP, primary: ios ? IOS_APP : (android ? ANDROID_APP : '') };
}

function blankDraft() {
  return {
    id: newId('i'), path: '', mode: '', step: 0, startedAt: '', employerId: '',
    lat: null, lng: null, accuracy: null, address: '', where: '', words: '',
    party: partyOf({}), witnesses: [], police: '', policeEvent: '', notes: '', photoKeys: []
  };
}
function readDraft(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(DRAFT_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const row = normaliseIncident(parsed);
    if (!row) return null;
    row.step = Number.isFinite(+parsed.step) ? +parsed.step : 0;
    row.mode = parsed.mode === 'quick' || parsed.mode === 'serious' ? parsed.mode : '';
    row.words = clip(parsed.words, 80);
    return row;
  } catch (e) { return null; }
}
function writeDraft(storage, draft) {
  storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
function clearDraft(storage) { storage.removeItem(DRAFT_KEY); }
function saveIncident(storage, draft) {
  const row = normaliseIncident(Object.assign({}, draft, { savedAt: new Date().toISOString() }));
  if (!row) return null;
  const rows = readIncidents(storage).filter(item => item.id !== row.id);
  rows.push(row);
  writeList(storage, MY_INCIDENTS_KEY, rows.slice(-50));
  clearDraft(storage);
  return row;
}

function locationLines(draft) {
  const lines = [];
  if (Number.isFinite(Number(draft.lat)) && Number.isFinite(Number(draft.lng))) {
    lines.push('Coordinates: ' + trimCoord(draft.lat) + ', ' + trimCoord(draft.lng));
    if (Number.isFinite(Number(draft.accuracy)) && Number(draft.accuracy) >= 0) lines.push('Accuracy: ± ' + Math.round(Number(draft.accuracy)) + ' m');
    if (draft.address) lines.push('Street: ' + draft.address);
    if (draft.where) lines.push('Where: ' + draft.where);
    const words = cleanWords(draft.words);
    if (words) lines.push('what3words: ' + words);
    lines.push('Google Maps: ' + mapsLink(draft.lat, draft.lng));
    lines.push('what3words link: ' + w3wLink(draft.lat, draft.lng));
  } else {
    lines.push('Coordinates: not captured');
    if (draft.where) lines.push('Where: ' + draft.where);
  }
  return lines;
}
function incidentSummary(incident, employer) {
  const lines = ['Incident', 'Time: ' + (incident.startedAt || '')].concat(locationLines(incident));
  if (incident.path === 'witness') lines.push('Path: Came across a crash');
  if (employer) {
    lines.push('Depot: ' + employer.label);
    if (employer.companyName) lines.push('Company: ' + employer.companyName);
    if (employer.abn) lines.push('ABN: ' + employer.abn);
    if (employer.fleetUnit) lines.push('Fleet/unit: ' + employer.fleetUnit);
    if (employer.rego) lines.push('Rego: ' + employer.rego);
    if (employer.policyNumber) lines.push('Policy: ' + employer.policyNumber);
    if (employer.insurer) lines.push('Insurer: ' + employer.insurer);
    if (employer.instructions) lines.push('Depot instructions: ' + employer.instructions);
  }
  const party = incident.party || {};
  ['name', 'phone', 'address', 'licence', 'rego', 'vehicle', 'insurer'].forEach(key => {
    if (party[key]) lines.push('Other party ' + key + ': ' + party[key]);
  });
  (incident.witnesses || []).forEach((row, index) => lines.push('Witness ' + (index + 1) + ': ' + [row.name, row.phone, row.note].filter(Boolean).join(', ')));
  if (incident.police) lines.push('Police attendance: ' + incident.police);
  if (incident.policeEvent) lines.push('Police event: ' + incident.policeEvent);
  if (incident.notes) lines.push('Notes: ' + incident.notes);
  lines.push('Saved on this phone only.');
  return lines.join('\n');
}
function incidentMailto(employer, incident) {
  const summary = incidentSummary(incident, employer);
  const body = summary.length > 1800 ? summary.slice(0, 1800) + '\n… Full summary is in the PDF on this phone.' : summary;
  const email = employer && mailHref(employer.reportEmail) ? employer.reportEmail : '';
  const query = 'subject=' + encodeURIComponent('Incident') + '&body=' + encodeURIComponent(body);
  return (email ? 'mailto:' + email : 'mailto:') + '?' + query;
}
function pdfEsc(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function incidentPdf(summary) {
  const clean = String(summary || '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
  const wrapped = [];
  clean.split('\n').forEach(line => {
    const text = line || ' ';
    for (let i = 0; i < text.length; i += 90) wrapped.push(text.slice(i, i + 90));
  });
  const pages = [];
  for (let i = 0; i < Math.max(wrapped.length, 1); i += 46) pages.push(wrapped.slice(i, i + 46));
  if (!pages[0].length) pages[0] = ['Incident'];
  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  function add(body) {
    offsets.push(chunks.reduce((n, chunk) => n + chunk.length, 0));
    chunks.push(body);
  }
  const font = 3 + pages.length * 2;
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  add('2 0 obj\n<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map((_, i) => (3 + i * 2) + ' 0 R').join(' ') + '] >>\nendobj\n');
  pages.forEach((lines, index) => {
    const pageObj = 3 + index * 2;
    const contentObj = pageObj + 1;
    add(pageObj + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ' + contentObj + ' 0 R /Resources << /Font << /F1 ' + font + ' 0 R >> >> >>\nendobj\n');
    const commands = ['BT', '/F1 11 Tf', '50 740 Td', '14 TL'];
    lines.forEach((line, lineIndex) => commands.push((lineIndex ? 'T* ' : '') + '(' + pdfEsc(line) + ') Tj'));
    commands.push('ET');
    const stream = commands.join('\n');
    add(contentObj + ' 0 obj\n<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream\nendobj\n');
  });
  add(font + ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  const start = chunks.reduce((n, chunk) => n + chunk.length, 0);
  let xref = 'xref\n0 ' + (font + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= font; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  chunks.push(xref + 'trailer\n<< /Size ' + (font + 1) + ' /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF');
  return new TextEncoder().encode(chunks.join(''));
}

function flowIds(draft) {
  if (!draft || !draft.path) return [];
  if (draft.path === 'witness') return ['call', 'danger', 'response', 'send', 'airway', 'breathing', 'cpr', 'defib', 'bleeding', 'move', 'remote', 'record', 'review'];
  if (draft.mode === 'quick') return ['photos', 'party', 'location', 'review'];
  if (draft.mode === 'serious') return ['serious', 'scene', 'photos', 'party', 'police', 'location', 'review'];
  return ['choose'];
}

function sourceLinks(list) {
  return (list || []).map(item => '<a href="' + esc(item.href || item.source) + '" target="_blank" rel="noopener noreferrer">' + esc(item.label || item.sourceLabel) + '</a>').join(' · ');
}
function navButtons() {
  return '<p class="wiz-nav"><button type="button" class="wiz-quiet" data-wiz="back">Back</button><button type="button" class="wiz-quiet" data-wiz="skip">Skip</button><button type="button" class="wiz-next" data-wiz="review">Review / Send</button></p>';
}
function callLinks(draft, ua) {
  const links = emergencyLinks(ua);
  const store = links.primary
    ? '<a class="wiz-next" href="' + esc(links.primary) + '" target="_blank" rel="noopener noreferrer">Emergency+</a>'
    : '<a class="wiz-next" href="' + esc(links.ios) + '" target="_blank" rel="noopener noreferrer">Emergency+ for iPhone</a><a class="wiz-next" href="' + esc(links.android) + '" target="_blank" rel="noopener noreferrer">Emergency+ for Android</a>';
  const words = w3wLink(draft.lat, draft.lng);
  const w3w = words
    ? '<a class="wiz-next" href="' + esc(words) + '" target="_blank" rel="noopener noreferrer">Open what3words</a>'
    : '<button type="button" class="wiz-quiet" disabled>Open what3words when the pin is ready</button>';
  return '<p class="wiz-row"><a class="tap-call" href="tel:000">Call 000</a>' + store + w3w + '</p><p class="wiz-note">' + esc(EMERGENCY_NOTE) + '</p><p class="wiz-note">These links are optional.</p>';
}
function locationFields(draft) {
  const lat = draft.lat == null ? '' : draft.lat;
  const lng = draft.lng == null ? '' : draft.lng;
  let map = '<p class="wiz-note">Location not captured yet. You can refresh or type a pin.</p>';
  if (Number.isFinite(Number(draft.lat)) && Number.isFinite(Number(draft.lng))) {
    const tile = tilePreview(draft.lat, draft.lng);
    map = '<div class="map-preview"><img alt="Map preview of this pin" referrerpolicy="no-referrer" src="' + esc(tile.src) + '"><span class="map-pin" style="left:' + esc(tile.left) + '%;top:' + esc(tile.top) + '%"></span></div><p class="wiz-note"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>. The picture loads only while you are online.</p>';
  }
  const accuracy = Number.isFinite(Number(draft.accuracy)) ? '<p>Accuracy ± ' + Math.round(Number(draft.accuracy)) + ' m</p>' : '';
  const address = draft.address ? '<p>Street: ' + esc(draft.address) + '</p>' : '<p class="wiz-note">Street address appears when this phone can look it up. Offline, the coordinates stay.</p>';
  return map + '<p>Coordinates <input id="smash-lat" inputmode="decimal" value="' + esc(lat) + '"> <input id="smash-lng" inputmode="decimal" value="' + esc(lng) + '"></p>' + accuracy + address +
    '<p><button type="button" class="wiz-quiet" data-loc="refresh">Refresh GPS</button> <button type="button" class="wiz-quiet" data-loc="lookup">Look up street address</button></p>' +
    '<label>Plain description <input id="smash-where" maxlength="160" placeholder="northbound, 2km past X" value="' + esc(draft.where || '') + '"></label>' +
    '<label>3-word address <input id="smash-words" maxlength="80" placeholder="word.word.word" value="' + esc(draft.words || '') + '"></label>' +
    callLinks(draft, '');
}
function orderedHealthAdvice(state) {
  const code = state === 'QLD' || state === 'VIC' ? state : 'ALL';
  return HEALTH_ADVICE.slice().sort((a, b) => {
    const rank = item => item.state === code ? 0 : item.state === 'ALL' ? 1 : 2;
    return rank(a) - rank(b);
  });
}
function serviceFinderUrl() {
  return SERVICE_FINDER_URL;
}
function hospitalMapUrl(lat, lng, ua) {
  const ios = /iPad|iPhone|iPod/i.test(String(ua || ''));
  const has = lat != null && lng != null && lat !== '' && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const query = encodeURIComponent('hospital emergency');
  if (ios) return 'https://maps.apple.com/?q=' + query + (has ? '&sll=' + trimCoord(lat) + ',' + trimCoord(lng) : '');
  if (has) return 'https://www.google.com/maps/search/hospital+emergency/@' + trimCoord(lat) + ',' + trimCoord(lng) + ',13z';
  return 'https://www.google.com/maps/search/?api=1&query=' + query;
}
function healthAdviceHtml(state, place) {
  const where = place || {};
  const lines = orderedHealthAdvice(state).map(line => '<p data-health-state="' + esc(line.state) + '"><a class="tap-call" href="' + esc(line.tel) + '">Call ' + esc(line.name) + ' ' + esc(line.phone) + '</a> <span class="wiz-note">' + esc(line.note) + '</span> <a class="page-link" href="' + esc(line.href) + '" target="_blank" rel="noopener noreferrer">' + esc(line.name) + '</a></p>').join('');
  const finder = '<p><a class="tap-call" data-find-doctor href="' + esc(serviceFinderUrl()) + '" target="_blank" rel="noopener noreferrer">Find a doctor near me</a></p><p class="wiz-note">Opens the healthdirect Service Finder for a GP, after-hours clinic, hospital or pharmacy. That page does not take a pin in the link. Choose Use current location there.</p>';
  const hospital = '<p><a class="tap-call" data-nearest-hospital href="' + esc(hospitalMapUrl(where.lat, where.lng, where.ua)) + '" target="_blank" rel="noopener noreferrer">Nearest hospital</a></p>';
  return '<section class="health-advice"><h3>Health advice 24/7</h3><p>Call 000 in an emergency.</p>' + lines + finder + hospital + '</section>';
}
function orderHealthCards(state) {
  if (typeof document === 'undefined') return orderedHealthAdvice(state);
  const code = state === 'QLD' || state === 'VIC' ? state : 'ALL';
  document.querySelectorAll('[data-health-list]').forEach(list => {
    const items = Array.prototype.slice.call(list.children);
    items.sort((a, b) => {
      const rank = el => { const mark = el.getAttribute('data-health-state'); return mark === code ? 0 : mark === 'ALL' ? 1 : 2; };
      return rank(a) - rank(b);
    });
    items.forEach(el => list.appendChild(el));
  });
}
function afterSceneHtml(state) {
  const calls = AFTER_SCENE.lines.map(line => '<p><a class="tap-call" href="' + esc(line.tel) + '">Call ' + esc(line.name) + ' ' + esc(line.phone) + '</a>' + (line.note ? ' <span class="wiz-note">' + esc(line.note) + '</span>' : '') + ' <a href="' + esc(line.href) + '" target="_blank" rel="noopener noreferrer">Page</a></p>').join('');
  const orgs = AFTER_SCENE.orgs.map(org => '<a href="' + esc(org.href) + '" target="_blank" rel="noopener noreferrer">' + esc(org.name) + '</a>').join(' · ');
  return '<section class="after-scene"><h3>' + esc(AFTER_SCENE.title) + '</h3><p>' + esc(AFTER_SCENE.text) + '</p>' + calls + '<p>' + orgs + '</p><p class="wiz-note">' + sourceLinks(AFTER_SCENE.sources) + '</p></section>';
}

function smashHtml(draft, ua, state) {
  const row = draft || blankDraft();
  const ids = flowIds(row);
  const step = ids[row.step] || ids[0] || 'entry';
  const head = '<p class="wiz-note">' + esc(PHONE_NOTE) + ' This checklist works offline.</p>';
  if (!row.path) {
    return '<div class="wiz" role="dialog" aria-modal="true"><h2>SMASH GLASS</h2>' + head +
      '<button type="button" class="wiz-next" data-wiz="involved">I was in one</button>' +
      '<button type="button" class="wiz-next" data-wiz="witness">Came across a crash</button>' +
      healthAdviceHtml(state, { lat: row.lat, lng: row.lng, ua: ua }) + navButtons() + '</div>';
  }
  if (step === 'choose') {
    return '<div class="wiz" role="dialog" aria-modal="true"><h2>What happened?</h2>' + head +
      '<button type="button" class="wiz-next" data-wiz="minor">Minor bump (no injuries)</button>' +
      '<button type="button" class="wiz-next" data-wiz="serious">Serious / injuries</button>' +
      '<p class="wiz-note">Every step can be skipped.</p>' + healthAdviceHtml(state, { lat: row.lat, lng: row.lng, ua: ua }) + navButtons() + '</div>';
  }
  let body = '';
  if (step === 'serious' || step === 'call') {
    body = '<h2>' + (step === 'call' ? 'Call 000' : 'Serious / injuries') + '</h2>' + callLinks(row, ua) +
      '<p>From a mobile, 112 reaches the same Triple Zero service and does not need a SIM, but some network must have coverage. If no network has coverage, neither 000 nor 112 will connect. <a href="https://www.triplezero.gov.au/triple-zero/other-emergency-numbers" target="_blank" rel="noopener noreferrer">Triple Zero: 112</a></p>';
    if (step === 'call') body += '<p class="wiz-disclaimer">' + esc(DISCLAIMER) + '</p>';
  } else if (step === 'scene') {
    body = '<h2>Make the scene safe</h2><p>Hazards, triangles.</p>';
  } else if (step === 'photos' || step === 'record') {
    body = '<h2>' + (step === 'record' ? 'Record what you saw' : 'Photos') + '</h2>' +
      (step === 'photos' ? '<p>Vehicles, damage, scene, number plates, other driver\'s licence. Optional.</p>' : '<label>Notes <textarea id="smash-notes" maxlength="2000">' + esc(row.notes || '') + '</textarea></label>') +
      ['vehicles', 'damage', 'scene', 'plates', 'licence'].map(slot => '<label class="wiz-next">Camera: ' + slot + '<input type="file" accept="image/*" capture="environment" data-shot="' + slot + '" hidden></label><label class="wiz-quiet">Gallery: ' + slot + '<input type="file" accept="image/*" data-shot="' + slot + '" hidden></label>').join('');
  } else if (step === 'party') {
    const party = row.party || {};
    body = '<h2>Other party</h2>' +
      ['name', 'phone', 'address', 'licence', 'rego', 'vehicle', 'insurer'].map(key => '<label>' + key + ' <input id="party-' + key + '" value="' + esc(party[key] || '') + '"></label>').join('') +
      '<div id="witnesses">' + (row.witnesses || []).map((item, index) => '<p>Witness <input data-witness="' + index + '" data-field="name" value="' + esc(item.name) + '"> <input data-witness="' + index + '" data-field="phone" value="' + esc(item.phone) + '"></p>').join('') + '</div><button type="button" data-add-witness>Add witness</button>';
  } else if (step === 'police') {
    body = '<h2>Police</h2><p><button type="button" data-police="yes">Attended</button> <button type="button" data-police="no">Did not attend</button> <button type="button" data-police="unsure">Not sure</button></p><label>Event number <input id="police-event" value="' + esc(row.policeEvent || '') + '"></label>';
  } else if (step === 'location') {
    body = '<h2>Location</h2><p>Time: ' + esc(row.startedAt || '') + '</p>' + locationFields(row) + '<label>Notes <textarea id="smash-notes">' + esc(row.notes || '') + '</textarea></label>';
  } else if (step === 'remote') {
    body = '<h2>Remote notes</h2>' + REMOTE_NOTES.map(item => '<p>' + esc(item.text) + ' <a href="' + esc(item.source) + '" target="_blank" rel="noopener noreferrer">' + esc(item.sourceLabel) + '</a>' + (item.also ? ' · <a href="' + esc(item.also.href) + '" target="_blank" rel="noopener noreferrer">' + esc(item.also.label) + '</a>' : '') + '</p>').join('') + afterSceneHtml();
  } else if (BYSTANDER_STEPS.some(item => item.id === step)) {
    const item = BYSTANDER_STEPS.filter(entry => entry.id === step)[0];
    body = '<h2>' + esc(item.title) + '</h2><p>' + esc(item.text) + '</p><p>' + sourceLinks(item.sources) + '</p><p class="wiz-disclaimer">' + esc(DISCLAIMER) + '</p>';
  } else {
    body = '<h2>Review</h2><pre class="wiz-review">' + esc(incidentSummary(row, null)) + '</pre>' + afterSceneHtml() +
      '<button type="button" class="wiz-next" data-wiz="send">Send to depot</button><p class="wiz-note">Send opens your mail app and, where the phone allows, the share sheet. Nothing is uploaded to the Drivers Advocate server.</p>';
  }
  const index = Math.max(0, ids.indexOf(step));
  return '<div class="wiz" role="dialog" aria-modal="true">' + head + '<p>Step ' + (index + 1) + ' of ' + ids.length + '. Optional.</p>' + body + healthAdviceHtml(state, { lat: row.lat, lng: row.lng, ua: ua }) + navButtons() + '</div>';
}

function countdownHtml(entries) {
  return (entries || []).map(item => '<article class="ev-item mine-card" data-ev-days="' + esc(item.date) + '"><p class="mine-due">' + esc(dueText(item.days)) + '</p><h4>' + esc(item.label) + '</h4><button type="button" class="mine-btn" data-ics="' + esc(item.kind + ':' + item.id) + '">Add to my phone calendar</button></article>').join('');
}
function contactButtons(contact) {
  const call = telHref(contact.phone);
  const mail = mailHref(contact.email);
  return (call ? '<a class="tap-call" href="' + esc(call) + '">Call ' + esc(contact.name || contact.role || 'contact') + '</a>' : '') +
    (mail ? '<a class="tap-mail" href="' + esc(mail) + '">Email</a>' : '');
}
function nearbyHtml(hits) {
  if (!hits || !hits.length) return '';
  return hits.map(hit => {
    const site = hit.site;
    const open = httpUrl(site.inductionUrl) ? '<a class="site-open" href="' + esc(site.inductionUrl) + '" target="_blank" rel="noopener noreferrer">Open induction</a>' : '';
    const contacts = (site.contacts || []).map(contactButtons).join('');
    return '<article class="nearby-pop"><h3>You\'re near ' + esc(site.name) + '</h3><p>About ' + Math.round(hit.metres) + ' m away. This check runs only while the app is open. A web app can\'t alert you in the background.</p>' + open +
      '<button type="button" class="mine-btn" data-show-qr="' + esc(site.id) + '">Show QR</button><button type="button" class="mine-btn" data-view-photo="site:' + esc(site.id) + ':front">Show card</button>' + contacts + '</article>';
  }).join('');
}
function personalHtml(state) {
  const model = state || {};
  const query = clip(model.query, 80).toLowerCase();
  const sites = sortSites(model.sites || [], model.sort, model.here).filter(site => !query || site.name.toLowerCase().indexOf(query) >= 0);
  const reminders = (model.reminders || []).map(item => '<article class="mine-card"><h4>' + esc(item.label) + '</h4><p>' + esc(item.date) + ' · warn ' + esc(item.warnDays) + ' days</p><button type="button" data-rem-edit="' + esc(item.id) + '">Edit</button> <button type="button" data-rem-del="' + esc(item.id) + '">Delete</button> <button type="button" data-ics="reminder:' + esc(item.id) + '">Add to my phone calendar</button></article>').join('') || '<p>No reminders yet.</p>';
  const siteCards = sites.map(site => {
    const open = site.inductionUrl ? '<a class="site-open" href="' + esc(site.inductionUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(site.inductionLabel ? 'Open ' + site.inductionLabel : 'Open induction') + '</a>' : (site.inductionLabel ? '<p>' + esc(site.inductionLabel) + '</p>' : '');
    const id = esc(site.id);
    return '<article class="site-item" data-site-id="' + id + '" data-site-name="' + esc(site.name.toLowerCase()) + '"><h4>' + esc(site.name) + '</h4><p>' + esc(site.location) + (site.lat != null ? ' · pin saved' : '') + '</p>' + open + '<p>' + esc(site.notes) + '</p>' +
      (site.qrText ? '<p>Pass QR saved</p>' : '') +
      (site.contacts || []).map(contact => '<p>' + esc(contact.name) + ' ' + esc(contact.role) + ' ' + contactButtons(contact) + ' <button type="button" data-site-contact-del="' + id + '" data-contact-id="' + esc(contact.id) + '">Delete</button></p>').join('') +
      '<p><input data-c-name placeholder="Contact name" maxlength="80"> <input data-c-role placeholder="Depot, gatehouse, supervisor" maxlength="40"> <input data-c-phone placeholder="Phone" maxlength="40"> <input data-c-email placeholder="Email" maxlength="80"> <button type="button" data-add-site-contact="' + id + '">Add contact</button></p>' +
      '<p class="site-tools"><label class="mine-btn">Card front camera<input type="file" accept="image/*" capture="environment" data-site-photo="' + id + '" data-slot="front" hidden></label><label class="mine-btn">Card front gallery<input type="file" accept="image/*" data-site-photo="' + id + '" data-slot="front" hidden></label><button type="button" class="mine-btn" data-view-photo="site:' + id + ':front">View front</button><label class="mine-btn">Card back camera<input type="file" accept="image/*" capture="environment" data-site-photo="' + id + '" data-slot="back" hidden></label><label class="mine-btn">Card back gallery<input type="file" accept="image/*" data-site-photo="' + id + '" data-slot="back" hidden></label><button type="button" class="mine-btn" data-view-photo="site:' + id + ':back">View back</button></p>' +
      '<p class="site-tools"><button type="button" class="mine-btn" data-scan="link" data-site="' + id + '">Scan induction QR</button><button type="button" class="mine-btn" data-scan="pass" data-site="' + id + '">Scan pass QR</button><label class="mine-btn">Photograph pass QR<input type="file" accept="image/*" capture="environment" data-site-photo="' + id + '" data-slot="qr" hidden></label><button type="button" class="mine-btn" data-show-qr="' + id + '">Show QR</button></p>' +
      '<button type="button" data-site-edit="' + id + '">Edit</button> <button type="button" data-site-del="' + id + '">Delete</button> <button type="button" data-here="' + id + '">I\'m here now</button>' +
      (site.expiry ? ' <button type="button" data-ics="site:' + id + '">Add to my phone calendar</button>' : '') + '</article>';
  }).join('') || '<p>No sites yet.</p>';
  const contacts = (model.contacts || []).map(contact => '<p>' + esc(contact.name) + ' ' + esc(contact.role) + ' ' + contactButtons(contact) + ' <button type="button" data-contact-del="' + esc(contact.id) + '">Delete</button></p>').join('') || '<p>No contacts yet.</p>';
  return '<section class="personal-card" id="my-reminders"><h3>My Reminders</h3><p class="mine-note">' + esc(PHONE_NOTE) + '</p><form id="rem-form"><input type="hidden" id="rem-id"><label>What <select id="rem-kind"><option value="licence">Driver licence</option><option value="medical">Medical</option><option value="other">Other</option></select></label><label>Name <input id="rem-label" maxlength="80" placeholder="Dangerous goods, forklift, WHS induction, rego"></label><label>Expiry <input id="rem-date" type="date" required></label><label>Warn me <select id="rem-warn"><option>30</option><option>60</option><option>90</option><option>120</option><option>160</option><option value="custom">Custom</option></select></label><label id="rem-custom-wrap" hidden>Days <input id="rem-custom" inputmode="numeric"></label><button class="mine-btn" type="submit">Save reminder</button></form><div class="mine-list">' + reminders + '</div></section>' +
    '<section class="personal-card" id="my-sites"><h3>My Sites &amp; Inductions</h3><p class="mine-note">Location is checked only while you are using the app. A web app can\'t alert you in the background. Pins stay on this phone.</p><input id="site-q" placeholder="Search by name" value="' + esc(model.query || '') + '"><select id="site-sort"><option value="az">Name A–Z</option><option value="za">Name Z–A</option><option value="near">Nearest</option></select><form id="site-form"><input type="hidden" id="site-id"><label>Site or customer <input id="site-name" maxlength="80" autocomplete="off" required></label><label>Location <input id="site-location" maxlength="160"></label><label>Induction name <input id="site-induction" maxlength="80" placeholder="App name or site name"></label><label>Link <input id="site-url" placeholder="https://"></label><label>Completed <input id="site-completed" type="date"></label><label>Expiry <input id="site-expiry" type="date"></label><label>Warn days <input id="site-warn" value="30"></label><label>Notes <textarea id="site-notes" placeholder="Gate times, PPE, contact"></textarea></label><button class="mine-btn" type="submit">Save site</button></form>' + siteCards + '</section>' +
    '<section class="personal-card" id="my-contacts"><h3>My Contacts</h3><form id="contact-form"><label>Name <input id="contact-name" maxlength="80"></label><label>Role <input id="contact-role" maxlength="40" placeholder="Depot, dispatcher, breakdown, tyre service"></label><label>Phone <input id="contact-phone" maxlength="40"></label><button class="mine-btn" type="submit">Save contact</button></form>' + contacts + '</section>' +
    '<section class="personal-card" id="depot-details"><h3>Depot accident details</h3><p class="mine-note">Fill this in before you need it. The red SMASH GLASS button is on every screen.</p><form id="emp-form"><input type="hidden" id="emp-id"><label>Employer or depot <input id="emp-label" maxlength="80" required></label><label>Accident phone <input id="emp-phone"></label><label>Accident email <input id="emp-email"></label><label>After-hours phone <input id="emp-after"></label><label>Insurer <input id="emp-insurer"></label><label>Claim phone <input id="emp-claim"></label><label>Policy <input id="emp-policy"></label><label>Fleet/unit <input id="emp-fleet"></label><label>Rego <input id="emp-rego"></label><label>Company <input id="emp-company"></label><label>ABN <input id="emp-abn"></label><label>Instructions <textarea id="emp-notes"></textarea></label><button class="mine-btn" type="submit">Save depot</button></form><label>Optional what3words API key, stored on this phone only and not included in the backup <input id="w3w-key" maxlength="80"></label><p class="mine-note">Leave the key blank. The what3words button does not need it.</p><button type="button" id="personal-export" class="mine-btn">Export backup</button><label class="mine-btn">Import backup <input id="personal-import" type="file" accept="application/json,.json" hidden></label></section>';
}

async function exportBackup(storage, files) {
  const photos = files && files.all ? await files.all() : [];
  return {
    kind: BACKUP_KIND,
    version: 1,
    reminders: readReminders(storage),
    sites: readSites(storage),
    contacts: readContacts(storage),
    employers: readEmployers(storage),
    incidents: readIncidents(storage),
    photos: (photos || []).filter(row => row && String(row.dataUrl || '').indexOf('data:image/') === 0).slice(0, 80)
  };
}
async function importBackup(storage, raw, files) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || data.kind !== BACKUP_KIND || data.version !== 1) return { ok: false, error: 'That file is not a Drivers Advocate phone backup.' };
  let reminders = 0;
  let sites = 0;
  let contacts = 0;
  let employers = 0;
  let incidents = 0;
  (Array.isArray(data.reminders) ? data.reminders : []).slice(0, 40).forEach(row => { if (saveReminder(storage, row)) reminders++; });
  (Array.isArray(data.sites) ? data.sites : []).slice(0, 40).forEach(row => { if (saveSite(storage, row)) sites++; });
  (Array.isArray(data.contacts) ? data.contacts : []).slice(0, 80).forEach(row => { if (saveContact(storage, row)) contacts++; });
  (Array.isArray(data.employers) ? data.employers : []).slice(0, 20).forEach(row => { if (saveEmployer(storage, row)) employers++; });
  (Array.isArray(data.incidents) ? data.incidents : []).slice(0, 50).forEach(row => {
    const clean = normaliseIncident(row);
    if (!clean) return;
    const rows = readIncidents(storage).filter(item => item.id !== clean.id);
    rows.push(clean);
    writeList(storage, MY_INCIDENTS_KEY, rows);
    incidents++;
  });
  if (files && files.put) {
    for (const photo of (Array.isArray(data.photos) ? data.photos : []).slice(0, 80)) {
      if (photo && photo.key && String(photo.dataUrl || '').indexOf('data:image/') === 0) await files.put(clip(photo.key, 80), photo.dataUrl);
    }
  }
  return { ok: true, reminders, sites, contacts, employers, incidents };
}
function memoryFiles(initial) {
  const box = new Map(initial || []);
  return {
    async get(key) { return box.has(key) ? box.get(key) : null; },
    async put(key, value) { box.set(key, value); },
    async del(key) { box.delete(key); },
    async keys() { return [...box.keys()]; },
    async all() { return [...box.entries()].map(([key, dataUrl]) => ({ key, dataUrl })); }
  };
}
function browserFiles() {
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('goroadhub-phone', 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  function done(request) {
    return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  }
  return {
    async get(key) { const database = await db(); return done(database.transaction('files').objectStore('files').get(key)); },
    async put(key, value) { const database = await db(); return done(database.transaction('files', 'readwrite').objectStore('files').put(value, key)); },
    async del(key) { const database = await db(); return done(database.transaction('files', 'readwrite').objectStore('files').delete(key)); },
    async keys() { const database = await db(); return done(database.transaction('files').objectStore('files').getAllKeys()); },
    async all() {
      const database = await db();
      const keys = await done(database.transaction('files').objectStore('files').getAllKeys());
      const values = await done(database.transaction('files').objectStore('files').getAll());
      return keys.map((key, index) => ({ key, dataUrl: values[index] }));
    }
  };
}

const api = {
  MY_REMINDERS_KEY, MY_SITES_KEY, MY_CONTACTS_KEY, MY_EMPLOYERS_KEY, MY_INCIDENTS_KEY, DRAFT_KEY, W3W_KEY,
  WARN_PRESETS, NEAR_METRES, PHONE_NOTE, DISCLAIMER, EMERGENCY_NOTE, EMERGENCY_PAGE, IOS_APP, ANDROID_APP,
  SERVICE_FINDER_URL, serviceFinderUrl, hospitalMapUrl,
  BYSTANDER_STEPS, REMOTE_NOTES, AFTER_SCENE, SUPPORT_LINES, HEALTHY_HEADS, HEALTH_ADVICE, orderedHealthAdvice, healthAdviceHtml, orderHealthCards,
  readReminders, readSites, readContacts, readEmployers, readIncidents,
  saveReminder, saveSite, saveContact, saveEmployer, deleteReminder, deleteSite, deleteContact, deleteEmployer,
  daysUntil, dueText, dueEntries, mineDays, reminderIcs, distanceMetres, sitesWithin, sortSites, sitesHavePins,
  cleanWords, mapsLink, w3wLink, w3wApiUrl, reverseGeocodeUrl, reverseGeocode, fillWords, tilePreview, emergencyLinks,
  blankDraft, readDraft, writeDraft, clearDraft, saveIncident, incidentSummary, incidentMailto, incidentPdf, locationLines,
  flowIds, smashHtml, countdownHtml, nearbyHtml, personalHtml, exportBackup, importBackup, memoryFiles, browserFiles, telHref
};
Object.keys(api).forEach(key => { root[key] = api[key]; });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

(function () {
let STD = null;
let HERE = null;
let siteQuery = '';
let siteSort = 'az';
let SMASH = null;
let scanStream = null;
let phoneStore = null;

function store() {
  if (!phoneStore && typeof browserFiles === 'function') phoneStore = browserFiles();
  return phoneStore;
}
function chosenState() {
  return typeof readStdFilter === 'function' ? readStdFilter(localStorage).state : 'ALL';
}
function downloadBytes(name, bytes, type) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      let w = img.naturalWidth || 1;
      let h = img.naturalHeight || 1;
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (!blob) reject(new Error('image'));
        else resolve(blob);
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  const mime = ((parts[0] || '').match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(parts[1] || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function refreshStandard() {
  try {
    const res = await fetch('/api/standard-dates', { cache: 'no-store' });
    if (!res.ok) throw new Error('status');
    STD = await res.json();
    try { localStorage.setItem('rh-standard-dates', JSON.stringify(STD)); } catch (e) {}
  } catch (e) {
    try { STD = JSON.parse(localStorage.getItem('rh-standard-dates') || 'null'); } catch (err) {}
  }
  if (typeof V !== 'undefined' && V.view === 'evt' && typeof eventsView === 'function') repaint();
}

function personalMarks() {
  const reminders = typeof readReminders === 'function' ? readReminders(localStorage) : [];
  const sites = typeof readSites === 'function' ? readSites(localStorage) : [];
  const rows = [];
  reminders.forEach(item => { if (item && item.date && item.id) rows.push({ date: item.date, kind: 'reminder', id: item.id, label: item.label || '' }); });
  sites.forEach(item => { if (item && item.expiry && item.id) rows.push({ date: item.expiry, kind: 'site', id: item.id, label: item.name || '' }); });
  return rows;
}
function phoneEventStatus() {
  const filter = typeof readStdFilter === 'function' ? readStdFilter(localStorage) : null;
  const items = typeof filterStandardItems === 'function' ? filterStandardItems((STD && STD.items) || [], filter) : [];
  const personal = personalMarks();
  return {
    stdFilter: filter,
    standardItems: (STD && STD.items) || [],
    holidayNote: STD && STD.holidayNote || '',
    standardNotes: STD && STD.notes || [],
    mineDays: personal.map(item => item.date),
    mineItems: personal,
    standardDays: typeof standardItemDays === 'function' ? standardItemDays(items) : [],
    countdownHtml: '',
    nearbyHtml: '',
    personalHtml: ''
  };
}
function sitesPageHtml() {
  const reminders = typeof readReminders === 'function' ? readReminders(localStorage) : [];
  const sites = typeof readSites === 'function' ? readSites(localStorage) : [];
  const nearby = HERE && typeof sitesWithin === 'function' ? nearbyHtml(sitesWithin(sites, HERE)) : '';
  const due = typeof dueEntries === 'function' ? countdownHtml(dueEntries(reminders, sites, new Date())) : '';
  const body = typeof personalHtml === 'function' ? personalHtml({ reminders, sites, contacts: typeof readContacts === 'function' ? readContacts(localStorage) : [], query: siteQuery, sort: siteSort, here: HERE }) : '';
  return nearby + due + body;
}
function repaint() {
  if (typeof V === 'undefined') return;
  if (V.view === 'sit' && typeof sitesView === 'function') sitesView();
  else if (V.view === 'evt' && typeof eventsView === 'function') eventsView();
}
function phoneCalendarMarks() {
  const status = phoneEventStatus();
  return { standardDays: status.standardDays, mineDays: status.mineDays, mineItems: status.mineItems };
}

function paintSmash() {
  const root = document.getElementById('smash-root');
  if (!root || !SMASH) return;
  root.innerHTML = smashHtml(SMASH, navigator.userAgent, chosenState());
}
function readSmashFields() {
  if (!SMASH) return;
  const val = id => { const el = document.getElementById(id); return el ? el.value : null; };
  ['where', 'words', 'notes'].forEach(key => { const v = val('smash-' + key); if (v != null) SMASH[key] = v; });
  const lat = val('smash-lat');
  const lng = val('smash-lng');
  if (lat != null && lat !== '') SMASH.lat = Number(lat);
  if (lng != null && lng !== '') SMASH.lng = Number(lng);
  const party = SMASH.party || {};
  ['name', 'phone', 'address', 'licence', 'rego', 'vehicle', 'insurer'].forEach(key => { const v = val('party-' + key); if (v != null) party[key] = v; });
  SMASH.party = party;
  const eventNo = val('police-event');
  if (eventNo != null) SMASH.policeEvent = eventNo;
  document.querySelectorAll('[data-witness]').forEach(input => {
    const index = Number(input.getAttribute('data-witness'));
    const field = input.getAttribute('data-field');
    if (!SMASH.witnesses[index]) SMASH.witnesses[index] = { id: 'w' + index, name: '', phone: '', note: '' };
    SMASH.witnesses[index][field] = input.value;
  });
}
function openSmash() {
  SMASH = (typeof readDraft === 'function' && readDraft(localStorage)) || blankDraft();
  if (!SMASH.startedAt) SMASH.startedAt = new Date().toISOString();
  if (!SMASH.witnesses) SMASH.witnesses = [];
  if (!SMASH.party) SMASH.party = {};
  writeDraft(localStorage, SMASH);
  paintSmash();
  captureSmashFix(false);
}
async function captureSmashFix(manual) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    if (!SMASH) return;
    readSmashFields();
    SMASH.lat = pos.coords.latitude;
    SMASH.lng = pos.coords.longitude;
    SMASH.accuracy = pos.coords.accuracy;
    try {
      if (navigator.onLine !== false && typeof reverseGeocode === 'function') SMASH.address = await reverseGeocode(SMASH.lat, SMASH.lng, window.fetch.bind(window));
    } catch (e) { if (manual) SMASH.address = ''; }
    const key = localStorage.getItem('rh-w3w-key') || '';
    if (key && !cleanWords(SMASH.words) && typeof fillWords === 'function') {
      try { const words = await fillWords(SMASH.lat, SMASH.lng, key, window.fetch.bind(window)); if (words) SMASH.words = words; } catch (e) {}
    }
    writeDraft(localStorage, SMASH);
    paintSmash();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
}
function stopScan() {
  if (scanStream) { scanStream.getTracks().forEach(track => track.stop()); scanStream = null; }
  const box = document.getElementById('qr-scan');
  if (box) box.remove();
}
async function startScan(purpose, siteId) {
  stopScan();
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  scanStream = stream;
  const wrap = document.createElement('div');
  wrap.id = 'qr-scan';
  wrap.className = 'gate-view';
  wrap.innerHTML = '<video id="qr-video" playsinline autoplay></video><button type="button" data-scan-stop>Close</button>';
  document.body.appendChild(wrap);
  const video = document.getElementById('qr-video');
  video.srcObject = stream;
  await video.play();
  let detector = null;
  if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; } }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  while (scanStream) {
    try {
      let text = '';
      if (detector) {
        const codes = await detector.detect(video);
        if (codes && codes[0]) text = codes[0].rawValue || '';
      } else if (typeof jsQR === 'function' && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        if (code) text = code.data || '';
      }
      if (text) { stopScan(); applyScan(purpose, siteId, text); return; }
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
function applyScan(purpose, siteId, text) {
  const sites = readSites(localStorage);
  const site = sites.find(item => item.id === siteId);
  if (!site) return;
  if (purpose === 'link') {
    if (!/^https?:\/\//i.test(text)) return;
    site.inductionUrl = text;
    saveSite(localStorage, site);
    if (confirm('Link saved on this phone. Open it?')) window.open(text, '_blank', 'noopener');
  } else {
    site.qrText = text.slice(0, 2000);
    saveSite(localStorage, site);
    showQr(site);
  }
  repaint();
}
function showGate(html, bright) {
  const old = document.getElementById('gate-view');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'gate-view';
  box.className = 'gate-view';
  box.style.background = bright ? '#fff' : '#000';
  box.innerHTML = html + '<button type="button" data-gate-close>Close</button>';
  document.body.appendChild(box);
}
async function showPhoto(key) {
  const files = store();
  if (!files) return;
  const data = await files.get(key);
  if (!data) return;
  showGate('<img alt="Saved on this phone" src="' + data + '">', false);
}
function showQr(site) {
  if (site.qrText && typeof qrcode === 'function') {
    const qr = qrcode(0, 'M');
    qr.addData(site.qrText);
    qr.make();
    showGate(qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }), true);
    return;
  }
  showPhoto('site:' + site.id + ':qr');
}
async function savePhoto(key, file) {
  const blob = await compressImage(file);
  const dataUrl = await blobToDataUrl(blob);
  await store().put(key, dataUrl);
}
async function sendToDepot() {
  if (!SMASH) return;
  readSmashFields();
  const saved = saveIncident(localStorage, SMASH);
  const employer = readEmployers(localStorage).find(item => item.id === saved.employerId) || readEmployers(localStorage)[0] || null;
  const summary = incidentSummary(saved, employer);
  const pdf = incidentPdf(summary);
  const files = store() ? await store().all() : [];
  const photoFiles = files.filter(row => String(row.key || '').indexOf('incident:' + saved.id + ':') === 0).map(row => new File([dataUrlToBlob(row.dataUrl)], row.key.replace(/:/g, '-') + '.jpg', { type: 'image/jpeg' }));
  const pdfFile = new File([pdf], 'incident-summary.pdf', { type: 'application/pdf' });
  let shared = false;
  if (navigator.share) {
    const payload = { title: 'Incident', text: summary };
    const shareFiles = photoFiles.concat([pdfFile]);
    try {
      if (!navigator.canShare || navigator.canShare({ files: shareFiles })) payload.files = shareFiles;
      await navigator.share(payload);
      shared = true;
    } catch (e) {}
  }
  if (!shared) downloadBytes('incident-summary.pdf', pdf, 'application/pdf');
  const mail = incidentMailto(employer, saved);
  if (mail) window.location.href = mail;
  SMASH = null;
  const root = document.getElementById('smash-root');
  if (root) root.innerHTML = '<div class="wiz"><h2>Saved on this phone</h2><p>Nothing was sent to the Drivers Advocate server.</p><button type="button" data-wiz="close">Close</button></div>';
}

function formValue(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function submitReminder() {
  const custom = formValue('rem-warn') === 'custom' ? formValue('rem-custom') : formValue('rem-warn');
  saveReminder(localStorage, { id: formValue('rem-id'), kind: formValue('rem-kind'), label: formValue('rem-label'), date: formValue('rem-date'), warnDays: custom });
  repaint();
}
function submitSite() {
  const existing = readSites(localStorage).find(item => item.id === formValue('site-id'));
  saveSite(localStorage, Object.assign({}, existing || {}, {
    id: formValue('site-id'), name: formValue('site-name'), location: formValue('site-location'),
    inductionLabel: formValue('site-induction'), inductionUrl: formValue('site-url'),
    completed: formValue('site-completed'), expiry: formValue('site-expiry'), warnDays: formValue('site-warn'), notes: formValue('site-notes')
  }));
  repaint();
}
function submitContact() {
  saveContact(localStorage, { name: formValue('contact-name'), role: formValue('contact-role'), phone: formValue('contact-phone') });
  repaint();
}
function submitEmployer() {
  const key = formValue('w3w-key');
  try { if (key) localStorage.setItem('rh-w3w-key', key); else localStorage.removeItem('rh-w3w-key'); } catch (e) {}
  saveEmployer(localStorage, {
    id: formValue('emp-id'), label: formValue('emp-label'), reportPhone: formValue('emp-phone'), reportEmail: formValue('emp-email'),
    afterHoursPhone: formValue('emp-after'), insurer: formValue('emp-insurer'), claimPhone: formValue('emp-claim'), policyNumber: formValue('emp-policy'),
    fleetUnit: formValue('emp-fleet'), rego: formValue('emp-rego'), companyName: formValue('emp-company'), abn: formValue('emp-abn'), instructions: formValue('emp-notes')
  });
  repaint();
}
function downloadIcs(token) {
  const parts = String(token || '').split(':');
  const kind = parts[0];
  const id = parts.slice(1).join(':');
  const row = kind === 'site' ? readSites(localStorage).find(item => item.id === id) : readReminders(localStorage).find(item => item.id === id);
  if (!row) return;
  const entry = kind === 'site' ? { id: row.id, label: row.name, date: row.expiry, warnDays: row.warnDays } : row;
  downloadBytes((entry.label || 'reminder') + '.ics', reminderIcs(entry), 'text/calendar');
}

document.getElementById('smash-glass').addEventListener('click', openSmash);
document.addEventListener('click', event => {
  const el = event.target && event.target.closest ? event.target.closest('[data-nearest-hospital],[data-wiz],[data-loc],[data-scan],[data-scan-stop],[data-show-qr],[data-view-photo],[data-gate-close],[data-here],[data-ics],[data-rem-edit],[data-rem-del],[data-site-edit],[data-site-del],[data-contact-del],[data-site-contact-del],[data-add-site-contact],[data-add-witness],[data-police],#personal-export') : null;
  if (!el) return;
  if (el.id === 'personal-export') {
    exportBackup(localStorage, store()).then(data => downloadBytes('drivers-advocate-phone-backup.json', JSON.stringify(data, null, 2), 'application/json'));
    return;
  }
  if (el.hasAttribute('data-nearest-hospital')) {
    event.preventDefault();
    const known = SMASH && Number.isFinite(Number(SMASH.lat)) ? SMASH : HERE;
    const open = (lat, lng) => window.open(hospitalMapUrl(lat, lng, navigator.userAgent), '_blank', 'noopener');
    if (known && Number.isFinite(Number(known.lat))) { open(known.lat, known.lng); return; }
    if (!navigator.geolocation) { open(); return; }
    navigator.geolocation.getCurrentPosition(pos => open(pos.coords.latitude, pos.coords.longitude), () => open(), { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 });
    return;
  }
  const wiz = el.getAttribute('data-wiz');
  if (wiz && SMASH) {
    readSmashFields();
    const ids = flowIds(SMASH);
    if (wiz === 'involved') { SMASH.path = 'involved'; SMASH.mode = ''; SMASH.step = 0; }
    else if (wiz === 'witness') { SMASH.path = 'witness'; SMASH.step = 0; }
    else if (wiz === 'minor') { SMASH.path = 'involved'; SMASH.mode = 'quick'; SMASH.step = 0; }
    else if (wiz === 'serious') { SMASH.path = 'involved'; SMASH.mode = 'serious'; SMASH.step = 0; }
    else if (wiz === 'skip') SMASH.step = Math.min(ids.length - 1, (SMASH.step || 0) + 1);
    else if (wiz === 'back') SMASH.step = Math.max(0, (SMASH.step || 0) - 1);
    else if (wiz === 'review') SMASH.step = Math.max(0, ids.length - 1);
    else if (wiz === 'send') { sendToDepot(); return; }
    else if (wiz === 'close') { document.getElementById('smash-root').innerHTML = ''; SMASH = null; return; }
    writeDraft(localStorage, SMASH);
    paintSmash();
    return;
  }
  if (!wiz && el.getAttribute('data-wiz') === 'close') { document.getElementById('smash-root').innerHTML = ''; return; }
  if (el.hasAttribute('data-scan-stop') || el.hasAttribute('data-gate-close')) { stopScan(); const gate = document.getElementById('gate-view'); if (gate) gate.remove(); return; }
  if (el.getAttribute('data-loc') === 'refresh') { readSmashFields(); captureSmashFix(true); return; }
  if (el.getAttribute('data-loc') === 'lookup' && SMASH) {
    readSmashFields();
    reverseGeocode(SMASH.lat, SMASH.lng, window.fetch.bind(window)).then(address => { SMASH.address = address; writeDraft(localStorage, SMASH); paintSmash(); }).catch(() => {});
    return;
  }
  const scan = el.getAttribute('data-scan');
  if (scan) { startScan(scan, el.getAttribute('data-site')); return; }
  const qr = el.getAttribute('data-show-qr');
  if (qr) { const site = readSites(localStorage).find(item => item.id === qr); if (site) showQr(site); return; }
  const photo = el.getAttribute('data-view-photo');
  if (photo) { showPhoto(photo); return; }
  const here = el.getAttribute('data-here');
  if (here && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const site = readSites(localStorage).find(item => item.id === here);
      if (!site) return;
      site.lat = pos.coords.latitude;
      site.lng = pos.coords.longitude;
      saveSite(localStorage, site);
      HERE = { lat: site.lat, lng: site.lng };
      repaint();
    }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
    return;
  }
  const ics = el.getAttribute('data-ics');
  if (ics) { downloadIcs(ics); return; }
  const editRem = el.getAttribute('data-rem-edit');
  if (editRem) {
    const row = readReminders(localStorage).find(item => item.id === editRem);
    if (!row) return;
    repaint();
    document.getElementById('rem-id').value = row.id;
    document.getElementById('rem-kind').value = row.kind;
    document.getElementById('rem-label').value = row.label;
    document.getElementById('rem-date').value = row.date;
    document.getElementById('rem-warn').value = [30, 60, 90, 120, 160].indexOf(row.warnDays) >= 0 ? String(row.warnDays) : 'custom';
    return;
  }
  if (el.hasAttribute('data-rem-del')) { deleteReminder(localStorage, el.getAttribute('data-rem-del')); repaint(); return; }
  const editSite = el.getAttribute('data-site-edit');
  if (editSite) {
    const row = readSites(localStorage).find(item => item.id === editSite);
    if (!row) return;
    document.getElementById('site-id').value = row.id;
    document.getElementById('site-name').value = row.name;
    document.getElementById('site-location').value = row.location;
    document.getElementById('site-induction').value = row.inductionLabel;
    document.getElementById('site-url').value = row.inductionUrl;
    document.getElementById('site-completed').value = row.completed;
    document.getElementById('site-expiry').value = row.expiry;
    document.getElementById('site-warn').value = row.warnDays || 30;
    document.getElementById('site-notes').value = row.notes;
    return;
  }
  if (el.hasAttribute('data-site-del')) { deleteSite(localStorage, el.getAttribute('data-site-del')); repaint(); return; }
  if (el.hasAttribute('data-contact-del')) { deleteContact(localStorage, el.getAttribute('data-contact-del')); repaint(); return; }
  const addContact = el.getAttribute('data-add-site-contact');
  if (addContact) {
    const card = el.closest('article');
    const site = readSites(localStorage).find(item => item.id === addContact);
    if (!site || !card) return;
    site.contacts = (site.contacts || []).concat([{ name: card.querySelector('[data-c-name]').value, role: card.querySelector('[data-c-role]').value, phone: card.querySelector('[data-c-phone]').value, email: card.querySelector('[data-c-email]').value }]);
    saveSite(localStorage, site);
    repaint();
    return;
  }
  const dropContact = el.getAttribute('data-site-contact-del');
  if (dropContact) {
    const site = readSites(localStorage).find(item => item.id === dropContact);
    if (!site) return;
    site.contacts = (site.contacts || []).filter(item => item.id !== el.getAttribute('data-contact-id'));
    saveSite(localStorage, site);
    repaint();
    return;
  }
  if (el.hasAttribute('data-add-witness') && SMASH) {
    readSmashFields();
    SMASH.witnesses.push({ id: 'w' + Date.now(), name: '', phone: '', note: '' });
    paintSmash();
    return;
  }
  const police = el.getAttribute('data-police');
  if (police && SMASH) { SMASH.police = police; writeDraft(localStorage, SMASH); paintSmash(); }
});
document.addEventListener('change', event => {
  const t = event.target;
  if (!t) return;
  if (t.matches && t.matches('[data-std-kind]') && typeof readStdFilter === 'function') {
    const filter = readStdFilter(localStorage);
    filter.kinds[t.getAttribute('data-std-kind')] = t.checked;
    writeStdFilter(localStorage, filter);
    repaint();
    return;
  }
  if (t.id === 'site-sort') { siteSort = t.value; repaint(); return; }
  if (t.id === 'personal-import' && t.files && t.files[0]) {
    const reader = new FileReader();
    reader.onload = async () => { await importBackup(localStorage, String(reader.result || ''), store()); repaint(); };
    reader.readAsText(t.files[0]);
    return;
  }
  const shot = t.getAttribute('data-shot');
  if (shot && SMASH && t.files && t.files[0]) {
    const key = 'incident:' + SMASH.id + ':' + shot + ':' + Date.now();
    savePhoto(key, t.files[0]).then(() => { SMASH.photoKeys = (SMASH.photoKeys || []).concat([key]); writeDraft(localStorage, SMASH); });
    return;
  }
  const sitePhoto = t.getAttribute('data-site-photo');
  if (sitePhoto && t.files && t.files[0]) savePhoto('site:' + sitePhoto + ':' + t.getAttribute('data-slot'), t.files[0]);
});
document.addEventListener('input', event => {
  if (!event.target || event.target.id !== 'site-q') return;
  siteQuery = event.target.value;
  const q = siteQuery.trim().toLowerCase();
  document.querySelectorAll('.site-item').forEach(el => { el.hidden = !!(q && (el.getAttribute('data-site-name') || '').indexOf(q) < 0); });
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!form || !form.id) return;
  if (form.id === 'rem-form') { event.preventDefault(); submitReminder(); }
  if (form.id === 'site-form') { event.preventDefault(); submitSite(); }
  if (form.id === 'contact-form') { event.preventDefault(); submitContact(); }
  if (form.id === 'emp-form') { event.preventDefault(); submitEmployer(); }
});
window.phoneEventStatus = phoneEventStatus;
window.sitesPageHtml = sitesPageHtml;
window.phoneCalendarMarks = phoneCalendarMarks;
window.refreshStandard = refreshStandard;
refreshStandard();
if (typeof sitesHavePins === 'function' && sitesHavePins(localStorage) && navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => { HERE = { lat: pos.coords.latitude, lng: pos.coords.longitude }; repaint(); }, () => {}, { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 });
}
})();

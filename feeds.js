// Automation: every 30 min, pull the RSS/Atom feeds an admin has added and store new items.
const crypto = require('crypto'), dns = require('dns').promises, net = require('net');
const { XMLParser } = require('fast-xml-parser');
const { OUTLETS, transportRelated, parseIncidents, cleanHeadline } = require('./outlets');
const px = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const MAX_BYTES = 2 * 1024 * 1024, MAX_REDIRECTS = 3;
const arr = x => x == null ? [] : [].concat(x);
const tx = x => x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x);
const strip = h => tx(h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const http = u => /^https?:\/\//i.test(u || '') ? u : '';

function isPrivateIp(ip) {
  let s = String(ip || '').toLowerCase().split('%')[0];
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) s = mapped[1];
  if (net.isIPv4(s)) {
    const p = s.split('.').map(Number);
    if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b, c] = p;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (!net.isIPv6(s)) return true;
  if (s === '::' || s === '::1') return true;
  const head = s.split(':').filter(Boolean)[0] || '0';
  if (/^f[cd]/i.test(head)) return true;
  const n = parseInt(head, 16);
  if (n >= 0xfe80 && n <= 0xfebf) return true;
  if (n >= 0xff00) return true;
  if (s.startsWith('2001:db8')) return true;
  return false;
}

function blockedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === 'metadata.google.internal' || host === 'metadata.goog') return true;
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return true;
    const ip = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    return isPrivateIp(ip);
  }
  return false;
}

async function assertPublicUrl(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { throw new Error('Invalid feed URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Feed URL must be http or https');
  if (u.username || u.password) throw new Error('Feed URL must not include credentials');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (blockedHost(host)) throw new Error('Feed URL points at a blocked address');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Feed URL points at a blocked address');
    return u;
  }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true, verbatim: true }); }
  catch { throw new Error('Could not resolve feed host'); }
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('Feed URL points at a blocked address');
  return u;
}

async function readLimited(res) {
  if (!res.body || !res.body.getReader) return await res.text();
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > MAX_BYTES) { await reader.cancel(); throw new Error('Feed response is too large'); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchFeed(urlStr, fetchImpl = fetch) {
  let current = urlStr;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const r = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'GoRoadHub/1.0 feed reader', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8' }
    });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      if (r.body && r.body.cancel) await r.body.cancel().catch(() => {});
      const loc = r.headers.get('location');
      if (!loc) throw new Error('Redirect with no location');
      current = new URL(loc, current).href;
      continue;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return readLimited(r);
  }
  throw new Error('Too many redirects');
}

function linkOf(it) {
  const links = arr(it.link);
  const preferred = links.find(L => L && typeof L === 'object' && (L['@_rel'] || 'alternate') === 'alternate')
    || links.find(L => L && typeof L === 'object' && L['@_href'])
    || links[0];
  if (preferred && typeof preferred === 'object') return preferred['@_href'] || '';
  return tx(preferred);
}

function parseFeed(xml) {
  const j = px.parse(String(xml || '')), ch = j.rss && j.rss.channel;
  const items = ch ? arr(ch.item) : arr(j.feed && j.feed.entry);
  const chImg = ch && ch['itunes:image'] && ch['itunes:image']['@_href'] || '';
  return items.slice(0, 60).map(it => {
    const html = tx(it['content:encoded'] || it.content || it.description || it.summary);
    const link = linkOf(it);
    const enc = arr(it.enclosure)[0], mc = arr(it['media:content'])[0] || arr(it['media:thumbnail'])[0];
    const img = (mc && mc['@_url']) || (enc && /image/.test(enc['@_type'] || '') ? enc['@_url'] : '') || ((html.match(/<img[^>]+src=["']([^"']+)/i) || [])[1]) || (it['itunes:image'] && it['itunes:image']['@_href']) || '';
    const d = new Date(tx(it.pubDate || it.published || it.updated || it['dc:date']));
    return { guid: tx(it.guid) || tx(it.id) || link || tx(it.title), h: strip(it.title), x: strip(html).slice(0, 400), link: http(link), img: http(img), chImg: http(chImg),
      at: isNaN(d) ? Date.now() : d.getTime(), audio: enc && /audio|video/.test(enc['@_type'] || '') ? http(enc['@_url']) : '', dur: tx(it['itunes:duration']) };
  }).filter(i => i.h && !/^(redirecting\.*|facebook|log ?in.*)$/i.test(i.h) && !/\/login(\/|$|\?)/.test(i.link)).slice(0, 30);
}

async function pull(f) { return parseFeed(await fetchFeed(f.url)); }

const POST_KEYS = ['h', 'x', 'url', 'img', 'at', 'a', 'srcName', 'logo'];
const EPISODE_KEYS = ['h', 'x', 'audio', 'img', 'at', 'dur', 'url', 'show'];
const TRAFFIC_KEYS = ['h', 'x', 'url', 'at', 'a', 'srcName', 'logo'];
const WEEK = 7 * 24 * 60 * 60 * 1000;

async function ensureOutlets(pool) {
  for (const o of OUTLETS) {
    const data = {
      url: o.feed, name: o.name, src: o.src, topic: o.topic, g: -1,
      logo: o.logo, home: o.home, builtin: true, kind: o.kind, filter: o.filter === true
    };
    await pool.query(
      `insert into docs(coll, id, data) values('feeds', $1, $2)
       on conflict (coll, id) do update set data = docs.data || excluded.data`,
      ['outlet-' + o.id, data]
    );
  }
}

function changedPatch(old, data, keys) {
  const patch = {};
  for (const key of keys) {
    if (data[key] === undefined) continue;
    if (!old || JSON.stringify(old[key]) !== JSON.stringify(data[key])) patch[key] = data[key];
  }
  return patch;
}

async function storeItem(pool, coll, id, data, keys) {
  const found = await pool.query('select data from docs where coll = $1 and id = $2', [coll, id]);
  if (!found.rowCount) {
    await pool.query('insert into docs(coll, id, data) values($1, $2, $3)', [coll, id, data]);
    return 'added';
  }
  const patch = changedPatch(found.rows[0].data, data, keys);
  if (!Object.keys(patch).length) return 'same';
  await pool.query('update docs set data = data || $3::jsonb where coll = $1 and id = $2', [coll, id, JSON.stringify(patch)]);
  return 'updated';
}

function install(app, pool, need) {
  let busy = false;
  async function refresh() {
    if (busy) return { busy: true };
    busy = true;
    const out = { added: 0, updated: 0, errors: [] };
    try {
      await ensureOutlets(pool);
      const fs = await pool.query("select data from docs where coll = 'feeds'");
      for (const { data: f } of fs.rows) {
        try {
          if (!http(f.url)) continue;
          const pod = f.src === 'podcast';
          const traffic = f.kind === 'traffic';
          let items;
          if (traffic) items = parseIncidents(await fetchFeed(f.url));
          else {
            items = await pull(f);
            if (f.filter) items = items.filter(it => transportRelated(it.h + ' ' + it.x)).slice(0, 8);
          }
          const kept = [];
          for (const it of items) {
            if (pod && !it.audio) continue;
            const id = crypto.createHash('sha1').update(f.url + '|' + it.guid).digest('hex').slice(0, 20);
            kept.push(id);
            const data = pod
              ? { h: it.h, x: it.x, audio: it.audio, img: it.img || it.chImg, at: it.at, dur: it.dur, url: it.link, show: f.name }
              : traffic
                ? { a: f.name, h: it.h, x: it.x, url: it.link, src: 'traffic', srcName: f.name, logo: f.logo || '', at: it.at, auto: true }
                : { g: f.g == null ? -1 : +f.g, a: f.name, t: f.topic || 'Industry News', h: cleanHeadline(it.h), x: it.x, url: it.link, img: it.img, src: f.src || 'news', srcName: f.name, logo: f.logo || '', l: 0, c: 0, pin: false, at: it.at, ord: it.at, auto: true };
            const status = await storeItem(pool, pod ? 'episodes' : traffic ? 'traffic' : 'posts', id, data, pod ? EPISODE_KEYS : traffic ? TRAFFIC_KEYS : POST_KEYS);
            if (status === 'added') out.added++;
            else if (status === 'updated') out.updated++;
          }
          if (traffic) {
            await pool.query("delete from docs where coll = 'traffic' and not (id = any($1::text[]))", [kept.length ? kept : ['']]);
          }
        } catch (e) { out.errors.push((f.name || f.url) + ': ' + e.message); }
      }
      await pool.query(
        "delete from docs where coll = 'posts' and data->>'auto' = 'true' and data->>'src' = 'news' and coalesce((data->>'at')::double precision, 0) < $1",
        [Date.now() - WEEK]
      );
    } finally { busy = false; }
    return out;
  }
  app.post('/api/refresh', need, (q, r) => refresh().then(x => r.json(x)).catch(e => r.status(500).json({ error: e.message })));
  setTimeout(() => refresh().catch(console.error), 15000);
  setInterval(() => refresh().catch(console.error), 30 * 60 * 1000);
}

install.parseFeed = parseFeed;
install.changedPatch = changedPatch;
install.POST_KEYS = POST_KEYS;
install.fetchFeed = fetchFeed;
install.assertPublicUrl = assertPublicUrl;
install.isPrivateIp = isPrivateIp;
module.exports = install;

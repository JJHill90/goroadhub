// Automation: every 30 min, pull the RSS/Atom feeds an admin has added and store new items.
const crypto = require('crypto'), { XMLParser } = require('fast-xml-parser');
const px = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const arr = x => x == null ? [] : [].concat(x);
const tx = x => x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x);
const strip = h => tx(h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const http = u => /^https?:\/\//i.test(u || '') ? u : '';

async function pull(f) {
  const r = await fetch(f.url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'GoRoadHub/1.0 feed reader' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = px.parse(await r.text()), ch = j.rss && j.rss.channel;
  const items = ch ? arr(ch.item) : arr(j.feed && j.feed.entry);
  const chImg = ch && ch['itunes:image'] && ch['itunes:image']['@_href'] || '';
  return items.slice(0, 60).map(it => {
    const html = tx(it['content:encoded'] || it.content || it.description || it.summary);
    const L = arr(it.link)[0], link = L && typeof L === 'object' ? (L['@_href'] || '') : tx(L);
    const enc = arr(it.enclosure)[0], mc = arr(it['media:content'])[0] || arr(it['media:thumbnail'])[0];
    const img = (mc && mc['@_url']) || (enc && /image/.test(enc['@_type'] || '') ? enc['@_url'] : '') || ((html.match(/<img[^>]+src=["']([^"']+)/i) || [])[1]) || (it['itunes:image'] && it['itunes:image']['@_href']) || '';
    const d = new Date(tx(it.pubDate || it.published || it.updated || it['dc:date']));
    return { guid: tx(it.guid) || link || tx(it.title), h: strip(it.title), x: strip(html).slice(0, 400), link: http(link), img: http(img), chImg: http(chImg),
      at: isNaN(d) ? Date.now() : d.getTime(), audio: enc && /audio|video/.test(enc['@_type'] || '') ? http(enc['@_url']) : '', dur: tx(it['itunes:duration']) };
  }).filter(i => i.h && !/^(redirecting\.*|facebook|log ?in.*)$/i.test(i.h) && !/\/login(\/|$|\?)/.test(i.link)).slice(0, 30); // drop junk pages some auto-generated feeds pick up
}

module.exports = (app, pool, need) => {
  let busy = false;
  async function refresh() {
    if (busy) return { busy: true };
    busy = true;
    const out = { added: 0, errors: [] };
    try {
      const fs = await pool.query("select data from docs where coll = 'feeds'");
      for (const { data: f } of fs.rows) {
        try {
          if (!http(f.url)) continue;
          const pod = f.src === 'podcast';
          for (const it of await pull(f)) {
            if (pod && !it.audio) continue;
            const id = crypto.createHash('sha1').update(f.url + '|' + it.guid).digest('hex').slice(0, 20);
            const data = pod
              ? { h: it.h, x: it.x, audio: it.audio, img: it.img || it.chImg, at: it.at, dur: it.dur, url: it.link, show: f.name }
              : { g: f.g == null ? -1 : +f.g, a: f.name, t: f.topic || 'Industry News', h: it.h, x: it.x, url: it.link, img: it.img, src: f.src || 'news', srcName: f.name, l: 0, c: 0, pin: false, at: it.at, ord: it.at, auto: true };
            const r = await pool.query('insert into docs(coll, id, data) values($1, $2, $3) on conflict do nothing', [pod ? 'episodes' : 'posts', id, data]);
            out.added += r.rowCount;
          }
        } catch (e) { out.errors.push((f.name || f.url) + ': ' + e.message); }
      }
    } finally { busy = false; }
    return out;
  }
  app.post('/api/refresh', need, (q, r) => refresh().then(x => r.json(x)).catch(e => r.status(500).json({ error: e.message })));
  setTimeout(() => refresh().catch(console.error), 15000);
  setInterval(() => refresh().catch(console.error), 30 * 60 * 1000);
};

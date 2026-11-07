const { fetchFeed } = require('./feeds');
const fallback = require('./public/advocate.json');

// Older numeric group ids on tdaau.com, kept so a live homepage card still maps to one Facebook link.
const ALIASES = {
  '1063426956322044': 'thedriversadvocateturckingnews',
  '1793368841975193': 'thedriversadvocatepromotingaustraliantransport',
  '1599997731918811': 'healthandwelfare',
  '1036518402724413': 'thedriversadvocatelegalmatters',
  '1064792576427449': 'thedriversadvocatetruckshows',
  '2173765266827526': 'thedriversadvocateemployment',
  '1615671469942614': 'tdataxationincomeandexpenditure'
};

function canonicalKey(url) {
  const key = facebookKey(url);
  return ALIASES[key] || key;
}

const SITES = {};
const PREFERRED = new Map();
for (const page of fallback) {
  const key = facebookKey(page.facebook);
  PREFERRED.set(key, page);
  if (page.site) SITES[key] = page.site;
}
for (const [oldKey, canonical] of Object.entries(ALIASES)) {
  if (SITES[canonical]) SITES[oldKey] = SITES[canonical];
}

function decode(text) {
  return String(text || '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function facebookKey(url) {
  const match = String(url || '').match(/groups\/([^/?#]+)/i);
  return match ? match[1].replace(/\/$/, '').toLowerCase() : '';
}

function parseAdvocateHome(html) {
  const re = /<a class="cell cell--group" href="([^"]+)"[\s\S]*?<span class="cell__kicker">([\s\S]*?)<\/span>[\s\S]*?<h3 class="cell__name">([\s\S]*?)<\/h3>[\s\S]*?<p class="cell__blurb">([\s\S]*?)<\/p>/g;
  const pages = [];
  let match;
  while ((match = re.exec(String(html || '')))) {
    const facebook = match[1].trim();
    const key = canonicalKey(facebook);
    if (!key) continue;
    pages.push({
      kicker: decode(match[2]),
      name: decode(match[3]),
      blurb: decode(match[4]),
      facebook,
      site: SITES[facebookKey(facebook)] || SITES[key] || ''
    });
  }
  return pages;
}

let cache = { at: 0, pages: null };

// public/advocate.json order is the Newsletter order: 28-day views, then members.
// Truck Drivers Food and Showers stays second. Work Diaries & EWD stays last.
function withPreferredLink(page) {
  const key = canonicalKey(page && page.facebook);
  const preferred = PREFERRED.get(key);
  if (!preferred) return page;
  return { ...page, name: preferred.name, facebook: preferred.facebook, site: preferred.site || page.site || '' };
}

function orderAdvocatePages(pages) {
  const seen = new Set();
  const merged = [];
  for (const page of [...(pages || []), ...fallback]) {
    const next = withPreferredLink(page);
    const key = canonicalKey(next && next.facebook);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(next);
  }
  const rank = new Map(fallback.map((page, i) => [facebookKey(page.facebook), i]));
  const tail = rank.size;
  merged.sort((a, b) => {
    const ka = canonicalKey(a.facebook);
    const kb = canonicalKey(b.facebook);
    return (rank.has(ka) ? rank.get(ka) : tail) - (rank.has(kb) ? rank.get(kb) : tail);
  });
  return merged;
}

async function advocatePages(now = Date.now) {
  if (cache.pages && now() - cache.at < 30 * 60 * 1000) return orderAdvocatePages(cache.pages);
  try {
    const html = await fetchFeed('https://tdaau.com/');
    const pages = parseAdvocateHome(html);
    if (pages.length) {
      cache = { at: now(), pages };
      return orderAdvocatePages(pages);
    }
  } catch (err) {
    console.error('Advocate site:', err.message);
  }
  return orderAdvocatePages(cache.pages || fallback);
}

module.exports = { parseAdvocateHome, advocatePages, facebookKey, orderAdvocatePages };

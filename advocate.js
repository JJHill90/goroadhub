const { fetchFeed } = require('./feeds');
const fallback = require('./public/advocate.json');

const SITES = Object.fromEntries(fallback.map(page => [facebookKey(page.facebook), page.site]));

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
    const key = facebookKey(facebook);
    if (!key) continue;
    pages.push({
      kicker: decode(match[2]),
      name: decode(match[3]),
      blurb: decode(match[4]),
      facebook,
      site: SITES[key] || ''
    });
  }
  return pages;
}

let cache = { at: 0, pages: null };

async function advocatePages(now = Date.now) {
  if (cache.pages && now() - cache.at < 30 * 60 * 1000) return cache.pages;
  try {
    const html = await fetchFeed('https://tdaau.com/');
    const pages = parseAdvocateHome(html);
    if (pages.length) {
      cache = { at: now(), pages };
      return pages;
    }
  } catch (err) {
    console.error('Advocate site:', err.message);
  }
  return cache.pages || fallback;
}

module.exports = { parseAdvocateHome, advocatePages, facebookKey };

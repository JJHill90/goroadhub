// Public Australian transport sources. Feeds are the outlet's own RSS, except
// news.com.au, whose RSS responses are empty. Those headlines come from the
// public Google News listing of news.com.au stories. Logos are each site's favicon.
const TRANSPORT = /\b(?:freight|haulage|logistics|trucks?|truckers?|trucking|heavy vehicles?|road trains?|b-doubles?|semi-trailers?|motorways?|highways?|freeways?|tollways?|congestion|road closures?|lane closures?|traffic chaos|live traffic|buses|bus crash|ferries|ferry|rail freight|commuters?|airports?|aviation|wharves|wharf|container ships?|shipping|maritime|pedestrians?|cyclists?|crashes|crash|collisions?|pile-?ups?|roadworks|road works?|bridge closures?|tunnels?|ports?|rail|train delays?)\b/i;

function googleNews(query) {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-AU&gl=AU&ceid=AU:en';
}

function favicon(host) {
  return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64';
}

const OUTLETS = [
  {
    id: 'newscomau',
    name: 'news.com.au',
    home: 'https://www.news.com.au/',
    logo: 'https://www.news.com.au/favicon.ico',
    feed: googleNews('site:news.com.au (truck OR trucks OR freight OR motorway OR highway OR freeway OR "road closure" OR congestion OR roadworks OR "heavy vehicle" OR haulage OR "truck driver" OR "bus crash" OR "train delay")'),
    src: 'news',
    topic: 'Industry News',
    kind: 'news',
    filter: true
  },
  { id: 'abc', name: 'ABC News', home: 'https://www.abc.net.au/news/', logo: 'https://www.abc.net.au/favicon.ico', feed: 'https://www.abc.net.au/news/feed/51120/rss.xml', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'guardian', name: 'Guardian Australia', home: 'https://www.theguardian.com/au', logo: 'https://www.theguardian.com/favicon.ico', feed: 'https://www.theguardian.com/australia-news/rss', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'seven', name: '7NEWS', home: 'https://www.7news.com.au/', logo: 'https://www.7news.com.au/favicon.ico', feed: 'https://www.7news.com.au/feed', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'smh', name: 'The Sydney Morning Herald', home: 'https://www.smh.com.au/', logo: 'https://www.smh.com.au/favicon.ico', feed: 'https://www.smh.com.au/rss/feed.xml', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'age', name: 'The Age', home: 'https://www.theage.com.au/', logo: 'https://www.theage.com.au/favicon.ico', feed: 'https://www.theage.com.au/rss/national.xml', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'bt', name: 'Brisbane Times', home: 'https://www.brisbanetimes.com.au/', logo: 'https://www.brisbanetimes.com.au/favicon.ico', feed: 'https://www.brisbanetimes.com.au/rss/national.xml', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'watoday', name: 'WAtoday', home: 'https://www.watoday.com.au/', logo: 'https://www.watoday.com.au/favicon.ico', feed: 'https://www.watoday.com.au/rss/national.xml', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'canberra', name: 'The Canberra Times', home: 'https://www.canberratimes.com.au/', logo: favicon('canberratimes.com.au'), feed: 'https://www.canberratimes.com.au/rss.xml', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'perthnow', name: 'PerthNow', home: 'https://www.perthnow.com.au/', logo: favicon('perthnow.com.au'), feed: 'https://www.perthnow.com.au/news/rss', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  { id: 'afr', name: 'Australian Financial Review', home: 'https://www.afr.com/', logo: 'https://www.afr.com/favicon.ico', feed: 'https://www.afr.com/rss/feed.xml', src: 'news', topic: 'Industry News', kind: 'news', filter: true },
  {
    id: 'livetraffic-nsw',
    name: 'Live Traffic NSW',
    home: 'https://www.livetraffic.com/',
    logo: favicon('livetraffic.com'),
    feed: 'https://data.livetraffic.com/traffic/hazards/incident.json',
    src: 'traffic',
    topic: 'Roadworks',
    kind: 'traffic',
    filter: false
  }
];

function transportRelated(text) {
  return TRANSPORT.test(String(text || ''));
}

function cleanHeadline(h) {
  return String(h || '').replace(/\s[-–|]\s(?:News\.com\.au|ABC News|The Guardian(?: Australia)?|Guardian Australia|7NEWS|7News|The Sydney Morning Herald|Sydney Morning Herald|The Age|Brisbane Times|WAtoday|The Canberra Times|Canberra Times|PerthNow|Perth Now|Australian Financial Review|AFR|ABC)\s*$/i, '').trim();
}

function plain(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function roadLine(road) {
  if (!road || typeof road !== 'object') return '';
  const street = [road.mainStreet, road.crossStreet].filter(Boolean).join(' at ');
  const span = road.locationQualifier && road.secondLocation ? String(road.locationQualifier) + ' ' + String(road.secondLocation) : '';
  const place = [road.suburb, road.region].filter(Boolean).join(', ');
  return [street, span, place].filter(Boolean).join(', ');
}

function incidentHeadline(p) {
  const given = plain(p.headline || p.name);
  if (given) return given;
  const road = (Array.isArray(p.roads) ? p.roads[0] : null) || {};
  const where = [road.mainStreet, road.suburb || road.region].filter(Boolean).join(', ');
  const cat = String(p.mainCategory || p.incidentKind || '').replace(/\s+/g, ' ').trim();
  if (!where && !cat) return '';
  return [cat || 'Traffic', where].filter(Boolean).join(' · ');
}

function incidentLink(p) {
  if (/^https?:\/\//i.test(p.weblinkUrl || '')) return p.weblinkUrl;
  const links = Array.isArray(p.webLinks) ? p.webLinks : [];
  const found = links.find(l => l && /^https?:\/\//i.test(l.linkURL || ''));
  return found ? found.linkURL : 'https://www.livetraffic.com/';
}

function parseIncidents(raw, now = Date.now()) {
  let doc = raw;
  if (typeof raw === 'string') {
    try { doc = JSON.parse(raw); } catch { return []; }
  }
  if (!doc || typeof doc !== 'object') return [];
  const features = Array.isArray(doc.features) ? doc.features : [];
  const items = [];
  for (const feature of features) {
    const p = feature && feature.properties;
    if (!p || p.ended) continue;
    const h = incidentHeadline(p);
    if (!h) continue;
    const advice = [p.adviceA, p.adviceB, p.adviceC, p.otherAdvice].map(plain).filter(Boolean);
    const roads = (Array.isArray(p.roads) ? p.roads : []).map(roadLine).filter(Boolean);
    const delayText = plain(p.expectedDelay);
    const delay = delayText && delayText !== '-1' ? 'Expected delay ' + delayText : '';
    const link = incidentLink(p);
    const at = Date.parse(p.lastUpdated || p.created || '');
    items.push({
      guid: String(feature.id || h),
      h,
      x: [...advice, delay, ...roads].filter(Boolean).join(' · ').slice(0, 400),
      link,
      img: '',
      at: Number.isFinite(at) ? at : now,
      major: p.isMajor === true
    });
  }
  items.sort((a, b) => (b.major - a.major) || (b.at - a.at));
  return items.slice(0, 18);
}

function publicOutlets() {
  return OUTLETS.map(o => ({ id: o.id, name: o.name, home: o.home, logo: o.logo, kind: o.kind }));
}

module.exports = { OUTLETS, transportRelated, cleanHeadline, parseIncidents, publicOutlets };

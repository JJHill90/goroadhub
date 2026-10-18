const test = require('node:test');
const assert = require('node:assert/strict');
const { OUTLETS, transportRelated, cleanHeadline, parseIncidents, publicOutlets } = require('../outlets');
const published = require('../public/outlets.json');

test('transport wording keeps road stories and drops general news', () => {
  assert.equal(transportRelated('Army truck overturns in traffic chaos'), true);
  assert.equal(transportRelated('Lane closures on the M1 motorway'), true);
  assert.equal(transportRelated('Freight delays at Port of Melbourne'), true);
  assert.equal(transportRelated('Deadly ant species detected in Sydney'), false);
  assert.equal(transportRelated('Heartwarming moment city workers bring foot traffic to a standstill'), false);
  assert.equal(transportRelated('Business lunch menu for the week'), false);
});

test('outlet suffixes are removed from headlines', () => {
  assert.equal(cleanHeadline('Army truck overturns - News.com.au'), 'Army truck overturns');
  assert.equal(cleanHeadline('Bridge closure | ABC News'), 'Bridge closure');
  assert.equal(cleanHeadline('Plain headline'), 'Plain headline');
});

test('open NSW incidents keep the headline, advice and road', () => {
  const items = parseIncidents({
    features: [
      { id: 1, properties: { ended: true, headline: 'OLD', adviceA: 'Gone', roads: [] } },
      {
        id: 9,
        properties: {
          ended: false,
          isMajor: true,
          headline: 'CHANGED TRAFFIC CONDITIONS Snowy 2.0 road closure',
          adviceA: '<p><strong>Plan your journey</strong></p>',
          expectedDelay: '-1',
          lastUpdated: '2026-10-18T00:00:00Z',
          weblinkUrl: 'https://www.livetraffic.com/incident/9',
          roads: [{ mainStreet: 'Lobs Hole Ravine Road', locationQualifier: 'between', secondLocation: 'Link Road', suburb: 'Yarrangobilly to Cabramurra', region: 'Snowy Mountains' }]
        }
      },
      { id: 3, properties: { ended: false, headline: '', name: '' } }
    ]
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].guid, '9');
  assert.match(items[0].h, /Snowy 2\.0/);
  assert.match(items[0].x, /Plan your journey/);
  assert.doesNotMatch(items[0].x, /<|>|Expected delay/);
  assert.match(items[0].x, /Lobs Hole Ravine Road/);
  assert.match(items[0].x, /Snowy Mountains/);
  assert.equal(items[0].link, 'https://www.livetraffic.com/incident/9');
  assert.equal(items[0].major, true);
});

test('an incident with no headline uses the category and the road', () => {
  const [item] = parseIncidents({
    features: [{
      id: 4,
      properties: {
        ended: false,
        headline: '',
        mainCategory: 'CHANGED TRAFFIC CONDITIONS',
        adviceA: 'Plan your journey',
        webLinks: [{ linkText: 'Snowy 2.0 roads and access', linkURL: 'https://www.snowyhydro.com.au/snowy-20/roads-and-access/' }],
        roads: [{ mainStreet: 'Lobs Hole Ravine Road', suburb: 'Yarrangobilly to Cabramurra' }]
      }
    }]
  });
  assert.match(item.h, /CHANGED TRAFFIC CONDITIONS/);
  assert.match(item.h, /Lobs Hole Ravine Road/);
  assert.match(item.x, /Plan your journey/);
  assert.equal(item.link, 'https://www.snowyhydro.com.au/snowy-20/roads-and-access/');
});

test('bad incident payloads become an empty report', () => {
  assert.deepEqual(parseIncidents('not json'), []);
  assert.deepEqual(parseIncidents({}), []);
});

test('eleven public news outlets plus Live Traffic NSW', () => {
  assert.equal(OUTLETS.length, 12);
  assert.equal(OUTLETS.filter(o => o.kind === 'news').length, 11);
  assert.equal(OUTLETS.filter(o => o.kind === 'traffic').length, 1);
  assert.equal(new Set(OUTLETS.map(o => o.id)).size, OUTLETS.length);
  for (const o of OUTLETS) {
    assert.match(o.home, /^https:\/\//);
    assert.match(o.logo, /^https:\/\//);
    assert.match(o.feed, /^https:\/\//);
  }
  const news = OUTLETS.find(o => o.id === 'newscomau');
  assert.match(news.feed, /news\.google\.com/);
  assert.match(decodeURIComponent(news.feed), /site:news\.com\.au/);
  assert.equal(news.filter, true);
  assert.equal(OUTLETS.find(o => o.kind === 'traffic').feed, 'https://data.livetraffic.com/traffic/hazards/incident.json');
  assert.deepEqual(published, publicOutlets());
});

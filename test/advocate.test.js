const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseAdvocateHome, orderAdvocatePages, facebookKey } = require('../advocate');

test('the Advocate homepage cards become home widgets', () => {
  const html = `
    <a class="cell cell--group" href="https://www.facebook.com/groups/thedriversadvocate/">
      <span class="cell__kicker">The main room</span>
      <h3 class="cell__name">The Drivers Advocate</h3>
      <p class="cell__blurb">The main room. Anything that hasn&#x27;t got a group of its own.</p>
    </a>
    <a class="cell cell--group" href="https://www.facebook.com/groups/1063426956322044">
      <span class="cell__kicker">News</span>
      <h3 class="cell__name">Trucking News</h3>
      <p class="cell__blurb">What&#x27;s happening in the industry.</p>
    </a>`;
  const pages = parseAdvocateHome(html);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].name, 'The Drivers Advocate');
  assert.equal(pages[0].blurb, "The main room. Anything that hasn't got a group of its own.");
  assert.equal(pages[0].site, 'https://tdaau.com/groups/the-drivers-advocate/');
  assert.equal(pages[1].kicker, 'News');
  assert.equal(pages[1].site, 'https://tdaau.com/groups/trucking-news/');
});

test('newsletter groups follow the set Facebook list, with the partner group second', () => {
  const pages = require('../public/advocate.json');
  assert.deepEqual(pages.map(page => [page.name, page.facebook]), [
    ['The Drivers Advocate', 'https://www.facebook.com/groups/thedriversadvocate'],
    ['Truck Drivers Food and Showers Australia', 'https://www.facebook.com/groups/217669642677604/'],
    ['Compliance & Induction', 'https://www.facebook.com/groups/1792433288617560'],
    ['Work Diaries and EWDs', 'https://www.facebook.com/groups/977148505415763'],
    ['Taxation', 'https://www.facebook.com/groups/tdataxationincomeandexpenditure/'],
    ['Legal Matters', 'https://www.facebook.com/groups/thedriversadvocatelegalmatters/'],
    ['Promoting Australian Transport', 'https://www.facebook.com/groups/thedriversadvocatepromotingaustraliantransport/'],
    ['Employment', 'https://www.facebook.com/groups/thedriversadvocateemployment/'],
    ['Dash Cam', 'https://www.facebook.com/groups/ontheroaddashcam/'],
    ['Truck Shows', 'https://www.facebook.com/groups/thedriversadvocatetruckshows/'],
    ['Health and Welfare', 'https://www.facebook.com/groups/healthandwelfare/'],
    ['Trucking News', 'https://www.facebook.com/groups/thedriversadvocatetruckingnews/'],
    ['Winners, Losers and The Good Ones', 'https://www.facebook.com/groups/winnerslosersandgoodones/'],
    ['Loading and Load Restraint', 'https://www.facebook.com/groups/loadingandloadrestraints/'],
    ['Models And RC Kit', 'https://www.facebook.com/groups/thedriversadvocatemodelsandrckit/'],
    ['Ava Laugh Mate', 'https://www.facebook.com/groups/avalaughmate/'],
    ['Knowledge Bank', 'https://www.facebook.com/groups/thedriversadvocateknowledgebank/'],
    ['Repairs and Maintenance', 'https://www.facebook.com/groups/1568023681742778/'],
    ['Share The Road Bro', 'https://www.facebook.com/groups/broletssharetheroad/'],
    ['Technology Hub', 'https://www.facebook.com/groups/2346522435751912/'],
    ['Employ A Worker', 'https://www.facebook.com/groups/thedriversadvocateemployadriver/'],
    ['Trip Planner', 'https://www.facebook.com/groups/thedriversadvocatetripplanner/'],
    ['Not Well or Passed', 'https://www.facebook.com/groups/thedriversadvocatenotwellpassed/']
  ]);
  const ordered = orderAdvocatePages(parseAdvocateHome(htmlSample()));
  assert.equal(ordered[0].name, 'The Drivers Advocate');
  assert.equal(ordered[0].facebook, 'https://www.facebook.com/groups/thedriversadvocate');
  assert.equal(ordered[1].name, 'Truck Drivers Food and Showers Australia');
  assert.equal(ordered[1].facebook, 'https://www.facebook.com/groups/217669642677604/');
  assert.equal(ordered[ordered.length - 1].name, 'Not Well or Passed');
  assert.equal(ordered[ordered.length - 1].facebook, 'https://www.facebook.com/groups/thedriversadvocatenotwellpassed/');
  assert.equal(ordered.length, pages.length);
  assert.deepEqual(ordered.map(page => facebookKey(page.facebook)), pages.map(page => facebookKey(page.facebook)));
  const news = ordered.find(page => page.name === 'Trucking News');
  assert.equal(news.facebook, 'https://www.facebook.com/groups/thedriversadvocatetruckingnews/');
  assert.equal(news.site, 'https://tdaau.com/groups/trucking-news/');
  assert.equal(ordered.filter(page => page.name === 'Share The Road Bro').length, 1);
  assert.equal(ordered.find(page => page.name === 'Share The Road Bro').facebook, 'https://www.facebook.com/groups/broletssharetheroad/');
  const fromOld = orderAdvocatePages(parseAdvocateHome(`
    <a class="cell cell--group" href="https://www.facebook.com/groups/969273342879706">
      <span class="cell__kicker">Our people</span>
      <h3 class="cell__name">Not Well or Passed</h3>
      <p class="cell__blurb">Drivers doing it tough.</p>
    </a>`));
  assert.equal(fromOld.length, pages.length);
  assert.equal(fromOld.filter(page => page.name === 'Not Well or Passed').length, 1);
  const passed = fromOld.find(page => page.name === 'Not Well or Passed');
  assert.equal(passed.facebook, 'https://www.facebook.com/groups/thedriversadvocatenotwellpassed/');
  assert.equal(passed.site, 'https://tdaau.com/groups/not-well-or-passed/');
});

test('the newsletter sort uses the same group order as advocate.json', () => {
  const pages = require('../public/advocate.json');
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const block = app.match(/const GROUP_ORDER=\[([\s\S]*?)\];/);
  assert.ok(block);
  const keys = [...block[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(keys, pages.map(page => facebookKey(page.facebook)));
  assert.match(app, /Truck Drivers Food and Showers Australia/);
  assert.doesNotMatch(app, /name:"Truck Drivers Food and Showers"/);
  assert.match(app, /https:\/\/www\.facebook\.com\/groups\/thedriversadvocate'/);
  assert.match(app, /https:\/\/www\.facebook\.com\/groups\/thedriversadvocatenotwellpassed\//);
});

function htmlSample() {
  return `
    <a class="cell cell--group" href="https://www.facebook.com/groups/1063426956322044">
      <span class="cell__kicker">News</span>
      <h3 class="cell__name">Trucking News</h3>
      <p class="cell__blurb">News.</p>
    </a>
    <a class="cell cell--group" href="https://www.facebook.com/groups/thedriversadvocate/">
      <span class="cell__kicker">The main room</span>
      <h3 class="cell__name">The Drivers Advocate</h3>
      <p class="cell__blurb">The main room.</p>
    </a>
    <a class="cell cell--group" href="https://www.facebook.com/groups/broletssharetheroad/">
      <span class="cell__kicker">On the road</span>
      <h3 class="cell__name">Bro, Let's Share The Road</h3>
      <p class="cell__blurb">Sharing the road.</p>
    </a>`;
}

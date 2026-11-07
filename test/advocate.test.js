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

test('newsletter groups follow 28-day views, with the partner group second', () => {
  const pages = require('../public/advocate.json');
  assert.deepEqual(pages.map(page => page.name), [
    'The Drivers Advocate',
    'Truck Drivers Food and Showers',
    'Trucking News',
    'Promoting Australian Transport',
    'Health & Welfare',
    'Loading & Load Restraint',
    'Legal Matters',
    'Share The Road Bro',
    'Employment',
    'Truck Shows & Events',
    'Compliance & Induction',
    'Taxation, Income & Expenditure',
    'Not Well or Passed On',
    'On The Road Dash Cam',
    'Winners, Losers & The Good Ones',
    'Employ A Worker',
    'Work Diaries & EWD'
  ]);
  assert.equal(pages[1].facebook, 'https://www.facebook.com/groups/217669642677604/');
  assert.equal(pages[1].name.includes('Australia'), false);
  const ordered = orderAdvocatePages(parseAdvocateHome(htmlSample()));
  assert.equal(ordered[0].name, 'The Drivers Advocate');
  assert.equal(ordered[1].name, 'Truck Drivers Food and Showers');
  assert.equal(ordered[ordered.length - 1].name, 'Work Diaries & EWD');
  assert.equal(ordered.length, pages.length);
  assert.deepEqual(ordered.map(page => facebookKey(page.facebook)), pages.map(page => facebookKey(page.facebook)));
  const news = ordered.find(page => page.name === 'Trucking News');
  assert.equal(news.facebook, 'https://www.facebook.com/groups/thedriversadvocateturckingnews/');
  assert.equal(news.site, 'https://tdaau.com/groups/trucking-news/');
  assert.equal(ordered.filter(page => page.name === 'Share The Road Bro').length, 1);
  assert.equal(ordered.find(page => page.name === 'Share The Road Bro').facebook, 'https://www.facebook.com/groups/broletssharetheroad/');
});

test('the newsletter sort uses the same group order as advocate.json', () => {
  const pages = require('../public/advocate.json');
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const block = app.match(/const GROUP_ORDER=\[([\s\S]*?)\];/);
  assert.ok(block);
  const keys = [...block[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(keys, pages.map(page => facebookKey(page.facebook)));
  assert.match(app, /Truck Drivers Food and Showers/);
  assert.doesNotMatch(app, /Truck Drivers Food and Showers Australia/);
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

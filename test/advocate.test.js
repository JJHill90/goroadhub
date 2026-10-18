const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAdvocateHome } = require('../advocate');

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

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PODCAST } = require('../feeds');
const {
  PODCAST_FEED, SOUNDCLOUD_SHOW, NEWSLETTER_SITE, CONTACT_URL, SHOP_URL, TAX_URL,
  podcastScheme, podcastApps, podcastOpenPlan, applePlatform
} = require('../public/listen-out');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const feed = PODCAST.url;

test('subscribe links are built from the On the Road feed', () => {
  assert.equal(PODCAST_FEED, feed);
  assert.equal(SOUNDCLOUD_SHOW, PODCAST.home);
  assert.equal(podcastScheme(feed), 'podcast://feeds.soundcloud.com/users/soundcloud:users:877172068/sounds.rss');
  const byId = Object.fromEntries(podcastApps(feed).map(item => [item.id, item]));
  assert.equal(byId.default.href, 'podcast://' + feed.replace(/^https:\/\//, ''));
  assert.equal(byId.pocketcasts.href, 'pktc://subscribe/' + feed);
  assert.equal(byId.overcast.href, 'overcast://x-callback-url/add?url=' + encodeURIComponent(feed));
  assert.equal(byId.soundcloud.href, 'https://soundcloud.com/user-915018744-314651726');
  for (const item of Object.values(byId)) {
    assert.equal(/apple\.com|spotify\.com|pocketcasts\.com|pca\.st|the-drivers-advocate-podcast/i.test(item.href), false);
  }
});

test('a custom feed becomes a podcast, Pocket Casts and Overcast link', () => {
  const url = 'http://feeds.example/show.rss';
  const byId = Object.fromEntries(podcastApps(url).map(item => [item.id, item]));
  assert.equal(podcastScheme(url), 'podcast://feeds.example/show.rss');
  assert.equal(byId.default.href, 'podcast://feeds.example/show.rss');
  assert.equal(byId.pocketcasts.href, 'pktc://subscribe/' + url);
  assert.equal(byId.overcast.href, 'overcast://x-callback-url/add?url=' + encodeURIComponent(url));
});

test('a saved podcast app is offered first and opens once', () => {
  const plan = podcastOpenPlan({ choice: 'overcast', platform: 'other', sessionTried: false, stopped: false, feed });
  assert.equal(plan.open, true);
  assert.equal(plan.id, 'overcast');
  assert.equal(plan.apps[0].id, 'overcast');
  assert.equal(plan.href, 'overcast://x-callback-url/add?url=' + encodeURIComponent(feed));
  assert.equal(podcastOpenPlan({ choice: 'overcast', platform: 'other', sessionTried: true, stopped: false, feed }).open, false);
});

test('iOS and macOS try the default podcast app when nothing is saved', () => {
  const plan = podcastOpenPlan({ choice: '', platform: 'apple', sessionTried: false, stopped: false, feed });
  assert.equal(plan.open, true);
  assert.equal(plan.id, 'default');
  assert.equal(plan.href, podcastScheme(feed));
  assert.equal(plan.apps[0].id, 'default');
  assert.equal(podcastOpenPlan({ choice: '', platform: 'apple', sessionTried: true, stopped: false, feed }).open, false);
});

test('Android and other phones wait for a choice', () => {
  const plan = podcastOpenPlan({ choice: '', platform: 'other', sessionTried: false, stopped: false, feed });
  assert.equal(plan.open, false);
  assert.equal(plan.href, '');
  assert.equal(plan.apps[0].id, 'default');
});

test('stopping automatic opening clears the redirect, including the Apple default', () => {
  assert.equal(podcastOpenPlan({ choice: 'soundcloud', platform: 'apple', sessionTried: false, stopped: true, feed }).open, false);
  assert.equal(podcastOpenPlan({ choice: '', platform: 'apple', sessionTried: false, stopped: true, feed }).open, false);
  const unknown = podcastOpenPlan({ choice: 'spotify', platform: 'other', sessionTried: false, stopped: false, feed });
  assert.equal(unknown.open, false);
  assert.equal(unknown.apps.some(item => /spotify/i.test(item.href)), false);
});

test('newsletters stay on the page until the reader opens them', () => {
  assert.equal(NEWSLETTER_SITE, 'https://tdaau.com/newsletter/');
  assert.equal(SHOP_URL, 'https://thedriversadvocate.myshopify.com');
  assert.equal(TAX_URL, 'https://gotaxationhub.com');
  const mag = app.slice(app.indexOf('function magView'), app.indexOf('function drawMag'));
  assert.ok(mag.indexOf('toolPills()') < mag.indexOf('advocatePagesBlock()') && mag.indexOf('advocatePagesBlock()') < mag.indexOf('<h3>Newsletters</h3>'));
  assert.match(app, /function toolPills\(\)/);
  assert.match(app, /<b>Tax Hub<\/b><span>Record your receipts<\/span>/);
  assert.match(app, /class="tool-pill"/);
  assert.match(app, /typeof TAX_URL==='string'\?TAX_URL:''/);
  assert.match(app, /typeof SHOP_URL==='string'\?SHOP_URL:''/);
  assert.match(app, /function sitesView\(\)/);
  assert.match(app, /sites-page">'\+toolPills\(\)/);
  assert.match(mag, /<h3>Newsletters<\/h3>/);
  assert.match(mag, /<p class="sub">Every issue in one place on our website\.<\/p>/);
  assert.match(mag, /<a class="btn" href="\$\{esc\(href\)\}" target="_blank" rel="noopener noreferrer">Read the newsletters<\/a>/);
  assert.match(mag, /toolPills\(\)/);
  assert.equal(mag.includes('shop-link'), false);
  assert.equal(mag.includes('#C80813'), false);
  assert.equal(mag.includes('newsAuto('), false);
  assert.equal(mag.includes('newsletterOpenPlan('), false);
  assert.equal(mag.includes('Stop opening automatically'), false);
  assert.equal(mag.includes('Read the newsletters on tdaau.com'), false);
  assert.equal(mag.includes('Or stay in the app'), false);
  assert.equal(typeof newsletterOpenPlan, 'undefined');
});

test('Apple devices are told from Android and desktop Linux', () => {
  assert.equal(applePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)', 'iPhone'), true);
  assert.equal(applePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel'), true);
  assert.equal(applePlatform('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)', 'iPad'), true);
  assert.equal(applePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 7)', 'Linux armv8l'), false);
  assert.equal(applePlatform('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64'), false);
  assert.equal(applePlatform('Mozilla/5.0 (Windows NT 10.0)', 'Win32'), false);
});

test('the pages keep the in-app fallback under the outside link', () => {
  assert.match(index, /src="\/listen-out\.js"/);
  assert.match(app, /Listen in your podcast app/);
  assert.match(app, /Or listen here/);
  assert.match(app, /Copy RSS feed/);
  assert.match(app, /Stop opening my app automatically/);
  assert.match(app, /<h3>Newsletters<\/h3>/);
  assert.match(app, /Every issue in one place on our website\./);
  assert.match(app, />Read the newsletters</);
  assert.equal(app.includes('Read the newsletters on tdaau.com'), false);
  assert.equal(app.includes('Stop opening automatically'), false);
  assert.equal(app.includes('newsletterOpenPlan('), false);
  assert.match(app, /podcastOpenPlan\(/);
  assert.match(app, /advocatePagesBlock\(\)/);
  assert.match(app, /\['mag','📰 Newsletter'\],\['pod','🎧 Podcast'\],\['evt','📅 Events'\],\['sta','📊 Stats'\],\['sit','My Sites & Inductions'\]/);
  const view = app.slice(app.indexOf('function pView'), app.indexOf('function drawEps'));
  assert.ok(view.indexOf('id="ep-feature"') < view.indexOf('id="eps"') && view.indexOf('id="eps"') < view.indexOf('Listen in your podcast app'));
  assert.match(view, /<h3>Listen in your podcast app<\/h3><p class="sub">Listen only when safe<\/p>/);
  assert.match(view, /class="pod-pills"/);
  assert.match(view, /id==='pocketcasts'/);
  assert.match(view, /id==='overcast'/);
  assert.match(view, /id==='soundcloud'/);
  assert.match(view, /<details class="pod-more"><summary>More<\/summary>/);
  assert.equal(view.includes('out-feed'), false);
  assert.equal(view.includes('out-primary'), false);
  assert.match(app, /<article class="ep/);
  assert.match(app, /class="btn ep-play"/);
  assert.match(index, /#eps\{[^}]*display:grid[^}]*grid-template-columns:1fr;/);
  assert.match(index, /@media\(min-width:720px\)\{#eps\{grid-template-columns:1fr 1fr\}/);
  assert.match(index, /\.ep-snip\{/);
  assert.match(index, /\.ep \.ep-play\{[^}]*width:100%[^}]*background:#1877F2/);
  assert.match(index, /\.ep \.ep-play:hover\{[^}]*background:#166FE5/);
  assert.match(app, /function epDate\(/);
  assert.match(app, /function epSnip\(/);
  assert.match(app, /class="ep-meta"/);
  assert.match(app, /class="ep-snip"/);
});

test('Contact us is a small site-bar control for the in-app contact page', () => {
  assert.equal(CONTACT_URL, 'https://tdaau.com/contact/');
  const link = index.match(/<button type="button" class="contact-us"[^>]*>Contact us<\/button>/);
  assert.ok(link, 'contact control');
  assert.match(link[0], /onclick="go\('ctc'\)"/);
  assert.equal(/tdaau\.com\/contact/.test(link[0]), false);
  assert.equal(index.includes('https://tdaau.com/contact/'), false);
  const header = index.slice(index.indexOf('<header>'), index.indexOf('</header>') + 9);
  assert.ok(header.includes('class="contact-us"'));
  assert.equal(index.includes('class="site-link"'), false);
  assert.match(index, /\.contact-us\{[^}]*background:#C80813[^}]*color:#fff/);
  assert.equal(index.slice(index.indexOf('<nav'), index.indexOf('</nav>')).includes('Contact us'), false);
  const navFn = app.slice(app.indexOf('function nav('), app.indexOf('const go'));
  assert.match(navFn, /\['mag','📰 Newsletter'\],\['pod','🎧 Podcast'\],\['evt','📅 Events'\],\['sta','📊 Stats'\],\['sit','My Sites & Inductions'\]/);
  assert.match(navFn, /onclick="go\('ctc'\)">Contact us/);
  assert.equal(/login|Admin/.test(navFn), false);
  const listen = fs.readFileSync(path.join(root, 'public/listen-out.js'), 'utf8');
  const panel = app.match(/\/\* contact-us-panel \*\/[\s\S]*?\/\* \/contact-us-panel \*\//);
  assert.ok(panel, 'contact panel');
  assert.match(panel[0], /mailto:support@tdaau\.com/);
  assert.match(panel[0], /mailto:support@tdatt\.com/);
  assert.match(panel[0], /mailto:shopsupport@tdaau\.com/);
  assert.match(panel[0], /mailto:shoppartners@tdaau\.com/);
  assert.match(panel[0], /mailto:advertising@tdaau\.com/);
  assert.match(panel[0], /PODCAST_PHONE/);
  assert.match(panel[0], /0435 123 123/);
  assert.match(panel[0], /TODO: replace this placeholder with the real podcast phone number/);
  assert.match(panel[0], /Back to main menu/);
  const outsideTalk = index.replace(/<details class="talk">[\s\S]*?<\/details>/, '');
  const outsideContact = app.replace(/\/\* contact-us-panel \*\/[\s\S]*?\/\* \/contact-us-panel \*\//, '');
  assert.equal(/mailto:|tel:/i.test(outsideTalk + outsideContact + listen), false);
  assert.match(index, /Created for Driver's by Driver's/);
});

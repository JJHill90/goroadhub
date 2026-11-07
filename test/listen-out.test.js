const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PODCAST } = require('../feeds');
const {
  PODCAST_FEED, SOUNDCLOUD_SHOW, NEWSLETTER_SITE, CONTACT_URL,
  podcastScheme, podcastApps, podcastOpenPlan, newsletterOpenPlan, applePlatform
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

test('the newsletter site opens once per session only after it is chosen', () => {
  assert.equal(NEWSLETTER_SITE, 'https://tdaau.com/newsletter/');
  const open = newsletterOpenPlan({ choice: 'web', sessionTried: false, stopped: false });
  assert.equal(open.open, true);
  assert.equal(open.href, 'https://tdaau.com/newsletter/');
  assert.equal(newsletterOpenPlan({ choice: '', sessionTried: false, stopped: false }).open, false);
  assert.equal(newsletterOpenPlan({ choice: 'web', sessionTried: true, stopped: false }).open, false);
  assert.equal(newsletterOpenPlan({ choice: 'web', sessionTried: false, stopped: true }).open, false);
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
  assert.match(app, /Read the newsletters on tdaau.com/);
  assert.match(app, /Or stay in the app/);
  assert.match(app, /Stop opening automatically/);
  assert.match(app, /podcastOpenPlan\(/);
  assert.match(app, /newsletterOpenPlan\(/);
  assert.match(app, /advocatePagesBlock\(\)/);
  assert.match(app, /\['mag','📰 Newsletter'\],\['pod','🎧 Podcast'\],\['evt','📅 Events'\]/);
});

test('Contact us is a small site-bar link to the website contact page', () => {
  assert.equal(CONTACT_URL, 'https://tdaau.com/contact/');
  const link = index.match(/<a class="contact-us"[^>]*>Contact us<\/a>/);
  assert.ok(link, 'contact link');
  assert.match(link[0], /href="https:\/\/tdaau\.com\/contact\/"/);
  assert.match(link[0], /target="_blank"/);
  assert.match(link[0], /rel="noopener noreferrer"/);
  assert.equal(index.slice(index.indexOf('<nav'), index.indexOf('</nav>')).includes('Contact us'), false);
  assert.equal(/mailto:|tel:/i.test(index + app + fs.readFileSync(path.join(root, 'public/listen-out.js'), 'utf8')), false);
  assert.match(index, /Created for Driver's by Driver's/);
});

(function (root) {
const PODCAST_FEED = 'https://feeds.soundcloud.com/users/soundcloud:users:877172068/sounds.rss';
const SOUNDCLOUD_SHOW = 'https://soundcloud.com/user-915018744-314651726';
const NEWSLETTER_SITE = 'https://tdaau.com/newsletter/';
const CONTACT_URL = 'https://tdaau.com/contact/';

function podcastScheme(feed) {
  return 'podcast://' + String(feed || '').replace(/^https?:\/\//i, '');
}

function podcastApps(feed) {
  const url = feed || PODCAST_FEED;
  return [
    { id: 'default', name: 'Your podcast app', href: podcastScheme(url) },
    { id: 'pocketcasts', name: 'Pocket Casts', href: 'pktc://subscribe/' + url },
    { id: 'overcast', name: 'Overcast', href: 'overcast://x-callback-url/add?url=' + encodeURIComponent(url) },
    { id: 'soundcloud', name: 'SoundCloud', href: SOUNDCLOUD_SHOW }
  ];
}

function orderApps(apps, choice) {
  const list = apps.slice();
  const i = list.findIndex(app => app.id === choice);
  if (i <= 0) return list;
  return [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
}

function podcastOpenPlan(opts) {
  const o = opts || {};
  const feed = o.feed || PODCAST_FEED;
  const apps = orderApps(podcastApps(feed), o.choice);
  const stay = { apps, feed, open: false, href: '', id: '' };
  if (o.sessionTried || o.stopped) return stay;
  const chosen = apps.find(app => app.id === o.choice);
  if (chosen) return { apps, feed, open: true, href: chosen.href, id: chosen.id };
  if (o.platform === 'apple') {
    const def = apps.find(app => app.id === 'default');
    return { apps, feed, open: true, href: def.href, id: def.id };
  }
  return stay;
}

function newsletterOpenPlan(opts) {
  const o = opts || {};
  const href = o.href || NEWSLETTER_SITE;
  const stay = { href, open: false, id: '' };
  if (o.sessionTried || o.stopped || o.choice !== 'web' || !href) return stay;
  return { href, open: true, id: 'web' };
}

function applePlatform(ua, platform) {
  const u = String(ua || '');
  const p = String(platform || '');
  if (/Android|Windows Phone|webOS/i.test(u)) return false;
  if (/iPad|iPhone|iPod/i.test(u)) return true;
  if (/Macintosh|Mac OS X/i.test(u)) return true;
  return /^Mac/i.test(p);
}

root.PODCAST_FEED = PODCAST_FEED;
root.SOUNDCLOUD_SHOW = SOUNDCLOUD_SHOW;
root.NEWSLETTER_SITE = NEWSLETTER_SITE;
root.CONTACT_URL = CONTACT_URL;
root.podcastScheme = podcastScheme;
root.podcastApps = podcastApps;
root.orderApps = orderApps;
root.podcastOpenPlan = podcastOpenPlan;
root.newsletterOpenPlan = newsletterOpenPlan;
root.applePlatform = applePlatform;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PODCAST_FEED, SOUNDCLOUD_SHOW, NEWSLETTER_SITE, CONTACT_URL,
    podcastScheme, podcastApps, orderApps, podcastOpenPlan, newsletterOpenPlan, applePlatform
  };
}
})(typeof globalThis !== 'undefined' ? globalThis : this);

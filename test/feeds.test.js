const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFeed, fetchFeed, assertPublicUrl, changedPatch, POST_KEYS } = require('../feeds');

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>The Drivers Advocate</title>
<itunes:image href="https://cdn.example/show.jpg"/>
<item>
<title><![CDATA[Hello &amp; Road]]></title>
<description><![CDATA[<p>Short</p>]]></description>
<content:encoded><![CDATA[<p>Full story <img src="https://cdn.example/pic.jpg"> about fatigue.</p>]]></content:encoded>
<link>https://tdaau.com/news/1</link>
<pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
<guid isPermaLink="false">story-1</guid>
</item>
<item>
<title>Episode one</title>
<itunes:duration>1:02:03</itunes:duration>
<enclosure url="https://cdn.example/ep.mp3" type="audio/mpeg"/>
<link>https://tdaau.com/podcast/1</link>
<pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
<guid>ep-1</guid>
</item>
<item>
<title>Facebook</title>
<link>https://example.com/junk</link>
</item>
<item>
<title>Real headline</title>
<link>https://example.com/login?next=1</link>
</item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>News</title>
<entry>
<title>Atom title</title>
<link rel="self" href="https://tdaau.com/feed.xml"/>
<link rel="alternate" type="text/html" href="https://tdaau.com/news/atom-1"/>
<published>2024-06-01T00:00:00Z</published>
<summary type="html"><![CDATA[<p>Summary &amp; more</p>]]></summary>
<id>urn:tda:1</id>
</entry>
</feed>`;

test('RSS 2.0 keeps CDATA text, guid, image and date', () => {
  const [story] = parseFeed(RSS);
  assert.equal(story.h, 'Hello & Road');
  assert.equal(story.guid, 'story-1');
  assert.equal(story.link, 'https://tdaau.com/news/1');
  assert.equal(story.img, 'https://cdn.example/pic.jpg');
  assert.equal(story.chImg, 'https://cdn.example/show.jpg');
  assert.match(story.x, /Full story/);
  assert.equal(story.at, Date.parse('Mon, 01 Jan 2024 00:00:00 GMT'));
});

test('podcast enclosure and itunes duration are kept', () => {
  const ep = parseFeed(RSS)[1];
  assert.equal(ep.audio, 'https://cdn.example/ep.mp3');
  assert.equal(ep.dur, '1:02:03');
  assert.equal(ep.h, 'Episode one');
});

test('junk login and placeholder titles are dropped', () => {
  const titles = parseFeed(RSS).map(i => i.h);
  assert.deepEqual(titles, ['Hello & Road', 'Episode one']);
});

test('Atom uses the alternate link and the entry id', () => {
  const [entry] = parseFeed(ATOM);
  assert.equal(entry.link, 'https://tdaau.com/news/atom-1');
  assert.equal(entry.guid, 'urn:tda:1');
  assert.equal(entry.h, 'Atom title');
  assert.equal(entry.x, 'Summary & more');
  assert.equal(entry.at, Date.parse('2024-06-01T00:00:00Z'));
});

test('a changed headline updates without touching pins or likes', () => {
  const old = { h: 'Old', x: 'Body', pin: true, l: 4, c: 2, ord: 10, g: 3 };
  const incoming = { h: 'New', x: 'Body', pin: false, l: 0, c: 0, ord: 99, g: 0, at: old.at };
  const patch = changedPatch(old, incoming, POST_KEYS);
  assert.deepEqual(patch, { h: 'New' });
  assert.equal(POST_KEYS.includes('pin'), false);
});

test('a non-feed document does not become a story', () => {
  assert.deepEqual(parseFeed('<html><title>404 Not Found</title></html>'), []);
});

test('private, loopback, metadata and credential URLs are blocked', async () => {
  const blocked = [
    'http://127.0.0.1/latest',
    'http://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/',
    'http://[::1]/',
    'http://2130706433/',
    'http://localhost/feed',
    'http://metadata.google.internal/',
    'https://user:pass@1.1.1.1/feed',
    'file:///etc/passwd'
  ];
  for (const url of blocked) await assert.rejects(() => assertPublicUrl(url), /blocked|http or https|credentials|Invalid/);
  await assertPublicUrl('https://1.1.1.1/feed.xml');
});

test('a redirect onto a private address is not followed', async () => {
  let calls = 0;
  const fake = async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  };
  await assert.rejects(() => fetchFeed('https://1.1.1.1/feed.xml', fake), /blocked/);
  assert.equal(calls, 1);
});

test('oversized feed bodies are rejected', async () => {
  const chunk = new Uint8Array(256 * 1024);
  let sent = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (sent >= 3 * 1024 * 1024) { controller.close(); return; }
      controller.enqueue(chunk);
      sent += chunk.length;
    }
  });
  const fake = async () => new Response(body, { status: 200 });
  await assert.rejects(() => fetchFeed('https://8.8.8.8/feed.xml', fake), /too large/);
});

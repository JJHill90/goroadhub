const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const credits = fs.readFileSync(path.join(root, 'public/photo-credits.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
const NAME = 'The Drivers Advocate App';

function meta(html, attr, key) {
  const re = new RegExp('<meta\\s+' + attr + '="' + key + '"\\s+content="([^"]*)"', 'i');
  const found = html.match(re);
  return found && found[1];
}

test('the page title, header, and share tags use the app name', () => {
  assert.match(index, new RegExp('<title>' + NAME + '</title>'));
  assert.equal(meta(index, 'name', 'application-name'), NAME);
  assert.equal(meta(index, 'name', 'apple-mobile-web-app-title'), 'Drivers Advocate');
  assert.equal(meta(index, 'property', 'og:title'), NAME);
  assert.equal(meta(index, 'property', 'og:site_name'), NAME);
  assert.equal(meta(index, 'name', 'twitter:title'), NAME);
  assert.match(index, /<div class="brand-copy"><span class="brand">The Drivers <b>Advocate<\/b> App<\/span><p class="brand-blurb">Created for Driver's by Driver's<\/p><nav id="nav"><\/nav><\/div>/);
  assert.match(index, /\.brand-copy\{[^}]*flex-direction:column[^}]*align-items:flex-start[^}]*gap:4px/);
  assert.match(index, /\.brand\{[^}]*font-weight:800[^}]*font-size:16px/);
  assert.match(index, /\.brand-blurb\{[^}]*color:var\(--mut\)[^}]*font-size:12px[^}]*font-weight:400/);
  assert.equal(/\.brand-blurb\{[^}]*text-decoration/.test(index), false);
  assert.match(index, /@media\(max-width:600px\)\{nav button\{padding:8px 0;font-size:12px\}\.brand\{font-size:13px\}\.brand-blurb\{font-size:11px\}\}/);
  assert.match(index, /nav\{display:flex;[^}]*justify-content:flex-start/);
  assert.equal(/nav\{[^}]*margin-left:auto/.test(index), false);
  assert.match(index, /main\.two\{grid-template-columns:290px minmax\(0,1fr\)\}/);
  assert.equal(index.includes('Go Road Hub'), false);
  assert.equal(index.includes('GoRoadHub'), false);
});

const FOOT_ROW = '<nav class="site-foot" aria-label="Footer"><a class="visit-site" href="https://tdaau.com/" target="_blank" rel="noopener noreferrer">Visit our website</a><span class="site-sep" aria-hidden="true">·</span><a href="/photo-credits.html">Photo credits</a></nav>';

test('the bottom row is a small centred pair of links', () => {
  assert.equal(index.includes(FOOT_ROW), true);
  assert.equal(credits.includes(FOOT_ROW), true);
  assert.match(index, /\.site-foot\{[^}]*justify-content:center[^}]*text-align:center[^}]*font-size:12px/);
  assert.match(index, /\.site-foot a\{[^}]*color:#D5DEE8[^}]*font-size:12px/);
  assert.match(credits, /\.site-foot\{[^}]*justify-content:center[^}]*font-size:12px/);
  const row = index.slice(index.indexOf('<nav class="site-foot"'), index.indexOf('</nav>', index.indexOf('<nav class="site-foot"')) + 6);
  const visible = row.replace(/<[^>]+>/g, '');
  assert.equal(visible, 'Visit our website·Photo credits');
  assert.equal(visible.includes('http'), false);
  assert.equal(index.includes('The Drivers Advocate App website'), false);
  assert.equal(index.includes('(https://tdaau.com/)'), false);
  assert.ok(index.indexOf('</main>') < index.indexOf(FOOT_ROW));
  assert.ok(index.lastIndexOf(FOOT_ROW) > index.lastIndexOf('share.jpg'));
});

test('Open on Facebook buttons share one size and sit on the card base', () => {
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  assert.match(index, /\.page-card\{[^}]*display:flex[^}]*flex-direction:column[^}]*height:100%/);
  assert.match(index, /\.page-cols\{[^}]*align-items:stretch/);
  assert.match(index, /\.fb-open\{[^}]*margin-top:auto[^}]*width:100%[^}]*height:44px[^}]*min-height:44px/);
  assert.match(index, /\.adv\{[^}]*display:flex[^}]*flex-direction:column[^}]*height:100%/);
  assert.match(index, /\.adv-go\{[^}]*margin-top:auto/);
  assert.match(app, /<article class="page-card"><span class="page-name">/);
  assert.match(app, /<a class="fb-open"[^>]*>Open on Facebook<\/a>/);
  assert.equal((app.match(/class="fb-open"/g) || []).length, 2);
});

test('the groups index blurb is not shown', () => {
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const shown = index + '\n' + app + '\n' + credits;
  assert.equal(shown.includes('Listed in our chosen group order'), false);
  assert.equal(shown.includes('Rather know what you are walking into'), false);
  assert.equal(shown.includes('Read more about our groups'), false);
  assert.equal(/https:\/\/tdaau\.com\/groups\/?(["'<]|\s)/.test(shown), false);
});

test('the installed name is the app name, with Drivers Advocate on the home screen', () => {
  assert.equal(manifest.name, NAME);
  assert.equal(manifest.short_name, 'Drivers Advocate');
  assert.equal(meta(index, 'name', 'apple-mobile-web-app-title'), 'Drivers Advocate');
  const icons = Object.fromEntries(manifest.icons.map(icon => [icon.sizes + ' ' + icon.purpose, icon]));
  assert.equal(icons['192x192 any'].src, '/icon-192.png');
  assert.equal(icons['512x512 any'].src, '/icon-512.png');
  assert.equal(icons['192x192 maskable'].src, '/icon-maskable-192.png');
  assert.equal(icons['512x512 maskable'].src, '/icon-maskable-512.png');
  for (const icon of manifest.icons) assert.equal(icon.type, 'image/png');
  for (const file of ['favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png']) {
    const buf = fs.readFileSync(path.join(root, 'public', file));
    assert.ok(buf.length > 80, file);
  }
  assert.match(index, /rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32.png"/);
  assert.match(index, /rel="icon" type="image\/png" sizes="16x16" href="\/favicon-16.png"/);
  assert.match(index, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon.png"/);
});

test('photo credits name the app in the title, header, and share tags', () => {
  assert.match(credits, new RegExp('<title>Photo credits — ' + NAME + '</title>'));
  assert.match(credits, new RegExp('<header><a href="/">' + NAME + '</a></header>'));
  assert.equal(meta(credits, 'name', 'application-name'), NAME);
  assert.equal(meta(credits, 'name', 'apple-mobile-web-app-title'), 'Drivers Advocate');
  assert.equal(meta(credits, 'property', 'og:site_name'), NAME);
  assert.equal(meta(credits, 'property', 'og:title'), 'Photo credits — ' + NAME);
  assert.equal(credits.includes('Go Road Hub'), false);
  assert.equal(credits.includes('GoRoadHub'), false);
});

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
  assert.equal(meta(index, 'name', 'apple-mobile-web-app-title'), NAME);
  assert.equal(meta(index, 'property', 'og:title'), NAME);
  assert.equal(meta(index, 'property', 'og:site_name'), NAME);
  assert.equal(meta(index, 'name', 'twitter:title'), NAME);
  assert.match(index, /<div class="brand-copy"><span class="brand">The Drivers <b>Advocate<\/b> App<\/span><p class="brand-blurb">Created for Driver's by Driver's<\/p><\/div>/);
  assert.match(index, /\.brand-copy\{[^}]*flex-direction:column[^}]*align-items:flex-start[^}]*gap:4px/);
  assert.match(index, /\.brand\{[^}]*font-weight:800[^}]*font-size:16px/);
  assert.match(index, /\.brand-blurb\{[^}]*color:var\(--mut\)[^}]*font-size:12px[^}]*font-weight:400/);
  assert.equal(/\.brand-blurb\{[^}]*text-decoration/.test(index), false);
  assert.match(index, /@media\(max-width:600px\)\{nav button\{padding:8px 8px;font-size:12px\}\.brand\{font-size:13px\}\.brand-blurb\{font-size:11px\}\}/);
  assert.equal(index.includes('Go Road Hub'), false);
  assert.equal(index.includes('GoRoadHub'), false);
});

test('the homepage link is a short website button with no raw address', () => {
  const link = index.match(/<a class="visit-site"[^>]*>Visit our website<\/a>/);
  assert.ok(link, 'visit link');
  assert.match(link[0], /href="https:\/\/tdaau\.com\/"/);
  assert.match(link[0], /target="_blank"/);
  assert.match(link[0], /rel="noopener noreferrer"/);
  assert.equal(index.includes('The Drivers Advocate App website'), false);
  assert.equal(index.includes('(https://tdaau.com/)'), false);
  assert.equal(/>https:\/\/tdaau\.com\/</.test(index), false);
});

test('the installed name is the app name, with a short label that fits a home screen', () => {
  assert.equal(manifest.name, NAME);
  assert.equal(manifest.short_name, 'TDA App');
  assert.ok(manifest.short_name.length <= 12);
  assert.ok(NAME.length > 12);
});

test('photo credits name the app in the title, header, and share tags', () => {
  assert.match(credits, new RegExp('<title>Photo credits — ' + NAME + '</title>'));
  assert.match(credits, new RegExp('<header><a href="/">' + NAME + '</a></header>'));
  assert.equal(meta(credits, 'name', 'application-name'), NAME);
  assert.equal(meta(credits, 'name', 'apple-mobile-web-app-title'), NAME);
  assert.equal(meta(credits, 'property', 'og:site_name'), NAME);
  assert.equal(meta(credits, 'property', 'og:title'), 'Photo credits — ' + NAME);
  assert.equal(credits.includes('Go Road Hub'), false);
  assert.equal(credits.includes('GoRoadHub'), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { smashHtml } = require('../public/my-phone.js');

const index = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');

test('Smash Glass uses TDA red, a warning stripe, and colour-coded paths', () => {
  assert.match(index, /#smash-glass\{[^}]*background:#C80813[^}]*color:#fff/);
  assert.match(index, /#smash-glass::before\{[^}]*repeating-linear-gradient/);
  assert.match(index, /\.wiz-head\{[^}]*background:#C80813[^}]*color:#fff/);
  assert.match(index, /\.wiz-stripe\{[^}]*repeating-linear-gradient/);
  assert.match(index, /\.wiz-minor\{[^}]*background:#F5B942[^}]*color:#1A1204/);
  assert.match(index, /\.wiz-serious\{[^}]*background:#C80813[^}]*color:#fff/);
  assert.match(index, /\.wiz-witness\{[^}]*background:#1558C0[^}]*color:#fff/);
  const first = smashHtml(null, '', 'NSW');
  assert.match(index, /In the event of an emergency/);
  assert.match(first, /In the event of an emergency/);
  assert.match(first, /class="wiz-head"/);
  assert.match(first, /class="wiz-stripe"/);
  assert.match(first, /class="wiz-path wiz-witness"/);
  const choose = smashHtml({ path: 'involved', mode: '', step: 0, party: {}, witnesses: [] }, '', 'NSW');
  assert.match(choose, /class="wiz-path wiz-minor"/);
  assert.match(choose, /class="wiz-path wiz-serious"/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { AREAS, areaById, inArea, curated } = require('../public/areas');

test('every state, territory and New Zealand region has a place to pick', () => {
  for (const id of ['au', 'nsw', 'vic', 'qld', 'sa', 'wa', 'tas', 'nt', 'act', 'nz', 'nz-auckland', 'wa-pilbara', 'wa-kimberley', 'nsw-far-west', 'qld-outback', 'nz-far-north', 'nz-fiordland']) {
    assert.ok(areaById(id), id);
  }
  assert.equal(new Set(AREAS.map(area => area.id)).size, AREAS.length);
});

test('a Western Australian story stays in Western Australia', () => {
  const text = 'Road train rolled on the Great Northern Highway near Port Hedland in the Pilbara';
  assert.equal(inArea(text, 'wa-pilbara'), true);
  assert.equal(inArea(text, 'wa'), true);
  assert.equal(inArea(text, 'au'), true);
  assert.equal(inArea(text, 'qld'), false);
  assert.equal(inArea(text, 'nz'), false);
});

test('a state view does not keep another state or an overseas truck story', () => {
  assert.equal(inArea('Truck crash on the Centenary Motorway at Springfield Lakes', 'qld-brisbane'), true);
  assert.equal(inArea('Truck crash on the Centenary Motorway at Springfield Lakes', 'wa'), false);
  assert.equal(inArea('Two dead after a truck drove through a soccer game in Wichita, Kansas', 'au'), false);
  assert.equal(inArea('Two dead after a truck drove through a soccer game in Wichita, Kansas', 'wa'), false);
  assert.equal(inArea('National road toll figures released for heavy vehicles', 'au'), true);
  assert.equal(inArea('National road toll figures released for heavy vehicles', 'wa'), false);
});

test('New Zealand stories stay on the New Zealand side', () => {
  assert.equal(inArea('Freight delayed at the port in Auckland', 'nz-auckland'), true);
  assert.equal(inArea('Freight delayed at the port in Auckland', 'nz'), true);
  assert.equal(inArea('Freight delayed at the port in Auckland', 'au'), false);
  assert.equal(inArea('SH1 closed after a crash', 'nz', 'RNZ'), true);
  assert.equal(inArea('SH1 closed after a crash', 'au', 'RNZ'), false);
});

test('an empty rural district falls back to its state', () => {
  const items = [{ text: 'Lane closed on the freeway in Perth', source: 'ABC News' }];
  const pack = curated(items, 'wa-kimberley');
  assert.equal(pack.widened, true);
  assert.equal(pack.from, 'wa');
  assert.equal(pack.items.length, 1);
  const state = curated(items, 'wa');
  assert.equal(state.widened, false);
  assert.equal(state.items.length, 1);
});

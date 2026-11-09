const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { HEALTH_ADVICE, orderedHealthAdvice, healthAdviceHtml, smashHtml, serviceFinderUrl, hospitalMapUrl, SERVICE_FINDER_URL } = require('../public/my-phone.js');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const credits = fs.readFileSync(path.join(root, 'public/photo-credits.html'), 'utf8');

test('health advice numbers match the official pages and state lines come first', () => {
  assert.deepEqual(HEALTH_ADVICE.map(line => [line.state, line.phone, line.tel, line.href]), [
    ['ALL', '1800 022 222', 'tel:1800022222', 'https://www.healthdirect.gov.au/how-healthdirect-can-help-you'],
    ['QLD', '13 43 25 84', 'tel:13432584', 'https://www.qld.gov.au/health/contacts/advice/13health'],
    ['VIC', '1300 60 60 24', 'tel:1300606024', 'https://www.health.vic.gov.au/primary-care/nurse-on-call']
  ]);
  assert.deepEqual(orderedHealthAdvice('QLD').map(line => line.state), ['QLD', 'ALL', 'VIC']);
  assert.deepEqual(orderedHealthAdvice('VIC').map(line => line.state), ['VIC', 'ALL', 'QLD']);
  assert.equal(orderedHealthAdvice('NSW')[0].name, 'healthdirect');
  assert.equal(orderedHealthAdvice('ALL')[0].name, 'healthdirect');
  const qld = healthAdviceHtml('QLD');
  assert.ok(qld.indexOf('13 HEALTH') < qld.indexOf('healthdirect'));
  assert.match(qld, /Call 000 in an emergency/);
  assert.match(qld, /Health advice 24\/7/);
  const card = smashHtml({ path: 'witness', step: 0 }, '', 'VIC');
  assert.match(card, /Health advice 24\/7/);
  assert.ok(card.indexOf('NURSE-ON-CALL') < card.indexOf('Call healthdirect'));
  assert.equal(serviceFinderUrl(), SERVICE_FINDER_URL);
  assert.equal(serviceFinderUrl().includes('lat='), false);
  assert.equal(hospitalMapUrl(null, null, 'Mozilla/5.0'), 'https://www.google.com/maps/search/?api=1&query=hospital%20emergency');
  assert.equal(hospitalMapUrl(-33.86, 151.21, ''), 'https://www.google.com/maps/search/hospital+emergency/@-33.860000,151.210000,13z');
  assert.equal(hospitalMapUrl(-33.86, 151.21, 'iPhone'), 'https://maps.apple.com/?q=hospital%20emergency&sll=-33.860000,151.210000');
  const finder = healthAdviceHtml('NSW', { lat: -33.86, lng: 151.21, ua: '' });
  assert.match(finder, /Find a doctor near me/);
  assert.match(finder, /Nearest hospital/);
  assert.match(finder, /https:\/\/www\.healthdirect\.gov\.au\/australian-health-services"/);
  assert.equal(finder.includes('Heavy vehicle'), false);
  assert.equal(finder.includes('Call ahead'), false);
  for (const page of [index, credits]) {
    assert.match(page, /Need to talk\?/);
    const support = page.slice(page.indexOf('Need to talk?'), page.indexOf('Health advice 24/7'));
    const names = [...support.matchAll(/class="help-name"[^>]*>([^<]+)/g)].map(match => match[1]);
    assert.deepEqual(names, ['Lifeline', 'Beyond Blue', 'TIACS', '13YARN']);
    assert.match(support, /href="https:\/\/www\.tiacs\.org\/"/);
    assert.match(support, /tel:0488846988/);
    assert.match(support, /0488 846 988/);
    assert.match(support, /Text or call\. Mon–Fri, 8am–10pm AEST\./);
    assert.equal(support.includes('Healthy Heads'), false);
    assert.equal(page.includes('healthyheads.org.au'), false);
    assert.match(page, /Health advice 24\/7/);
    assert.match(page, /Call 000 in an emergency/);
    assert.match(page, /tel:1800022222/);
    assert.match(page, /tel:13432584/);
    assert.match(page, /tel:1300606024/);
    assert.match(page, /https:\/\/www\.healthdirect\.gov\.au\/how-healthdirect-can-help-you/);
    assert.match(page, /https:\/\/www\.qld\.gov\.au\/health\/contacts\/advice\/13health/);
    assert.match(page, /https:\/\/www\.health\.vic\.gov\.au\/primary-care\/nurse-on-call/);
    assert.match(page, /Find a doctor near me/);
    assert.match(page, /Nearest hospital/);
    assert.match(page, /https:\/\/www\.healthdirect\.gov\.au\/australian-health-services/);
    assert.equal(page.includes('Heavy vehicle parking'), false);
  }
});

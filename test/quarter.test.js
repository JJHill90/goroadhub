const test = require('node:test');
const assert = require('node:assert/strict');
const { alertPlan, reminderNow, daysUntil, quarterEnd } = require('../public/quarter.js');

test('the warning mornings are 8:00 across the last three days and quarter-end', () => {
  const now = new Date(2026, 9, 18, 12, 0, 0);
  const plan = alertPlan(now, { pending: 10, total: 58, reconciled: false });
  assert.equal(plan.length, 4);
  assert.deepEqual(plan.map(item => new Date(item.at).getDate()), [28, 29, 30, 31]);
  assert.ok(plan.every(item => new Date(item.at).getHours() === 8 && new Date(item.at).getMonth() === 11));
  assert.match(plan[0].body, /in 3 days/);
  assert.match(plan[0].body, /10 of 58/);
  assert.match(plan[0].body, /Year-end reconciliation/);
  assert.match(plan[3].body, /due today/);
  assert.equal(daysUntil(now, quarterEnd(2026, 4)) > 3, true);
});

test('finished checks schedule nothing', () => {
  assert.deepEqual(alertPlan(new Date(2026, 11, 28, 7), { pending: 0, total: 58, reconciled: false }), []);
});

test('a morning that has already passed is not scheduled again', () => {
  const before = alertPlan(new Date(2026, 11, 30, 7), { pending: 2, total: 58, reconciled: true });
  assert.deepEqual(before.map(item => new Date(item.at).getDate()), [30, 31]);
  assert.equal(before[0].body.includes('Year-end'), false);
  assert.deepEqual(alertPlan(new Date(2026, 11, 31, 9), { pending: 2, total: 58, reconciled: true }), []);
});

test('a closed page can be told on a warning morning after 8:00', () => {
  const hit = reminderNow(new Date(2026, 11, 30, 9), { pending: 2, total: 58, reconciled: true });
  assert.equal(hit.tag, 'goroadhub-q-2026-12-30');
  assert.match(hit.body, /in 1 day/);
  assert.equal(reminderNow(new Date(2026, 11, 30, 7), { pending: 2, total: 58, reconciled: true }), null);
  assert.equal(reminderNow(new Date(2026, 9, 18, 12), { pending: 2, total: 58, reconciled: false }), null);
});

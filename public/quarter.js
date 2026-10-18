(function (root) {
function quarterOf(date) {
  return [date.getFullYear(), Math.floor(date.getMonth() / 3) + 1];
}

function quarterEnd(year, quarter) {
  return new Date(year, quarter * 3, 0);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(now, end) {
  return Math.round((startOfDay(end) - startOfDay(now)) / 864e5);
}

function ymd(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function duePhrase(days) {
  return days === 0 ? 'today' : 'in ' + days + ' day' + (days > 1 ? 's' : '');
}

function quarterBody(days, state, quarter) {
  const total = state.total || state.pending;
  let body = 'Quarterly checks due ' + duePhrase(days) + ' (' + state.pending + ' of ' + total + ' still open)';
  if (quarter === 4 && !state.reconciled) body += '. Year-end reconciliation is due ' + duePhrase(days);
  return body;
}

function alertPlan(now, state) {
  if (!state || !(state.pending > 0)) return [];
  const [year, quarter] = quarterOf(now);
  const end = startOfDay(quarterEnd(year, quarter));
  const left = daysUntil(now, end);
  if (left < 0) return [];
  const plan = [];
  for (let days = Math.min(left, 3); days >= 0; days--) {
    const day = new Date(end);
    day.setDate(end.getDate() - days);
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8, 0, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    plan.push({
      at: at.getTime(),
      tag: 'goroadhub-q-' + ymd(day),
      title: 'GoRoadHub reminder',
      body: quarterBody(days, state, quarter)
    });
  }
  return plan;
}

function reminderNow(now, state) {
  if (!state || !(state.pending > 0) || now.getHours() < 8) return null;
  const [year, quarter] = quarterOf(now);
  const left = daysUntil(now, quarterEnd(year, quarter));
  if (left > 3 || left < 0) return null;
  return { tag: 'goroadhub-q-' + ymd(now), title: 'GoRoadHub reminder', body: quarterBody(left, state, quarter) };
}

root.alertPlan = alertPlan;
root.reminderNow = reminderNow;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { quarterOf, quarterEnd, daysUntil, ymd, alertPlan, reminderNow };
}
})(typeof globalThis !== 'undefined' ? globalThis : this);

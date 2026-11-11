'use strict';
// Export every docs row as JSON lines: {"coll":..,"id":..,"data":{..}}
// Usage: DATABASE_URL=<source> node scripts/export-docs.js > docs.jsonl
const { createStore } = require('../db');
(async () => {
  const store = createStore(process.env.DATABASE_URL);
  const colls = process.argv.slice(2);
  const list = colls.length ? colls : ['posts', 'ticker', 'feeds', 'episodes', 'comments', 'traffic', 'accounts'];
  const counts = {};
  for (const coll of list) {
    const rows = await store.all(coll);
    for (const r of rows) process.stdout.write(JSON.stringify({ coll, id: r.id, data: r.data }) + '\n');
    counts[coll] = rows.length;
  }
  console.error('exported', JSON.stringify(counts));
  await store.end();
})().catch(e => { console.error(e.message); process.exit(1); });

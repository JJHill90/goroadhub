'use strict';
// Import JSON lines made by export-docs.js into DATABASE_URL (PostgreSQL or MySQL).
// Rows with the same (coll, id) are replaced. Prints the row count per collection afterwards.
// Usage: DATABASE_URL=<target> node scripts/import-docs.js docs.jsonl
const fs = require('fs');
const { createStore } = require('../db');
(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/import-docs.js docs.jsonl');
  const store = createStore(process.env.DATABASE_URL);
  await store.init();
  const seen = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const { coll, id, data } = JSON.parse(line);
    if (!coll || !id || !data || typeof data !== 'object') throw new Error('Bad row');
    await store.put(coll, id, data);
    seen[coll] = (seen[coll] || 0) + 1;
  }
  const after = {};
  for (const coll of Object.keys(seen)) after[coll] = (await store.all(coll)).length;
  console.log('imported', JSON.stringify(seen));
  console.log('now in database', JSON.stringify(after));
  await store.end();
})().catch(e => { console.error(e.message); process.exit(1); });

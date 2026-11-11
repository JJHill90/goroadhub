const test = require('node:test');
const assert = require('node:assert');
const { createStore, isMysqlUrl, duplicateError, shallowMerge } = require('../db');

function fakeMysql(state = new Map()) {
  const calls = [];
  const key = (c, i) => c + '\u0000' + i;
  const exec = async (sql, params) => {
    calls.push({ sql, params });
    if (/^select data from docs where coll = \? and id = \?/.test(sql)) {
      const v = state.get(key(params[0], params[1]));
      return [v ? [{ data: JSON.parse(v) }] : []];
    }
    if (/^update docs set data = \? where/.test(sql)) { state.set(key(params[1], params[2]), params[0]); return [{}]; }
    if (/^insert into docs\(coll, id, data\) values\(\?, \?, \?\)$/.test(sql)) {
      if (state.has(key(params[0], params[1]))) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
      state.set(key(params[0], params[1]), params[2]); return [{}];
    }
    return [[]];
  };
  const conn = { query: exec, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} };
  return { calls, state, pool: { query: exec, getConnection: async () => conn, end: async () => {} } };
}

test('engine is chosen from the database URL', () => {
  assert.equal(isMysqlUrl('mysql://u:p@localhost/db'), true);
  assert.equal(isMysqlUrl('postgresql://u:p@h/db'), false);
  const f = fakeMysql();
  assert.equal(createStore('mysql://x@localhost/db', { pool: f.pool }).engine, 'mysql');
  assert.equal(createStore('postgresql://x@h/db', { pool: { query: async () => ({ rows: [] }) } }).engine, 'postgres');
});

test('duplicate key errors are recognised on both engines', () => {
  assert.equal(duplicateError({ code: '23505' }), true);
  assert.equal(duplicateError({ code: 'ER_DUP_ENTRY' }), true);
  assert.equal(duplicateError({ code: 'OTHER' }), false);
});

test('merge keeps the same top-level semantics as jsonb ||', () => {
  assert.deepEqual(shallowMerge({ a: 1, b: { x: 1 } }, { b: { y: 2 }, c: null }), { a: 1, b: { y: 2 }, c: null });
});

test('mysql store inserts, reads, merges and upserts documents', async () => {
  const f = fakeMysql();
  const s = createStore('mysql://x@localhost/db', { pool: f.pool });
  await s.insert('posts', 'p1', { h: 'Hello', c: 0 });
  assert.deepEqual(await s.get('posts', 'p1'), { h: 'Hello', c: 0 });
  await s.merge('posts', 'p1', { h: 'Changed', pin: true });
  assert.deepEqual(await s.get('posts', 'p1'), { h: 'Changed', c: 0, pin: true });
  await s.merge('posts', 'missing', { h: 'x' });
  assert.equal(await s.get('posts', 'missing'), null);
  await s.upsertMerge('feeds', 'f1', { url: 'https://a' });
  await s.upsertMerge('feeds', 'f1', { name: 'A' });
  assert.deepEqual(await s.get('feeds', 'f1'), { url: 'https://a', name: 'A' });
});

test('mysql list and prune queries use MySQL JSON functions only', async () => {
  const f = fakeMysql();
  const s = createStore('mysql://x@localhost/db', { pool: f.pool });
  await s.list('posts', 24, true);
  await s.list('posts', 80, false);
  await s.list('episodes', 60);
  await s.removeExcept('traffic', ['a', 'b']);
  await s.pruneAutoNews(1);
  await s.bumpCount('posts', 'p1', 'c', 1);
  assert.throws(() => s.bumpCount('posts', 'p1', "c'); drop", 1));
  for (const { sql } of f.calls) {
    assert.doesNotMatch(sql, /->>|::|jsonb|nulls last|\$\d/i, sql);
  }
});

'use strict';
// Document store for The Drivers Advocate App.
// One table: docs(coll, id, data JSON). Works on PostgreSQL (Render) or MySQL 8 (cPanel hosting).
// Pick the engine from DATABASE_URL: mysql://... uses MySQL, anything else uses PostgreSQL.

const isMysqlUrl = url => /^mysql:\/\//i.test(String(url || ''));

function duplicateError(e) {
  return !!e && (e.code === '23505' || e.code === 'ER_DUP_ENTRY' || e.errno === 1062);
}

function asObject(v) {
  if (v == null) return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
  if (Buffer.isBuffer(v)) { try { return JSON.parse(v.toString('utf8')); } catch { return v; } }
  return v;
}

function shallowMerge(old, patch) {
  const base = old && typeof old === 'object' && !Array.isArray(old) ? old : {};
  return { ...base, ...(patch || {}) };
}

function pgStore(url, opts = {}) {
  const { Pool } = require('pg');
  const pool = opts.pool || new Pool({ connectionString: url, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false });
  if (pool.on) pool.on('error', err => console.error('Idle database client error:', err.message));
  const q = (sql, params) => pool.query(sql, params);
  const ORDER = "order by coalesce((data->>'pin')::boolean, false) desc, (data->>'at')::double precision desc nulls last";
  return {
    engine: 'postgres',
    pool,
    init: () => q('create table if not exists docs(coll text not null, id text not null, data jsonb not null, primary key(coll, id))'),
    async get(coll, id) {
      const x = await q('select data from docs where coll = $1 and id = $2', [coll, id]);
      return x.rows[0] ? x.rows[0].data : null;
    },
    insert: (coll, id, data) => q('insert into docs(coll, id, data) values($1, $2, $3)', [coll, id, JSON.stringify(data)]),
    put: (coll, id, data) => q('insert into docs(coll, id, data) values($1, $2, $3::jsonb) on conflict (coll, id) do update set data = excluded.data', [coll, id, JSON.stringify(data)]),
    upsertMerge: (coll, id, data) => q('insert into docs(coll, id, data) values($1, $2, $3::jsonb) on conflict (coll, id) do update set data = docs.data || excluded.data', [coll, id, JSON.stringify(data)]),
    merge: (coll, id, patch) => q('update docs set data = data || $3::jsonb where coll = $1 and id = $2', [coll, id, JSON.stringify(patch)]),
    remove: (coll, id) => q('delete from docs where coll = $1 and id = $2', [coll, id]),
    bumpCount: (coll, id, field, delta) => q(
      "update docs set data = jsonb_set(data, $3::text[], to_jsonb(greatest(coalesce((data->>$4)::int, 0) + $5, 0))) where coll = $1 and id = $2",
      [coll, id, [field], field, delta]
    ),
    async all(coll) {
      const x = await q('select id, data from docs where coll = $1 order by id', [coll]);
      return x.rows;
    },
    async list(coll, limit, auto) {
      let where = 'coll = $1';
      if (auto === true) where += " and data->>'auto' = 'true'";
      if (auto === false) where += " and coalesce(data->>'auto', '') <> 'true'";
      const order = auto === true ? "order by (data->>'at')::double precision desc nulls last" : ORDER;
      const x = await q(`select id, data from docs where ${where} ${order} limit $2`, [coll, limit]);
      return x.rows;
    },
    removeExcept: (coll, keep) => q('delete from docs where coll = $1 and not (id = any($2::text[]))', [coll, keep.length ? keep : ['']]),
    pruneAutoNews: before => q(
      "delete from docs where coll = 'posts' and data->>'auto' = 'true' and data->>'src' = 'news' and coalesce((data->>'at')::double precision, 0) < $1",
      [before]
    ),
    end: () => pool.end()
  };
}

function mysqlStore(url, opts = {}) {
  const mysql = require('mysql2/promise');
  const pool = opts.pool || mysql.createPool({ uri: url, connectionLimit: 5, charset: 'utf8mb4', supportBigNumbers: true, waitForConnections: true });
  const rows = async (sql, params) => { const [r] = await pool.query(sql, params); return r; };
  const out = r => (r || []).map(o => ({ id: o.id, data: asObject(o.data) }));
  const AT = "CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.at')) AS DOUBLE)";
  const PIN = "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.pin')) = 'true', 0)";
  const AUTO = "JSON_UNQUOTE(JSON_EXTRACT(data, '$.auto'))";
  const ORDER = `order by ${PIN} desc, (${AT} is null), ${AT} desc`;
  // Read-modify-write inside a transaction so a merge keeps exactly the
  // same top-level semantics as PostgreSQL's jsonb "||" (null values are kept).
  async function mergeTx(coll, id, patch, insertIfMissing) {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      const [r] = await c.query('select data from docs where coll = ? and id = ? for update', [coll, id]);
      if (r.length) {
        await c.query('update docs set data = ? where coll = ? and id = ?', [JSON.stringify(shallowMerge(asObject(r[0].data), patch)), coll, id]);
      } else if (insertIfMissing) {
        await c.query('insert into docs(coll, id, data) values(?, ?, ?)', [coll, id, JSON.stringify(patch)]);
      }
      await c.commit();
    } catch (e) { await c.rollback().catch(() => {}); throw e; } finally { c.release(); }
  }
  return {
    engine: 'mysql',
    pool,
    init: () => rows('create table if not exists docs(coll varchar(64) not null, id varchar(191) not null, data json not null, primary key(coll, id)) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_bin'),
    async get(coll, id) {
      const r = await rows('select data from docs where coll = ? and id = ?', [coll, id]);
      return r[0] ? asObject(r[0].data) : null;
    },
    insert: (coll, id, data) => rows('insert into docs(coll, id, data) values(?, ?, ?)', [coll, id, JSON.stringify(data)]),
    put: (coll, id, data) => rows('insert into docs(coll, id, data) values(?, ?, ?) on duplicate key update data = values(data)', [coll, id, JSON.stringify(data)]),
    upsertMerge: (coll, id, data) => mergeTx(coll, id, data, true),
    merge: (coll, id, patch) => mergeTx(coll, id, patch, false),
    remove: (coll, id) => rows('delete from docs where coll = ? and id = ?', [coll, id]),
    bumpCount(coll, id, field, delta) {
      if (!/^[A-Za-z0-9_]+$/.test(field)) throw new Error('Bad field');
      const p = `'$.${field}'`;
      return rows(
        `update docs set data = JSON_SET(data, ${p}, GREATEST(COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, ${p})) AS SIGNED), 0) + ?, 0)) where coll = ? and id = ?`,
        [delta, coll, id]
      );
    },
    async all(coll) { return out(await rows('select id, data from docs where coll = ? order by id', [coll])); },
    async list(coll, limit, auto) {
      let where = 'coll = ?';
      if (auto === true) where += ` and ${AUTO} = 'true'`;
      if (auto === false) where += ` and COALESCE(${AUTO}, '') <> 'true'`;
      const order = auto === true ? `order by (${AT} is null), ${AT} desc` : ORDER;
      return out(await rows(`select id, data from docs where ${where} ${order} limit ?`, [coll, Number(limit)]));
    },
    removeExcept(coll, keep) {
      const ids = keep.length ? keep : [''];
      return rows(`delete from docs where coll = ? and id not in (${ids.map(() => '?').join(',')})`, [coll, ...ids]);
    },
    pruneAutoNews: before => rows(
      `delete from docs where coll = 'posts' and ${AUTO} = 'true' and JSON_UNQUOTE(JSON_EXTRACT(data, '$.src')) = 'news' and COALESCE(${AT}, 0) < ?`,
      [before]
    ),
    end: () => pool.end()
  };
}

function createStore(url = process.env.DATABASE_URL, opts) {
  return isMysqlUrl(url) ? mysqlStore(url, opts) : pgStore(url, opts);
}

module.exports = { createStore, isMysqlUrl, duplicateError, shallowMerge };

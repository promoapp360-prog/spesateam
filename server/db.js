import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// NUMERIC e COUNT arrivano come stringhe: li convertiamo in numeri
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
// DATE come stringa YYYY-MM-DD (evita slittamenti di fuso orario)
pg.types.setTypeParser(1082, (v) => v);

if (!process.env.DATABASE_URL) {
  console.error('\n⚠️  DATABASE_URL non impostata. Su Replit apri il pannello "Database" e crea un database PostgreSQL.\n');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// Tutte le date e le statistiche ragionano in ora italiana
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'Europe/Rome'").catch(() => {});
});

export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const helpers = {
      q: async (t, p = []) => (await client.query(t, p)).rows,
      one: async (t, p = []) => (await client.query(t, p)).rows[0] || null,
    };
    const result = await fn(helpers);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

export async function getSettings() {
  const rows = await q('SELECT key, value FROM settings');
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

export async function setSetting(key, value) {
  await q(
    `INSERT INTO settings(key, value) VALUES ($1, $2::text::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]
  );
}

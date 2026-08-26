/* Loaded here rather than only in server/index.js: scripts import this module
   directly, and without .env they would silently fall back to the local file
   while the running server talks to Turso — two different databases. */
import 'dotenv/config';

import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Turso when configured, otherwise a local file so a fresh clone runs
   with no external setup. */
const url = process.env.TURSO_DATABASE_URL
  ? process.env.TURSO_DATABASE_URL
  : 'file:' + path.join(__dirname, '..', 'deficoins.db');

export const db = createClient({
  url,
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});

/* Which database this process is talking to — worth one line of output, since
   pointing at the wrong one is otherwise invisible until data goes missing. */
export const DB_TARGET = url;

/* libsql returns positional rows; every caller wants objects. */
export function toObjects(result) {
  const { columns, rows } = result;
  return rows.map((r) => {
    const o = {};
    for (let i = 0; i < columns.length; i++) o[columns[i]] = r[i];
    return o;
  });
}
export function first(result) {
  return toObjects(result)[0] || null;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id             TEXT PRIMARY KEY,
     name           TEXT NOT NULL,
     email          TEXT NOT NULL UNIQUE,
     password_hash  TEXT NOT NULL,
     avatar         TEXT,
     status         TEXT NOT NULL DEFAULT 'active',   -- active | suspended
     base_currency  TEXT NOT NULL DEFAULT 'USD',
     recovery_phrase TEXT,
     phrase_ack     INTEGER NOT NULL DEFAULT 0,
     is_admin       INTEGER NOT NULL DEFAULT 0,
     last_seen_at   TEXT,
     created_at     TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  /* One row per (user, coin). Balance is the authoritative ledger figure —
     every mutation goes through a transactions row as well. */
  `CREATE TABLE IF NOT EXISTS wallets (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL,
     coin       TEXT NOT NULL,
     balance    REAL NOT NULL DEFAULT 0,
     address    TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE (user_id, coin)
   )`,

  `CREATE TABLE IF NOT EXISTS transactions (
     id           TEXT PRIMARY KEY,
     user_id      TEXT NOT NULL,
     type         TEXT NOT NULL,                      -- send | receive | buy | swap
     coin         TEXT NOT NULL,
     amount       REAL NOT NULL,
     usd_value    REAL NOT NULL DEFAULT 0,
     counterparty TEXT,
     related_coin TEXT,
     related_amount REAL,
     note         TEXT,
     status       TEXT NOT NULL DEFAULT 'pending',    -- pending | completed | failed | cancelled
     created_at   TEXT NOT NULL DEFAULT (datetime('now')),
     settled_at   TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS buy_orders (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL,
     coin       TEXT NOT NULL,
     usd_amount REAL NOT NULL,
     status     TEXT NOT NULL DEFAULT 'pending',      -- pending | fulfilled | cancelled
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE TABLE IF NOT EXISTS messages (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL,
     body       TEXT NOT NULL,
     from_admin INTEGER NOT NULL DEFAULT 0,
     read       INTEGER NOT NULL DEFAULT 0,
     attachment TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT
   )`,

  /* Admin-set price overrides; NULL price means "use the live feed". */
  `CREATE TABLE IF NOT EXISTS coin_overrides (
     symbol       TEXT PRIMARY KEY,
     manual_price REAL,
     enabled      INTEGER NOT NULL DEFAULT 1,
     master_address TEXT
   )`,

  /* Password resets are handled by a person: the user asks, the request lands
     in the admin queue, an admin sets a new password and the user is told in
     their support thread. No token is mailed, so nothing here expires. */
  `CREATE TABLE IF NOT EXISTS password_resets (
     id          TEXT PRIMARY KEY,
     user_id     TEXT NOT NULL,
     email       TEXT NOT NULL,
     status      TEXT NOT NULL DEFAULT 'pending',   -- pending | done | cancelled
     created_at  TEXT NOT NULL DEFAULT (datetime('now')),
     resolved_at TEXT
   )`,

  `CREATE INDEX IF NOT EXISTS idx_wallets_user   ON wallets(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_user        ON transactions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_status      ON transactions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_msg_user       ON messages(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_buy_status     ON buy_orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_reset_status   ON password_resets(status, created_at DESC)`,
];

export async function initDb() {
  for (const stmt of SCHEMA) await db.execute(stmt);
}

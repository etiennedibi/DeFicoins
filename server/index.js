import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { db, initDb, toObjects, first } from './lib/db.js';
import { COINS, getCoin, isValidAddress, publicCatalogue } from './lib/coins.js';
import { getPrices, swapRate } from './lib/market.js';
import {
  hashPassword, verifyPassword, issueToken, readToken,
  newId, generatePhrase, deriveAddress,
} from './lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const UPLOADS = path.join(__dirname, 'uploads');
const PORT = Number(process.env.PORT) || 4000;

fs.mkdirSync(UPLOADS, { recursive: true });
await initDb();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const ok = (res, body) => res.json(body ?? { ok: true });
const fail = (res, code, error) => res.status(code).json({ error });
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[api] ${req.method} ${req.path}:`, err);
  fail(res, 500, 'Server error');
});

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function requireUser(req, res, next) {
  const claims = readToken(bearer(req));
  if (!claims || claims.role !== 'user') return fail(res, 401, 'Unauthorized');
  req.userId = claims.sub;
  next();
}

function requireAdmin(req, res, next) {
  const claims = readToken(bearer(req));
  if (!claims || claims.role !== 'admin') return fail(res, 401, 'Unauthorized');
  next();
}

const round = (n, dp) => Number(Number(n).toFixed(dp));

async function setting(key, fallback) {
  const r = first(await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] }));
  return r?.value ?? fallback;
}

/* Every user holds a row for every enabled coin, so Receive and Swap always
   have an address and a balance to talk about. */
async function ensureWallets(userId) {
  const have = new Set(
    toObjects(await db.execute({ sql: 'SELECT coin FROM wallets WHERE user_id = ?', args: [userId] }))
      .map((r) => r.coin)
  );
  for (const c of COINS) {
    if (have.has(c.symbol)) continue;
    await db.execute({
      sql: 'INSERT INTO wallets (id, user_id, coin, balance, address) VALUES (?, ?, ?, 0, ?)',
      args: [newId(), userId, c.symbol, deriveAddress(c.chain, userId, c.symbol)],
    });
  }
}

async function portfolio(userId) {
  await ensureWallets(userId);
  const [wallets, prices] = await Promise.all([
    db.execute({ sql: 'SELECT coin, balance, address FROM wallets WHERE user_id = ?', args: [userId] }).then(toObjects),
    getPrices(),
  ]);
  const assets = wallets
    .filter((w) => prices[w.coin] !== undefined)
    .map((w) => {
      const meta = getCoin(w.coin);
      const price = prices[w.coin].price;
      return {
        symbol: w.coin,
        name: meta?.name ?? w.coin,
        chain: meta?.chain ?? '',
        color: meta?.color ?? '#888888',
        decimals: meta?.decimals ?? 6,
        balance: w.balance,
        address: w.address,
        price,
        change24h: prices[w.coin].change24h ?? 0,
        usdValue: price * w.balance,
      };
    });
  const total = assets.reduce((s, a) => s + a.usdValue, 0);
  return { assets, total };
}

function publicUser(id) {
  return db.execute({
    sql: 'SELECT id, name, email, avatar, status, base_currency, phrase_ack, created_at FROM users WHERE id = ?',
    args: [id],
  }).then(first);
}

/* ------------------------------------------------------------------ *
 * public
 * ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => ok(res, { ok: true, coins: COINS.length }));

app.get('/api/coins', (_req, res) => ok(res, { coins: publicCatalogue() }));

app.get('/api/market', wrap(async (_req, res) => {
  const prices = await getPrices();
  const market = COINS
    .filter((c) => prices[c.symbol])
    .map((c) => ({
      symbol: c.symbol,
      name: c.name,
      chain: c.chain,
      color: c.color,
      price: prices[c.symbol].price,
      change24h: prices[c.symbol].change24h,
    }));
  ok(res, { market, at: new Date().toISOString() });
}));

/* ------------------------------------------------------------------ *
 * auth
 * ------------------------------------------------------------------ */

app.post('/api/auth/register', wrap(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!name) return fail(res, 400, 'Name is required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'Enter a valid email address');
  if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters');

  const existing = first(await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] }));
  if (existing) return fail(res, 409, 'An account with this email already exists');

  const id = newId();
  const phrase = generatePhrase();
  await db.execute({
    sql: 'INSERT INTO users (id, name, email, password_hash, recovery_phrase) VALUES (?, ?, ?, ?, ?)',
    args: [id, name, email, await hashPassword(password), phrase],
  });
  await ensureWallets(id);

  ok(res, { token: issueToken(id), user: await publicUser(id), phrase: phrase.split(' ') });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const u = first(await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] }));
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    return fail(res, 401, 'Incorrect email or password');
  }
  if (u.status === 'suspended') return fail(res, 403, 'This account has been suspended');
  await db.execute({ sql: "UPDATE users SET last_seen_at = datetime('now') WHERE id = ?", args: [u.id] });
  ok(res, { token: issueToken(u.id), user: await publicUser(u.id) });
}));

app.post('/api/auth/admin-login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const U = process.env.ADMIN_USER || 'admin';
  const P = process.env.ADMIN_PASS || '';
  if (!P) return fail(res, 500, 'ADMIN_PASS is not configured');
  if (username !== U || password !== P) return fail(res, 401, 'Invalid credentials');
  ok(res, { token: issueToken('admin', 'admin') });
}));

/* A reset request is a message to the admin, not a mailed token: an admin
   sets the new password from the console and the user is told in their
   support thread. */
app.post('/api/auth/forgot', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const u = first(await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] }));

  if (u) {
    /* One open request per account. Without this, anyone who knows an address
       could flood the admin queue by replaying this endpoint. */
    const open = first(await db.execute({
      sql: `SELECT id FROM password_resets
            WHERE user_id = ? AND status = 'pending'
              AND created_at > datetime('now', '-15 minutes')`,
      args: [u.id],
    }));
    if (!open) {
      await db.batch([
        {
          sql: 'INSERT INTO password_resets (id, user_id, email) VALUES (?, ?, ?)',
          args: [newId(), u.id, email],
        },
        {
          sql: 'INSERT INTO messages (id, user_id, body, from_admin) VALUES (?, ?, ?, 0)',
          args: [newId(), u.id, 'I have forgotten my password and requested a reset.'],
        },
      ], 'write');
    }
  }

  /* Same answer either way, so the endpoint cannot be used to discover which
     addresses have accounts. */
  ok(res, { ok: true });
}));

app.post('/api/auth/ack-phrase', requireUser, wrap(async (req, res) => {
  await db.execute({ sql: 'UPDATE users SET phrase_ack = 1 WHERE id = ?', args: [req.userId] });
  ok(res);
}));

/* ------------------------------------------------------------------ *
 * wallet
 * ------------------------------------------------------------------ */

app.get('/api/me', requireUser, wrap(async (req, res) => {
  const user = await publicUser(req.userId);
  if (!user) return fail(res, 404, 'Account not found');
  ok(res, { user, ...(await portfolio(req.userId)) });
}));

app.get('/api/transactions', requireUser, wrap(async (req, res) => {
  const rows = toObjects(await db.execute({
    sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200',
    args: [req.userId],
  }));
  ok(res, { transactions: rows });
}));

app.post('/api/send', requireUser, wrap(async (req, res) => {
  const symbol = String(req.body?.coin || '').toUpperCase();
  const amount = Number(req.body?.amount);
  const to = String(req.body?.to || '').trim();

  const coin = getCoin(symbol);
  if (!coin) return fail(res, 400, 'Unknown coin');
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, 'Enter an amount greater than zero');
  if (!isValidAddress(symbol, to)) return fail(res, 400, `That is not a valid ${symbol} address`);

  await ensureWallets(req.userId);
  const w = first(await db.execute({
    sql: 'SELECT balance FROM wallets WHERE user_id = ? AND coin = ?',
    args: [req.userId, symbol],
  }));
  if (!w || w.balance < amount) return fail(res, 400, 'Insufficient balance');

  const prices = await getPrices();
  const usd = (prices[symbol]?.price ?? 0) * amount;

  /* Funds leave the spendable balance immediately so the same amount cannot be
     queued twice while the request sits in the admin approval queue. */
  const tx = newId();
  await db.batch([
    {
      sql: 'UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND coin = ? AND balance >= ?',
      args: [amount, req.userId, symbol, amount],
    },
    {
      sql: `INSERT INTO transactions (id, user_id, type, coin, amount, usd_value, counterparty, status)
            VALUES (?, ?, 'send', ?, ?, ?, ?, 'pending')`,
      args: [tx, req.userId, symbol, amount, usd, to],
    },
  ], 'write');

  ok(res, { id: tx, status: 'pending' });
}));

app.post('/api/swap', requireUser, wrap(async (req, res) => {
  const from = String(req.body?.from || '').toUpperCase();
  const to = String(req.body?.to || '').toUpperCase();
  const amount = Number(req.body?.amount);

  const a = getCoin(from);
  const b = getCoin(to);
  if (!a || !b) return fail(res, 400, 'Unknown coin');
  if (from === to) return fail(res, 400, 'Choose two different coins');
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, 'Enter an amount greater than zero');

  await ensureWallets(req.userId);
  const w = first(await db.execute({
    sql: 'SELECT balance FROM wallets WHERE user_id = ? AND coin = ?',
    args: [req.userId, from],
  }));
  if (!w || w.balance < amount) return fail(res, 400, 'Insufficient balance');

  const rate = await swapRate(from, to);
  if (!rate) return fail(res, 503, 'No rate available for this pair right now');

  const feePct = Number(await setting('swap_fee_pct', '0.5'));
  const received = round(amount * rate * (1 - feePct / 100), b.decimals);
  const prices = await getPrices();
  const usd = (prices[from]?.price ?? 0) * amount;

  await db.batch([
    {
      sql: 'UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND coin = ? AND balance >= ?',
      args: [amount, req.userId, from, amount],
    },
    {
      sql: 'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND coin = ?',
      args: [received, req.userId, to],
    },
    {
      sql: `INSERT INTO transactions
              (id, user_id, type, coin, amount, usd_value, related_coin, related_amount, status, settled_at)
            VALUES (?, ?, 'swap', ?, ?, ?, ?, ?, 'completed', datetime('now'))`,
      args: [newId(), req.userId, from, amount, usd, to, received],
    },
  ], 'write');

  ok(res, { received, rate, feePct });
}));

app.post('/api/buy', requireUser, wrap(async (req, res) => {
  const symbol = String(req.body?.coin || '').toUpperCase();
  const usdAmount = Number(req.body?.usdAmount);
  if (!getCoin(symbol)) return fail(res, 400, 'Unknown coin');
  const min = Number(await setting('buy_min_usd', '20'));
  if (!Number.isFinite(usdAmount) || usdAmount < min) return fail(res, 400, `Minimum purchase is $${min}`);

  const id = newId();
  await db.execute({
    sql: 'INSERT INTO buy_orders (id, user_id, coin, usd_amount) VALUES (?, ?, ?, ?)',
    args: [id, req.userId, symbol, usdAmount],
  });
  /* The reference app hands the buyer to a human at this point; we do the same
     by opening the order as a support thread. */
  await db.execute({
    sql: 'INSERT INTO messages (id, user_id, body, from_admin) VALUES (?, ?, ?, 0)',
    args: [
      newId(),
      req.userId,
      `I would like to purchase $${usdAmount} worth of ${symbol}. Please assist me with completing this purchase.`,
    ],
  });
  ok(res, { id, status: 'pending' });
}));

/* ------------------------------------------------------------------ *
 * support chat
 * ------------------------------------------------------------------ */

app.get('/api/messages', requireUser, wrap(async (req, res) => {
  const rows = toObjects(await db.execute({
    sql: `SELECT id, body, from_admin, read, attachment, created_at
          FROM messages WHERE user_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 500`,
    args: [req.userId],
  }));
  await db.execute({
    sql: 'UPDATE messages SET read = 1 WHERE user_id = ? AND from_admin = 1',
    args: [req.userId],
  });
  ok(res, { messages: rows });
}));

app.post('/api/messages', requireUser, wrap(async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return fail(res, 400, 'Message is empty');
  if (body.length > 4000) return fail(res, 400, 'Message is too long');
  const id = newId();
  await db.execute({
    sql: 'INSERT INTO messages (id, user_id, body, from_admin) VALUES (?, ?, ?, 0)',
    args: [id, req.userId, body],
  });
  ok(res, { id });
}));

/* ------------------------------------------------------------------ *
 * admin
 * ------------------------------------------------------------------ */

app.get('/api/admin/overview', requireAdmin, wrap(async (_req, res) => {
  const count = (sql) => db.execute(sql).then((r) => toObjects(r)[0].n);
  const [users, pendingTx, pendingBuys, unread, pendingResets] = await Promise.all([
    count('SELECT COUNT(*) AS n FROM users'),
    count("SELECT COUNT(*) AS n FROM transactions WHERE status = 'pending'"),
    count("SELECT COUNT(*) AS n FROM buy_orders WHERE status = 'pending'"),
    count('SELECT COUNT(*) AS n FROM messages WHERE from_admin = 0 AND read = 0'),
    count("SELECT COUNT(*) AS n FROM password_resets WHERE status = 'pending'"),
  ]);
  ok(res, { users, pendingTx, pendingBuys, unread, pendingResets });
}));

app.get('/api/admin/users', requireAdmin, wrap(async (_req, res) => {
  const users = toObjects(await db.execute(
    `SELECT u.id, u.name, u.email, u.status, u.created_at, u.last_seen_at,
            (SELECT COUNT(*) FROM messages m
             WHERE m.user_id = u.id AND m.from_admin = 0 AND m.read = 0) AS unread
     FROM users u ORDER BY u.created_at DESC`
  ));
  const prices = await getPrices();
  const balances = toObjects(await db.execute('SELECT user_id, coin, balance FROM wallets WHERE balance > 0'));
  const totals = new Map();
  for (const b of balances) {
    totals.set(b.user_id, (totals.get(b.user_id) || 0) + b.balance * (prices[b.coin]?.price ?? 0));
  }
  ok(res, { users: users.map((u) => ({ ...u, totalUsd: totals.get(u.id) || 0 })) });
}));

app.get('/api/admin/users/:id', requireAdmin, wrap(async (req, res) => {
  const user = await publicUser(req.params.id);
  if (!user) return fail(res, 404, 'User not found');
  const [pf, transactions, buys, messages] = await Promise.all([
    portfolio(req.params.id),
    db.execute({
      sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      args: [req.params.id],
    }).then(toObjects),
    db.execute({
      sql: 'SELECT * FROM buy_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      args: [req.params.id],
    }).then(toObjects),
    db.execute({
      sql: 'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 500',
      args: [req.params.id],
    }).then(toObjects),
  ]);
  ok(res, { user, ...pf, transactions, buys, messages });
}));

/* Credit or debit a balance. `delta` may be negative. Always writes a
   transactions row so the user can see where the movement came from. */
app.post('/api/admin/users/:id/adjust', requireAdmin, wrap(async (req, res) => {
  const symbol = String(req.body?.coin || '').toUpperCase();
  const delta = Number(req.body?.delta);
  const note = String(req.body?.note || '').slice(0, 200) || null;
  if (!getCoin(symbol)) return fail(res, 400, 'Unknown coin');
  if (!Number.isFinite(delta) || delta === 0) return fail(res, 400, 'Enter a non-zero amount');

  await ensureWallets(req.params.id);
  const w = first(await db.execute({
    sql: 'SELECT balance FROM wallets WHERE user_id = ? AND coin = ?',
    args: [req.params.id, symbol],
  }));
  if (!w) return fail(res, 404, 'Wallet not found');
  if (w.balance + delta < 0) return fail(res, 400, 'That would put the balance below zero');

  const prices = await getPrices();
  await db.batch([
    {
      sql: 'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND coin = ?',
      args: [delta, req.params.id, symbol],
    },
    {
      sql: `INSERT INTO transactions (id, user_id, type, coin, amount, usd_value, note, status, settled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))`,
      args: [
        newId(), req.params.id, delta > 0 ? 'receive' : 'send', symbol,
        Math.abs(delta), Math.abs(delta) * (prices[symbol]?.price ?? 0), note,
      ],
    },
  ], 'write');
  ok(res, await portfolio(req.params.id));
}));

app.post('/api/admin/users/:id/status', requireAdmin, wrap(async (req, res) => {
  const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
  await db.execute({ sql: 'UPDATE users SET status = ? WHERE id = ?', args: [status, req.params.id] });
  ok(res, { status });
}));

app.post('/api/admin/users/:id/password', requireAdmin, wrap(async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters');
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [await hashPassword(password), req.params.id],
  });
  ok(res);
}));

app.post('/api/admin/users/:id/address', requireAdmin, wrap(async (req, res) => {
  const symbol = String(req.body?.coin || '').toUpperCase();
  const address = String(req.body?.address || '').trim();
  if (!getCoin(symbol)) return fail(res, 400, 'Unknown coin');
  if (address && !isValidAddress(symbol, address)) return fail(res, 400, `That is not a valid ${symbol} address`);
  await ensureWallets(req.params.id);
  await db.execute({
    sql: 'UPDATE wallets SET address = ? WHERE user_id = ? AND coin = ?',
    args: [address || null, req.params.id, symbol],
  });
  ok(res);
}));

app.get('/api/admin/transactions', requireAdmin, wrap(async (req, res) => {
  const rows = toObjects(await db.execute({
    sql: `SELECT t.*, u.name AS user_name, u.email AS user_email
          FROM transactions t JOIN users u ON u.id = t.user_id
          WHERE t.status = ? ORDER BY t.created_at DESC LIMIT 200`,
    args: [String(req.query.status || 'pending')],
  }));
  ok(res, { transactions: rows });
}));

/* Approving a send just settles it — the balance already moved when it was
   queued. Rejecting puts the funds back. */
app.post('/api/admin/transactions/:id/settle', requireAdmin, wrap(async (req, res) => {
  const decision = req.body?.decision === 'reject' ? 'reject' : 'approve';
  const tx = first(await db.execute({ sql: 'SELECT * FROM transactions WHERE id = ?', args: [req.params.id] }));
  if (!tx) return fail(res, 404, 'Transaction not found');
  if (tx.status !== 'pending') return fail(res, 409, 'This transaction is already settled');

  if (decision === 'approve') {
    await db.execute({
      sql: "UPDATE transactions SET status = 'completed', settled_at = datetime('now') WHERE id = ? AND status = 'pending'",
      args: [tx.id],
    });
  } else {
    await db.batch([
      {
        sql: "UPDATE transactions SET status = 'cancelled', settled_at = datetime('now') WHERE id = ? AND status = 'pending'",
        args: [tx.id],
      },
      ...(tx.type === 'send'
        ? [{
            sql: 'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND coin = ?',
            args: [tx.amount, tx.user_id, tx.coin],
          }]
        : []),
    ], 'write');
  }
  ok(res, { status: decision === 'approve' ? 'completed' : 'cancelled' });
}));

app.get('/api/admin/password-resets', requireAdmin, wrap(async (req, res) => {
  const rows = toObjects(await db.execute({
    sql: `SELECT r.*, u.name AS user_name, u.status AS user_status
          FROM password_resets r JOIN users u ON u.id = r.user_id
          WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
    args: [String(req.query.status || 'pending')],
  }));
  ok(res, { resets: rows });
}));

/* Sets the new password and closes the request in one step, then tells the
   user in their support thread so they know it happened. */
app.post('/api/admin/password-resets/:id/resolve', requireAdmin, wrap(async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters');

  const r = first(await db.execute({ sql: 'SELECT * FROM password_resets WHERE id = ?', args: [req.params.id] }));
  if (!r) return fail(res, 404, 'Request not found');
  if (r.status !== 'pending') return fail(res, 409, 'This request is already closed');

  await db.batch([
    { sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [await hashPassword(password), r.user_id] },
    {
      sql: "UPDATE password_resets SET status = 'done', resolved_at = datetime('now') WHERE id = ? AND status = 'pending'",
      args: [r.id],
    },
    {
      sql: 'INSERT INTO messages (id, user_id, body, from_admin) VALUES (?, ?, ?, 1)',
      args: [newId(), r.user_id,
        'Your password has been reset by our support team. Please sign in with the new password and change it from Settings.'],
    },
  ], 'write');

  ok(res, { status: 'done' });
}));

app.post('/api/admin/password-resets/:id/cancel', requireAdmin, wrap(async (req, res) => {
  const r = first(await db.execute({ sql: 'SELECT status FROM password_resets WHERE id = ?', args: [req.params.id] }));
  if (!r) return fail(res, 404, 'Request not found');
  if (r.status !== 'pending') return fail(res, 409, 'This request is already closed');
  await db.execute({
    sql: "UPDATE password_resets SET status = 'cancelled', resolved_at = datetime('now') WHERE id = ? AND status = 'pending'",
    args: [req.params.id],
  });
  ok(res, { status: 'cancelled' });
}));

app.get('/api/admin/buys', requireAdmin, wrap(async (req, res) => {
  const rows = toObjects(await db.execute({
    sql: `SELECT b.*, u.name AS user_name, u.email AS user_email
          FROM buy_orders b JOIN users u ON u.id = b.user_id
          WHERE b.status = ? ORDER BY b.created_at DESC LIMIT 200`,
    args: [String(req.query.status || 'pending')],
  }));
  ok(res, { buys: rows });
}));

app.post('/api/admin/buys/:id/close', requireAdmin, wrap(async (req, res) => {
  const status = req.body?.status === 'fulfilled' ? 'fulfilled' : 'cancelled';
  await db.execute({ sql: 'UPDATE buy_orders SET status = ? WHERE id = ?', args: [status, req.params.id] });
  ok(res, { status });
}));

app.post('/api/admin/messages', requireAdmin, wrap(async (req, res) => {
  const userId = String(req.body?.userId || '');
  const body = String(req.body?.body || '').trim();
  if (!userId || !body) return fail(res, 400, 'userId and body are required');
  const id = newId();
  await db.execute({
    sql: 'INSERT INTO messages (id, user_id, body, from_admin) VALUES (?, ?, ?, 1)',
    args: [id, userId, body],
  });
  ok(res, { id });
}));

app.get('/api/admin/coins', requireAdmin, wrap(async (_req, res) => {
  const ov = toObjects(await db.execute('SELECT * FROM coin_overrides'));
  const bySymbol = new Map(ov.map((o) => [o.symbol, o]));
  const prices = await getPrices();
  ok(res, {
    coins: COINS.map((c) => ({
      ...c,
      livePrice: prices[c.symbol]?.price ?? null,
      manualPrice: bySymbol.get(c.symbol)?.manual_price ?? null,
      enabled: bySymbol.get(c.symbol)?.enabled !== 0,
    })),
  });
}));

app.post('/api/admin/coins/:symbol', requireAdmin, wrap(async (req, res) => {
  const symbol = String(req.params.symbol).toUpperCase();
  if (!getCoin(symbol)) return fail(res, 400, 'Unknown coin');
  const manual = req.body?.manualPrice;
  const manualPrice = manual === null || manual === undefined || manual === '' ? null : Number(manual);
  if (manualPrice !== null && (!Number.isFinite(manualPrice) || manualPrice < 0)) {
    return fail(res, 400, 'Manual price must be a positive number');
  }
  const enabled = req.body?.enabled === false ? 0 : 1;
  await db.execute({
    sql: `INSERT INTO coin_overrides (symbol, manual_price, enabled) VALUES (?, ?, ?)
          ON CONFLICT(symbol) DO UPDATE SET manual_price = excluded.manual_price, enabled = excluded.enabled`,
    args: [symbol, manualPrice, enabled],
  });
  ok(res);
}));

app.get('/api/admin/settings', requireAdmin, wrap(async (_req, res) => {
  ok(res, { settings: toObjects(await db.execute('SELECT key, value FROM settings')) });
}));

app.post('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [String(key), String(value)],
    });
  }
  ok(res, { saved: entries.length });
}));

/* ------------------------------------------------------------------ *
 * static + SPA fallback
 * ------------------------------------------------------------------ */

app.use('/uploads', express.static(UPLOADS, { maxAge: '1y', index: false }));

app.use('/api', (_req, res) => fail(res, 404, 'Not found'));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  console.warn('[server] dist/ not built — run `npm run build` to serve the app from this process.');
}

app.listen(PORT, () => {
  console.log(`DeFicoins API listening on http://localhost:${PORT}`);
});

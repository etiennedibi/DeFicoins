/* Clears throwaway test accounts and seeds a demo set so every screen and
   every admin queue has something real in it.

   Usage: node scripts/seed-demo.mjs [baseUrl] */

import { db, toObjects, DB_TARGET } from '../server/lib/db.js';

const BASE = process.argv[2] || 'http://localhost:4000';
const ADMIN_PASS = process.env.ADMIN_PASS || 'dev-admin-pass';
const PASSWORD = 'demo1234';

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

console.log('database: ' + DB_TARGET);

/* Wipe every generated account — the demo set and anything left behind by the
   test scripts — so re-running this gives exactly the same starting point
   instead of piling a second round of queues on top of the first. */
const junk = toObjects(await db.execute(
  `SELECT id, email FROM users
   WHERE email LIKE '%@demo.app'
      OR email LIKE 'e2e-%@example.com'
      OR email LIKE 'shot-%@example.com'
      OR email LIKE 'reset-%@example.com'`
));
for (const u of junk) {
  for (const t of ['wallets', 'transactions', 'buy_orders', 'messages', 'password_resets']) {
    await db.execute({ sql: `DELETE FROM ${t} WHERE user_id = ?`, args: [u.id] });
  }
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [u.id] });
}
console.log(`cleared ${junk.length} generated account(s)`);

const admin = (await call('POST', '/api/auth/admin-login', {
  body: { username: process.env.ADMIN_USER || 'admin', password: ADMIN_PASS },
})).token;

const PEOPLE = [
  {
    name: 'Eric Marcoux',
    email: 'eric@demo.app',
    fund: [['BTC', 0.284], ['ETH', 4.2], ['USDC', 3200], ['SOL', 26]],
    pendingSend: { coin: 'BTC', amount: 0.05, to: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' },
    buy: { coin: 'ETH', usdAmount: 750 },
    swap: { from: 'SOL', to: 'USDT', amount: 6 },
    says: 'Bonjour, ma demande de retrait est en attente depuis ce matin. Pouvez-vous vérifier ?',
    reply: 'Bonjour Eric, votre transfert est dans la file de validation. Nous revenons vers vous sous peu.',
  },
  {
    name: 'Amina Diallo',
    email: 'amina@demo.app',
    fund: [['USDT', 12500], ['BNB', 3.1]],
    pendingSend: { coin: 'USDT', amount: 2400, to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    buy: { coin: 'BTC', usdAmount: 200 },
    says: 'I would like to increase my daily limit. What do you need from me?',
  },
  {
    name: 'Tomás Ferreira',
    email: 'tomas@demo.app',
    fund: [['DOGE', 48000], ['ADA', 1500], ['MATIC', 900]],
    says: 'Olá, o meu depósito já foi confirmado?',
  },
  {
    name: 'Sarah Klein',
    email: 'sarah@demo.app',
    fund: [],
  },
];

for (const p of PEOPLE) {
  const token = (await call('POST', '/api/auth/register', {
    body: { name: p.name, email: p.email, password: PASSWORD },
  })).token;
  console.log('created  ' + p.email);

  const users = await call('GET', '/api/admin/users', { token: admin });
  const uid = users.users.find((u) => u.email === p.email).id;

  for (const [coin, delta] of p.fund) {
    await call('POST', `/api/admin/users/${uid}/adjust`, {
      token: admin, body: { coin, delta, note: 'Deposit settled' },
    });
  }
  if (p.swap) await call('POST', '/api/swap', { token, body: p.swap });
  if (p.pendingSend) await call('POST', '/api/send', { token, body: p.pendingSend });
  if (p.buy) await call('POST', '/api/buy', { token, body: p.buy });
  if (p.says) await call('POST', '/api/messages', { token, body: { body: p.says } });
  if (p.reply) await call('POST', '/api/admin/messages', { token: admin, body: { userId: uid, body: p.reply } });
}

/* Two open password-reset requests, so that queue is populated as well. */
for (const email of ['tomas@demo.app', 'amina@demo.app']) {
  await call('POST', '/api/auth/forgot', { body: { email } });
}

/* Suspend one account so the "suspended" state is visible in the console. */
const all = await call('GET', '/api/admin/users', { token: admin });
const sarah = all.users.find((u) => u.email === 'sarah@demo.app');
await call('POST', `/api/admin/users/${sarah.id}/status`, { token: admin, body: { status: 'suspended' } });

const stats = await call('GET', '/api/admin/overview', { token: admin });
console.log('\nseeded:', JSON.stringify(stats));
console.log('\nwallet sign-in — password for all four: ' + PASSWORD);
for (const p of PEOPLE) console.log('  ' + p.email.padEnd(18) + p.name);
console.log('\nsarah@demo.app is suspended on purpose (sign-in should be refused).');

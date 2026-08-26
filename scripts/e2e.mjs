/* End-to-end exercise of the ledger against a running API.
   Usage: node scripts/e2e.mjs [baseUrl]  */

const BASE = process.argv[2] || 'http://localhost:4000';

let pass = 0;
let fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: json ?? text };
}

console.log('DeFicoins e2e against ' + BASE + '\n');

// ---- public -------------------------------------------------------
console.log('public');
const health = await call('GET', '/api/health');
check('health responds', health.status === 200 && health.body.ok, JSON.stringify(health.body).slice(0, 120));
check('catalogue has 14 coins', health.body?.coins === 14);

const market = await call('GET', '/api/market');
check('market returns priced coins', market.status === 200 && market.body.market?.length > 0);
check('BTC has a positive price', (market.body.market || []).find((m) => m.symbol === 'BTC')?.price > 0);

// ---- registration -------------------------------------------------
console.log('\nregistration');
const email = `e2e-${Date.now()}@example.com`;
const reg = await call('POST', '/api/auth/register', {
  body: { name: 'E2E Tester', email, password: 'correct horse battery' },
});
check('register succeeds', reg.status === 200 && !!reg.body.token, JSON.stringify(reg.body).slice(0, 160));
check('returns a 12-word phrase', reg.body.phrase?.length === 12);
const token = reg.body.token;

check('short password rejected',
  (await call('POST', '/api/auth/register', { body: { name: 'x', email: 'a@b.co', password: 'short' } })).status === 400);
check('duplicate email rejected',
  (await call('POST', '/api/auth/register', { body: { name: 'x', email, password: 'correct horse battery' } })).status === 409);
check('bad email rejected',
  (await call('POST', '/api/auth/register', { body: { name: 'x', email: 'not-an-email', password: 'correct horse battery' } })).status === 400);

// ---- auth guards --------------------------------------------------
console.log('\nauth guards');
check('/api/me without token is 401', (await call('GET', '/api/me')).status === 401);
check('/api/me with garbage token is 401', (await call('GET', '/api/me', { token: 'garbage' })).status === 401);
check('user token cannot reach admin', (await call('GET', '/api/admin/users', { token })).status === 401);

const login = await call('POST', '/api/auth/login', { body: { email, password: 'correct horse battery' } });
check('login succeeds', login.status === 200 && !!login.body.token);
check('wrong password rejected',
  (await call('POST', '/api/auth/login', { body: { email, password: 'wrong' } })).status === 401);

// ---- portfolio ----------------------------------------------------
console.log('\nportfolio');
const me = await call('GET', '/api/me', { token });
check('portfolio loads', me.status === 200 && Array.isArray(me.body.assets));
check('a wallet exists per coin', me.body.assets?.length === 14, 'got ' + me.body.assets?.length);
check('starting total is 0', me.body.total === 0);
const btc = me.body.assets.find((a) => a.symbol === 'BTC');
check('BTC wallet has a deposit address', !!btc?.address && btc.address.startsWith('bc1q'), btc?.address);

// ---- admin --------------------------------------------------------
console.log('\nadmin');
const adminLogin = await call('POST', '/api/auth/admin-login', {
  body: { username: 'admin', password: 'dev-admin-pass' },
});
check('admin login succeeds', adminLogin.status === 200 && !!adminLogin.body.token, JSON.stringify(adminLogin.body).slice(0, 120));
const admin = adminLogin.body.token;
check('bad admin password rejected',
  (await call('POST', '/api/auth/admin-login', { body: { username: 'admin', password: 'nope' } })).status === 401);

const users = await call('GET', '/api/admin/users', { token: admin });
check('admin lists users', users.status === 200 && users.body.users.length > 0);
const uid = users.body.users.find((u) => u.email === email)?.id;
check('new user appears in admin list', !!uid);

// credit 0.5 BTC
const credit = await call('POST', `/api/admin/users/${uid}/adjust`, {
  token: admin, body: { coin: 'BTC', delta: 0.5, note: 'e2e credit' },
});
check('admin credits 0.5 BTC', credit.status === 200);
check('balance reflects the credit', credit.body.assets?.find((a) => a.symbol === 'BTC')?.balance === 0.5);
check('portfolio total is now positive', credit.body.total > 0);

check('over-debit rejected',
  (await call('POST', `/api/admin/users/${uid}/adjust`, { token: admin, body: { coin: 'BTC', delta: -99 } })).status === 400);
check('zero adjustment rejected',
  (await call('POST', `/api/admin/users/${uid}/adjust`, { token: admin, body: { coin: 'BTC', delta: 0 } })).status === 400);
check('unknown coin rejected',
  (await call('POST', `/api/admin/users/${uid}/adjust`, { token: admin, body: { coin: 'NOPE', delta: 1 } })).status === 400);

// ---- send ---------------------------------------------------------
console.log('\nsend');
check('invalid address rejected',
  (await call('POST', '/api/send', { token, body: { coin: 'BTC', amount: 0.1, to: 'not-an-address' } })).status === 400);
check('wrong-chain address rejected',
  (await call('POST', '/api/send', { token, body: { coin: 'BTC', amount: 0.1, to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' } })).status === 400);
check('over-balance send rejected',
  (await call('POST', '/api/send', { token, body: { coin: 'BTC', amount: 999, to: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' } })).status === 400);
check('negative amount rejected',
  (await call('POST', '/api/send', { token, body: { coin: 'BTC', amount: -1, to: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' } })).status === 400);

const send = await call('POST', '/api/send', {
  token, body: { coin: 'BTC', amount: 0.2, to: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' },
});
check('valid send is queued as pending', send.status === 200 && send.body.status === 'pending', JSON.stringify(send.body).slice(0, 140));

const afterSend = await call('GET', '/api/me', { token });
check('funds debited immediately (no double-spend window)',
  afterSend.body.assets.find((a) => a.symbol === 'BTC')?.balance === 0.3,
  'balance = ' + afterSend.body.assets.find((a) => a.symbol === 'BTC')?.balance);

// ---- admin settles a send ----------------------------------------
console.log('\nsettlement');
const queue = await call('GET', '/api/admin/transactions?status=pending', { token: admin });
check('send appears in the admin queue', queue.body.transactions?.some((t) => t.id === send.body.id));

const reject = await call('POST', `/api/admin/transactions/${send.body.id}/settle`, {
  token: admin, body: { decision: 'reject' },
});
check('admin can reject a send', reject.status === 200 && reject.body.status === 'cancelled');

const afterReject = await call('GET', '/api/me', { token });
check('rejected send refunds the balance',
  afterReject.body.assets.find((a) => a.symbol === 'BTC')?.balance === 0.5,
  'balance = ' + afterReject.body.assets.find((a) => a.symbol === 'BTC')?.balance);

check('settling twice is rejected',
  (await call('POST', `/api/admin/transactions/${send.body.id}/settle`, { token: admin, body: { decision: 'approve' } })).status === 409);

const send2 = await call('POST', '/api/send', {
  token, body: { coin: 'BTC', amount: 0.1, to: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' },
});
const approve = await call('POST', `/api/admin/transactions/${send2.body.id}/settle`, {
  token: admin, body: { decision: 'approve' },
});
check('admin can approve a send', approve.status === 200 && approve.body.status === 'completed');
const afterApprove = await call('GET', '/api/me', { token });
check('approved send keeps the balance debited',
  afterApprove.body.assets.find((a) => a.symbol === 'BTC')?.balance === 0.4);

// ---- swap ---------------------------------------------------------
console.log('\nswap');
check('same-coin swap rejected',
  (await call('POST', '/api/swap', { token, body: { from: 'BTC', to: 'BTC', amount: 0.1 } })).status === 400);
check('over-balance swap rejected',
  (await call('POST', '/api/swap', { token, body: { from: 'BTC', to: 'ETH', amount: 99 } })).status === 400);

const swap = await call('POST', '/api/swap', { token, body: { from: 'BTC', to: 'ETH', amount: 0.1 } });
check('swap succeeds', swap.status === 200 && swap.body.received > 0, JSON.stringify(swap.body).slice(0, 140));
const afterSwap = await call('GET', '/api/me', { token });
const btcAfter = afterSwap.body.assets.find((a) => a.symbol === 'BTC').balance;
const ethAfter = afterSwap.body.assets.find((a) => a.symbol === 'ETH').balance;
check('swap debits the source coin', Math.abs(btcAfter - 0.3) < 1e-9, 'BTC = ' + btcAfter);
check('swap credits the target coin', ethAfter > 0, 'ETH = ' + ethAfter);
check('swap applies the fee', swap.body.feePct === 0.5);

// ---- buy + chat ---------------------------------------------------
console.log('\nbuy and support');
check('below-minimum buy rejected',
  (await call('POST', '/api/buy', { token, body: { coin: 'BTC', usdAmount: 1 } })).status === 400);

const buy = await call('POST', '/api/buy', { token, body: { coin: 'BTC', usdAmount: 200 } });
check('buy order created', buy.status === 200 && buy.body.status === 'pending');

const msgs = await call('GET', '/api/messages', { token });
check('buy opens a support thread', msgs.body.messages?.some((m) => m.body.includes('$200')));

await call('POST', '/api/messages', { token, body: { body: 'Hello, any update?' } });
await call('POST', '/api/admin/messages', { token: admin, body: { userId: uid, body: 'Yes, we are on it.' } });
const msgs2 = await call('GET', '/api/messages', { token });
check('admin reply reaches the user', msgs2.body.messages?.some((m) => m.from_admin === 1 && m.body.includes('on it')));
check('empty message rejected', (await call('POST', '/api/messages', { token, body: { body: '   ' } })).status === 400);

const buys = await call('GET', '/api/admin/buys?status=pending', { token: admin });
check('buy order appears in admin queue', buys.body.buys?.some((b) => b.id === buy.body.id));

// ---- transactions -------------------------------------------------
console.log('\nhistory');
const txs = await call('GET', '/api/transactions', { token });
check('history lists transactions', txs.body.transactions?.length >= 4, 'count = ' + txs.body.transactions?.length);
const types = new Set(txs.body.transactions.map((t) => t.type));
check('history covers receive/send/swap', types.has('receive') && types.has('send') && types.has('swap'),
  [...types].join(','));

// ---- account status ----------------------------------------------
console.log('\naccount status');
await call('POST', `/api/admin/users/${uid}/status`, { token: admin, body: { status: 'suspended' } });
check('suspended user cannot log in',
  (await call('POST', '/api/auth/login', { body: { email, password: 'correct horse battery' } })).status === 403);
await call('POST', `/api/admin/users/${uid}/status`, { token: admin, body: { status: 'active' } });
check('reactivated user can log in again',
  (await call('POST', '/api/auth/login', { body: { email, password: 'correct horse battery' } })).status === 200);

// ---- unknown route ------------------------------------------------
check('unknown api route 404s', (await call('GET', '/api/nope')).status === 404);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

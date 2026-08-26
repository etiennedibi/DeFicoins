/* Exercises the password-reset flow against a running API.
   Usage: node scripts/test-reset.mjs [baseUrl] */

const BASE = process.argv[2] || 'http://localhost:4000';
const ADMIN_PASS = process.env.ADMIN_PASS || 'dev-admin-pass';

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
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, body: json };
}

console.log('password reset flow\n');

const email = `reset-${Date.now()}@example.com`;
const OLD = 'original password';
const NEW = 'brand new password';

const reg = await call('POST', '/api/auth/register', {
  body: { name: 'Reset Tester', email, password: OLD },
});
check('account created', reg.status === 200);

const admin = (await call('POST', '/api/auth/admin-login', {
  body: { username: process.env.ADMIN_USER || 'admin', password: ADMIN_PASS },
})).body.token;

// --- the request -----------------------------------------------------
const before = await call('GET', '/api/admin/password-resets?status=pending', { token: admin });
const beforeCount = before.body.resets.length;

const forgot = await call('POST', '/api/auth/forgot', { body: { email } });
check('forgot returns ok', forgot.status === 200);

const after = await call('GET', '/api/admin/password-resets?status=pending', { token: admin });
const mine = after.body.resets.filter((r) => r.email === email);
check('request reaches the admin queue', mine.length === 1, 'found ' + mine.length);
check('queue row carries the user name', mine[0]?.user_name === 'Reset Tester');

// --- anti-enumeration and anti-flood --------------------------------
const unknown = await call('POST', '/api/auth/forgot', { body: { email: 'nobody-here@example.com' } });
check('unknown address gets the same answer', unknown.status === 200 && unknown.body.ok === true);

const q2 = await call('GET', '/api/admin/password-resets?status=pending', { token: admin });
check('unknown address creates no queue row', q2.body.resets.length === beforeCount + 1,
  'queue is ' + q2.body.resets.length);

await call('POST', '/api/auth/forgot', { body: { email } });
const q3 = await call('GET', '/api/admin/password-resets?status=pending', { token: admin });
check('repeat request does not duplicate the row',
  q3.body.resets.filter((r) => r.email === email).length === 1);

// --- guards ----------------------------------------------------------
const id = mine[0].id;
check('reset queue needs an admin token',
  (await call('GET', '/api/admin/password-resets')).status === 401);
check('resolve rejects a short password',
  (await call('POST', `/api/admin/password-resets/${id}/resolve`,
    { token: admin, body: { password: 'short' } })).status === 400);
check('resolve 404s on an unknown id',
  (await call('POST', '/api/admin/password-resets/does-not-exist/resolve',
    { token: admin, body: { password: NEW } })).status === 404);

// --- the reset itself ------------------------------------------------
const resolve = await call('POST', `/api/admin/password-resets/${id}/resolve`, {
  token: admin, body: { password: NEW },
});
check('admin resolves the request', resolve.status === 200 && resolve.body.status === 'done',
  JSON.stringify(resolve.body));

check('new password works',
  (await call('POST', '/api/auth/login', { body: { email, password: NEW } })).status === 200);
check('old password no longer works',
  (await call('POST', '/api/auth/login', { body: { email, password: OLD } })).status === 401);

const q4 = await call('GET', '/api/admin/password-resets?status=pending', { token: admin });
check('request leaves the pending queue', q4.body.resets.every((r) => r.id !== id));

const done = await call('GET', '/api/admin/password-resets?status=done', { token: admin });
check('request is recorded as done', done.body.resets.some((r) => r.id === id));

check('resolving twice is refused',
  (await call('POST', `/api/admin/password-resets/${id}/resolve`,
    { token: admin, body: { password: NEW } })).status === 409);

// --- the user is told ------------------------------------------------
const token = (await call('POST', '/api/auth/login', { body: { email, password: NEW } })).body.token;
const msgs = await call('GET', '/api/messages', { token });
check('user asked for the reset in their thread',
  msgs.body.messages.some((m) => m.from_admin === 0 && m.body.includes('forgotten my password')));
check('user is told it was reset',
  msgs.body.messages.some((m) => m.from_admin === 1 && m.body.includes('has been reset')));

// --- dismiss path ----------------------------------------------------
await call('POST', '/api/auth/forgot', { body: { email } });
const q5 = await call('GET', '/api/admin/password-resets?status=pending', { token: admin });
const second = q5.body.resets.find((r) => r.email === email);
check('a fresh request can be raised after one is closed', !!second);

const cancel = await call('POST', `/api/admin/password-resets/${second.id}/cancel`, { token: admin });
check('admin can dismiss a request', cancel.status === 200 && cancel.body.status === 'cancelled');
check('dismissing twice is refused',
  (await call('POST', `/api/admin/password-resets/${second.id}/cancel`, { token: admin })).status === 409);
check('dismissal leaves the password alone',
  (await call('POST', '/api/auth/login', { body: { email, password: NEW } })).status === 200);

// --- overview counter -------------------------------------------------
const ov = await call('GET', '/api/admin/overview', { token: admin });
check('overview reports pending resets', typeof ov.body.pendingResets === 'number',
  JSON.stringify(ov.body));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

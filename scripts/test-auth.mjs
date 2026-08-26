import { generatePhrase, issueToken, readToken, deriveAddress, hashPassword, verifyPassword } from '../server/lib/auth.js';
import { COINS, isValidAddress } from '../server/lib/coins.js';

const p = generatePhrase();
console.log('phrase:', p, '| words:', p.split(' ').length);

const tok = issueToken('user-1', 'user');
console.log('token roundtrip:', JSON.stringify(readToken(tok)));
console.log('tampered rejected:', readToken(tok.slice(0, -2) + 'xx') === null);
console.log('garbage rejected:', readToken('nonsense') === null);

const h = await hashPassword('correct horse');
console.log('password ok:', await verifyPassword('correct horse', h), '| wrong rejected:', !(await verifyPassword('nope', h)));

let bad = 0;
for (const c of COINS) {
  const addr = deriveAddress(c.chain, 'user-1', c.symbol);
  const ok = isValidAddress(c.symbol, addr);
  if (!ok) { bad++; console.log('  FAIL', c.symbol, c.chain, addr); }
}
console.log(bad ? `${bad} generated addresses fail their own validator` : 'all 14 generated addresses pass their own validator');
console.log('deterministic:', deriveAddress('Bitcoin', 'u', 'BTC') === deriveAddress('Bitcoin', 'u', 'BTC'));
console.log('distinct per coin:', deriveAddress('Ethereum', 'u', 'ETH') !== deriveAddress('Ethereum', 'u', 'USDT'));

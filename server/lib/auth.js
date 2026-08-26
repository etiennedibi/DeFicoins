import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { WORDLIST } from './wordlist.js';

const SECRET = process.env.SESSION_SECRET || '';
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production');
}
const KEY = SECRET || 'dev-only-insecure-secret';

export const hashPassword = (plain) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export const newId = () => crypto.randomUUID();

/* Stateless session token: <payload>.<hmac>. Survives restarts and scales
   past one process, unlike an in-memory token set. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload) {
  return crypto.createHmac('sha256', KEY).update(payload).digest('base64url');
}

export function issueToken(userId, role = 'user') {
  const payload = Buffer.from(JSON.stringify({ sub: userId, role, exp: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  const expected = sign(payload);
  // constant-time compare; length mismatch means it cannot match anyway
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/* 12 words drawn with rejection sampling so every word is equally likely —
   `% 2048` on a 16-bit draw would skew the distribution. */
export function generatePhrase(count = 12) {
  const out = [];
  while (out.length < count) {
    const n = crypto.randomBytes(2).readUInt16BE(0);
    if (n >= 63488) continue;            // 63488 = 31 * 2048, the largest multiple that fits
    out.push(WORDLIST[n % 2048]);
  }
  return out.join(' ');
}

/* Deterministic per-(user, coin) deposit address in the shape the chain uses.
   These are display addresses for a custodial ledger, not derived keys — the
   admin can overwrite any of them with a real master address. */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH = 'acdefghjklmnpqrstuvwxyz023456789';
const HEX = '0123456789abcdef';

function stream(seed) {
  let buf = crypto.createHash('sha256').update(seed).digest();
  let i = 0;
  return () => {
    if (i >= buf.length) { buf = crypto.createHash('sha256').update(buf).digest(); i = 0; }
    return buf[i++];
  };
}
const take = (next, pool, n) => Array.from({ length: n }, () => pool[next() % pool.length]).join('');

export function deriveAddress(chain, userId, symbol) {
  const next = stream(`${KEY}:${userId}:${symbol}`);
  switch (chain) {
    case 'Bitcoin':      return 'bc1q' + take(next, BECH, 38);
    case 'Litecoin':     return 'ltc1q' + take(next, BECH, 38);
    case 'Ethereum':
    case 'BSC':
    case 'Avalanche':
    case 'Polygon':      return '0x' + take(next, HEX, 40);
    case 'Solana':       return take(next, B58, 44);
    case 'XRP Ledger':   return 'r' + take(next, B58, 33);
    case 'Cardano':      return 'addr1' + take(next, BECH, 53);
    case 'Dogecoin':     return 'D' + take(next, B58, 33);
    case 'Polkadot':     return '1' + take(next, B58, 46);
    case 'TRON':         return 'T' + take(next, B58, 33);
    default:             return take(next, B58, 34);
  }
}

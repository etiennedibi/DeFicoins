import { COINS, getCoin } from './coins.js';
import { db, toObjects } from './db.js';

/* Live prices come from CoinGecko's public endpoint. The free tier is rate
   limited, so the whole app reads through one server-side cache rather than
   letting each client hit the API. Admin overrides win over the feed. */

const TTL_MS = 45_000;
const STALE_OK_MS = 10 * 60_000; // serve stale rather than nothing if the feed is down

let cache = { at: 0, data: null };
let inflight = null;

const CG = 'https://api.coingecko.com/api/v3/simple/price';

async function fetchLive() {
  const ids = COINS.map((c) => c.cgId).join(',');
  const url = `${CG}?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const headers = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = await res.json();
    const out = {};
    for (const c of COINS) {
      const hit = json[c.cgId];
      if (!hit) continue;
      out[c.symbol] = { price: Number(hit.usd) || 0, change24h: Number(hit.usd_24h_change) || 0 };
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

async function overrides() {
  try {
    const rows = toObjects(await db.execute('SELECT symbol, manual_price, enabled FROM coin_overrides'));
    return new Map(rows.map((r) => [r.symbol, r]));
  } catch {
    return new Map();
  }
}

/* Never throws: a dead feed degrades to the last good snapshot, then to zeros,
   so the portfolio still renders. */
export async function getPrices() {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return applyOverrides(cache.data);

  if (!inflight) {
    inflight = fetchLive()
      .then((data) => { cache = { at: Date.now(), data }; return data; })
      .catch((err) => {
        if (cache.data && Date.now() - cache.at < STALE_OK_MS) return cache.data;
        console.warn('[market] price feed unavailable:', err.message);
        return cache.data || Object.fromEntries(COINS.map((c) => [c.symbol, { price: 0, change24h: 0 }]));
      })
      .finally(() => { inflight = null; });
  }
  return applyOverrides(await inflight);
}

async function applyOverrides(base) {
  const ov = await overrides();
  const out = {};
  for (const c of COINS) {
    const o = ov.get(c.symbol);
    if (o && o.enabled === 0) continue;
    const live = base[c.symbol] || { price: 0, change24h: 0 };
    out[c.symbol] = o && o.manual_price != null
      ? { price: Number(o.manual_price), change24h: live.change24h, manual: true }
      : live;
  }
  return out;
}

export async function usdValue(symbol, amount) {
  const prices = await getPrices();
  const p = prices[String(symbol).toUpperCase()];
  return (p ? p.price : 0) * Number(amount || 0);
}

/* Swap rate between two assets, derived from their USD prices. */
export async function swapRate(from, to) {
  const prices = await getPrices();
  const a = prices[String(from).toUpperCase()]?.price || 0;
  const b = prices[String(to).toUpperCase()]?.price || 0;
  if (!a || !b) return 0;
  return a / b;
}

export function coinMeta(symbol) { return getCoin(symbol); }

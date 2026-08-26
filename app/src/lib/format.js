/* Display formatting. All amounts are rendered through here so the wallet
   never shows a raw float. Locale defaults to the UI language, not the
   browser's — see lib/locale.js. */

import { formatLocale } from './locale.js';

export function money(usd, currency = 'USD', locale = formatLocale()) {
  const n = Number(usd) || 0;
  /* narrowSymbol keeps it "$" in every locale. Without it French renders
     "$US" and Canadian English renders "US$", which then disagrees with the
     plain "$" used by the market list on the same screen. */
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n);
  }
}

/* Crypto amounts need more precision for small holdings and less for large
   ones — 0.00004821 BTC and 1,204.5 DOGE should both read cleanly. */
export function coinAmount(value, decimals = 6, locale = formatLocale()) {
  const n = Number(value) || 0;
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const dp = abs >= 1000 ? 2 : abs >= 1 ? Math.min(decimals, 4) : decimals;
  return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

export function price(n, locale = formatLocale()) {
  const v = Number(n) || 0;
  if (v === 0) return '—';
  const dp = v >= 1000 ? 2 : v >= 1 ? 2 : v >= 0.01 ? 4 : 6;
  return '$' + v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: dp });
}

export function pct(n) {
  const rounded = round2(n);
  if (rounded === 0) return '0.00%';
  return (rounded > 0 ? '+' : '') + rounded.toFixed(2) + '%';
}

/* Shared by pct() and the colour helper so the sign shown and the colour used
   are always derived from the same rounded number. */
function round2(n) {
  const v = Number(n) || 0;
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/* 'up' | 'down' | 'flat' — drives the green/red/neutral class. */
export function trend(n) {
  const r = round2(n);
  return r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
}

export function shortAddress(a, head = 6, tail = 6) {
  const s = String(a || '');
  return s.length <= head + tail + 3 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function txDate(iso, locale = formatLocale()) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

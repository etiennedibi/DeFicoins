/* The asset catalogue. Order here is the order shown in the Market list.

   `addressRe` is a shape check only — it tells the user they mistyped before
   the transfer is queued. It is deliberately not a checksum validation, and it
   proves nothing about whether an address exists on any chain. */

export const COINS = [
  { symbol: 'BTC',   name: 'Bitcoin',   chain: 'Bitcoin',   cgId: 'bitcoin',      decimals: 8, color: '#F7931A' },
  { symbol: 'ETH',   name: 'Ethereum',  chain: 'Ethereum',  cgId: 'ethereum',     decimals: 8, color: '#627EEA' },
  { symbol: 'USDT',  name: 'Tether',    chain: 'Ethereum',  cgId: 'tether',       decimals: 2, color: '#26A17B' },
  { symbol: 'USDC',  name: 'USD Coin',  chain: 'Ethereum',  cgId: 'usd-coin',     decimals: 2, color: '#2775CA' },
  { symbol: 'BNB',   name: 'BNB',       chain: 'BSC',       cgId: 'binancecoin',  decimals: 8, color: '#F3BA2F' },
  { symbol: 'SOL',   name: 'Solana',    chain: 'Solana',    cgId: 'solana',       decimals: 6, color: '#14F195' },
  { symbol: 'XRP',   name: 'XRP',       chain: 'XRP Ledger',cgId: 'ripple',       decimals: 6, color: '#23292F' },
  { symbol: 'ADA',   name: 'Cardano',   chain: 'Cardano',   cgId: 'cardano',      decimals: 6, color: '#0033AD' },
  { symbol: 'DOGE',  name: 'Dogecoin',  chain: 'Dogecoin',  cgId: 'dogecoin',     decimals: 6, color: '#C2A633' },
  { symbol: 'AVAX',  name: 'Avalanche', chain: 'Avalanche', cgId: 'avalanche-2',  decimals: 6, color: '#E84142' },
  { symbol: 'DOT',   name: 'Polkadot',  chain: 'Polkadot',  cgId: 'polkadot',     decimals: 6, color: '#E6007A' },
  { symbol: 'MATIC', name: 'Polygon',   chain: 'Polygon',   cgId: 'matic-network',decimals: 6, color: '#8247E5' },
  { symbol: 'TRX',   name: 'TRON',      chain: 'TRON',      cgId: 'tron',         decimals: 6, color: '#EF0027' },
  { symbol: 'LTC',   name: 'Litecoin',  chain: 'Litecoin',  cgId: 'litecoin',     decimals: 8, color: '#345D9D' },
];

const EVM = '^0x[a-fA-F0-9]{40}$';

export const ADDRESS_PATTERNS = {
  Bitcoin:      '^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$',
  Ethereum:     EVM,
  BSC:          EVM,
  Avalanche:    EVM,
  Polygon:      EVM,
  Solana:       '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
  'XRP Ledger': '^r[1-9A-HJ-NP-Za-km-z]{24,34}$',
  Cardano:      '^(addr1[ac-hj-np-z02-9]{50,110}|(Ae2|DdzFF)[1-9A-HJ-NP-Za-km-z]{40,110})$',
  Dogecoin:     '^[DA9][a-km-zA-HJ-NP-Z1-9]{25,34}$',
  Polkadot:     '^1[a-km-zA-HJ-NP-Z1-9]{45,47}$',
  TRON:         '^T[1-9A-HJ-NP-Za-km-z]{33}$',
  Litecoin:     '^(ltc1[ac-hj-np-z02-9]{11,71}|[LM3][a-km-zA-HJ-NP-Z1-9]{26,33})$',
};

const bySymbol = new Map(COINS.map((c) => [c.symbol, c]));

export function getCoin(symbol) {
  return bySymbol.get(String(symbol || '').toUpperCase()) || null;
}

export function isValidAddress(symbol, address) {
  const coin = getCoin(symbol);
  if (!coin) return false;
  const pattern = ADDRESS_PATTERNS[coin.chain];
  if (!pattern) return String(address || '').length >= 20;
  return new RegExp(pattern).test(String(address || '').trim());
}

/* Shipped to the client so it can validate before a round-trip and render
   the same catalogue the server enforces. */
export function publicCatalogue() {
  return COINS.map((c) => ({ ...c, addressRe: ADDRESS_PATTERNS[c.chain] || null }));
}

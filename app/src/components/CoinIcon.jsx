/* Coin badges drawn from the symbol itself: a tinted disc with the ticker's
   first characters. No network requests, no missing-image states, and it works
   for any coin the admin adds to the catalogue later. */

const GLYPH = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '₮',
  USDC: '$',
  XRP: '✕',
  DOGE: 'D',
  LTC: 'Ł',
};

export default function CoinIcon({ symbol, color = '#3B82F6', size = 40 }) {
  const glyph = GLYPH[symbol] || symbol.slice(0, 2);
  const fontSize = glyph.length > 1 ? size * 0.34 : size * 0.5;

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: color,
        color: readableOn(color),
        fontWeight: 700,
        fontSize,
        letterSpacing: glyph.length > 1 ? '-0.02em' : 0,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {glyph}
    </span>
  );
}

/* Pick black or white text depending on how bright the disc is, so tickers
   stay legible on both #F7931A and #23292F. */
function readableOn(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '#fff';
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#10192B' : '#FFFFFF';
}

import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api.js';
import { price } from '../../lib/format.js';
import CoinIcon from '../../components/CoinIcon.jsx';
import { Spinner } from '../../components/ui.jsx';

/* Per-coin controls: hide a coin from the app, or pin its price to a manual
   figure instead of the live feed. */

export default function Coins() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/coins', { admin: true }).then((d) => setRows(d.coins)).catch(() => setRows([]));
  }, []);

  useEffect(load, [load]);

  async function save(symbol, patch) {
    setBusy(symbol);
    try {
      const current = rows.find((c) => c.symbol === symbol);
      await api.post('/admin/coins/' + symbol, {
        manualPrice: 'manualPrice' in patch ? patch.manualPrice : current.manualPrice,
        enabled: 'enabled' in patch ? patch.enabled : current.enabled,
      }, { admin: true });
      load();
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return <div className="admin-loading"><Spinner size={24} /></div>;

  return (
    <>
      <h3 className="admin-h3">Market</h3>
      <p className="dim admin-note">
        Prices come from the live feed unless a manual price is set. Disabling a coin removes it from
        the wallet, the market list and every picker.
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Coin</th><th>Chain</th><th className="num">Live price</th>
              <th className="num">Manual price</th><th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CoinRow key={c.symbol} coin={c} busy={busy === c.symbol} onSave={save} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CoinRow({ coin, busy, onSave }) {
  const [manual, setManual] = useState(coin.manualPrice ?? '');

  useEffect(() => { setManual(coin.manualPrice ?? ''); }, [coin.manualPrice]);

  const dirty = String(manual) !== String(coin.manualPrice ?? '');

  return (
    <tr>
      <td>
        <span className="coin-cell">
          <CoinIcon symbol={coin.symbol} color={coin.color} size={26} />
          <b>{coin.symbol}</b>
          <span className="dim">{coin.name}</span>
        </span>
      </td>
      <td className="dim">{coin.chain}</td>
      <td className="num">{price(coin.livePrice)}</td>
      <td className="num">
        <span className="manual-cell">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="live"
            aria-label={`Manual price for ${coin.symbol}`}
          />
          {dirty && (
            <button className="link-btn" disabled={busy}
                    onClick={() => onSave(coin.symbol, { manualPrice: manual === '' ? null : Number(manual) })}>
              Save
            </button>
          )}
        </span>
      </td>
      <td>
        <label className="switch">
          <input
            type="checkbox"
            checked={coin.enabled}
            disabled={busy}
            onChange={(e) => onSave(coin.symbol, { enabled: e.target.checked })}
          />
          <span />
        </label>
      </td>
    </tr>
  );
}

import { useEffect, useState } from 'react';

import { useT } from '../i18n/index.jsx';
import Icon from './Icon.jsx';
import CoinIcon from './CoinIcon.jsx';
import { Sheet } from './ui.jsx';

/* The "Select Coin" sheet, reused by Receive, Send and Swap. */

export default function CoinPicker({ open, onClose, coins, value, onPick }) {
  const t = useT();
  const [query, setQuery] = useState('');

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const q = query.trim().toLowerCase();
  const list = coins.filter(
    (c) => !q || c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('coin.title')}>
      <div className="field" style={{ marginBottom: 12 }}>
        <span className="adorn"><Icon name="search" size={18} /></span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('coin.search')}
          aria-label={t('coin.search')}
        />
      </div>

      {list.length === 0 ? (
        <p className="hint" style={{ padding: '24px 8px', textAlign: 'center' }}>{t('coin.none')}</p>
      ) : (
        <ul className="coin-list">
          {list.map((c) => (
            <li key={c.symbol}>
              <button
                className={'coin-row' + (c.symbol === value ? ' is-active' : '')}
                onClick={() => { onPick(c.symbol); onClose(); }}
              >
                <CoinIcon symbol={c.symbol} color={c.color} />
                <div className="coin-row-main">
                  <div className="coin-row-name">{c.name}</div>
                  <div className="coin-row-sym">{c.symbol}</div>
                </div>
                {c.symbol === value && <Icon name="check" size={19} className="coin-row-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/* The button that opens the picker, showing the current selection. */
export function CoinSelectButton({ coin, onClick }) {
  if (!coin) return null;
  return (
    <button className="coin-select-btn" onClick={onClick}>
      <CoinIcon symbol={coin.symbol} color={coin.color} size={36} />
      <span className="meta">
        <b>{coin.name}</b>
        <span>{coin.symbol}</span>
      </span>
      <Icon name="chevronDown" size={20} />
    </button>
  );
}

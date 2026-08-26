import { useEffect, useState } from 'react';

import { useT } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { useWallet } from '../store/wallet.jsx';
import Icon from './Icon.jsx';
import CoinIcon from './CoinIcon.jsx';
import { Sheet, Spinner } from './ui.jsx';

/* Buy collects a coin and a dollar figure, then hands the buyer to support —
   the same path the reference app takes, because settlement is manual. */

export default function BuySheet({ open, onClose }) {
  const t = useT();
  const { assets } = useWallet();

  const [query, setQuery] = useState('');
  const [coin, setCoin] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) { setQuery(''); setAmount(''); setError(''); }
  }, [open]);

  const list = assets.filter((a) => {
    const q = query.trim().toLowerCase();
    return !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  });

  const usd = Number(amount);
  const canSubmit = coin && Number.isFinite(usd) && usd > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/buy', { coin, usdAmount: usd });
      onClose();
      /* The order is already a support thread server-side; open the chat so the
         next step is visible instead of leaving the user on a closed sheet. */
      window.dispatchEvent(new CustomEvent('deficoins:support'));
    } catch (err) {
      setError(err.message || t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('buy.title')}>
      <p className="hint" style={{ margin: '0 0 16px' }}>{t('buy.sub')}</p>

      <div className="field" style={{ marginBottom: 14 }}>
        <span className="adorn"><Icon name="search" size={18} /></span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('coin.search')}
          aria-label={t('coin.search')}
        />
      </div>

      <div className="coin-grid" style={{ maxHeight: 232, overflowY: 'auto', paddingBottom: 4 }}>
        {list.map((a) => (
          <button
            key={a.symbol}
            className={'coin-tile' + (a.symbol === coin ? ' is-active' : '')}
            onClick={() => setCoin(a.symbol)}
            aria-pressed={a.symbol === coin}
          >
            <CoinIcon symbol={a.symbol} color={a.color} size={34} />
            <b>{a.symbol}</b>
            <span>{a.name}</span>
          </button>
        ))}
        {list.length === 0 && <p className="hint" style={{ gridColumn: '1 / -1' }}>{t('coin.none')}</p>}
      </div>

      <div className="amount-box" style={{ marginTop: 18 }}>
        <div className="amount-row">
          <span className="amount-unit" style={{ fontSize: 26 }}>$</span>
          <input
            className="amount-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00"
            aria-label={t('send.amount')}
          />
        </div>
      </div>

      {error && <p className="error-text" style={{ marginTop: 12 }} role="alert">{error}</p>}

      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={submit} disabled={!canSubmit}>
        {busy ? <Spinner /> : <>{t('buy.cta')} <Icon name="chevron" size={17} /></>}
      </button>
    </Sheet>
  );
}

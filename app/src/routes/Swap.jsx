import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.jsx';
import { useWallet } from '../store/wallet.jsx';
import { api } from '../lib/api.js';
import { coinAmount, money } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import CoinIcon from '../components/CoinIcon.jsx';
import CoinPicker from '../components/CoinPicker.jsx';
import { Banner, Spinner, TopBar } from '../components/ui.jsx';

const FEE_PCT = 0.5; // mirrored from the server default; the response is authoritative

export default function Swap() {
  const t = useT();
  const nav = useNavigate();
  const { assets, refresh } = useWallet();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [picking, setPicking] = useState(null); // 'from' | 'to' | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const fromCoin = useMemo(() => assets.find((a) => a.symbol === from), [assets, from]);
  const toCoin = useMemo(() => assets.find((a) => a.symbol === to), [assets, to]);

  const held = assets.filter((a) => a.balance > 0);
  const hasAssets = held.length > 0;

  const value = Number(amount);
  const balance = fromCoin?.balance ?? 0;
  const rate = fromCoin?.price && toCoin?.price ? fromCoin.price / toCoin.price : 0;
  const receive = rate && Number.isFinite(value) ? value * rate * (1 - FEE_PCT / 100) : 0;

  const canSwap =
    fromCoin && toCoin && from !== to &&
    Number.isFinite(value) && value > 0 && value <= balance && rate > 0 && !busy;

  function flip() {
    setFrom(to);
    setTo(from);
    setAmount('');
  }

  async function submit() {
    if (!canSwap) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/swap', { from, to, amount: value });
      await refresh();
      setResult(r);
    } catch (err) {
      setError(err.message || t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="screen" style={{ padding: 0 }}>
        <TopBar title={t('swap.title')} onBack={() => nav('/wallet')} />
        <div style={{ padding: '40px 22px', display: 'grid', gap: 20, justifyItems: 'center' }}>
          <span style={{
            width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: 'rgba(34,197,94,.14)', color: 'var(--up)',
          }}>
            <Icon name="check" size={30} />
          </span>
          <p style={{ textAlign: 'center', fontSize: 15 }}>{t('swap.done')}</p>
          <p style={{ fontSize: 22, fontWeight: 800 }}>
            {coinAmount(result.received, toCoin?.decimals)} {to}
          </p>
          <button className="btn btn-primary" onClick={() => nav('/wallet')}>{t('common.back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar title={t('swap.title')} />

      <div style={{ padding: '8px 20px 0', flex: 1 }}>
        <Leg
          label={t('swap.youPay')}
          coin={fromCoin}
          onPick={() => setPicking('from')}
          amount={amount}
          onAmount={(v) => setAmount(v.replace(/[^\d.]/g, ''))}
          usd={(fromCoin?.price ?? 0) * (Number.isFinite(value) ? value : 0)}
          balance={balance}
          onMax={() => setAmount(String(balance))}
          editable
          t={t}
        />

        <div className="swap-flip">
          <button onClick={flip} aria-label={t('swap.title')} disabled={!from || !to}>
            <Icon name="swap" size={19} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>

        <Leg
          label={t('swap.youReceive')}
          coin={toCoin}
          onPick={() => setPicking('to')}
          amount={receive ? coinAmount(receive, toCoin?.decimals) : ''}
          usd={(toCoin?.price ?? 0) * receive}
          t={t}
        />

        <dl className="summary">
          <div className="summary-row">
            <dt>{t('swap.rate')}</dt>
            <dd>{rate ? `1 ${from} ≈ ${coinAmount(rate, 6)} ${to}` : '—'}</dd>
          </div>
          <div className="summary-row">
            <dt>{t('swap.network')}</dt>
            <dd>{t('swap.internal')}</dd>
          </div>
        </dl>

        {!hasAssets && <Banner tone="info" icon="info">{t('swap.empty')}</Banner>}
        {error && <div style={{ marginTop: 14 }}><Banner tone="error" icon="warn">{error}</Banner></div>}
      </div>

      <div className="screen-foot" style={{ padding: '16px 20px calc(var(--safe-b) + 16px)' }}>
        <button className="btn btn-primary" onClick={submit} disabled={!canSwap}>
          {busy ? <Spinner /> : <><Icon name="swap" size={19} /> {t('swap.cta')}</>}
        </button>
      </div>

      <CoinPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        coins={picking === 'from' ? (hasAssets ? held : assets) : assets}
        value={picking === 'from' ? from : to}
        onPick={(s) => {
          if (picking === 'from') { setFrom(s); if (s === to) setTo(''); }
          else { setTo(s); if (s === from) setFrom(''); }
        }}
      />
    </div>
  );
}

function Leg({ label, coin, onPick, amount, onAmount, usd, balance, onMax, editable, t }) {
  return (
    <div className="amount-box">
      <span className="label">{label}</span>
      <div className="amount-row">
        <button className="chip" onClick={onPick} style={{ flex: 'none' }}>
          {coin ? (
            <>
              <CoinIcon symbol={coin.symbol} color={coin.color} size={22} />
              {coin.symbol}
            </>
          ) : (
            t('common.select')
          )}
          <Icon name="chevronDown" size={15} />
        </button>
        <input
          className="amount-input"
          style={{ textAlign: 'right' }}
          inputMode="decimal"
          value={amount}
          onChange={editable ? (e) => onAmount(e.target.value) : undefined}
          readOnly={!editable}
          placeholder="0.00"
          aria-label={label}
        />
      </div>
      <div className="amount-foot">
        <span className="amount-usd">≈ {money(usd)}</span>
        {editable && (
          <button className="max-btn" onClick={onMax} disabled={!coin}>{t('common.max')}</button>
        )}
      </div>
      {editable && coin && (
        <p className="available">
          {t('send.available', {
            amount: coinAmount(balance ?? 0, coin.decimals),
            symbol: coin.symbol,
          })}
        </p>
      )}
    </div>
  );
}

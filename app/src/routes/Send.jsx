import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.jsx';
import { useWallet } from '../store/wallet.jsx';
import { api } from '../lib/api.js';
import { coinAmount, money } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import CoinIcon from '../components/CoinIcon.jsx';
import CoinPicker from '../components/CoinPicker.jsx';
import { Banner, Spinner, TopBar } from '../components/ui.jsx';

export default function Send() {
  const t = useT();
  const nav = useNavigate();
  const { assets, refresh } = useWallet();

  const [symbol, setSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const coin = useMemo(() => assets.find((a) => a.symbol === symbol), [assets, symbol]);

  /* The catalogue ships its address pattern, so the tick appears as the user
     pastes rather than after a round-trip. The server re-checks regardless. */
  const [patterns, setPatterns] = useState({});
  useEffect(() => {
    api.get('/coins')
      .then((d) => setPatterns(Object.fromEntries(d.coins.map((c) => [c.symbol, c.addressRe]))))
      .catch(() => {});
  }, []);

  const addressState = (() => {
    const v = to.trim();
    if (!v) return 'empty';
    const re = patterns[symbol];
    if (!re) return 'empty';
    return new RegExp(re).test(v) ? 'valid' : 'invalid';
  })();

  const value = Number(amount);
  const balance = coin?.balance ?? 0;
  const overBalance = Number.isFinite(value) && value > balance;
  const canSend =
    Number.isFinite(value) && value > 0 && !overBalance && addressState === 'valid' && !busy;

  /* The five coins the user actually holds sit as chips, like the reference;
     anything else is one tap away in the picker. */
  const chips = assets.filter((a) => a.balance > 0).slice(0, 4);
  const chipList = chips.some((c) => c.symbol === symbol) || !coin ? chips : [coin, ...chips].slice(0, 5);

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/send', { coin: symbol, amount: value, to: to.trim() });
      await refresh();
      setDone(true);
    } catch (err) {
      setError(err.message || t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="screen" style={{ padding: 0 }}>
        <TopBar title={t('send.title')} onBack={() => nav('/wallet')} />
        <div style={{ padding: '40px 22px', display: 'grid', gap: 20, justifyItems: 'center' }}>
          <span className="badge" style={{
            width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: 'rgba(240,169,59,.14)', color: 'var(--warn)',
          }}>
            <Icon name="clock" size={28} />
          </span>
          <p style={{ textAlign: 'center', fontSize: 15, lineHeight: 1.6 }}>{t('send.submitted')}</p>
          <button className="btn btn-primary" onClick={() => nav('/history')}>{t('history.title')}</button>
          <button className="btn btn-quiet" onClick={() => nav('/wallet')}>{t('common.back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar title={t('send.title')} />

      <div style={{ padding: '8px 20px 0', flex: 1 }}>
        <div className="chips">
          {chipList.map((a) => (
            <button
              key={a.symbol}
              className={'chip' + (a.symbol === symbol ? ' is-active' : '')}
              onClick={() => setSymbol(a.symbol)}
            >
              <CoinIcon symbol={a.symbol} color={a.color} size={24} />
              {a.symbol}
            </button>
          ))}
          <button className="chip" onClick={() => setPickerOpen(true)}>
            <Icon name="chevronDown" size={16} />
          </button>
        </div>

        <span className="label">{t('send.amount')}</span>
        <div className="amount-box">
          <div className="amount-row">
            <input
              className="amount-input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0"
              aria-label={t('send.amount')}
            />
            <span className="amount-unit">{symbol}</span>
          </div>
          <div className="amount-foot">
            <span className="amount-usd">
              ≈ {money((coin?.price ?? 0) * (Number.isFinite(value) ? value : 0))}
            </span>
            <button className="max-btn" onClick={() => setAmount(String(balance))}>
              {t('common.max')}
            </button>
          </div>
          <p className="available">
            {t('send.available', { amount: coinAmount(balance, coin?.decimals), symbol })}
          </p>
        </div>

        {overBalance && <p className="error-text" style={{ marginTop: 10 }}>{t('send.insufficient')}</p>}

        <span className="label" style={{ marginTop: 22 }}>{t('send.recipient')}</span>
        <div className={
          'field' +
          (addressState === 'valid' ? ' is-valid' : addressState === 'invalid' ? ' is-error' : '')
        }>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t('send.recipientPh')}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            style={{ fontFamily: 'var(--mono)', fontSize: 13.5 }}
            aria-label={t('send.recipient')}
          />
          {addressState === 'valid' && (
            <span className="adorn" style={{ color: 'var(--up)' }}><Icon name="check" size={19} /></span>
          )}
        </div>
        {addressState === 'valid' && (
          <p className="ok-text" style={{ marginTop: 9 }}>
            <Icon name="check" size={15} /> {t('send.valid', { symbol })}
          </p>
        )}
        {addressState === 'invalid' && (
          <p className="error-text" style={{ marginTop: 9 }}>{t('send.invalid', { symbol })}</p>
        )}

        {error && <div style={{ marginTop: 16 }}><Banner tone="error" icon="warn">{error}</Banner></div>}
      </div>

      <div className="screen-foot" style={{ padding: '16px 20px calc(var(--safe-b) + 16px)' }}>
        <button className="btn btn-primary" onClick={submit} disabled={!canSend}>
          {busy ? <Spinner /> : t('send.cta')}
        </button>
      </div>

      <CoinPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        coins={assets}
        value={symbol}
        onPick={setSymbol}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.jsx';
import { useWallet } from '../store/wallet.jsx';
import { api } from '../lib/api.js';
import { money, coinAmount, price, pct, trend } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import CoinIcon from '../components/CoinIcon.jsx';
import BuySheet from '../components/BuySheet.jsx';
import { Empty, Spinner } from '../components/ui.jsx';

/* Buy has no route of its own: in the reference it rises as a sheet over the
   portfolio, so it stays here as local state. */
const ACTIONS = [
  { key: 'send',    to: '/send',    icon: 'arrowUp',   label: 'home.send' },
  { key: 'swap',    to: '/swap',    icon: 'swap',      label: 'home.swap', primary: true },
  { key: 'receive', to: '/receive', icon: 'arrowDown', label: 'home.receive' },
  { key: 'history', to: '/history', icon: 'clock',     label: 'home.history' },
  { key: 'buy',     sheet: 'buy',   icon: 'plus',      label: 'home.buy' },
];

export default function Home() {
  const t = useT();
  const nav = useNavigate();
  const { user, assets, total, hidden, toggleHidden, refresh, refreshing } = useWallet();
  const [tab, setTab] = useState('crypto');
  const [buyOpen, setBuyOpen] = useState(false);

  const initials = (user?.name || '?')
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  /* Only coins the user actually holds appear above the fold; the full
     catalogue lives in the Market list below. */
  const held = assets.filter((a) => a.balance > 0).sort((a, b) => b.usdValue - a.usdValue);

  return (
    <div className="home">
      <header className="home-head">
        <span className="avatar">{initials}</span>
        <span className="home-name">
          {user?.name?.split(/\s+/)[0]}
          <Icon name="chevronDown" size={16} />
        </span>
        <div className="home-head-actions">
          <button className="icon-btn" aria-label={t('settings.notifications')}>
            <Icon name="bell" size={21} />
          </button>
          <button className="icon-btn" aria-label={t('settings.support')}
                  onClick={() => window.dispatchEvent(new CustomEvent('deficoins:support'))}>
            <Icon name="headset" size={21} />
          </button>
          <button className="icon-btn" aria-label={t('settings.title')} onClick={() => nav('/settings')}>
            <Icon name="settings" size={21} />
          </button>
        </div>
      </header>

      <section className="balance">
        <div className="balance-row">
          <span className="balance-amount">
            {hidden ? '••••••' : money(total, user?.base_currency || 'USD')}
          </span>
          <button onClick={refresh} aria-label={t('common.retry')}>
            <Icon name="refresh" size={20} className={refreshing ? 'is-spinning' : undefined} />
          </button>
          <button onClick={toggleHidden} aria-label={t('home.totalBalance')} aria-pressed={hidden}>
            <Icon name={hidden ? 'eyeOff' : 'eye'} size={21} />
          </button>
        </div>
        <span className="currency-chip">
          🇺🇸 {user?.base_currency || 'USD'} <Icon name="chevronDown" size={13} />
        </span>
      </section>

      <nav className="actions">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            className={'action' + (a.primary ? ' is-primary' : '')}
            onClick={() => (a.sheet === 'buy' ? setBuyOpen(true) : nav(a.to))}
          >
            <Icon name={a.icon} size={21} className="glyph" />
            {t(a.label)}
          </button>
        ))}
      </nav>

      <div className="tabs">
        <button className={'tab' + (tab === 'crypto' ? ' is-active' : '')} onClick={() => setTab('crypto')}>
          {t('home.tabCrypto')}
        </button>
        <button className={'tab' + (tab === 'nfts' ? ' is-active' : '')} onClick={() => setTab('nfts')}>
          {t('home.tabNfts')}
        </button>
        <div className="tabs-right">
          <button className="icon-btn" aria-label={t('common.search')}><Icon name="search" size={19} /></button>
          <button className="icon-btn" aria-label={t('history.title')} onClick={() => nav('/history')}>
            <Icon name="clock" size={19} />
          </button>
        </div>
      </div>

      {tab === 'nfts' ? (
        <Empty>{t('home.nftsEmpty')}</Empty>
      ) : (
        <>
          {held.length > 0 && (
            <ul className="asset-list" style={{ paddingTop: 12 }}>
              {held.map((a) => (
                <li key={a.symbol}>
                  <button className="asset-row" onClick={() => nav('/receive?coin=' + a.symbol)}>
                    <CoinIcon symbol={a.symbol} color={a.color} />
                    <div className="asset-main">
                      <div className="asset-name">
                        {a.symbol}
                        <span className="asset-chain">{a.chain}</span>
                      </div>
                      <div className="asset-sub">
                        {hidden ? '••••' : coinAmount(a.balance, a.decimals)} {a.symbol}
                      </div>
                    </div>
                    <div className="asset-right">
                      <div className="asset-value">{hidden ? '••••' : money(a.usdValue)}</div>
                      <div className={'asset-change ' + trend(a.change24h)}>
                        {pct(a.change24h)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Market emptyPortfolio={held.length === 0} />
        </>
      )}

      <BuySheet open={buyOpen} onClose={() => setBuyOpen(false)} />
    </div>
  );
}

/* The live market list. It polls on its own so a price refresh does not
   re-render the whole portfolio. */
function Market({ emptyPortfolio }) {
  const t = useT();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.get('/market')
      .then((d) => { if (alive) setRows(d.market); })
      .catch(() => { if (alive) setRows((r) => r ?? []); });

    load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 45_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <>
      {emptyPortfolio && <Empty>{t('home.noAssets')}</Empty>}

      <div className="section-head">
        <h2>{t('home.market')}</h2>
        <span className="live-badge">{t('home.live')}</span>
      </div>

      {rows === null ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty>{t('common.somethingWrong')}</Empty>
      ) : (
        <ul className="asset-list">
          {rows.map((m) => (
            <li key={m.symbol}>
              <button className="asset-row" onClick={() => nav('/receive?coin=' + m.symbol)}>
                <CoinIcon symbol={m.symbol} color={m.color} />
                <div className="asset-main">
                  <div className="asset-name">
                    {m.symbol}
                    <span className="asset-chain">{m.name}</span>
                  </div>
                  <div className="asset-sub">
                    {price(m.price)}
                    <span className={trend(m.change24h)}>{pct(m.change24h)}</span>
                  </div>
                </div>
                <div className="asset-right">
                  <div className={'asset-change ' + trend(m.change24h)}>
                    {pct(m.change24h)}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

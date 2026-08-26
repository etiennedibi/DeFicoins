import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { useWallet } from '../store/wallet.jsx';
import { coinAmount, money, txDate } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import { Empty, Sheet, Spinner, TopBar } from '../components/ui.jsx';
import { shortAddress } from '../lib/format.js';

const ICON = { send: 'arrowUp', receive: 'arrowDown', swap: 'swap', buy: 'plus' };

export default function History() {
  const { t, lang } = useI18n();
  const { assets } = useWallet();
  const [rows, setRows] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/transactions')
      .then((d) => { if (alive) setRows(d.transactions || []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  const decimalsOf = (s) => assets.find((a) => a.symbol === s)?.decimals ?? 6;

  function title(tx) {
    if (tx.type === 'swap') return t('history.swap', { from: tx.coin, to: tx.related_coin });
    return t('history.' + tx.type, { symbol: tx.coin });
  }

  return (
    <div className="screen" style={{ padding: 0 }}>
      <TopBar title={t('history.title')} />

      <div style={{ padding: '8px 20px calc(var(--safe-b) + 90px)' }}>
        {rows === null ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 50 }}><Spinner size={26} /></div>
        ) : rows.length === 0 ? (
          <Empty>{t('history.empty')}</Empty>
        ) : (
          <ul className="tx-list">
            {rows.map((tx) => {
              const outgoing = tx.type === 'send';
              return (
                <li key={tx.id}>
                  <button className="tx-row" onClick={() => setDetail(tx)}>
                    <span className="tx-icon"><Icon name={ICON[tx.type] || 'clock'} size={19} /></span>
                    <div className="tx-main">
                      <div className="tx-title">{title(tx)}</div>
                      <div className="tx-sub">
                        <span>{txDate(tx.created_at, lang)}</span>
                        <span className={'tx-status st-' + tx.status}>{t('status.' + tx.status)}</span>
                      </div>
                    </div>
                    <div className="tx-right">
                      <div className={'tx-amount ' + (outgoing ? '' : 'up')}>
                        {outgoing ? '−' : '+'}{coinAmount(tx.amount, decimalsOf(tx.coin))}
                      </div>
                      <div className="tx-usd">{money(tx.usd_value)}</div>
                    </div>
                    <Icon name="chevron" size={17} style={{ color: 'var(--text-mute)', flex: 'none' }} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? title(detail) : ''}>
        {detail && (
          <dl className="summary" style={{ paddingBottom: 8 }}>
            <Row label={t('send.amount')}
                 value={`${coinAmount(detail.amount, decimalsOf(detail.coin))} ${detail.coin}`} />
            <Row label="USD" value={money(detail.usd_value)} />
            {detail.type === 'swap' && (
              <Row label={t('swap.youReceive')}
                   value={`${coinAmount(detail.related_amount, decimalsOf(detail.related_coin))} ${detail.related_coin}`} />
            )}
            {detail.counterparty && (
              <Row label={t('send.recipient')} value={shortAddress(detail.counterparty, 10, 8)} mono />
            )}
            {detail.note && <Row label="Note" value={detail.note} />}
            <Row label={t('swap.network')}
                 value={detail.type === 'swap' ? t('swap.internal') : (assets.find((a) => a.symbol === detail.coin)?.chain || '—')} />
            <Row label={t('common.status')} value={t('status.' + detail.status)} />
            <Row label={t('common.date')} value={txDate(detail.created_at, lang)} />
          </dl>
        )}
      </Sheet>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="summary-row">
      <dt>{label}</dt>
      <dd style={mono ? { fontFamily: 'var(--mono)', fontSize: 12.5 } : undefined}>{value}</dd>
    </div>
  );
}

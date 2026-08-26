import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';

import { useT } from '../i18n/index.jsx';
import { useWallet } from '../store/wallet.jsx';
import Icon from '../components/Icon.jsx';
import CoinPicker, { CoinSelectButton } from '../components/CoinPicker.jsx';
import { Banner, CopyButton, Spinner, TopBar } from '../components/ui.jsx';

export default function Receive() {
  const t = useT();
  const { assets } = useWallet();
  const [params, setParams] = useSearchParams();

  const [symbol, setSymbol] = useState(() => params.get('coin') || 'BTC');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qr, setQr] = useState('');

  const coin = useMemo(() => assets.find((a) => a.symbol === symbol), [assets, symbol]);
  const address = coin?.address || '';

  useEffect(() => {
    setParams(address ? { coin: symbol } : {}, { replace: true });
  }, [symbol, address, setParams]);

  useEffect(() => {
    if (!address) { setQr(''); return; }
    let alive = true;
    QRCode.toDataURL(address, {
      width: 480,
      margin: 0,
      color: { dark: '#0A1220', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [address]);

  async function share() {
    if (!address) return;
    const payload = { title: `${symbol} address`, text: address };
    if (navigator.share) {
      try { await navigator.share(payload); return; } catch { /* dismissed */ }
    }
    try { await navigator.clipboard.writeText(address); } catch {}
  }

  return (
    <div className="screen" style={{ padding: 0 }}>
      <TopBar title={t('receive.title')} />

      <div style={{ padding: '8px 20px calc(var(--safe-b) + 90px)' }}>
        <CoinSelectButton coin={coin} onClick={() => setPickerOpen(true)} />

        {!address ? (
          <Banner tone="warn" icon="warn">{t('receive.noAddress')}</Banner>
        ) : (
          <>
            <div className="qr-frame">
              {qr ? <img src={qr} alt={`${symbol} address QR code`} /> : <Spinner size={28} />}
            </div>

            <div className="card address-card">
              <span className="label" style={{ marginBottom: 0 }}>
                {t('receive.address', { symbol })}
              </span>
              <p className="address-value">{address}</p>
              <div className="address-actions">
                <CopyButton
                  className="round-btn"
                  text={address}
                  label=""
                  copiedLabel=""
                />
                <button className="round-btn secondary" onClick={share} aria-label={t('receive.share')}>
                  <Icon name="share" size={19} />
                </button>
              </div>
            </div>

            <div className="notes">
              <Banner tone="info" icon="info">
                {t('receive.warnNetwork', { symbol, name: coin.name })}
              </Banner>
              <Banner tone="info" icon="shield">{t('receive.warnUnique')}</Banner>
            </div>
          </>
        )}
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

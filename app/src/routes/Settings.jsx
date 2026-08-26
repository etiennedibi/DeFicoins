import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useI18n } from '../i18n/index.jsx';
import { useWallet } from '../store/wallet.jsx';
import Icon from '../components/Icon.jsx';
import { Sheet, TopBar } from '../components/ui.jsx';

export default function Settings() {
  const { t, lang, setLang, langs, current } = useI18n();
  const nav = useNavigate();
  const { user, signOut } = useWallet();
  const [langOpen, setLangOpen] = useState(false);

  function logout() {
    signOut();
    nav('/', { replace: true });
  }

  return (
    <div className="screen" style={{ padding: 0 }}>
      <TopBar title={t('settings.title')} />

      <div style={{ padding: '12px 14px calc(var(--safe-b) + 90px)' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 17 }}>
            {(user?.name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </div>
          </div>
        </div>

        <div className="settings-group">
          <h3>{t('settings.profile')}</h3>
          <Row icon="user" label={t('settings.profile')} />
          <Row icon="lock" label={t('settings.changePassword')} />
          <Row icon="shield" label={t('settings.security')} />
        </div>

        <div className="settings-group">
          <h3>{t('settings.title')}</h3>
          <Row
            icon="grid"
            label={t('settings.language')}
            value={`${current.flag} ${current.label}`}
            onClick={() => setLangOpen(true)}
          />
          <Row icon="wallet" label={t('settings.currency')} value={user?.base_currency || 'USD'} />
          <Row icon="bell" label={t('settings.notifications')} />
        </div>

        <div className="settings-group">
          <h3>{t('settings.support')}</h3>
          <Row
            icon="headset"
            label={t('settings.support')}
            onClick={() => window.dispatchEvent(new CustomEvent('deficoins:support'))}
          />
        </div>

        <div className="settings-group">
          <button className="settings-row danger" onClick={logout}>
            <span className="lead"><Icon name="logout" size={20} /></span>
            <span className="label-text">{t('settings.logout')}</span>
          </button>
        </div>
      </div>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('lang.title')}>
        <ul className="lang-list">
          {langs.map((l) => (
            <li key={l.code}>
              <button
                className={'lang-row' + (l.code === lang ? ' is-active' : '')}
                onClick={() => { setLang(l.code); setLangOpen(false); }}
              >
                <span className="lang-flag">{l.flag}</span>
                <span className="lang-label">{l.label}</span>
                {l.code === lang && <Icon name="check" size={18} className="lang-check" />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

function Row({ icon, label, value, onClick }) {
  return (
    <button className="settings-row" onClick={onClick} disabled={!onClick}>
      <span className="lead"><Icon name={icon} size={20} /></span>
      <span className="label-text">{label}</span>
      {value && <span className="value">{value}</span>}
      <Icon name="chevron" size={17} style={{ color: 'var(--text-mute)' }} />
    </button>
  );
}

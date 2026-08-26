import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.jsx';
import { useWallet } from '../store/wallet.jsx';
import Icon, { Logo } from '../components/Icon.jsx';
import { LanguagePicker, PasswordField, Spinner } from '../components/ui.jsx';

/* The reference screen asks only for a password, because it presents itself as
   a local wallet. Ours is an account, so it needs the email too — but the
   layout, order and wording stay as close to the reference as that allows. */

export default function Unlock() {
  const t = useT();
  const nav = useNavigate();
  const { signIn } = useWallet();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      nav('/wallet', { replace: true });
    } catch (err) {
      setError(err.message || t('unlock.badCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-top">
        <LanguagePicker />
      </div>

      <div className="auth-hero">
        <Logo size={72} />
        <h1>DeFicoins</h1>
        <p>{t('app.tagline')}</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="email">{t('create.email')}</label>
          <div className="field">
            <span className="adorn"><Icon name="mail" size={18} /></span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('create.emailPh')}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="pw">{t('unlock.password')}</label>
          <PasswordField
            id="pw"
            value={password}
            onChange={setPassword}
            placeholder={t('unlock.placeholder')}
          />
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy || !email || !password}>
          {busy ? <Spinner /> : t('unlock.cta')}
        </button>
      </form>

      <div className="auth-foot">
        <div className="divider">{t('common.or')}</div>

        <Link className="btn btn-ghost" to="/create">
          <Icon name="plus" size={19} />
          {t('unlock.create')}
        </Link>

        <Link className="auth-link" to="/recover">
          <Icon name="key" size={17} />
          {t('unlock.recover')}
        </Link>

        <p className="auth-copyright">{t('unlock.rights', { year: new Date().getFullYear() })}</p>
      </div>
    </div>
  );
}

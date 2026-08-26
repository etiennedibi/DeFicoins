import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.jsx';
import { useWallet } from '../store/wallet.jsx';
import Icon from '../components/Icon.jsx';
import { LanguagePicker, PasswordField, Spinner, TopBar } from '../components/ui.jsx';

export default function CreateWallet() {
  const t = useT();
  const nav = useNavigate();
  const { register } = useWallet();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = name && email && password.length >= 8 && password === confirm && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');

    if (password.length < 8) return setError(t('create.weak'));
    if (password !== confirm) return setError(t('create.mismatch'));

    setBusy(true);
    try {
      const data = await register(name.trim(), email.trim(), password);
      /* The phrase is only ever returned once, at registration — hand it
         straight to the next screen rather than storing it anywhere. */
      nav('/phrase', { replace: true, state: { phrase: data.phrase } });
    } catch (err) {
      setError(err.message || t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth" style={{ paddingInline: 0 }}>
      <TopBar
        title={t('create.title')}
        onBack={() => nav('/')}
        right={<LanguagePicker />}
      />

      <div style={{ padding: '0 22px' }}>
        <div className="form-head">
          <span className="badge"><Icon name="wallet" size={26} /></span>
          <h2>{t('create.heading')}</h2>
          <p>{t('create.sub')}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div>
            <label className="label" htmlFor="name">{t('create.name')}</label>
            <div className="field">
              <span className="adorn"><Icon name="user" size={18} /></span>
              <input
                id="name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={t('create.namePh')} autoComplete="name" required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cemail">{t('create.email')}</label>
            <div className="field">
              <span className="adorn"><Icon name="mail" size={18} /></span>
              <input
                id="cemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t('create.emailPh')} autoComplete="email" required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cpw">{t('create.password')}</label>
            <PasswordField
              id="cpw" value={password} onChange={setPassword}
              placeholder={t('create.passwordPh')} autoComplete="new-password"
            />
            {password.length > 0 && password.length < 8 && (
              <p className="hint" style={{ marginTop: 8 }}>{t('create.weak')}</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="cpw2">{t('create.confirm')}</label>
            <PasswordField
              id="cpw2" value={confirm} onChange={setConfirm}
              placeholder={t('create.confirmPh')} autoComplete="new-password"
            />
            {mismatch && <p className="error-text" style={{ marginTop: 8 }}>{t('create.mismatch')}</p>}
          </div>

          {error && <p className="error-text" role="alert">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            {busy ? <Spinner /> : t('create.cta')}
          </button>
        </form>
      </div>
    </div>
  );
}

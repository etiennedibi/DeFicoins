import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import { Banner, LanguagePicker, Spinner, TopBar } from '../components/ui.jsx';

export default function Recover() {
  const t = useT();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/forgot', { email: email.trim() });
    } catch {
      // The endpoint answers the same way regardless, so a failure here is
      // a transport problem, not a hint about whether the account exists.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <div className="auth" style={{ paddingInline: 0 }}>
      <TopBar title={t('recover.title')} onBack={() => nav('/')} right={<LanguagePicker />} />

      <div style={{ padding: '0 22px' }}>
        <div className="form-head">
          <span className="badge"><Icon name="key" size={25} /></span>
          <h2>{t('recover.title')}</h2>
          <p>{t('recover.sub')}</p>
        </div>

        {sent ? (
          <Banner tone="info" icon="check">{t('recover.sent')}</Banner>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <div>
              <label className="label" htmlFor="remail">{t('create.email')}</label>
              <div className="field">
                <span className="adorn"><Icon name="mail" size={18} /></span>
                <input
                  id="remail" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('create.emailPh')} autoComplete="email" required
                />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={!email || busy}>
              {busy ? <Spinner /> : t('recover.cta')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

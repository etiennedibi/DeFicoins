import { useNavigate, useLocation, Navigate } from 'react-router-dom';

import { useT } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import { Banner, CopyButton } from '../components/ui.jsx';

export default function Phrase() {
  const t = useT();
  const nav = useNavigate();
  const { state } = useLocation();
  const words = state?.phrase;

  /* Reached directly (a refresh, a bookmark) there is no phrase to show —
     it is handed over once, in memory, from the create screen. */
  if (!Array.isArray(words) || words.length === 0) {
    return <Navigate to="/wallet" replace />;
  }

  async function done() {
    try { await api.post('/auth/ack-phrase'); } catch {}
    nav('/wallet', { replace: true });
  }

  return (
    <div className="auth phrase-screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
      <div className="form-head">
        <span className="badge"><Icon name="shield" size={26} /></span>
        <h2>{t('phrase.title')}</h2>
        <p style={{ maxWidth: '34ch' }}>{t('phrase.sub')}</p>
      </div>

      <ol className="phrase-grid">
        {words.map((w, i) => (
          <li className="phrase-word" key={w + i}>
            <i>{i + 1}</i>
            <b>{w}</b>
          </li>
        ))}
      </ol>

      <div style={{ display: 'grid', gap: 16 }}>
        <CopyButton
          text={words.join(' ')}
          label={t('phrase.copy')}
          copiedLabel={t('common.copied')}
        />

        <Banner tone="warn" icon="warn">{t('phrase.warn')}</Banner>

        <button className="btn btn-primary" onClick={done}>
          {t('phrase.saved')}
          <Icon name="arrowUp" size={18} style={{ transform: 'rotate(90deg)' }} />
        </button>

        <button className="btn btn-quiet" onClick={done}>
          {t('phrase.skip')}
        </button>
      </div>
    </div>
  );
}

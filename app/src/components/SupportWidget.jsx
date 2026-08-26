import { useCallback, useEffect, useRef, useState } from 'react';

import { useT } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { useWallet } from '../store/wallet.jsx';
import Icon from './Icon.jsx';
import { Empty, Sheet, Spinner } from './ui.jsx';

const SUPPORT_EMAIL = 'support@deficoins.app';

/* The floating support bubble present on every screen of the reference app.
   Other screens open it by dispatching `deficoins:support`. */

export default function SupportWidget() {
  const t = useT();
  const { user } = useWallet();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const logRef = useRef(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('deficoins:support', onOpen);
    return () => window.removeEventListener('deficoins:support', onOpen);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await api.get('/messages');
      setMessages(d.messages || []);
      setUnread(0);
    } catch {
      setMessages((m) => m ?? []);
    }
  }, [user]);

  useEffect(() => { if (open) load(); }, [open, load]);

  /* Poll for replies while the thread is open. */
  useEffect(() => {
    if (!open || !user) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15_000);
    return () => clearInterval(id);
  }, [open, user, load]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  async function send(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);

    /* Show the message straight away; reconcile when the reload lands. */
    const optimistic = {
      id: 'local-' + Date.now(),
      body,
      from_admin: 0,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...(m || []), optimistic]);
    setDraft('');

    try {
      await api.post('/messages', { body });
      await load();
    } catch {
      setMessages((m) => (m || []).filter((x) => x.id !== optimistic.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <button className="support-fab" onClick={() => setOpen(true)} aria-label={t('chat.title')}>
        <Icon name="headset" size={24} />
        {unread > 0 && <span className="dot" />}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="chat">
          <div className="chat-head">
            <span className="avatar" style={{ background: 'var(--surface-3)', color: 'var(--brand-hi)' }}>
              <Icon name="headset" size={20} />
            </span>
            <div className="who">
              <b>{t('chat.title')}</b>
              <span>{t('chat.status')}</span>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('common.close')}>
              <Icon name="chevronDown" size={22} />
            </button>
          </div>

          <a className="chat-mail" href={`mailto:${SUPPORT_EMAIL}`}>
            <Icon name="mail" size={17} />
            <b>{t('chat.emailUs')}</b>
            <span style={{ marginLeft: 'auto' }}>{SUPPORT_EMAIL}</span>
          </a>

          <div className="chat-log" ref={logRef}>
            {messages === null ? (
              <div style={{ margin: 'auto' }}><Spinner /></div>
            ) : messages.length === 0 ? (
              <Empty>{t('chat.empty')}</Empty>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={'bubble ' + (m.from_admin ? 'theirs' : 'mine')}>
                  {m.body}
                  <time>{formatTime(m.created_at)}</time>
                </div>
              ))
            )}
          </div>

          <form className="chat-compose" onSubmit={send}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('chat.placeholder')}
              aria-label={t('chat.placeholder')}
              maxLength={4000}
            />
            <button type="submit" disabled={!draft.trim() || sending} aria-label={t('chat.send')}>
              <Icon name="send" size={19} />
            </button>
          </form>
        </div>
      </Sheet>
    </>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

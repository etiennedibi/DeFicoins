import { useCallback, useEffect, useState } from 'react';

import { api, getAdminToken, setAdminToken } from '../../lib/api.js';
import { setFormatOverride } from '../../lib/locale.js';
import Icon, { Logo } from '../../components/Icon.jsx';
import { PasswordField, Spinner } from '../../components/ui.jsx';
import Users from './Users.jsx';
import Queue from './Queue.jsx';
import Coins from './Coins.jsx';
import './admin.css';

const TABS = [
  { key: 'users',  label: 'Users',        icon: 'users' },
  { key: 'queue',  label: 'Queue',        icon: 'clock' },
  { key: 'coins',  label: 'Market',       icon: 'chart' },
];

export default function Admin() {
  const [authed, setAuthed] = useState(() => !!getAdminToken());
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(() => {
    if (!getAdminToken()) return;
    api.get('/admin/overview', { admin: true })
      .then(setStats)
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => { if (authed) loadStats(); }, [authed, loadStats]);

  // English copy, English numbers and dates — released on the way out.
  useEffect(() => {
    setFormatOverride('en');
    return () => setFormatOverride(null);
  }, []);

  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} />;

  return (
    <div className="admin">
      <header className="admin-top">
        <Logo size={34} />
        <div>
          <b>DeFicoins</b>
          <span>Admin console</span>
        </div>
        <button
          className="admin-signout"
          onClick={() => { setAdminToken(null); setAuthed(false); }}
        >
          <Icon name="logout" size={17} /> Sign out
        </button>
      </header>

      {stats && (
        <div className="admin-stats">
          <Stat label="Users" value={stats.users} />
          <Stat label="Pending transfers" value={stats.pendingTx} tone={stats.pendingTx ? 'warn' : null} />
          <Stat label="Buy orders" value={stats.pendingBuys} tone={stats.pendingBuys ? 'warn' : null} />
          <Stat label="Password resets" value={stats.pendingResets} tone={stats.pendingResets ? 'warn' : null} />
          <Stat label="Unread messages" value={stats.unread} tone={stats.unread ? 'info' : null} />
        </div>
      )}

      <nav className="admin-tabs">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            className={'admin-tab' + (tab === tb.key ? ' is-active' : '')}
            onClick={() => setTab(tb.key)}
          >
            <Icon name={tb.icon} size={17} /> {tb.label}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {tab === 'users' && <Users onChanged={loadStats} />}
        {tab === 'queue' && <Queue onChanged={loadStats} />}
        {tab === 'coins' && <Coins />}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={'admin-stat' + (tone ? ' tone-' + tone : '')}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function AdminLogin({ onDone }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api.post('/auth/admin-login', { username, password });
      setAdminToken(d.token);
      onDone();
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <form onSubmit={submit}>
        <Logo size={56} />
        <h1>Admin console</h1>
        <div>
          <label className="label" htmlFor="au">Username</label>
          <div className="field">
            <span className="adorn"><Icon name="user" size={18} /></span>
            <input id="au" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ap">Password</label>
          <PasswordField id="ap" value={password} onChange={setPassword} placeholder="Enter your password" />
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy || !password}>
          {busy ? <Spinner /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

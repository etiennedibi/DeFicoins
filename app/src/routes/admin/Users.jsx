import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api.js';
import { coinAmount, money, txDate } from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import CoinIcon from '../../components/CoinIcon.jsx';
import { Spinner } from '../../components/ui.jsx';

export default function Users({ onChanged }) {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/users', { admin: true })
      .then((d) => setRows(d.users))
      .catch(() => setRows([]));
  }, []);

  useEffect(load, [load]);

  if (rows === null) return <div className="admin-loading"><Spinner size={24} /></div>;

  const q = query.trim().toLowerCase();
  const list = rows.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <>
      <div className="field admin-search">
        <span className="adorn"><Icon name="search" size={18} /></span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email…" />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Status</th>
              <th className="num">Portfolio</th><th className="num">Unread</th><th>Joined</th><th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td className="dim">{u.email}</td>
                <td><span className={'pill pill-' + u.status}>{u.status}</span></td>
                <td className="num">{money(u.totalUsd)}</td>
                <td className="num">{u.unread > 0 ? <span className="pill pill-alert">{u.unread}</span> : '—'}</td>
                <td className="dim">{txDate(u.created_at)}</td>
                <td><button className="link-btn" onClick={() => setOpenId(u.id)}>Manage</button></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="dim center">No users match that search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <UserDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => { load(); onChanged?.(); }}
        />
      )}
    </>
  );
}

function UserDrawer({ id, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('balances');

  const load = useCallback(() => {
    api.get('/admin/users/' + id, { admin: true }).then(setData).catch(() => setData(null));
  }, [id]);

  useEffect(load, [load]);

  function afterChange() {
    load();
    onChanged?.();
  }

  return (
    <div className="drawer-scrim" onClick={onClose} role="presentation">
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="drawer-head">
          <div>
            <b>{data?.user?.name || 'Loading…'}</b>
            <span>{data?.user?.email}</span>
          </div>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </header>

        {!data ? (
          <div className="admin-loading"><Spinner size={24} /></div>
        ) : (
          <>
            <nav className="drawer-tabs">
              {['balances', 'activity', 'chat', 'account'].map((k) => (
                <button key={k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </nav>

            <div className="drawer-body">
              {tab === 'balances' && <Balances data={data} onChanged={afterChange} />}
              {tab === 'activity' && <Activity data={data} onChanged={afterChange} />}
              {tab === 'chat' && <Chat data={data} onChanged={afterChange} />}
              {tab === 'account' && <Account data={data} onChanged={afterChange} />}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ---------------- balances ---------------- */

function Balances({ data, onChanged }) {
  const [symbol, setSymbol] = useState('BTC');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function adjust(sign) {
    const n = Number(delta) * sign;
    if (!Number.isFinite(n) || n === 0) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/users/${data.user.id}/adjust`, { coin: symbol, delta: n, note }, { admin: true });
      setDelta('');
      setNote('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const held = data.assets.filter((a) => a.balance > 0);

  return (
    <>
      <section className="panel">
        <h4>Adjust balance</h4>
        <div className="adjust-grid">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} aria-label="Coin">
            {data.assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
          </select>
          <input
            inputMode="decimal" value={delta} placeholder="0.00"
            onChange={(e) => setDelta(e.target.value.replace(/[^\d.]/g, ''))}
            aria-label="Amount"
          />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        </div>
        <div className="btn-row">
          <button className="btn-sm btn-credit" onClick={() => adjust(1)} disabled={busy || !delta}>
            <Icon name="plus" size={15} /> Credit
          </button>
          <button className="btn-sm btn-debit" onClick={() => adjust(-1)} disabled={busy || !delta}>
            <Icon name="arrowDown" size={15} /> Debit
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <h4>Holdings — {money(data.total)}</h4>
        {held.length === 0 ? (
          <p className="dim">This wallet is empty.</p>
        ) : (
          <ul className="mini-list">
            {held.map((a) => (
              <li key={a.symbol}>
                <CoinIcon symbol={a.symbol} color={a.color} size={28} />
                <span className="mini-name">{a.symbol}</span>
                <span className="mini-amount">{coinAmount(a.balance, a.decimals)}</span>
                <span className="mini-usd">{money(a.usdValue)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h4>Deposit addresses</h4>
        <ul className="addr-list">
          {data.assets.map((a) => (
            <AddressRow key={a.symbol} userId={data.user.id} asset={a} onChanged={onChanged} />
          ))}
        </ul>
      </section>
    </>
  );
}

function AddressRow({ userId, asset, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(asset.address || '');
  const [error, setError] = useState('');

  async function save() {
    setError('');
    try {
      await api.post(`/admin/users/${userId}/address`, { coin: asset.symbol, address: value }, { admin: true });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <li>
      <span className="addr-sym">{asset.symbol}</span>
      {editing ? (
        <>
          <input className="addr-input" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
          <button className="link-btn" onClick={save}>Save</button>
          <button className="link-btn dim" onClick={() => { setEditing(false); setValue(asset.address || ''); }}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <code className="addr-val">{asset.address || '— not set —'}</code>
          <button className="link-btn" onClick={() => setEditing(true)}>Edit</button>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
    </li>
  );
}

/* ---------------- activity ---------------- */

function Activity({ data, onChanged }) {
  async function settle(txId, decision) {
    await api.post(`/admin/transactions/${txId}/settle`, { decision }, { admin: true });
    onChanged();
  }

  return (
    <>
      <section className="panel">
        <h4>Transactions</h4>
        {data.transactions.length === 0 ? <p className="dim">Nothing yet.</p> : (
          <ul className="mini-list">
            {data.transactions.map((tx) => (
              <li key={tx.id}>
                <span className="mini-name">
                  {tx.type} {tx.coin}
                  {tx.type === 'swap' && ` → ${tx.related_coin}`}
                </span>
                <span className="mini-amount">{coinAmount(tx.amount, 8)}</span>
                <span className={'pill pill-' + tx.status}>{tx.status}</span>
                {tx.status === 'pending' && (
                  <span className="row-actions">
                    <button className="link-btn" onClick={() => settle(tx.id, 'approve')}>Approve</button>
                    <button className="link-btn danger" onClick={() => settle(tx.id, 'reject')}>Reject</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h4>Buy orders</h4>
        {data.buys.length === 0 ? <p className="dim">Nothing yet.</p> : (
          <ul className="mini-list">
            {data.buys.map((b) => (
              <li key={b.id}>
                <span className="mini-name">{b.coin}</span>
                <span className="mini-amount">{money(b.usd_amount)}</span>
                <span className={'pill pill-' + b.status}>{b.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* ---------------- chat ---------------- */

function Chat({ data, onChanged }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api.post('/admin/messages', { userId: data.user.id, body }, { admin: true });
      setDraft('');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h4>Support thread</h4>
      <div className="admin-chat-log">
        {data.messages.length === 0 ? <p className="dim">No messages.</p> : data.messages.map((m) => (
          <div key={m.id} className={'bubble ' + (m.from_admin ? 'mine' : 'theirs')}>
            {m.body}
            <time>{txDate(m.created_at)}</time>
          </div>
        ))}
      </div>
      <form className="chat-compose" onSubmit={send}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply to this user…" />
        <button type="submit" disabled={!draft.trim() || busy} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
    </section>
  );
}

/* ---------------- account ---------------- */

function Account({ data, onChanged }) {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const suspended = data.user.status === 'suspended';

  async function toggleStatus() {
    await api.post(`/admin/users/${data.user.id}/status`,
      { status: suspended ? 'active' : 'suspended' }, { admin: true });
    onChanged();
  }

  async function reset(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post(`/admin/users/${data.user.id}/password`, { password }, { admin: true });
      setPassword('');
      setMsg('Password updated.');
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <>
      <section className="panel">
        <h4>Access</h4>
        <p className="dim">
          Status: <span className={'pill pill-' + data.user.status}>{data.user.status}</span>
        </p>
        <div className="btn-row">
          <button className={'btn-sm ' + (suspended ? 'btn-credit' : 'btn-debit')} onClick={toggleStatus}>
            {suspended ? 'Reactivate account' : 'Suspend account'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h4>Reset password</h4>
        <form className="adjust-grid" onSubmit={reset} style={{ gridTemplateColumns: '1fr auto' }}>
          <input
            type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
          />
          <button className="btn-sm btn-credit" type="submit" disabled={password.length < 8}>Set</button>
        </form>
        {msg && <p className="dim">{msg}</p>}
      </section>
    </>
  );
}

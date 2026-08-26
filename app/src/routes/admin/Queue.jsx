import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api.js';
import { coinAmount, money, shortAddress, txDate } from '../../lib/format.js';
import { Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

/* Everything waiting on a human: outbound transfers and buy orders. */

export default function Queue({ onChanged }) {
  const [txs, setTxs] = useState(null);
  const [buys, setBuys] = useState(null);
  const [resets, setResets] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/transactions?status=pending', { admin: true })
      .then((d) => setTxs(d.transactions)).catch(() => setTxs([]));
    api.get('/admin/buys?status=pending', { admin: true })
      .then((d) => setBuys(d.buys)).catch(() => setBuys([]));
    api.get('/admin/password-resets?status=pending', { admin: true })
      .then((d) => setResets(d.resets)).catch(() => setResets([]));
  }, []);

  useEffect(load, [load]);

  async function settle(id, decision) {
    setBusyId(id);
    try {
      await api.post(`/admin/transactions/${id}/settle`, { decision }, { admin: true });
      load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  async function closeBuy(id, status) {
    setBusyId(id);
    try {
      await api.post(`/admin/buys/${id}/close`, { status }, { admin: true });
      load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  async function cancelReset(id) {
    setBusyId(id);
    try {
      await api.post(`/admin/password-resets/${id}/cancel`, {}, { admin: true });
      load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  if (txs === null || buys === null || resets === null) {
    return <div className="admin-loading"><Spinner size={24} /></div>;
  }

  return (
    <>
      <h3 className="admin-h3">Password reset requests ({resets.length})</h3>
      {resets.length === 0 ? (
        <p className="dim admin-empty">No one is waiting on a password reset.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>User</th><th>Status</th><th>Requested</th><th>New password</th></tr>
            </thead>
            <tbody>
              {resets.map((r) => (
                <ResetRow
                  key={r.id}
                  reset={r}
                  busy={busyId === r.id}
                  onCancel={() => cancelReset(r.id)}
                  onDone={() => { load(); onChanged?.(); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="admin-h3">Pending transfers ({txs.length})</h3>
      {txs.length === 0 ? (
        <p className="dim admin-empty">Nothing waiting for approval.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th><th>Coin</th><th className="num">Amount</th><th className="num">USD</th>
                <th>Destination</th><th>Requested</th><th />
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.user_name}</b><br /><span className="dim">{t.user_email}</span></td>
                  <td>{t.coin}</td>
                  <td className="num">{coinAmount(t.amount, 8)}</td>
                  <td className="num">{money(t.usd_value)}</td>
                  <td><code className="addr-val">{shortAddress(t.counterparty, 10, 8)}</code></td>
                  <td className="dim">{txDate(t.created_at)}</td>
                  <td className="row-actions">
                    <button className="link-btn" disabled={busyId === t.id} onClick={() => settle(t.id, 'approve')}>
                      Approve
                    </button>
                    <button className="link-btn danger" disabled={busyId === t.id} onClick={() => settle(t.id, 'reject')}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="admin-h3">Buy orders ({buys.length})</h3>
      {buys.length === 0 ? (
        <p className="dim admin-empty">No open buy orders.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>User</th><th>Coin</th><th className="num">Amount</th><th>Requested</th><th /></tr>
            </thead>
            <tbody>
              {buys.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.user_name}</b><br /><span className="dim">{b.user_email}</span></td>
                  <td>{b.coin}</td>
                  <td className="num">{money(b.usd_amount)}</td>
                  <td className="dim">{txDate(b.created_at)}</td>
                  <td className="row-actions">
                    <button className="link-btn" disabled={busyId === b.id} onClick={() => closeBuy(b.id, 'fulfilled')}>
                      Mark fulfilled
                    </button>
                    <button className="link-btn danger" disabled={busyId === b.id} onClick={() => closeBuy(b.id, 'cancelled')}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* Setting the password and closing the request is one action: the server
   writes both, then tells the user in their support thread. */
function ResetRow({ reset, busy, onCancel, onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post(`/admin/password-resets/${reset.id}/resolve`, { password }, { admin: true });
      setPassword('');
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td><b>{reset.user_name}</b><br /><span className="dim">{reset.email}</span></td>
      <td><span className={'pill pill-' + reset.user_status}>{reset.user_status}</span></td>
      <td className="dim">{txDate(reset.created_at)}</td>
      <td>
        <form className="reset-cell" onSubmit={submit}>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8)"
            aria-label={`New password for ${reset.email}`}
            autoComplete="off"
          />
          <button className="link-btn" type="submit" disabled={password.length < 8 || saving || busy}>
            <Icon name="check" size={14} /> Set and notify
          </button>
          <button className="link-btn danger" type="button" onClick={onCancel} disabled={busy || saving}>
            Dismiss
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </td>
    </tr>
  );
}

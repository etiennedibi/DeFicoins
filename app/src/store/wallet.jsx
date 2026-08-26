import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken, ApiError } from '../lib/api.js';

/* Single source of truth for the signed-in user and their portfolio.
   Screens read from here rather than each fetching /api/me. */

const Ctx = createContext(null);

export function WalletProvider({ children }) {
  const [user, setUser] = useState(null);
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('deficoins.hideBalance') === '1'; } catch { return false; }
  });

  const inflight = useRef(null);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setAssets([]); setTotal(0); setReady(true); return; }
    if (inflight.current) return inflight.current;

    setRefreshing(true);
    inflight.current = api.get('/me')
      .then((data) => {
        setUser(data.user);
        setAssets(data.assets || []);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        // A 401 means the token died; anything else leaves the last good data up.
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          setUser(null);
          setAssets([]);
          setTotal(0);
        }
      })
      .finally(() => {
        setReady(true);
        setRefreshing(false);
        inflight.current = null;
      });

    return inflight.current;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* Prices move; re-pull while the tab is visible so the header total and the
     market list do not go stale behind the user's back. */
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60_000);
    const onShow = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, [user, refresh]);

  const signIn = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    await refresh();
    return data.user;
  }, [refresh]);

  const register = useCallback(async (name, email, password) => {
    const data = await api.post('/auth/register', { name, email, password });
    setToken(data.token);
    setUser(data.user);
    await refresh();
    return data;
  }, [refresh]);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setAssets([]);
    setTotal(0);
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      const next = !h;
      try { localStorage.setItem('deficoins.hideBalance', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const asset = useCallback((symbol) => assets.find((a) => a.symbol === symbol) || null, [assets]);

  const value = useMemo(() => ({
    user, assets, total, ready, refreshing, hidden,
    refresh, signIn, register, signOut, toggleHidden, asset,
  }), [user, assets, total, ready, refreshing, hidden, refresh, signIn, register, signOut, toggleHidden, asset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}

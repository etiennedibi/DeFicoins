import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { I18nProvider } from './i18n/index.jsx';
import { WalletProvider, useWallet } from './store/wallet.jsx';
import { Spinner } from './components/ui.jsx';
import SupportWidget from './components/SupportWidget.jsx';

import Unlock from './routes/Unlock.jsx';
import CreateWallet from './routes/CreateWallet.jsx';
import Phrase from './routes/Phrase.jsx';
import Recover from './routes/Recover.jsx';
import Home from './routes/Home.jsx';

const Send = lazy(() => import('./routes/Send.jsx'));
const Receive = lazy(() => import('./routes/Receive.jsx'));
const Swap = lazy(() => import('./routes/Swap.jsx'));
const History = lazy(() => import('./routes/History.jsx'));
const Settings = lazy(() => import('./routes/Settings.jsx'));
const Admin = lazy(() => import('./routes/admin/Admin.jsx'));

function Loading() {
  return <div className="route-loading"><Spinner size={26} /></div>;
}

/* Gate for wallet screens. While the session is still being restored we show
   the spinner rather than bouncing the user to the unlock screen and back. */
function Private({ children }) {
  const { user, ready } = useWallet();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  return children;
}

/* The unlock and create screens should not be reachable once signed in. */
function Public({ children }) {
  const { user, ready } = useWallet();
  if (!ready) return <Loading />;
  if (user) return <Navigate to="/wallet" replace />;
  return children;
}

function Shell() {
  const { user } = useWallet();
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Public><Unlock /></Public>} />
          <Route path="/create" element={<Public><CreateWallet /></Public>} />
          <Route path="/recover" element={<Public><Recover /></Public>} />

          <Route path="/phrase" element={<Private><Phrase /></Private>} />
          <Route path="/wallet" element={<Private><Home /></Private>} />
          <Route path="/send" element={<Private><Send /></Private>} />
          <Route path="/receive" element={<Private><Receive /></Private>} />
          <Route path="/swap" element={<Private><Swap /></Private>} />
          <Route path="/history" element={<Private><History /></Private>} />
          <Route path="/settings" element={<Private><Settings /></Private>} />

          <Route path="/admin/*" element={<Admin />} />

          <Route path="*" element={<Navigate to={user ? '/wallet' : '/'} replace />} />
        </Routes>
      </Suspense>
      {!isAdmin && <SupportWidget />}
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <WalletProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </WalletProvider>
    </I18nProvider>
  );
}

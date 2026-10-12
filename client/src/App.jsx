import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './lib/cart.jsx';
import { Toaster, Loading } from './components/ui.jsx';

import CustomerLayout from './pages/customer/CustomerLayout.jsx';
import Home from './pages/customer/Home.jsx';
import Store from './pages/customer/Store.jsx';
import Checkout from './pages/customer/Checkout.jsx';
import Track from './pages/customer/Track.jsx';
import Account from './pages/customer/Account.jsx';
import CustomerLogin from './pages/customer/CustomerLogin.jsx';
import Demo from './pages/Demo.jsx';

const DriverApp = lazy(() => import('./pages/driver/DriverApp.jsx'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'));

export default function App() {
  return (
    <CartProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/demo" element={<Demo />} />
          <Route path="/driver/*" element={<DriverApp />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/negozio/:id" element={<Store />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/ordine/:id" element={<Track />} />
            <Route path="/account" element={<Account />} />
            <Route path="/accedi" element={<CustomerLogin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </CartProvider>
  );
}

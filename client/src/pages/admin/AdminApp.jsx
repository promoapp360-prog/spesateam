import { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBasket, Map as MapIcon, Package, Tags, Store, Bike, Users, Percent, Ticket, Gift, Settings as SettingsIcon,
  ChartColumn, LogOut, Menu, ExternalLink,
} from 'lucide-react';
import { login, setSession } from '../../lib/api.js';
import { useSession } from '../../lib/hooks.js';
import { Button, Field, Input, ErrorBox, Logo, cx } from '../../components/ui.jsx';
import Dashboard from './Dashboard.jsx';
import Orders from './Orders.jsx';
import LiveMap from './LiveMap.jsx';
import Products from './Products.jsx';
import { Categories, Stores } from './Catalog.jsx';
import Drivers from './Drivers.jsx';
import Customers from './Customers.jsx';
import { Promotions, Coupons } from './Marketing.jsx';
import Loyalty from './Loyalty.jsx';
import Settings from './Settings.jsx';
import Stats from './Stats.jsx';

const NAV = [
  { group: 'Operatività' },
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/ordini', label: 'Ordini', icon: ShoppingBasket },
  { to: '/admin/mappa', label: 'Mappa live', icon: MapIcon },
  { group: 'Catalogo' },
  { to: '/admin/prodotti', label: 'Prodotti e prezzi', icon: Package },
  { to: '/admin/reparti', label: 'Reparti', icon: Tags },
  { to: '/admin/supermercati', label: 'Supermercati', icon: Store },
  { group: 'Persone' },
  { to: '/admin/driver', label: 'Driver', icon: Bike },
  { to: '/admin/clienti', label: 'Clienti', icon: Users },
  { group: 'Marketing' },
  { to: '/admin/promozioni', label: 'Promozioni', icon: Percent },
  { to: '/admin/coupon', label: 'Sconti e coupon', icon: Ticket },
  { to: '/admin/fedelta', label: 'Tessere fedeltà', icon: Gift },
  { group: 'Amministrazione', adminOnly: true },
  { to: '/admin/statistiche', label: 'Statistiche', icon: ChartColumn, adminOnly: true },
  { to: '/admin/impostazioni', label: 'Impostazioni', icon: SettingsIcon, adminOnly: true },
];

export default function AdminApp() {
  const session = useSession('admin');
  if (!session) return <AdminLogin />;
  return <AdminLayout session={session} />;
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try { await login('admin', email, password); } catch (err) { setError(err); } finally { setLoading(false); }
  }
  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-linear-to-br from-brand-800 to-brand-900 text-white p-12">
        <Logo light />
        <div>
          <div className="text-4xl font-bold font-display leading-tight">Backoffice</div>
          <p className="text-brand-100 mt-3 max-w-md">Ordini in tempo reale, catalogo e prezzi, driver, clienti, promozioni, fedeltà e statistiche: tutto il servizio in un unico pannello.</p>
        </div>
        <div className="text-xs text-brand-200">Realizzato da PromoApp</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden mb-6"><Logo /></div>
          <h1 className="text-2xl font-bold">Accedi al backoffice</h1>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <ErrorBox error={error} />
          <Button type="submit" size="lg" className="w-full" loading={loading}>Accedi</Button>
          <div className="flex gap-3 justify-center text-xs text-stone-500">
            <button type="button" onClick={() => { setEmail('admin@spesateam.it'); setPassword('demo1234'); }}>Demo amministratore</button>
            <span>·</span>
            <button type="button" onClick={() => { setEmail('operatore@spesateam.it'); setPassword('demo1234'); }}>Demo operatore</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminLayout({ session }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const isAdmin = session.user.role === 'admin';
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center border-b border-stone-200"><Logo /></div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((n, i) => n.group ? (
          <div key={i} className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{n.group}</div>
        ) : (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
            className={({ isActive }) => cx('flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition',
              isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100')}>
            <n.icon className="size-4" /> {n.label}
          </NavLink>
        ))}
      </div>
      <div className="p-3 border-t border-stone-200">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 h-9 text-xs text-stone-500 hover:text-ink"><ExternalLink className="size-3.5" /> Apri l'app cliente</a>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-sm">
            <div className="font-semibold">{session.user.name}</div>
            <div className="text-xs text-stone-500">{isAdmin ? 'Amministratore' : 'Operatore'}</div>
          </div>
          <button onClick={() => { setSession('admin', null); nav('/admin'); }} className="p-2 rounded-lg hover:bg-stone-100" aria-label="Esci"><LogOut className="size-4" /></button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-full flex">
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-stone-200 h-screen sticky top-0">{sidebar}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-[950] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-white h-full animate-fade-in">{sidebar}</aside>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-40 h-14 bg-white border-b border-stone-200 flex items-center justify-between px-4">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2"><Menu className="size-5" /></button>
          <Logo className="text-lg" />
          <span className="w-8" />
        </div>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="ordini" element={<Orders />} />
            <Route path="mappa" element={<LiveMap />} />
            <Route path="prodotti" element={<Products />} />
            <Route path="reparti" element={<Categories />} />
            <Route path="supermercati" element={<Stores />} />
            <Route path="driver" element={<Drivers />} />
            <Route path="clienti" element={<Customers />} />
            <Route path="promozioni" element={<Promotions />} />
            <Route path="coupon" element={<Coupons />} />
            <Route path="fedelta" element={<Loyalty />} />
            {isAdmin && <Route path="statistiche" element={<Stats />} />}
            {isAdmin && <Route path="impostazioni" element={<Settings />} />}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

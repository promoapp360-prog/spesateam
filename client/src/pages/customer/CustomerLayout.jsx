import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShoppingBag, User } from 'lucide-react';
import { Logo, cx } from '../../components/ui.jsx';
import { useCart } from '../../lib/cart.jsx';
import { eur } from '../../lib/format.js';
import { useSession } from '../../lib/hooks.js';
import CartDrawer from './CartDrawer.jsx';

export default function CustomerLayout() {
  const { count, estimate, setOpen, bump, cart } = useCart();
  const session = useSession('customer');
  const loc = useLocation();
  const hideCart = loc.pathname === '/checkout';

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="shrink-0"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link to={session ? '/account' : '/accedi'}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl hover:bg-stone-100 text-sm font-medium">
              <User className="size-5" />
              <span className="hidden sm:inline">{session ? session.user.name.split(' ')[0] : 'Accedi'}</span>
            </Link>
            {!hideCart && (
              <button onClick={() => setOpen(true)}
                className="relative inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700">
                <ShoppingBag className="size-5" />
                <span key={bump} className={cx(count > 0 && 'animate-pop')}>{count > 0 ? eur(estimate) : 'Carrello'}</span>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-accent-500 text-[11px] flex items-center justify-center">
                    {Math.round(count)}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-stone-200 bg-white mt-10">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-stone-500 flex flex-col sm:flex-row gap-3 justify-between">
          <div>
            <Logo className="text-base" />
            <div className="mt-2">La spesa dei supermercati del quartiere, a casa tua. Casavatore (NA).</div>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <Link to="/demo" className="hover:text-brand-700">Accessi demo</Link>
            <span>Privacy · Termini di servizio</span>
            <span className="text-xs text-stone-400">Realizzato da PromoApp</span>
          </div>
        </div>
      </footer>
      {count > 0 && !hideCart && cart.storeId && (
        <div className="sm:hidden h-20" />
      )}
      {count > 0 && !hideCart && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-linear-to-t from-white via-white/95 to-white/0">
          <button onClick={() => setOpen(true)} className="w-full h-14 rounded-2xl bg-brand-600 text-white font-semibold flex items-center justify-between px-5 shadow-lg">
            <span className="flex items-center gap-2"><ShoppingBag className="size-5" /> Vedi carrello</span>
            <span>{eur(estimate)}</span>
          </button>
        </div>
      )}
      <CartDrawer />
    </div>
  );
}

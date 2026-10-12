import { useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, ArrowLeft, Clock, Plus } from 'lucide-react';
import { useFetch } from '../../lib/hooks.js';
import { useCart } from '../../lib/cart.jsx';
import { eur } from '../../lib/format.js';
import { Loading, ErrorBox, ProductThumb, Badge, Empty, Modal, Button, cx } from '../../components/ui.jsx';
import QtyStepper from '../../components/QtyStepper.jsx';

function ProductCard({ p, store, onNeedSwitch }) {
  const { cart, setQty } = useCart();
  const inCart = cart.items[p.id];
  const qty = inCart?.qty || 0;
  const add = () => {
    if (cart.storeId && cart.storeId !== store.id && Object.keys(cart.items).length) return onNeedSwitch(() => setQty(p, Number(p.step || 1), store));
    setQty(p, p.unit === 'kg' ? Number(p.step || 0.5) : 1, store);
  };
  const price = p.promo?.unit_price ?? p.price;
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-3 flex flex-col hover:shadow-md transition">
      <div className="relative">
        <ProductThumb product={p} size="lg" />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {p.promo && <Badge className="bg-accent-500 text-white shadow">{p.promo.label}</Badge>}
          {p.is_bio && <Badge className="bg-white/90 text-brand-700">BIO</Badge>}
        </div>
        {p.gluten_free && <span className="absolute bottom-2 right-2 text-[10px] font-semibold bg-white/90 rounded-full px-2 py-0.5 text-amber-700">senza glutine</span>}
      </div>
      <div className="mt-3 flex-1">
        <div className="text-sm font-medium leading-snug line-clamp-2">{p.name}</div>
        <div className="text-xs text-stone-500 mt-0.5">{p.brand} · {p.size}</div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          {p.promo && p.promo.type !== 'x_for_y' && <div className="text-xs text-stone-400 line-through">{eur(p.price)}{p.unit === 'kg' && '/kg'}</div>}
          <div className={cx('font-bold', p.promo && p.promo.type !== 'x_for_y' && 'text-accent-600')}>
            {eur(price)}{p.unit === 'kg' && <span className="text-xs font-medium">/kg</span>}
          </div>
          {p.promo?.type === 'x_for_y' && <div className="text-[11px] text-accent-600 font-semibold">Prendi {p.promo.buy_qty}, paghi {p.promo.pay_qty}</div>}
        </div>
      </div>
      <div className="mt-3">
        {qty > 0 ? (
          <QtyStepper product={p} qty={qty} onChange={(q) => setQty(p, q, store)} size="sm" />
        ) : (
          <button onClick={add} className="w-full h-9 rounded-xl bg-brand-50 text-brand-800 font-semibold text-sm hover:bg-brand-100 inline-flex items-center justify-center gap-1">
            <Plus className="size-4" /> Aggiungi
          </button>
        )}
      </div>
    </div>
  );
}

export default function Store() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(`/public/stores/${id}/catalog`);
  const { clear } = useCart();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [switchFn, setSwitchFn] = useState(null);
  const refs = useRef({});

  const products = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    return data.products.filter((p) => {
      if (s && !`${p.name} ${p.brand || ''}`.toLowerCase().includes(s)) return false;
      if (filter === 'promo' && !p.promo) return false;
      if (filter === 'bio' && !p.is_bio) return false;
      if (filter === 'gf' && !p.gluten_free) return false;
      return true;
    });
  }, [data, search, filter]);

  if (loading) return <Loading label="Carico il catalogo…" />;
  if (error) return <div className="max-w-6xl mx-auto p-4"><ErrorBox error={error} /></div>;
  const { store, categories } = data;
  const promos = data.products.filter((p) => p.promo).slice(0, 12);
  const grouped = categories.map((c) => ({ ...c, items: products.filter((p) => p.category_id === c.id) })).filter((c) => c.items.length);

  const goTo = (cid) => {
    setActiveCat(cid);
    const el = refs.current[cid];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' });
  };

  return (
    <div>
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <Link to="/" className="text-sm text-stone-500 inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-4" /> Tutti i supermercati</Link>
          <div className="flex items-center gap-4 mt-3">
            <div className="size-16 rounded-2xl flex items-center justify-center text-4xl" style={{ background: `${store.color}22` }}>{store.emoji}</div>
            <div>
              <h1 className="text-2xl font-bold">{store.name}</h1>
              <div className="text-sm text-stone-500 flex flex-wrap gap-x-3">
                <span>{store.address}</span>
                <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> preparazione ~{store.prep_minutes} min</span>
                <span>minimo {eur(store.min_order)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Cerca in ${store.name}…`}
                className="w-full h-10 rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
            {[['promo', '🏷️ In offerta'], ['bio', '🌱 Bio'], ['gf', '🌾 Senza glutine']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(filter === k ? null : k)}
                className={cx('h-8 px-3 rounded-full text-sm whitespace-nowrap border', filter === k ? 'bg-ink text-white border-ink' : 'bg-white border-stone-300')}>
                {l}
              </button>
            ))}
            <span className="w-px bg-stone-300 mx-1 shrink-0" />
            {categories.map((c) => (
              <button key={c.id} onClick={() => goTo(c.id)}
                className={cx('h-8 px-3 rounded-full text-sm whitespace-nowrap border', activeCat === c.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-stone-300')}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {!search && !filter && (
          <>
            <h2 className="text-lg font-bold mb-3">Reparti</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3 mb-8">
              {categories.map((c) => (
                <button key={c.id} onClick={() => goTo(c.id)} className="bg-white border border-stone-200 rounded-2xl p-3 hover:border-brand-400 hover:shadow-sm transition text-center">
                  <div className="text-3xl">{c.icon}</div>
                  <div className="text-xs font-medium mt-1.5 leading-tight">{c.name}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{c.count} prodotti</div>
                </button>
              ))}
            </div>
            {promos.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-3">🏷️ Offerte della settimana</h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
                  {promos.map((p) => (
                    <div key={p.id} className="w-44 shrink-0"><ProductCard p={p} store={store} onNeedSwitch={(fn) => setSwitchFn(() => fn)} /></div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {grouped.length === 0 && <Empty icon="🔍" title="Nessun prodotto trovato">Prova a cercare con un'altra parola.</Empty>}
        {grouped.map((c) => (
          <section key={c.id} ref={(el) => { refs.current[c.id] = el; }} className="mb-10">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="text-2xl">{c.icon}</span> {c.name}
              <span className="text-sm font-normal text-stone-400">{c.items.length}</span></h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {c.items.map((p) => <ProductCard key={p.id} p={p} store={store} onNeedSwitch={(fn) => setSwitchFn(() => fn)} />)}
            </div>
          </section>
        ))}
      </div>

      <Modal open={!!switchFn} onClose={() => setSwitchFn(null)} title="Cambiare supermercato?" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setSwitchFn(null)}>Annulla</Button>
          <Button onClick={() => { clear(); switchFn?.(); setSwitchFn(null); }}>Svuota e continua</Button>
        </>}>
        <p className="text-sm text-stone-600">Il carrello contiene prodotti di un altro supermercato. Ogni ordine è preparato da un solo negozio: vuoi svuotare il carrello e iniziare una nuova spesa qui?</p>
      </Modal>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { X, Trash2, Scale } from 'lucide-react';
import { useCart } from '../../lib/cart.jsx';
import { eur, SUB_PREF } from '../../lib/format.js';
import { Button, ProductThumb, Empty } from '../../components/ui.jsx';
import QtyStepper from '../../components/QtyStepper.jsx';

export default function CartDrawer() {
  const { open, setOpen, list, cart, setQty, update, estimate, clear } = useCart();
  const nav = useNavigate();
  if (!open) return null;
  const hasWeight = list.some((i) => i.product.unit === 'kg');

  return (
    <div className="fixed inset-0 z-[900] flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-5 h-16 border-b border-stone-100">
          <div>
            <div className="font-semibold text-lg">Il tuo carrello</div>
            {cart.storeName && <div className="text-xs text-stone-500">da {cart.storeName}</div>}
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-stone-100" aria-label="Chiudi"><X className="size-5" /></button>
        </div>
        {list.length === 0 ? (
          <Empty icon="🛒" title="Il carrello è vuoto">Scegli un supermercato e aggiungi i prodotti che ti servono.</Empty>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
              {list.map(({ product: p, qty, sub_pref }) => {
                const unit = p.promo?.unit_price ?? p.price;
                return (
                  <div key={p.id} className="px-5 py-4">
                    <div className="flex gap-3">
                      <ProductThumb product={p} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm leading-tight">{p.name}</div>
                        <div className="text-xs text-stone-500">{p.size}{p.promo && <span className="ml-2 text-accent-600 font-semibold">{p.promo.label}</span>}</div>
                        <div className="flex items-center justify-between mt-2">
                          <QtyStepper product={p} qty={qty} onChange={(q) => setQty(p, q)} size="sm" />
                          <div className="text-sm font-semibold">{eur(unit * qty)}</div>
                        </div>
                        <select value={sub_pref} onChange={(e) => update(p.id, { sub_pref: e.target.value })}
                          className="mt-2 w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-stone-600">
                          {Object.entries(SUB_PREF).map(([k, v]) => <option key={k} value={k}>Se manca: {v.toLowerCase()}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-5 py-3">
                <button onClick={clear} className="text-xs text-stone-500 hover:text-red-600 inline-flex items-center gap-1"><Trash2 className="size-3.5" /> Svuota carrello</button>
              </div>
            </div>
            <div className="border-t border-stone-100 p-5 space-y-3">
              {hasWeight && (
                <div className="flex gap-2 text-xs text-stone-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <Scale className="size-4 shrink-0 text-amber-600" />
                  <span>Alcuni prodotti sono venduti a peso: il prezzo è stimato e verrà adeguato al peso effettivo. Paghi solo quello che ricevi.</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Totale prodotti (stimato)</span>
                <span className="font-bold text-lg">{eur(estimate)}</span>
              </div>
              <Button size="lg" className="w-full" onClick={() => { setOpen(false); nav('/checkout'); }}>
                Vai alla cassa
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

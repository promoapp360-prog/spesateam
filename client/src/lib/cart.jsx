import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const CartCtx = createContext(null);
const KEY = 'st_cart_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { storeId: null, storeName: null, items: {} }; }
  catch { return { storeId: null, storeName: null, items: {} }; }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* ignore */ }
  }, [cart]);

  const setQty = useCallback((product, qty, store) => {
    setCart((c) => {
      let base = c;
      if (c.storeId && store && c.storeId !== store.id) base = { storeId: store.id, storeName: store.name, items: {} };
      const items = { ...base.items };
      const q = Math.round(Number(qty) * 1000) / 1000;
      if (q <= 0) delete items[product.id];
      else items[product.id] = { product, qty: q, sub_pref: items[product.id]?.sub_pref || 'substitute', note: items[product.id]?.note || '' };
      return {
        storeId: Object.keys(items).length ? (store?.id ?? base.storeId) : null,
        storeName: Object.keys(items).length ? (store?.name ?? base.storeName) : null,
        items,
      };
    });
    setBump((b) => b + 1);
  }, []);

  const update = useCallback((productId, patch) => {
    setCart((c) => ({ ...c, items: { ...c.items, [productId]: { ...c.items[productId], ...patch } } }));
  }, []);

  const clear = useCallback(() => setCart({ storeId: null, storeName: null, items: {} }), []);

  const value = useMemo(() => {
    const list = Object.values(cart.items);
    const count = list.reduce((s, i) => s + (i.product.unit === 'kg' ? 1 : i.qty), 0);
    const estimate = list.reduce((s, i) => {
      const unit = i.product.promo?.unit_price ?? i.product.price;
      let line = unit * i.qty;
      const pr = i.product.promo;
      if (pr?.type === 'x_for_y') line -= Math.floor(i.qty / pr.buy_qty) * (pr.buy_qty - pr.pay_qty) * i.product.price;
      return s + line;
    }, 0);
    return { cart, list, count, estimate, setQty, update, clear, open, setOpen, bump };
  }, [cart, open, bump, setQty, update, clear]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);

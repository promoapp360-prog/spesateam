// Calcolo prezzi: promozioni, coupon, punti fedeltà, costi di consegna.
import { q, one } from './db.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const eur = (n) => round2(n).toFixed(2).replace('.', ',') + ' €';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function activePromotions() {
  const t = todayStr();
  return q(
    `SELECT * FROM promotions
      WHERE active = TRUE
        AND (starts_at IS NULL OR starts_at <= $1)
        AND (ends_at IS NULL OR ends_at >= $1)`,
    [t]
  );
}

function applies(promo, p) {
  switch (promo.scope) {
    case 'all': return true;
    case 'store': return promo.target_id === p.store_id;
    case 'category': return promo.target_id === p.category_id;
    case 'product': return promo.target_id === p.id;
    default: return false;
  }
}

export function promoLabel(promo) {
  if (promo.type === 'percent') return `-${Number(promo.value)}%`;
  if (promo.type === 'fixed') return `-${eur(promo.value)}`;
  if (promo.type === 'x_for_y') return `${promo.buy_qty}x${promo.pay_qty}`;
  return '';
}

/** Restituisce la promo migliore per un prodotto (o null) con il prezzo unitario scontato. */
export function bestPromo(product, promos) {
  let best = null;
  for (const pr of promos) {
    if (!applies(pr, product)) continue;
    if (pr.type === 'x_for_y') {
      if (product.unit !== 'pz' || !pr.buy_qty || !pr.pay_qty || pr.pay_qty >= pr.buy_qty) continue;
      if (!best) best = { promo: pr, unit_price: Number(product.price), label: promoLabel(pr), name: pr.name };
      continue;
    }
    let unit = Number(product.price);
    if (pr.type === 'percent') unit = unit * (1 - Number(pr.value) / 100);
    if (pr.type === 'fixed') unit = Math.max(0, unit - Number(pr.value));
    unit = round2(unit);
    if (!best || best.promo.type === 'x_for_y' || unit < best.unit_price) {
      best = { promo: pr, unit_price: unit, label: promoLabel(pr), name: pr.name };
    }
  }
  return best;
}

/** Aggiunge al prodotto le info promo per la vetrina. */
export function decorateProduct(p, promos) {
  const b = bestPromo(p, promos);
  return {
    ...p,
    promo: b
      ? { type: b.promo.type, label: b.label, name: b.name, unit_price: b.unit_price, buy_qty: b.promo.buy_qty, pay_qty: b.promo.pay_qty }
      : null,
  };
}

export function lineFor(product, qty, promos) {
  qty = Number(qty);
  const list = Number(product.price);
  const b = bestPromo(product, promos);
  let unit = list;
  let discount = 0;
  let label = null;
  if (b) {
    label = b.label;
    if (b.promo.type === 'x_for_y') {
      const free = Math.floor(qty / b.promo.buy_qty) * (b.promo.buy_qty - b.promo.pay_qty);
      discount = round2(free * list);
      if (free === 0) label = null;
    } else {
      unit = b.unit_price;
      discount = round2((list - unit) * qty);
    }
  }
  return {
    list_price: list,
    unit_price: unit,
    qty,
    promo_label: label,
    line_discount: discount,
    line_total: round2(list * qty - discount),
  };
}

/** Verifica un coupon per un cliente e un importo. Restituisce { coupon } oppure { error }. */
export async function checkCoupon(code, customerId, net) {
  if (!code) return {};
  const c = await one('SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)', [code.trim()]);
  if (!c || !c.active) return { error: 'Codice sconto non valido' };
  if (c.expires_at && c.expires_at < todayStr()) return { error: 'Codice sconto scaduto' };
  if (c.max_uses && c.used >= c.max_uses) return { error: 'Codice sconto esaurito' };
  if (c.customer_id && c.customer_id !== customerId) return { error: 'Codice sconto non valido per questo account' };
  if (net < Number(c.min_spend)) return { error: `Spesa minima per questo codice: ${eur(c.min_spend)}` };
  if (customerId) {
    if (c.first_order_only) {
      const prev = await one(`SELECT COUNT(*)::int AS n FROM orders WHERE customer_id=$1 AND status<>'cancelled'`, [customerId]);
      if (prev.n > 0) return { error: 'Codice valido solo sul primo ordine' };
    }
    if (c.max_uses_per_customer) {
      const used = await one(
        `SELECT COUNT(*)::int AS n FROM orders WHERE customer_id=$1 AND UPPER(coupon_code)=UPPER($2) AND status<>'cancelled'`,
        [customerId, c.code]
      );
      if (used.n >= c.max_uses_per_customer) return { error: 'Hai già utilizzato questo codice' };
    }
  }
  return { coupon: c };
}

/**
 * Calcola il preventivo completo.
 * lines: [{ product, qty }]
 */
export async function quote({ lines, store, settings, couponCode, customerId, customerPoints = 0, useReward = false }) {
  const promos = await activePromotions();
  const computed = lines.map(({ product, qty }) => ({ product, ...lineFor(product, qty, promos) }));
  const items_total = round2(computed.reduce((s, l) => s + l.list_price * l.qty, 0));
  const promo_discount = round2(computed.reduce((s, l) => s + l.line_discount, 0));
  const net = round2(items_total - promo_discount);

  const warnings = [];
  let coupon = null;
  let coupon_discount = 0;
  let coupon_error = null;
  if (couponCode) {
    const r = await checkCoupon(couponCode, customerId, net);
    if (r.error) coupon_error = r.error;
    else coupon = r.coupon;
  }

  let delivery_fee = net >= Number(settings.free_delivery_threshold || 0) ? 0 : Number(settings.delivery_fee || 0);
  if (coupon) {
    if (coupon.type === 'percent') coupon_discount = round2(net * Number(coupon.value) / 100);
    if (coupon.type === 'fixed') coupon_discount = round2(Math.min(Number(coupon.value), net));
    if (coupon.type === 'free_delivery') {
      coupon_discount = delivery_fee;
      delivery_fee = 0;
    }
  }

  let points_used = 0;
  let points_discount = 0;
  const threshold = Number(settings.reward_threshold || 0);
  const rewardValue = Number(settings.reward_value || 0);
  const reward_available = threshold > 0 && customerPoints >= threshold;
  if (useReward && reward_available) {
    points_used = threshold;
    points_discount = round2(Math.min(rewardValue, Math.max(0, net - (coupon?.type === 'free_delivery' ? 0 : coupon_discount))));
  }

  const goodsAfter = Math.max(0, net - (coupon && coupon.type !== 'free_delivery' ? coupon_discount : 0) - points_discount);
  const total = round2(goodsAfter + delivery_fee);
  const points_earned = Math.floor(goodsAfter) * Number(settings.points_per_euro || 0);

  const minOrder = Number(store?.min_order || 0);
  if (net < minOrder) warnings.push(`Il minimo d'ordine per ${store.name} è ${eur(minOrder)}`);
  const has_weight = computed.some((l) => l.product.unit === 'kg');
  const free_threshold = Number(settings.free_delivery_threshold || 0);
  const missing_for_free = delivery_fee > 0 && free_threshold > 0 ? round2(free_threshold - net) : 0;

  return {
    lines: computed.map((l) => ({
      product_id: l.product.id,
      name: l.product.name,
      emoji: l.product.emoji,
      unit: l.product.unit,
      list_price: l.list_price,
      unit_price: l.unit_price,
      qty: l.qty,
      promo_label: l.promo_label,
      line_discount: l.line_discount,
      line_total: l.line_total,
    })),
    items_total,
    promo_discount,
    net,
    coupon_code: coupon ? coupon.code : null,
    coupon_type: coupon ? coupon.type : null,
    coupon_discount,
    coupon_error,
    delivery_fee,
    points_used,
    points_discount,
    reward_available,
    total,
    points_earned,
    has_weight,
    weight_margin_pct: Number(settings.weight_margin_pct || 0),
    missing_for_free,
    min_order_ok: net >= minOrder,
    warnings,
  };
}

/** Ricalcola i totali di un ordine dopo la spesa (pesi effettivi, mancanti). */
export async function recalcOrder(db, orderId) {
  const order = await db.one('SELECT * FROM orders WHERE id=$1', [orderId]);
  const items = await db.q('SELECT * FROM order_items WHERE order_id=$1', [orderId]);
  let items_total = 0;
  let promo_discount = 0;
  for (const it of items) {
    let qty = it.status === 'missing' ? 0 : Number(it.final_qty ?? it.qty);
    const gross = Number(it.list_price) * qty;
    let disc = 0;
    if (Number(it.qty) > 0 && it.line_discount > 0) disc = (Number(it.line_discount) / Number(it.qty)) * qty;
    const line_total = round2(gross - disc);
    items_total += gross;
    promo_discount += disc;
    await db.q('UPDATE order_items SET line_total=$1 WHERE id=$2', [line_total, it.id]);
  }
  items_total = round2(items_total);
  promo_discount = round2(promo_discount);
  const net = round2(items_total - promo_discount);
  let coupon_discount = Number(order.coupon_discount);
  if (order.coupon_code) {
    const c = await db.one('SELECT * FROM coupons WHERE UPPER(code)=UPPER($1)', [order.coupon_code]);
    if (c && c.type === 'percent') coupon_discount = round2(net * Number(c.value) / 100);
    if (c && c.type === 'fixed') coupon_discount = round2(Math.min(Number(c.value), net));
  }
  const isFreeDel = order.coupon_code && Number(order.delivery_fee) === 0 && coupon_discount > 0 &&
    (await db.one('SELECT type FROM coupons WHERE UPPER(code)=UPPER($1)', [order.coupon_code]))?.type === 'free_delivery';
  const goods = Math.max(0, net - (isFreeDel ? 0 : coupon_discount) - Number(order.points_discount));
  const total = round2(goods + Number(order.delivery_fee));
  await db.q(
    'UPDATE orders SET items_total=$1, promo_discount=$2, coupon_discount=$3, total=$4 WHERE id=$5',
    [items_total, promo_discount, coupon_discount, total, orderId]
  );
  return total;
}

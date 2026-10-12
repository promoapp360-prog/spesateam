import { Router } from 'express';
import { q, one, tx, getSettings } from '../db.js';
import { ah, httpError, approxGeocode, tierFor } from '../util.js';
import { quote } from '../pricing.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth('customer'));

async function customerProfile(userId) {
  const s = await getSettings();
  const c = await one(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at, c.code, c.points, c.marketing_consent
       FROM users u JOIN customers c ON c.user_id=u.id WHERE u.id=$1`, [userId]
  );
  const addresses = await q('SELECT * FROM addresses WHERE user_id=$1 ORDER BY id DESC', [userId]);
  const earned = await one(`SELECT COALESCE(SUM(points),0)::int AS n FROM loyalty_movements WHERE customer_id=$1 AND points>0`, [userId]);
  const movements = await q('SELECT * FROM loyalty_movements WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 20', [userId]);
  return {
    ...c,
    addresses,
    loyalty: {
      points: c.points,
      lifetime_points: earned.n,
      tier: tierFor(earned.n, s.loyalty.tiers),
      reward_threshold: s.loyalty.reward_threshold,
      reward_value: s.loyalty.reward_value,
      points_per_euro: s.loyalty.points_per_euro,
      movements,
    },
  };
}

r.get('/me', ah(async (req, res) => res.json(await customerProfile(req.user.id))));

r.put('/me', ah(async (req, res) => {
  const { name, phone, marketing_consent } = req.body;
  await q('UPDATE users SET name=COALESCE($1,name), phone=COALESCE($2,phone) WHERE id=$3', [name, phone, req.user.id]);
  if (marketing_consent !== undefined) await q('UPDATE customers SET marketing_consent=$1 WHERE user_id=$2', [!!marketing_consent, req.user.id]);
  res.json(await customerProfile(req.user.id));
}));

r.post('/me/addresses', ah(async (req, res) => {
  const s = await getSettings();
  const { label, street, civic, cap, intercom, floor, notes } = req.body;
  if (!street || !cap) throw httpError(400, 'Indica via e CAP');
  if (!s.delivery.caps.includes(String(cap).trim())) throw httpError(400, 'Il CAP indicato non rientra nella zona servita');
  const pos = approxGeocode(street, civic, s.service.center);
  const a = await one(
    `INSERT INTO addresses(user_id,label,street,civic,cap,city,intercom,floor,notes,lat,lng)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.user.id, label || 'Casa', street, civic, String(cap).trim(), s.service.city, intercom, floor, notes, pos.lat, pos.lng]
  );
  res.json(a);
}));

r.delete('/me/addresses/:id', ah(async (req, res) => {
  await q('DELETE FROM addresses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

async function loadLines(storeId, items) {
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'Il carrello è vuoto');
  const ids = items.map((i) => Number(i.product_id));
  const products = await q('SELECT * FROM products WHERE store_id=$1 AND id = ANY($2::int[])', [storeId, ids]);
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const lines = [];
  const unavailable = [];
  for (const it of items) {
    const p = byId[Number(it.product_id)];
    if (!p || !p.available) { unavailable.push(it.product_id); continue; }
    let qty = Number(it.qty);
    if (!(qty > 0)) continue;
    // quantità coerenti: pezzi interi, peso arrotondato al grammo e non inferiore al minimo
    if (p.unit === 'pz') qty = Math.max(1, Math.round(qty));
    else qty = Math.max(Number(p.step || 0.1), Math.round(qty * 1000) / 1000);
    lines.push({ product: p, qty, sub_pref: it.sub_pref || 'substitute', note: it.note || null });
  }
  return { lines, unavailable };
}

r.post('/cart/quote', ah(async (req, res) => {
  const { store_id, items, coupon_code, use_reward } = req.body;
  const store = await one('SELECT * FROM stores WHERE id=$1', [store_id]);
  if (!store) throw httpError(404, 'Supermercato non trovato');
  const s = await getSettings();
  const cust = await one('SELECT points FROM customers WHERE user_id=$1', [req.user.id]);
  const { lines, unavailable } = await loadLines(store.id, items);
  const result = await quote({
    lines, store, settings: { ...s.delivery, ...s.loyalty }, couponCode: coupon_code,
    customerId: req.user.id, customerPoints: cust.points, useReward: !!use_reward,
  });
  res.json({ ...result, unavailable, customer_points: cust.points });
}));

r.post('/orders', ah(async (req, res) => {
  const { store_id, items, coupon_code, use_reward, address, slot_date, slot_label, payment_method, notes } = req.body;
  if (!['card', 'paypal', 'cash'].includes(payment_method)) throw httpError(400, 'Scegli un metodo di pagamento');
  if (!slot_date || !slot_label) throw httpError(400, 'Scegli la fascia oraria di consegna');
  if (!address || !address.street || !address.cap) throw httpError(400, "Indica l'indirizzo di consegna");
  const s = await getSettings();
  if (!s.delivery.caps.includes(String(address.cap).trim())) throw httpError(400, 'Il CAP indicato non rientra nella zona servita');
  const store = await one('SELECT * FROM stores WHERE id=$1 AND active', [store_id]);
  if (!store) throw httpError(404, 'Supermercato non trovato');
  const cust = await one('SELECT points FROM customers WHERE user_id=$1', [req.user.id]);
  const { lines } = await loadLines(store.id, items);
  if (!lines.length) throw httpError(400, 'I prodotti nel carrello non sono più disponibili');
  const qt = await quote({
    lines, store, settings: { ...s.delivery, ...s.loyalty }, couponCode: coupon_code,
    customerId: req.user.id, customerPoints: cust.points, useReward: !!use_reward,
  });
  if (qt.coupon_error) throw httpError(400, qt.coupon_error);
  if (!qt.min_order_ok) throw httpError(400, qt.warnings[0]);
  const cap = await one(
    `SELECT COUNT(*)::int AS n FROM orders WHERE slot_date=$1 AND slot_label=$2 AND status<>'cancelled'`, [slot_date, slot_label]
  );
  if (cap.n >= s.delivery.slot_capacity) throw httpError(409, 'La fascia oraria scelta è appena stata completata, scegline un\'altra');

  const pos = address.lat && address.lng ? { lat: address.lat, lng: address.lng } : approxGeocode(address.street, address.civic, s.service.center);
  const order = await tx(async (db) => {
    const seq = await db.one(`SELECT COALESCE(MAX(SUBSTRING(code FROM 4)::int),1000)+1 AS n FROM orders`);
    const code = `ST-${seq.n}`;
    const o = await db.one(
      `INSERT INTO orders(code,customer_id,store_id,status,street,civic,cap,city,intercom,floor,address_notes,lat,lng,
         slot_date,slot_label,payment_method,payment_status,items_total,promo_discount,coupon_code,coupon_discount,
         points_used,points_discount,delivery_fee,estimated_total,total,notes)
       VALUES ($1,$2,$3,'received',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24,$25) RETURNING *`,
      [code, req.user.id, store.id, address.street, address.civic, String(address.cap).trim(), s.service.city,
        address.intercom, address.floor, address.notes, pos.lat, pos.lng, slot_date, slot_label, payment_method,
        payment_method === 'cash' ? 'pending' : 'authorized',
        qt.items_total, qt.promo_discount, qt.coupon_code, qt.coupon_discount, qt.points_used, qt.points_discount,
        qt.delivery_fee, qt.total, notes || null]
    );
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const ql = qt.lines[i];
      await db.q(
        `INSERT INTO order_items(order_id,product_id,name,emoji,category_id,unit,list_price,unit_price,qty,promo_label,line_discount,line_total,sub_pref,note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [o.id, l.product.id, l.product.name, l.product.emoji, l.product.category_id, l.product.unit, ql.list_price, ql.unit_price,
          ql.qty, ql.promo_label, ql.line_discount, ql.line_total,
          ['substitute', 'contact', 'remove'].includes(l.sub_pref) ? l.sub_pref : 'substitute', l.note]
      );
    }
    await db.q(`INSERT INTO order_events(order_id,status,user_id) VALUES ($1,'received',$2)`, [o.id, req.user.id]);
    if (qt.coupon_code) await db.q('UPDATE coupons SET used=used+1 WHERE code=$1', [qt.coupon_code]);
    if (qt.points_used > 0) {
      await db.q('UPDATE customers SET points=points-$1 WHERE user_id=$2', [qt.points_used, req.user.id]);
      await db.q('INSERT INTO loyalty_movements(customer_id,order_id,points,reason) VALUES ($1,$2,$3,$4)',
        [req.user.id, o.id, -qt.points_used, `Premio usato sull'ordine ${code}`]);
    }
    // salva l'indirizzo se nuovo
    const known = await db.one('SELECT id FROM addresses WHERE user_id=$1 AND LOWER(street)=LOWER($2) AND COALESCE(civic,\'\')=COALESCE($3,\'\')',
      [req.user.id, address.street, address.civic || '']);
    if (!known) {
      await db.q(`INSERT INTO addresses(user_id,label,street,civic,cap,city,intercom,floor,notes,lat,lng) VALUES ($1,'Casa',$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [req.user.id, address.street, address.civic, String(address.cap).trim(), s.service.city, address.intercom, address.floor, address.notes, pos.lat, pos.lng]);
    }
    return o;
  });
  res.json(order);
}));

r.get('/orders', ah(async (req, res) => {
  res.json(await q(
    `SELECT o.id, o.code, o.status, o.total, o.created_at, o.slot_date, o.slot_label, o.payment_method,
            s.name AS store_name, s.emoji AS store_emoji,
            (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id)::int AS items_count
       FROM orders o JOIN stores s ON s.id=o.store_id
      WHERE o.customer_id=$1 ORDER BY o.created_at DESC LIMIT 50`, [req.user.id]
  ));
}));

export async function orderDetail(id, opts = {}) {
  const o = await one(
    `SELECT o.*, s.name AS store_name, s.address AS store_address, s.lat AS store_lat, s.lng AS store_lng, s.emoji AS store_emoji, s.phone AS store_phone,
            cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email, c.code AS customer_code,
            du.name AS driver_name, du.phone AS driver_phone, d.lat AS driver_lat, d.lng AS driver_lng, d.position_at AS driver_position_at, d.vehicle AS driver_vehicle
       FROM orders o
       JOIN stores s ON s.id=o.store_id
       JOIN users cu ON cu.id=o.customer_id
       LEFT JOIN customers c ON c.user_id=o.customer_id
       LEFT JOIN users du ON du.id=o.driver_id
       LEFT JOIN drivers d ON d.user_id=o.driver_id
      WHERE o.id=$1`, [id]
  );
  if (!o) return null;
  o.items = await q(
    `SELECT i.*, c.name AS category_name, c.sort AS category_sort FROM order_items i
       LEFT JOIN categories c ON c.id=i.category_id WHERE i.order_id=$1 ORDER BY c.sort NULLS LAST, i.id`, [id]
  );
  o.events = await q(
    `SELECT e.*, u.name AS user_name FROM order_events e LEFT JOIN users u ON u.id=e.user_id WHERE e.order_id=$1 ORDER BY e.created_at`, [id]
  );
  if (opts.forCustomer) {
    // il cliente vede la posizione del driver solo durante la consegna
    if (o.status !== 'delivering') { o.driver_lat = null; o.driver_lng = null; }
    delete o.driver_phone;
  }
  return o;
}

r.get('/orders/:id', ah(async (req, res) => {
  const o = await orderDetail(req.params.id, { forCustomer: true });
  if (!o || o.customer_id !== req.user.id) throw httpError(404, 'Ordine non trovato');
  res.json(o);
}));

r.post('/orders/:id/cancel', ah(async (req, res) => {
  const o = await one('SELECT * FROM orders WHERE id=$1 AND customer_id=$2', [req.params.id, req.user.id]);
  if (!o) throw httpError(404, 'Ordine non trovato');
  if (!['received', 'accepted'].includes(o.status)) throw httpError(400, 'L\'ordine è già in preparazione e non può essere annullato dall\'app. Contatta l\'assistenza.');
  await cancelOrder(o, req.user.id, 'Annullato dal cliente');
  res.json({ ok: true });
}));

r.post('/orders/:id/rate', ah(async (req, res) => {
  const rating = Math.max(1, Math.min(5, Number(req.body.rating)));
  await q(`UPDATE orders SET rating=$1 WHERE id=$2 AND customer_id=$3 AND status='delivered'`, [rating, req.params.id, req.user.id]);
  res.json({ ok: true });
}));

export async function cancelOrder(o, userId, note) {
  await tx(async (db) => {
    await db.q(`UPDATE orders SET status='cancelled', cancelled_at=NOW(), payment_status=CASE WHEN payment_method='cash' THEN 'pending' ELSE 'refunded' END WHERE id=$1`, [o.id]);
    await db.q(`INSERT INTO order_events(order_id,status,note,user_id) VALUES ($1,'cancelled',$2,$3)`, [o.id, note, userId]);
    if (o.points_used > 0) {
      await db.q('UPDATE customers SET points=points+$1 WHERE user_id=$2', [o.points_used, o.customer_id]);
      await db.q('INSERT INTO loyalty_movements(customer_id,order_id,points,reason) VALUES ($1,$2,$3,$4)',
        [o.customer_id, o.id, o.points_used, `Punti restituiti: ordine ${o.code} annullato`]);
    }
    if (o.coupon_code) await db.q('UPDATE coupons SET used=GREATEST(used-1,0) WHERE code=$1', [o.coupon_code]);
    if (o.driver_id) {
      const other = await db.one(`SELECT COUNT(*)::int AS n FROM orders WHERE driver_id=$1 AND status IN ('accepted','shopping','delivering') AND id<>$2`, [o.driver_id, o.id]);
      if (other.n === 0) await db.q(`UPDATE drivers SET status='available' WHERE user_id=$1 AND status='busy'`, [o.driver_id]);
    }
  });
}

export { r as customerRoutes };

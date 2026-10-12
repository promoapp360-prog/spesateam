import { Router } from 'express';
import { q, one, getSettings } from '../db.js';
import { ah, httpError } from '../util.js';
import { activePromotions, decorateProduct } from '../pricing.js';
import { login, hashPassword, signToken } from '../auth.js';

const r = Router();

r.get('/settings', ah(async (req, res) => {
  const s = await getSettings();
  res.json({
    service: s.service,
    delivery: {
      caps: s.delivery.caps,
      delivery_fee: s.delivery.delivery_fee,
      free_delivery_threshold: s.delivery.free_delivery_threshold,
      weight_margin_pct: s.delivery.weight_margin_pct,
    },
    loyalty: s.loyalty,
  });
}));

r.post('/check-cap', ah(async (req, res) => {
  const s = await getSettings();
  const cap = String(req.body.cap || '').trim();
  res.json({ ok: s.delivery.caps.includes(cap), caps: s.delivery.caps });
}));

r.get('/stores', ah(async (req, res) => {
  const stores = await q(`
    SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.store_id=s.id AND p.available) AS products_count
    FROM stores s WHERE s.active ORDER BY s.id`);
  res.json(stores);
}));

r.get('/stores/:id/catalog', ah(async (req, res) => {
  const store = await one('SELECT * FROM stores WHERE id=$1 AND active', [req.params.id]);
  if (!store) throw httpError(404, 'Supermercato non trovato');
  const promos = await activePromotions();
  const products = (await q(
    `SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id
      WHERE p.store_id=$1 AND p.available AND c.active ORDER BY c.sort, p.popularity DESC, p.name`,
    [store.id]
  )).map((p) => decorateProduct(p, promos));
  const counts = {};
  for (const p of products) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  const categories = (await q('SELECT * FROM categories WHERE active ORDER BY sort'))
    .filter((c) => counts[c.id])
    .map((c) => ({ ...c, count: counts[c.id] }));
  res.json({ store, categories, products });
}));

r.get('/slots', ah(async (req, res) => {
  const s = await getSettings();
  const { slots, slot_capacity, days_ahead } = s.delivery;
  const now = new Date();
  const out = [];
  const used = await q(
    `SELECT slot_date, slot_label, COUNT(*)::int AS n FROM orders
      WHERE status <> 'cancelled' AND slot_date >= CURRENT_DATE GROUP BY 1,2`
  );
  const usedMap = {};
  for (const u of used) usedMap[`${u.slot_date}|${u.slot_label}`] = u.n;
  for (let d = 0; d < (days_ahead || 3); d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    if (day.getDay() === 0 && d > 0) { /* domenica: servizio ridotto, mostriamo solo la mattina */ }
    const daySlots = slots.map((label) => {
      const startH = parseInt(label, 10);
      const past = d === 0 && startH <= now.getHours() + 1;
      const sundayOff = day.getDay() === 0 && startH >= 14;
      const n = usedMap[`${ds}|${label}`] || 0;
      return { label, available: !past && !sundayOff && n < slot_capacity, remaining: Math.max(0, slot_capacity - n) };
    });
    out.push({ date: ds, weekday: day.getDay(), slots: daySlots });
  }
  res.json(out);
}));

const auth = Router();

auth.post('/login', ah(async (req, res) => {
  const { email, password, area } = req.body;
  res.json(await login(email, password, area));
}));

auth.post('/register', ah(async (req, res) => {
  const { name, email, phone, password, marketing_consent } = req.body;
  if (!name || !email || !password) throw httpError(400, 'Compila nome, email e password');
  if (String(password).length < 6) throw httpError(400, 'La password deve avere almeno 6 caratteri');
  const exists = await one('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email.trim()]);
  if (exists) throw httpError(409, 'Esiste già un account con questa email');
  const u = await one(
    `INSERT INTO users(role,name,email,phone,password_hash) VALUES ('customer',$1,$2,$3,$4) RETURNING id, role, name, email`,
    [name.trim(), email.trim().toLowerCase(), phone || null, hashPassword(password)]
  );
  const next = await one(`SELECT COALESCE(MAX(SUBSTRING(code FROM 3)::int),0)+1 AS n FROM customers`);
  await q('INSERT INTO customers(user_id, code, marketing_consent) VALUES ($1,$2,$3)', [u.id, 'ST' + String(next.n).padStart(5, '0'), !!marketing_consent]);
  res.json({ token: signToken(u), user: u });
}));

export { r as publicRoutes, auth as authRoutes };

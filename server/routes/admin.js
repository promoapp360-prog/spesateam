import { Router } from 'express';
import { q, one, tx, getSettings, setSetting } from '../db.js';
import { ah, httpError, tierFor } from '../util.js';
import { requireAuth, hashPassword, logActivity } from '../auth.js';
import { assignDriver, advanceStatus } from '../orders.js';
import { orderDetail, cancelOrder } from './customer.js';
import { round2, promoLabel } from '../pricing.js';

const r = Router();
r.use(requireAuth('admin', 'operator'));
const adminOnly = requireAuth('admin');

// ---------------------------------------------------------------- Dashboard
r.get('/dashboard', ah(async (req, res) => {
  const today = await one(`
    SELECT COUNT(*) FILTER (WHERE status<>'cancelled')::int AS orders,
           COALESCE(SUM(total) FILTER (WHERE status='delivered'),0) AS revenue,
           COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled')),0) AS booked,
           COUNT(*) FILTER (WHERE status='delivered')::int AS delivered
      FROM orders WHERE DATE(created_at)=CURRENT_DATE`);
  const yesterday = await one(`
    SELECT COUNT(*) FILTER (WHERE status<>'cancelled')::int AS orders,
           COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled')),0) AS booked
      FROM orders WHERE DATE(created_at)=CURRENT_DATE - 1`);
  const byStatus = await q(`SELECT status, COUNT(*)::int AS n FROM orders WHERE status IN ('received','accepted','shopping','delivering') GROUP BY status`);
  const drivers = await q(`SELECT u.id, u.name, d.status, d.vehicle,
      (SELECT COUNT(*) FROM orders o WHERE o.driver_id=u.id AND o.status IN ('accepted','shopping','delivering'))::int AS active_orders
      FROM users u JOIN drivers d ON d.user_id=u.id WHERE u.active ORDER BY u.name`);
  const late = await q(`
    SELECT o.id, o.code, o.status, o.slot_label, o.created_at, u.name AS customer_name
      FROM orders o JOIN users u ON u.id=o.customer_id
     WHERE o.status='received' AND o.created_at < NOW() - interval '10 minutes' ORDER BY o.created_at LIMIT 5`);
  const recent = await q(`
    SELECT o.id, o.code, o.status, o.total, o.created_at, o.payment_method, o.slot_label, u.name AS customer_name, s.name AS store_name, du.name AS driver_name
      FROM orders o JOIN users u ON u.id=o.customer_id JOIN stores s ON s.id=o.store_id LEFT JOIN users du ON du.id=o.driver_id
     ORDER BY o.created_at DESC LIMIT 8`);
  const unavailable = await one(`SELECT COUNT(*)::int AS n FROM products WHERE NOT available`);
  const week = await q(`
    SELECT DATE(created_at) AS day, COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS revenue
      FROM orders WHERE status<>'cancelled' AND created_at >= CURRENT_DATE - 6 GROUP BY 1 ORDER BY 1`);
  res.json({ today, yesterday, byStatus, drivers, late, recent, unavailable_products: unavailable.n, week });
}));

// ---------------------------------------------------------------- Ordini
r.get('/orders', ah(async (req, res) => {
  const { status, store_id, driver_id, date, q: search } = req.query;
  const where = [];
  const p = [];
  if (status === 'active') where.push(`o.status IN ('received','accepted','shopping','delivering')`);
  else if (status) { p.push(status); where.push(`o.status=$${p.length}`); }
  if (store_id) { p.push(store_id); where.push(`o.store_id=$${p.length}`); }
  if (driver_id) { p.push(driver_id); where.push(`o.driver_id=$${p.length}`); }
  if (date) { p.push(date); where.push(`DATE(o.created_at)=$${p.length}`); }
  if (search) { p.push(`%${search}%`); where.push(`(o.code ILIKE $${p.length} OR u.name ILIKE $${p.length} OR o.street ILIKE $${p.length})`); }
  const rows = await q(`
    SELECT o.id, o.code, o.status, o.total, o.created_at, o.payment_method, o.payment_status, o.slot_date, o.slot_label,
           o.street, o.civic, u.name AS customer_name, s.name AS store_name, s.emoji AS store_emoji, du.name AS driver_name, o.driver_id,
           (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id)::int AS items_count
      FROM orders o JOIN users u ON u.id=o.customer_id JOIN stores s ON s.id=o.store_id LEFT JOIN users du ON du.id=o.driver_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY o.created_at DESC LIMIT 300`, p);
  res.json(rows);
}));

r.get('/orders/:id', ah(async (req, res) => {
  const o = await orderDetail(req.params.id);
  if (!o) throw httpError(404, 'Ordine non trovato');
  res.json(o);
}));

r.post('/orders/:id/assign', ah(async (req, res) => {
  await assignDriver(Number(req.params.id), Number(req.body.driver_id), req.user.id);
  res.json(await orderDetail(req.params.id));
}));

r.post('/orders/:id/status', ah(async (req, res) => {
  const { status, note, cash_collected } = req.body;
  if (status === 'cancelled') {
    const o = await one('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!o) throw httpError(404, 'Ordine non trovato');
    if (['delivered', 'cancelled', 'delivering'].includes(o.status)) throw httpError(400, 'Questo ordine non può più essere annullato');
    await cancelOrder(o, req.user.id, note || 'Annullato dall\'operatore');
  } else {
    await advanceStatus(Number(req.params.id), status, req.user.id, { note, cash_collected });
  }
  await logActivity(req.user.id, 'order_status', `Ordine ${req.params.id} → ${status}`);
  res.json(await orderDetail(req.params.id));
}));

r.get('/live', ah(async (req, res) => {
  const drivers = await q(`SELECT u.id, u.name, d.status, d.lat, d.lng, d.position_at, d.vehicle,
      (SELECT json_agg(json_build_object('id',o.id,'code',o.code,'status',o.status)) FROM orders o WHERE o.driver_id=u.id AND o.status IN ('accepted','shopping','delivering')) AS orders
      FROM users u JOIN drivers d ON d.user_id=u.id WHERE u.active AND d.status<>'offline'`);
  const orders = await q(`SELECT o.id, o.code, o.status, o.lat, o.lng, o.street, o.civic, o.slot_label, u.name AS customer_name, du.name AS driver_name
      FROM orders o JOIN users u ON u.id=o.customer_id LEFT JOIN users du ON du.id=o.driver_id
     WHERE o.status IN ('received','accepted','shopping','delivering')`);
  const stores = await q('SELECT id, name, lat, lng, emoji FROM stores WHERE active');
  res.json({ drivers, orders, stores });
}));

// ---------------------------------------------------------------- Catalogo
r.get('/products', ah(async (req, res) => {
  const { store_id, category_id, q: search, availability } = req.query;
  const where = [];
  const p = [];
  if (store_id) { p.push(store_id); where.push(`p.store_id=$${p.length}`); }
  if (category_id) { p.push(category_id); where.push(`p.category_id=$${p.length}`); }
  if (search) { p.push(`%${search}%`); where.push(`(p.name ILIKE $${p.length} OR p.brand ILIKE $${p.length})`); }
  if (availability === 'off') where.push('NOT p.available');
  res.json(await q(`
    SELECT p.*, c.name AS category_name, s.name AS store_name
      FROM products p JOIN categories c ON c.id=p.category_id JOIN stores s ON s.id=p.store_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.id, c.sort, p.name LIMIT 1000`, p));
}));

const PRODUCT_FIELDS = ['store_id', 'category_id', 'name', 'brand', 'size', 'price', 'unit', 'step', 'vat', 'image_url', 'emoji', 'is_bio', 'gluten_free', 'available'];

function cleanProduct(b) {
  const o = {};
  for (const f of PRODUCT_FIELDS) if (b[f] !== undefined) o[f] = b[f] === '' ? null : b[f];
  if (o.price !== undefined) o.price = round2(o.price);
  if (o.unit === 'pz') o.step = 1;
  return o;
}

r.post('/products', ah(async (req, res) => {
  const d = cleanProduct(req.body);
  if (!d.store_id || !d.category_id || !d.name || d.price == null) throw httpError(400, 'Compila supermercato, reparto, nome e prezzo');
  const keys = Object.keys(d);
  const row = await one(
    `INSERT INTO products(${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
    keys.map((k) => d[k])
  );
  await logActivity(req.user.id, 'product_create', row.name);
  res.json(row);
}));

r.put('/products/:id', ah(async (req, res) => {
  const d = cleanProduct(req.body);
  const old = await one('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!old) throw httpError(404, 'Prodotto non trovato');
  const keys = Object.keys(d);
  if (!keys.length) return res.json(old);
  const row = await one(
    `UPDATE products SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')}, updated_at=NOW() WHERE id=$${keys.length + 1} RETURNING *`,
    [...keys.map((k) => d[k]), req.params.id]
  );
  if (d.price !== undefined && Number(old.price) !== Number(d.price)) {
    await q('INSERT INTO price_history(product_id, old_price, new_price, changed_by) VALUES ($1,$2,$3,$4)', [old.id, old.price, d.price, req.user.id]);
  }
  res.json(row);
}));

r.delete('/products/:id', ah(async (req, res) => {
  const used = await one('SELECT COUNT(*)::int AS n FROM order_items WHERE product_id=$1', [req.params.id]);
  if (used.n > 0) {
    await q('UPDATE products SET available=FALSE WHERE id=$1', [req.params.id]);
    return res.json({ ok: true, archived: true });
  }
  await q('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

r.get('/products/:id/history', ah(async (req, res) => {
  res.json(await q(`SELECT h.*, u.name AS user_name FROM price_history h LEFT JOIN users u ON u.id=h.changed_by WHERE product_id=$1 ORDER BY changed_at DESC`, [req.params.id]));
}));

r.post('/products/bulk-price', ah(async (req, res) => {
  const percent = Number(req.body.percent);
  if (!isFinite(percent) || percent === 0 || Math.abs(percent) > 50) throw httpError(400, 'Indica una variazione percentuale tra -50% e +50%');
  const where = [];
  const p = [];
  if (req.body.store_id) { p.push(req.body.store_id); where.push(`store_id=$${p.length}`); }
  if (req.body.category_id) { p.push(req.body.category_id); where.push(`category_id=$${p.length}`); }
  const n = await tx(async (db) => {
    const rows = await db.q(`SELECT id, price FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, p);
    for (const row of rows) {
      const np = round2(Number(row.price) * (1 + percent / 100));
      await db.q('UPDATE products SET price=$1, updated_at=NOW() WHERE id=$2', [np, row.id]);
      await db.q('INSERT INTO price_history(product_id, old_price, new_price, changed_by) VALUES ($1,$2,$3,$4)', [row.id, row.price, np, req.user.id]);
    }
    return rows.length;
  });
  await logActivity(req.user.id, 'bulk_price', `${percent}% su ${n} prodotti`);
  res.json({ updated: n });
}));

r.post('/products/import', ah(async (req, res) => {
  // righe CSV già convertite dal browser: [{store_id, category, name, brand, size, price, unit}]
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const cats = await q('SELECT id, name FROM categories');
  const catByName = Object.fromEntries(cats.map((c) => [c.name.toLowerCase(), c.id]));
  let inserted = 0, updated = 0, skipped = 0;
  for (const row of rows) {
    const store_id = Number(row.store_id || req.body.store_id);
    const category_id = Number(row.category_id) || catByName[String(row.category || '').toLowerCase().trim()];
    const price = round2(String(row.price || '').replace(',', '.'));
    if (!store_id || !category_id || !row.name || !(price > 0)) { skipped++; continue; }
    const ex = await one('SELECT id FROM products WHERE store_id=$1 AND LOWER(name)=LOWER($2) AND COALESCE(size,\'\')=COALESCE($3,\'\')', [store_id, row.name.trim(), row.size || '']);
    if (ex) {
      await q('UPDATE products SET price=$1, category_id=$2, brand=COALESCE($3,brand), updated_at=NOW() WHERE id=$4', [price, category_id, row.brand || null, ex.id]);
      updated++;
    } else {
      await q(`INSERT INTO products(store_id,category_id,name,brand,size,price,unit,step) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [store_id, category_id, row.name.trim(), row.brand || null, row.size || null, price, row.unit === 'kg' ? 'kg' : 'pz', row.unit === 'kg' ? 0.5 : 1]);
      inserted++;
    }
  }
  res.json({ inserted, updated, skipped });
}));

// ---------------------------------------------------------------- CRUD generici
function crud(path, table, fields, { order = 'id', required = [] } = {}) {
  r.get(`/${path}`, ah(async (req, res) => res.json(await q(`SELECT * FROM ${table} ORDER BY ${order}`))));
  r.post(`/${path}`, ah(async (req, res) => {
    const d = {};
    for (const f of fields) if (req.body[f] !== undefined) d[f] = req.body[f] === '' ? null : req.body[f];
    for (const f of required) if (d[f] == null) throw httpError(400, `Campo obbligatorio: ${f}`);
    const keys = Object.keys(d);
    res.json(await one(`INSERT INTO ${table}(${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, keys.map((k) => d[k])));
  }));
  r.put(`/${path}/:id`, ah(async (req, res) => {
    const d = {};
    for (const f of fields) if (req.body[f] !== undefined) d[f] = req.body[f] === '' ? null : req.body[f];
    const keys = Object.keys(d);
    if (!keys.length) throw httpError(400, 'Nessun dato da aggiornare');
    const row = await one(`UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE id=$${keys.length + 1} RETURNING *`, [...keys.map((k) => d[k]), req.params.id]);
    if (!row) throw httpError(404, 'Elemento non trovato');
    res.json(row);
  }));
  r.delete(`/${path}/:id`, ah(async (req, res) => {
    try {
      await q(`DELETE FROM ${table} WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch {
      await q(`UPDATE ${table} SET active=FALSE WHERE id=$1`, [req.params.id]);
      res.json({ ok: true, archived: true });
    }
  }));
}

crud('categories', 'categories', ['name', 'icon', 'sort', 'active'], { order: 'sort, id', required: ['name'] });
crud('stores', 'stores', ['name', 'address', 'phone', 'lat', 'lng', 'hours', 'min_order', 'prep_minutes', 'color', 'emoji', 'active'], { required: ['name'] });
crud('promotions', 'promotions', ['name', 'type', 'value', 'buy_qty', 'pay_qty', 'scope', 'target_id', 'starts_at', 'ends_at', 'active'], { order: 'active DESC, id DESC', required: ['name', 'type', 'scope'] });
crud('coupons', 'coupons', ['code', 'description', 'type', 'value', 'min_spend', 'max_uses', 'max_uses_per_customer', 'first_order_only', 'customer_id', 'expires_at', 'active'], { order: 'active DESC, id DESC', required: ['code', 'type'] });

r.get('/promotions-overview', ah(async (req, res) => {
  const promos = await q('SELECT * FROM promotions ORDER BY active DESC, id DESC');
  const cats = await q('SELECT id, name FROM categories');
  const stores = await q('SELECT id, name FROM stores');
  const prods = promos.filter((p) => p.scope === 'product' && p.target_id).map((p) => p.target_id);
  const products = prods.length ? await q('SELECT p.id, p.name, s.name AS store_name FROM products p JOIN stores s ON s.id=p.store_id WHERE p.id = ANY($1::int[])', [prods]) : [];
  const t = new Date().toISOString().slice(0, 10);
  res.json(promos.map((p) => {
    let target = 'Tutto il catalogo';
    if (p.scope === 'category') target = 'Reparto: ' + (cats.find((c) => c.id === p.target_id)?.name || '?');
    if (p.scope === 'store') target = 'Supermercato: ' + (stores.find((s) => s.id === p.target_id)?.name || '?');
    if (p.scope === 'product') { const pr = products.find((x) => x.id === p.target_id); target = pr ? `${pr.name} (${pr.store_name})` : 'Prodotto'; }
    const running = p.active && (!p.starts_at || p.starts_at <= t) && (!p.ends_at || p.ends_at >= t);
    return { ...p, label: promoLabel(p), target, running };
  }));
}));

// ---------------------------------------------------------------- Driver
r.get('/drivers', ah(async (req, res) => {
  res.json(await q(`
    SELECT u.id, u.name, u.email, u.phone, u.active, u.created_at, d.vehicle, d.plate, d.zone, d.tax_code, d.status, d.lat, d.lng, d.position_at,
      (SELECT COUNT(*) FROM orders o WHERE o.driver_id=u.id AND o.status='delivered')::int AS delivered_total,
      (SELECT COUNT(*) FROM orders o WHERE o.driver_id=u.id AND o.status='delivered' AND o.delivered_at >= NOW() - interval '30 days')::int AS delivered_30d,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.accepted_at))/60)) FROM orders o WHERE o.driver_id=u.id AND o.status='delivered' AND o.delivered_at >= NOW() - interval '30 days') AS avg_minutes,
      (SELECT ROUND(AVG(rating)::numeric,1) FROM orders o WHERE o.driver_id=u.id AND rating IS NOT NULL) AS avg_rating,
      (SELECT COALESCE(SUM(cash_collected),0) FROM orders o WHERE o.driver_id=u.id AND DATE(o.delivered_at)=CURRENT_DATE) AS cash_today
      FROM users u JOIN drivers d ON d.user_id=u.id ORDER BY u.active DESC, u.name`));
}));

r.post('/drivers', ah(async (req, res) => {
  const { name, email, phone, password, vehicle, plate, zone, tax_code } = req.body;
  if (!name || !email) throw httpError(400, 'Nome ed email sono obbligatori');
  const ex = await one('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
  if (ex) throw httpError(409, 'Email già in uso');
  const id = await tx(async (db) => {
    const u = await db.one(`INSERT INTO users(role,name,email,phone,password_hash) VALUES ('driver',$1,$2,$3,$4) RETURNING id`,
      [name, email.toLowerCase(), phone || null, hashPassword(password || 'demo1234')]);
    await db.q('INSERT INTO drivers(user_id,vehicle,plate,zone,tax_code) VALUES ($1,$2,$3,$4,$5)', [u.id, vehicle || null, plate || null, zone || null, tax_code || null]);
    return u.id;
  });
  res.json({ id });
}));

r.put('/drivers/:id', ah(async (req, res) => {
  const { name, email, phone, password, vehicle, plate, zone, tax_code, active } = req.body;
  await tx(async (db) => {
    await db.q(`UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), active=COALESCE($4,active) WHERE id=$5 AND role='driver'`,
      [name, email, phone, active, req.params.id]);
    if (password) await db.q('UPDATE users SET password_hash=$1 WHERE id=$2', [hashPassword(password), req.params.id]);
    await db.q(`UPDATE drivers SET vehicle=COALESCE($1,vehicle), plate=COALESCE($2,plate), zone=COALESCE($3,zone), tax_code=COALESCE($4,tax_code) WHERE user_id=$5`,
      [vehicle, plate, zone, tax_code, req.params.id]);
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Clienti
r.get('/customers', ah(async (req, res) => {
  const s = await getSettings();
  const p = [];
  let where = '';
  if (req.query.q) { p.push(`%${req.query.q}%`); where = `WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR c.code ILIKE $1 OR u.phone ILIKE $1`; }
  const rows = await q(`
    SELECT u.id, u.name, u.email, u.phone, u.created_at, u.active, c.code, c.points, c.marketing_consent,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id=u.id AND o.status='delivered')::int AS orders_count,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.customer_id=u.id AND o.status='delivered') AS total_spent,
      (SELECT MAX(created_at) FROM orders o WHERE o.customer_id=u.id) AS last_order,
      (SELECT COALESCE(SUM(points),0) FROM loyalty_movements m WHERE m.customer_id=u.id AND m.points>0)::int AS lifetime_points,
      (SELECT street || ' ' || COALESCE(civic,'') FROM addresses a WHERE a.user_id=u.id ORDER BY id DESC LIMIT 1) AS address
      FROM users u JOIN customers c ON c.user_id=u.id ${where} ORDER BY c.code LIMIT 500`, p);
  res.json(rows.map((x) => ({ ...x, tier: tierFor(x.lifetime_points, s.loyalty.tiers).current })));
}));

r.get('/customers/:id', ah(async (req, res) => {
  const s = await getSettings();
  const c = await one(`SELECT u.id, u.name, u.email, u.phone, u.created_at, u.active, c.* FROM users u JOIN customers c ON c.user_id=u.id WHERE u.id=$1`, [req.params.id]);
  if (!c) throw httpError(404, 'Cliente non trovato');
  c.addresses = await q('SELECT * FROM addresses WHERE user_id=$1 ORDER BY id DESC', [c.id]);
  c.orders = await q(`SELECT o.id, o.code, o.status, o.total, o.created_at, s.name AS store_name FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.customer_id=$1 ORDER BY o.created_at DESC LIMIT 50`, [c.id]);
  c.movements = await q('SELECT * FROM loyalty_movements WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 50', [c.id]);
  const lifetime = c.movements.filter((m) => m.points > 0).reduce((a, m) => a + m.points, 0);
  c.tier = tierFor(lifetime, s.loyalty.tiers);
  c.stats = await one(`SELECT COUNT(*) FILTER (WHERE status='delivered')::int AS orders, COALESCE(SUM(total) FILTER (WHERE status='delivered'),0) AS spent,
      COALESCE(AVG(total) FILTER (WHERE status='delivered'),0) AS avg_ticket FROM orders WHERE customer_id=$1`, [c.id]);
  c.favorites = await q(`SELECT i.name, i.emoji, COUNT(*)::int AS n FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.customer_id=$1 GROUP BY 1,2 ORDER BY n DESC LIMIT 6`, [c.id]);
  res.json(c);
}));

r.put('/customers/:id', ah(async (req, res) => {
  const { name, phone, notes, active } = req.body;
  await q('UPDATE users SET name=COALESCE($1,name), phone=COALESCE($2,phone), active=COALESCE($3,active) WHERE id=$4 AND role=\'customer\'', [name, phone, active, req.params.id]);
  if (notes !== undefined) await q('UPDATE customers SET notes=$1 WHERE user_id=$2', [notes, req.params.id]);
  res.json({ ok: true });
}));

r.post('/customers/:id/points', ah(async (req, res) => {
  const points = parseInt(req.body.points, 10);
  if (!points) throw httpError(400, 'Indica i punti da aggiungere o togliere');
  await tx(async (db) => {
    await db.q('UPDATE customers SET points=GREATEST(points+$1,0) WHERE user_id=$2', [points, req.params.id]);
    await db.q('INSERT INTO loyalty_movements(customer_id,points,reason) VALUES ($1,$2,$3)', [req.params.id, points, req.body.reason || 'Rettifica manuale']);
  });
  await logActivity(req.user.id, 'points_adjust', `Cliente ${req.params.id}: ${points}`);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Fedeltà (panoramica)
r.get('/loyalty', ah(async (req, res) => {
  const s = await getSettings();
  const totals = await one(`SELECT COALESCE(SUM(points) FILTER (WHERE points>0),0)::int AS issued, COALESCE(-SUM(points) FILTER (WHERE points<0),0)::int AS redeemed FROM loyalty_movements`);
  const balance = await one('SELECT COALESCE(SUM(points),0)::int AS n, COUNT(*) FILTER (WHERE points >= $1)::int AS eligible FROM customers', [s.loyalty.reward_threshold]);
  const movements = await q(`SELECT m.*, u.name AS customer_name, c.code FROM loyalty_movements m JOIN users u ON u.id=m.customer_id JOIN customers c ON c.user_id=u.id ORDER BY m.created_at DESC LIMIT 40`);
  const top = await q(`SELECT u.id, u.name, c.code, c.points FROM customers c JOIN users u ON u.id=c.user_id ORDER BY c.points DESC LIMIT 10`);
  res.json({ settings: s.loyalty, totals, balance: balance.n, eligible: balance.eligible, movements, top });
}));

// ---------------------------------------------------------------- Impostazioni
r.get('/settings', ah(async (req, res) => res.json(await getSettings())));
r.put('/settings/:key', adminOnly, ah(async (req, res) => {
  if (!['service', 'delivery', 'loyalty'].includes(req.params.key)) throw httpError(400, 'Impostazione non valida');
  await setSetting(req.params.key, req.body);
  await logActivity(req.user.id, 'settings', req.params.key);
  res.json(await getSettings());
}));

r.get('/staff', adminOnly, ah(async (req, res) => {
  res.json(await q(`SELECT id, name, email, phone, role, active, created_at FROM users WHERE role IN ('admin','operator') ORDER BY role, name`));
}));
r.post('/staff', adminOnly, ah(async (req, res) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !['admin', 'operator'].includes(role)) throw httpError(400, 'Dati non validi');
  const u = await one(`INSERT INTO users(role,name,email,password_hash) VALUES ($1,$2,$3,$4) RETURNING id`, [role, name, email.toLowerCase(), hashPassword(password || 'demo1234')]);
  res.json(u);
}));
r.get('/activity', adminOnly, ah(async (req, res) => {
  res.json(await q(`SELECT a.*, u.name AS user_name FROM activity_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100`));
}));

export { r as adminRoutes };

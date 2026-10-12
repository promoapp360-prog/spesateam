import { Router } from 'express';
import { q, one } from '../db.js';
import { ah } from '../util.js';
import { requireAuth } from '../auth.js';
import { STATUS_LABELS } from '../util.js';

// Statistiche: accessibili solo agli amministratori
const r = Router();
r.use(requireAuth('admin'));

function period(req) {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  const store = req.query.store_id ? Number(req.query.store_id) : null;
  return { days, store };
}

r.get('/', ah(async (req, res) => {
  const { days, store } = period(req);
  const P = [days, store];
  const W = `o.created_at >= CURRENT_DATE - ($1::int - 1) AND ($2::int IS NULL OR o.store_id=$2)`;
  const Wprev = `o.created_at >= CURRENT_DATE - ($1::int*2 - 1) AND o.created_at < CURRENT_DATE - ($1::int - 1) AND ($2::int IS NULL OR o.store_id=$2)`;
  const kpiSql = (w) => `
    SELECT COUNT(*) FILTER (WHERE status='delivered')::int AS orders,
           COALESCE(SUM(total) FILTER (WHERE status='delivered'),0) AS revenue,
           COALESCE(AVG(total) FILTER (WHERE status='delivered'),0) AS avg_ticket,
           COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
           COUNT(*)::int AS all_orders,
           COUNT(DISTINCT customer_id) FILTER (WHERE status='delivered')::int AS customers,
           COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60) FILTER (WHERE status='delivered'),0) AS avg_minutes,
           COALESCE(SUM(delivery_fee) FILTER (WHERE status='delivered'),0) AS delivery_fees,
           COALESCE(SUM(coupon_discount + promo_discount + points_discount) FILTER (WHERE status='delivered'),0) AS discounts,
           COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL),0) AS avg_rating
      FROM orders o WHERE ${w}`;
  const kpi = await one(kpiSql(W), P);
  const prev = await one(kpiSql(Wprev), P);
  const newCustomers = await one(`
    SELECT COUNT(*)::int AS n FROM (
      SELECT customer_id, MIN(created_at) AS first FROM orders WHERE status='delivered' GROUP BY customer_id
    ) f WHERE f.first >= CURRENT_DATE - ($1::int - 1)`, [days]);
  const returning = await one(`
    SELECT COUNT(*) FILTER (WHERE n > 1)::int AS returning, COUNT(*)::int AS total FROM (
      SELECT customer_id, COUNT(*) AS n FROM orders o WHERE status='delivered' AND ${W} GROUP BY customer_id) x`, P);

  const daily = await q(`
    SELECT d::date AS day,
           COALESCE(COUNT(o.id) FILTER (WHERE o.status='delivered'),0)::int AS orders,
           COALESCE(SUM(o.total) FILTER (WHERE o.status='delivered'),0) AS revenue
      FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') d
      LEFT JOIN orders o ON DATE(o.created_at)=d::date AND ($2::int IS NULL OR o.store_id=$2)
     GROUP BY 1 ORDER BY 1`, P);

  const byStore = await q(`
    SELECT s.name, s.color, COUNT(o.id)::int AS orders, COALESCE(SUM(o.total),0) AS revenue,
      COALESCE(ROUND(100.0 * (SELECT COUNT(*) FROM order_items i JOIN orders o2 ON o2.id=i.order_id WHERE o2.store_id=s.id AND i.status='missing' AND o2.created_at >= CURRENT_DATE - ($1::int - 1))
        / NULLIF((SELECT COUNT(*) FROM order_items i JOIN orders o2 ON o2.id=i.order_id WHERE o2.store_id=s.id AND o2.status='delivered' AND o2.created_at >= CURRENT_DATE - ($1::int - 1)),0), 1),0) AS missing_rate
      FROM stores s LEFT JOIN orders o ON o.store_id=s.id AND o.status='delivered' AND ${W}
     GROUP BY s.id ORDER BY revenue DESC`, P);

  const byCategory = await q(`
    SELECT c.name, c.icon, COALESCE(SUM(i.line_total),0) AS revenue, COUNT(i.id)::int AS lines
      FROM order_items i JOIN orders o ON o.id=i.order_id JOIN categories c ON c.id=i.category_id
     WHERE o.status='delivered' AND ${W} GROUP BY c.id ORDER BY revenue DESC`, P);

  const topProducts = await q(`
    SELECT i.name, i.emoji, COUNT(*)::int AS times, COALESCE(SUM(i.line_total),0) AS revenue
      FROM order_items i JOIN orders o ON o.id=i.order_id
     WHERE o.status='delivered' AND ${W} GROUP BY i.name, i.emoji ORDER BY times DESC LIMIT 10`, P);

  const neverSold = await q(`
    SELECT p.name, p.emoji, s.name AS store_name FROM products p JOIN stores s ON s.id=p.store_id
     WHERE p.available AND ($2::int IS NULL OR p.store_id=$2) AND NOT EXISTS (
       SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.created_at >= CURRENT_DATE - ($1::int - 1))
     ORDER BY s.id, p.name LIMIT 12`, P);

  const payments = await q(`
    SELECT payment_method AS method, COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS total
      FROM orders o WHERE status='delivered' AND ${W} GROUP BY 1 ORDER BY 2 DESC`, P);

  const heat = await q(`
    SELECT EXTRACT(ISODOW FROM created_at)::int AS dow, EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS n
      FROM orders o WHERE status<>'cancelled' AND ${W} GROUP BY 1,2`, P);

  const phases = await one(`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (accepted_at - created_at))/60),0) AS accept,
           COALESCE(AVG(EXTRACT(EPOCH FROM (delivering_at - shopping_at))/60),0) AS shopping,
           COALESCE(AVG(EXTRACT(EPOCH FROM (shopping_at - accepted_at))/60),0) AS to_store,
           COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - delivering_at))/60),0) AS delivery
      FROM orders o WHERE status='delivered' AND ${W}`, P);

  const drivers = await q(`
    SELECT u.name, COUNT(o.id)::int AS deliveries,
           COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.accepted_at))/60)),0) AS avg_minutes,
           COALESCE(ROUND(AVG(o.rating)::numeric,1),0) AS rating,
           COALESCE(SUM(o.cash_collected),0) AS cash
      FROM users u JOIN drivers d ON d.user_id=u.id
      LEFT JOIN orders o ON o.driver_id=u.id AND o.status='delivered' AND ${W}
     GROUP BY u.id ORDER BY deliveries DESC`, P);

  const coupons = await q(`
    SELECT coupon_code AS code, COUNT(*)::int AS uses, COALESCE(SUM(coupon_discount),0) AS discount, COALESCE(SUM(total),0) AS revenue
      FROM orders o WHERE coupon_code IS NOT NULL AND status='delivered' AND ${W} GROUP BY 1 ORDER BY 2 DESC`, P);

  const promos = await q(`
    SELECT i.promo_label AS label, COUNT(*)::int AS lines, COALESCE(SUM(i.line_discount),0) AS discount, COALESCE(SUM(i.line_total),0) AS revenue
      FROM order_items i JOIN orders o ON o.id=i.order_id
     WHERE i.promo_label IS NOT NULL AND o.status='delivered' AND ${W} GROUP BY 1 ORDER BY 2 DESC`, P);

  const loyalty = await one(`
    SELECT COALESCE(SUM(points) FILTER (WHERE points>0),0)::int AS issued, COALESCE(-SUM(points) FILTER (WHERE points<0),0)::int AS redeemed
      FROM loyalty_movements WHERE created_at >= CURRENT_DATE - ($1::int - 1)`, [days]);

  const inactive = await q(`
    SELECT u.id, u.name, c.code, MAX(o.created_at) AS last_order, COUNT(o.id)::int AS orders
      FROM users u JOIN customers c ON c.user_id=u.id JOIN orders o ON o.customer_id=u.id AND o.status='delivered'
     GROUP BY u.id, c.code HAVING MAX(o.created_at) < NOW() - interval '21 days'
     ORDER BY COUNT(o.id) DESC LIMIT 10`);

  const geo = await q(`SELECT lat, lng, total, street FROM orders o WHERE status='delivered' AND lat IS NOT NULL AND ${W} LIMIT 1000`, P);
  const streets = await q(`
    SELECT street, cap, COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS revenue
      FROM orders o WHERE status='delivered' AND ${W} GROUP BY street, cap ORDER BY orders DESC LIMIT 10`, P);

  res.json({
    days, store, kpi, prev,
    new_customers: newCustomers.n,
    returning_rate: returning.total ? returning.returning / returning.total : 0,
    daily, byStore, byCategory, topProducts, neverSold, payments, heat, phases, drivers, coupons, promos, loyalty, inactive, geo, streets,
  });
}));

r.get('/export.csv', ah(async (req, res) => {
  const { days, store } = period(req);
  const rows = await q(`
    SELECT o.code, o.created_at, o.status, s.name AS store, u.name AS customer, c.code AS customer_code, du.name AS driver,
           o.street, o.civic, o.cap, o.slot_date, o.slot_label, o.payment_method, o.items_total, o.promo_discount, o.coupon_code,
           o.coupon_discount, o.points_discount, o.delivery_fee, o.total, o.points_earned, o.delivered_at
      FROM orders o JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=o.customer_id LEFT JOIN customers c ON c.user_id=u.id
      LEFT JOIN users du ON du.id=o.driver_id
     WHERE o.created_at >= CURRENT_DATE - ($1::int - 1) AND ($2::int IS NULL OR o.store_id=$2)
     ORDER BY o.created_at`, [days, store]);
  const headers = ['Codice', 'Data', 'Stato', 'Supermercato', 'Cliente', 'Codice cliente', 'Driver', 'Via', 'Civico', 'CAP', 'Data consegna', 'Fascia',
    'Pagamento', 'Totale prodotti', 'Sconto promo', 'Coupon', 'Sconto coupon', 'Sconto punti', 'Consegna', 'Totale', 'Punti', 'Consegnato il'];
  const pay = { card: 'Carta', paypal: 'PayPal', cash: 'Contanti' };
  const fmtN = (n) => (n == null ? '' : String(Number(n).toFixed(2)).replace('.', ','));
  const fmtD = (d) => (d ? new Date(d).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : '');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(';')];
  for (const o of rows) {
    lines.push([o.code, fmtD(o.created_at), STATUS_LABELS[o.status], o.store, o.customer, o.customer_code, o.driver, o.street, o.civic, o.cap,
      o.slot_date, o.slot_label, pay[o.payment_method], fmtN(o.items_total), fmtN(o.promo_discount), o.coupon_code, fmtN(o.coupon_discount),
      fmtN(o.points_discount), fmtN(o.delivery_fee), fmtN(o.total), o.points_earned, fmtD(o.delivered_at)].map(esc).join(';'));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="spesateam-ordini-${days}gg.csv"`);
  res.send('﻿' + lines.join('\r\n'));
}));

export { r as statsRoutes };

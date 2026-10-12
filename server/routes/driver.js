import { Router } from 'express';
import { q, one } from '../db.js';
import { ah, httpError } from '../util.js';
import { requireAuth } from '../auth.js';
import { advanceStatus } from '../orders.js';
import { orderDetail } from './customer.js';

const r = Router();
r.use(requireAuth('driver'));

r.get('/me', ah(async (req, res) => {
  const d = await one(
    `SELECT u.id, u.name, u.email, u.phone, d.* FROM users u JOIN drivers d ON d.user_id=u.id WHERE u.id=$1`, [req.user.id]
  );
  const today = await one(
    `SELECT COUNT(*) FILTER (WHERE status='delivered')::int AS delivered,
            COALESCE(SUM(cash_collected) FILTER (WHERE status='delivered'),0) AS cash,
            COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - accepted_at))/60) FILTER (WHERE status='delivered'),0) AS avg_minutes
       FROM orders WHERE driver_id=$1 AND DATE(COALESCE(delivered_at, created_at)) = CURRENT_DATE`, [req.user.id]
  );
  const month = await one(
    `SELECT COUNT(*)::int AS delivered FROM orders WHERE driver_id=$1 AND status='delivered'
        AND DATE_TRUNC('month', delivered_at) = DATE_TRUNC('month', NOW())`, [req.user.id]
  );
  res.json({ ...d, today, month });
}));

r.post('/status', ah(async (req, res) => {
  const { status } = req.body;
  if (!['offline', 'available', 'busy'].includes(status)) throw httpError(400, 'Stato non valido');
  await q('UPDATE drivers SET status=$1 WHERE user_id=$2', [status, req.user.id]);
  res.json({ ok: true });
}));

r.post('/position', ah(async (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (!isFinite(lat) || !isFinite(lng)) throw httpError(400, 'Posizione non valida');
  await q('UPDATE drivers SET lat=$1, lng=$2, position_at=NOW() WHERE user_id=$3', [lat, lng, req.user.id]);
  res.json({ ok: true });
}));

r.get('/orders', ah(async (req, res) => {
  const rows = await q(
    `SELECT o.id, o.code, o.status, o.total, o.payment_method, o.payment_status, o.slot_date, o.slot_label, o.created_at, o.delivered_at,
            o.street, o.civic, o.cap, o.lat, o.lng,
            s.name AS store_name, s.address AS store_address, s.emoji AS store_emoji,
            u.name AS customer_name,
            (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id)::int AS items_count,
            (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id AND i.status<>'pending')::int AS items_done
       FROM orders o JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=o.customer_id
      WHERE o.driver_id=$1 AND (o.status IN ('accepted','shopping','delivering') OR (o.status='delivered' AND DATE(o.delivered_at)=CURRENT_DATE))
      ORDER BY CASE o.status WHEN 'delivering' THEN 0 WHEN 'shopping' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END, o.slot_date, o.slot_label`,
    [req.user.id]
  );
  res.json(rows);
}));

async function myOrder(req) {
  const o = await orderDetail(req.params.id);
  if (!o || o.driver_id !== req.user.id) throw httpError(404, 'Ordine non trovato');
  delete o.customer_email;
  return o;
}

r.get('/orders/:id', ah(async (req, res) => res.json(await myOrder(req))));

r.post('/orders/:id/items/:itemId', ah(async (req, res) => {
  const o = await myOrder(req);
  if (o.status !== 'shopping') throw httpError(400, 'Avvia prima la spesa');
  const { status, final_qty, note } = req.body;
  if (!['pending', 'picked', 'missing', 'substituted'].includes(status)) throw httpError(400, 'Stato non valido');
  const it = o.items.find((i) => i.id === Number(req.params.itemId));
  if (!it) throw httpError(404, 'Articolo non trovato');
  const fq = status === 'missing' ? 0 : status === 'pending' ? null : Number(final_qty ?? it.qty);
  await q('UPDATE order_items SET status=$1, final_qty=$2, note=COALESCE($3,note) WHERE id=$4', [status, fq, note || null, it.id]);
  res.json({ ok: true });
}));

r.post('/orders/:id/status', ah(async (req, res) => {
  const o = await myOrder(req);
  const { status, cash_collected, proof_note } = req.body;
  if (!['shopping', 'delivering', 'delivered'].includes(status)) throw httpError(400, 'Stato non valido');
  await advanceStatus(o.id, status, req.user.id, { cash_collected, proof_note });
  if (status === 'shopping' || status === 'delivering') await q(`UPDATE drivers SET status='busy' WHERE user_id=$1`, [req.user.id]);
  res.json(await myOrder(req));
}));

export { r as driverRoutes };

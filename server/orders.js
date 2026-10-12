// Logica condivisa del ciclo di vita dell'ordine
import { tx, getSettings } from './db.js';
import { recalcOrder, round2 } from './pricing.js';
import { httpError } from './util.js';

const NEXT = {
  received: ['accepted', 'cancelled'],
  accepted: ['shopping', 'cancelled'],
  shopping: ['delivering', 'cancelled'],
  delivering: ['delivered'],
  delivered: [],
  cancelled: [],
};
const TS = { accepted: 'accepted_at', shopping: 'shopping_at', delivering: 'delivering_at', delivered: 'delivered_at' };

export async function assignDriver(orderId, driverId, userId) {
  return tx(async (db) => {
    const o = await db.one('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    if (!o) throw httpError(404, 'Ordine non trovato');
    if (['delivered', 'cancelled'].includes(o.status)) throw httpError(400, 'Ordine già chiuso');
    const d = await db.one(`SELECT u.id, u.name FROM users u JOIN drivers d ON d.user_id=u.id WHERE u.id=$1 AND u.active`, [driverId]);
    if (!d) throw httpError(400, 'Driver non valido');
    const prev = o.driver_id;
    if (o.status === 'received') {
      await db.q(`UPDATE orders SET driver_id=$1, status='accepted', accepted_at=NOW() WHERE id=$2`, [driverId, orderId]);
      await db.q(`INSERT INTO order_events(order_id,status,note,user_id) VALUES ($1,'accepted',$2,$3)`, [orderId, `Assegnato a ${d.name}`, userId]);
    } else {
      await db.q(`UPDATE orders SET driver_id=$1 WHERE id=$2`, [driverId, orderId]);
      await db.q(`INSERT INTO order_events(order_id,status,note,user_id) VALUES ($1,$2,$3,$4)`, [orderId, o.status, `Riassegnato a ${d.name}`, userId]);
    }
    await db.q(`UPDATE drivers SET status='busy' WHERE user_id=$1 AND status<>'offline'`, [driverId]);
    if (prev && prev !== driverId) await freeDriverIfIdle(db, prev);
    return true;
  });
}

async function freeDriverIfIdle(db, driverId) {
  const n = await db.one(`SELECT COUNT(*)::int AS n FROM orders WHERE driver_id=$1 AND status IN ('accepted','shopping','delivering')`, [driverId]);
  if (n.n === 0) await db.q(`UPDATE drivers SET status='available' WHERE user_id=$1 AND status='busy'`, [driverId]);
}

export async function advanceStatus(orderId, status, userId, extra = {}) {
  const settings = await getSettings();
  return tx(async (db) => {
    const o = await db.one('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    if (!o) throw httpError(404, 'Ordine non trovato');
    if (!NEXT[o.status].includes(status)) throw httpError(400, `Passaggio non consentito: da "${o.status}" a "${status}"`);
    if (status === 'accepted' && !o.driver_id) throw httpError(400, 'Assegna prima un driver');

    if (status === 'delivering') {
      // completa la spesa: articoli non spuntati si considerano presi nella quantità ordinata
      await db.q(`UPDATE order_items SET status='picked', final_qty=COALESCE(final_qty, qty) WHERE order_id=$1 AND status='pending'`, [orderId]);
      await recalcOrder(db, orderId);
    }

    const ts = TS[status];
    await db.q(`UPDATE orders SET status=$1 ${ts ? `, ${ts}=NOW()` : ''} WHERE id=$2`, [status, orderId]);
    await db.q(`INSERT INTO order_events(order_id,status,note,user_id) VALUES ($1,$2,$3,$4)`, [orderId, status, extra.note || null, userId]);

    if (status === 'delivered') {
      const fresh = await db.one('SELECT * FROM orders WHERE id=$1', [orderId]);
      const payStatus = fresh.payment_method === 'cash' ? 'collected' : 'captured';
      const cash = fresh.payment_method === 'cash' ? round2(extra.cash_collected ?? fresh.total) : null;
      const goods = Math.max(0, Number(fresh.total) - Number(fresh.delivery_fee));
      const points = Math.floor(goods) * Number(settings.loyalty.points_per_euro || 0);
      await db.q(`UPDATE orders SET payment_status=$1, cash_collected=$2, proof_note=$3, points_earned=$4 WHERE id=$5`,
        [payStatus, cash, extra.proof_note || null, points, orderId]);
      if (points > 0) {
        await db.q('UPDATE customers SET points=points+$1 WHERE user_id=$2', [points, fresh.customer_id]);
        await db.q('INSERT INTO loyalty_movements(customer_id,order_id,points,reason) VALUES ($1,$2,$3,$4)',
          [fresh.customer_id, orderId, points, `Ordine ${fresh.code}`]);
      }
      if (fresh.driver_id) await freeDriverIfIdle(db, fresh.driver_id);
    }
    return true;
  });
}

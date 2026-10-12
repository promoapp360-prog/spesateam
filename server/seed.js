// Popola il database con dati dimostrativi alla prima accensione.
import bcrypt from 'bcryptjs';
import { one, tx, setSetting } from './db.js';
import { CATEGORIES, STORES, PRODUCTS, FIRST_NAMES, LAST_NAMES, STREETS } from './seed-data.js';
import { lineFor, round2 } from './pricing.js';

export const DEFAULT_SETTINGS = {
  service: {
    name: 'SpesaTeam',
    tagline: 'La spesa dei supermercati del quartiere, a casa tua',
    city: 'Casavatore',
    phone: '081 000 0000',
    email: 'info@spesateam.it',
    center: { lat: 40.8990, lng: 14.2785 },
  },
  delivery: {
    caps: ['80020'],
    delivery_fee: 3.9,
    free_delivery_threshold: 40,
    slots: ['09:00-11:00', '11:00-13:00', '15:00-17:00', '17:00-19:00', '19:00-21:00'],
    slot_capacity: 8,
    days_ahead: 3,
    weight_margin_pct: 10,
  },
  loyalty: {
    points_per_euro: 1,
    reward_threshold: 200,
    reward_value: 10,
    tiers: [
      { name: 'Base', min: 0 },
      { name: 'Silver', min: 500 },
      { name: 'Gold', min: 1500 },
    ],
  },
};

// Generatore pseudo-casuale riproducibile
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261012);
const rand = (a, b) => a + R() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(R() * arr.length)];
function weighted(items, weightFn) {
  const total = items.reduce((s, i) => s + weightFn(i), 0);
  let r = R() * total;
  for (const i of items) { r -= weightFn(i); if (r <= 0) return i; }
  return items[items.length - 1];
}

const ZONE = { minLat: 40.8935, maxLat: 40.9045, minLng: 14.2690, maxLng: 14.2880 };
const randPos = () => ({ lat: rand(ZONE.minLat, ZONE.maxLat), lng: rand(ZONE.minLng, ZONE.maxLng) });

export async function seedIfEmpty() {
  const c = await one('SELECT COUNT(*)::int AS n FROM users');
  if (c.n > 0) return false;
  console.log('🌱 Database vuoto: carico i dati dimostrativi...');
  await seed();
  console.log('✅ Dati dimostrativi caricati.');
  return true;
}

async function seed() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) await setSetting(k, v);
  const settings = { ...DEFAULT_SETTINGS.delivery, ...DEFAULT_SETTINGS.loyalty };
  const hash = bcrypt.hashSync('demo1234', 8);

  await tx(async (db) => {
    // Reparti
    const catId = {};
    let sort = 1;
    for (const [key, name, icon] of CATEGORIES) {
      const r = await db.one('INSERT INTO categories(name, icon, sort) VALUES ($1,$2,$3) RETURNING id', [name, icon, sort++]);
      catId[key] = r.id;
    }

    // Supermercati e prodotti
    const stores = [];
    for (const s of STORES) {
      const r = await db.one(
        `INSERT INTO stores(name,address,phone,lat,lng,hours,min_order,prep_minutes,color,emoji)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [s.name, s.address, s.phone, s.lat, s.lng, s.hours, s.min_order, s.prep_minutes, s.color, s.emoji]
      );
      stores.push(r);
      for (const [cat, name, brand, size, price, unit, emoji, flags, step] of PRODUCTS) {
        if (s.onlyCats && !s.onlyCats.includes(cat)) continue;
        let p = round2(price * s.priceFactor);
        if (s.priceFactor !== 1) p = Math.max(0.49, Math.round(p * 10) / 10 - 0.01);
        const isBio = flags.includes('b') || (!!s.onlyCats && R() < 0.6);
        await db.q(
          `INSERT INTO products(store_id,category_id,name,brand,size,price,unit,step,emoji,is_bio,gluten_free,available,popularity,vat)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [r.id, catId[cat], name, brand, size, round2(p), unit, unit === 'kg' ? (step || 0.5) : 1, emoji,
            isBio, flags.includes('g'), R() > 0.03, randInt(1, 100),
            ['casa', 'persona', 'animali', 'vini', 'infanzia'].includes(cat) ? 22 : (['ortofrutta', 'pane', 'latticini', 'pasta'].includes(cat) ? 4 : 10)]
        );
      }
    }
    const allProducts = await db.q('SELECT * FROM products WHERE available = TRUE');

    // Utenti staff
    await db.q(`INSERT INTO users(role,name,email,phone,password_hash) VALUES ('admin','Amministratore','admin@spesateam.it','081 000 0010',$1)`, [hash]);
    await db.q(`INSERT INTO users(role,name,email,phone,password_hash) VALUES ('operator','Operatore Sala','operatore@spesateam.it','081 000 0011',$1)`, [hash]);

    const driverDefs = [
      ['Luca Ferrante', 'Scooter elettrico', 'AB 123 CD', 'Casavatore'],
      ['Mario Volpe', 'Scooter 125', 'EF 456 GH', 'Casavatore'],
      ['Enzo Liguori', 'Auto (Panda)', 'GH 789 IJ', 'Casavatore'],
      ['Sara Napolitano', 'Scooter elettrico', 'KL 012 MN', 'Casavatore'],
    ];
    const drivers = [];
    for (let i = 0; i < driverDefs.length; i++) {
      const [name, vehicle, plate, zone] = driverDefs[i];
      const u = await db.one(
        `INSERT INTO users(role,name,email,phone,password_hash) VALUES ('driver',$1,$2,$3,$4) RETURNING id`,
        [name, `driver${i + 1}@spesateam.it`, `333 000 00${10 + i}`, hash]
      );
      const pos = randPos();
      await db.q(
        `INSERT INTO drivers(user_id,vehicle,plate,zone,status,lat,lng,position_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [u.id, vehicle, plate, zone, i < 3 ? 'available' : 'offline', pos.lat, pos.lng]
      );
      drivers.push(u.id);
    }

    // Clienti
    const customers = [];
    const mkCustomer = async (name, email, idx, street, cap) => {
      const u = await db.one(
        `INSERT INTO users(role,name,email,phone,password_hash,created_at) VALUES ('customer',$1,$2,$3,$4, NOW() - ($5 || ' days')::interval) RETURNING id`,
        [name, email, `3${randInt(20, 49)} ${randInt(100, 999)} ${randInt(1000, 9999)}`, hash, String(randInt(5, 60))]
      );
      await db.q('INSERT INTO customers(user_id,code,marketing_consent) VALUES ($1,$2,$3)', [u.id, 'ST' + String(idx).padStart(5, '0'), R() > 0.35]);
      const pos = randPos();
      const a = await db.one(
        `INSERT INTO addresses(user_id,label,street,civic,cap,city,intercom,floor,lat,lng) VALUES ($1,'Casa',$2,$3,$4,'Casavatore',$5,$6,$7,$8) RETURNING *`,
        [u.id, street, String(randInt(1, 140)), cap, name.split(' ').slice(-1)[0], String(randInt(0, 6)), pos.lat, pos.lng]
      );
      const c = { id: u.id, name, address: a, freq: R() < 0.25 ? 6 : R() < 0.6 ? 2 : 1 };
      customers.push(c);
      return c;
    };
    const demoCustomer = await mkCustomer('Cliente Demo', 'cliente@spesateam.it', 1, 'Via Roma', '80020');
    demoCustomer.freq = 3;
    const usedEmails = new Set();
    for (let i = 2; i <= 45; i++) {
      const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
      let email = `${fn}.${ln}`.toLowerCase().replace(/[^a-z.]/g, '') + '@esempio.it';
      while (usedEmails.has(email)) email = email.replace('@', randInt(1, 99) + '@');
      usedEmails.add(email);
      const [street, cap] = pick(STREETS);
      await mkCustomer(`${fn} ${ln}`, email, i, street, cap);
    }

    // Promozioni e coupon
    const today = new Date();
    const d = (days) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
    await db.q(`INSERT INTO promotions(name,type,value,scope,target_id,starts_at,ends_at) VALUES ('Settimana della colazione','percent',20,'category',$1,$2,$3)`, [catId.colazione, d(-10), d(10)]);
    const passata = allProducts.find((p) => p.name === 'Passata di pomodoro' && p.store_id === stores[0].id);
    await db.q(`INSERT INTO promotions(name,type,value,scope,target_id,starts_at,ends_at) VALUES ('Passata in offerta','fixed',0.30,'product',$1,$2,$3)`, [passata.id, d(-5), d(20)]);
    await db.q(`INSERT INTO promotions(name,type,value,buy_qty,pay_qty,scope,target_id,starts_at,ends_at) VALUES ('Pasta 3x2','x_for_y',0,3,2,'category',$1,$2,$3)`, [catId.pasta, d(-3), d(14)]);
    await db.q(`INSERT INTO promotions(name,type,value,scope,target_id,starts_at,ends_at) VALUES ('Mozzarella del weekend','percent',15,'product',$1,$2,$3)`,
      [allProducts.find((p) => p.name === 'Mozzarella di bufala' && p.store_id === stores[0].id).id, d(-1), d(6)]);
    await db.q(`INSERT INTO promotions(name,type,value,scope,target_id,starts_at,ends_at,active) VALUES ('Black Friday (bozza)','percent',25,'all',NULL,$1,$2,FALSE)`, [d(40), d(43)]);

    await db.q(`INSERT INTO coupons(code,description,type,value,min_spend,max_uses,max_uses_per_customer,first_order_only,expires_at)
      VALUES ('BENVENUTO10','10% sul primo ordine','percent',10,20,NULL,1,TRUE,$1)`, [d(90)]);
    await db.q(`INSERT INTO coupons(code,description,type,value,min_spend,max_uses,max_uses_per_customer,expires_at)
      VALUES ('SPESA5','5 € di sconto con spesa minima 40 €','fixed',5,40,500,3,$1)`, [d(30)]);
    await db.q(`INSERT INTO coupons(code,description,type,value,min_spend,max_uses,max_uses_per_customer,expires_at)
      VALUES ('CONSEGNAGRATIS','Consegna gratuita','free_delivery',0,15,200,1,$1)`, [d(15)]);

    // Ordini storici (ultimi 45 giorni)
    const promos = await db.q('SELECT * FROM promotions WHERE active = TRUE');
    const productsByStore = {};
    for (const p of allProducts) (productsByStore[p.store_id] ||= []).push(p);
    let seq = 1;
    const now = Date.now();
    const DAYS = 70;
    const slotFor = (h) => settings.slots.find((s) => parseInt(s, 10) >= h + 1) || settings.slots[settings.slots.length - 1];

    async function createOrder({ customer, store, created, status, driverId, payment, extra = {} }) {
      const pool = productsByStore[store.id];
      const n = randInt(4, 13);
      const chosen = new Map();
      while (chosen.size < Math.min(n, pool.length)) {
        const p = weighted(pool, (x) => x.popularity + 10);
        chosen.set(p.id, p);
      }
      const lines = [...chosen.values()].map((p) => {
        const qty = p.unit === 'kg' ? round2(Number(p.step) * randInt(1, 4)) : (R() < 0.15 ? 3 : randInt(1, 2));
        return { p, ...lineFor(p, qty, promos) };
      });
      const items_total = round2(lines.reduce((s, l) => s + l.list_price * l.qty, 0));
      const promo_discount = round2(lines.reduce((s, l) => s + l.line_discount, 0));
      const net = round2(items_total - promo_discount);
      let coupon_code = null, coupon_discount = 0;
      let delivery_fee = net >= settings.free_delivery_threshold ? 0 : settings.delivery_fee;
      if (net >= 40 && R() < 0.1) { coupon_code = 'SPESA5'; coupon_discount = 5; }
      const total = round2(net - coupon_discount + delivery_fee);
      const points = Math.floor(net - coupon_discount) * settings.points_per_euro;
      const t0 = created.getTime();
      const tAcc = new Date(t0 + randInt(3, 15) * 60000);
      const tShop = new Date(tAcc.getTime() + randInt(10, 40) * 60000);
      const tDel = new Date(tShop.getTime() + randInt(20, 45) * 60000);
      const tDone = new Date(tDel.getTime() + randInt(8, 25) * 60000);
      const reached = ['received', 'accepted', 'shopping', 'delivering', 'delivered'].indexOf(status);
      const a = customer.address;
      const code = `ST-${String(1000 + seq++)}`;
      const payStatus = status === 'cancelled' ? (payment === 'cash' ? 'pending' : 'refunded')
        : status === 'delivered' ? (payment === 'cash' ? 'collected' : 'captured')
          : (payment === 'cash' ? 'pending' : 'authorized');
      const o = await db.one(
        `INSERT INTO orders(code,customer_id,store_id,driver_id,status,street,civic,cap,city,intercom,floor,lat,lng,
          slot_date,slot_label,payment_method,payment_status,items_total,promo_discount,coupon_code,coupon_discount,
          delivery_fee,estimated_total,total,points_earned,cash_collected,created_at,accepted_at,shopping_at,delivering_at,delivered_at,cancelled_at,rating)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Casavatore',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32) RETURNING id`,
        [code, customer.id, store.id, reached >= 1 || status === 'delivered' ? driverId : null, status,
          a.street, a.civic, a.cap, a.intercom, a.floor, a.lat, a.lng,
          created.toISOString().slice(0, 10), slotFor(created.getHours()), payment, payStatus,
          items_total, promo_discount, coupon_code, coupon_discount, delivery_fee, total, total,
          status === 'delivered' ? points : 0,
          status === 'delivered' && payment === 'cash' ? total : null,
          created, reached >= 1 ? tAcc : null, reached >= 2 ? tShop : null, reached >= 3 ? tDel : null,
          status === 'delivered' ? tDone : null, status === 'cancelled' ? tAcc : null,
          status === 'delivered' && R() < 0.6 ? randInt(4, 5) : null]
      );
      const vals = [];
      const params = [];
      lines.forEach((l, i) => {
        let st = 'pending';
        let fq = null;
        if (status === 'delivered' || status === 'delivering') {
          st = R() < 0.04 ? 'missing' : 'picked';
          fq = l.p.unit === 'kg' ? round2(l.qty * rand(0.93, 1.07)) : l.qty;
        } else if (status === 'shopping' && i < lines.length / 2) {
          st = 'picked'; fq = l.qty;
        }
        const base = params.length;
        vals.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14})`);
        params.push(o.id, l.p.id, l.p.name, l.p.emoji, l.p.category_id, l.p.unit, l.list_price, l.unit_price, l.qty, fq,
          l.promo_label, l.line_discount, l.line_total, st);
      });
      await db.q(
        `INSERT INTO order_items(order_id,product_id,name,emoji,category_id,unit,list_price,unit_price,qty,final_qty,promo_label,line_discount,line_total,status) VALUES ${vals.join(',')}`,
        params
      );
      const ev = [['received', created]];
      if (status === 'cancelled') ev.push(['cancelled', tAcc]);
      else {
        if (reached >= 1) ev.push(['accepted', tAcc]);
        if (reached >= 2) ev.push(['shopping', tShop]);
        if (reached >= 3) ev.push(['delivering', tDel]);
        if (reached >= 4) ev.push(['delivered', tDone]);
      }
      for (const [s, t] of ev) await db.q('INSERT INTO order_events(order_id,status,created_at) VALUES ($1,$2,$3)', [o.id, s, t]);
      if (status === 'delivered' && points > 0) {
        await db.q('INSERT INTO loyalty_movements(customer_id,order_id,points,reason,created_at) VALUES ($1,$2,$3,$4,$5)',
          [customer.id, o.id, points, `Ordine ${code}`, tDone]);
      }
      if (coupon_code) await db.q('UPDATE coupons SET used = used + 1 WHERE code=$1', [coupon_code]);
      return o.id;
    }

    for (let day = DAYS; day >= 1; day--) {
      const date = new Date(now - day * 86400000);
      const dow = date.getDay();
      const trend = 1 + (DAYS - day) / DAYS * 0.9;
      const base = dow === 0 ? 2 : dow === 5 || dow === 6 ? 7 : 4.5;
      const count = Math.max(1, Math.round(base * trend + rand(-1.5, 1.5)));
      for (let k = 0; k < count; k++) {
        const hour = weighted([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], (h) => ([10, 11, 17, 18].includes(h) ? 3 : [9, 12, 16, 19].includes(h) ? 2 : 1));
        const created = new Date(date);
        created.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
        const customer = weighted(customers, (c) => c.freq);
        const store = weighted(stores, (s) => (s.id === stores[0].id ? 55 : s.id === stores[1].id ? 30 : 15));
        const payment = weighted(['card', 'paypal', 'cash'], (p) => ({ card: 50, paypal: 20, cash: 30 }[p]));
        await createOrder({
          customer, store, created, payment,
          status: R() < 0.04 ? 'cancelled' : 'delivered',
          driverId: weighted(drivers, (id, i) => 1),
        });
      }
    }

    // Ordini di oggi in corso (per la demo)
    const minutesAgo = (m) => new Date(now - m * 60000);
    await createOrder({ customer: pick(customers.slice(1)), store: stores[0], created: minutesAgo(4), status: 'received', payment: 'card' });
    await createOrder({ customer: pick(customers.slice(1)), store: stores[1], created: minutesAgo(9), status: 'received', payment: 'cash' });
    await createOrder({ customer: pick(customers.slice(1)), store: stores[0], created: minutesAgo(22), status: 'accepted', payment: 'paypal', driverId: drivers[0] });
    await createOrder({ customer: pick(customers.slice(1)), store: stores[1], created: minutesAgo(48), status: 'shopping', payment: 'cash', driverId: drivers[0] });
    const deliveringId = await createOrder({ customer: demoCustomer, store: stores[0], created: minutesAgo(70), status: 'delivering', payment: 'card', driverId: drivers[1] });
    // posizione del driver in consegna: a metà strada tra supermercato e cliente
    const s0 = stores[0];
    const da = demoCustomer.address;
    await db.q(`UPDATE drivers SET status='busy', lat=$1, lng=$2, position_at=NOW() WHERE user_id=$3`,
      [s0.lat + (da.lat - s0.lat) * 0.55, s0.lng + (da.lng - s0.lng) * 0.55, drivers[1]]);
    await db.q(`UPDATE drivers SET status='busy' WHERE user_id=$1`, [drivers[0]]);
    void deliveringId;

    // Punti fedeltà dei clienti = somma dei movimenti
    await db.q(`UPDATE customers c SET points = COALESCE((SELECT SUM(points) FROM loyalty_movements m WHERE m.customer_id = c.user_id),0)`);
    // Premio già riscattato da un paio di clienti, per mostrare i movimenti
    const top = await db.q(`SELECT user_id FROM customers WHERE points >= 300 ORDER BY points DESC LIMIT 2`);
    for (const t of top) {
      await db.q(`INSERT INTO loyalty_movements(customer_id,points,reason,created_at) VALUES ($1,-200,'Premio riscattato: buono 10 €', NOW() - interval '6 days')`, [t.user_id]);
      await db.q(`UPDATE customers SET points = points - 200 WHERE user_id=$1`, [t.user_id]);
    }
    // Popolarità prodotti in base alle vendite
    await db.q(`UPDATE products p SET popularity = COALESCE((SELECT COUNT(*) FROM order_items i WHERE i.product_id = p.id),0)`);
  });
}

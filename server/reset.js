// Azzera il database e ricarica i dati dimostrativi: npm run reset-db
process.env.TZ = process.env.TZ || 'Europe/Rome';
import { pool, migrate } from './db.js';
import { seedIfEmpty } from './seed.js';

const tables = ['activity_log', 'loyalty_movements', 'order_events', 'order_items', 'orders', 'coupons', 'promotions', 'price_history',
  'products', 'categories', 'stores', 'drivers', 'addresses', 'customers', 'users', 'settings'];

try {
  await pool.query(`DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE`);
  await migrate();
  await seedIfEmpty();
  console.log('Database azzerato e ripopolato.');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await pool.end();
}

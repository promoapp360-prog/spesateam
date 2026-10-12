process.env.TZ = process.env.TZ || 'Europe/Rome';

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from './db.js';
import { seedIfEmpty } from './seed.js';
import { publicRoutes, authRoutes } from './routes/public.js';
import { customerRoutes } from './routes/customer.js';
import { driverRoutes } from './routes/driver.js';
import { adminRoutes } from './routes/admin.js';
import { statsRoutes } from './routes/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'SpesaTeam' }));
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Risorsa non trovata' }));

// Interfaccia web (compilata con "npm run build")
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('*', (req, res) => res.status(503).send('Interfaccia non ancora compilata: esegui "npm run build".'));
}

// Gestione errori
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Errore del server, riprova tra poco' : err.message });
});

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await migrate();
    await seedIfEmpty();
  } catch (e) {
    console.error('❌ Impossibile preparare il database:', e.message);
    console.error('   Controlla che il database PostgreSQL sia attivo e che DATABASE_URL sia impostata.');
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`🛒 SpesaTeam attivo sulla porta ${PORT}`));
}

start();

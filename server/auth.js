import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { one, q } from './db.js';

const SECRET = process.env.JWT_SECRET || 'spesateam-demo-secret-cambiami';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET non impostato: uso una chiave di prova. Impostalo nei Secrets di Replit prima del lancio.');
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '30d' });
}

export function requireAuth(...roles) {
  return async (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Accesso richiesto' });
    try {
      const payload = jwt.verify(token, SECRET);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Non hai i permessi per questa operazione' });
      }
      const u = await one('SELECT id, role, name, email, phone, active FROM users WHERE id=$1', [payload.id]);
      if (!u || !u.active) return res.status(401).json({ error: 'Utente non attivo' });
      req.user = u;
      next();
    } catch {
      return res.status(401).json({ error: 'Sessione scaduta, accedi di nuovo' });
    }
  };
}

const AREA_ROLES = {
  customer: ['customer'],
  driver: ['driver'],
  admin: ['admin', 'operator'],
};

export async function login(email, password, area) {
  const u = await one('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [String(email || '').trim()]);
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    throw Object.assign(new Error('Email o password non corretti'), { status: 401 });
  }
  if (!u.active) throw Object.assign(new Error('Account disattivato'), { status: 403 });
  if (area && AREA_ROLES[area] && !AREA_ROLES[area].includes(u.role)) {
    throw Object.assign(new Error('Questo account non può accedere a quest\'area'), { status: 403 });
  }
  return { token: signToken(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } };
}

export const hashPassword = (p) => bcrypt.hashSync(p, 10);

export async function logActivity(userId, action, detail) {
  try {
    await q('INSERT INTO activity_log(user_id, action, detail) VALUES ($1,$2,$3)', [userId, action, detail]);
  } catch { /* non bloccante */ }
}

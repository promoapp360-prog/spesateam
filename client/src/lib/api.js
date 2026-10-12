// Client per le API del server. Ogni area (cliente, driver, backoffice) ha una sessione separata,
// così nella demo si può essere collegati contemporaneamente come cliente, driver e amministratore.
const KEYS = { customer: 'st_session_customer', driver: 'st_session_driver', admin: 'st_session_admin' };

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export function getSession(area) {
  try {
    const raw = storage()?.getItem(KEYS[area]);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSession(area, data) {
  try {
    if (data) storage()?.setItem(KEYS[area], JSON.stringify(data));
    else storage()?.removeItem(KEYS[area]);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('st-session', { detail: { area } }));
}

function areaFor(path) {
  if (path.startsWith('/customer')) return 'customer';
  if (path.startsWith('/driver')) return 'driver';
  if (path.startsWith('/admin')) return 'admin';
  return null;
}

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const area = areaFor(path);
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const s = area ? getSession(area) : null;
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (raw) {
    if (!res.ok) throw new Error('Download non riuscito');
    return res;
  }
  let data = null;
  try { data = await res.json(); } catch { /* risposta vuota */ }
  if (!res.ok) {
    if (res.status === 401 && area) setSession(area, null);
    const err = new Error(data?.error || 'Si è verificato un errore');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: 'POST', body });
export const put = (p, body = {}) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });

export async function login(area, email, password) {
  const data = await post('/auth/login', { email, password, area });
  setSession(area, data);
  return data;
}

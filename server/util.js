// Utility comuni alle rotte
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Coordinate approssimate per un indirizzo (demo): posizione stabile all'interno della zona servita.
// In produzione si userà il servizio di geocoding di Google Maps.
export function approxGeocode(street = '', civic = '', center = { lat: 40.8990, lng: 14.2785 }) {
  const s = `${street} ${civic}`.toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const a = ((h >>> 0) % 10000) / 10000;
  const b = (((h >>> 0) / 10000) % 10000) / 10000;
  return { lat: center.lat - 0.005 + a * 0.010, lng: center.lng - 0.008 + b * 0.016 };
}

export function tierFor(points, tiers = []) {
  let t = tiers[0] || { name: 'Base', min: 0 };
  for (const x of tiers) if (points >= x.min) t = x;
  const next = tiers.find((x) => x.min > points) || null;
  return { current: t.name, next: next ? next.name : null, next_min: next ? next.min : null };
}

export const STATUS_LABELS = {
  received: 'Ricevuto',
  accepted: 'Accettato',
  shopping: 'In spesa',
  delivering: 'In consegna',
  delivered: 'Consegnato',
  cancelled: 'Annullato',
};

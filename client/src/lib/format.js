export const eur = (n) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));

export const num = (n, d = 0) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: d, minimumFractionDigits: d }).format(Number(n || 0));

export function qtyLabel(qty, unit) {
  const q = Number(qty);
  if (unit === 'kg') {
    if (q < 1) return `${Math.round(q * 1000)} g`;
    return `${num(q, q % 1 ? 2 : 0)} kg`;
  }
  return `${num(q)} pz`;
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
export const fmtDateShort = (d) => (d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDateTime = (d) => (d ? `${fmtDateShort(d)} ${fmtTime(d)}` : '');

export function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t0) / 86400000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function minutesAgo(d) {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h fa`;
  return fmtDateShort(d);
}

export const STATUS = {
  received: { label: 'Ricevuto', color: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  accepted: { label: 'Accettato', color: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
  shopping: { label: 'In spesa', color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  delivering: { label: 'In consegna', color: 'bg-accent-100 text-accent-700', dot: 'bg-accent-500' },
  delivered: { label: 'Consegnato', color: 'bg-brand-100 text-brand-800', dot: 'bg-brand-600' },
  cancelled: { label: 'Annullato', color: 'bg-stone-200 text-stone-600', dot: 'bg-stone-400' },
};

export const PAYMENT = {
  card: { label: 'Carta', icon: '💳' },
  paypal: { label: 'PayPal', icon: '🅿️' },
  cash: { label: 'Contanti', icon: '💶' },
};

export const PAYMENT_STATUS = {
  pending: 'Da incassare',
  authorized: 'Autorizzato',
  captured: 'Addebitato',
  collected: 'Incassato',
  refunded: 'Rimborsato',
};

export const SUB_PREF = {
  substitute: 'Sostituisci con un prodotto simile',
  contact: 'Contattami',
  remove: 'Elimina dal mio ordine',
};

export const ITEM_STATUS = {
  pending: { label: 'Da prendere', color: 'bg-stone-100 text-stone-600' },
  picked: { label: 'Preso', color: 'bg-brand-100 text-brand-800' },
  missing: { label: 'Mancante', color: 'bg-red-100 text-red-700' },
  substituted: { label: 'Sostituito', color: 'bg-amber-100 text-amber-800' },
};

export function unitPriceLabel(p) {
  if (p.unit === 'kg') return `${eur(p.promo?.unit_price ?? p.price)}/kg`;
  return null;
}

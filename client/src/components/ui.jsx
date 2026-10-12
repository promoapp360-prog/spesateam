import { useEffect, useState } from 'react';
import { X, LoaderCircle } from 'lucide-react';
import { STATUS } from '../lib/format.js';

export function cx(...a) { return a.filter(Boolean).join(' '); }

const BTN = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 shadow-sm',
  secondary: 'bg-white text-ink border border-stone-300 hover:bg-stone-50',
  ghost: 'text-ink hover:bg-stone-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
};
const SIZE = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-base' };

export function Button({ variant = 'primary', size = 'md', loading, className, children, icon: Icon, ...p }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        BTN[variant], SIZE[size], className)}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Card({ className, children, ...p }) {
  return <div {...p} className={cx('bg-white rounded-2xl border border-stone-200 shadow-sm', className)}>{children}</div>;
}

export function Badge({ className, children }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}>{children}</span>;
}

export function StatusBadge({ status, className }) {
  const s = STATUS[status] || STATUS.received;
  return (
    <Badge className={cx(s.color, className)}>
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </Badge>
  );
}

export function Spinner({ className }) {
  return <LoaderCircle className={cx('size-6 animate-spin text-brand-600', className)} />;
}

export function Loading({ label = 'Caricamento…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Empty({ icon = '🧺', title, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 text-stone-500">
      <div className="text-5xl mb-3">{icon}</div>
      <div className="font-semibold text-ink">{title}</div>
      {children && <div className="text-sm mt-1 max-w-sm">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error.message || String(error)}</div>;
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="block text-sm font-medium text-stone-700 mb-1">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-stone-500 mt-1">{hint}</span>}
    </label>
  );
}

const INPUT = 'h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-100';
const fullWidth = (c) => (/(^|\s)w-/.test(c || '') ? '' : 'w-full');
export function Input({ className, ...p }) { return <input {...p} className={cx(INPUT, fullWidth(className), className)} />; }
export function Select({ className, children, ...p }) { return <select {...p} className={cx(INPUT, 'pr-8', fullWidth(className), className)}>{children}</select>; }
export function Textarea({ className, ...p }) {
  return <textarea {...p} className={cx(INPUT, 'w-full h-auto py-2 min-h-20', className)} />;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm">
      <span className={cx('relative inline-block h-6 w-11 rounded-full transition', checked ? 'bg-brand-600' : 'bg-stone-300')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition', checked ? 'left-5' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cx('relative bg-white w-full rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col', w)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100" aria-label="Chiudi"><X className="size-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-stone-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 p-1 bg-stone-100 rounded-xl overflow-x-auto scrollbar-none', className)}>
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cx('px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition',
            value === t.value ? 'bg-white shadow-sm text-ink' : 'text-stone-500 hover:text-ink')}>
          {t.label}{t.count != null && <span className="ml-1.5 text-xs text-stone-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, icon, trend, className }) {
  return (
    <Card className={cx('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-stone-500">{label}</div>
        {icon && <div className="text-xl">{icon}</div>}
      </div>
      <div className="text-2xl font-bold mt-1 font-display">{value}</div>
      {(sub || trend != null) && (
        <div className="text-xs mt-1 flex items-center gap-2">
          {trend != null && isFinite(trend) && (
            <span className={trend >= 0 ? 'text-brand-700 font-semibold' : 'text-red-600 font-semibold'}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(0)}%
            </span>
          )}
          {sub && <span className="text-stone-500">{sub}</span>}
        </div>
      )}
    </Card>
  );
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-stone-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ProductThumb({ product, className, size = 'md' }) {
  const s = { sm: 'size-10 text-xl', md: 'size-14 text-3xl', lg: 'w-full aspect-square text-6xl' }[size];
  if (product?.image_url) {
    return <img src={product.image_url} alt={product.name} className={cx('object-cover rounded-xl bg-stone-100', s, className)} loading="lazy" />;
  }
  return (
    <div className={cx('flex items-center justify-center rounded-xl bg-linear-to-br from-brand-50 to-accent-50', s, className)}>
      <span>{product?.emoji || '🛒'}</span>
    </div>
  );
}

// ------------------------------------------------------------ Toast
export function toast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('st-toast', { detail: { message, type, id: Math.random() } }));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const h = (e) => {
      const t = e.detail;
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3200);
    };
    window.addEventListener('st-toast', h);
    return () => window.removeEventListener('st-toast', h);
  }, []);
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 items-center pointer-events-none">
      {items.map((t) => (
        <div key={t.id} className={cx('px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in',
          t.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-white')}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function Logo({ className, light }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-display font-bold text-xl', light ? 'text-white' : 'text-brand-700', className)}>
      <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-600 text-white text-base shadow-sm">🛒</span>
      <span>Spesa<span className={light ? 'text-accent-100' : 'text-accent-500'}>Team</span></span>
    </span>
  );
}

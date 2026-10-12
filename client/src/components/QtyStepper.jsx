import { Minus, Plus } from 'lucide-react';
import { qtyLabel } from '../lib/format.js';
import { cx } from './ui.jsx';

export default function QtyStepper({ product, qty, onChange, size = 'md' }) {
  const step = product.unit === 'kg' ? Number(product.step || 0.5) : 1;
  const h = size === 'sm' ? 'h-8' : 'h-10';
  const btn = cx('flex items-center justify-center rounded-lg hover:bg-brand-700 transition', size === 'sm' ? 'size-8' : 'size-10');
  return (
    <div className={cx('inline-flex items-center rounded-xl bg-brand-600 text-white', h)}>
      <button className={btn} onClick={() => onChange(Math.max(0, Math.round((qty - step) * 1000) / 1000))} aria-label="Diminuisci">
        <Minus className="size-4" />
      </button>
      <span className={cx('text-center font-semibold tabular-nums', size === 'sm' ? 'min-w-12 text-xs' : 'min-w-14 text-sm')}>
        {qtyLabel(qty, product.unit)}
      </span>
      <button className={btn} onClick={() => onChange(Math.round((qty + step) * 1000) / 1000)} aria-label="Aumenta">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

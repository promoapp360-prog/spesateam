// Componenti condivisi del backoffice
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, Field, Input, Select, Textarea, Toggle, Modal, ErrorBox, cx } from '../../components/ui.jsx';

export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-2xl', actions }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[900] flex justify-end">
      <div className="absolute inset-0 bg-black/30 animate-fade-in" onClick={onClose} />
      <aside className={cx('relative w-full h-full bg-stone-50 shadow-2xl flex flex-col animate-slide-in', width)}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 bg-white border-b border-stone-200">
          <div>
            <div className="font-semibold text-lg">{title}</div>
            {subtitle && <div className="text-sm text-stone-500">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100" aria-label="Chiudi"><X className="size-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  );
}

/**
 * Tabella semplice. columns: [{ key, label, render?, className?, align? }]
 */
export function Table({ columns, rows, onRowClick, empty = 'Nessun elemento', rowKey = 'id' }) {
  return (
    <div className="overflow-x-auto bg-white rounded-2xl border border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-stone-500 border-b border-stone-200 bg-stone-50/60">
            {columns.map((c) => <th key={c.key} className={cx('px-4 py-3 font-semibold whitespace-nowrap', c.align === 'right' && 'text-right', c.className)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-stone-500">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r[rowKey] ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cx(onRowClick && 'cursor-pointer hover:bg-brand-50/40')}>
              {columns.map((c) => (
                <td key={c.key} className={cx('px-4 py-3 align-middle', c.align === 'right' && 'text-right', c.className)}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Modale con form generato da una configurazione.
 * fields: [{ name, label, type: text|number|select|textarea|toggle|date|color, options?, required?, hint?, span? , show?(values) }]
 */
export function FormModal({ open, title, fields, initial, onClose, onSubmit, submitLabel = 'Salva', size = 'md' }) {
  const [values, setValues] = useState(initial || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setValues(initial || {}); setError(null); } }, [open, initial]);
  if (!open) return null;
  const set = (name, v) => setValues((x) => ({ ...x, [name]: v }));

  async function submit(e) {
    e?.preventDefault();
    setSaving(true); setError(null);
    try {
      const out = {};
      for (const f of fields) {
        if (f.show && !f.show(values)) continue;
        let v = values[f.name];
        if (f.type === 'number' && v !== '' && v != null) v = Number(v);
        if (f.type === 'toggle') v = !!v;
        out[f.name] = v === undefined ? (f.type === 'toggle' ? false : null) : v;
      }
      await onSubmit(out);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title} size={size}
      footer={<><Button variant="secondary" onClick={onClose}>Annulla</Button><Button onClick={submit} loading={saving}>{submitLabel}</Button></>}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        {fields.filter((f) => !f.show || f.show(values)).map((f) => {
          const v = values[f.name] ?? '';
          let input;
          if (f.type === 'select') {
            input = (
              <Select value={v} onChange={(e) => set(f.name, e.target.value === '' ? null : (f.numeric ? Number(e.target.value) : e.target.value))} required={f.required}>
                {!f.required && <option value="">—</option>}
                {f.required && v === '' && <option value="">Seleziona…</option>}
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            );
          } else if (f.type === 'textarea') input = <Textarea value={v} onChange={(e) => set(f.name, e.target.value)} />;
          else if (f.type === 'toggle') input = <div className="pt-1"><Toggle checked={!!values[f.name]} onChange={(x) => set(f.name, x)} label={f.toggleLabel} /></div>;
          else input = <Input type={f.type || 'text'} step={f.step} value={v ?? ''} onChange={(e) => set(f.name, e.target.value)} required={f.required} placeholder={f.placeholder} />;
          return <Field key={f.name} label={f.label} hint={f.hint} className={f.span === 1 ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>{input}</Field>;
        })}
        <div className="col-span-2"><ErrorBox error={error} /></div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function Pill({ active, children, onClick }) {
  return (
    <button onClick={onClick} className={cx('h-8 px-3 rounded-full text-sm whitespace-nowrap border transition',
      active ? 'bg-ink text-white border-ink' : 'bg-white border-stone-300 hover:border-stone-400')}>
      {children}
    </button>
  );
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

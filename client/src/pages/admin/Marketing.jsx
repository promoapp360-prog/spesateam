import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useFetch } from '../../lib/hooks.js';
import { post, put } from '../../lib/api.js';
import { eur, fmtDate } from '../../lib/format.js';
import { PageTitle, Button, Loading, Badge, Toggle, toast } from '../../components/ui.jsx';
import { Table, FormModal } from './kit.jsx';

const PROMO_TYPES = [
  { value: 'percent', label: 'Sconto percentuale (es. −20%)' },
  { value: 'fixed', label: 'Sconto in euro (es. −1 €)' },
  { value: 'x_for_y', label: 'Multi-acquisto (es. 3x2)' },
];
const SCOPES = [
  { value: 'product', label: 'Un prodotto' },
  { value: 'category', label: 'Un reparto' },
  { value: 'store', label: 'Un supermercato' },
  { value: 'all', label: 'Tutto il catalogo' },
];

export function Promotions() {
  const { data, loading, reload, setData } = useFetch('/admin/promotions-overview');
  const { data: cats } = useFetch('/admin/categories');
  const { data: stores } = useFetch('/admin/stores');
  const { data: products } = useFetch('/admin/products');
  const [edit, setEdit] = useState(null);

  const fields = useMemo(() => [
    { name: 'name', label: 'Nome della promozione', required: true, placeholder: 'es. Settimana della colazione' },
    { name: 'type', label: 'Tipo', type: 'select', required: true, options: PROMO_TYPES },
    { name: 'value', label: 'Valore', type: 'number', step: '0.01', span: 1, show: (v) => v.type !== 'x_for_y', hint: 'Percentuale o euro' },
    { name: 'buy_qty', label: 'Prendi (quantità)', type: 'number', span: 1, show: (v) => v.type === 'x_for_y' },
    { name: 'pay_qty', label: 'Paghi (quantità)', type: 'number', span: 1, show: (v) => v.type === 'x_for_y' },
    { name: 'scope', label: 'Si applica a', type: 'select', required: true, options: SCOPES },
    { name: 'target_id', label: 'Reparto', type: 'select', numeric: true, show: (v) => v.scope === 'category', options: (cats || []).map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })) },
    { name: 'target_id', label: 'Supermercato', type: 'select', numeric: true, show: (v) => v.scope === 'store', options: (stores || []).map((s) => ({ value: s.id, label: s.name })) },
    { name: 'target_id', label: 'Prodotto', type: 'select', numeric: true, show: (v) => v.scope === 'product', options: (products || []).map((p) => ({ value: p.id, label: `${p.name} ${p.size || ''} — ${p.store_name}` })) },
    { name: 'starts_at', label: 'Dal', type: 'date', span: 1 },
    { name: 'ends_at', label: 'Al', type: 'date', span: 1 },
    { name: 'active', label: 'Stato', type: 'toggle', toggleLabel: 'Attiva' },
  ], [cats, stores, products]);

  async function toggle(p) {
    await put(`/admin/promotions/${p.id}`, { active: !p.active });
    setData(data.map((x) => (x.id === p.id ? { ...x, active: !p.active, running: !p.active && x.running } : x)));
    reload();
  }

  return (
    <div>
      <PageTitle title="Promozioni" subtitle="Le offerte appaiono automaticamente nell'app con prezzo barrato e badge"
        actions={<Button icon={Plus} onClick={() => setEdit({ type: 'percent', scope: 'category', active: true, value: 10, buy_qty: 3, pay_qty: 2, starts_at: new Date().toISOString().slice(0, 10) })}>Nuova promozione</Button>} />
      {loading && !data ? <Loading /> : (
        <Table rows={data || []} onRowClick={(p) => setEdit({ ...p })} columns={[
          { key: 'label', label: '', render: (p) => <Badge className="bg-accent-500 text-white text-sm">{p.label}</Badge> },
          { key: 'name', label: 'Promozione', render: (p) => <div><div className="font-medium">{p.name}</div><div className="text-xs text-stone-500">{p.target}</div></div> },
          { key: 'dates', label: 'Periodo', render: (p) => <span className="text-xs">{p.starts_at ? fmtDate(p.starts_at) : '—'} → {p.ends_at ? fmtDate(p.ends_at) : 'senza scadenza'}</span> },
          { key: 'state', label: 'Stato', render: (p) => p.running ? <Badge className="bg-brand-50 text-brand-700">In corso</Badge> : p.active ? <Badge className="bg-sky-50 text-sky-700">Programmata / scaduta</Badge> : <Badge className="bg-stone-100 text-stone-500">Disattivata</Badge> },
          { key: 'active', label: 'Attiva', render: (p) => <span onClick={(e) => e.stopPropagation()}><Toggle checked={p.active} onChange={() => toggle(p)} /></span> },
        ]} />
      )}
      <FormModal open={!!edit} title={edit?.id ? 'Modifica promozione' : 'Nuova promozione'} fields={fields} initial={edit} onClose={() => setEdit(null)}
        onSubmit={async (v) => {
          if (v.scope === 'all') v.target_id = null;
          if (v.type === 'x_for_y') v.value = 0;
          if (edit.id) await put(`/admin/promotions/${edit.id}`, v); else await post('/admin/promotions', v);
          toast('Promozione salvata'); reload();
        }} />
    </div>
  );
}

const COUPON_TYPES = [
  { value: 'percent', label: 'Percentuale sul carrello' },
  { value: 'fixed', label: 'Importo fisso in euro' },
  { value: 'free_delivery', label: 'Consegna gratuita' },
];

export function Coupons() {
  const { data, loading, reload, setData } = useFetch('/admin/coupons');
  const { data: customers } = useFetch('/admin/customers');
  const [edit, setEdit] = useState(null);
  const fields = useMemo(() => [
    { name: 'code', label: 'Codice', required: true, span: 1, placeholder: 'es. ESTATE10' },
    { name: 'type', label: 'Tipo di sconto', type: 'select', required: true, span: 1, options: COUPON_TYPES },
    { name: 'value', label: 'Valore', type: 'number', step: '0.01', span: 1, show: (v) => v.type !== 'free_delivery', hint: '% oppure €' },
    { name: 'min_spend', label: 'Spesa minima (€)', type: 'number', step: '0.01', span: 1 },
    { name: 'description', label: 'Descrizione' },
    { name: 'max_uses', label: 'Utilizzi totali massimi', type: 'number', span: 1, hint: 'Vuoto = illimitati' },
    { name: 'max_uses_per_customer', label: 'Utilizzi per cliente', type: 'number', span: 1 },
    { name: 'expires_at', label: 'Scadenza', type: 'date', span: 1 },
    { name: 'customer_id', label: 'Riservato a un cliente', type: 'select', numeric: true, span: 1, options: (customers || []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })) },
    { name: 'first_order_only', label: 'Primo ordine', type: 'toggle', span: 1, toggleLabel: 'Valido solo sul primo ordine' },
    { name: 'active', label: 'Stato', type: 'toggle', span: 1, toggleLabel: 'Attivo' },
  ], [customers]);
  async function toggle(c) {
    await put(`/admin/coupons/${c.id}`, { active: !c.active });
    setData(data.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
  }
  const describe = (c) => (c.type === 'percent' ? `−${Number(c.value)}%` : c.type === 'fixed' ? `−${eur(c.value)}` : 'Consegna gratis');
  return (
    <div>
      <PageTitle title="Sconti e coupon" subtitle="Codici da comunicare ai clienti: benvenuto, campagne, rimborsi per disservizi"
        actions={<Button icon={Plus} onClick={() => setEdit({ type: 'percent', value: 10, min_spend: 0, max_uses_per_customer: 1, active: true })}>Nuovo coupon</Button>} />
      {loading && !data ? <Loading /> : (
        <Table rows={data || []} onRowClick={(c) => setEdit({ ...c })} columns={[
          { key: 'code', label: 'Codice', render: (c) => <span className="font-mono font-semibold bg-stone-100 rounded-lg px-2 py-1">{c.code}</span> },
          { key: 'val', label: 'Sconto', render: (c) => <Badge className="bg-accent-50 text-accent-700">{describe(c)}</Badge> },
          { key: 'description', label: 'Descrizione', render: (c) => <span className="text-xs">{c.description}{c.first_order_only && ' · solo primo ordine'}{c.customer_id && ' · personale'}</span> },
          { key: 'min', label: 'Minimo', render: (c) => (Number(c.min_spend) ? eur(c.min_spend) : '—') },
          { key: 'used', label: 'Utilizzi', render: (c) => `${c.used}${c.max_uses ? ` / ${c.max_uses}` : ''}` },
          { key: 'exp', label: 'Scadenza', render: (c) => <span className="text-xs">{c.expires_at ? fmtDate(c.expires_at) : '—'}</span> },
          { key: 'active', label: 'Attivo', render: (c) => <span onClick={(e) => e.stopPropagation()}><Toggle checked={c.active} onChange={() => toggle(c)} /></span> },
        ]} />
      )}
      <FormModal open={!!edit} title={edit?.id ? `Modifica ${edit.code}` : 'Nuovo coupon'} fields={fields} initial={edit} onClose={() => setEdit(null)}
        onSubmit={async (v) => {
          v.code = String(v.code || '').toUpperCase().replace(/\s/g, '');
          if (v.type === 'free_delivery') v.value = 0;
          if (edit.id) await put(`/admin/coupons/${edit.id}`, v); else await post('/admin/coupons', v);
          toast('Coupon salvato'); reload();
        }} />
    </div>
  );
}

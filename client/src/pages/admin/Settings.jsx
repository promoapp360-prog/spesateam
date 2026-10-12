import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useFetch } from '../../lib/hooks.js';
import { put, post } from '../../lib/api.js';
import { fmtDateTime } from '../../lib/format.js';
import { PageTitle, Card, Loading, Button, Field, Input, Tabs, Badge, toast } from '../../components/ui.jsx';
import { Table, FormModal } from './kit.jsx';

function ChipsEditor({ values, onChange, placeholder }) {
  const [v, setV] = useState('');
  const add = () => { const x = v.trim(); if (x && !values.includes(x)) onChange([...values, x]); setV(''); };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-800 px-3 py-1 text-sm font-medium">
            {x}<button onClick={() => onChange(values.filter((y) => y !== x))}><X className="size-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className="w-48" />
        <Button variant="secondary" icon={Plus} onClick={add}>Aggiungi</Button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { data, loading, reload } = useFetch('/admin/settings');
  const [tab, setTab] = useState('delivery');
  const [service, setService] = useState(null);
  const [delivery, setDelivery] = useState(null);
  useEffect(() => { if (data) { setService(data.service); setDelivery(data.delivery); } }, [data]);
  if (loading && !data) return <Loading />;
  if (!service || !delivery) return null;

  async function save(key, value) {
    try { await put(`/admin/settings/${key}`, value); toast('Impostazioni salvate'); reload(); } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div>
      <PageTitle title="Impostazioni" subtitle="Zona servita, consegne, dati del servizio e utenti del backoffice" />
      <Tabs className="mb-6 w-fit" value={tab} onChange={setTab} tabs={[
        { value: 'delivery', label: 'Zona e consegne' }, { value: 'service', label: 'Dati del servizio' }, { value: 'staff', label: 'Utenti e permessi' }, { value: 'log', label: 'Registro attività' },
      ]} />
      {tab === 'delivery' && (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card className="p-5 space-y-5">
            <div>
              <div className="font-semibold">CAP serviti</div>
              <div className="text-sm text-stone-500 mb-3">I clienti con un indirizzo fuori da questi CAP non possono ordinare.</div>
              <ChipsEditor values={delivery.caps} onChange={(caps) => setDelivery({ ...delivery, caps })} placeholder="es. 80020" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Costo di consegna (€)"><Input type="number" step="0.1" value={delivery.delivery_fee} onChange={(e) => setDelivery({ ...delivery, delivery_fee: e.target.value })} /></Field>
              <Field label="Consegna gratuita da (€)"><Input type="number" step="1" value={delivery.free_delivery_threshold} onChange={(e) => setDelivery({ ...delivery, free_delivery_threshold: e.target.value })} /></Field>
              <Field label="Margine prodotti a peso (%)" hint="Sulla pre-autorizzazione della carta"><Input type="number" value={delivery.weight_margin_pct} onChange={(e) => setDelivery({ ...delivery, weight_margin_pct: e.target.value })} /></Field>
              <Field label="Giorni prenotabili"><Input type="number" value={delivery.days_ahead} onChange={(e) => setDelivery({ ...delivery, days_ahead: e.target.value })} /></Field>
            </div>
          </Card>
          <Card className="p-5 space-y-5">
            <div>
              <div className="font-semibold">Fasce orarie di consegna</div>
              <div className="text-sm text-stone-500 mb-3">Formato HH:MM-HH:MM. La domenica pomeriggio il servizio è chiuso.</div>
              <ChipsEditor values={delivery.slots} onChange={(slots) => setDelivery({ ...delivery, slots: [...slots].sort() })} placeholder="es. 13:00-15:00" />
            </div>
            <Field label="Ordini massimi per fascia" hint="Quando una fascia è piena non è più prenotabile"><Input type="number" value={delivery.slot_capacity} onChange={(e) => setDelivery({ ...delivery, slot_capacity: e.target.value })} className="w-32" /></Field>
          </Card>
          <div className="lg:col-span-2">
            <Button onClick={() => save('delivery', {
              ...delivery, delivery_fee: Number(delivery.delivery_fee), free_delivery_threshold: Number(delivery.free_delivery_threshold),
              weight_margin_pct: Number(delivery.weight_margin_pct), days_ahead: Number(delivery.days_ahead), slot_capacity: Number(delivery.slot_capacity),
            })}>Salva zona e consegne</Button>
          </div>
        </div>
      )}
      {tab === 'service' && (
        <Card className="p-5 max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome del servizio"><Input value={service.name} onChange={(e) => setService({ ...service, name: e.target.value })} /></Field>
            <Field label="Città"><Input value={service.city} onChange={(e) => setService({ ...service, city: e.target.value })} /></Field>
            <Field label="Slogan" className="col-span-2"><Input value={service.tagline} onChange={(e) => setService({ ...service, tagline: e.target.value })} /></Field>
            <Field label="Telefono assistenza"><Input value={service.phone} onChange={(e) => setService({ ...service, phone: e.target.value })} /></Field>
            <Field label="Email assistenza"><Input value={service.email} onChange={(e) => setService({ ...service, email: e.target.value })} /></Field>
            <Field label="Centro mappa — latitudine"><Input type="number" step="any" value={service.center?.lat} onChange={(e) => setService({ ...service, center: { ...service.center, lat: Number(e.target.value) } })} /></Field>
            <Field label="Centro mappa — longitudine"><Input type="number" step="any" value={service.center?.lng} onChange={(e) => setService({ ...service, center: { ...service.center, lng: Number(e.target.value) } })} /></Field>
          </div>
          <div className="text-xs text-stone-500">Logo, colori e testi legali (privacy, termini) saranno configurati con il brand definitivo.</div>
          <Button onClick={() => save('service', service)}>Salva</Button>
        </Card>
      )}
      {tab === 'staff' && <Staff />}
      {tab === 'log' && <Log />}
    </div>
  );
}

function Staff() {
  const { data, loading, reload } = useFetch('/admin/staff');
  const [add, setAdd] = useState(null);
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-stone-500"><b>Amministratore</b>: accesso completo, statistiche e impostazioni. <b>Operatore</b>: ordini, catalogo, driver, clienti, promozioni.</div>
        <Button icon={Plus} onClick={() => setAdd({ role: 'operator' })}>Nuovo utente</Button>
      </div>
      {loading && !data ? <Loading /> : (
        <Table rows={data || []} columns={[
          { key: 'name', label: 'Nome', render: (u) => <span className="font-medium">{u.name}</span> },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Ruolo', render: (u) => <Badge className={u.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-stone-100 text-stone-600'}>{u.role === 'admin' ? 'Amministratore' : 'Operatore'}</Badge> },
          { key: 'created', label: 'Creato', render: (u) => <span className="text-xs text-stone-500">{fmtDateTime(u.created_at)}</span> },
        ]} />
      )}
      <FormModal open={!!add} title="Nuovo utente del backoffice" initial={add} onClose={() => setAdd(null)}
        fields={[
          { name: 'name', label: 'Nome', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'role', label: 'Ruolo', type: 'select', required: true, options: [{ value: 'operator', label: 'Operatore' }, { value: 'admin', label: 'Amministratore' }] },
          { name: 'password', label: 'Password iniziale', placeholder: 'demo1234' },
        ]}
        onSubmit={async (v) => { await post('/admin/staff', v); toast('Utente creato'); reload(); }} />
    </div>
  );
}

function Log() {
  const { data, loading } = useFetch('/admin/activity');
  if (loading && !data) return <Loading />;
  return (
    <Table rows={data || []} empty="Nessuna attività registrata" columns={[
      { key: 'when', label: 'Data', render: (a) => <span className="text-xs">{fmtDateTime(a.created_at)}</span> },
      { key: 'user', label: 'Utente', render: (a) => a.user_name },
      { key: 'action', label: 'Azione', render: (a) => <span className="font-mono text-xs">{a.action}</span> },
      { key: 'detail', label: 'Dettaglio', render: (a) => <span className="text-xs">{a.detail}</span> },
    ]} />
  );
}

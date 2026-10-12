import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useFetch } from '../../lib/hooks.js';
import { post, put } from '../../lib/api.js';
import { eur } from '../../lib/format.js';
import { PageTitle, Button, Loading, Badge, Toggle, toast } from '../../components/ui.jsx';
import { Table, FormModal } from './kit.jsx';

export function Categories() {
  const { data, loading, reload, setData } = useFetch('/admin/categories');
  const [edit, setEdit] = useState(null);
  const fields = [
    { name: 'name', label: 'Nome reparto', required: true },
    { name: 'icon', label: 'Icona (emoji)', span: 1 },
    { name: 'sort', label: 'Ordine di visualizzazione', type: 'number', span: 1 },
    { name: 'active', label: 'Visibile', type: 'toggle', toggleLabel: 'Mostra nell\'app cliente' },
  ];
  async function toggle(c) {
    await put(`/admin/categories/${c.id}`, { active: !c.active });
    setData(data.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
  }
  return (
    <div>
      <PageTitle title="Reparti" subtitle="Le categorie in cui sono organizzati i prodotti nell'app"
        actions={<Button icon={Plus} onClick={() => setEdit({ icon: '🛒', sort: (data?.length || 0) + 1, active: true })}>Nuovo reparto</Button>} />
      {loading && !data ? <Loading /> : (
        <Table rows={data || []} columns={[
          { key: 'icon', label: '', render: (c) => <span className="text-2xl">{c.icon}</span> },
          { key: 'name', label: 'Reparto', render: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'sort', label: 'Ordine' },
          { key: 'active', label: 'Visibile', render: (c) => <Toggle checked={c.active} onChange={() => toggle(c)} /> },
          { key: 'e', label: '', render: (c) => <button onClick={() => setEdit(c)} className="p-2 rounded-lg hover:bg-stone-100"><Pencil className="size-4" /></button> },
        ]} />
      )}
      <FormModal open={!!edit} title={edit?.id ? 'Modifica reparto' : 'Nuovo reparto'} fields={fields} initial={edit} onClose={() => setEdit(null)}
        onSubmit={async (v) => { if (edit.id) await put(`/admin/categories/${edit.id}`, v); else await post('/admin/categories', v); toast('Reparto salvato'); reload(); }} />
    </div>
  );
}

export function Stores() {
  const { data, loading, reload } = useFetch('/admin/stores');
  const [edit, setEdit] = useState(null);
  const fields = [
    { name: 'name', label: 'Nome supermercato', required: true },
    { name: 'address', label: 'Indirizzo' },
    { name: 'phone', label: 'Telefono', span: 1 },
    { name: 'hours', label: 'Orari', span: 1, placeholder: 'Lun–Sab 8:00–21:00' },
    { name: 'min_order', label: 'Minimo d\'ordine (€)', type: 'number', step: '0.5', span: 1 },
    { name: 'prep_minutes', label: 'Tempo medio di spesa (min)', type: 'number', span: 1 },
    { name: 'lat', label: 'Latitudine', type: 'number', step: 'any', span: 1, hint: 'In produzione si ricava dall\'indirizzo' },
    { name: 'lng', label: 'Longitudine', type: 'number', step: 'any', span: 1 },
    { name: 'emoji', label: 'Icona', span: 1 },
    { name: 'color', label: 'Colore', type: 'color', span: 1 },
    { name: 'active', label: 'Attivo', type: 'toggle', toggleLabel: 'Visibile ai clienti' },
  ];
  return (
    <div>
      <PageTitle title="Supermercati" subtitle="I punti vendita convenzionati da cui i clienti possono ordinare"
        actions={<Button icon={Plus} onClick={() => setEdit({ emoji: '🛒', color: '#1E7B4F', min_order: 15, prep_minutes: 30, active: true, lat: 40.8990, lng: 14.2785 })}>Nuovo supermercato</Button>} />
      {loading && !data ? <Loading /> : (
        <Table rows={data || []} onRowClick={setEdit} columns={[
          { key: 'emoji', label: '', render: (s) => <span className="size-10 rounded-xl inline-flex items-center justify-center text-2xl" style={{ background: `${s.color}22` }}>{s.emoji}</span> },
          { key: 'name', label: 'Supermercato', render: (s) => <div><div className="font-medium">{s.name}</div><div className="text-xs text-stone-500">{s.address}</div></div> },
          { key: 'hours', label: 'Orari', render: (s) => <span className="text-xs">{s.hours}</span> },
          { key: 'min', label: 'Minimo', render: (s) => eur(s.min_order) },
          { key: 'prep', label: 'Preparazione', render: (s) => `${s.prep_minutes} min` },
          { key: 'active', label: 'Stato', render: (s) => s.active ? <Badge className="bg-brand-50 text-brand-700">Attivo</Badge> : <Badge className="bg-stone-100 text-stone-500">Sospeso</Badge> },
        ]} />
      )}
      <FormModal open={!!edit} title={edit?.id ? `Modifica: ${edit.name}` : 'Nuovo supermercato'} fields={fields} initial={edit} size="lg" onClose={() => setEdit(null)}
        onSubmit={async (v) => { if (edit.id) await put(`/admin/stores/${edit.id}`, v); else await post('/admin/stores', v); toast('Supermercato salvato'); reload(); }} />
    </div>
  );
}

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useFetch } from '../../lib/hooks.js';
import { post, put } from '../../lib/api.js';
import { eur, minutesAgo, fmtDate } from '../../lib/format.js';
import { PageTitle, Button, Loading, Badge, Stat, toast, cx } from '../../components/ui.jsx';
import { Table, FormModal } from './kit.jsx';

const STATUS = {
  available: ['Disponibile', 'bg-brand-50 text-brand-700'],
  busy: ['In consegna', 'bg-accent-50 text-accent-700'],
  offline: ['Fuori servizio', 'bg-stone-100 text-stone-500'],
};

export default function Drivers() {
  const { data, loading, reload } = useFetch('/admin/drivers', { interval: 15000 });
  const [edit, setEdit] = useState(null);
  const fields = [
    { name: 'name', label: 'Nome e cognome', required: true },
    { name: 'email', label: 'Email (accesso all\'app)', type: 'email', required: true, span: 1 },
    { name: 'phone', label: 'Telefono', span: 1 },
    { name: 'password', label: edit?.id ? 'Nuova password (lascia vuoto per non cambiarla)' : 'Password iniziale', type: 'text', placeholder: edit?.id ? '' : 'demo1234' },
    { name: 'vehicle', label: 'Mezzo', span: 1, placeholder: 'Scooter, auto…' },
    { name: 'plate', label: 'Targa', span: 1 },
    { name: 'zone', label: 'Zona di lavoro', span: 1 },
    { name: 'tax_code', label: 'Codice fiscale', span: 1 },
    ...(edit?.id ? [{ name: 'active', label: 'Account', type: 'toggle', toggleLabel: 'Attivo (può accedere all\'app)' }] : []),
  ];
  const rows = data || [];
  const cashToday = rows.reduce((s, d) => s + Number(d.cash_today || 0), 0);

  return (
    <div>
      <PageTitle title="Driver" subtitle="Anagrafica, stato in tempo reale e prestazioni"
        actions={<Button icon={Plus} onClick={() => setEdit({})}>Nuovo driver</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Driver attivi" value={rows.filter((d) => d.active).length} icon="🛵" />
        <Stat label="In servizio ora" value={rows.filter((d) => d.status !== 'offline').length} icon="🟢" />
        <Stat label="Consegne ultimi 30 giorni" value={rows.reduce((s, d) => s + d.delivered_30d, 0)} icon="📦" />
        <Stat label="Contanti incassati oggi" value={eur(cashToday)} icon="💶" sub="da versare a fine turno" />
      </div>
      {loading && !data ? <Loading /> : (
        <Table rows={rows} onRowClick={(d) => setEdit({ ...d, password: '' })} columns={[
          { key: 'name', label: 'Driver', render: (d) => (
            <div className={cx(!d.active && 'opacity-50')}>
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-stone-500">{d.email} · {d.phone}</div>
            </div>
          ) },
          { key: 'vehicle', label: 'Mezzo', render: (d) => <div className="text-xs"><div>{d.vehicle}</div><div className="text-stone-500">{d.plate}</div></div> },
          { key: 'status', label: 'Stato', render: (d) => (
            <div>
              <Badge className={STATUS[d.status][1]}>{STATUS[d.status][0]}</Badge>
              {d.position_at && d.status !== 'offline' && <div className="text-[10px] text-stone-400 mt-0.5">GPS {minutesAgo(d.position_at)}</div>}
            </div>
          ) },
          { key: 'd30', label: 'Consegne 30gg', align: 'right', render: (d) => <b>{d.delivered_30d}</b> },
          { key: 'tot', label: 'Totali', align: 'right', render: (d) => d.delivered_total },
          { key: 'avg', label: 'Tempo medio', align: 'right', render: (d) => (d.avg_minutes ? `${d.avg_minutes} min` : '—') },
          { key: 'rating', label: 'Valutazione', align: 'right', render: (d) => (d.avg_rating ? `★ ${String(d.avg_rating).replace('.', ',')}` : '—') },
          { key: 'cash', label: 'Contanti oggi', align: 'right', render: (d) => eur(d.cash_today) },
          { key: 'since', label: 'Dal', render: (d) => <span className="text-xs text-stone-500">{fmtDate(d.created_at)}</span> },
        ]} />
      )}
      <FormModal open={!!edit} title={edit?.id ? `Modifica: ${edit.name}` : 'Nuovo driver'} fields={fields} initial={edit} size="lg" onClose={() => setEdit(null)}
        onSubmit={async (v) => {
          if (!v.password) delete v.password;
          if (edit.id) await put(`/admin/drivers/${edit.id}`, v); else await post('/admin/drivers', v);
          toast('Driver salvato'); reload();
        }} />
    </div>
  );
}

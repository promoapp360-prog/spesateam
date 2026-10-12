import { useEffect, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { useFetch, useDebounced } from '../../lib/hooks.js';
import { post, put } from '../../lib/api.js';
import { eur, fmtDate, fmtDateTime } from '../../lib/format.js';
import { PageTitle, Button, Input, Loading, Badge, Card, StatusBadge, Field, Textarea, Tabs, toast, cx } from '../../components/ui.jsx';
import { Table, Drawer, downloadBlob } from './kit.jsx';
import { OrderDrawer } from './Orders.jsx';

const TIER = { Base: 'bg-stone-100 text-stone-600', Silver: 'bg-slate-200 text-slate-700', Gold: 'bg-amber-100 text-amber-800' };

export default function Customers() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, loading } = useFetch(`/admin/customers${dq ? `?q=${encodeURIComponent(dq)}` : ''}`);
  const [openId, setOpenId] = useState(null);

  function exportCsv() {
    const head = ['Codice', 'Nome', 'Email', 'Telefono', 'Indirizzo', 'Ordini', 'Spesa totale', 'Punti', 'Livello', 'Consenso marketing', 'Cliente dal'];
    const rows = (data || []).map((c) => [c.code, c.name, c.email, c.phone, c.address, c.orders_count, String(Number(c.total_spent).toFixed(2)).replace('.', ','), c.points, c.tier, c.marketing_consent ? 'Sì' : 'No', fmtDate(c.created_at)]);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'spesateam-clienti.csv');
  }

  return (
    <div>
      <PageTitle title="Clienti" subtitle={data ? `${data.length} clienti registrati, ognuno con codice e tessera fedeltà` : ''}
        actions={<Button variant="secondary" icon={Download} onClick={exportCsv}>Esporta Excel</Button>} />
      <div className="relative mb-4 w-fit">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, email, telefono o codice" className="pl-9 w-80" />
      </div>
      {loading && !data ? <Loading /> : (
        <Table rows={data || []} onRowClick={(c) => setOpenId(c.id)} columns={[
          { key: 'code', label: 'Codice', render: (c) => <span className="font-mono text-xs">{c.code}</span> },
          { key: 'name', label: 'Cliente', render: (c) => <div><div className="font-medium">{c.name}</div><div className="text-xs text-stone-500">{c.email}</div></div> },
          { key: 'address', label: 'Indirizzo', render: (c) => <span className="text-xs">{c.address}</span> },
          { key: 'orders', label: 'Ordini', align: 'right', render: (c) => c.orders_count },
          { key: 'spent', label: 'Spesa totale', align: 'right', render: (c) => <b>{eur(c.total_spent)}</b> },
          { key: 'points', label: 'Punti', align: 'right', render: (c) => c.points },
          { key: 'tier', label: 'Livello', render: (c) => <Badge className={TIER[c.tier] || TIER.Base}>{c.tier}</Badge> },
          { key: 'last', label: 'Ultimo ordine', render: (c) => <span className="text-xs text-stone-500">{c.last_order ? fmtDate(c.last_order) : '—'}</span> },
        ]} />
      )}
      <CustomerDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function CustomerDrawer({ id, onClose }) {
  const { data: c, loading, reload } = useFetch(id ? `/admin/customers/${id}` : null);
  const [tab, setTab] = useState('orders');
  const [notes, setNotes] = useState('');
  const [pts, setPts] = useState('');
  const [reason, setReason] = useState('');
  const [orderId, setOrderId] = useState(null);
  useEffect(() => { setNotes(c?.notes || ''); }, [c?.notes]);

  async function saveNotes() { await put(`/admin/customers/${c.id}`, { notes }); toast('Note salvate'); }
  async function addPoints() {
    try {
      await post(`/admin/customers/${c.id}/points`, { points: Number(pts), reason: reason || undefined });
      setPts(''); setReason(''); toast('Punti aggiornati'); reload();
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <Drawer open={!!id} onClose={onClose} title={c ? c.name : 'Cliente'} subtitle={c ? `${c.code} · cliente dal ${fmtDate(c.created_at)}` : ''}>
      {loading && !c ? <Loading /> : c && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3"><div className="text-xs text-stone-500">Ordini</div><div className="text-xl font-bold">{c.stats.orders}</div></Card>
            <Card className="p-3"><div className="text-xs text-stone-500">Spesa totale</div><div className="text-xl font-bold">{eur(c.stats.spent)}</div></Card>
            <Card className="p-3"><div className="text-xs text-stone-500">Scontrino medio</div><div className="text-xl font-bold">{eur(c.stats.avg_ticket)}</div></Card>
            <Card className="p-3"><div className="text-xs text-stone-500">Punti</div><div className="text-xl font-bold">{c.points} <Badge className={cx('align-middle', TIER[c.tier.current])}>{c.tier.current}</Badge></div></Card>
          </div>
          <Card className="p-4 text-sm grid sm:grid-cols-2 gap-3">
            <div><div className="text-xs text-stone-500">Contatti</div><div>{c.email}</div><div>{c.phone || '—'}</div>
              <div className="text-xs mt-1">{c.marketing_consent ? '✅ Consenso marketing' : '— Nessun consenso marketing'}</div></div>
            <div><div className="text-xs text-stone-500">Indirizzi</div>{c.addresses.map((a) => <div key={a.id}>{a.street} {a.civic}, {a.cap}</div>)}</div>
          </Card>
          {c.favorites.length > 0 && (
            <Card className="p-4">
              <div className="text-xs text-stone-500 mb-2">Prodotti acquistati più spesso</div>
              <div className="flex flex-wrap gap-2">{c.favorites.map((f) => <span key={f.name} className="text-xs rounded-full bg-stone-100 px-2.5 py-1">{f.emoji} {f.name} ×{f.n}</span>)}</div>
            </Card>
          )}
          <Tabs tabs={[{ value: 'orders', label: 'Ordini' }, { value: 'points', label: 'Tessera e punti' }, { value: 'notes', label: 'Note interne' }]} value={tab} onChange={setTab} className="w-fit" />
          {tab === 'orders' && (
            <Card className="divide-y divide-stone-100">
              {c.orders.map((o) => (
                <button key={o.id} onClick={() => setOrderId(o.id)} className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-stone-50">
                  <div className="text-left"><div className="font-medium">{o.code}</div><div className="text-xs text-stone-500">{fmtDateTime(o.created_at)} · {o.store_name}</div></div>
                  <div className="flex items-center gap-3"><StatusBadge status={o.status} /><b>{eur(o.total)}</b></div>
                </button>
              ))}
            </Card>
          )}
          {tab === 'points' && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="text-sm font-semibold mb-2">Rettifica punti</div>
                <div className="flex gap-2">
                  <Input type="number" value={pts} onChange={(e) => setPts(e.target.value)} placeholder="+50 o -50" className="w-32" />
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (es. bonus disservizio)" />
                  <Button onClick={addPoints} disabled={!pts}>Applica</Button>
                </div>
              </Card>
              <Card className="divide-y divide-stone-100">
                {c.movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div><div>{m.reason}</div><div className="text-xs text-stone-500">{fmtDateTime(m.created_at)}</div></div>
                    <b className={m.points > 0 ? 'text-brand-700' : 'text-accent-600'}>{m.points > 0 ? '+' : ''}{m.points}</b>
                  </div>
                ))}
              </Card>
            </div>
          )}
          {tab === 'notes' && (
            <Card className="p-4">
              <Field label="Note visibili solo allo staff"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Es. preferisce consegne dopo le 18, allergico alle noci…" /></Field>
              <Button className="mt-3" onClick={saveNotes}>Salva note</Button>
            </Card>
          )}
        </div>
      )}
      <OrderDrawer id={orderId} onClose={() => setOrderId(null)} />
    </Drawer>
  );
}

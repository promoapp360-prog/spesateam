import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Phone, Mail } from 'lucide-react';
import { useFetch, useDebounced } from '../../lib/hooks.js';
import { post } from '../../lib/api.js';
import { eur, fmtTime, fmtDateTime, dayLabel, qtyLabel, STATUS, PAYMENT, PAYMENT_STATUS, ITEM_STATUS, SUB_PREF } from '../../lib/format.js';
import { Card, Loading, StatusBadge, Badge, PageTitle, Button, Select, Input, Tabs, ErrorBox, toast, cx } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';
import { Drawer, Table } from './kit.jsx';

export default function Orders() {
  const [sp, setSp] = useSearchParams();
  const [status, setStatus] = useState(sp.get('status') || 'active');
  const [storeId, setStoreId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [openId, setOpenId] = useState(null);
  const { data: stores } = useFetch('/admin/stores');
  const { data: drivers } = useFetch('/admin/drivers');
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (storeId) params.set('store_id', storeId);
  if (driverId) params.set('driver_id', driverId);
  if (date) params.set('date', date);
  if (dq) params.set('q', dq);
  const { data: rows, loading, reload } = useFetch(`/admin/orders?${params}`, { interval: 10000 });

  useEffect(() => { if (sp.get('status') && sp.get('status') !== status) setSp({}, { replace: true }); }, [status, sp, setSp]);

  return (
    <div>
      <PageTitle title="Ordini" subtitle="Gestisci, assegna e segui tutti gli ordini in tempo reale" />
      <Tabs className="mb-4 w-fit max-w-full" value={status} onChange={setStatus}
        tabs={[{ value: 'active', label: 'In corso' }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label })), { value: 'all', label: 'Tutti' }]} />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Codice, cliente o via" className="pl-9 w-64" />
        </div>
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-52">
          <option value="">Tutti i supermercati</option>
          {(stores || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-48">
          <option value="">Tutti i driver</option>
          {(drivers || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
      </div>
      {loading && !rows ? <Loading /> : (
        <Table
          rows={rows || []}
          onRowClick={(r) => setOpenId(r.id)}
          empty="Nessun ordine con questi filtri"
          columns={[
            { key: 'code', label: 'Ordine', render: (r) => <div><div className="font-semibold">{r.code}</div><div className="text-xs text-stone-500">{fmtDateTime(r.created_at)}</div></div> },
            { key: 'customer', label: 'Cliente', render: (r) => <div><div>{r.customer_name}</div><div className="text-xs text-stone-500">{r.street} {r.civic}</div></div> },
            { key: 'store', label: 'Supermercato', render: (r) => <span>{r.store_emoji} {r.store_name}</span> },
            { key: 'slot', label: 'Consegna', render: (r) => <div className="text-xs"><div className="capitalize">{dayLabel(r.slot_date)}</div><div className="text-stone-500">{r.slot_label}</div></div> },
            { key: 'status', label: 'Stato', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'driver', label: 'Driver', render: (r) => r.driver_name || <Badge className="bg-red-50 text-red-700">da assegnare</Badge> },
            { key: 'pay', label: 'Pagamento', render: (r) => <div className="text-xs"><div>{PAYMENT[r.payment_method].icon} {PAYMENT[r.payment_method].label}</div><div className="text-stone-500">{PAYMENT_STATUS[r.payment_status]}</div></div> },
            { key: 'total', label: 'Totale', align: 'right', render: (r) => <span className="font-semibold">{eur(r.total)}</span> },
          ]}
        />
      )}
      <OrderDrawer id={openId} onClose={() => setOpenId(null)} onChange={reload} />
    </div>
  );
}

export function OrderDrawer({ id, onClose, onChange }) {
  const { data: o, loading, error, reload, setData } = useFetch(id ? `/admin/orders/${id}` : null, { interval: id ? 8000 : 0 });
  const { data: drivers } = useFetch(id ? '/admin/drivers' : null);
  const [driver, setDriver] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('items');
  useEffect(() => { setDriver(o?.driver_id || ''); }, [o?.driver_id]);
  useEffect(() => { setTab('items'); }, [id]);

  async function act(fn, msg) {
    setBusy(true);
    try { const d = await fn(); setData(d); toast(msg); onChange?.(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  const assign = () => act(() => post(`/admin/orders/${o.id}/assign`, { driver_id: Number(driver) }), 'Driver assegnato');
  const setStatus = (s, extra = {}) => act(() => post(`/admin/orders/${o.id}/status`, { status: s, ...extra }), `Stato aggiornato: ${STATUS[s].label}`);

  const next = o && { accepted: 'shopping', shopping: 'delivering', delivering: 'delivered' }[o.status];
  const activeDrivers = (drivers || []).filter((d) => d.active);

  return (
    <Drawer open={!!id} onClose={onClose} title={o ? `Ordine ${o.code}` : 'Ordine'} subtitle={o ? `${fmtDateTime(o.created_at)} · ${o.store_name}` : ''}
      actions={o && <StatusBadge status={o.status} className="text-sm px-3 py-1" />}>
      {loading && !o ? <Loading /> : error ? <ErrorBox error={error} /> : o && (
        <div className="space-y-5">
          {!['delivered', 'cancelled'].includes(o.status) && (
            <Card className="p-4">
              <div className="text-sm font-semibold mb-2">{o.driver_id ? 'Driver assegnato' : 'Assegna a un driver'}</div>
              <div className="flex gap-2">
                <Select value={driver} onChange={(e) => setDriver(e.target.value)}>
                  <option value="">Scegli driver…</option>
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} — {d.status === 'available' ? 'disponibile' : d.status === 'busy' ? 'occupato' : 'fuori servizio'}</option>
                  ))}
                </Select>
                <Button onClick={assign} loading={busy} disabled={!driver || Number(driver) === o.driver_id}>{o.driver_id ? 'Riassegna' : 'Assegna'}</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {next && <Button size="sm" variant="soft" onClick={() => setStatus(next)} loading={busy}>Segna come “{STATUS[next].label}”</Button>}
                {['received', 'accepted', 'shopping'].includes(o.status) && (
                  <Button size="sm" variant="secondary" onClick={() => window.confirm('Annullare questo ordine? Se pagato online verrà rimborsato.') && setStatus('cancelled')}>Annulla ordine</Button>
                )}
              </div>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-4 text-sm">
              <div className="text-xs text-stone-500 mb-1">Cliente</div>
              <div className="font-semibold">{o.customer_name} <span className="text-xs font-normal text-stone-500">{o.customer_code}</span></div>
              <div className="flex items-center gap-1.5 text-stone-600 mt-1"><Phone className="size-3.5" /> {o.customer_phone || '—'}</div>
              <div className="flex items-center gap-1.5 text-stone-600"><Mail className="size-3.5" /> {o.customer_email}</div>
              <div className="mt-2">{o.street} {o.civic}, {o.cap} {o.city}</div>
              <div className="text-xs text-stone-500">{[o.intercom && `Citofono ${o.intercom}`, o.floor && `Piano ${o.floor}`, o.address_notes].filter(Boolean).join(' · ')}</div>
            </Card>
            <Card className="p-4 text-sm">
              <div className="text-xs text-stone-500 mb-1">Consegna e pagamento</div>
              <div className="font-semibold capitalize">{dayLabel(o.slot_date)} · {o.slot_label}</div>
              <div className="mt-1">{PAYMENT[o.payment_method].icon} {PAYMENT[o.payment_method].label} · <span className="text-stone-500">{PAYMENT_STATUS[o.payment_status]}</span></div>
              {o.cash_collected != null && <div className="text-xs text-stone-500">Contanti incassati: {eur(o.cash_collected)}</div>}
              <div className="mt-2 text-2xl font-bold font-display">{eur(o.total)}</div>
              {Number(o.estimated_total) !== Number(o.total) && <div className="text-xs text-stone-500">stimato {eur(o.estimated_total)}</div>}
              {o.notes && <div className="mt-2 text-xs bg-amber-50 rounded-lg p-2">📝 {o.notes}</div>}
            </Card>
          </div>

          <Tabs tabs={[{ value: 'items', label: `Prodotti (${o.items.length})` }, { value: 'map', label: 'Mappa' }, { value: 'history', label: 'Cronologia' }]} value={tab} onChange={setTab} className="w-fit" />

          {tab === 'items' && (
            <Card>
              <div className="divide-y divide-stone-100">
                {o.items.map((i) => (
                  <div key={i.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className="text-xl">{i.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cx('font-medium', i.status === 'missing' && 'line-through text-stone-400')}>{i.name}</div>
                      <div className="text-xs text-stone-500">
                        {qtyLabel(i.qty, i.unit)}{i.final_qty != null && i.unit === 'kg' && ` → ${qtyLabel(i.final_qty, i.unit)}`} · {eur(i.unit_price)}{i.unit === 'kg' && '/kg'}
                        {i.promo_label && <span className="ml-1 text-accent-600 font-semibold">{i.promo_label}</span>}
                        <span className="ml-1 text-stone-400">· se manca: {SUB_PREF[i.sub_pref].toLowerCase()}</span>
                      </div>
                    </div>
                    <Badge className={ITEM_STATUS[i.status].color}>{ITEM_STATUS[i.status].label}</Badge>
                    <div className="w-16 text-right font-medium">{eur(i.line_total)}</div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-stone-100 text-sm space-y-1">
                <Row l="Prodotti" v={eur(o.items_total)} />
                {o.promo_discount > 0 && <Row l="Promozioni" v={`− ${eur(o.promo_discount)}`} />}
                {o.coupon_discount > 0 && <Row l={`Coupon ${o.coupon_code}`} v={`− ${eur(o.coupon_discount)}`} />}
                {o.points_discount > 0 && <Row l={`Premio fedeltà (${o.points_used} punti)`} v={`− ${eur(o.points_discount)}`} />}
                <Row l="Consegna" v={eur(o.delivery_fee)} />
                <div className="flex justify-between font-bold pt-1"><span>Totale</span><span>{eur(o.total)}</span></div>
                {o.points_earned > 0 && <div className="text-xs text-accent-600 text-right">+{o.points_earned} punti al cliente</div>}
              </div>
            </Card>
          )}
          {tab === 'map' && (
            <MapView className="h-80" markers={[
              { id: 's', lat: o.store_lat, lng: o.store_lng, emoji: o.store_emoji, color: '#e8822a', label: o.store_name },
              { id: 'h', lat: o.lat, lng: o.lng, emoji: '🏠', label: o.customer_name },
              ...(o.driver_lat && ['accepted', 'shopping', 'delivering'].includes(o.status) ? [{ id: 'd', lat: o.driver_lat, lng: o.driver_lng, emoji: '🛵', pulse: true, label: o.driver_name }] : []),
            ]} />
          )}
          {tab === 'history' && (
            <Card className="p-4">
              <ol className="relative border-l-2 border-stone-200 ml-2 space-y-4">
                {o.events.map((e) => (
                  <li key={e.id} className="ml-4">
                    <span className={cx('absolute -left-[7px] size-3 rounded-full', STATUS[e.status]?.dot || 'bg-stone-400')} />
                    <div className="text-sm font-medium">{STATUS[e.status]?.label || e.status}{e.note && <span className="font-normal text-stone-500"> — {e.note}</span>}</div>
                    <div className="text-xs text-stone-500">{fmtDateTime(e.created_at)}{e.user_name && ` · ${e.user_name}`}</div>
                  </li>
                ))}
              </ol>
              {o.proof_note && <div className="text-xs text-stone-500 mt-4">Prova di consegna: {o.proof_note}</div>}
              {o.rating && <div className="text-xs mt-1">Valutazione cliente: {'★'.repeat(o.rating)}{'☆'.repeat(5 - o.rating)}</div>}
            </Card>
          )}
          <div className="text-xs text-stone-400">Aggiornamento automatico · ultimo {fmtTime(new Date())} <button className="underline" onClick={reload}>aggiorna</button></div>
        </div>
      )}
    </Drawer>
  );
}

function Row({ l, v }) {
  return <div className="flex justify-between"><span className="text-stone-500">{l}</span><span>{v}</span></div>;
}

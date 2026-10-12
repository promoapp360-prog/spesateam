import { useState } from 'react';
import { useFetch } from '../../lib/hooks.js';
import { minutesAgo, STATUS } from '../../lib/format.js';
import { Card, Loading, PageTitle, StatusBadge, cx } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';
import { OrderDrawer } from './Orders.jsx';

const ORDER_PIN = { received: '#0ea5e9', accepted: '#6366f1', shopping: '#f59e0b', delivering: '#e8822a' };

export default function LiveMap() {
  const { data, loading, reload } = useFetch('/admin/live', { interval: 5000 });
  const [openId, setOpenId] = useState(null);
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const markers = [
    ...data.stores.map((s) => ({ id: `s${s.id}`, lat: s.lat, lng: s.lng, emoji: s.emoji, color: '#78716c', label: s.name })),
    ...data.orders.map((o) => ({ id: `o${o.id}`, lat: o.lat, lng: o.lng, emoji: '🏠', color: ORDER_PIN[o.status], label: `${o.code} · ${o.customer_name} · ${STATUS[o.status].label}`, orderId: o.id })),
    ...data.drivers.filter((d) => d.lat).map((d) => ({ id: `d${d.id}`, lat: d.lat, lng: d.lng, emoji: '🛵', color: d.status === 'busy' ? '#e8822a' : '#1e7b4f', pulse: true, label: `${d.name} (${d.status === 'busy' ? 'occupato' : 'disponibile'})` })),
  ];
  return (
    <div>
      <PageTitle title="Mappa live" subtitle="Driver in servizio e ordini in corso, aggiornati ogni 5 secondi" />
      <div className="grid xl:grid-cols-[1fr_320px] gap-5">
        <MapView className="h-[70vh]" fit="once" markers={markers} onMarkerClick={(m) => m.orderId && setOpenId(m.orderId)} />
        <div className="space-y-4">
          <Card className="p-4">
            <div className="font-semibold mb-3">Driver in servizio ({data.drivers.length})</div>
            <div className="space-y-3">
              {data.drivers.length === 0 && <div className="text-sm text-stone-500">Nessun driver in servizio</div>}
              {data.drivers.map((d) => (
                <div key={d.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cx('size-2.5 rounded-full', d.status === 'busy' ? 'bg-accent-500' : 'bg-brand-500')} />
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs text-stone-400 ml-auto">{d.position_at ? minutesAgo(d.position_at) : ''}</span>
                  </div>
                  <div className="text-xs text-stone-500 ml-4">{d.vehicle}{d.orders ? ` · ${d.orders.map((o) => o.code).join(', ')}` : ''}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="font-semibold mb-3">Ordini in corso ({data.orders.length})</div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {data.orders.map((o) => (
                <button key={o.id} onClick={() => setOpenId(o.id)} className="w-full text-left flex items-center justify-between gap-2 text-sm p-2 rounded-lg hover:bg-stone-50">
                  <div>
                    <div className="font-medium">{o.code} · {o.customer_name}</div>
                    <div className="text-xs text-stone-500">{o.street} {o.civic} · {o.slot_label}</div>
                  </div>
                  <StatusBadge status={o.status} />
                </button>
              ))}
            </div>
          </Card>
          <div className="text-xs text-stone-500 flex flex-wrap gap-3">
            {Object.entries(ORDER_PIN).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: c }} /> {STATUS[k].label}</span>)}
          </div>
        </div>
      </div>
      <OrderDrawer id={openId} onClose={() => setOpenId(null)} onChange={reload} />
    </div>
  );
}

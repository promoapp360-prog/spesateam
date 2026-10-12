import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { useFetch } from '../../lib/hooks.js';
import { eur, fmtTime, fmtDateShort, minutesAgo, STATUS, PAYMENT } from '../../lib/format.js';
import { Card, Stat, Loading, StatusBadge, PageTitle, toast, cx } from '../../components/ui.jsx';
import { Table } from './kit.jsx';
import { OrderDrawer } from './Orders.jsx';

export default function Dashboard() {
  const { data, loading, reload } = useFetch('/admin/dashboard', { interval: 10000 });
  const [openId, setOpenId] = useState(null);
  const prevReceived = useRef(null);

  useEffect(() => {
    if (!data) return;
    const n = data.byStatus.find((s) => s.status === 'received')?.n || 0;
    if (prevReceived.current !== null && n > prevReceived.current) {
      toast('🔔 Nuovo ordine ricevuto');
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.08;
        o.start(); o.stop(ctx.currentTime + 0.25);
      } catch { /* audio non disponibile */ }
    }
    prevReceived.current = n;
  }, [data]);

  if (loading && !data) return <Loading />;
  if (!data) return null;
  const st = Object.fromEntries(data.byStatus.map((s) => [s.status, s.n]));
  const activeCount = data.byStatus.reduce((a, s) => a + s.n, 0);
  const trend = data.yesterday.booked ? ((data.today.booked - data.yesterday.booked) / data.yesterday.booked) * 100 : null;
  const maxWeek = Math.max(1, ...data.week.map((d) => Number(d.revenue)));

  return (
    <div>
      <PageTitle title="Dashboard" subtitle={`Oggi, ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Ordini di oggi" value={data.today.orders} icon="🧾" sub={`ieri ${data.yesterday.orders}`} />
        <Stat label="Valore ordini di oggi" value={eur(data.today.booked)} icon="💶" trend={trend} sub="vs ieri" />
        <Stat label="Consegnati oggi" value={data.today.delivered} icon="✅" sub={`incassati ${eur(data.today.revenue)}`} />
        <Stat label="Ordini in corso" value={activeCount} icon="🛵" sub={`${data.drivers.filter((d) => d.status !== 'offline').length} driver in servizio`} />
      </div>

      {data.late.length > 0 && (
        <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2 font-semibold text-red-800"><TriangleAlert className="size-5" /> Ordini in attesa da più di 10 minuti</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {data.late.map((o) => (
              <button key={o.id} onClick={() => setOpenId(o.id)} className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-sm hover:bg-red-100">
                <b>{o.code}</b> · {o.customer_name} · {minutesAgo(o.created_at)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {['received', 'accepted', 'shopping', 'delivering'].map((s) => (
          <Link key={s} to={`/admin/ordini?status=${s}`} className="rounded-2xl bg-white border border-stone-200 p-4 hover:shadow-md transition">
            <div className="flex items-center gap-2 text-sm text-stone-500"><span className={cx('size-2 rounded-full', STATUS[s].dot)} /> {STATUS[s].label}</div>
            <div className="text-3xl font-bold font-display mt-1">{st[s] || 0}</div>
          </Link>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Ultimi ordini</h2>
            <Link to="/admin/ordini" className="text-sm text-brand-700 font-medium">Tutti gli ordini →</Link>
          </div>
          <Table
            rows={data.recent}
            onRowClick={(r) => setOpenId(r.id)}
            columns={[
              { key: 'code', label: 'Ordine', render: (r) => <div><div className="font-semibold">{r.code}</div><div className="text-xs text-stone-500">{fmtTime(r.created_at)}</div></div> },
              { key: 'customer_name', label: 'Cliente', render: (r) => <div><div>{r.customer_name}</div><div className="text-xs text-stone-500">{r.store_name}</div></div> },
              { key: 'slot', label: 'Fascia', render: (r) => <span className="text-xs">{r.slot_label}</span> },
              { key: 'status', label: 'Stato', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'driver', label: 'Driver', render: (r) => r.driver_name || <span className="text-xs text-stone-400">da assegnare</span> },
              { key: 'total', label: 'Totale', align: 'right', render: (r) => <span className="font-semibold">{PAYMENT[r.payment_method].icon} {eur(r.total)}</span> },
            ]}
          />
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <div className="font-semibold mb-3">Driver</div>
            <div className="space-y-2">
              {data.drivers.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cx('size-2.5 rounded-full', d.status === 'available' ? 'bg-brand-500' : d.status === 'busy' ? 'bg-accent-500' : 'bg-stone-300')} />
                    <span className="font-medium">{d.name}</span>
                  </div>
                  <span className="text-xs text-stone-500">
                    {d.status === 'offline' ? 'fuori servizio' : d.active_orders ? `${d.active_orders} ordini in corso` : 'disponibile'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="font-semibold mb-4">Ultimi 7 giorni</div>
            <div className="flex items-end gap-2">
              {data.week.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-stone-500">{d.orders}</div>
                  <div className="w-full h-24 flex items-end">
                    <div className="w-full rounded-t-lg bg-brand-500" style={{ height: `${(Number(d.revenue) / maxWeek) * 100}%`, minHeight: 4 }} title={eur(d.revenue)} />
                  </div>
                  <div className="text-[10px] text-stone-500">{fmtDateShort(d.day + 'T12:00:00').split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </Card>
          {data.unavailable_products > 0 && (
            <Link to="/admin/prodotti?off=1" className="block rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm">
              ⚠️ <b>{data.unavailable_products}</b> prodotti non disponibili nel catalogo
            </Link>
          )}
        </div>
      </div>
      <OrderDrawer id={openId} onClose={() => setOpenId(null)} onChange={reload} />
    </div>
  );
}

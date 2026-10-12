import { Fragment, useState } from 'react';
import { Download, Lock } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useFetch } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { eur, num, fmtDateShort, fmtDate, PAYMENT } from '../../lib/format.js';
import { PageTitle, Card, Stat, Loading, Button, Select, cx } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';
import { Table, Pill, downloadBlob } from './kit.jsx';

const C = ['#1e7b4f', '#e8822a', '#46a06e', '#f0a35c', '#145236', '#a65314', '#74bb92', '#78716c'];
const DOW = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
const tooltipEur = (v) => eur(v);

function ChartCard({ title, subtitle, children, className }) {
  return (
    <Card className={cx('p-5', className)}>
      <div className="mb-4">
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-stone-500">{subtitle}</div>}
      </div>
      {children}
    </Card>
  );
}

export default function Stats() {
  const [days, setDays] = useState(30);
  const [storeId, setStoreId] = useState('');
  const { data: stores } = useFetch('/admin/stores');
  const { data, loading } = useFetch(`/admin/stats?days=${days}${storeId ? `&store_id=${storeId}` : ''}`);

  async function exportCsv() {
    const res = await api(`/admin/stats/export.csv?days=${days}${storeId ? `&store_id=${storeId}` : ''}`, { raw: true });
    downloadBlob(await res.blob(), `spesateam-ordini-${days}gg.csv`);
  }

  return (
    <div>
      <PageTitle title="Statistiche" subtitle={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" /> Sezione riservata agli amministratori</span>}
        actions={<Button variant="secondary" icon={Download} onClick={exportCsv}>Esporta ordini (Excel)</Button>} />
      <div className="flex flex-wrap gap-2 items-center mb-6">
        {[7, 30, 90].map((d) => <Pill key={d} active={days === d} onClick={() => setDays(d)}>Ultimi {d} giorni</Pill>)}
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-56 h-8">
          <option value="">Tutti i supermercati</option>
          {(stores || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      {loading || !data ? <Loading label="Calcolo le statistiche…" /> : <StatsBody d={data} />}
    </div>
  );
}

function StatsBody({ d }) {
  const k = d.kpi, p = d.prev;
  const daily = d.daily.map((x) => ({ ...x, label: fmtDateShort(x.day + 'T12:00:00'), revenue: Number(x.revenue) }));
  const payments = d.payments.map((x) => ({ name: PAYMENT[x.method]?.label || x.method, value: x.orders, total: Number(x.total) }));
  const heatMax = Math.max(1, ...d.heat.map((h) => h.n));
  const heatMap = {};
  for (const h of d.heat) heatMap[`${h.dow}-${h.hour}`] = h.n;
  const hours = Array.from({ length: 14 }, (_, i) => i + 8);
  const phases = [
    { name: 'Accettazione', min: Number(d.phases.accept) },
    { name: 'Verso il negozio', min: Number(d.phases.to_store) },
    { name: 'Spesa', min: Number(d.phases.shopping) },
    { name: 'Consegna', min: Number(d.phases.delivery) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Fatturato consegnato" value={eur(k.revenue)} trend={pct(k.revenue, p.revenue)} sub="vs periodo precedente" icon="💶" />
        <Stat label="Ordini consegnati" value={num(k.orders)} trend={pct(k.orders, p.orders)} sub="vs periodo precedente" icon="📦" />
        <Stat label="Scontrino medio" value={eur(k.avg_ticket)} trend={pct(k.avg_ticket, p.avg_ticket)} icon="🧾" />
        <Stat label="Tempo medio ordine → consegna" value={`${Math.round(k.avg_minutes)} min`} icon="⏱️" sub={`valutazione media ★ ${Number(k.avg_rating).toFixed(1).replace('.', ',')}`} />
        <Stat label="Clienti attivi" value={k.customers} icon="👥" sub={`${d.new_customers} nuovi nel periodo`} />
        <Stat label="Clienti che riordinano" value={`${Math.round(d.returning_rate * 100)}%`} icon="🔁" sub="più di un ordine nel periodo" />
        <Stat label="Ordini annullati" value={`${k.all_orders ? ((k.cancelled / k.all_orders) * 100).toFixed(1).replace('.', ',') : 0}%`} icon="↩️" sub={`${k.cancelled} ordini`} />
        <Stat label="Sconti concessi" value={eur(k.discounts)} icon="🏷️" sub={`incassi consegna ${eur(k.delivery_fees)}`} />
      </div>

      <ChartCard title="Andamento giornaliero" subtitle="Ordini consegnati (barre) e fatturato (linea)">
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={daily} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={20} />
              <YAxis yAxisId="o" tick={{ fontSize: 11 }} allowDecimals={false} width={30} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v)}€`} width={50} />
              <Tooltip formatter={(v, n) => (n === 'Fatturato' ? eur(v) : v)} />
              <Bar yAxisId="o" dataKey="orders" name="Ordini" fill="#a8d6ba" radius={[4, 4, 0, 0]} />
              <Line yAxisId="r" dataKey="revenue" name="Fatturato" stroke="#1e7b4f" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Fatturato per supermercato">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={d.byStore.map((s) => ({ ...s, revenue: Number(s.revenue) }))} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipEur} />
                <Bar dataKey="revenue" name="Fatturato" radius={[0, 6, 6, 0]}>
                  {d.byStore.map((s, i) => <Cell key={i} fill={s.color || C[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-stone-500 space-y-0.5 mt-2">
            {d.byStore.map((s) => <div key={s.name} className="flex justify-between"><span>{s.name}</span><span>{s.orders} ordini · prodotti mancanti {String(s.missing_rate).replace('.', ',')}%</span></div>)}
          </div>
        </ChartCard>
        <ChartCard title="Metodi di pagamento" subtitle="Numero di ordini">
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={payments} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {payments.map((_, i) => <Cell key={i} fill={C[i]} />)}
                </Pie>
                <Tooltip formatter={(v, n, it) => [`${v} ordini · ${eur(it.payload.total)}`, n]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Tempi medi per fase" subtitle="Minuti">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={phases}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} width={30} />
                <Tooltip formatter={(v) => `${Math.round(v)} min`} />
                <Bar dataKey="min" name="Minuti" fill="#e8822a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Vendite per reparto">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={d.byCategory.map((c) => ({ ...c, label: `${c.icon} ${c.name}`, revenue: Number(c.revenue) }))} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip formatter={tooltipEur} />
                <Bar dataKey="revenue" name="Fatturato" fill="#1e7b4f" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Quando ordinano i clienti" subtitle="Ordini per giorno della settimana e ora">
          <div className="overflow-x-auto">
            <div className="inline-grid gap-1" style={{ gridTemplateColumns: `40px repeat(${hours.length}, minmax(22px, 1fr))` }}>
              <div />
              {hours.map((h) => <div key={h} className="text-[10px] text-stone-400 text-center">{h}</div>)}
              {DOW.map((dn, di) => (
                <Fragment key={dn}>
                  <div className="text-xs text-stone-500 flex items-center">{dn}</div>
                  {hours.map((h) => {
                    const n = heatMap[`${di + 1}-${h}`] || 0;
                    return <div key={`${dn}-${h}`} title={`${dn} ore ${h}: ${n} ordini`} className="h-7 rounded" style={{ background: n ? `rgba(30,123,79,${0.12 + 0.88 * (n / heatMax)})` : '#f5f5f4' }} />;
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-3">Prodotti più venduti</h2>
          <Table rows={d.topProducts} rowKey="name" columns={[
            { key: 'name', label: 'Prodotto', render: (r) => <span>{r.emoji} {r.name}</span> },
            { key: 'times', label: 'Volte', align: 'right' },
            { key: 'revenue', label: 'Fatturato', align: 'right', render: (r) => eur(r.revenue) },
          ]} />
        </div>
        <div>
          <h2 className="font-semibold mb-3">Prestazioni driver</h2>
          <Table rows={d.drivers} rowKey="name" columns={[
            { key: 'name', label: 'Driver' },
            { key: 'deliveries', label: 'Consegne', align: 'right' },
            { key: 'avg', label: 'Tempo medio', align: 'right', render: (r) => `${r.avg_minutes} min` },
            { key: 'rating', label: 'Voto', align: 'right', render: (r) => (Number(r.rating) ? `★ ${String(r.rating).replace('.', ',')}` : '—') },
            { key: 'cash', label: 'Contanti', align: 'right', render: (r) => eur(r.cash) },
          ]} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div>
          <h2 className="font-semibold mb-3">Coupon utilizzati</h2>
          <Table rows={d.coupons} rowKey="code" empty="Nessun coupon nel periodo" columns={[
            { key: 'code', label: 'Codice', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { key: 'uses', label: 'Usi', align: 'right' },
            { key: 'discount', label: 'Sconto', align: 'right', render: (r) => eur(r.discount) },
            { key: 'revenue', label: 'Ordini', align: 'right', render: (r) => eur(r.revenue) },
          ]} />
        </div>
        <div>
          <h2 className="font-semibold mb-3">Effetto delle promozioni</h2>
          <Table rows={d.promos} rowKey="label" empty="Nessuna promozione nel periodo" columns={[
            { key: 'label', label: 'Promo', render: (r) => <span className="font-semibold text-accent-600">{r.label}</span> },
            { key: 'lines', label: 'Righe', align: 'right' },
            { key: 'discount', label: 'Sconto', align: 'right', render: (r) => eur(r.discount) },
            { key: 'revenue', label: 'Venduto', align: 'right', render: (r) => eur(r.revenue) },
          ]} />
          <div className="text-xs text-stone-500 mt-2">Fedeltà nel periodo: {num(d.loyalty.issued)} punti emessi, {num(d.loyalty.redeemed)} riscattati.</div>
        </div>
        <div>
          <h2 className="font-semibold mb-3">Clienti da recuperare</h2>
          <Table rows={d.inactive} empty="Nessun cliente inattivo" columns={[
            { key: 'name', label: 'Cliente', render: (r) => <div><div>{r.name}</div><div className="text-[10px] text-stone-400">{r.code}</div></div> },
            { key: 'orders', label: 'Ordini', align: 'right' },
            { key: 'last', label: 'Ultimo', align: 'right', render: (r) => <span className="text-xs">{fmtDate(r.last_order)}</span> },
          ]} />
          <div className="text-xs text-stone-500 mt-2">Nessun ordine da oltre 3 settimane: candidati ideali per un coupon personale.</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <ChartCard title="Mappa degli ordini consegnati">
          <MapView className="h-96" markers={d.geo.slice(0, 400).map((g, i) => ({ id: i, lat: g.lat, lng: g.lng, dot: true, color: '#1e7b4f' }))} />
        </ChartCard>
        <div>
          <h2 className="font-semibold mb-3">Vie con più ordini</h2>
          <Table rows={d.streets} rowKey="street" columns={[
            { key: 'street', label: 'Via', render: (r) => <div><div>{r.street}</div><div className="text-[10px] text-stone-400">{r.cap}</div></div> },
            { key: 'orders', label: 'Ordini', align: 'right' },
            { key: 'revenue', label: 'Fatturato', align: 'right', render: (r) => eur(r.revenue) },
          ]} />
          {d.neverSold.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold mb-2">Prodotti mai venduti nel periodo</h2>
              <div className="flex flex-wrap gap-1.5">{d.neverSold.map((p) => <span key={p.name + p.store_name} className="text-xs bg-stone-100 rounded-full px-2.5 py-1">{p.emoji} {p.name}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

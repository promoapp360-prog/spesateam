import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { LogOut, ChevronRight, MapPin, Trash2 } from 'lucide-react';
import { useFetch, useSession } from '../../lib/hooks.js';
import { setSession, del } from '../../lib/api.js';
import { eur, fmtDate, fmtDateTime } from '../../lib/format.js';
import { Card, Loading, StatusBadge, Button, Tabs, Empty, cx } from '../../components/ui.jsx';

function LoyaltyCard({ me }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(`SPESATEAM:${me.code}`, { margin: 1, width: 220, color: { dark: '#145236', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [me.code]);
  const l = me.loyalty;
  const progress = Math.min(100, (l.points / l.reward_threshold) * 100);
  return (
    <div className="rounded-3xl p-6 text-white bg-linear-to-br from-brand-700 via-brand-600 to-brand-900 shadow-xl relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 text-[160px] opacity-10">🛒</div>
      <div className="flex justify-between items-start relative">
        <div>
          <div className="text-xs uppercase tracking-widest text-brand-100">Tessera fedeltà</div>
          <div className="font-display text-2xl font-bold mt-1">Spesa<span className="text-accent-100">Team</span></div>
          <div className="mt-4 text-sm text-brand-50">{me.name}</div>
          <div className="font-mono text-lg tracking-wider">{me.code}</div>
          <div className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Livello {l.tier.current}</div>
        </div>
        {qr && <img src={qr} alt="QR tessera" className="size-24 sm:size-28 rounded-xl bg-white p-1" />}
      </div>
      <div className="mt-6 relative">
        <div className="flex justify-between items-end">
          <div><span className="text-3xl font-bold font-display">{l.points}</span> <span className="text-sm text-brand-100">punti</span></div>
          <div className="text-xs text-brand-100 text-right">
            {l.points >= l.reward_threshold ? `Buono da ${eur(l.reward_value)} disponibile!` : `Ancora ${l.reward_threshold - l.points} punti per un buono da ${eur(l.reward_value)}`}
          </div>
        </div>
        <div className="h-2 bg-white/20 rounded-full mt-2 overflow-hidden"><div className="h-full bg-accent-400 rounded-full" style={{ width: `${progress}%` }} /></div>
        {l.tier.next && <div className="text-[11px] text-brand-100 mt-2">Livello {l.tier.next} a {l.tier.next_min} punti totali (ora {l.lifetime_points})</div>}
      </div>
    </div>
  );
}

export default function Account() {
  const session = useSession('customer');
  const nav = useNavigate();
  const { data: me, loading, reload } = useFetch(session ? '/customer/me' : null);
  const { data: orders } = useFetch(session ? '/customer/orders' : null);
  const [tab, setTab] = useState('orders');
  if (!session) return <Navigate to="/accedi" replace />;
  if (loading || !me) return <Loading />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ciao {me.name.split(' ')[0]} 👋</h1>
          <p className="text-sm text-stone-500">Cliente dal {fmtDate(me.created_at)}</p>
        </div>
        <Button variant="ghost" icon={LogOut} onClick={() => { setSession('customer', null); nav('/'); }}>Esci</Button>
      </div>
      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        <div className="space-y-4">
          <LoyaltyCard me={me} />
          <Card className="p-5">
            <div className="font-semibold mb-3">Indirizzi</div>
            {me.addresses.length === 0 && <div className="text-sm text-stone-500">Nessun indirizzo salvato: lo aggiungerai al primo ordine.</div>}
            <div className="space-y-2">
              {me.addresses.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <MapPin className="size-4 text-brand-600 mt-0.5" />
                  <div className="flex-1">{a.street} {a.civic}, {a.cap} {a.city}</div>
                  <button onClick={async () => { await del(`/customer/me/addresses/${a.id}`); reload(); }} className="text-stone-400 hover:text-red-600"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div>
          <Tabs tabs={[{ value: 'orders', label: 'I miei ordini', count: orders?.length }, { value: 'points', label: 'Movimenti punti' }]} value={tab} onChange={setTab} className="mb-4 w-fit" />
          {tab === 'orders' ? (
            <Card className="divide-y divide-stone-100">
              {(orders || []).length === 0 && <Empty icon="🧾" title="Nessun ordine ancora"><Link to="/" className="text-brand-700 font-semibold">Fai la tua prima spesa</Link></Empty>}
              {(orders || []).map((o) => (
                <Link key={o.id} to={`/ordine/${o.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50">
                  <span className="text-2xl">{o.store_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{o.code} · {o.store_name}</div>
                    <div className="text-xs text-stone-500">{fmtDateTime(o.created_at)} · {o.items_count} prodotti</div>
                  </div>
                  <StatusBadge status={o.status} />
                  <div className="w-20 text-right font-semibold text-sm">{eur(o.total)}</div>
                  <ChevronRight className="size-4 text-stone-400" />
                </Link>
              ))}
            </Card>
          ) : (
            <Card className="divide-y divide-stone-100">
              {me.loyalty.movements.length === 0 && <Empty icon="🎁" title="Ancora nessun punto">Accumuli punti con ogni spesa consegnata.</Empty>}
              {me.loyalty.movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium">{m.reason}</div>
                    <div className="text-xs text-stone-500">{fmtDateTime(m.created_at)}</div>
                  </div>
                  <div className={cx('font-bold', m.points > 0 ? 'text-brand-700' : 'text-accent-600')}>{m.points > 0 ? '+' : ''}{m.points}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

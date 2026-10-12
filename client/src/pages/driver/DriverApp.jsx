import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { LogOut, Navigation, Phone, ChevronLeft, ChevronRight, Check, X, Repeat, MapPin, Play, Package } from 'lucide-react';
import { login, post, setSession } from '../../lib/api.js';
import { useFetch, useSession } from '../../lib/hooks.js';
import { eur, qtyLabel, fmtTime, PAYMENT, PAYMENT_STATUS, ITEM_STATUS, SUB_PREF } from '../../lib/format.js';
import { Button, Card, Field, Input, Loading, ErrorBox, StatusBadge, Badge, Modal, Empty, Tabs, Logo, toast, cx } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';

export default function DriverApp() {
  const session = useSession('driver');
  return (
    <div className="min-h-full bg-stone-100">
      <div className="max-w-md mx-auto min-h-full bg-stone-50 shadow-xl flex flex-col">
        <Routes>
          <Route path="accedi" element={session ? <Navigate to="/driver" replace /> : <DriverLogin />} />
          <Route path="ordine/:id" element={session ? <DriverOrder /> : <Navigate to="/driver/accedi" replace />} />
          <Route index element={session ? <DriverHome /> : <Navigate to="/driver/accedi" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function DriverLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try { await login('driver', email, password); nav('/driver'); } catch (err) { setError(err); } finally { setLoading(false); }
  }
  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-linear-to-br from-accent-500 to-accent-700 text-white px-6 pt-14 pb-10">
        <Logo light />
        <div className="text-3xl font-bold font-display mt-8">App Driver</div>
        <div className="text-accent-50 mt-1">Accedi per vedere le consegne assegnate</div>
      </div>
      <form onSubmit={submit} className="p-6 space-y-4 -mt-4 bg-stone-50 rounded-t-3xl flex-1">
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <ErrorBox error={error} />
        <Button type="submit" variant="accent" size="lg" className="w-full" loading={loading}>Accedi</Button>
        <button type="button" onClick={() => { setEmail('driver1@spesateam.it'); setPassword('demo1234'); }} className="w-full text-xs text-stone-500">
          Usa l'account demo (driver1@spesateam.it)
        </button>
      </form>
    </div>
  );
}

// Invia la posizione reale del telefono quando disponibile
function useGpsReporter(enabled) {
  const [gps, setGps] = useState('off');
  useEffect(() => {
    if (!enabled || !navigator.geolocation) { setGps(navigator.geolocation ? 'off' : 'na'); return; }
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGps('on');
        if (Date.now() - last < 8000) return;
        last = Date.now();
        post('/driver/position', { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(() => {});
      },
      () => setGps('denied'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return gps;
}

function DriverHeader({ me, onStatus }) {
  const nav = useNavigate();
  const available = me?.status !== 'offline';
  return (
    <div className="bg-ink text-white px-5 pt-5 pb-6 rounded-b-3xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-stone-400">Ciao</div>
          <div className="font-semibold text-lg">{me?.name}</div>
        </div>
        <button onClick={() => { setSession('driver', null); nav('/driver/accedi'); }} className="p-2 rounded-lg hover:bg-white/10" aria-label="Esci"><LogOut className="size-5" /></button>
      </div>
      <button onClick={() => onStatus(available ? 'offline' : 'available')}
        className={cx('mt-4 w-full h-12 rounded-2xl font-semibold flex items-center justify-center gap-2 transition',
          available ? 'bg-brand-600' : 'bg-stone-700')}>
        <span className={cx('size-2.5 rounded-full', available ? 'bg-brand-200 animate-pulse' : 'bg-stone-400')} />
        {me?.status === 'busy' ? 'In servizio · occupato' : available ? 'In servizio · disponibile' : 'Fuori servizio · tocca per iniziare'}
      </button>
      {me && (
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="bg-white/10 rounded-xl py-2"><div className="text-xl font-bold">{me.today.delivered}</div><div className="text-[10px] text-stone-300">consegne oggi</div></div>
          <div className="bg-white/10 rounded-xl py-2"><div className="text-xl font-bold">{eur(me.today.cash)}</div><div className="text-[10px] text-stone-300">contanti in cassa</div></div>
          <div className="bg-white/10 rounded-xl py-2"><div className="text-xl font-bold">{me.month.delivered}</div><div className="text-[10px] text-stone-300">questo mese</div></div>
        </div>
      )}
    </div>
  );
}

function DriverHome() {
  const { data: me, reload: reloadMe } = useFetch('/driver/me', { interval: 15000 });
  const { data: orders, loading, reload } = useFetch('/driver/orders', { interval: 5000 });
  const gps = useGpsReporter(me && me.status !== 'offline');
  const prevCount = useRef(null);
  useEffect(() => {
    if (!orders) return;
    const n = orders.filter((o) => o.status === 'accepted').length;
    if (prevCount.current !== null && n > prevCount.current) {
      toast('🔔 Nuovo ordine assegnato!');
      try { navigator.vibrate?.(300); } catch { /* ignore */ }
    }
    prevCount.current = n;
  }, [orders]);

  async function setStatus(s) { await post('/driver/status', { status: s }); reloadMe(); }
  const active = (orders || []).filter((o) => o.status !== 'delivered');
  const done = (orders || []).filter((o) => o.status === 'delivered');

  return (
    <div className="flex-1">
      <DriverHeader me={me} onStatus={setStatus} />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Le tue consegne</h2>
          <span className="text-xs text-stone-500 flex items-center gap-1">
            <MapPin className="size-3.5" /> GPS {gps === 'on' ? 'attivo' : gps === 'denied' ? 'non autorizzato' : 'in attesa'}
          </span>
        </div>
        {loading && !orders ? <Loading /> : active.length === 0 ? (
          <Card><Empty icon="🛵" title="Nessuna consegna assegnata">Resta in servizio: i nuovi ordini compaiono qui automaticamente.</Empty></Card>
        ) : active.map((o) => (
          <Link key={o.id} to={`/driver/ordine/${o.id}`}>
            <Card className="p-4 mb-3 active:scale-[0.99] transition">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{o.code}</div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex gap-2"><span>{o.store_emoji}</span><div><div className="font-medium">{o.store_name}</div><div className="text-xs text-stone-500">{o.store_address}</div></div></div>
                <div className="flex gap-2"><span>🏠</span><div><div className="font-medium">{o.customer_name}</div><div className="text-xs text-stone-500">{o.street} {o.civic}</div></div></div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100 text-xs">
                <span className="text-stone-600">🕐 {o.slot_label} · {o.items_count} prodotti {o.status === 'shopping' && `(${o.items_done} presi)`}</span>
                <span className="font-semibold">{PAYMENT[o.payment_method].icon} {o.payment_method === 'cash' ? `da incassare ${eur(o.total)}` : 'già pagato'}</span>
              </div>
            </Card>
          </Link>
        ))}
        {done.length > 0 && (
          <>
            <h2 className="font-semibold pt-2">Completate oggi</h2>
            {done.map((o) => (
              <Card key={o.id} className="p-3 flex items-center justify-between text-sm">
                <span>{o.code} · {o.customer_name}</span>
                <span className="text-stone-500">{fmtTime(o.delivered_at)}</span>
              </Card>
            ))}
          </>
        )}
        <button onClick={() => { reload(); reloadMe(); }} className="w-full text-xs text-stone-400 py-2">Aggiorna</button>
      </div>
    </div>
  );
}

function DriverOrder() {
  const { id } = useParams();
  const { data: o, loading, error, setData } = useFetch(`/driver/orders/${id}`, { interval: 8000 });
  const [tab, setTab] = useState('spesa');
  const [weighItem, setWeighItem] = useState(null);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState(null);
  const simRef = useRef(null);
  useGpsReporter(o?.status === 'delivering' && !sim);
  useEffect(() => () => clearInterval(simRef.current), []);
  useEffect(() => { if (o?.status === 'delivering') setTab('consegna'); }, [o?.status]);

  if (loading && !o) return <Loading />;
  if (error && !o) return <div className="p-4"><ErrorBox error={error} /></div>;
  if (!o) return null;

  async function setItem(item, status, final_qty) {
    try {
      await post(`/driver/orders/${o.id}/items/${item.id}`, { status, final_qty });
      setData({ ...o, items: o.items.map((i) => (i.id === item.id ? { ...i, status, final_qty: status === 'missing' ? 0 : final_qty ?? i.qty } : i)) });
    } catch (e) { toast(e.message, 'error'); }
  }
  async function advance(status, extra = {}) {
    setBusy(true);
    try {
      const d = await post(`/driver/orders/${o.id}/status`, { status, ...extra });
      setData(d);
      toast(status === 'shopping' ? 'Spesa avviata' : status === 'delivering' ? 'Consegna avviata: il cliente ti vede sulla mappa' : 'Ordine consegnato! 🎉');
      if (status === 'delivered') { clearInterval(simRef.current); setSim(null); setDeliverOpen(false); }
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  function simulate() {
    clearInterval(simRef.current);
    const from = [o.driver_lat ?? o.store_lat, o.driver_lng ?? o.store_lng];
    const to = [o.lat, o.lng];
    const steps = 20;
    let i = 0;
    setSim({ i: 0, steps });
    simRef.current = setInterval(() => {
      i++;
      const t = i / steps;
      const lat = from[0] + (to[0] - from[0]) * t + Math.sin(t * Math.PI) * 0.0006;
      const lng = from[1] + (to[1] - from[1]) * t;
      post('/driver/position', { lat, lng }).catch(() => {});
      setData((d) => (d ? { ...d, driver_lat: lat, driver_lng: lng } : d));
      setSim({ i, steps });
      if (i >= steps) { clearInterval(simRef.current); toast('Sei arrivato a destinazione'); }
    }, 1500);
  }

  const grouped = {};
  for (const it of o.items) (grouped[it.category_name || 'Altro'] ||= []).push(it);
  const pending = o.items.filter((i) => i.status === 'pending').length;
  const navUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  const target = o.status === 'delivering' ? [o.lat, o.lng] : [o.store_lat, o.store_lng];

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-ink text-white px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <Link to="/driver" className="p-2 -ml-2 rounded-lg hover:bg-white/10"><ChevronLeft className="size-5" /></Link>
          <div className="font-semibold">{o.code}</div>
          <StatusBadge status={o.status} />
        </div>
        <div className="mt-3 text-sm">
          <div className="font-semibold text-base">{o.customer_name}</div>
          <div className="text-stone-300">{o.street} {o.civic}, {o.cap} · {[o.intercom && `citofono ${o.intercom}`, o.floor && `piano ${o.floor}`].filter(Boolean).join(', ')}</div>
          {o.address_notes && <div className="text-xs text-accent-100 mt-1">📌 {o.address_notes}</div>}
          {o.notes && <div className="text-xs text-accent-100 mt-1">📝 {o.notes}</div>}
        </div>
        {o.status !== 'delivered' && <div className="grid grid-cols-2 gap-2 mt-4">
          <a href={`tel:${(o.customer_phone || '').replace(/\s/g, '')}`} className="h-11 rounded-xl bg-white/10 flex items-center justify-center gap-2 text-sm font-semibold"><Phone className="size-4" /> Chiama</a>
          <a href={navUrl(target[0], target[1])} target="_blank" rel="noreferrer" className="h-11 rounded-xl bg-brand-600 flex items-center justify-center gap-2 text-sm font-semibold">
            <Navigation className="size-4" /> {o.status === 'delivering' ? 'Naviga dal cliente' : 'Naviga al supermercato'}
          </a>
        </div>}
      </div>

      <div className="px-4 pt-4">
        <Tabs tabs={[{ value: 'spesa', label: `🛒 Spesa (${o.items.length - pending}/${o.items.length})` }, { value: 'consegna', label: '🛵 Consegna' }]} value={tab} onChange={setTab} />
      </div>

      <div className="flex-1 p-4 pb-28 space-y-4">
        {tab === 'spesa' ? (
          <>
            <Card className="p-3 flex items-center gap-3 text-sm">
              <span className="text-2xl">{o.store_emoji}</span>
              <div className="flex-1"><div className="font-semibold">{o.store_name}</div><div className="text-xs text-stone-500">{o.store_address}</div></div>
            </Card>
            {o.status === 'accepted' && <div className="text-xs text-stone-500 bg-white border border-stone-200 rounded-xl p-3">Premi “Inizia la spesa” quando arrivi al supermercato, poi spunta ogni prodotto.</div>}
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">{cat}</div>
                <Card className="divide-y divide-stone-100">
                  {items.map((it) => (
                    <div key={it.id} className={cx('p-3', it.status !== 'pending' && 'bg-stone-50')}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{it.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className={cx('font-medium text-sm', it.status === 'missing' && 'line-through text-stone-400')}>{it.name}</div>
                          <div className="text-xs text-stone-500">
                            <b className="text-ink">{qtyLabel(it.qty, it.unit)}</b>
                            {it.final_qty != null && it.unit === 'kg' && it.status !== 'missing' && <> → pesato <b className="text-ink">{qtyLabel(it.final_qty, it.unit)}</b></>}
                            {' · '}{eur(it.unit_price)}{it.unit === 'kg' ? '/kg' : ''}
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5">Se manca: {SUB_PREF[it.sub_pref].toLowerCase()}</div>
                          {it.note && <div className="text-[11px] text-accent-700">📝 {it.note}</div>}
                        </div>
                        {it.status !== 'pending' && <Badge className={ITEM_STATUS[it.status].color}>{ITEM_STATUS[it.status].label}</Badge>}
                      </div>
                      {o.status === 'shopping' && (
                        <div className="flex gap-2 mt-2 ml-9">
                          <button onClick={() => (it.unit === 'kg' ? setWeighItem(it) : setItem(it, 'picked', it.qty))}
                            className={cx('flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border', it.status === 'picked' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-stone-300')}>
                            <Check className="size-4" /> {it.unit === 'kg' ? 'Pesa' : 'Preso'}
                          </button>
                          <button onClick={() => setItem(it, 'substituted', it.qty)}
                            className={cx('h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 border', it.status === 'substituted' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-stone-300')}>
                            <Repeat className="size-4" /> Sostituito
                          </button>
                          <button onClick={() => setItem(it, 'missing', 0)}
                            className={cx('h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 border', it.status === 'missing' ? 'bg-red-600 text-white border-red-600' : 'bg-white border-stone-300')}>
                            <X className="size-4" /> Manca
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            ))}
          </>
        ) : (
          <>
            <MapView
              className="h-72"
              markers={[
                { id: 's', lat: o.store_lat, lng: o.store_lng, emoji: o.store_emoji, color: '#e8822a', label: o.store_name },
                { id: 'h', lat: o.lat, lng: o.lng, emoji: '🏠', label: o.customer_name },
                ...(o.driver_lat ? [{ id: 'd', lat: o.driver_lat, lng: o.driver_lng, emoji: '🛵', pulse: true, label: 'Tu' }] : []),
              ]}
              lines={o.driver_lat ? [[[o.driver_lat, o.driver_lng], [o.lat, o.lng]]] : []}
            />
            {o.status === 'delivering' && (
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">Posizione condivisa con il cliente</div>
                    <div className="text-xs text-stone-500">{sim ? `Simulazione percorso ${Math.round((sim.i / sim.steps) * 100)}%` : 'Dal GPS del telefono, ogni pochi secondi'}</div>
                  </div>
                  <Button size="sm" variant="secondary" icon={Play} onClick={simulate}>Simula percorso</Button>
                </div>
              </Card>
            )}
            <Card className="p-4 text-sm space-y-1.5">
              <div className="font-semibold mb-1 flex items-center gap-2"><Package className="size-4" /> Riepilogo</div>
              <div className="flex justify-between"><span className="text-stone-500">Prodotti</span><span>{o.items.length} ({o.items.filter((i) => i.status === 'missing').length} mancanti)</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Pagamento</span><span>{PAYMENT[o.payment_method].icon} {PAYMENT[o.payment_method].label} · {PAYMENT_STATUS[o.payment_status]}</span></div>
              <div className="flex justify-between font-bold text-base pt-1"><span>{o.status === 'delivered' ? (o.payment_method === 'cash' ? 'Incassato' : 'Addebitato') : o.payment_method === 'cash' ? 'Da incassare' : 'Totale (già pagato)'}</span><span>{eur(o.total)}</span></div>
            </Card>
          </>
        )}
      </div>

      {['accepted', 'shopping', 'delivering'].includes(o.status) && (
        <div className="fixed bottom-0 inset-x-0 z-20">
          <div className="max-w-md mx-auto p-4 bg-linear-to-t from-stone-50 via-stone-50 to-stone-50/0">
            {o.status === 'accepted' && <Button size="lg" variant="accent" className="w-full h-14" loading={busy} onClick={() => advance('shopping')}>🛒 Inizia la spesa</Button>}
            {o.status === 'shopping' && (
              <Button size="lg" className="w-full h-14" loading={busy} onClick={() => {
                if (pending > 0 && !window.confirm(`${pending} prodotti non sono stati spuntati: verranno considerati presi. Continuare?`)) return;
                advance('delivering');
              }}>
                Spesa completata · parti per la consegna <ChevronRight className="size-4" />
              </Button>
            )}
            {o.status === 'delivering' && <Button size="lg" className="w-full h-14" onClick={() => setDeliverOpen(true)}>🏠 Conferma consegna</Button>}
          </div>
        </div>
      )}

      <WeighModal item={weighItem} onClose={() => setWeighItem(null)} onSave={(q) => { setItem(weighItem, 'picked', q); setWeighItem(null); }} />
      <DeliverModal open={deliverOpen} order={o} busy={busy} onClose={() => setDeliverOpen(false)} onConfirm={(extra) => advance('delivered', extra)} />
    </div>
  );
}

function WeighModal({ item, onClose, onSave }) {
  const [g, setG] = useState('');
  useEffect(() => { if (item) setG(String(Math.round(Number(item.qty) * 1000))); }, [item]);
  if (!item) return null;
  return (
    <Modal open onClose={onClose} title={`Peso effettivo · ${item.name}`} size="sm"
      footer={<Button className="w-full" onClick={() => onSave(Math.max(0, Number(g) / 1000))}>Salva peso</Button>}>
      <div className="text-sm text-stone-500 mb-3">Ordinato: <b className="text-ink">{qtyLabel(item.qty, 'kg')}</b>. Inserisci il peso indicato dalla bilancia.</div>
      <div className="flex items-center gap-2">
        <Input type="number" inputMode="numeric" value={g} onChange={(e) => setG(e.target.value)} className="text-2xl h-14 text-center font-bold" />
        <span className="text-lg font-semibold">grammi</span>
      </div>
      <div className="text-sm text-right mt-3">Importo: <b>{eur((Number(g) / 1000) * Number(item.unit_price))}</b></div>
    </Modal>
  );
}

function DeliverModal({ open, order, busy, onClose, onConfirm }) {
  const [cash, setCash] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setCash(String(order.total)); setNote(''); } }, [open, order.total]);
  if (!open) return null;
  const isCash = order.payment_method === 'cash';
  const change = Number(cash) - Number(order.total);
  return (
    <Modal open onClose={onClose} title="Conferma consegna" size="sm"
      footer={<Button className="w-full" size="lg" loading={busy} onClick={() => onConfirm({ cash_collected: isCash ? Number(order.total) : undefined, proof_note: note || 'Consegnato al cliente' })}>Consegnato ✓</Button>}>
      {isCash ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-accent-50 border border-accent-100 p-4 text-center">
            <div className="text-sm text-stone-600">Totale da incassare</div>
            <div className="text-3xl font-bold font-display">{eur(order.total)}</div>
          </div>
          <Field label="Contanti ricevuti"><Input type="number" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} className="text-lg" /></Field>
          {change > 0 && <div className="text-sm">Resto da dare: <b>{eur(change)}</b></div>}
        </div>
      ) : (
        <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">Ordine già pagato con {PAYMENT[order.payment_method].label}: alla conferma verrà addebitato il totale reale di <b>{eur(order.total)}</b>.</div>
      )}
      <Field label="Prova di consegna" className="mt-4" hint="In produzione: foto o firma del cliente">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. consegnato a mano / lasciato al portiere" />
      </Field>
    </Modal>
  );
}

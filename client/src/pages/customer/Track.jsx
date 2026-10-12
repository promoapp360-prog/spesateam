import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Phone, Star, PartyPopper } from 'lucide-react';
import { useFetch } from '../../lib/hooks.js';
import { post } from '../../lib/api.js';
import { eur, fmtTime, dayLabel, qtyLabel, PAYMENT, PAYMENT_STATUS, ITEM_STATUS, SUB_PREF } from '../../lib/format.js';
import { Card, Loading, ErrorBox, StatusBadge, Badge, Button, Modal, toast, cx } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';

const STEPS = [
  ['received', 'Ordine ricevuto', '📝'],
  ['accepted', 'Accettato', '✅'],
  ['shopping', 'Il driver fa la spesa', '🛒'],
  ['delivering', 'In consegna', '🛵'],
  ['delivered', 'Consegnato', '🏠'],
];

export default function Track() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { data: o, error, loading, reload } = useFetch(`/customer/orders/${id}`, { interval: 4000 });
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (loading && !o) return <Loading />;
  if (error && !o) return <div className="max-w-3xl mx-auto p-4"><ErrorBox error={error} /></div>;
  if (!o) return null;

  const idx = STEPS.findIndex((s) => s[0] === o.status);
  const evAt = (st) => o.events.find((e) => e.status === st)?.created_at;
  const markers = [
    { id: 's', lat: o.store_lat, lng: o.store_lng, emoji: o.store_emoji || '🛒', color: '#e8822a', label: o.store_name },
    { id: 'h', lat: o.lat, lng: o.lng, emoji: '🏠', color: '#1e7b4f', label: 'Casa tua' },
  ];
  if (o.status === 'delivering' && o.driver_lat) markers.push({ id: 'd', lat: o.driver_lat, lng: o.driver_lng, emoji: '🛵', color: '#1e7b4f', pulse: true, label: o.driver_name });
  const missing = o.items.filter((i) => i.status === 'missing');

  async function cancel() {
    try {
      await post(`/customer/orders/${o.id}/cancel`);
      toast('Ordine annullato');
      setConfirmCancel(false);
      reload();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function rate(n) {
    await post(`/customer/orders/${o.id}/rate`, { rating: n });
    toast('Grazie per la valutazione!');
    reload();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {sp.get('nuovo') && o.status === 'received' && (
        <div className="mb-5 rounded-2xl bg-brand-600 text-white p-5 flex items-center gap-4">
          <PartyPopper className="size-8 shrink-0" />
          <div>
            <div className="font-semibold text-lg">Grazie! Il tuo ordine è stato inviato</div>
            <div className="text-sm text-brand-50">Puoi seguire qui ogni passaggio, dalla spesa alla consegna.</div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="text-sm text-stone-500">Ordine {o.code} · {o.store_name}</div>
          <h1 className="text-2xl font-bold">
            {o.status === 'delivered' ? 'Consegnato, buon appetito! 🎉' : o.status === 'cancelled' ? 'Ordine annullato' : `Consegna ${dayLabel(o.slot_date).toLowerCase()}, ${o.slot_label.replace('-', '–')}`}
          </h1>
        </div>
        <StatusBadge status={o.status} className="text-sm px-3 py-1" />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        <div className="space-y-5">
          {o.status !== 'cancelled' && (
            <Card className="p-5">
              <div className="flex justify-between relative">
                <div className="absolute top-5 left-6 right-6 h-1 bg-stone-200 rounded" />
                <div className="absolute top-5 left-6 h-1 bg-brand-500 rounded transition-all duration-700" style={{ width: `calc((100% - 48px) * ${Math.max(0, idx) / (STEPS.length - 1)})` }} />
                {STEPS.map(([st, label, emoji], i) => (
                  <div key={st} className="relative flex flex-col items-center text-center w-16 sm:w-24">
                    <div className={cx('size-10 rounded-full flex items-center justify-center text-lg border-4 transition',
                      i <= idx ? 'bg-brand-600 border-brand-100' : 'bg-white border-stone-200 grayscale opacity-60',
                      i === idx && o.status !== 'delivered' && 'ring-4 ring-brand-200 animate-pulse')}>{emoji}</div>
                    <div className={cx('text-[11px] sm:text-xs mt-2 font-medium leading-tight', i <= idx ? 'text-ink' : 'text-stone-400')}>{label}</div>
                    <div className="text-[10px] text-stone-400">{fmtTime(evAt(st))}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {o.status !== 'cancelled' && (
            <div>
              <MapView markers={markers} lines={o.status === 'delivering' && o.driver_lat ? [[[o.driver_lat, o.driver_lng], [o.lat, o.lng]]] : []} className="h-80" />
              {o.status === 'delivering' && (
                <Card className="p-4 mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-brand-50 flex items-center justify-center text-2xl">🛵</div>
                    <div>
                      <div className="font-semibold">{o.driver_name} sta arrivando</div>
                      <div className="text-xs text-stone-500">{o.driver_vehicle} · posizione aggiornata {fmtTime(o.driver_position_at)}</div>
                    </div>
                  </div>
                  <Button variant="soft" size="sm" icon={Phone}>Chiama</Button>
                </Card>
              )}
            </div>
          )}

          {missing.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
              <b>{missing.length} prodott{missing.length === 1 ? 'o non disponibile' : 'i non disponibili'}</b>: {missing.map((m) => m.name).join(', ')}. Non ti verranno addebitati.
            </div>
          )}

          <Card>
            <div className="px-5 py-4 border-b border-stone-100 font-semibold">La tua spesa ({o.items.length} prodotti)</div>
            <div className="divide-y divide-stone-100">
              {o.items.map((i) => (
                <div key={i.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <span className="text-2xl">{i.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className={cx('font-medium', i.status === 'missing' && 'line-through text-stone-400')}>{i.name}</div>
                    <div className="text-xs text-stone-500">
                      {qtyLabel(i.qty, i.unit)}
                      {i.final_qty != null && i.unit === 'kg' && Number(i.final_qty) !== Number(i.qty) && ` → pesato ${qtyLabel(i.final_qty, i.unit)}`}
                      {i.promo_label && <span className="ml-2 text-accent-600 font-semibold">{i.promo_label}</span>}
                      {i.status === 'pending' && ['received', 'accepted'].includes(o.status) && <span className="ml-2 text-stone-400">· se manca: {SUB_PREF[i.sub_pref].toLowerCase()}</span>}
                    </div>
                  </div>
                  {i.status !== 'pending' && <Badge className={ITEM_STATUS[i.status].color}>{ITEM_STATUS[i.status].label}</Badge>}
                  <div className="w-16 text-right font-medium">{eur(i.line_total)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5 text-sm space-y-1.5">
            <div className="font-semibold text-base mb-2">Pagamento</div>
            <Line l="Prodotti" v={eur(o.items_total)} />
            {o.promo_discount > 0 && <Line l="Promozioni" v={`− ${eur(o.promo_discount)}`} />}
            {o.coupon_discount > 0 && <Line l={`Codice ${o.coupon_code}`} v={`− ${eur(o.coupon_discount)}`} />}
            {o.points_discount > 0 && <Line l="Premio fedeltà" v={`− ${eur(o.points_discount)}`} />}
            <Line l="Consegna" v={o.delivery_fee > 0 ? eur(o.delivery_fee) : 'Gratis'} />
            <div className="flex justify-between pt-2 border-t border-stone-100 font-bold text-lg">
              <span>Totale</span><span>{eur(o.total)}</span>
            </div>
            {Number(o.estimated_total) !== Number(o.total) && <div className="text-xs text-stone-500">Stimato all'ordine: {eur(o.estimated_total)}</div>}
            <div className="flex justify-between text-xs pt-2">
              <span>{PAYMENT[o.payment_method].icon} {PAYMENT[o.payment_method].label}</span>
              <span className="text-stone-500">{PAYMENT_STATUS[o.payment_status]}</span>
            </div>
            {o.points_earned > 0 && <div className="text-xs text-accent-600">+{o.points_earned} punti fedeltà accreditati</div>}
          </Card>
          <Card className="p-5 text-sm">
            <div className="font-semibold text-base mb-2">Consegna</div>
            <div>{o.street} {o.civic}, {o.cap} {o.city}</div>
            <div className="text-stone-500 text-xs mt-1">{[o.intercom && `Citofono ${o.intercom}`, o.floor && `Piano ${o.floor}`, o.address_notes].filter(Boolean).join(' · ')}</div>
            {o.notes && <div className="text-xs mt-2 bg-stone-50 rounded-lg p-2">📝 {o.notes}</div>}
          </Card>
          {o.status === 'delivered' && (
            <Card className="p-5 text-center">
              <div className="font-semibold mb-2">Com'è andata la consegna?</div>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => rate(n)}><Star className={cx('size-8', (o.rating || 0) >= n ? 'fill-accent-500 text-accent-500' : 'text-stone-300')} /></button>
                ))}
              </div>
            </Card>
          )}
          {['received', 'accepted'].includes(o.status) && (
            <Button variant="secondary" className="w-full" onClick={() => setConfirmCancel(true)}>Annulla ordine</Button>
          )}
          <Link to="/account" className="block text-center text-sm text-brand-700 font-medium">I miei ordini</Link>
        </div>
      </div>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Annullare l'ordine?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirmCancel(false)}>No</Button><Button variant="danger" onClick={cancel}>Sì, annulla</Button></>}>
        <p className="text-sm text-stone-600">{o.payment_method === 'cash' ? 'L\'ordine verrà annullato.' : 'L\'ordine verrà annullato e l\'importo autorizzato sarà rilasciato sul tuo metodo di pagamento.'}</p>
      </Modal>
    </div>
  );
}

function Line({ l, v }) {
  return <div className="flex justify-between"><span className="text-stone-500">{l}</span><span>{v}</span></div>;
}

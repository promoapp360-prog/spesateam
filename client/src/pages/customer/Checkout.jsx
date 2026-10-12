import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Clock, CreditCard, Tag, Gift, Scale, Lock, CircleCheck } from 'lucide-react';
import { useCart } from '../../lib/cart.jsx';
import { post } from '../../lib/api.js';
import { useFetch, useSession, useDebounced } from '../../lib/hooks.js';
import { eur, dayLabel, qtyLabel, PAYMENT } from '../../lib/format.js';
import { Button, Card, Field, Input, Textarea, Empty, ErrorBox, Modal, Toggle, toast, cx } from '../../components/ui.jsx';
import AuthForm from './AuthForm.jsx';

function Section({ n, title, icon: Icon, children }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="size-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">{n}</span>
        <h2 className="font-semibold text-lg flex items-center gap-2">{Icon && <Icon className="size-5 text-brand-600" />}{title}</h2>
      </div>
      {children}
    </Card>
  );
}

const EMPTY_ADDR = { street: '', civic: '', cap: '', intercom: '', floor: '', notes: '' };

export default function Checkout() {
  const { cart, list, clear } = useCart();
  const session = useSession('customer');
  const nav = useNavigate();
  const { data: me, reload: reloadMe } = useFetch(session ? '/customer/me' : null);
  const { data: slotsData } = useFetch('/public/slots');
  const [addrId, setAddrId] = useState(null);
  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [slot, setSlot] = useState(null);
  const [day, setDay] = useState(0);
  const [payment, setPayment] = useState('card');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [useReward, setUseReward] = useState(false);
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (me?.addresses?.length && addrId === null) setAddrId(me.addresses[0].id);
    if (me && !me.addresses?.length && addrId === null) setAddrId('new');
  }, [me, addrId]);

  const itemsPayload = useMemo(() => list.map((i) => ({ product_id: i.product.id, qty: i.qty, sub_pref: i.sub_pref, note: i.note })), [list]);
  const quoteKey = useDebounced(JSON.stringify({ itemsPayload, coupon, useReward, s: cart.storeId, auth: !!session }), 250);

  useEffect(() => {
    if (!session || !cart.storeId || !itemsPayload.length) return;
    post('/customer/cart/quote', { store_id: cart.storeId, items: itemsPayload, coupon_code: coupon || null, use_reward: useReward })
      .then((q) => { setQuote(q); setQuoteErr(null); })
      .catch((e) => setQuoteErr(e));
  }, [quoteKey]);

  if (!list.length) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <Empty icon="🛒" title="Il carrello è vuoto">
          <Link to="/" className="text-brand-700 font-semibold">Scegli un supermercato</Link> e aggiungi i prodotti.
        </Empty>
      </div>
    );
  }

  const address = addrId === 'new' || !me ? addr : me.addresses.find((a) => a.id === addrId) || addr;
  const days = slotsData || [];
  const canPlace = session && quote && quote.min_order_ok && slot && address?.street && address?.cap && !quote.coupon_error;

  async function placeOrder() {
    setError(null);
    setPlacing(true);
    try {
      const o = await post('/customer/orders', {
        store_id: cart.storeId, items: itemsPayload, coupon_code: coupon || null, use_reward: useReward,
        address: { street: address.street, civic: address.civic, cap: address.cap, intercom: address.intercom, floor: address.floor, notes: address.notes, lat: address.lat, lng: address.lng },
        slot_date: slot.date, slot_label: slot.label, payment_method: payment, notes,
      });
      clear();
      setPayModal(null);
      toast('Ordine inviato! 🎉');
      nav(`/ordine/${o.id}?nuovo=1`);
    } catch (e) {
      setError(e);
      setPayModal(null);
    } finally {
      setPlacing(false);
    }
  }

  function onConfirm() {
    if (payment === 'cash') placeOrder();
    else setPayModal(payment);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">Cassa</h1>
      <p className="text-sm text-stone-500 mb-6">Spesa da <b>{cart.storeName}</b></p>
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-5">
          {!session ? (
            <Section n={1} title="Accedi o registrati">
              <p className="text-sm text-stone-500 mb-4">Serve un account per seguire l'ordine e accumulare i punti della tessera fedeltà.</p>
              <AuthForm onDone={reloadMe} />
            </Section>
          ) : (
            <>
              <Section n={1} title="Indirizzo di consegna" icon={MapPin}>
                <div className="space-y-2">
                  {(me?.addresses || []).map((a) => (
                    <label key={a.id} className={cx('flex items-start gap-3 p-3 rounded-xl border cursor-pointer', addrId === a.id ? 'border-brand-500 bg-brand-50' : 'border-stone-200')}>
                      <input type="radio" checked={addrId === a.id} onChange={() => setAddrId(a.id)} className="mt-1 accent-brand-600" />
                      <div className="text-sm">
                        <div className="font-medium">{a.street} {a.civic}, {a.cap} {a.city}</div>
                        <div className="text-stone-500 text-xs">{[a.intercom && `Citofono: ${a.intercom}`, a.floor && `Piano ${a.floor}`, a.notes].filter(Boolean).join(' · ')}</div>
                      </div>
                    </label>
                  ))}
                  <label className={cx('flex items-center gap-3 p-3 rounded-xl border cursor-pointer', addrId === 'new' ? 'border-brand-500 bg-brand-50' : 'border-stone-200')}>
                    <input type="radio" checked={addrId === 'new'} onChange={() => setAddrId('new')} className="accent-brand-600" />
                    <span className="text-sm font-medium">Nuovo indirizzo</span>
                  </label>
                </div>
                {addrId === 'new' && (
                  <div className="grid grid-cols-6 gap-3 mt-4">
                    <Field label="Via / Piazza" className="col-span-4"><Input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></Field>
                    <Field label="Civico" className="col-span-2"><Input value={addr.civic} onChange={(e) => setAddr({ ...addr, civic: e.target.value })} /></Field>
                    <Field label="CAP" className="col-span-2"><Input value={addr.cap} maxLength={5} inputMode="numeric" onChange={(e) => setAddr({ ...addr, cap: e.target.value })} /></Field>
                    <Field label="Citofono" className="col-span-2"><Input value={addr.intercom} onChange={(e) => setAddr({ ...addr, intercom: e.target.value })} /></Field>
                    <Field label="Piano" className="col-span-2"><Input value={addr.floor} onChange={(e) => setAddr({ ...addr, floor: e.target.value })} /></Field>
                    <Field label="Note per il driver" className="col-span-6"><Input value={addr.notes} placeholder="Es. scala B, suonare due volte" onChange={(e) => setAddr({ ...addr, notes: e.target.value })} /></Field>
                  </div>
                )}
              </Section>

              <Section n={2} title="Quando vuoi riceverla?" icon={Clock}>
                <div className="flex gap-2 overflow-x-auto scrollbar-none mb-4">
                  {days.map((d, i) => (
                    <button key={d.date} onClick={() => setDay(i)}
                      className={cx('px-4 h-10 rounded-xl text-sm font-medium whitespace-nowrap border capitalize', day === i ? 'bg-ink text-white border-ink' : 'bg-white border-stone-300')}>
                      {dayLabel(d.date)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(days[day]?.slots || []).map((s) => {
                    const selected = slot && slot.date === days[day].date && slot.label === s.label;
                    return (
                      <button key={s.label} disabled={!s.available} onClick={() => setSlot({ date: days[day].date, label: s.label })}
                        className={cx('h-14 rounded-xl border text-sm font-semibold flex flex-col items-center justify-center transition',
                          selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-stone-300 hover:border-brand-400',
                          !s.available && 'opacity-40 cursor-not-allowed hover:border-stone-300')}>
                        {s.label.replace('-', ' – ')}
                        <span className={cx('text-[11px] font-normal', selected ? 'text-brand-50' : 'text-stone-500')}>
                          {s.available ? (s.remaining <= 3 ? `ultimi ${s.remaining} posti` : 'disponibile') : 'non disponibile'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section n={3} title="Pagamento" icon={CreditCard}>
                <div className="grid sm:grid-cols-3 gap-2">
                  {[
                    ['card', 'Carta', 'Visa, Mastercard, Apple Pay, Google Pay'],
                    ['paypal', 'PayPal', 'Paga con il tuo conto PayPal'],
                    ['cash', 'Contanti', 'Paghi al driver alla consegna'],
                  ].map(([k, t, d]) => (
                    <label key={k} className={cx('p-3 rounded-xl border cursor-pointer', payment === k ? 'border-brand-500 bg-brand-50' : 'border-stone-200')}>
                      <div className="flex items-center gap-2">
                        <input type="radio" checked={payment === k} onChange={() => setPayment(k)} className="accent-brand-600" />
                        <span className="font-semibold text-sm">{PAYMENT[k].icon} {t}</span>
                      </div>
                      <div className="text-xs text-stone-500 mt-1 ml-6">{d}</div>
                    </label>
                  ))}
                </div>
                {quote?.has_weight && payment !== 'cash' && (
                  <div className="flex gap-2 text-xs text-stone-600 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                    <Scale className="size-4 shrink-0 text-amber-600" />
                    Per i prodotti a peso autorizziamo l'importo stimato più un margine del {quote.weight_margin_pct}%. Alla consegna addebitiamo solo il totale reale.
                  </div>
                )}
                {payment === 'cash' && (
                  <div className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-3 mt-3">
                    Il totale definitivo ti verrà comunicato dal driver alla consegna, dopo la pesatura dei prodotti a peso.
                  </div>
                )}
              </Section>

              <Section n={4} title="Sconti e note" icon={Tag}>
                <div className="flex gap-2">
                  <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Codice sconto" />
                  <Button variant="secondary" onClick={() => setCoupon(couponInput.trim())}>Applica</Button>
                </div>
                {quote?.coupon_error && <div className="text-xs text-red-600 mt-2">{quote.coupon_error}</div>}
                {quote?.coupon_code && <div className="text-xs text-brand-700 mt-2 flex items-center gap-1"><CircleCheck className="size-3.5" /> Codice {quote.coupon_code} applicato</div>}
                <div className="text-xs text-stone-400 mt-2">Prova: BENVENUTO10 · SPESA5 · CONSEGNAGRATIS</div>
                {me && (
                  <div className="mt-4 p-3 rounded-xl bg-accent-50 border border-accent-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Gift className="size-5 text-accent-600" />
                      <div>
                        <div className="font-semibold">Hai {me.loyalty.points} punti</div>
                        <div className="text-xs text-stone-600">
                          {quote?.reward_available ? `Usa ${me.loyalty.reward_threshold} punti per ${eur(me.loyalty.reward_value)} di sconto` : `Ti servono ${me.loyalty.reward_threshold} punti per un buono da ${eur(me.loyalty.reward_value)}`}
                        </div>
                      </div>
                    </div>
                    {quote?.reward_available && <Toggle checked={useReward} onChange={setUseReward} />}
                  </div>
                )}
                <Field label="Note sull'ordine" className="mt-4">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Es. pomodori non troppo maturi, pane ben cotto…" />
                </Field>
              </Section>
            </>
          )}
        </div>

        <div className="lg:sticky lg:top-20">
          <Card className="p-5">
            <h2 className="font-semibold text-lg mb-3">Riepilogo</h2>
            <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 -mx-1 px-1">
              {(quote?.lines || list.map((i) => ({ product_id: i.product.id, name: i.product.name, emoji: i.product.emoji, qty: i.qty, unit: i.product.unit, line_total: (i.product.promo?.unit_price ?? i.product.price) * i.qty }))).map((l) => (
                <div key={l.product_id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="text-lg">{l.emoji}</span>
                  <span className="flex-1 min-w-0 truncate">{l.name}</span>
                  <span className="text-stone-500 text-xs">{qtyLabel(l.qty, l.unit)}</span>
                  <span className="w-16 text-right font-medium">{eur(l.line_total)}</span>
                </div>
              ))}
            </div>
            {quoteErr && <ErrorBox error={quoteErr} />}
            {quote ? (
              <div className="border-t border-stone-100 mt-3 pt-3 space-y-1.5 text-sm">
                <Row label="Prodotti" value={eur(quote.items_total)} />
                {quote.promo_discount > 0 && <Row label="Promozioni" value={`− ${eur(quote.promo_discount)}`} green />}
                {quote.coupon_discount > 0 && <Row label={`Codice ${quote.coupon_code}`} value={`− ${eur(quote.coupon_discount)}`} green />}
                {quote.points_discount > 0 && <Row label="Premio fedeltà" value={`− ${eur(quote.points_discount)}`} green />}
                <Row label="Consegna" value={quote.delivery_fee > 0 ? eur(quote.delivery_fee) : 'Gratis'} />
                {quote.missing_for_free > 0 && (
                  <div className="text-xs text-brand-700 bg-brand-50 rounded-lg px-2 py-1.5">Aggiungi {eur(quote.missing_for_free)} per la consegna gratuita</div>
                )}
                <div className="flex justify-between items-end pt-2 border-t border-stone-100">
                  <span className="font-semibold">Totale{quote.has_weight && ' stimato'}</span>
                  <span className="text-2xl font-bold font-display">{eur(quote.total)}</span>
                </div>
                {quote.points_earned > 0 && <div className="text-xs text-accent-600 text-right">+{quote.points_earned} punti fedeltà</div>}
                {quote.warnings.map((w) => <div key={w} className="text-xs text-red-600">{w}</div>)}
              </div>
            ) : session ? null : (
              <div className="text-xs text-stone-500 mt-3">Accedi per vedere costi di consegna, sconti e punti.</div>
            )}
            <ErrorBox error={error} />
            <Button size="lg" className="w-full mt-4" disabled={!canPlace} loading={placing} onClick={onConfirm}>
              {payment === 'cash' ? 'Conferma ordine' : `Paga ${quote ? eur(quote.total) : ''}`}
            </Button>
            {session && !slot && <div className="text-xs text-stone-500 text-center mt-2">Scegli una fascia oraria per continuare</div>}
            <div className="text-[11px] text-stone-400 text-center mt-3 flex items-center justify-center gap-1"><Lock className="size-3" /> Pagamenti sicuri · modalità demo</div>
          </Card>
        </div>
      </div>

      <PaymentModal method={payModal} total={quote?.total} onClose={() => setPayModal(null)} onPay={placeOrder} loading={placing} />
    </div>
  );
}

function Row({ label, value, green }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}</span>
      <span className={green ? 'text-brand-700 font-medium' : ''}>{value}</span>
    </div>
  );
}

function PaymentModal({ method, total, onClose, onPay, loading }) {
  const [busy, setBusy] = useState(false);
  if (!method) return null;
  const pay = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1100));
    setBusy(false);
    onPay();
  };
  return (
    <Modal open onClose={onClose} title={method === 'card' ? 'Pagamento con carta' : 'Pagamento con PayPal'} size="sm">
      <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mb-4">
        Modalità di prova: nessun addebito reale. In produzione qui si apre il pagamento sicuro di {method === 'card' ? 'Stripe' : 'PayPal'}.
      </div>
      {method === 'card' ? (
        <div className="space-y-3">
          <Field label="Numero carta"><Input defaultValue="4242 4242 4242 4242" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scadenza"><Input defaultValue="12/29" /></Field>
            <Field label="CVC"><Input defaultValue="123" /></Field>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="text-4xl font-bold text-[#003087]">Pay<span className="text-[#009cde]">Pal</span></div>
          <div className="text-sm text-stone-500 mt-2">Accesso simulato a conto PayPal demo</div>
        </div>
      )}
      <Button size="lg" className="w-full mt-5" loading={busy || loading} onClick={pay}>
        Autorizza {eur(total)}
      </Button>
    </Modal>
  );
}

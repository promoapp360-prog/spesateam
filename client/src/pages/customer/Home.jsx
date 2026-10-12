import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, CircleCheck, CircleX, ChevronRight } from 'lucide-react';
import { post } from '../../lib/api.js';
import { useFetch, useSession } from '../../lib/hooks.js';
import { eur } from '../../lib/format.js';
import { Button, Card, Input, Loading, StatusBadge } from '../../components/ui.jsx';

export default function Home() {
  const { data: stores, loading } = useFetch('/public/stores');
  const { data: settings } = useFetch('/public/settings');
  const session = useSession('customer');
  const { data: orders } = useFetch(session ? '/customer/orders' : null);
  const active = (orders || []).filter((o) => ['received', 'accepted', 'shopping', 'delivering'].includes(o.status));
  const [cap, setCap] = useState('');
  const [capResult, setCapResult] = useState(null);

  async function checkCap(e) {
    e.preventDefault();
    if (!cap) return;
    setCapResult(await post('/public/check-cap', { cap }));
  }

  return (
    <div>
      {active.length > 0 && (
        <div className="bg-accent-50 border-b border-accent-100">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2">
            {active.map((o) => (
              <Link key={o.id} to={`/ordine/${o.id}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2"><span className="text-lg">🛵</span> Ordine <b>{o.code}</b> da {o.store_name}</span>
                <span className="flex items-center gap-2"><StatusBadge status={o.status} /> <ChevronRight className="size-4" /></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <section className="relative overflow-hidden bg-linear-to-br from-brand-700 via-brand-600 to-brand-800 text-white">
        <div className="absolute -right-16 -top-16 text-[220px] opacity-10 select-none">🛒</div>
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20 relative">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              <MapPin className="size-3.5" /> {settings?.service?.city || 'Casavatore'} · consegna in giornata
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold mt-4 leading-tight">
              La spesa dei supermercati del quartiere, <span className="text-accent-100">a casa tua.</span>
            </h1>
            <p className="mt-4 text-brand-50/90 text-lg">
              Scegli il tuo supermercato, riempi il carrello e scegli quando riceverla. Paghi con carta, PayPal o in contanti al driver.
            </p>
            <form onSubmit={checkCap} className="mt-8 flex gap-2 max-w-md">
              <Input value={cap} onChange={(e) => { setCap(e.target.value); setCapResult(null); }} inputMode="numeric" maxLength={5}
                placeholder="Inserisci il tuo CAP" className="h-12 text-base text-ink" />
              <Button variant="accent" size="lg" type="submit">Verifica</Button>
            </form>
            {capResult && (
              <div className={`mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${capResult.ok ? 'bg-white text-brand-800' : 'bg-white text-red-700'}`}>
                {capResult.ok ? <CircleCheck className="size-4" /> : <CircleX className="size-4" />}
                {capResult.ok ? 'Ottimo! Consegniamo nella tua zona.' : `Al momento consegniamo nei CAP ${capResult.caps.join(', ')}.`}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold">Scegli il supermercato</h2>
            <p className="text-stone-500 text-sm mt-1">Prezzi e prodotti del negozio che preferisci</p>
          </div>
        </div>
        {loading ? <Loading /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(stores || []).map((s) => (
              <Link key={s.id} to={`/negozio/${s.id}`}>
                <Card className="overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition h-full">
                  <div className="h-28 flex items-center justify-center text-6xl" style={{ background: `linear-gradient(135deg, ${s.color}22, ${s.color}55)` }}>
                    {s.emoji}
                  </div>
                  <div className="p-5">
                    <div className="font-semibold text-lg">{s.name}</div>
                    <div className="text-sm text-stone-500 flex items-center gap-1 mt-1"><MapPin className="size-3.5" /> {s.address}</div>
                    <div className="text-sm text-stone-500 flex items-center gap-1 mt-1"><Clock className="size-3.5" /> {s.hours}</div>
                    <div className="flex flex-wrap gap-2 mt-4 text-xs">
                      <span className="rounded-full bg-brand-50 text-brand-800 px-2.5 py-1 font-medium">{s.products_count} prodotti</span>
                      <span className="rounded-full bg-stone-100 text-stone-600 px-2.5 py-1 font-medium">Minimo {eur(s.min_order)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-6">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ['🛒', 'Fai la spesa', 'Sfoglia i reparti del tuo supermercato con foto, prezzi e offerte.'],
            ['🕐', 'Scegli quando', 'Seleziona la fascia oraria che preferisci, anche in giornata.'],
            ['🛵', 'Ricevila a casa', 'Il nostro driver fa la spesa per te e te la porta. Lo segui sulla mappa.'],
          ].map(([e, t, d], i) => (
            <Card key={t} className="p-5">
              <div className="flex items-center gap-3">
                <span className="size-11 rounded-xl bg-brand-50 flex items-center justify-center text-2xl">{e}</span>
                <div className="text-xs font-semibold text-accent-600">PASSO {i + 1}</div>
              </div>
              <div className="font-semibold mt-3">{t}</div>
              <div className="text-sm text-stone-500 mt-1">{d}</div>
            </Card>
          ))}
        </div>
        {settings && (
          <div className="mt-4 rounded-2xl bg-white border border-stone-200 p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎁</span>
              <div>
                <div className="font-semibold">Tessera fedeltà SpesaTeam</div>
                <div className="text-sm text-stone-500">
                  {settings.loyalty.points_per_euro} punto per ogni euro speso · ogni {settings.loyalty.reward_threshold} punti un buono da {eur(settings.loyalty.reward_value)}
                </div>
              </div>
            </div>
            <div className="text-sm text-stone-600">
              Consegna {eur(settings.delivery.delivery_fee)} · <b>gratis</b> sopra {eur(settings.delivery.free_delivery_threshold)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

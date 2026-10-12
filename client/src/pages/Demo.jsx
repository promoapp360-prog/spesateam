import { Link } from 'react-router-dom';
import { Logo } from '../components/ui.jsx';

const AREAS = [
  {
    to: '/', emoji: '🛍️', title: 'App Cliente', color: 'from-brand-600 to-brand-800',
    text: 'Scegli il supermercato, sfoglia i reparti, riempi il carrello, paga e segui la consegna sulla mappa.',
    creds: ['cliente@spesateam.it', 'demo1234'],
  },
  {
    to: '/driver', emoji: '🛵', title: 'App Driver', color: 'from-accent-500 to-accent-700',
    text: 'Ordini assegnati, lista della spesa da spuntare, navigazione, posizione GPS e incasso in contanti.',
    creds: ['driver1@spesateam.it', 'demo1234'],
  },
  {
    to: '/admin', emoji: '📊', title: 'Backoffice', color: 'from-stone-700 to-stone-900',
    text: 'Ordini in tempo reale, catalogo e prezzi, driver, clienti, promozioni, coupon, fedeltà e statistiche.',
    creds: ['admin@spesateam.it', 'demo1234'],
  },
];

export default function Demo() {
  return (
    <div className="min-h-full bg-linear-to-b from-brand-50 to-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-10">
          <Logo className="text-3xl" />
          <h1 className="text-3xl sm:text-4xl font-bold mt-6">Demo della piattaforma</h1>
          <p className="text-stone-600 mt-3 max-w-2xl mx-auto">
            Tre applicazioni collegate allo stesso database. Puoi aprirle in schede diverse ed essere collegato
            contemporaneamente come cliente, driver e amministratore: un ordine fatto dal cliente compare subito nel backoffice e nell'app del driver.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {AREAS.map((a) => (
            <Link key={a.to} to={a.to} className="group rounded-3xl overflow-hidden bg-white border border-stone-200 shadow-sm hover:shadow-lg transition">
              <div className={`bg-linear-to-br ${a.color} p-6 text-white`}>
                <div className="text-4xl">{a.emoji}</div>
                <div className="text-xl font-bold font-display mt-3">{a.title}</div>
              </div>
              <div className="p-6">
                <p className="text-sm text-stone-600 min-h-16">{a.text}</p>
                <div className="mt-4 rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs">
                  <div className="text-stone-500">Accesso demo</div>
                  <div className="font-mono mt-1">{a.creds[0]}</div>
                  <div className="font-mono">{a.creds[1]}</div>
                </div>
                <div className="mt-4 font-semibold text-brand-700 group-hover:translate-x-1 transition">Apri →</div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-10 rounded-2xl bg-white border border-stone-200 p-6 text-sm text-stone-600">
          <div className="font-semibold text-ink mb-2">Prova il flusso completo in 2 minuti</div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Nell'<b>App Cliente</b> scegli un supermercato, aggiungi qualche prodotto e completa l'ordine (pagamenti in modalità di prova).</li>
            <li>Nel <b>Backoffice</b> → Ordini, apri il nuovo ordine e assegnalo a <i>Luca Ferrante</i>.</li>
            <li>Nell'<b>App Driver</b> (driver1) avvia la spesa, spunta i prodotti, avvia la consegna e premi “Simula percorso”.</li>
            <li>Torna all'<b>App Cliente</b>: vedi il driver muoversi sulla mappa fino alla consegna.</li>
          </ol>
          <p className="mt-3 text-xs text-stone-500">Altri accessi: operatore@spesateam.it, driver2…driver4@spesateam.it — password demo1234. I dati sono dimostrativi.</p>
        </div>
        <p className="text-center text-xs text-stone-400 mt-8">Realizzato da PromoApp · promoapp.it</p>
      </div>
    </div>
  );
}

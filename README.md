# SpesaTeam — demo

Piattaforma per la spesa a domicilio dai supermercati di zona (Casavatore, NA).
Tre applicazioni collegate allo stesso database PostgreSQL:

| Area | Indirizzo | Accesso demo |
|---|---|---|
| App Cliente | `/` | cliente@spesateam.it · demo1234 |
| App Driver | `/driver` | driver1@spesateam.it · demo1234 (anche driver2…driver4) |
| Backoffice | `/admin` | admin@spesateam.it · demo1234 (operatore@spesateam.it per il ruolo operatore) |
| Pagina accessi demo | `/demo` | — |

## Avvio su Replit

1. **Import**: su Replit → *Create App* → *Import from GitHub* → repository `spesateam`.
2. **Database**: apri lo strumento **Database** e crea un database PostgreSQL. Replit imposta da solo la variabile `DATABASE_URL`.
3. **Secret**: in *Secrets* aggiungi `JWT_SECRET` con una frase lunga a piacere.
4. Premi **Run**. Al primo avvio il server crea le tabelle e carica i dati dimostrativi (3 supermercati, ~260 prodotti, 45 clienti, 4 driver, ~70 giorni di ordini).
5. Per pubblicarla: **Deploy** → *Autoscale*. Comandi già configurati in `.replit`.

Per azzerare i dati di prova: nella Shell `npm run reset-db`.

## Aggiornamenti dal repository

Il codice è sviluppato sul repository GitHub. Per ricevere gli aggiornamenti: Shell → `git pull`, poi **Run** (o nuovo deploy).
Se modifichi il codice su Replit, prima di richiedere altri aggiornamenti salva le modifiche su GitHub (pannello Git → commit e push).

## Cosa c'è nella demo

**App Cliente** — verifica CAP, scelta del supermercato, reparti con foto/icone e prezzi, ricerca e filtri (offerte, bio, senza glutine), carrello con preferenza in caso di prodotto mancante, prodotti a peso con prezzo stimato, fasce orarie con capienza, pagamento con carta, PayPal o contanti, coupon e premi fedeltà, tracking dell'ordine con mappa e posizione del driver, area personale con tessera fedeltà (QR), storico ordini e movimenti punti.

**App Driver** — stato in servizio, ordini assegnati con avviso, lista della spesa per reparto (preso / pesato / sostituito / mancante), navigazione con Google Maps, invio posizione GPS (con pulsante “Simula percorso” per la demo), conferma consegna con incasso contanti e prova di consegna.

**Backoffice** — dashboard in tempo reale, ordini (filtri, assegnazione driver, cambio stato, annullo con rimborso), mappa live, prodotti e prezzi (modifica rapida, variazione in blocco, import CSV, storico prezzi), reparti, supermercati, anagrafica driver con prestazioni, clienti codificati con tessera e note, promozioni (percentuale, euro, 3x2), coupon, programma fedeltà con livelli, impostazioni (CAP, fasce, costi, utenti e permessi, registro attività), statistiche riservate agli amministratori con esportazione Excel.

### Simulato nella demo (da attivare in produzione)

- Pagamenti con carta e PayPal: flusso completo in modalità di prova, senza addebiti. In produzione: Stripe e PayPal con i conti del committente.
- Coordinate degli indirizzi: approssimate nella zona servita. In produzione: geocoding Google Maps.
- Mappe: OpenStreetMap. In produzione eventualmente Google Maps.
- Foto prodotti: icone, con campo URL foto. In produzione: caricamento immagini dal backoffice.
- Email e notifiche push: non inviate nella demo.

## Struttura

```
server/            API Node.js + Express, PostgreSQL
  index.js         avvio, crea tabelle e dati demo al primo avvio
  schema.sql       struttura del database
  seed.js          dati dimostrativi
  pricing.js       promozioni, coupon, punti, consegna
  orders.js        ciclo di vita dell'ordine
  routes/          public, customer, driver, admin, stats
client/            React + Vite + Tailwind
  src/pages/customer  App Cliente
  src/pages/driver    App Driver
  src/pages/admin     Backoffice
```

Realizzato da PromoApp · promoapp.it

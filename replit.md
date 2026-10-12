# SpesaTeam — note per lo sviluppo su Replit

Applicazione full-stack per la spesa a domicilio dai supermercati di zona.

## Stack
- Backend: Node.js 20, Express 4, PostgreSQL (driver `pg`), autenticazione JWT. File in `server/`.
- Frontend: React 18, Vite 5, Tailwind CSS 4, react-router 6, react-leaflet (mappe), recharts (grafici). File in `client/`.
- Il server serve le API su `/api/*` e l'interfaccia compilata da `dist/` sulla porta 5000.

## Comandi
- `npm run dev` — compila l'interfaccia e avvia il server
- `npm run build` — compila solo l'interfaccia
- `npm start` — avvia il server (richiede `dist/`)
- `npm run reset-db` — azzera il database e ricarica i dati demo

## Variabili d'ambiente
- `DATABASE_URL` (impostata dallo strumento Database di Replit)
- `JWT_SECRET` (Secrets)

## Regole del progetto
- Lingua dell'interfaccia: italiano. Valuta in euro, formato it-IT.
- Le tabelle sono in `server/schema.sql` e vengono create all'avvio con `CREATE TABLE IF NOT EXISTS`: per nuove colonne aggiungere `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in fondo allo schema.
- Tre aree con sessioni separate: cliente (`/`), driver (`/driver`), backoffice (`/admin`). Ruoli: customer, driver, operator, admin. Le statistiche (`/api/admin/stats`) sono solo per admin.
- Colori del brand definiti in `client/src/index.css` (`brand` verde, `accent` arancione).
- Il codice principale è mantenuto sul repository GitHub: prima di modifiche grandi fare `git pull`; dopo modifiche fatte qui, commit e push.

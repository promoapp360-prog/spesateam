import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Percent, Upload, Pencil } from 'lucide-react';
import { useFetch, useDebounced } from '../../lib/hooks.js';
import { post, put } from '../../lib/api.js';
import { eur } from '../../lib/format.js';
import { PageTitle, Button, Input, Select, Loading, ProductThumb, Badge, Toggle, Modal, Field, Textarea, ErrorBox, toast } from '../../components/ui.jsx';
import { Table, FormModal } from './kit.jsx';

export default function Products() {
  const [sp] = useSearchParams();
  const [storeId, setStoreId] = useState('');
  const [catId, setCatId] = useState('');
  const [q, setQ] = useState('');
  const [onlyOff, setOnlyOff] = useState(!!sp.get('off'));
  const dq = useDebounced(q);
  const { data: stores } = useFetch('/admin/stores');
  const { data: cats } = useFetch('/admin/categories');
  const params = new URLSearchParams();
  if (storeId) params.set('store_id', storeId);
  if (catId) params.set('category_id', catId);
  if (dq) params.set('q', dq);
  if (onlyOff) params.set('availability', 'off');
  const { data: rows, loading, reload, setData } = useFetch(`/admin/products?${params}`);
  const [edit, setEdit] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [imp, setImp] = useState(false);

  const fields = useMemo(() => [
    { name: 'name', label: 'Nome prodotto', required: true },
    { name: 'store_id', label: 'Supermercato', type: 'select', numeric: true, required: true, span: 1, options: (stores || []).map((s) => ({ value: s.id, label: s.name })) },
    { name: 'category_id', label: 'Reparto', type: 'select', numeric: true, required: true, span: 1, options: (cats || []).map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })) },
    { name: 'brand', label: 'Marca / origine', span: 1 },
    { name: 'size', label: 'Formato', placeholder: 'es. 500 g', span: 1 },
    { name: 'price', label: 'Prezzo (€)', type: 'number', step: '0.01', required: true, span: 1 },
    { name: 'unit', label: 'Vendita', type: 'select', required: true, span: 1, options: [{ value: 'pz', label: 'A pezzo / confezione' }, { value: 'kg', label: 'A peso (prezzo al kg)' }] },
    { name: 'step', label: 'Quantità minima (kg)', type: 'number', step: '0.05', span: 1, show: (v) => v.unit === 'kg', hint: 'es. 0,1 per i salumi, 0,5 per la frutta' },
    { name: 'vat', label: 'IVA %', type: 'number', span: 1 },
    { name: 'emoji', label: 'Icona (emoji)', span: 1, hint: 'Usata se manca la foto' },
    { name: 'image_url', label: 'URL foto prodotto', placeholder: 'https://…', hint: 'In produzione le foto si caricano direttamente dal computer' },
    { name: 'is_bio', label: 'Biologico', type: 'toggle', span: 1, toggleLabel: 'Prodotto bio' },
    { name: 'gluten_free', label: 'Senza glutine', type: 'toggle', span: 1, toggleLabel: 'Senza glutine' },
    { name: 'available', label: 'Disponibilità', type: 'toggle', toggleLabel: 'Disponibile per la vendita' },
  ], [stores, cats]);

  async function toggleAvail(p) {
    const r = await put(`/admin/products/${p.id}`, { available: !p.available });
    setData(rows.map((x) => (x.id === p.id ? { ...x, available: r.available } : x)));
  }
  async function quickPrice(p, value) {
    const v = Number(String(value).replace(',', '.'));
    if (!(v > 0) || v === Number(p.price)) return;
    await put(`/admin/products/${p.id}`, { price: v });
    setData(rows.map((x) => (x.id === p.id ? { ...x, price: v } : x)));
    toast(`Prezzo aggiornato: ${p.name} ${eur(v)}`);
  }

  return (
    <div>
      <PageTitle title="Prodotti e prezzi" subtitle={rows ? `${rows.length} prodotti` : ''}
        actions={<>
          <Button variant="secondary" icon={Upload} onClick={() => setImp(true)}>Importa CSV</Button>
          <Button variant="secondary" icon={Percent} onClick={() => setBulk(true)}>Modifica prezzi in blocco</Button>
          <Button icon={Plus} onClick={() => setEdit({ unit: 'pz', vat: 10, emoji: '🛒', available: true, store_id: storeId ? Number(storeId) : undefined, category_id: catId ? Number(catId) : undefined })}>Nuovo prodotto</Button>
        </>} />
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto o marca" className="pl-9 w-64" />
        </div>
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-52">
          <option value="">Tutti i supermercati</option>
          {(stores || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={catId} onChange={(e) => setCatId(e.target.value)} className="w-52">
          <option value="">Tutti i reparti</option>
          {(cats || []).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </Select>
        <Toggle checked={onlyOff} onChange={setOnlyOff} label="Solo non disponibili" />
      </div>
      {loading && !rows ? <Loading /> : (
        <Table
          rows={rows || []}
          columns={[
            { key: 'thumb', label: '', render: (p) => <ProductThumb product={p} size="sm" /> },
            { key: 'name', label: 'Prodotto', render: (p) => (
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-stone-500">{p.brand} · {p.size}
                  {p.is_bio && <Badge className="ml-1 bg-brand-50 text-brand-700">BIO</Badge>}
                  {p.gluten_free && <Badge className="ml-1 bg-amber-50 text-amber-700">SG</Badge>}
                </div>
              </div>
            ) },
            { key: 'store', label: 'Supermercato', render: (p) => <span className="text-xs">{p.store_name}</span> },
            { key: 'cat', label: 'Reparto', render: (p) => <span className="text-xs">{p.category_name}</span> },
            { key: 'price', label: 'Prezzo', render: (p) => (
              <div className="flex items-center gap-1">
                <input key={`${p.id}-${p.price}`} defaultValue={Number(p.price).toFixed(2).replace('.', ',')} onBlur={(e) => quickPrice(p, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="w-20 h-8 rounded-lg border border-stone-200 px-2 text-right text-sm focus:border-brand-500 outline-none" />
                <span className="text-xs text-stone-500">€{p.unit === 'kg' ? '/kg' : ''}</span>
              </div>
            ) },
            { key: 'popularity', label: 'Venduti', align: 'right', render: (p) => <span className="text-xs text-stone-500">{p.popularity}</span> },
            { key: 'available', label: 'Disponibile', render: (p) => <Toggle checked={p.available} onChange={() => toggleAvail(p)} /> },
            { key: 'edit', label: '', render: (p) => <button onClick={() => setEdit(p)} className="p-2 rounded-lg hover:bg-stone-100"><Pencil className="size-4" /></button> },
          ]}
        />
      )}
      <FormModal open={!!edit} title={edit?.id ? `Modifica: ${edit.name}` : 'Nuovo prodotto'} fields={fields} initial={edit} size="lg"
        onClose={() => setEdit(null)}
        onSubmit={async (v) => {
          if (edit.id) await put(`/admin/products/${edit.id}`, v); else await post('/admin/products', v);
          toast('Prodotto salvato'); reload();
        }} />
      <BulkPrice open={bulk} onClose={() => setBulk(false)} stores={stores} cats={cats} onDone={reload} />
      <ImportCsv open={imp} onClose={() => setImp(false)} stores={stores} onDone={reload} />
    </div>
  );
}

function BulkPrice({ open, onClose, stores, cats, onDone }) {
  const [storeId, setStoreId] = useState('');
  const [catId, setCatId] = useState('');
  const [percent, setPercent] = useState('3');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function apply() {
    setBusy(true); setError(null);
    try {
      const r = await post('/admin/products/bulk-price', { store_id: storeId || null, category_id: catId || null, percent: Number(String(percent).replace(',', '.')) });
      toast(`Prezzi aggiornati su ${r.updated} prodotti`);
      onDone(); onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Modifica prezzi in blocco"
      footer={<><Button variant="secondary" onClick={onClose}>Annulla</Button><Button onClick={apply} loading={busy}>Applica variazione</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-stone-500">Aumenta o riduci in percentuale i prezzi di un supermercato, di un reparto o di entrambi. Ogni variazione viene registrata nello storico prezzi.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supermercato">
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Tutti</option>{(stores || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Reparto">
            <Select value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="">Tutti</option>{(cats || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Variazione %" hint="Esempio: 3 = +3%, -5 = −5%"><Input type="number" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} /></Field>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

function ImportCsv({ open, onClose, stores, onDone }) {
  const [storeId, setStoreId] = useState('');
  const [text, setText] = useState('reparto;nome;marca;formato;prezzo;unita\nPasta e legumi;Linguine di Gragnano;Gragnano IGP;500 g;1,59;pz\nOrtofrutta;Peperoni rossi;Campania;al kg;2,90;kg');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  function parse() {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const sep = lines[0].includes(';') ? ';' : ',';
    const head = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    const idx = (n) => head.findIndex((h) => h.startsWith(n));
    return lines.slice(1).map((l) => {
      const c = l.split(sep);
      return { category: c[idx('repart')], name: c[idx('nome')], brand: c[idx('marca')], size: c[idx('format')], price: c[idx('prezz')], unit: (c[idx('unit')] || 'pz').trim() };
    });
  }
  async function run() {
    setBusy(true); setError(null); setResult(null);
    try {
      if (!storeId) throw new Error('Scegli il supermercato');
      const r = await post('/admin/products/import', { store_id: Number(storeId), rows: parse() });
      setResult(r); onDone();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function onFile(e) {
    const f = e.target.files?.[0];
    if (f) setText(await f.text());
  }
  return (
    <Modal open={open} onClose={onClose} title="Importa prodotti da file" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Chiudi</Button><Button onClick={run} loading={busy}>Importa</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-stone-500">Carica il file CSV esportato da Excel (o incolla le righe). Colonne: reparto, nome, marca, formato, prezzo, unità (pz o kg). I prodotti già presenti con lo stesso nome e formato vengono aggiornati.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supermercato">
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Scegli…</option>{(stores || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="File CSV"><input type="file" accept=".csv,.txt" onChange={onFile} className="text-sm mt-2" /></Field>
        </div>
        <Field label="Contenuto"><Textarea value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs min-h-40" /></Field>
        <ErrorBox error={error} />
        {result && <div className="rounded-xl bg-brand-50 text-brand-800 text-sm p-3">Importazione completata: {result.inserted} nuovi, {result.updated} aggiornati, {result.skipped} scartati.</div>}
      </div>
    </Modal>
  );
}

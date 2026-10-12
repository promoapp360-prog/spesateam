import { useEffect, useState } from 'react';
import { useFetch, useSession } from '../../lib/hooks.js';
import { put } from '../../lib/api.js';
import { eur, fmtDateTime, num } from '../../lib/format.js';
import { PageTitle, Card, Stat, Loading, Button, Field, Input, toast } from '../../components/ui.jsx';
import { Table } from './kit.jsx';

export default function Loyalty() {
  const { data, loading, reload } = useFetch('/admin/loyalty');
  const session = useSession('admin');
  const isAdmin = session?.user?.role === 'admin';
  const [rules, setRules] = useState(null);
  useEffect(() => { if (data) setRules(data.settings); }, [data]);
  if (loading && !data) return <Loading />;
  if (!data || !rules) return null;

  async function save() {
    try {
      await put('/admin/settings/loyalty', {
        ...rules,
        points_per_euro: Number(rules.points_per_euro), reward_threshold: Number(rules.reward_threshold), reward_value: Number(rules.reward_value),
        tiers: rules.tiers.map((t) => ({ name: t.name, min: Number(t.min) })),
      });
      toast('Regole fedeltà aggiornate'); reload();
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div>
      <PageTitle title="Tessere fedeltà" subtitle="Una tessera digitale per ogni cliente registrato, valida su tutti i supermercati del servizio" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Punti emessi" value={num(data.totals.issued)} icon="⭐" />
        <Stat label="Punti riscattati" value={num(data.totals.redeemed)} icon="🎁" sub={`≈ ${eur((data.totals.redeemed / rules.reward_threshold) * rules.reward_value)} di buoni`} />
        <Stat label="Punti in circolazione" value={num(data.balance)} icon="💳" />
        <Stat label="Clienti con premio disponibile" value={data.eligible} icon="🏆" />
      </div>
      <div className="grid xl:grid-cols-[400px_1fr] gap-6 items-start">
        <div className="space-y-6">
          <div className="rounded-3xl p-6 text-white bg-linear-to-br from-brand-700 via-brand-600 to-brand-900 shadow-lg">
            <div className="text-xs uppercase tracking-widest text-brand-100">Anteprima tessera</div>
            <div className="font-display text-2xl font-bold mt-1">Spesa<span className="text-accent-100">Team</span></div>
            <div className="font-mono mt-5">ST00001</div>
            <div className="text-sm text-brand-100">Mario Rossi · Livello Silver</div>
            <div className="mt-4 text-3xl font-bold font-display">340 <span className="text-sm font-normal">punti</span></div>
          </div>
          <Card className="p-5 space-y-4">
            <div className="font-semibold">Regole del programma</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Punti per €"><Input type="number" value={rules.points_per_euro} onChange={(e) => setRules({ ...rules, points_per_euro: e.target.value })} disabled={!isAdmin} /></Field>
              <Field label="Soglia premio"><Input type="number" value={rules.reward_threshold} onChange={(e) => setRules({ ...rules, reward_threshold: e.target.value })} disabled={!isAdmin} /></Field>
              <Field label="Valore buono €"><Input type="number" value={rules.reward_value} onChange={(e) => setRules({ ...rules, reward_value: e.target.value })} disabled={!isAdmin} /></Field>
            </div>
            <div>
              <div className="text-sm font-medium text-stone-700 mb-2">Livelli (in base ai punti totali accumulati)</div>
              {rules.tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 mb-2">
                  <Input value={t.name} disabled={!isAdmin} onChange={(e) => setRules({ ...rules, tiers: rules.tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <Input type="number" value={t.min} disabled={!isAdmin || i === 0} onChange={(e) => setRules({ ...rules, tiers: rules.tiers.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)) })} />
                </div>
              ))}
            </div>
            <div className="text-xs text-stone-500 bg-stone-50 rounded-xl p-3">
              Con queste regole: {rules.points_per_euro} punto ogni euro speso, ogni {rules.reward_threshold} punti il cliente ottiene un buono da {eur(rules.reward_value)}
              {' '}(restituzione pari al {((Number(rules.reward_value) / Number(rules.reward_threshold)) * Number(rules.points_per_euro) * 100).toFixed(1).replace('.', ',')}% della spesa).
            </div>
            {isAdmin ? <Button onClick={save}>Salva regole</Button> : <div className="text-xs text-stone-500">Solo un amministratore può modificare le regole.</div>}
          </Card>
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="font-semibold mb-3">Clienti con più punti</h2>
            <Table rows={data.top} columns={[
              { key: 'code', label: 'Codice', render: (c) => <span className="font-mono text-xs">{c.code}</span> },
              { key: 'name', label: 'Cliente' },
              { key: 'points', label: 'Punti', align: 'right', render: (c) => <b>{c.points}</b> },
              { key: 'r', label: 'Premi disponibili', align: 'right', render: (c) => Math.floor(c.points / rules.reward_threshold) },
            ]} />
          </div>
          <div>
            <h2 className="font-semibold mb-3">Ultimi movimenti</h2>
            <Table rows={data.movements} columns={[
              { key: 'when', label: 'Data', render: (m) => <span className="text-xs">{fmtDateTime(m.created_at)}</span> },
              { key: 'customer', label: 'Cliente', render: (m) => <span>{m.customer_name} <span className="text-xs text-stone-400">{m.code}</span></span> },
              { key: 'reason', label: 'Causale', render: (m) => <span className="text-xs">{m.reason}</span> },
              { key: 'points', label: 'Punti', align: 'right', render: (m) => <b className={m.points > 0 ? 'text-brand-700' : 'text-accent-600'}>{m.points > 0 ? '+' : ''}{m.points}</b> },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}

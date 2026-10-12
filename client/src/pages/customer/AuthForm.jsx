import { useState } from 'react';
import { login, post, setSession } from '../../lib/api.js';
import { Button, Field, Input, Tabs, ErrorBox } from '../../components/ui.jsx';

export default function AuthForm({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', marketing_consent: false, privacy: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await login('customer', f.email, f.password);
      else {
        if (!f.privacy) throw new Error("Per registrarti devi accettare l'informativa privacy e i termini del servizio");
        const data = await post('/auth/register', f);
        setSession('customer', data);
      }
      onDone?.();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Tabs tabs={[{ value: 'login', label: 'Accedi' }, { value: 'register', label: 'Crea account' }]} value={mode} onChange={setMode} className="mb-5" />
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <>
            <Field label="Nome e cognome"><Input value={f.name} onChange={set('name')} required autoComplete="name" /></Field>
            <Field label="Telefono" hint="Il driver ti chiamerà solo se necessario"><Input value={f.phone} onChange={set('phone')} type="tel" autoComplete="tel" /></Field>
          </>
        )}
        <Field label="Email"><Input value={f.email} onChange={set('email')} type="email" required autoComplete="email" /></Field>
        <Field label="Password"><Input value={f.password} onChange={set('password')} type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>
        {mode === 'register' && (
          <div className="space-y-2 text-sm">
            <label className="flex gap-2 items-start"><input type="checkbox" checked={f.privacy} onChange={set('privacy')} className="mt-1" /> Accetto l'informativa privacy e i termini del servizio</label>
            <label className="flex gap-2 items-start"><input type="checkbox" checked={f.marketing_consent} onChange={set('marketing_consent')} className="mt-1" /> Voglio ricevere offerte e promozioni (facoltativo)</label>
          </div>
        )}
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" loading={loading}>{mode === 'login' ? 'Accedi' : 'Crea account e ricevi la tessera'}</Button>
        {mode === 'login' && (
          <button type="button" onClick={() => setF({ ...f, email: 'cliente@spesateam.it', password: 'demo1234' })}
            className="w-full text-xs text-stone-500 hover:text-brand-700">Usa l'account demo (cliente@spesateam.it)</button>
        )}
      </form>
    </div>
  );
}

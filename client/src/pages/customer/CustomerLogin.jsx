import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui.jsx';
import AuthForm from './AuthForm.jsx';

export default function CustomerLogin() {
  const nav = useNavigate();
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">Benvenuto</h1>
      <p className="text-sm text-stone-500 mb-6">Accedi per fare la spesa, seguire i tuoi ordini e accumulare punti fedeltà.</p>
      <Card className="p-6"><AuthForm onDone={() => nav('/account')} /></Card>
    </div>
  );
}

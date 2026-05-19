import { useState, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { Lock } from 'lucide-react';

export function ProtectedView({ children }: { children: ReactNode }) {
  const { isAdmin, login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (isAdmin) {
    return <>{children}</>;
  }

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (login(pin)) {
      setError('');
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] blur-none">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Restricted Access</h2>
        <p className="text-sm text-gray-500 mb-6">Enter Admin PIN to unlock this section. (Default: 1234)</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-widest text-2xl py-3 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••"
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-gray-900 text-white font-medium py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

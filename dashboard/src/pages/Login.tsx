/**
 * RemoteEye Dashboard - Login Page
 */

import { useState } from 'react';
import { authService } from '../services/AuthService';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [pairingCode, setPairingCode] = useState('');
  const [controllerName, setControllerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authService.registerController(pairingCode, controllerName);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl p-8 w-full max-w-md border border-slate-800">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">RemoteEye</h1>
          <p className="text-slate-400">Controller Dashboard</p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pairingCode" className="block text-sm font-medium text-slate-300 mb-2">
              Pairing Code
            </label>
            <input
              id="pairingCode"
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              required
            />
            <p className="text-slate-500 text-xs mt-2">
              Get the pairing code from the mobile app
            </p>
          </div>

          <div>
            <label htmlFor="controllerName" className="block text-sm font-medium text-slate-300 mb-2">
              Controller Name
            </label>
            <input
              id="controllerName"
              type="text"
              value={controllerName}
              onChange={(e) => setControllerName(e.target.value)}
              placeholder="e.g., My MacBook"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pairingCode.length < 6 || !controllerName}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
          >
            {loading ? 'Connecting...' : 'Connect to Device'}
          </button>
        </form>

        {/* Help text */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">How to connect:</h3>
          <ol className="text-slate-500 text-sm space-y-2">
            <li>1. Open the RemoteEye mobile app</li>
            <li>2. Go to Settings → Pair Controller</li>
            <li>3. Enter the 6-digit pairing code above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * RemoteEye Dashboard - Main App
 */

import { useState, useEffect } from 'react';
import { authService } from './services/AuthService';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const hasAuth = authService.initialize();

      if (hasAuth) {
        // Verify token is still valid
        const token = authService.getToken();
        if (token) {
          const isValid = await authService.loginWithToken(token);
          if (isValid) {
            setIsAuthenticated(true);
          } else {
            // Try refresh token
            const refreshed = await authService.refreshAccessToken();
            setIsAuthenticated(refreshed);
          }
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? (
    <Dashboard />
  ) : (
    <Login onLoginSuccess={handleLoginSuccess} />
  );
}

export default App;

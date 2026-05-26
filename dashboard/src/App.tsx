import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { RoleProvider, useRole, type UserRole } from './hooks/useRole';
import { ErrorBoundary } from './components/ErrorBoundary';
import { API_BASE_URL } from './services/api';
import './App.css';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Sessions = lazy(() => import('./pages/Sessions').then(m => ({ default: m.Sessions })));
const Webhooks = lazy(() => import('./pages/Webhooks').then(m => ({ default: m.Webhooks })));
const Logs = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const ApiKeys = lazy(() => import('./pages/ApiKeys').then(m => ({ default: m.ApiKeys })));
const MessageTester = lazy(() => import('./pages/MessageTester').then(m => ({ default: m.MessageTester })));
const Infrastructure = lazy(() => import('./pages/Infrastructure').then(m => ({ default: m.Infrastructure })));
const Plugins = lazy(() => import('./pages/Plugins'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function AppContent() {
  const savedKey = sessionStorage.getItem('openwa_api_key');
  const savedJwt = sessionStorage.getItem('openwa_jwt');

  const [isAuthenticated, setIsAuthenticated] = useState(!!(savedKey || savedJwt));
  const { setRole, role } = useRole();

  // API key login (existing flow)
  const handleLogin = async (key: string) => {
    sessionStorage.setItem('openwa_api_key', key);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'X-API-Key': key },
      });
      if (response.ok) {
        const data = await response.json();
        setRole(data.role as UserRole);
      }
    } catch {
      setRole('viewer');
    }

    setIsAuthenticated(true);
  };

  // JWT login (email/password flow)
  const handleLoginJwt = (token: string, userRole: UserRole) => {
    sessionStorage.setItem('openwa_jwt', token);
    setRole(userRole);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('openwa_api_key');
    sessionStorage.removeItem('openwa_jwt');
    setIsAuthenticated(false);
    setRole(null);
  };

  // Re-validate on mount if already authenticated
  useEffect(() => {
    const jwt = sessionStorage.getItem('openwa_jwt');
    const apiKey = sessionStorage.getItem('openwa_api_key');

    if (jwt) {
      fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.role) {
            setRole(data.role as UserRole);
          } else {
            sessionStorage.removeItem('openwa_jwt');
            setIsAuthenticated(false);
          }
        })
        .catch(() => {});
    } else if (apiKey) {
      fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.role) {
            setRole(data.role as UserRole);
          }
        })
        .catch(() => {});
    }
  }, [setRole]);

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (!isAuthenticated) {
    return (
      <Suspense fallback={loadingFallback}>
        <Login onLogin={handleLogin} onLoginJwt={handleLoginJwt} />
      </Suspense>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={loadingFallback}>
          <Routes>
            <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
              <Route index element={<Dashboard />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="webhooks" element={<Webhooks />} />
              {role === 'admin' && <Route path="api-keys" element={<ApiKeys />} />}
              <Route path="logs" element={<Logs />} />
              <Route path="message-tester" element={<MessageTester />} />
              <Route path="infrastructure" element={<Infrastructure />} />
              {role === 'admin' && <Route path="plugins" element={<Plugins />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

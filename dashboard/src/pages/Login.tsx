import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Github, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import type { UserRole } from '../hooks/useRole';
import './Login.css';

interface LoginProps {
  onLogin: (apiKey: string) => void;
  onLoginJwt: (token: string, role: UserRole) => void;
}

export function Login({ onLogin, onLoginJwt }: LoginProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'apikey' | 'email'>('apikey');

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Email/password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot / reset password state
  const [view, setView] = useState<'login' | 'forgot' | 'reset'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError(t('login.apiKeyRequired'));
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      });

      if (response.ok) {
        onLogin(apiKey);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || t('login.invalidKey'));
      }
    } catch {
      setError(t('login.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(t('login.emailPasswordRequired', 'Email and password are required'));
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        onLoginJwt(data.access_token, data.role as UserRole);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || t('login.invalidCredentials', 'Invalid email or password'));
      }
    } catch {
      setError(t('login.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await response.json();
      setResetMessage(data.message || 'Token generated — check server logs');
      setView('reset');
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim() || !resetNewPassword.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: resetNewPassword }),
      });
      if (response.ok) {
        setView('login');
        setError('');
        setResetToken('');
        setResetNewPassword('');
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || 'Invalid or expired token');
      }
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'forgot') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
            <span className="version-info">
              {t('login.version', {
                version: __APP_VERSION__,
                date: new Date(__BUILD_TIME__).toLocaleDateString(),
              })}
            </span>
          </div>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Réinitialiser le mot de passe</h2>
          <form onSubmit={handleForgotPassword} className="login-form">
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="votre@email.com"
                autoFocus
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.25rem' }} /> : null}
              Envoyer le token
            </button>
            <button
              type="button"
              onClick={() => { setView('login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', width: '100%', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem' }}
            >
              ← Retour à la connexion
            </button>
          </form>
        </div>
        <footer className="login-footer">
          <span>{t('login.footer')}</span>
          <a
            href="https://github.com/rmyndharis/OpenWA"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <Github size={18} />
          </a>
        </footer>
      </div>
    );
  }

  if (view === 'reset') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
            <span className="version-info">
              {t('login.version', {
                version: __APP_VERSION__,
                date: new Date(__BUILD_TIME__).toLocaleDateString(),
              })}
            </span>
          </div>
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Nouveau mot de passe</h2>
          {resetMessage && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#1D4ED8' }}>
              {resetMessage}
            </div>
          )}
          <form onSubmit={handleResetPassword} className="login-form">
            <div className="input-group">
              <label>Token de réinitialisation</label>
              <input
                type="text"
                value={resetToken}
                onChange={e => setResetToken(e.target.value)}
                placeholder="abc123"
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Nouveau mot de passe</label>
              <input
                type="password"
                value={resetNewPassword}
                onChange={e => setResetNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.25rem' }} /> : null}
              Changer le mot de passe
            </button>
            <button
              type="button"
              onClick={() => { setView('login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', width: '100%', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem' }}
            >
              ← Retour
            </button>
          </form>
        </div>
        <footer className="login-footer">
          <span>{t('login.footer')}</span>
          <a
            href="https://github.com/rmyndharis/OpenWA"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <Github size={18} />
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
          <span className="version-info">
            {t('login.version', {
              version: __APP_VERSION__,
              date: new Date(__BUILD_TIME__).toLocaleDateString(),
            })}
          </span>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${tab === 'apikey' ? 'active' : ''}`}
            onClick={() => { setTab('apikey'); setError(''); }}
          >
            {t('login.apiKey')}
          </button>
          <button
            type="button"
            className={`login-tab ${tab === 'email' ? 'active' : ''}`}
            onClick={() => { setTab('email'); setError(''); }}
          >
            Email &amp; Password
          </button>
        </div>

        {tab === 'apikey' && (
          <form onSubmit={handleApiKeySubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="apiKey">{t('login.apiKey')}</label>
              <div className="input-wrapper">
                <input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={t('login.apiKeyPlaceholder')}
                  className={error ? 'error' : ''}
                />
                <button type="button" className="toggle-visibility" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>
            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? t('login.connecting') : t('login.connect')}
            </button>
          </form>
        )}

        {tab === 'email' && (
          <form onSubmit={handleEmailSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@localhost"
                className={error ? 'error' : ''}
              />
              {error && <span className="error-message">{error}</span>}
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={error ? 'error' : ''}
                />
                <button type="button" className="toggle-visibility" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>
            <button type="submit" className="connect-btn" disabled={isLoading}>
              {isLoading ? t('login.connecting') : t('login.connect')}
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setView('forgot'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          </form>
        )}

        <p className="login-help">
          {t('login.help')}{' '}
          <a
            href="https://github.com/rmyndharis/OpenWA/blob/main/docs/01-project-overview.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('login.viewDocs')}
          </a>
        </p>
      </div>

      <footer className="login-footer">
        <span>{t('login.footer')}</span>
        <a
          href="https://github.com/rmyndharis/OpenWA"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          <Github size={18} />
        </a>
      </footer>
    </div>
  );
}

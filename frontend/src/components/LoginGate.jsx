import React, { useState } from 'react';
import './Auth.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * LoginGate
 * Full-screen auth wall rendered when no 'trader_token' exists in localStorage.
 * Supports both Sign In and Register modes. Calls onLogin(token) on success.
 */
export default function LoginGate({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [success, setSuccess]           = useState(null);

  const reset = () => { setError(null); setSuccess(null); };

  const handleLogin = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');
      // Store tenant display name for use inside the app
      if (data.tenant?.name) localStorage.setItem('trader_tenant_name', data.tenant.name);
      
      // 🌟 FIX 1: execute correct prop execution handler string matching App.jsx
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 🌟 FIX 2: Changed 'owner_email' to 'email' to match backend server expectations
        body: JSON.stringify({ business_name: businessName, email: email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');
      setSuccess('Account created — please sign in with your credentials.');
      setIsRegister(false);
      setPassword('');
      setBusinessName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-gate">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-icon" aria-hidden="true">◈</div>
          <h1 className="login-brand-name">StockFlow</h1>
          <p className="login-brand-sub">Multi-Tenant Inventory Management</p>
        </div>

        {/* Tabs */}
        <nav className="login-tabs" aria-label="Authentication mode">
          <button
            type="button"
            id="tab-login"
            className={`login-tab${!isRegister ? ' active' : ''}`}
            onClick={() => { setIsRegister(false); reset(); }}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-register"
            className={`login-tab${isRegister ? ' active' : ''}`}
            onClick={() => { setIsRegister(true); reset(); }}
          >
            Register Business
          </button>
        </nav>

        {/* Alerts */}
        {error   && <div className="alert alert-error"   role="alert">{error}</div>}
        {success && <div className="alert alert-success" role="alert">{success}</div>}

        {/* Form */}
        <form onSubmit={isRegister ? handleRegister : handleLogin} className="login-form">
          {isRegister && (
            <div className="form-row">
              <label className="form-label" htmlFor="business-name">Business Name</label>
              <input
                id="business-name"
                className="form-input"
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Acme Electronics Ltd"
                required
              />
            </div>
          )}
          <div className="form-row">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@mycompany.com"
              required
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" id="btn-auth-submit" className="btn-primary" disabled={loading}>
            {loading
              ? 'Processing…'
              : isRegister ? 'Register & Initialize Workspace' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
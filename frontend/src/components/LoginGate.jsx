import React, { useState } from 'react';

export default function LoginGate({ onLogin }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false); // ⚡ Toggle state
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Dynamic endpoint target selection
    const endpoint = isRegisterMode 
      ? 'http://localhost:5000/api/auth/register' 
      : 'http://localhost:5000/api/auth/login';

    // Dynamic payload configuration
    const payload = isRegisterMode 
      ? { business_name: businessName, email, password } 
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication sequence rejected.');
      }

      if (data.token) {
        onLogin(data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset errors when toggling modes
  const handleModeToggle = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setBusinessName('');
  };

  return (
    <div className="min-h-screen w-full bg-base text-text-primary flex items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-300 relative overflow-hidden">
      
      {/* ── BACKGROUND VISUAL FLUIDITY ELEMENTS ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-zinc-500/5 dark:bg-zinc-800/10 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-zinc-400/5 dark:bg-zinc-700/10 blur-[120px] animate-pulse-glow" style={{ animationDelay: '1.2s' }} />
      </div>

      {/* ── CENTRALIZED LOGIN/REGISTRATION TERMINAL CARD ── */}
      <div className="w-full max-w-md bg-panel border border-border-subtle rounded-2xl p-6 sm:p-10 shadow-2xl relative z-10 animate-fade-in transition-colors duration-300">
        
        {/* Header Block branding layout */}
        <div className="space-y-2 text-center mb-8">
          <div className="inline-flex items-center justify-center px-3 py-1 bg-surface border border-border-subtle rounded-full text-[10px] tracking-widest font-mono text-text-muted uppercase">
            {isRegisterMode ? 'provision_node / v2.11' : 'secure_gateway / v2.11'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary font-sans">
            TRADER.OS
          </h1>
          <p className="text-xs sm:text-sm text-text-muted font-sans tracking-tight">
            {isRegisterMode 
              ? 'Provision a new tenant workstation deployment context.' 
              : 'Enter your workstation credentials to authorize terminal access.'}
          </p>
        </div>

        {/* Action Form Element */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Business Name Field (Only visible in Register Mode) */}
          {isRegisterMode && (
            <div className="space-y-1.5 text-left animate-fade-in">
              <label className="text-xs tracking-tight text-text-secondary font-sans font-medium block">
                Business Organization Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corporation"
                required
                disabled={isSubmitting}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-xl transition-all px-4 py-3.5 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none disabled:opacity-50"
              />
            </div>
          )}

          {/* Email input field wrapper */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs tracking-tight text-text-secondary font-sans font-medium block">
              Workstation Email
            </label>
            <input
              type="email"
              placeholder="name@business.com"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-xl transition-all px-4 py-3.5 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none disabled:opacity-50"
            />
          </div>

          {/* Password input field wrapper */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs tracking-tight text-text-secondary font-sans font-medium block">
              Access Token / Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-xl transition-all px-4 py-3.5 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none disabled:opacity-50"
            />
          </div>

          {/* Error Message Layout Display */}
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-left flex items-start gap-3 animate-fade-in">
              <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-sans text-red-500 dark:text-red-400 leading-tight tracking-tight">
                {error}
              </span>
            </div>
          )}

          {/* Submission Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-text-primary text-panel font-medium text-sm tracking-tight rounded-xl py-3.5 transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-panel" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{isRegisterMode ? 'Deploying Tenant...' : 'Authorizing Session...'}</span>
              </>
            ) : (
              <span>{isRegisterMode ? 'Register Station' : 'Establish Session'}</span>
            )}
          </button>
        </form>

        {/* ── DUAL-MODE SWITCH TOGGLE LINK ── */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleModeToggle}
            className="text-xs font-sans text-text-muted hover:text-text-primary underline underline-offset-4 transition-colors duration-200 cursor-pointer"
          >
            {isRegisterMode 
              ? 'Already have an environment? Sign in instead' 
              : 'Need a new deployment? Register organization'}
          </button>
        </div>

        {/* Device Context Footer block layout */}
        <div className="mt-6 pt-6 border-t border-border-subtle/40 text-center">
          <p className="text-[10px] text-text-muted font-mono tracking-tight lowercase">
            connection_status: encrypted_tls_1.3
          </p>
        </div>

      </div>
    </div>
  );
}
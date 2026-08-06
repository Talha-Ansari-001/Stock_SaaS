import { useState } from 'react';

export default function LoginGate({ onLogin }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false); // ⚡ Toggle state
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Dynamic endpoint target selection
    const endpoint = isRegisterMode 
      ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/register` 
      : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`;

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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EEF0FB 0%, #F8F9FB 40%, #E8F4FD 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '"Poppins", sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background decorative blobs */}
      <div style={{
        position: 'absolute', top: '-80px', left: '-80px',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(47,62,158,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-80px', right: '-80px',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(104,117,200,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1,
        animation: 'fadeIn 0.5s ease both'
      }}>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #2F3E9E 0%, #6875C8 100%)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(47,62,158,0.3)',
          }}>
            <i className="bi bi-activity" style={{ fontSize: '26px', color: '#fff' }} />
          </div>
          <h1 style={{
            fontSize: '26px', fontWeight: '800', color: '#1A1D23',
            margin: '0 0 6px', letterSpacing: '-0.03em'
          }}>TraderOS</h1>
          <p style={{ fontSize: '13.5px', color: '#9AA5B4', margin: 0, fontWeight: '400' }}>
            {isRegisterMode
              ? 'Create your business workspace'
              : 'Sign in to your workspace'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(47,62,158,0.1), 0 1px 4px rgba(0,0,0,0.04)',
          border: '1px solid #E9ECEF',
        }}>

          {/* Mode Tab */}
          <div style={{
            display: 'flex',
            background: '#F0F2F5',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '24px',
            gap: '4px',
          }}>
            {[
              { label: 'Sign In', mode: false },
              { label: 'Register', mode: true },
            ].map(({ label, mode }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setIsRegisterMode(mode); setError(''); setBusinessName(''); }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                  background: isRegisterMode === mode ? '#fff' : 'transparent',
                  color: isRegisterMode === mode ? '#2F3E9E' : '#9AA5B4',
                  fontWeight: isRegisterMode === mode ? '700' : '500',
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  boxShadow: isRegisterMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Business Name (register only) */}
            {isRegisterMode && (
              <div style={{ animation: 'fadeIn 0.3s ease both' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4A5568', marginBottom: '6px' }}>
                  Business Name
                </label>
                <div style={{ position: 'relative' }}>
                  <i className="bi bi-building" style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)', color: '#9AA5B4', fontSize: '14px'
                  }} />
                  <input
                    type="text"
                    placeholder="e.g. Acme Trading Co."
                    required
                    disabled={isSubmitting}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px 10px 38px',
                      background: '#F0F2F5', border: '1.5px solid #E9ECEF',
                      borderRadius: '10px', fontSize: '13.5px', color: '#1A1D23',
                      fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s ease',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#2F3E9E'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(47,62,158,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#E9ECEF'; e.target.style.background = '#F0F2F5'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4A5568', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-envelope" style={{
                  position: 'absolute', left: '13px', top: '50%',
                  transform: 'translateY(-50%)', color: '#9AA5B4', fontSize: '14px'
                }} />
                <input
                  type="email"
                  placeholder="name@business.com"
                  required
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 38px',
                    background: '#F0F2F5', border: '1.5px solid #E9ECEF',
                    borderRadius: '10px', fontSize: '13.5px', color: '#1A1D23',
                    fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2F3E9E'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(47,62,158,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E9ECEF'; e.target.style.background = '#F0F2F5'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4A5568', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-lock" style={{
                  position: 'absolute', left: '13px', top: '50%',
                  transform: 'translateY(-50%)', color: '#9AA5B4', fontSize: '14px'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 40px 10px 38px',
                    background: '#F0F2F5', border: '1.5px solid #E9ECEF',
                    borderRadius: '10px', fontSize: '13.5px', color: '#1A1D23',
                    fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2F3E9E'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(47,62,158,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E9ECEF'; e.target.style.background = '#F0F2F5'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    color: '#9AA5B4', cursor: 'pointer', fontSize: '14px', padding: '2px',
                  }}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '11px 14px', borderRadius: '10px',
                background: '#FDECEA', border: '1px solid rgba(234,84,85,0.25)',
                color: '#dc2626', fontSize: '13px',
                animation: 'fadeIn 0.25s ease both',
              }}>
                <i className="bi bi-exclamation-circle-fill" style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg, #2F3E9E 0%, #6875C8 100%)',
                border: 'none', borderRadius: '10px',
                color: '#fff', fontSize: '14px', fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(47,62,158,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginTop: '4px',
              }}
            >
              {isSubmitting ? (
                <>
                  <span style={{
                    width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite', flexShrink: 0
                  }} />
                  <span>{isRegisterMode ? 'Creating Account...' : 'Signing In...'}</span>
                </>
              ) : (
                <>
                  <i className={`bi ${isRegisterMode ? 'bi-person-plus' : 'bi-box-arrow-in-right'}`} />
                  <span>{isRegisterMode ? 'Create Account' : 'Sign In'}</span>
                </>
              )}
            </button>
          </form>

          {/* Mode Toggle Link */}
          <p style={{
            textAlign: 'center', marginTop: '20px', marginBottom: 0,
            fontSize: '12.5px', color: '#9AA5B4'
          }}>
            {isRegisterMode ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={handleModeToggle}
              style={{
                background: 'none', border: 'none', color: '#2F3E9E',
                fontWeight: '600', cursor: 'pointer', textDecoration: 'underline',
                fontSize: '12.5px', fontFamily: 'inherit', padding: 0,
              }}
            >
              {isRegisterMode ? 'Sign in' : 'Register'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#CBD5E0' }}>
          <i className="bi bi-shield-check me-1" />
          Secured with TLS encryption
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
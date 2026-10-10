import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Building2, ChevronDown, ShieldCheck } from 'lucide-react';
import { QuestionCard } from '@/components/QuestionCard';
import { API_URL } from '@/lib/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Login failed. Please check your credentials.');
        return;
      }

      const user = data.user || {};
      const token = data.token || 'mock-superadmin-token';

      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_info', JSON.stringify(user));

      navigate('/admin/hospitals');
    } catch (err) {
      console.error('Admin login error:', err);
      setLoginError('Network error. Please ensure the backend server is running.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-4 font-body">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border-2 border-warmgray flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
        </div>

        <QuestionCard>
          <div className="text-center pt-8 pb-2 px-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> System Administrator
            </div>
            <h1 className="font-display font-bold text-3xl text-charcoal tracking-tight">Admin Portal</h1>
            <p className="text-muted text-sm mt-1.5">
              Sign in to manage hospitals, kiosks, and network registries
            </p>
          </div>

          <div className="px-8 py-6 space-y-5">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="text-xs font-bold text-charcoal uppercase tracking-widest">
                  Username / Email Address
                </label>
                <input
                  id="admin-email"
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full h-12 border-2 border-warmgray rounded-xl bg-white text-charcoal px-4 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors text-sm"
                  placeholder="head"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="text-xs font-bold text-charcoal uppercase tracking-widest">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full h-12 border-2 border-warmgray rounded-xl bg-white text-charcoal px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="text-danger text-sm font-medium bg-danger/8 border border-danger/20 px-4 py-2.5 rounded-xl">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> Sign In to Admin Portal
                  </>
                )}
              </button>

              {/* Demo Credentials for Judges */}
              <div className="border border-warmgray rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDemo(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-muted hover:bg-sand/60 transition-colors uppercase tracking-widest"
                >
                  <span>Demo Credentials (for Judges)</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDemo ? 'rotate-180' : ''}`} />
                </button>
                {showDemo && (
                  <div className="px-4 pb-4 pt-2 bg-sand/40 border-t border-warmgray space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted font-medium">Username / Email:</span>
                      <button
                        type="button"
                        onClick={() => setEmail('head')}
                        className="font-mono bg-white border border-warmgray px-2 py-1 rounded-lg text-charcoal hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      >
                        head
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted font-medium">Password:</span>
                      <button
                        type="button"
                        onClick={() => setPassword('admin123')}
                        className="font-mono bg-white border border-warmgray px-2 py-1 rounded-lg text-charcoal hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      >
                        admin123
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('head');
                        setPassword('admin123');
                      }}
                      className="w-full text-xs font-bold text-primary border border-primary/30 rounded-lg py-2 hover:bg-primary hover:text-white transition-all"
                    >
                      Fill & sign in →
                    </button>
                  </div>
                )}
              </div>

              {/* Small muted text note for judges */}
              <div className="pt-2 text-center text-xs text-muted">
                Demo credentials:<br />
                <span className="font-mono text-charcoal font-semibold">Email: head</span> | <span className="font-mono text-charcoal font-semibold">Password: admin123</span>
              </div>
            </form>
          </div>
        </QuestionCard>
      </div>
    </div>
  );
}

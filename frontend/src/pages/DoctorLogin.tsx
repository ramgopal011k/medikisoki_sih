import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Key, UserPlus, Building2, ChevronDown, HeartPulse, MapPin } from 'lucide-react';
import { QuestionCard } from '@/components/QuestionCard';
import { API_URL } from '@/lib/api';
import { loadHospitalsSWR } from '@/lib/hospitalsCache';
import { prefetchDoctorSessions } from '@/lib/prefetch';

export interface HospitalInfo {
  hospital_id: string;
  id: string;
  hospital_name: string;
  name: string;
  location: string;
  hospital_type: string;
  type: string;
}

export default function DoctorLogin() {
  const navigate = useNavigate();
  const { hospitalId } = useParams<{ hospitalId?: string }>();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('demo');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  useEffect(() => {
    if (hospitalId) {
      loadHospitalsSWR((data) => {
        if (data && Array.isArray(data)) {
          const found = data.find((h: any) => h.hospital_id === hospitalId || h.id === hospitalId);
          if (found) {
            setHospitalInfo(found);
          }
        }
      });
    }
  }, [hospitalId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Login failed. Please check your credentials.');
        return;
      }

      const user = data.user || data.doctor || {};
      const token = data.token || 'mock-doctor-token';
      const doctorId = user.doctor_id || user.id || 'd1111111-1111-1111-1111-111111111111';
      const targetHospitalId = hospitalId || user.hospital_id || '11111111-1111-1111-1111-111111111111';

      localStorage.setItem('doctor_token', token);
      localStorage.setItem('doctor_info', JSON.stringify({
        doctor_id: doctorId,
        name: user.name || 'Dr. Rajesh Varma',
        email: user.email || email,
        hospital_id: targetHospitalId,
        role: user.role || 'doctor'
      }));

      // Task 2A.7: prefetch doctor sessions post-login
      prefetchDoctorSessions(targetHospitalId);

      navigate(hospitalId ? `/doctor/dashboard?h=${hospitalId}` : '/doctor/dashboard');
    } catch (err) {
      console.error('Doctor login error:', err);
      setLoginError('Network error. Please ensure the backend is running.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match');
      return;
    }
    
    setIsRegistering(true);
    setRegError('');

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        setRegError(data.error || 'Registration failed');
        return;
      }

      // Auto login after successful registration
      const user = data.user || data.doctor || {};
      const token = data.token || 'mock-doctor-token';
      const doctorId = user.doctor_id || user.id || crypto.randomUUID();
      const targetHospitalId = hospitalId || user.hospital_id || '11111111-1111-1111-1111-111111111111';

      localStorage.setItem('doctor_token', token);
      localStorage.setItem('doctor_info', JSON.stringify({
        doctor_id: doctorId,
        name: user.name || regName,
        email: user.email || regEmail,
        hospital_id: targetHospitalId,
        role: user.role || 'doctor'
      }));

      navigate(hospitalId ? `/doctor/dashboard?h=${hospitalId}` : '/doctor/dashboard');
    } catch (err) {
      console.error('Doctor registration error:', err);
      setRegError('Network error. Please try again later.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDevBypass = () => {
    const targetHospitalId = hospitalId || '11111111-1111-1111-1111-111111111111';

    localStorage.setItem('doctor_token', 'mock-doctor-token');
    localStorage.setItem('doctor_info', JSON.stringify({
      doctor_id: 'd1111111-1111-1111-1111-111111111111',
      name: 'Dr. Dev Bypass',
      email: 'doctor@demo.com',
      hospital_id: targetHospitalId,
      role: 'doctor'
    }));

    navigate(hospitalId ? `/doctor/dashboard?h=${hospitalId}` : '/doctor/dashboard');
  };

  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-4 font-body">
      <div className="w-full max-w-md">
        
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border-2 border-warmgray flex items-center justify-center">
            <HeartPulse className="w-7 h-7 text-primary" />
          </div>
        </div>

        <QuestionCard>
          <div className="text-center pt-8 pb-2 px-8">
            <h1 className="font-display font-bold text-3xl text-charcoal tracking-tight">Doctor Portal</h1>
            <p className="text-muted text-sm mt-1.5">
              {tab === 'login' ? 'Sign in to access your triage queue' : 'Create your doctor account'}
            </p>

            {hospitalId && (
              <div className="mt-4 bg-primary/10 border border-primary/20 rounded-xl p-3 text-left flex items-start gap-3">
                <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    {hospitalInfo?.hospital_type || 'Hospital'} Specific Login
                  </span>
                  <p className="text-sm font-bold text-charcoal truncate">
                    {hospitalInfo?.hospital_name || hospitalInfo?.name || `Facility ID: ${hospitalId.slice(0, 16)}...`}
                  </p>
                  {hospitalInfo?.location && (
                    <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-charcoal shrink-0" />
                      {hospitalInfo.location}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>  {/* Tab switcher */}
  < div className = "mx-8 mt-6 flex bg-sand border border-warmgray p-1 rounded-xl gap-1" >
            <button
              onClick={() => { setTab('login'); setLoginError(''); setRegError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tab === 'login' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-charcoal'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setLoginError(''); setRegError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tab === 'register' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-charcoal'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Create Account
            </button>
          </div >

  <div className="px-8 py-6 space-y-5">

    {/* ─── LOGIN FORM ─── */}
    {tab === 'login' && (
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-bold text-charcoal uppercase tracking-widest">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full h-12 border-2 border-warmgray rounded-xl bg-white text-charcoal px-4 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors text-sm"
            placeholder="doctor@hospital.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-bold text-charcoal uppercase tracking-widest">Password</label>
          <div className="relative">
            <input
              id="password"
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
          <p className="text-danger text-sm font-medium bg-danger/8 border border-danger/20 px-4 py-2.5 rounded-xl">{loginError}</p>
        )}

        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isLoggingIn
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
            : <><LogIn className="w-4 h-4" /> Sign In</>
          }
        </button>

        {/* Demo credentials — collapsed by default */}
        <div className="border border-warmgray rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDemo(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-muted hover:bg-sand/60 transition-colors uppercase tracking-widest"
          >
            <span>Demo Credentials</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDemo ? 'rotate-180' : ''}`} />
          </button>
          {showDemo && (
            <div className="px-4 pb-4 pt-2 bg-sand/40 border-t border-warmgray space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted font-medium">Email</span>
                <button
                  type="button"
                  onClick={() => setEmail('doctor@demo.com')}
                  className="font-mono bg-white border border-warmgray px-2 py-1 rounded-lg text-charcoal hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  doctor@demo.com
                </button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted font-medium">Password</span>
                <button
                  type="button"
                  onClick={() => setPassword('demo123')}
                  className="font-mono bg-white border border-warmgray px-2 py-1 rounded-lg text-charcoal hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  demo123
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setEmail('doctor@demo.com'); setPassword('demo123'); }}
                className="w-full text-xs font-bold text-primary border border-primary/30 rounded-lg py-2 hover:bg-primary hover:text-white transition-all"
              >
                Fill & sign in →
              </button>
            </div>
          )}
        </div>

        {/* Dev bypass (dev only) */}
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={handleDevBypass}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold border-2 border-dashed border-warmgray text-muted hover:border-primary/40 hover:text-primary transition-all"
          >
            <Key className="w-3.5 h-3.5" /> Quick Dev Bypass
          </button>
        )}
      </form>
    )}

    {/* ─── REGISTER FORM ─── */}
    {tab === 'register' && (
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="reg-name" className="text-xs font-bold text-charcoal uppercase tracking-widest">Full Name</label>
          <input
            id="reg-name"
            type="text"
            value={regName}
            onChange={e => setRegName(e.target.value)}
            required
            className="w-full h-12 border-2 border-warmgray rounded-xl bg-white text-charcoal px-4 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors text-sm"
            placeholder="Dr. Priya Sharma"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-xs font-bold text-charcoal uppercase tracking-widest">Email Address</label>
          <input
            id="reg-email"
            type="email"
            value={regEmail}
            onChange={e => setRegEmail(e.target.value)}
            required
            className="w-full h-12 border-2 border-warmgray rounded-xl bg-white text-charcoal px-4 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors text-sm"
            placeholder="dr.priya@hospital.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="text-xs font-bold text-charcoal uppercase tracking-widest">Password</label>
          <div className="relative">
            <input
              id="reg-password"
              type={showRegPassword ? 'text' : 'password'}
              value={regPassword}
              onChange={e => setRegPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-12 border-2 border-warmgray rounded-xl bg-white text-charcoal px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors text-sm"
              placeholder="Min. 6 characters"
            />
            <button
              type="button"
              onClick={() => setShowRegPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal transition-colors"
            >
              {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-confirm" className="text-xs font-bold text-charcoal uppercase tracking-widest">Confirm Password</label>
          <input
            id="reg-confirm"
            type="password"
            value={regConfirm}
            onChange={e => setRegConfirm(e.target.value)}
            required
            className={`w-full h-12 border-2 rounded-xl bg-white text-charcoal px-4 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors text-sm ${regConfirm && regPassword !== regConfirm ? 'border-danger/50' : 'border-warmgray'
              }`}
            placeholder="Re-enter password"
          />
          {regConfirm && regPassword !== regConfirm && (
            <p className="text-xs text-danger font-medium">Passwords don't match</p>
          )}
        </div>

        {regError && (
          <p className="text-danger text-sm font-medium bg-danger/8 border border-danger/20 px-4 py-2.5 rounded-xl">{regError}</p>
        )}

        <button
          type="submit"
          disabled={isRegistering}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isRegistering
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account…</>
            : <><UserPlus className="w-4 h-4" /> Create Account</>
          }
        </button>

        <p className="text-xs text-muted text-center">
          By creating an account, you confirm you are a licensed medical professional.
        </p>
      </form>
    )}

    {/* Footer link */}
    <div className="pt-4 border-t border-warmgray text-center">
      <button
        onClick={() => navigate('/admin/hospitals')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors"
      >
        <Building2 className="w-3.5 h-3.5" />
        Hospital Admin Portal →
      </button>
    </div>

  </div>
        </QuestionCard >
      </div >
    </div >
  );
}

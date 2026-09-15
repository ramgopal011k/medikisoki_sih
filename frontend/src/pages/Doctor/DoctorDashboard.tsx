import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ClipboardList, AlertTriangle, Search, RefreshCw, Activity,
  User, ShieldCheck, HeartPulse, Building2, LogOut,
  Clock, Zap, ChevronDown, TrendingUp, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/lib/api';

interface DoctorInfo {
  doctor_id: string;
  name: string;
  email: string;
  hospital_id: string;
  uid: string;
}

interface PatientSession {
  session_id: string;
  hospital_id: string;
  patient_name: string;
  dummy_aadhaar: string;
  language: string;
  chief_complaint: string;
  status?: string;
  session_token: string;
  created_at: string;
  red_flag_count?: number;
}

interface HospitalItem {
  hospital_id: string;
  hospital_name: string;
  hospital_type?: string;
  location?: string;
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlHospitalId = queryParams.get('h');

  const DEV_DOCTOR: DoctorInfo = {
    doctor_id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Dev Bypass',
    email: 'doctor@demo.com',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    uid: 'dev'
  };

  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(() => {
    const info = localStorage.getItem('doctor_info');
    const token = localStorage.getItem('doctor_token');
    if (!token || !info) return null;
    try { return JSON.parse(info) as DoctorInfo; } catch { return null; }
  });

  const handleDevBypass = () => {
    localStorage.setItem('doctor_token', 'dev-bypass-token');
    localStorage.setItem('doctor_info', JSON.stringify(DEV_DOCTOR));
    setDoctorInfo(DEV_DOCTOR);
  };

  const [patients, setPatients] = useState<PatientSession[]>([]);
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'normal'>('all');
  const [view, setView] = useState<'pending' | 'verified'>('pending');
  // Always default to 'all' so every patient shows regardless of hospital filter
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (!isOnline && !showOfflineBanner) {
      timeout = setTimeout(() => setShowOfflineBanner(true), 30000);
    }
    return () => clearTimeout(timeout);
  }, [isOnline, showOfflineBanner]);

  useEffect(() => {
    fetch(`${API_URL}/api/hospitals`)
      .then(res => res.json())
      .then(data => { if (data.data && Array.isArray(data.data)) setHospitals(data.data); })
      .catch(err => console.error('Failed to load hospitals:', err));
  }, []);

  const fetchPatients = useCallback(async (hId: string, silent = false) => {
    if (!silent) setIsLoading(true);
    setHasError(false);
    try {
      const url = hId === 'all' ? `${API_URL}/api/sessions` : `${API_URL}/api/sessions?hospital_id=${hId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.data) { setPatients(data.data); setLastRefreshed(new Date()); }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      setHasError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!doctorInfo) return; // Show dev bypass panel instead of redirecting
    fetchPatients(selectedHospital);
  }, [doctorInfo, navigate, selectedHospital, fetchPatients]);

  useEffect(() => {
    if (!doctorInfo) return;
    
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    
    const startFallbackPolling = () => {
      if (!fallbackInterval) {
        fallbackInterval = setInterval(() => fetchPatients(selectedHospital, true), 5000);
      }
    };
    
    const stopFallbackPolling = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const channel = supabase
      .channel('doctor-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => fetchPatients(selectedHospital, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, () => fetchPatients(selectedHospital, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_history' }, () => fetchPatients(selectedHospital, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'red_flags' }, () => fetchPatients(selectedHospital, true))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsOnline(true);
          setShowOfflineBanner(true);
          stopFallbackPolling();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsOnline(false);
          startFallbackPolling();
        }
      });
      
    return () => { 
      stopFallbackPolling();
      supabase.removeChannel(channel); 
    };
  }, [doctorInfo, selectedHospital, fetchPatients]);

  const handleLogout = () => {
    localStorage.removeItem('doctor_token');
    localStorage.removeItem('doctor_info');
    navigate('/doctor/login');
  };

  if (!doctorInfo) return (
    <div className="min-h-screen bg-sand font-body flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-warmgray shadow-lg p-8 max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <HeartPulse className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-charcoal">Doctor Portal</h2>
          <p className="text-muted text-sm mt-1">MediKiosk Triage Console</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/doctor/login')}
            className="w-full py-3 px-4 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Login with Credentials
          </button>
          <button
            onClick={handleDevBypass}
            className="w-full py-3 px-4 rounded-xl bg-sand border border-warmgray text-charcoal font-bold text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4 text-primary" />
            Quick Dev Access (Demo)
          </button>
        </div>
        <p className="text-xs text-muted">For SIH Demo: Use Quick Dev Access to bypass login</p>
      </div>
    </div>
  );

  const activePatients = patients.filter(p => p.status !== 'verified');
  const verifiedPatients = patients.filter(p => p.status === 'verified');
  const urgentCount = activePatients.filter(p => (p.red_flag_count || 0) > 0).length;
  const totalCount = activePatients.length;
  const currentList = view === 'pending' ? activePatients : verifiedPatients;

  const filteredPatients = currentList.filter(p => {
    const matchesSearch =
      (p.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.chief_complaint || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.dummy_aadhaar || '').includes(searchTerm);
    if (!matchesSearch) return false;
    if (filter === 'urgent') return (p.red_flag_count || 0) > 0;
    if (filter === 'normal') return (p.red_flag_count || 0) === 0;
    return true;
  });

  const timeAgo = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <div className="min-h-screen bg-sand font-body text-charcoal flex flex-col relative">
      {!isOnline && showOfflineBanner && (
        <div className="bg-danger text-white px-4 py-2.5 flex items-center justify-between z-50">
          <div className="flex items-center gap-2 text-sm font-bold w-full max-w-7xl mx-auto">
            <AlertTriangle className="w-4 h-4" />
            Offline — Reconnecting... (Polling every 5s)
          </div>
          <button onClick={() => setShowOfflineBanner(false)} className="text-white hover:text-white/80 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-warmgray sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <p className="font-display font-bold text-charcoal text-base">MediKiosk</p>
              <p className="text-[10px] text-muted uppercase tracking-widest font-semibold">Triage Console</p>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 ml-2 bg-success/10 border border-success/20 text-success text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hospital picker */}
            <div className="hidden md:flex items-center gap-2 bg-sand border border-warmgray px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal">
              <Building2 className="w-3.5 h-3.5 text-muted shrink-0" />
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer max-w-[180px] truncate text-charcoal"
              >
                <option value="all">All Facilities</option>
                {hospitals.map(h => <option key={h.hospital_id} value={h.hospital_id}>{h.hospital_name}</option>)}
                {hospitals.length === 0 && (
                  <>
                    <option value="11111111-1111-1111-1111-111111111111">City General Hospital</option>
                    <option value="22222222-2222-2222-2222-222222222222">Ayush Wellness Center</option>
                  </>
                )}
              </select>
              <ChevronDown className="w-3 h-3 text-muted" />
            </div>

            <button
              onClick={() => navigate('/admin/hospitals')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors border border-warmgray px-3 py-1.5 rounded-xl bg-white hover:border-primary/30"
            >
              <Building2 className="w-3.5 h-3.5" />
              Admin
            </button>

            {/* Doctor avatar */}
            <div className="hidden sm:flex items-center gap-2.5 bg-sand border border-warmgray px-3 py-1.5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                {doctorInfo.name.charAt(0).toUpperCase()}
              </div>
              <div className="leading-none">
                <p className="text-xs font-bold text-charcoal">Dr. {doctorInfo.name}</p>
                <p className="text-[10px] text-muted mt-0.5">ID: {doctorInfo.doctor_id.slice(0, 8)}…</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-danger transition-colors border border-warmgray px-3 py-2 rounded-xl bg-white hover:border-danger/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Total */}
          <div className="bg-white rounded-2xl border border-warmgray p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">In Queue</p>
              <p className="text-5xl font-display font-bold text-charcoal mt-1 leading-none">{totalCount}</p>
              <p className="text-xs text-muted mt-2">Pending triage</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-primary" />
            </div>
          </div>

          {/* Urgent */}
          <div className={`bg-white rounded-2xl border p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow ${urgentCount > 0 ? 'border-danger/40' : 'border-warmgray'}`}>
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest ${urgentCount > 0 ? 'text-danger' : 'text-muted'}`}>Urgent / Red Flags</p>
              <p className={`text-5xl font-display font-bold mt-1 leading-none ${urgentCount > 0 ? 'text-danger' : 'text-charcoal'}`}>{urgentCount}</p>
              <p className="text-xs text-muted mt-2">{urgentCount > 0 ? 'Needs immediate attention' : 'All clear'}</p>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${urgentCount > 0 ? 'bg-danger/8 border-danger/20' : 'bg-warmgray/50 border-warmgray'}`}>
              <AlertTriangle className={`w-7 h-7 ${urgentCount > 0 ? 'text-danger' : 'text-muted'}`} />
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-2xl border border-warmgray p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">System Status</p>
              <p className="text-xl font-display font-bold text-success mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5" /> Live Syncing
              </p>
              <p className="text-xs text-muted mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Updated {timeAgo(lastRefreshed)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-success/8 border border-success/20 flex items-center justify-center">
              <Activity className="w-7 h-7 text-success animate-pulse" />
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="bg-white border border-warmgray rounded-2xl p-3 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center gap-3">

          {/* View tabs */}
          <div className="flex bg-sand p-1 rounded-xl border border-warmgray text-xs font-bold gap-1">
            <button
              onClick={() => setView('pending')}
              className={`flex-1 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${view === 'pending' ? 'bg-white text-charcoal shadow-sm' : 'text-muted hover:text-charcoal'}`}
            >
              Pending ({activePatients.length})
            </button>
            <button
              onClick={() => setView('verified')}
              className={`flex-1 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${view === 'verified' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-charcoal'}`}
            >
              Verified ({verifiedPatients.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, complaint, ID…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-sand border border-warmgray rounded-xl text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Filter pills */}
          <div className="flex bg-sand p-1 rounded-xl border border-warmgray text-xs font-bold gap-1">
            <button onClick={() => setFilter('all')} className={`px-3 py-2 rounded-lg transition-all ${filter === 'all' ? 'bg-white text-charcoal shadow-sm' : 'text-muted hover:text-charcoal'}`}>
              All ({totalCount})
            </button>
            <button onClick={() => setFilter('urgent')} className={`px-3 py-2 rounded-lg transition-all ${filter === 'urgent' ? 'bg-danger text-white shadow-sm' : 'text-muted hover:text-danger'}`}>
              Urgent ({urgentCount})
            </button>
            <button onClick={() => setFilter('normal')} className={`px-3 py-2 rounded-lg transition-all ${filter === 'normal' ? 'bg-white text-charcoal shadow-sm' : 'text-muted hover:text-charcoal'}`}>
              Routine ({totalCount - urgentCount})
            </button>
          </div>

          <button
            onClick={() => fetchPatients(selectedHospital)}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted hover:text-charcoal border border-warmgray bg-white px-3 py-2.5 rounded-xl hover:border-charcoal/20 transition-all whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Patient Grid ── */}
        {isLoading && patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-warmgray rounded-2xl shadow-sm">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted font-medium text-sm">Fetching triage queue…</p>
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-danger/40 rounded-2xl text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-danger" />
            </div>
            <h3 className="text-xl font-display font-bold text-charcoal mb-1">Failed to load queue</h3>
            <p className="text-danger text-sm max-w-sm">Failed to load queue. Retrying...</p>
          </div>
        ) : patients.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-warmgray rounded-2xl text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-sand border border-warmgray flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-muted" />
            </div>
            <h3 className="text-xl font-display font-bold text-charcoal mb-1">No patients in queue</h3>
            <p className="text-muted text-sm max-w-sm">No patients in queue. Waiting for new sessions...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-warmgray rounded-2xl text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-sand border border-warmgray flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-muted" />
            </div>
            <h3 className="text-xl font-display font-bold text-charcoal mb-1">No matches found</h3>
            <p className="text-muted text-sm max-w-sm">No matches found. Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPatients.map(p => {
              const isUrgent = (p.red_flag_count || 0) > 0;
              const formattedTime = new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const formattedDate = new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

              return (
                <div
                  key={p.session_id}
                  onClick={() => navigate(`/doctor/triage/${p.session_id}`)}
                  className={`group relative bg-white rounded-2xl border-2 transition-all duration-200 shadow-sm hover:shadow-lg cursor-pointer flex flex-col gap-0 overflow-hidden
                    ${isUrgent
                      ? 'border-danger/50 hover:border-danger'
                      : 'border-warmgray hover:border-primary/40'
                    }`}
                >
                  {/* Top accent bar */}
                  <div className={`h-1 w-full ${isUrgent ? 'bg-gradient-to-r from-danger/60 via-danger to-danger/60' : 'bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20'}`} />

                  <div className="p-5 flex flex-col gap-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0
                          ${isUrgent ? 'bg-danger/8 border-danger/20 text-danger' : 'bg-primary/8 border-primary/15 text-primary'}`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-display font-bold text-charcoal text-base leading-tight">{p.patient_name}</p>
                          <p className="text-xs text-muted mt-0.5">{formattedDate} · {formattedTime}</p>
                        </div>
                      </div>
                      {isUrgent && (
                        <span className="flex items-center gap-1 bg-danger text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm animate-pulse shrink-0">
                          <Zap className="w-3 h-3" /> Urgent
                        </span>
                      )}
                    </div>

                    {/* Data table */}
                    <div className="bg-sand rounded-xl border border-warmgray divide-y divide-warmgray/60 text-xs overflow-hidden">
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">Token</span>
                        <span className="font-display font-bold text-primary tracking-widest text-sm">T-{p.session_id.substring(0, 4).toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">Complaint</span>
                        <span className="font-semibold text-charcoal capitalize">{p.chief_complaint || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">ABHA / Aadhaar</span>
                        <span className="font-mono text-charcoal">•••• {p.dummy_aadhaar ? p.dummy_aadhaar.slice(-4) : '0000'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">Language</span>
                        <span className="font-bold text-charcoal uppercase">{p.language || 'en'}</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all border
                        ${isUrgent
                          ? 'bg-danger/8 border-danger/25 text-danger group-hover:bg-danger group-hover:text-white group-hover:border-danger'
                          : 'bg-primary/8 border-primary/20 text-primary group-hover:bg-primary group-hover:text-white group-hover:border-primary'
                        }`}
                      onClick={(e) => { e.stopPropagation(); navigate(`/doctor/triage/${p.session_id}`); }}
                    >
                      View Triage Summary →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredPatients.length > 0 && (
          <p className="text-center text-xs text-muted flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Showing {filteredPatients.length} of {currentList.length} · Auto-syncing every 6s
          </p>
        )}
      </main>
    </div>
  );
}

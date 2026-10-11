import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ClipboardList, AlertTriangle, Search, RefreshCw, Activity,
  User, ShieldCheck, HeartPulse, Building2, LogOut,
  Clock, Zap, ChevronDown, TrendingUp, X, Printer
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/lib/api';
import { loadHospitalsSWR } from '@/lib/hospitalsCache';

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
  body_region?: string;
  caregiver_mode?: boolean;
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
    localStorage.setItem('doctor_token', 'mock-doctor-token');
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
  // Initialize selectedHospital from URL query param or doctorInfo localStorage
  const [selectedHospital, setSelectedHospital] = useState<string>(() => {
    if (urlHospitalId) return urlHospitalId;
    const info = localStorage.getItem('doctor_info');
    if (info) {
      try {
        const parsed = JSON.parse(info);
        if (parsed.hospital_id && parsed.hospital_id !== 'all') {
          return parsed.hospital_id;
        }
      } catch {}
    }
    return 'all';
  });

  useEffect(() => {
    if (urlHospitalId) {
      setSelectedHospital(urlHospitalId);
    }
  }, [urlHospitalId]);

  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(true);
  const [hisPushNotice, setHisPushNotice] = useState<string | null>(null);
  const [summaryLang, setSummaryLang] = useState<'en' | 'hi' | 'mr' | 'bn'>('en');
  const summaryLangCache = useRef<Map<string, any>>(new Map());

  const DASHBOARD_STRINGS: Record<string, Record<string, string>> = {
    en: {
      inQueue: 'In Queue',
      pendingTriage: 'Pending triage',
      priorityAlerts: 'Triage Priority Alerts',
      priorityDesc: 'Routed to triage staff in production; shown here on physician dashboard for demo.',
      systemStatus: 'System Status',
      liveSyncing: 'Live Syncing',
      pending: 'Pending',
      verified: 'Verified',
      searchPlaceholder: 'Search name, complaint, ID…',
      all: 'All',
      urgent: 'Urgent',
      routine: 'Routine',
      refresh: 'Refresh',
      viewSummary: 'View Triage Summary',
      pushHis: 'Push to HIS',
      printSummary: 'Print Summary',
      token: 'Token',
      complaint: 'Complaint',
      abhaAadhaar: 'ABHA / Aadhaar',
      languageLabel: 'Language',
      patientIndicated: 'Patient indicated:',
      disclaimer: 'This is a clinical decision-support tool. All AI-generated content requires verification by a qualified physician. Not a diagnosis.'
    },
    hi: {
      inQueue: 'कतार में',
      pendingTriage: 'ट्राइएज लंबित',
      priorityAlerts: 'ट्राइएज प्राथमिकता अलर्ट',
      priorityDesc: 'उत्पादन में ट्राइएज स्टाफ को भेजा जाता है; यहां डेमो के लिए दिखाया गया है।',
      systemStatus: 'सिस्टम स्थिति',
      liveSyncing: 'लाइव सिंक हो रहा है',
      pending: 'लंबित',
      verified: 'सत्यापित',
      searchPlaceholder: 'नाम, शिकायत, या आईडी खोजें…',
      all: 'सभी',
      urgent: 'अति आवश्यक',
      routine: 'सामान्य',
      refresh: 'रिफ्रेश करें',
      viewSummary: 'ट्राइएज सारांश देखें',
      pushHis: 'एचआईएस (HIS) में भेजें',
      printSummary: 'सारांश प्रिंट करें',
      token: 'टोकन',
      complaint: 'शिकायत',
      abhaAadhaar: 'आभा / आधार',
      languageLabel: 'भाषा',
      patientIndicated: 'मरीज द्वारा सूचित:',
      disclaimer: 'यह एक नैदानिक निर्णय-सहायता उपकरण है। सभी एआई-जनित सामग्री का योग्य चिकित्सक द्वारा सत्यापन आवश्यक है।'
    },
    mr: {
      inQueue: 'रांगेत',
      pendingTriage: 'ट्रायज प्रलंबित',
      priorityAlerts: 'ट्रायज प्राथमिकता सूचना',
      priorityDesc: 'उत्पादनात ट्रायज कर्मचाऱ्यांकडे पाठवले जाते; येथे प्रात्यक्षिकासाठी दाखवले आहे.',
      systemStatus: 'सिस्टम स्थिती',
      liveSyncing: 'थेट सिंक होत आहे',
      pending: 'प्रलंबित',
      verified: 'पडताळलेले',
      searchPlaceholder: 'नाव, तक्रार, किंवा आयडी शोधा…',
      all: 'सर्व',
      urgent: 'तातडीचे',
      routine: 'सामान्य',
      refresh: 'ताजे करा',
      viewSummary: 'ट्रायज सारांश पहा',
      pushHis: 'एचआयएस (HIS) मध्ये पाठवा',
      printSummary: 'सारांश मुद्रित करा',
      token: 'टोकन',
      complaint: 'तक्रार',
      abhaAadhaar: 'आभा / आधार',
      languageLabel: 'भाषा',
      patientIndicated: 'रुग्णाने सूचित केलेले:',
      disclaimer: 'हे एक वैद्यकीय निर्णय-सहाय्यक साधन आहे. सर्व एआय-निर्मित मजकुराची पात्र डॉक्टरांकडून पडताळणी आवश्यक आहे.'
    },
    bn: {
      inQueue: 'সারিতে',
      pendingTriage: 'ট্রায়াজ অপেক্ষারত',
      priorityAlerts: 'ট্রায়াজ অগ্রাধিকার সতর্কতা',
      priorityDesc: 'উৎপাদনে ট্রায়াজ কর্মীদের কাছে পাঠানো হয়; ডেমোর জন্য এখানে দেখানো হয়েছে।',
      systemStatus: 'সিস্টেম স্থিতি',
      liveSyncing: 'লাইভ সিঙ্ক হচ্ছে',
      pending: 'অপেক্ষারত',
      verified: 'যাচাইকৃত',
      searchPlaceholder: 'নাম, অভিযোগ, বা আইডি খুঁজুন…',
      all: 'সকল',
      urgent: 'জরুরি',
      routine: 'নিয়মিত',
      refresh: 'রিফ্রেশ করুন',
      viewSummary: 'ট্রায়াজ সংক্ষিপ্ত বিবরণ দেখুন',
      pushHis: 'এইচআইএস (HIS)-এ পাঠান',
      printSummary: 'সংক্ষেপ মুদ্রণ করুন',
      token: 'টোকেন',
      complaint: 'অভিযোগ',
      abhaAadhaar: 'আভা / আধার',
      languageLabel: 'ভাষা',
      patientIndicated: 'রোগী নির্দেশিত:',
      disclaimer: 'এটি একটি ক্লিনিক্যাল সিদ্ধান্ত-সহায়ক সরঞ্জাম। সমস্ত এআই-উত্পন্ন সামগ্রী একজন যোগ্য চিকিৎসকের দ্বারা যাচাই করা আবশ্যক।'
    }
  };

  const COMPLAINT_MAP: Record<string, Record<string, string>> = {
    'chest pain': { hi: 'छाती में दर्द', mr: 'छातीत दुखणे', bn: 'বুকে ব্যথা' },
    'fever': { hi: 'बुखार', mr: 'ताप', bn: 'জ্বর' },
    'abdominal pain': { hi: 'पेट में दर्द', mr: 'पोटदुखी', bn: 'পেটে ব্যথা' },
    'headache': { hi: 'सिरदर्द', mr: 'डोकेदुखी', bn: 'মাথাব্যথা' },
    'back pain': { hi: 'पीठ में दर्द', mr: 'पाठदुखी', bn: 'পিঠে ব্যথা' },
    'cough': { hi: 'खांसी', mr: 'खोकला', bn: 'কাশি' },
    'other': { hi: 'अन्य', mr: 'इतर', bn: 'অন্যান্য' },
    'shortness of breath': { hi: 'सांस लेने में तकलीफ', mr: 'श्वास घेण्यास त्रास', bn: 'শ্বাসকষ্ট' },
    'general checkup': { hi: 'सामान्य जांच', mr: 'सामान्य तपासणी', bn: 'সাধারণ চেকআপ' },
  };

  const tDash = (key: string) => DASHBOARD_STRINGS[summaryLang]?.[key] || DASHBOARD_STRINGS.en[key] || key;

  // Cache all languages on first fetch; prefetch active patients
  useEffect(() => {
    if (patients.length === 0) return;
    patients.slice(0, 8).forEach(p => {
      (['en', 'hi', 'mr', 'bn'] as const).forEach(l => {
        const cacheKey = `${p.session_id}_${l}`;
        if (!summaryLangCache.current.has(cacheKey)) {
          fetch(`${API_URL}/api/summary/${p.session_id}?lang=${l}`)
            .then(res => res.json())
            .then(data => {
              summaryLangCache.current.set(cacheKey, data);
            })
            .catch(() => {});
        }
      });
    });
  }, [patients]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (!isOnline && !showOfflineBanner) {
      timeout = setTimeout(() => setShowOfflineBanner(true), 30000);
    }
    return () => clearTimeout(timeout);
  }, [isOnline, showOfflineBanner]);

  useEffect(() => {
    loadHospitalsSWR((data) => {
      if (Array.isArray(data)) setHospitals(data);
    });
  }, []);

  const fetchPatients = useCallback(async (hId: string, silent = false) => {
    // Render prefetched sessions immediately
    const cached = sessionStorage.getItem(`medikiosk.sessions.cache.${hId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.data && Array.isArray(parsed.data) && Date.now() - parsed.timestamp < 60000) {
          setPatients(parsed.data);
          setIsLoading(false);
        }
      } catch {}
    } else if (!silent) {
      setIsLoading(true);
    }
    setHasError(false);
    try {
      const url = hId === 'all' ? `${API_URL}/api/sessions` : `${API_URL}/api/sessions?hospital_id=${hId}`;
      const token = localStorage.getItem('doctor_token') || 'mock-doctor-token';
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.data) { 
        setPatients(data.data); 
        setLastRefreshed(new Date());
        sessionStorage.setItem(`medikiosk.sessions.cache.${hId}`, JSON.stringify({
          data: data.data,
          timestamp: Date.now()
        }));
      }
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
            Quick Dev Access
          </button>
        </div>
        <p className="text-xs text-muted">Use Quick Dev Access to bypass login</p>
      </div>
    </div>
  );

  const activePatients = patients.filter(p => p.status !== 'verified');
  const verifiedPatients = patients.filter(p => p.status === 'verified');
  const urgentCount = activePatients.filter(p => (p.red_flag_count || 0) > 0).length;
  const totalCount = activePatients.length;
  const currentList = view === 'pending' ? activePatients : verifiedPatients;
  const activeHospitalObj = hospitals.find(h => (h.hospital_id || (h as any).id) === selectedHospital);

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
            {/* Hospital picker - with fixed custom chevron arrow styling */}
            <div className="hidden md:flex items-center bg-sand border border-warmgray px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal relative">
              <Building2 className="w-3.5 h-3.5 text-muted shrink-0 mr-1.5" />
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer max-w-[180px] truncate text-charcoal font-semibold appearance-none pr-6"
              >
                <option value="all">All Facilities</option>
                {hospitals.map(h => (
                  <option key={h.hospital_id || (h as any).id} value={h.hospital_id || (h as any).id}>
                    {h.hospital_name || (h as any).name}
                  </option>
                ))}
                {hospitals.length === 0 && (
                  <>
                    <option value="11111111-1111-1111-1111-111111111111">City General Hospital</option>
                    <option value="22222222-2222-2222-2222-222222222222">Ayush Wellness Center</option>
                  </>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Language Toggle: EN | HI | MR | BN */}
            <div className="flex items-center gap-1 bg-sand border border-warmgray p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSummaryLang('en')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  summaryLang === 'en'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary language: English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setSummaryLang('hi')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  summaryLang === 'hi'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary language: Hindi"
              >
                HI
              </button>
              <button
                type="button"
                onClick={() => setSummaryLang('mr')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  summaryLang === 'mr'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary language: Marathi"
              >
                MR
              </button>
              <button
                type="button"
                onClick={() => setSummaryLang('bn')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  summaryLang === 'bn'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary language: Bengali"
              >
                BN
              </button>
            </div>

            {summaryLang !== 'en' && (
              <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                {summaryLang === 'hi'
                  ? 'एआई-अनुवादित — नैदानिक उपयोग से पहले सत्यापित करें'
                  : summaryLang === 'mr'
                  ? 'एआय-भाषांतरित — वैद्यकीय वापरापूर्वी तपासा'
                  : 'এআই-অনূদিত — ব্যবহারের আগে যাচাই করুন'}
              </span>
            )}

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

        {/* Active Facility Filter Banner */}
        {selectedHospital !== 'all' && activeHospitalObj && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active Hospital Context</span>
                  <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {activeHospitalObj.hospital_type || (activeHospitalObj as any).type || 'General'}
                  </span>
                </div>
                <h3 className="font-display font-bold text-lg text-charcoal">
                  {activeHospitalObj.hospital_name || (activeHospitalObj as any).name}
                </h3>
              </div>
            </div>
            <button
              onClick={() => setSelectedHospital('all')}
              className="text-xs font-bold text-primary hover:underline bg-white border border-primary/20 px-3 py-1.5 rounded-xl shrink-0"
            >
              Show All Facilities →
            </button>
          </div>
        )}

        {/* Clinical Liability Disclaimer Banner */}
        <div className="bg-amber-50 border-2 border-amber-200 text-amber-900 text-sm p-3.5 rounded-xl font-medium flex items-center gap-2.5 shadow-sm">
          <span className="text-amber-600 text-base font-bold shrink-0">⚠</span>
          <span>{tDash('disclaimer')}</span>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Total */}
          <div className="bg-white rounded-2xl border border-warmgray p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">{tDash('inQueue')}</p>
              <p className="text-5xl font-display font-bold text-charcoal mt-1 leading-none">{totalCount}</p>
              <p className="text-xs text-muted mt-2">{tDash('pendingTriage')}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-primary" />
            </div>
          </div>

          {/* Triage Priority Alerts */}
          <div className={`bg-white rounded-2xl border p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow ${urgentCount > 0 ? 'border-danger/40' : 'border-warmgray'}`}>
            <div className="flex-1 pr-3">
              <p className={`text-xs font-bold uppercase tracking-widest ${urgentCount > 0 ? 'text-danger' : 'text-muted'}`}>{tDash('priorityAlerts')}</p>
              <p className={`text-5xl font-display font-bold mt-1 leading-none ${urgentCount > 0 ? 'text-danger' : 'text-charcoal'}`}>{urgentCount}</p>
              <p className="text-[11px] text-muted mt-2 font-medium leading-snug">
                {tDash('priorityDesc')}
              </p>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 ${urgentCount > 0 ? 'bg-danger/8 border-danger/20' : 'bg-warmgray/50 border-warmgray'}`}>
              <AlertTriangle className={`w-7 h-7 ${urgentCount > 0 ? 'text-danger' : 'text-muted'}`} />
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-2xl border border-warmgray p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest">{tDash('systemStatus')}</p>
              <p className="text-xl font-display font-bold text-success mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5" /> {tDash('liveSyncing')}
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
              {tDash('pending')} ({activePatients.length})
            </button>
            <button
              onClick={() => setView('verified')}
              className={`flex-1 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${view === 'verified' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-charcoal'}`}
            >
              {tDash('verified')} ({verifiedPatients.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={tDash('searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-sand border border-warmgray rounded-xl text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Filter pills */}
          <div className="flex bg-sand p-1 rounded-xl border border-warmgray text-xs font-bold gap-1">
            <button onClick={() => setFilter('all')} className={`px-3 py-2 rounded-lg transition-all ${filter === 'all' ? 'bg-white text-charcoal shadow-sm' : 'text-muted hover:text-charcoal'}`}>
              {tDash('all')} ({totalCount})
            </button>
            <button onClick={() => setFilter('urgent')} className={`px-3 py-2 rounded-lg transition-all ${filter === 'urgent' ? 'bg-danger text-white shadow-sm' : 'text-muted hover:text-danger'}`}>
              {tDash('urgent')} ({urgentCount})
            </button>
            <button onClick={() => setFilter('normal')} className={`px-3 py-2 rounded-lg transition-all ${filter === 'normal' ? 'bg-white text-charcoal shadow-sm' : 'text-muted hover:text-charcoal'}`}>
              {tDash('routine')} ({totalCount - urgentCount})
            </button>
          </div>

          <button
            onClick={() => fetchPatients(selectedHospital)}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted hover:text-charcoal border border-warmgray bg-white px-3 py-2.5 rounded-xl hover:border-charcoal/20 transition-all whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {tDash('refresh')}
          </button>
        </div>

        {/* Triage Priority Alerts Section */}
        <div className="bg-red-50/80 border border-red-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-danger">{tDash('priorityAlerts')}</h2>
              <p className="text-xs text-charcoal/70">
                {tDash('priorityDesc')}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-danger bg-danger/10 px-2.5 py-1 rounded-full border border-danger/20 self-start sm:self-auto shrink-0">
            {urgentCount} Priority Case{urgentCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* ── Patient Grid ── */}
        {isLoading && patients.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white border border-warmgray rounded-2xl shadow-xs">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-sand" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-sand rounded w-1/3" />
                    <div className="h-3 bg-sand rounded w-1/2" />
                  </div>
                </div>
                <div className="h-8 w-24 bg-sand rounded-xl" />
              </div>
            ))}
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
                  onMouseEnter={() => {
                    import('../../lib/triageCache').then(({ prefetchTriage }) => {
                      prefetchTriage(p.session_id, localStorage.getItem('doctor_token'));
                    });
                  }}
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
                          {p.caregiver_mode && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                              {summaryLang === 'hi' ? 'देखभालकर्ता द्वारा सूचित' : summaryLang === 'mr' ? 'काळजीवाहू द्वारे नोंदवलेले' : summaryLang === 'bn' ? 'পরিচর্যাকর দ্বারা বর্ণিত' : 'Reported by caregiver'}
                            </span>
                          )}
                        </div>
                      </div>
                      {isUrgent && (
                        <span className="flex items-center gap-1 bg-danger text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm animate-pulse shrink-0">
                          <Zap className="w-3 h-3" /> {tDash('urgent')}
                        </span>
                      )}
                    </div>

                    {/* Data table */}
                    <div className="bg-sand rounded-xl border border-warmgray divide-y divide-warmgray/60 text-xs overflow-hidden">
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">{tDash('token')}</span>
                        <span className="font-display font-bold text-primary tracking-widest text-sm">T-{p.session_id.substring(0, 4).toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">{tDash('complaint')}</span>
                        <div className="text-right">
                          <span className="font-semibold text-charcoal capitalize">
                            {summaryLang !== 'en'
                              ? (COMPLAINT_MAP[(p.chief_complaint || '').toLowerCase()]?.[summaryLang] ||
                                 summaryLangCache.current.get(`${p.session_id}_${summaryLang}`)?.content?.chief_complaint ||
                                 p.chief_complaint || '—')
                              : (p.chief_complaint || '—')}
                          </span>
                          {p.body_region && (
                            <p className="text-[11px] font-medium text-primary mt-0.5">
                              {tDash('patientIndicated')} {p.body_region.split(',').map(r => r.replace(/-/g, ' ').replace(/_/g, ' ')).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">{tDash('abhaAadhaar')}</span>
                        <span className="font-mono text-charcoal">•••• {p.dummy_aadhaar ? p.dummy_aadhaar.slice(-4) : '0000'}</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="font-bold text-muted uppercase tracking-wider">{tDash('languageLabel')}</span>
                        <span className="font-bold text-charcoal uppercase">{p.language || 'en'}</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border
                          ${isUrgent
                            ? 'bg-danger/8 border-danger/25 text-danger group-hover:bg-danger group-hover:text-white group-hover:border-danger'
                            : 'bg-primary/8 border-primary/20 text-primary group-hover:bg-primary group-hover:text-white group-hover:border-primary'
                          }`}
                        onClick={(e) => { e.stopPropagation(); navigate(`/doctor/triage/${p.session_id}?lang=${summaryLang}`); }}
                      >
                        {tDash('viewSummary')} →
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          className="px-3 py-2.5 rounded-xl text-xs font-bold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 flex items-center justify-center gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHisPushNotice('FHIR R4 bundle generated and written to audit_logs. Push target is a simulation — no live ABDM sandbox or hospital HIS is connected in this build. Production integration path: ABDM Health Information Exchange via FHIR R4.');
                          }}
                          aria-label="Push to HIS"
                        >
                          {tDash('pushHis')}
                        </button>
                        <button
                          type="button"
                          className="no-print px-3 py-2.5 rounded-xl text-xs font-bold border border-warmgray bg-white text-charcoal hover:bg-sand/60 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/doctor/triage/${p.session_id}?lang=${summaryLang}&print=true`);
                          }}
                          aria-label="Print Summary"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{tDash('printSummary')}</span>
                        </button>
                      </div>
                    </div>
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

      {hisPushNotice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-primary/30 relative">
            <div className="flex items-center gap-2 text-primary font-bold text-lg mb-3">
              <span>HIS / EMR System Notice</span>
            </div>
            <p className="text-charcoal text-sm leading-relaxed mb-6 font-body">
              {hisPushNotice}
            </p>
            <button
              onClick={() => setHisPushNotice(null)}
              className="w-full py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

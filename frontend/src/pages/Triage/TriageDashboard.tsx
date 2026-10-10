import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Zap, 
  Clock, 
  FileText, 
  RefreshCw, 
  ShieldAlert, 
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Activity
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface TriageSession {
  id: string;
  session_id: string;
  hospital_id: string;
  patient_name: string;
  chief_complaint: string;
  created_at: string;
  red_flag: boolean;
  red_flag_count: number;
  red_flags: string[];
  severity: 'critical' | 'high';
}

interface TriageAlertGroup {
  severity: 'critical' | 'high';
  sessions: TriageSession[];
}

function playSoftChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (err) {
    console.warn('Could not play audio chime:', err);
  }
}

export default function TriageDashboard() {
  const params = useParams<{ id?: string; hospitalId?: string }>();
  const hospitalId = params.id || params.hospitalId || '';
  const navigate = useNavigate();

  const [alertGroups, setAlertGroups] = useState<TriageAlertGroup[]>([
    { severity: 'critical', sessions: [] },
    { severity: 'high', sessions: [] }
  ]);
  const [hospitalName, setHospitalName] = useState<string>('Hospital');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg = 'New triage alert') => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  // Collapsible on mobile (default: critical expanded, high collapsed; on md+ always expanded)
  const [criticalExpanded, setCriticalExpanded] = useState<boolean>(true);
  const [highExpanded, setHighExpanded] = useState<boolean>(false);

  const getAuthToken = () => {
    return localStorage.getItem('triage_token') || localStorage.getItem('doctor_token') || 'medikiosk-demo-token';
  };

  const fetchAlerts = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/triage/alerts?hospital_id=${hospitalId || ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to load triage alerts (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setAlertGroups(data);
      }
    } catch (err: any) {
      console.error('Fetch triage alerts error:', err);
      setError(err?.message || 'Error loading triage alerts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Fetch hospital details
    if (hospitalId) {
      fetch(`${API_URL}/api/hospitals/${hospitalId}`)
        .then(r => r.json())
        .then(h => {
          if (h && (h.hospital_name || h.name)) {
            setHospitalName(h.hospital_name || h.name);
          }
        })
        .catch(() => {});
    }

    fetchAlerts();

    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const startFallbackPolling = () => {
      if (!fallbackInterval) {
        fallbackInterval = setInterval(() => {
          fetchAlerts(false);
        }, 10000); // 10s fallback
      }
    };

    const stopFallbackPolling = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    // Realtime subscription for red_flags and sessions
    const channel = supabase
      .channel(`triage-dashboard-${hospitalId || 'all'}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'red_flags' },
        async (payload) => {
          // If hospital_id is specified, filter by session hospital_id
          if (hospitalId && hospitalId !== 'all') {
            try {
              const { data: sess } = await supabase
                .from('sessions')
                .select('hospital_id')
                .eq('id', payload.new?.session_id)
                .maybeSingle();
              if (sess && sess.hospital_id && sess.hospital_id !== hospitalId) {
                return;
              }
            } catch (err) {
              console.warn('Hospital filter error on red flag event:', err);
            }
          }

          playSoftChime();
          showToast('New triage alert');
          await fetchAlerts(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          fetchAlerts(false);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          stopFallbackPolling();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startFallbackPolling();
        }
      });

    return () => {
      stopFallbackPolling();
      supabase.removeChannel(channel);
    };
  }, [hospitalId]);

  const criticalGroup = alertGroups.find(g => g.severity === 'critical') || { severity: 'critical', sessions: [] };
  const highGroup = alertGroups.find(g => g.severity === 'high') || { severity: 'high', sessions: [] };

  const totalCritical = criticalGroup.sessions.length;
  const totalHigh = highGroup.sessions.length;
  const totalAlerts = totalCritical + totalHigh;

  const handleOpenPatientSummary = (sessionId: string) => {
    // Open in read-only mode (Task 4: NO edit / verify / notes - doctor-only)
    navigate(`/doctor/triage/${sessionId}?readOnly=true&from=triage&hospitalId=${hospitalId || ''}`);
  };

  return (
    <div className="min-h-screen bg-sand font-body text-charcoal pb-16 overflow-x-hidden w-full max-w-full">
      {/* Top Header */}
      <header className="bg-white border-b border-warmgray sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-14 sm:h-16 py-2.5 sm:py-0 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate(-1)}
              className="min-h-[48px] min-w-[48px] p-2 flex items-center justify-center text-muted hover:text-charcoal hover:bg-sand rounded-xl transition"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-danger/10 text-danger border border-danger/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-charcoal leading-tight">
                  Triage Alerts Monitor
                </h1>
                <p className="text-xs text-muted truncate max-w-[170px] sm:max-w-xs font-medium">
                  {hospitalName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand text-xs font-semibold text-charcoal border border-warmgray">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>Live Monitor</span>
            </div>

            <button
              onClick={() => fetchAlerts(true)}
              disabled={isRefreshing}
              className="min-h-[48px] px-3.5 py-1.5 flex items-center gap-1.5 rounded-xl border border-warmgray bg-white hover:bg-sand text-xs font-semibold text-charcoal transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Banner summary: condensed on mobile, keeping hospital name + severity counts visible */}
        <div className="bg-white rounded-2xl border-2 border-warmgray p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-charcoal">
              Red-Flag Patient Queue
            </h2>
            {/* Non-essential subtitle text hidden on mobile */}
            <p className="hidden sm:block text-sm text-muted mt-0.5">
              Dedicated triage-staff alert feed. Click any patient to inspect clinical details in read-only mode.
            </p>
          </div>

          {/* Severity counts kept visible on all viewports */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-danger/10 border border-danger/30 text-center min-w-[70px]">
              <p className="text-[10px] sm:text-xs font-bold text-danger uppercase tracking-wider">Critical</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-danger">{totalCritical}</p>
            </div>
            <div className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center min-w-[70px]">
              <p className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider">High</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-amber-700">{totalHigh}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted text-sm font-medium">Loading triage alerts...</p>
          </div>
        ) : totalAlerts === 0 ? (
          /* Empty state: Center-aligned on mobile, "No red-flag patients right now", Icon + text, no card box */
          <div className="py-14 sm:py-16 px-4 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-success/10 text-success border border-success/30 flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Activity className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-charcoal mb-1">
              No red-flag patients right now
            </h3>
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
              All currently active patients have cleared standard triage checks. New incoming alerts will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8 flex flex-col w-full">
            {/* ── CRITICAL SEVERITY GROUP ── */}
            <section className="space-y-3 sm:space-y-4 w-full">
              {/* Collapsible header on mobile, static on desktop */}
              <div 
                onClick={() => setCriticalExpanded(prev => !prev)}
                className="flex items-center justify-between border-b-2 border-danger/30 pb-2.5 cursor-pointer md:cursor-default select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-danger text-white flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-display font-bold text-danger uppercase tracking-wider">
                    Critical Priority ({totalCritical})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-danger text-white">
                    Immediate Attention
                  </span>
                  <ChevronDown className={`w-4 h-4 text-danger transition-transform md:hidden ${criticalExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Critical content: hidden if collapsed on mobile, block on md+ */}
              <div className={`${criticalExpanded ? 'block' : 'hidden'} md:block w-full`}>
                {totalCritical === 0 ? (
                  <div className="p-5 sm:p-6 bg-white rounded-xl border border-warmgray text-center text-xs text-muted italic">
                    No critical alerts currently.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 w-full">
                    {criticalGroup.sessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleOpenPatientSummary(s.id)}
                        className="w-full min-h-[72px] bg-white rounded-2xl border-2 border-danger/30 hover:border-danger hover:shadow-md transition-all p-4 sm:p-5 cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                      >
                        <div>
                          {/* Red flag / severity pill ABOVE the card content */}
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <span className="text-sm md:text-xs font-bold px-2.5 py-1 rounded-full bg-danger/10 text-danger border border-danger/25 uppercase tracking-wide inline-flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5" /> CRITICAL
                            </span>
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Patient Name (text-lg on mobile, text-base on desktop) */}
                          <div className="mb-2">
                            <h4 className="font-display font-bold text-lg md:text-base text-charcoal group-hover:text-danger transition-colors leading-tight">
                              {s.patient_name}
                            </h4>
                          </div>

                          {/* Chief complaint container */}
                          <div className="bg-sand/60 p-3 rounded-xl border border-warmgray/70 my-2">
                            <p className="text-[10px] uppercase font-bold text-muted tracking-wider">Chief Complaint</p>
                            <p className="text-sm font-semibold text-charcoal mt-0.5 line-clamp-2">
                              {s.chief_complaint}
                            </p>
                          </div>

                          {s.red_flags && s.red_flags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {s.red_flags.map((rf, idx) => (
                                <span key={idx} className="text-xs md:text-[10px] font-bold px-2 py-0.5 rounded-md bg-danger/10 text-danger border border-danger/20">
                                  {rf}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Visible "Tap to open →" affordance at bottom of card */}
                        <div className="pt-3 mt-3 border-t border-warmgray flex items-center justify-between text-sm md:text-xs font-bold text-danger">
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4 md:w-3.5 md:h-3.5" /> Tap to open →
                          </span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ── HIGH SEVERITY GROUP ── */}
            <section className="space-y-3 sm:space-y-4 w-full">
              {/* Collapsible header on mobile, static on desktop */}
              <div 
                onClick={() => setHighExpanded(prev => !prev)}
                className="flex items-center justify-between border-b-2 border-amber-500/30 pb-2.5 cursor-pointer md:cursor-default select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-display font-bold text-amber-800 uppercase tracking-wider">
                    High Priority ({totalHigh})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-600 text-white">
                    High Attention
                  </span>
                  <ChevronDown className={`w-4 h-4 text-amber-800 transition-transform md:hidden ${highExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* High content: hidden if collapsed on mobile, block on md+ */}
              <div className={`${highExpanded ? 'block' : 'hidden'} md:block w-full`}>
                {totalHigh === 0 ? (
                  <div className="p-5 sm:p-6 bg-white rounded-xl border border-warmgray text-center text-xs text-muted italic">
                    No high priority alerts currently.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 w-full">
                    {highGroup.sessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleOpenPatientSummary(s.id)}
                        className="w-full min-h-[72px] bg-white rounded-2xl border-2 border-amber-400/50 hover:border-amber-500 hover:shadow-md transition-all p-4 sm:p-5 cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                      >
                        <div>
                          {/* Red flag / severity pill ABOVE the card content */}
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <span className="text-sm md:text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 border border-amber-500/30 uppercase tracking-wide inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> HIGH
                            </span>
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Patient Name (text-lg on mobile, text-base on desktop) */}
                          <div className="mb-2">
                            <h4 className="font-display font-bold text-lg md:text-base text-charcoal group-hover:text-amber-800 transition-colors leading-tight">
                              {s.patient_name}
                            </h4>
                          </div>

                          {/* Chief complaint container */}
                          <div className="bg-sand/60 p-3 rounded-xl border border-warmgray/70 my-2">
                            <p className="text-[10px] uppercase font-bold text-muted tracking-wider">Chief Complaint</p>
                            <p className="text-sm font-semibold text-charcoal mt-0.5 line-clamp-2">
                              {s.chief_complaint}
                            </p>
                          </div>

                          {s.red_flags && s.red_flags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {s.red_flags.map((rf, idx) => (
                                <span key={idx} className="text-xs md:text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 border border-amber-500/25">
                                  {rf}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Visible "Tap to open →" affordance at bottom of card */}
                        <div className="pt-3 mt-3 border-t border-warmgray flex items-center justify-between text-sm md:text-xs font-bold text-amber-800">
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4 md:w-3.5 md:h-3.5" /> Tap to open →
                          </span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Realtime Toast Notification */}
      {toastMessage && (
        <div 
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-charcoal text-white rounded-xl shadow-xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 transition duration-300"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

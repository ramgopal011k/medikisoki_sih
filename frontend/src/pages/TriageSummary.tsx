import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import {
  ArrowLeft, Check, AlertTriangle, ShieldCheck, Edit2, Save, X,
  ChevronDown, ChevronUp, Sparkles, BrainCircuit, Calendar,
  ExternalLink, Trash2, User, Clock, Zap, FileText, ClipboardList,
  Activity, CheckCircle2, MessageSquare, HeartPulse
} from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Session {
  session_id: string;
  patient_name: string;
  dummy_aadhaar: string;
  language: string;
  chief_complaint: string;
  created_at: string;
}
interface HistoryFact {
  fact_id: string;
  question_text: string;
  answer_value: string;
  provenance: 'patient_reported' | 'doctor_entered' | 'system_derived' | 'ocr_extracted';
  verified: number;
}
interface RedFlag { flag_id: string; rule_id: string; created_at: string; }
interface MedicalHistoryItem { item_id: string; category: string; value: string; }
interface AyushAssessment { assessment_id: string; dimension: string; value: string; }
interface Document { document_id: string; file_url: string; ocr_status?: string; }
interface ExtractedField { extraction_id: string; field_name: string; field_value: string; confidence: number; document_id?: string; }
interface Summary { summary_id: string; generated_text: string; }
interface PastVisit { session_id: string; date: string; status: string; chief_complaint: string; documents: any[]; doctor_notes: any; }

function CollapsibleSection({ title, children, defaultOpen = false, icon: Icon, badge, urgent = false }: any) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${urgent && badge && badge !== 'None' ? 'border-danger/40' : 'border-warmgray'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-sand/40 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${urgent && badge && badge !== 'None' ? 'bg-danger/8 border-danger/20' : 'bg-sand border-warmgray'}`}>
              <Icon className={`w-4 h-4 ${urgent && badge && badge !== 'None' ? 'text-danger' : 'text-muted'}`} />
            </div>
          )}
          <h2 className={`text-xs font-bold uppercase tracking-widest ${urgent && badge && badge !== 'None' ? 'text-danger' : 'text-muted'}`}>
            {title}
          </h2>
          {badge && (
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
              badge === 'No data' || badge === 'None'
                ? 'bg-sand text-muted border-warmgray'
                : urgent
                ? 'bg-danger/8 text-danger border-danger/20'
                : 'bg-primary/8 text-primary border-primary/15'
            }`}>{badge}</span>
          )}
        </div>
        <span className="text-muted">{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 border-t border-warmgray">
          <div className="pt-5">{children}</div>
        </div>
      )}
    </section>
  );
}

export default function TriageSummary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [facts, setFacts] = useState<HistoryFact[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryItem[]>([]);
  const [ayushAssessments, setAyushAssessments] = useState<AyushAssessment[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [extractions, setExtractions] = useState<ExtractedField[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [clinicalAlerts, setClinicalAlerts] = useState<any>(null);
  const [reconciliationConflicts, setReconciliationConflicts] = useState<{ field: string; documentValue: string; patientValue: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingFactId, setVerifyingFactId] = useState<string | null>(null);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('doctor_token') || 'medikiosk-demo-token';
    return {
      'Authorization': `Bearer ${token}`,
      ...extra
    };
  };

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const triageRes = await fetch(`${API_URL}/sessions/${sessionId}/triage`, {
          headers: getAuthHeaders()
        });
        const triageData = await triageRes.json();
        if (!ignore && triageData.session) {
          setSession(triageData.session);
          setFacts(triageData.facts || []);
          setRedFlags(triageData.redFlags || []);
          setMedicalHistory(triageData.medicalHistory || []);
          setAyushAssessments(triageData.ayushAssessments || []);
          setDocuments(triageData.documents || []);
          setExtractions(triageData.extractions || []);
          setSummaries(triageData.summaries || []);
          setIsLoading(false);

          const combinedText = [
            triageData.session.chief_complaint,
            ...(triageData.facts || []).map((f: any) => f.answer_value),
            ...(triageData.medicalHistory || []).map((m: any) => m.value),
            ...(triageData.extractions || []).map((e: any) => e.field_value),
          ].join(' ');
          
          fetch(`${API_URL}/api/analyze-records`, { 
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }), 
            body: JSON.stringify({ text: combinedText }) 
          }).then(r => r.json()).then(data => {
            if (!ignore) setClinicalAlerts(data);
          }).catch(() => {});

          fetch(`${API_URL}/sessions/${sessionId}/history`, {
            headers: getAuthHeaders()
          })
            .then(r => r.json())
            .then(hd => {
              if (!ignore && hd.data) setPastVisits(hd.data);
            }).catch(() => {});

          const conflicts: { field: string; documentValue: string; patientValue: string }[] = [];
          (triageData.extractions || []).forEach((ext: any) => {
            const fl = ext.field_name.toLowerCase();
            if (fl.includes('patient') || fl.includes('name')) return;
            const mm = (triageData.medicalHistory || []).find((m: any) =>
              m.category.toLowerCase().includes(fl) || fl.includes(m.category.toLowerCase())
            );
            if (mm && mm.value && ext.field_value &&
              !mm.value.toLowerCase().includes(ext.field_value.toLowerCase()) &&
              !ext.field_value.toLowerCase().includes(mm.value.toLowerCase())) {
              conflicts.push({ field: ext.field_name, documentValue: ext.field_value, patientValue: mm.value });
            }
          });
          setReconciliationConflicts(conflicts);
        }
      } catch (err) { console.error('Failed to load triage summary:', err); }
      finally { if (!ignore) setIsLoading(false); }
    };
    loadData();
    return () => { ignore = true; };
  }, [sessionId]);

  const handleVerifyFact = async (factId: string) => {
    setVerifyingFactId(factId);
    try {
      const doctorInfo = JSON.parse(localStorage.getItem('doctor_info') || '{}');
      const res = await fetch(`${API_URL}/history-facts/${factId}`, { method: 'PATCH', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ verified: true, doctor_id: doctorInfo.doctor_id }) });
      if (res.ok) setFacts(prev => prev.map(f => f.fact_id === factId ? { ...f, verified: 1 } : f));
    } catch (err) { console.error('Verify fact error:', err); } finally { setVerifyingFactId(null); }
  };
  const handleSaveFact = async (factId: string) => {
    try {
      const doctorInfo = JSON.parse(localStorage.getItem('doctor_info') || '{}');
      const res = await fetch(`${API_URL}/history-facts/${factId}`, { method: 'PATCH', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ verified: true, corrected_value: editValue, doctor_id: doctorInfo.doctor_id }) });
      if (res.ok) setFacts(prev => prev.map(f => f.fact_id === factId ? { ...f, answer_value: editValue, verified: 1, provenance: 'doctor_entered' } : f));
    } catch (err) { console.error('Save fact error:', err); } finally { setEditingFactId(null); }
  };
  const handleRejectFact = async (factId: string) => {
    try {
      const res = await fetch(`${API_URL}/history-facts/${factId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) setFacts(prev => prev.filter(f => f.fact_id !== factId));
    } catch (err) { console.error('Reject fact error:', err); }
  };
  const handleSaveNotes = async () => {
    if (!sessionId) return;
    setIsSavingNotes(true);
    try {
      const doctorInfo = JSON.parse(localStorage.getItem('doctor_info') || '{}');
      await fetch(`${API_URL}/api/sessions/${sessionId}/verify`, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ doctor_id: doctorInfo.doctor_id, notes: doctorNotes }) });
      setNotesSaved(true);
      setTimeout(() => { setNotesSaved(false); navigate('/doctor'); }, 1500);
    } catch (err) { console.error('Save notes error:', err); } finally { setIsSavingNotes(false); }
  };
  
  const [isRouting, setIsRouting] = useState(false);
  const handleRouteToHIS = async () => {
    if (!sessionId) return;
    setIsRouting(true);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/route`, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ destination: 'HIS' }) });
      if (res.ok) {
        alert('Successfully routed to HIS');
      }
    } catch (err) { console.error('Route to HIS error:', err); } finally { setIsRouting(false); }
  };
  const handleAcknowledgeRedFlags = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}`, { method: 'PATCH', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ red_flag: false }) });
      if (res.ok) { setRedFlags([]); }
    } catch (err) { console.error('Acknowledge red flags error:', err); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-sand flex items-center justify-center font-body">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted font-medium text-sm">Loading triage summary…</p>
      </div>
    </div>
  );
  if (!session) return (
    <div className="min-h-screen bg-sand flex items-center justify-center font-body">
      <p className="text-muted">Session not found.</p>
    </div>
  );

  const isUrgent = redFlags.length > 0;

  return (
    <div className="min-h-screen bg-sand font-body text-charcoal pb-16">

      {/* ── Header ── */}
      <header className="bg-white border-b border-warmgray sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/doctor')}
            className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-charcoal transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold text-charcoal">Triage Summary</h1>
          </div>
          <div className="w-32" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">

        {/* ── Urgent Banner ── */}
        {isUrgent && (
          <div className="bg-danger/8 border-2 border-danger/40 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-danger/15 border border-danger/25 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="font-bold text-danger">⚠ Red Flag Alert — {redFlags.length} trigger{redFlags.length > 1 ? 's' : ''} detected</p>
              <p className="text-sm text-danger/70 mt-0.5">This patient requires immediate clinical attention.</p>
            </div>
          </div>
        )}

        {/* ── Patient Card ── */}
        <section className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${isUrgent ? 'border-danger/40' : 'border-warmgray'}`}>
          {/* Top gradient bar */}
          <div className={`h-1.5 w-full ${isUrgent ? 'bg-gradient-to-r from-danger/50 via-danger to-danger/50' : 'bg-gradient-to-r from-primary/30 via-primary to-primary/30'}`} />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${isUrgent ? 'bg-danger/8 border-danger/20' : 'bg-primary/8 border-primary/15'}`}>
                  <User className={`w-7 h-7 ${isUrgent ? 'text-danger' : 'text-primary'}`} />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-charcoal">{session.patient_name}</h2>
                  <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(session.created_at).toLocaleDateString()} · {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 self-start ${isUrgent ? 'bg-danger/8 border-danger/25 text-danger' : 'bg-success/8 border-success/20 text-success'}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Pending Triage
              </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Queue Token', value: `T-${session.session_id.substring(0, 4).toUpperCase()}`, mono: true },
                { label: 'ABHA / Aadhaar', value: `xxxx-xxxx-${session.dummy_aadhaar?.slice(-4) || '0000'}` },
                { label: 'Language', value: session.language === 'hi' ? 'Hindi' : 'English' },
                { label: 'Chief Complaint', value: session.chief_complaint },
              ].map(({ label, value, mono }) => (
                <div key={label} className="bg-sand rounded-xl border border-warmgray px-4 py-3">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
                  <p className={`font-bold text-sm ${mono ? 'text-primary font-display tracking-widest text-base' : 'text-charcoal'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI Triage Summary ── */}
        {(summaries.length > 0 || clinicalAlerts) && (
          <section className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden relative">
            {/* Decorative watermark */}
            <div className="absolute -top-4 -right-4 opacity-[0.04] pointer-events-none">
              <BrainCircuit className="w-48 h-48 text-blue-700" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-blue-800 uppercase tracking-widest">AI Triage Summary</h2>
              </div>
            </div>

            <div className="p-6 space-y-5 relative z-10">
              {summaries.length > 0 ? (
                summaries.map(sum => {
                  let parsed: any = null;
                  let completenessObj: any = null;
                  try {
                    if (typeof (sum as any).content === 'object' && (sum as any).content !== null) {
                      parsed = (sum as any).content;
                      if (parsed.completeness) completenessObj = parsed.completeness;
                    }
                  } catch {}

                  return (
                    <div key={sum.summary_id} className="space-y-4">
                      {parsed ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            { label: 'Chief Complaint', data: parsed.chief_complaint, type: 'text', span: 2 },
                            { label: 'History of Present Illness (HPI)', data: parsed.hpi, type: 'list', span: 2 },
                            { label: 'Past Medical History', data: parsed.pmh, type: 'list' },
                            { label: 'Past Surgical History', data: parsed.psh, type: 'list' },
                            { label: 'Drug History', data: parsed.drug_history, type: 'list' },
                            { label: 'Allergy History', data: parsed.allergy_history, type: 'list' },
                            { label: 'Family History', data: parsed.family_history, type: 'list' },
                            { label: 'Personal History', data: parsed.personal_history, type: 'list' },
                            { label: 'Review of Systems', data: parsed.ros, type: 'list', span: 2 },
                          ].map(({ label, data, type, span }) => (
                            <div key={label} className={`bg-blue-50/60 rounded-xl border border-blue-100 p-4 ${span === 2 ? 'md:col-span-2' : ''}`}>
                              <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">{label}</h4>
                              {type === 'text' ? (
                                <p className="text-sm text-charcoal">{data || 'N/A'}</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {(data || []).map((item: string, i: number) => (
                                    <li key={i} className="text-sm text-charcoal flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">{sum.generated_text}</p>
                      )}

                      {completenessObj && (
                        <div className="bg-sand rounded-xl border border-warmgray p-4">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">Data Completeness</p>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${completenessObj.score >= 80 ? 'bg-success/8 text-success border-success/20' : 'bg-turmeric/10 text-turmeric border-turmeric/20'}`}>
                              {completenessObj.score}%
                            </span>
                          </div>
                          <div className="w-full bg-warmgray rounded-full h-2 mb-3">
                            <div className={`h-2 rounded-full transition-all ${completenessObj.score >= 80 ? 'bg-success' : 'bg-turmeric'}`} style={{ width: `${completenessObj.score}%` }} />
                          </div>
                          {completenessObj.missing_fields?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {completenessObj.missing_fields.map((mf: string, i: number) => (
                                <span key={i} className="text-xs bg-danger/8 text-danger border border-danger/20 px-2 py-0.5 rounded-lg">{mf}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-charcoal italic">
                  Patient presented with chief complaint of <strong>{session.chief_complaint}</strong>. Clinical analysis is ready for review.
                </p>
              )}

              {clinicalAlerts?.analysis?.triage_level && (
                <div className="bg-sand border border-warmgray rounded-xl p-4">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Suggested Triage Level</p>
                  <p className="text-base text-charcoal font-bold">{clinicalAlerts.analysis.triage_level}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Current Complaint & Interview ── */}
        <CollapsibleSection title="Current Complaint & Interview" icon={ClipboardList} defaultOpen={true}>
          <div className="mb-5 bg-sand rounded-xl border border-warmgray px-4 py-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Chief Complaint</p>
            <p className="font-display font-bold text-charcoal text-xl">{session.chief_complaint}</p>
          </div>

          {facts.length === 0 ? (
            <p className="text-muted italic text-sm">No additional facts recorded for this session.</p>
          ) : (
            <div className="space-y-5">
              {facts.map(fact => (
                <div key={fact.fact_id} className="relative pl-6 border-l-2 border-warmgray pb-4 last:border-transparent">
                  <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1 ring-2 ring-white" />
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted mb-1">{fact.question_text}</p>
                      {editingFactId === fact.fact_id ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="text"
                            className="flex-1 border-2 border-primary/40 rounded-lg px-3 py-1.5 text-charcoal text-sm focus:outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/15"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                          />
                          <button onClick={() => handleSaveFact(fact.fact_id)} className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingFactId(null)} className="p-2 text-muted hover:text-charcoal rounded-lg hover:bg-sand transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <p className="text-charcoal font-semibold">{fact.answer_value}</p>
                          <button 
                            aria-label="Edit fact"
                            onClick={() => { setEditingFactId(fact.fact_id); setEditValue(fact.answer_value); }} 
                            className="text-muted hover:text-primary p-1 rounded hover:bg-sand transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ProvenanceBadge type={fact.provenance} />
                      {fact.verified === 1 ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-success/8 text-success border border-success/20">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleVerifyFact(fact.fact_id)}
                            disabled={verifyingFactId === fact.fact_id}
                            className="text-xs px-2.5 py-1 rounded-lg font-bold bg-primary/8 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                          >
                            {verifyingFactId === fact.fact_id ? '…' : 'Verify'}
                          </button>
                          <button
                            onClick={() => handleRejectFact(fact.fact_id)}
                            className="p-1.5 text-danger/50 hover:text-danger hover:bg-danger/8 rounded-lg transition-colors border border-transparent hover:border-danger/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Medical History" icon={Activity} badge={medicalHistory.length === 0 ? 'No data' : `${medicalHistory.length} items`}>
          {medicalHistory.length === 0 ? (
            <p className="text-muted italic text-sm">No history provided.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {medicalHistory.map(item => (
                <div key={item.item_id} className="bg-sand rounded-xl border border-warmgray p-4">
                  <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">{item.category}</h3>
                  <p className="text-charcoal font-medium text-sm whitespace-pre-wrap">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="AYUSH Assessment & Classical Citations" icon={Sparkles} badge="Classical References" defaultOpen={true}>
          <div className="space-y-4">
            {ayushAssessments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {ayushAssessments.map(item => (
                  <div key={item.assessment_id} className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1.5">{item.dimension}</p>
                    <p className="text-charcoal font-medium capitalize text-sm">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1">Prakriti Analysis</p>
                  <p className="text-charcoal font-semibold text-sm">Vata-Pitta Dominant</p>
                </div>
                <div className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1">Vikriti / Imbalance</p>
                  <p className="text-charcoal font-semibold text-sm">Pitta-Vata (Ushna / Ruksha)</p>
                </div>
                <div className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1">Agni Status</p>
                  <p className="text-charcoal font-semibold text-sm">Tikshna / Vishama Agni</p>
                </div>
              </div>
            )}

            {/* Classical Citations & Textual Grounding */}
            <div className="bg-sand/60 border-2 border-warmgray rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-terracotta" />
                <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider">Classical Vedic & Ayurvedic References</h3>
              </div>
              <div className="space-y-2 text-xs text-charcoal/80 font-body">
                <div className="bg-white p-3 rounded-lg border border-warmgray">
                  <p className="font-bold text-terracotta">[1] Charaka Samhita · Sutra Sthana (Ch. 20 - Maharoga Adhyaya)</p>
                  <p className="text-muted mt-1 italic">"Assessment of Dosha-Dushya Sammurchana, Prakriti constitution and Agnibala under classical Ayurvedic diagnostic principles."</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-warmgray">
                  <p className="font-bold text-terracotta">[2] Sushruta Samhita · Sutra Sthana (Dosha Dhatu Mala Kshaya Vriddhi)</p>
                  <p className="text-muted mt-1 italic">"Determination of Rogi-Roga Pariksha, Koshtha nature, and Ahara-Vihara intervention protocol."</p>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Medical Timeline" icon={Calendar} badge={documents.length === 0 ? 'No data' : `${documents.length} files`}>
          {documents.length === 0 ? (
            <p className="text-muted italic text-sm">No documents uploaded.</p>
          ) : (
            <div className="relative border-l-2 border-primary/20 ml-2 pl-6 py-2 space-y-6">
              {documents.map((doc, idx) => {
                const dDate = extractions.find(e => e.document_id === doc.document_id && e.field_name === 'document_date');
                return (
                  <div key={doc.document_id || idx} className="relative">
                    <div className="absolute w-4 h-4 bg-primary rounded-full -left-[33px] top-1 ring-2 ring-white border-2 border-white shadow-sm" />
                    <div className="bg-white border-2 border-warmgray rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                          <Calendar className="w-4 h-4 text-primary" />
                          {dDate?.field_value || <span className="text-muted italic">Date unknown</span>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${doc.ocr_status === 'completed' ? 'bg-success/8 text-success border-success/20' : 'bg-sand text-muted border-warmgray'}`}>
                          {doc.ocr_status || 'Processed'}
                        </span>
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/70 transition-colors">
                        <FileText className="w-3.5 h-3.5" /> View Document <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="OCR-Extracted Information" icon={FileText} badge={extractions.length === 0 ? 'No data' : `${extractions.length} fields`}>
          {reconciliationConflicts.length > 0 && (
            <div className="mb-5 bg-terracotta/8 border-2 border-terracotta/25 rounded-xl p-4">
              <h3 className="text-sm font-bold text-terracotta flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" /> Reconciliation Conflicts
              </h3>
              <div className="space-y-2.5">
                {reconciliationConflicts.map((c, i) => (
                  <div key={i} className="bg-white rounded-xl border border-terracotta/15 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-terracotta uppercase tracking-widest mb-1">{c.field}</p>
                      <p className="text-xs text-charcoal/70"><span className="font-semibold text-charcoal">Document:</span> {c.documentValue}</p>
                      <p className="text-xs text-charcoal/70"><span className="font-semibold text-charcoal">Patient:</span> {c.patientValue}</p>
                    </div>
                    <button className="text-xs font-bold text-terracotta border border-terracotta/30 px-3 py-1.5 rounded-lg hover:bg-terracotta hover:text-white transition-all whitespace-nowrap">Resolve</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extractions.length === 0 ? (
            <p className="text-muted italic text-sm">No data extracted from documents.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {extractions.map(ext => {
                const doc = documents.find(d => d.document_id === ext.document_id || (d as any).id === ext.document_id);
                return (
                  <div key={ext.extraction_id} className={`bg-sand rounded-xl border-2 p-4 ${ext.confidence < 0.7 ? 'border-turmeric/40' : 'border-warmgray'}`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{ext.field_name}</p>
                      <div className="flex gap-2 items-center">
                        {ext.confidence < 0.7 && (
                          <span className="text-[10px] bg-turmeric/10 text-charcoal border border-turmeric/30 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-turmeric" /> Low
                          </span>
                        )}
                        {doc?.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-muted hover:text-primary transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-charcoal font-semibold text-sm">{ext.field_value || '—'}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Red Flags" icon={AlertTriangle} badge={redFlags.length === 0 ? 'None' : `${redFlags.length} flags`} urgent={true}>
          {redFlags.length === 0 ? (
            <p className="text-muted italic text-sm">No red flags triggered or they have been acknowledged.</p>
          ) : (
            <div>
              <div className="space-y-2.5 mb-4">
                {redFlags.map(rf => (
                  <div key={rf.flag_id} className="bg-danger/6 border border-danger/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-danger">Rule Match: {rf.rule_id}</p>
                      <p className="text-xs text-danger/50 mt-0.5">at {new Date(rf.created_at).toLocaleTimeString()}</p>
                    </div>
                    <Zap className="w-4 h-4 text-danger/40" />
                  </div>
                ))}
              </div>
              <button
                onClick={handleAcknowledgeRedFlags}
                className="px-5 py-2.5 text-sm font-bold bg-danger text-white rounded-xl hover:bg-danger/90 transition-colors shadow-sm"
              >
                Acknowledge & Clear Flags
              </button>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Past Medical Records" icon={ClipboardList} badge={pastVisits.length === 0 ? 'None' : `${pastVisits.length} visits`}>
          {pastVisits.length === 0 ? (
            <p className="text-muted italic text-sm">No past medical records found for this patient.</p>
          ) : (
            <div className="space-y-3">
              {pastVisits.map(visit => (
                <div key={visit.session_id} className="bg-sand border-2 border-warmgray p-4 rounded-xl hover:border-primary/20 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-charcoal text-sm">{new Date(visit.date).toLocaleDateString()} · {new Date(visit.date).toLocaleTimeString()}</p>
                    <span className="text-[10px] font-bold bg-white text-muted border border-warmgray px-2 py-0.5 rounded-lg uppercase">{visit.status}</span>
                  </div>
                  <p className="text-sm text-charcoal/70"><span className="font-semibold text-charcoal">Complaint:</span> {visit.chief_complaint}</p>
                  {visit.doctor_notes && (
                    <div className="bg-white border border-warmgray p-3 rounded-lg mt-3">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Doctor's Notes</p>
                      <p className="text-xs text-charcoal whitespace-pre-wrap">{visit.doctor_notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Feature 13: Historical Medication Comparison */}
        <CollapsibleSection title="Medication History & Reconciliation" icon={Activity} badge="1 Change Detected">
          <div className="bg-sand border-2 border-warmgray rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 text-xs font-bold text-muted uppercase tracking-widest border-b-2 border-warmgray bg-white">
              <div className="p-3 border-r-2 border-warmgray">Previous Visit (Last Month)</div>
              <div className="p-3">Current Visit</div>
            </div>
            
            {/* Unchanged Medication */}
            <div className="grid grid-cols-2 text-sm border-b border-warmgray/50">
              <div className="p-4 border-r-2 border-warmgray">
                <p className="font-bold text-charcoal">Metformin</p>
                <p className="text-muted text-xs">500mg • Twice daily</p>
              </div>
              <div className="p-4 bg-white">
                <p className="font-bold text-charcoal">Metformin</p>
                <p className="text-muted text-xs">500mg • Twice daily</p>
              </div>
            </div>

            {/* Changed Medication (Dose increase) */}
            <div className="grid grid-cols-2 text-sm border-b border-warmgray/50">
              <div className="p-4 border-r-2 border-warmgray">
                <p className="font-bold text-charcoal">Amlodipine</p>
                <p className="text-muted text-xs">5mg • Once daily</p>
              </div>
              <div className="p-4 bg-turmeric/10 border-l-4 border-turmeric">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-bold text-charcoal">Amlodipine</p>
                  <span className="text-[10px] font-bold text-turmeric bg-white border border-turmeric/30 px-1.5 rounded uppercase">Dose Changed</span>
                </div>
                <p className="text-muted text-xs"><span className="line-through opacity-60 mr-1">5mg</span><strong className="text-charcoal">10mg</strong> • Once daily</p>
              </div>
            </div>

            {/* New Medication */}
            <div className="grid grid-cols-2 text-sm">
              <div className="p-4 border-r-2 border-warmgray flex items-center justify-center text-muted italic">
                None
              </div>
              <div className="p-4 bg-success/10 border-l-4 border-success">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-bold text-charcoal">Atorvastatin</p>
                  <span className="text-[10px] font-bold text-success bg-white border border-success/30 px-1.5 rounded uppercase">New</span>
                </div>
                <p className="text-muted text-xs">20mg • At bedtime</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Doctor Notes ── */}
        <section className="bg-white rounded-2xl border-2 border-warmgray shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest">Doctor Notes & Verification</h2>
          </div>
          <textarea
            className="w-full min-h-[120px] p-4 bg-sand border-2 border-warmgray rounded-xl text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 resize-none transition-all"
            placeholder="Add clinical notes, impressions, or action items here…"
            value={doctorNotes}
            onChange={e => setDoctorNotes(e.target.value)}
          />
          <div className="flex items-center justify-between mt-4">
            {notesSaved && (
              <span className="text-success text-sm font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Saved & Verified!
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-white text-primary border-2 border-primary hover:bg-primary/5 transition-all shadow-sm disabled:opacity-50"
                onClick={handleRouteToHIS}
                disabled={isRouting}
              >
                {isRouting ? (
                  <><div className="w-3.5 h-3.5 border border-primary/50 border-t-transparent rounded-full animate-spin" /> Routing…</>
                ) : (
                  <>Route to HIS</>
                )}
              </button>
              <button
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
              >
                {isSavingNotes ? (
                  <><div className="w-3.5 h-3.5 border border-white/50 border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><Check className="w-3.5 h-3.5" /> Save Notes & Verify</>
                )}
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

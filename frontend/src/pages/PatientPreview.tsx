import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MandalaBackground } from '@/components/MandalaBackground';
import { QuestionCard } from '@/components/QuestionCard';
import { VoiceGuideButton } from '@/components/VoiceGuideButton';
import {
  ClipboardList, ArrowRight, User, ChevronDown, ChevronUp,
  Edit2, Check, X, FileText, HeartPulse, Activity, Sparkles, Plus
} from 'lucide-react';
import { API_URL, getAuthHeaders } from '@/lib/api';

interface FactItem {
  id?: string;
  question_id: string;
  answer_text: string;
  answer_value?: string;
  provenance?: string;
}

interface MedicalHistoryItem {
  id?: string;
  category: string;
  value: string;
}

function formatQuestionTitle(qId?: string, fallbackText?: string): string {
  const text = qId || fallbackText;
  if (!text) return 'Question';
  if (text === 'chief_complaint' || text === 'Chief Complaint') return 'Chief Complaint';
  if (text.includes(' ') && !text.startsWith('q_')) return text;
  return text
    .replace(/^q_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function PatientPreview() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [facts, setFacts] = useState<FactItem[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryItem[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    demographics: true,
    symptoms: true,
    history: false,
    documents: false
  });

  // Editing state for Demographics
  const [isEditingDemo, setIsEditingDemo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editComplaint, setEditComplaint] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingDemo, setIsSavingDemo] = useState(false);

  // Editing state for individual symptoms
  const [editingFactIndex, setEditingFactIndex] = useState<number | null>(null);
  const [editFactText, setEditFactText] = useState('');
  const [isSavingFact, setIsSavingFact] = useState(false);

  // New medical history entry
  const [isAddingHistory, setIsAddingHistory] = useState(false);
  const [newHistoryValue, setNewHistoryValue] = useState('');

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    const rawId = sessionStorage.getItem('session_id') || sessionStorage.getItem('patient_session');
    let sId: string | null = null;
    let initialSession: any = null;

    if (rawId) {
      try {
        const parsed = JSON.parse(rawId);
        if (parsed && typeof parsed === 'object') {
          initialSession = parsed;
          sId = parsed.id || parsed.session_id || null;
        } else {
          sId = String(parsed);
        }
      } catch {
        sId = rawId;
      }
    }

    if (!initialSession) {
      initialSession = {
        id: sId,
        patient_name: sessionStorage.getItem('patient_name') || 'Anonymous Patient',
        chief_complaint: sessionStorage.getItem('patient_complaint') || sessionStorage.getItem('chief_complaint') || 'General Consultation',
        language: localStorage.getItem('patient_language') || 'en',
        age: sessionStorage.getItem('patient_age') || '',
        gender: sessionStorage.getItem('patient_gender') || '',
        phone: sessionStorage.getItem('patient_phone') || ''
      };
    }

    setSessionId(sId);
    setSession(initialSession);
    setEditName(initialSession.patient_name || '');
    setEditComplaint(initialSession.chief_complaint || '');
    setEditAge(initialSession.age || '');
    setEditGender(initialSession.gender || '');
    setEditPhone(initialSession.phone || '');

    // Fetch live data from backend if session ID exists
    if (sId && sId !== 'active-session') {
      fetch(`${API_URL}/api/sessions/${sId}/triage`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.session) {
            setSession((prev: any) => ({
              ...prev,
              ...data.session,
              patient_name: data.session.patient_name || prev.patient_name,
              chief_complaint: data.session.chief_complaint || prev.chief_complaint
            }));
            setEditName(data.session.patient_name || initialSession.patient_name || '');
            setEditComplaint(data.session.chief_complaint || initialSession.chief_complaint || '');
            setEditAge(data.session.age || '');
            setEditGender(data.session.gender || '');
            setEditPhone(data.session.phone || '');

            if (Array.isArray(data.facts) && data.facts.length > 0) {
              setFacts(data.facts);
            }
            if (Array.isArray(data.medicalHistory)) {
              setMedicalHistory(data.medicalHistory);
            }
            if (Array.isArray(data.documents)) {
              setDocuments(data.documents);
            }
          }
        })
        .catch((err) => console.warn('Could not fetch triage details, using local state:', err))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleSaveDemographics = async () => {
    setIsSavingDemo(true);
    const updated = {
      ...session,
      patient_name: editName.trim() || 'Anonymous Patient',
      chief_complaint: editComplaint.trim() || 'General Consultation',
      age: editAge.trim(),
      gender: editGender.trim(),
      phone: editPhone.trim()
    };

    setSession(updated);
    sessionStorage.setItem('patient_name', updated.patient_name);
    sessionStorage.setItem('patient_complaint', updated.chief_complaint);
    sessionStorage.setItem('chief_complaint', updated.chief_complaint);
    if (updated.age) sessionStorage.setItem('patient_age', updated.age);
    if (updated.gender) sessionStorage.setItem('patient_gender', updated.gender);
    if (updated.phone) sessionStorage.setItem('patient_phone', updated.phone);

    if (sessionId && sessionId !== 'active-session') {
      try {
        await fetch(`${API_URL}/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_name: updated.patient_name,
            chief_complaint: updated.chief_complaint,
            age: updated.age,
            gender: updated.gender,
            phone: updated.phone
          })
        });
      } catch (err) {
        console.warn('Network issue saving session to backend:', err);
      }
    }

    setIsSavingDemo(false);
    setIsEditingDemo(false);
  };

  const handleSaveFact = async (index: number) => {
    const fact = facts[index];
    if (!fact) return;
    setIsSavingFact(true);

    const updatedFacts = [...facts];
    updatedFacts[index] = { ...fact, answer_text: editFactText, answer_value: editFactText };
    setFacts(updatedFacts);

    if (fact.id) {
      try {
        await fetch(`${API_URL}/api/answers/${fact.id}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ answer_text: editFactText })
        });
      } catch (err) {
        console.warn('Could not update answer on backend:', err);
      }
    }

    setIsSavingFact(false);
    setEditingFactIndex(null);
  };

  const handleAddHistory = async () => {
    if (!newHistoryValue.trim()) return;
    const newItem: MedicalHistoryItem = {
      category: 'Past Medical History',
      value: newHistoryValue.trim()
    };
    setMedicalHistory((prev) => [...prev, newItem]);
    setNewHistoryValue('');
    setIsAddingHistory(false);

    if (sessionId && sessionId !== 'active-session') {
      try {
        await fetch(`${API_URL}/medical-history`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            session_id: sessionId,
            category: newItem.category,
            value: newItem.value
          })
        });
      } catch (err) {
        console.warn('Could not save medical history item:', err);
      }
    }
  };

  const userLang = session?.language || localStorage.getItem('patient_language') || 'en';
  const isMr = userLang === 'mr';
  const isBn = userLang === 'bn';
  const isHi = userLang === 'hi';
  const ttsLang = isMr ? 'mr-IN' : isBn ? 'bn-IN' : isHi ? 'hi-IN' : 'en-IN';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 font-body">
        <MandalaBackground />
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-charcoal font-medium">
          {isMr ? 'माहिती लोड होत आहे...' : isBn ? 'সারাংশ লোড হচ্ছে...' : isHi ? 'विवरण लोड हो रहा है...' : 'Loading summary...'}
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative font-body">
        <MandalaBackground />
        <QuestionCard className="w-full max-w-md text-center p-8 z-10">
          <p className="text-charcoal font-semibold text-lg mb-2">
            {isMr ? 'सक्रिय सत्र आढळले नाही' : isBn ? 'কোনো সক্রিয় সেশন পাওয়া যায়নি' : isHi ? 'कोई सक्रिय सत्र नहीं मिला' : 'No active session found'}
          </p>
          <p className="text-muted text-sm mb-6">
            {isMr ? 'कृपया किऑस्कवर नवीन तपासणी सुरू करा.' : isBn ? 'অনুগ্রহ করে কিয়স্কে একটি নতুন চেক-ইন শুরু করুন।' : isHi ? 'कृपया कियोस्क पर एक नया चेक-इन शुरू करें।' : 'Please start a new check-in at the kiosk.'}
          </p>
          <Button onClick={() => navigate('/consent')} className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
            {isMr ? 'तपासणी सुरू करा' : isBn ? 'চেক-ইন শুরু করুন' : isHi ? 'चेक-इन शुरू करें' : 'Start Check-in'}
          </Button>
        </QuestionCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand flex flex-col pt-8 pb-16 p-4 sm:p-6 relative overflow-x-hidden font-body text-charcoal">
      <MandalaBackground />

      <div className="w-full max-w-3xl mx-auto z-10 space-y-6">

        {/* ── Top Header Banner ── */}
        <div className="bg-white rounded-2xl border border-warmgray p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-left">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-0.5 rounded-full">
                {isMr ? 'अंतिम टप्पा' : isBn ? 'চূড়ান্ত ধাপ' : isHi ? 'अंतिम चरण' : 'Final Step'}
              </span>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-charcoal mt-1 tracking-tight">
                {isMr ? 'आपल्या माहितीचे पुनरावलोकन करा' : isBn ? 'আপনার তথ্য পর্যালোচনা করুন' : isHi ? 'अपनी जानकारी की समीक्षा करें' : 'Review & Verify Your Information'}
              </h1>
              <p className="text-muted text-sm mt-0.5">
                {isMr
                  ? 'डॉक्टरांकडे पाठवण्यापूर्वी खालील माहिती तपासा किंवा आवश्यकतेनुसार संपादित करा.'
                  : isBn
                  ? 'ডাক্তারের কাছে পাঠানোর আগে নীচের তথ্য পরীক্ষা করুন বা সম্পাদনা করুন।'
                  : isHi
                  ? 'नीचे दिए गए विवरणों को देखें और आवश्यकतानुसार संपादित करें।'
                  : 'Expand any section below to review or edit your answers before sending to the doctor.'}
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('/submitted')}
            className="w-full sm:w-auto h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-sm shrink-0 flex items-center justify-center gap-2"
          >
            {isMr ? 'डॉक्टरांकडे सादर करा' : isBn ? 'ডাক্তারের কাছে জমা দিন' : isHi ? 'डॉक्टर को भेजें' : 'Submit to Doctor'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* ── SECTION 1: Personal Details & Demographics ── */}
        <div className="bg-white rounded-2xl border-2 border-warmgray overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('demographics')}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-sand/40 transition-colors text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sand border border-warmgray flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-charcoal">
                  {isMr ? 'रुग्णाची माहिती आणि तक्रार' : isBn ? 'রোগীর তথ্য ও অভিযোগ' : isHi ? 'मरीज की जानकारी' : 'Patient Information & Complaint'}
                </h2>
                <p className="text-xs text-muted">
                  {session.patient_name} • {session.chief_complaint}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                {isMr ? 'तयार' : isBn ? 'প্রস্তুত' : isHi ? 'सत्यापित' : 'Ready'}
              </span>
              <span className="text-muted">
                {openSections.demographics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </div>
          </button>

          {openSections.demographics && (
            <div className="px-6 pb-6 pt-2 border-t border-warmgray bg-white">
              {!isEditingDemo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3.5 bg-sand/30 rounded-xl border border-warmgray/60">
                      <p className="text-xs font-bold text-muted uppercase tracking-wider">
                        {isMr ? 'रुग्णाचे नाव' : isBn ? 'রোগীর নাম' : isHi ? 'मरीज का नाम' : 'Patient Name'}
                      </p>
                      <p className="font-semibold text-charcoal text-base mt-0.5">{session.patient_name || 'Anonymous'}</p>
                    </div>
                    <div className="p-3.5 bg-sand/30 rounded-xl border border-warmgray/60">
                      <p className="text-xs font-bold text-muted uppercase tracking-wider">
                        {isMr ? 'मुख्य त्रास / कारण' : isBn ? 'প্রধান সমস্যা / অভিযোগ' : isHi ? 'आने का मुख्य कारण' : 'Primary Complaint'}
                      </p>
                      <p className="font-semibold text-primary text-base mt-0.5 capitalize">{session.chief_complaint || 'General Checkup'}</p>
                    </div>
                    <div className="p-3.5 bg-sand/30 rounded-xl border border-warmgray/60">
                      <p className="text-xs font-bold text-muted uppercase tracking-wider">
                        {isMr ? 'वय आणि लिंग' : isBn ? 'বয়স ও লিঙ্গ' : isHi ? 'उम्र / लिंग' : 'Age & Gender'}
                      </p>
                      <p className="font-semibold text-charcoal text-base mt-0.5">
                        {session.age || 'Not specified'} {session.gender ? `• ${session.gender}` : ''}
                      </p>
                    </div>
                    <div className="p-3.5 bg-sand/30 rounded-xl border border-warmgray/60">
                      <p className="text-xs font-bold text-muted uppercase tracking-wider">
                        {isMr ? 'फोन नंबर' : isBn ? 'ফোন নম্বর' : isHi ? 'फ़ोन नंबर' : 'Phone Number'}
                      </p>
                      <p className="font-semibold text-charcoal text-base mt-0.5">{session.phone || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingDemo(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-warmgray hover:border-primary/40 hover:bg-primary/5 text-charcoal transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-primary" />
                      {isMr ? 'माहिती संपादित करा' : isBn ? 'তথ্য সম্পাদনা করুন' : isHi ? 'विवरण संपादित करें' : 'Edit Information'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-muted uppercase mb-1">
                        {isMr ? 'रुग्णाचे नाव' : isBn ? 'রোগীর নাম' : isHi ? 'मरीज का नाम' : 'Patient Name'}
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full p-2.5 bg-white border border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="Enter your name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted uppercase mb-1">
                        {isMr ? 'मुख्य त्रास' : isBn ? 'প্রধান সমস্যা' : isHi ? 'मुख्य कारण' : 'Chief Complaint'}
                      </label>
                      <input
                        type="text"
                        value={editComplaint}
                        onChange={(e) => setEditComplaint(e.target.value)}
                        className="w-full p-2.5 bg-white border border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="e.g. Chest pain, Fever, Cough"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted uppercase mb-1">
                        {isMr ? 'वय' : isBn ? 'বয়স' : isHi ? 'उम्र' : 'Age'}
                      </label>
                      <input
                        type="text"
                        value={editAge}
                        onChange={(e) => setEditAge(e.target.value)}
                        className="w-full p-2.5 bg-white border border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="e.g. 34"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted uppercase mb-1">
                        {isMr ? 'फोन नंबर' : isBn ? 'ফোন নম্বর' : isHi ? 'फ़ोन नंबर' : 'Phone Number'}
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full p-2.5 bg-white border border-warmgray rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditName(session.patient_name || '');
                        setEditComplaint(session.chief_complaint || '');
                        setEditAge(session.age || '');
                        setEditPhone(session.phone || '');
                        setIsEditingDemo(false);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-warmgray text-muted hover:text-charcoal hover:bg-sand/60 transition-colors"
                    >
                      {isMr ? 'रद्द करा' : isBn ? 'বাতিল করুন' : isHi ? 'रद्द करें' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDemographics}
                      disabled={isSavingDemo}
                      className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSavingDemo ? 'Saving...' : (isMr ? 'बदल जतन करा' : isBn ? 'পরিবর্তন সংরক্ষণ করুন' : isHi ? 'सहेजें' : 'Save Changes')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 2: Symptoms & Intake Responses Table ── */}
        <div className="bg-white rounded-2xl border-2 border-warmgray overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('symptoms')}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-sand/40 transition-colors text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sand border border-warmgray flex items-center justify-center">
                <Activity className="w-4 h-4 text-terracotta" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-charcoal">
                  {isMr ? 'नोंदवलेली लक्षणे आणि उत्तरे' : isBn ? 'রেকর্ড করা লক্ষণ ও উত্তর' : isHi ? 'लक्षण एवं प्रश्नावली के उत्तर' : 'Recorded Symptoms & Answers'}
                </h2>
                <p className="text-xs text-muted">
                  {facts.length} {isMr ? 'उत्तरे नोंदवली गेली' : isBn ? 'টি উত্তর রেকর্ড করা হয়েছে' : isHi ? 'उत्तर रिकॉर्ड किए गए' : 'interview questions answered'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-charcoal bg-sand px-2.5 py-0.5 rounded-full border border-warmgray">
                {facts.length} {isMr ? 'उत्तरे' : isBn ? 'টি উত্তর' : isHi ? 'उत्तर' : 'answers'}
              </span>
              <span className="text-muted">
                {openSections.symptoms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </div>
          </button>

          {openSections.symptoms && (
            <div className="px-6 pb-6 pt-2 border-t border-warmgray bg-white">
              {facts.length === 0 ? (
                <div className="text-center py-6 text-muted text-sm">
                  <p>{isMr ? 'कोणतीही तपशीलवार लक्षणे नोंदवली गेली नाहीत.' : isBn ? 'কোনো বিস্তারিত লক্ষণ রেকর্ড করা হয়নি।' : isHi ? 'कोई विस्तृत लक्षण रिकॉर्ड नहीं किया गया।' : 'General consultation selected. No follow-up symptom questions recorded.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-warmgray text-xs font-bold text-muted uppercase tracking-wider">
                        <th className="py-3 px-3">{isMr ? 'प्रश्न / लक्षण' : isBn ? 'প্রশ্ন / লক্ষণ' : isHi ? 'सवाल / लक्षण' : 'Question / Symptom'}</th>
                        <th className="py-3 px-3">{isMr ? 'तुमचे उत्तर' : isBn ? 'আপনার উত্তর' : isHi ? 'आपका उत्तर' : 'Your Answer'}</th>
                        <th className="py-3 px-3 text-right">{isMr ? 'कृती' : isBn ? 'পদক্ষেপ' : isHi ? 'कार्य' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warmgray/60 text-sm">
                      {facts.map((fact, idx) => (
                        <tr key={fact.id || idx} className="hover:bg-sand/20 transition-colors">
                          <td className="py-3.5 px-3 font-medium text-charcoal">
                            {formatQuestionTitle(fact.question_id, (fact as any).question_text)}
                          </td>
                          <td className="py-3.5 px-3">
                            {editingFactIndex === idx ? (
                              <input
                                type="text"
                                value={editFactText}
                                onChange={(e) => setEditFactText(e.target.value)}
                                className="w-full p-2 text-sm bg-white border border-primary rounded-lg focus:outline-none"
                              />
                            ) : (
                              <span className="font-semibold text-charcoal bg-sand/60 px-2.5 py-1 rounded-lg border border-warmgray/60">
                                {fact.answer_text || fact.answer_value || 'None'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {editingFactIndex === idx ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveFact(idx)}
                                  disabled={isSavingFact}
                                  className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                  title="Save"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFactIndex(null)}
                                  className="p-1.5 bg-sand text-muted rounded-lg hover:text-charcoal transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFactIndex(idx);
                                  setEditFactText(fact.answer_text || fact.answer_value || '');
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 hover:underline"
                              >
                                <Edit2 className="w-3 h-3" />
                                {isMr ? 'बदला' : isBn ? 'সম্পাদনা' : isHi ? 'बदलें' : 'Edit'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 3: Medical History & Past Conditions ── */}
        <div className="bg-white rounded-2xl border-2 border-warmgray overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('history')}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-sand/40 transition-colors text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sand border border-warmgray flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-charcoal">
                  {isMr ? 'मागील वैद्यकीय इतिहास आणि जुने आजार' : isBn ? 'অতীতের চিকিৎসা ইতিহাস ও রোগ' : isHi ? 'पूर्व चिकित्सा इतिहास' : 'Past Medical History & Conditions'}
                </h2>
                <p className="text-xs text-muted">
                  {medicalHistory.length === 0
                    ? (isMr ? 'कोणतीही जुनी स्थिती नोंदवलेली नाही' : isBn ? 'কোনো পূর্ববর্তী অবস্থা রেকর্ড করা হয়নি' : isHi ? 'कोई पूर्व स्थिति दर्ज नहीं' : 'No prior chronic conditions recorded')
                    : `${medicalHistory.length} ${isMr ? 'अटी नोंदवल्या गेल्या' : isBn ? 'টি অবস্থা রেকর্ড করা হয়েছে' : isHi ? 'शर्तें' : 'conditions recorded'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${medicalHistory.length > 0 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-sand text-muted border-warmgray'}`}>
                {medicalHistory.length > 0 ? `${medicalHistory.length} ${isMr ? 'नोंदवले' : isBn ? 'টি রেকর্ডকৃত' : isHi ? 'दर्ज' : 'recorded'}` : (isMr ? 'काही नाही' : isBn ? 'কিছু নেই' : isHi ? 'कोई नहीं' : 'None')}
              </span>
              <span className="text-muted">
                {openSections.history ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </div>
          </button>

          {openSections.history && (
            <div className="px-6 pb-6 pt-2 border-t border-warmgray bg-white space-y-4">
              {medicalHistory.length === 0 && !isAddingHistory ? (
                <div className="text-center py-4 text-muted text-sm">
                  <p>{isMr ? 'कोणतेही जुने आजार, शस्त्रक्रिया किंवा स्थिती नोंदवलेली नाही.' : isBn ? 'কোনো অতীতের অসুস্থতা, অস্ত্রোপচার বা দীর্ঘস্থায়ী রোগ রিপোর্ট করা হয়নি।' : isHi ? 'कोई पूर्व स्थिति दर्ज नहीं की गई।' : 'No past medical conditions, surgeries, or chronic illnesses reported.'}</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 pt-2">
                  {medicalHistory.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-sand/60 text-charcoal border border-warmgray px-3 py-1.5 rounded-xl text-sm font-medium"
                    >
                      <Sparkles className="w-3 h-3 text-primary" />
                      {item.value}
                    </span>
                  ))}
                </div>
              )}

              {isAddingHistory ? (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newHistoryValue}
                    onChange={(e) => setNewHistoryValue(e.target.value)}
                    placeholder="e.g. Diabetes, Hypertension, Asthma"
                    className="flex-1 p-2.5 text-sm bg-white border border-primary rounded-xl focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddHistory}
                    className="px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90"
                  >
                    {isMr ? 'जोडा' : isBn ? 'যোগ করুন' : isHi ? 'जोड़ें' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAddingHistory(false); setNewHistoryValue(''); }}
                    className="px-3 py-2.5 bg-sand text-muted hover:text-charcoal text-xs font-bold rounded-xl"
                  >
                    {isMr ? 'रद्द करा' : isBn ? 'বাতিল' : isHi ? 'रद्द करें' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsAddingHistory(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isMr ? 'स्थिती जोडा' : isBn ? 'অবস্থা যোগ করুন' : isHi ? 'स्थिति जोड़ें' : 'Add Condition'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 4: Uploaded Prescriptions & Documents ── */}
        <div className="bg-white rounded-2xl border-2 border-warmgray overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection('documents')}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-sand/40 transition-colors text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sand border border-warmgray flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-charcoal">
                  {isMr ? 'अपलोड केलेली कागदपत्रे व तपासण्या' : isBn ? 'প্রেসক্রিপশন ও ল্যাব নথি' : isHi ? 'अपलोड किए गए दस्तावेज़' : 'Prescription & Lab Documents'}
                </h2>
                <p className="text-xs text-muted">
                  {documents.length === 0
                    ? (isMr ? 'कोणतीही कागदपत्रे जोडलेली नाहीत' : isBn ? 'কোনো প্রেসক্রিপশন আপলোড করা হয়নি' : isHi ? 'कोई दस्तावेज़ संलग्न नहीं' : 'No prescription uploaded')
                    : `${documents.length} ${isMr ? 'कागदपत्रे जोडली गेली' : isBn ? 'টি নথি সংযুক্ত করা হয়েছে' : isHi ? 'दस्तावेज़ सहेजे गए' : 'document(s) attached'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-sand text-muted border-warmgray">
                {documents.length} {isMr ? 'कागदपत्रे' : isBn ? 'টি নথি' : isHi ? 'दस्तावेज़' : 'files'}
              </span>
              <span className="text-muted">
                {openSections.documents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </div>
          </button>

          {openSections.documents && (
            <div className="px-6 pb-6 pt-2 border-t border-warmgray bg-white">
              {documents.length === 0 ? (
                <div className="text-center py-4 text-muted text-sm">
                  <p>{isMr ? 'या तपासणीदरम्यान कोणतीही कागदपत्रे स्कॅन केली नाहीत.' : isBn ? 'এই সেশনে কোনো নথি বা ল্যাব রিপোর্ট স্ক্যান করা হয়নি।' : isHi ? 'कोई दस्तावेज़ अपलोड नहीं किया गया।' : 'No physical documents or lab reports were scanned during this intake session.'}</p>
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {documents.map((doc, idx) => (
                    <div key={doc.id || idx} className="p-3 bg-sand/30 rounded-xl border border-warmgray flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-medium text-charcoal">
                          {isMr ? `प्रिस्क्रिप्शन नोंद #${idx + 1}` : isBn ? `প্রেসক্রিপশন রেকর্ড #${idx + 1}` : isHi ? `प्रिस्क्रिप्शन रिकॉर्ड #${idx + 1}` : `Prescription Record #${idx + 1}`}
                        </span>
                      </div>
                      <span className="text-xs bg-success/10 text-success font-bold px-2 py-0.5 rounded-full">
                        {isMr ? 'स्कॅन केले' : isBn ? 'স্ক্যান করা' : isHi ? 'स्कैन किया' : 'Scanned'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>


        {/* AYUSH Assessment Disclaimer */}
        {sessionStorage.getItem('ayush_mode') === 'true' && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm">
            <span className="text-amber-500 text-base mt-0.5 shrink-0">ⓘ</span>
            <p className="text-amber-800 font-medium leading-relaxed">
              {isMr
                ? 'हे आयुर्वेदिक मूल्यांकन शास्त्रीय ग्रंथांवर आधारित एक सहाय्यक साधन आहे. यासाठी पात्र आयुर्वेदिक वैद्यांच्या पुनरावलोकनाची आवश्यकता आहे.'
                : isBn
                ? 'এই আয়ুর্বেদিক মূল্যায়ন শাস্ত্রীয় গ্রন্থের উপর ভিত্তি করে একটি সহায়ক সরঞ্জাম। একজন যোগ্য আয়ুর্বেদিক চিকিৎসকের দ্বারা পর্যালোচনার প্রয়োজন।'
                : isHi
                ? 'यह आयुर्वेदिक मूल्यांकन शास्त्रीय ग्रंथों पर आधारित एक सहायक उपकरण है। इसे एक योग्य आयुर्वेदिक चिकित्सक द्वारा समीक्षा की आवश्यकता है।'
                : 'This is an Ayurvedic assessment aid based on classical texts. Requires review by a qualified Ayurvedic physician.'}
            </p>
          </div>
        )}

        {/* ── Action Footnote & Submit ── */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/consent')}
            className="text-xs font-bold text-muted hover:text-charcoal hover:underline"
          >
            {isMr ? '← पुन्हा सुरू करा' : isBn ? '← পুনরায় শুরু করুন' : isHi ? '← फिर से शुरू करें' : '← Need to change details? Start over'}
          </button>

          <Button
            onClick={() => navigate('/submitted')}
            className="w-full sm:w-auto h-14 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isMr ? 'डॉक्टरांकडे सादर करा' : isBn ? 'ডাক্তারের কাছে জমা দিন' : isHi ? 'डॉक्टर को सबमिट करें' : 'Confirm & Submit to Doctor'}
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

      </div>
      <VoiceGuideButton 
        clipId="preview"
        fallbackText={
          isMr 
            ? 'कृपया डॉक्टरांकडे पाठवण्यापूर्वी आपल्या माहितीचे पुनरावलोकन करा.' 
            : isBn 
            ? 'ডাক্তারের কাছে জমা দেওয়ার আগে অনুগ্রহ করে আপনার তথ্য পর্যালোচনা করুন।' 
            : isHi 
            ? 'कृपया डॉक्टर को सबमिट करने से पहले अपनी जानकारी की समीक्षा करें।' 
            : 'Please review your information before submitting to the doctor.'
        } 
        language={ttsLang} 
      />
    </div>
  );
}

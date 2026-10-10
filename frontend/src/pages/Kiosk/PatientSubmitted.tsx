import React, { useState, useEffect, useRef } from 'react';
import { LogOut, ChevronDown, ChevronUp, Volume2, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MandalaBackground } from '../../components/MandalaBackground';
import { VoiceGuideButton } from '../../components/VoiceGuideButton';
import { useVoiceGuidance } from '../../hooks/useVoiceGuidance';
import { generatePlainSummary, extractSessionSummaryInput, type PlainSummaryInput } from '../../lib/plainSummary';
import { API_URL } from '../../lib/api';

export default function PatientSubmitted() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(30);
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);

  // Capture session snapshot synchronously during initial render before purge effect
  const [snapshot] = useState<PlainSummaryInput & { sessionId?: string | null }>(() => {
    const locState = (location.state as any) || {};
    const sId = locState.sessionId || sessionStorage.getItem('session_id') || sessionStorage.getItem('patient_session');
    const complaint = locState.chiefComplaint || sessionStorage.getItem('chief_complaint') || sessionStorage.getItem('patient_complaint');
    const rawLang = locState.language || localStorage.getItem('patient_language') || sessionStorage.getItem('patient_language') || 'en';
    const lang = rawLang === 'mr' ? 'mr' : rawLang === 'bn' ? 'bn' : rawLang.toLowerCase().startsWith('hi') ? 'hi' : 'en';
    const hasRf = Boolean(locState.hasRedFlag || sessionStorage.getItem('red_flag_triggered') === 'true');
    const meds = locState.medications || sessionStorage.getItem('patient_medications') || undefined;
    const cond = locState.condition || sessionStorage.getItem('patient_condition') || undefined;
    const dur = locState.duration || undefined;

    return {
      sessionId: sId,
      chiefComplaint: complaint || undefined,
      language: lang,
      hasRedFlag: hasRf,
      medications: meds,
      condition: cond,
      duration: dur
    };
  });

  const isMr = snapshot.language === 'mr';
  const isBn = snapshot.language === 'bn';
  const isHi = snapshot.language === 'hi';
  const ttsLang = isMr ? 'mr-IN' : isBn ? 'bn-IN' : isHi ? 'hi-IN' : 'en-IN';
  const activeLang = isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en';

  const [summaryData, setSummaryData] = useState<PlainSummaryInput>(snapshot);
  const [plainSummaryText, setPlainSummaryText] = useState(() => generatePlainSummary(snapshot));

  const { speak, isPlaying, stop } = useVoiceGuidance();
  const latestSummaryRef = useRef(plainSummaryText);
  latestSummaryRef.current = plainSummaryText;

  // Check accessibility mute settings
  const isMutedRef = useRef(false);
  useEffect(() => {
    isMutedRef.current =
      localStorage.getItem('kiosk_muted') === 'true' ||
      localStorage.getItem('voice_muted') === 'true' ||
      localStorage.getItem('audio_muted') === 'true' ||
      localStorage.getItem('voice_assist_muted') === 'true' ||
      sessionStorage.getItem('kiosk_muted') === 'true';
  }, []);

  // Fetch live session details if session ID exists to enrich summary with duration/facts
  useEffect(() => {
    let isMounted = true;
    const sId = snapshot.sessionId;

    if (sId && sId !== 'active-session') {
      fetch(`${API_URL}/api/sessions/${sId}/triage`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted || !data) return;
          const extracted = extractSessionSummaryInput(
            data.session,
            data.facts,
            data.medicalHistory,
            data.redFlags
          );
          // Preserve patient's chosen language
          extracted.language = activeLang;
          // Prefer any explicitly preserved local chief complaint if backend has generic fallback
          if (snapshot.chiefComplaint && (!extracted.chiefComplaint || extracted.chiefComplaint === 'General Consultation')) {
            extracted.chiefComplaint = snapshot.chiefComplaint;
          }
          if (snapshot.hasRedFlag) {
            extracted.hasRedFlag = true;
          }

          setSummaryData(extracted);
          const generated = generatePlainSummary(extracted);
          setPlainSummaryText(generated);
          latestSummaryRef.current = generated;
        })
        .catch((err) => {
          console.warn('Could not fetch triage details for plain summary:', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [snapshot.sessionId, snapshot.chiefComplaint, snapshot.hasRedFlag, activeLang]);

  // PS §3.3 Module C: Auto-play plain-language audio after 2s delay (unless accessibility muted)
  useEffect(() => {
    const playTimer = setTimeout(() => {
      if (isMutedRef.current) return;
      try {
        speak(latestSummaryRef.current, ttsLang).catch(() => {
          // Autoplay blocked by browser policy without user gesture — silently fall back
        });
      } catch {
        // Fallback silently without throwing
      }
    }, 2000);

    return () => {
      clearTimeout(playTimer);
      stop();
    };
  }, [ttsLang, speak, stop]);

  // Auto-redirect after 30 seconds and purge session state
  useEffect(() => {
    // Purge kiosk-scoped session state immediately on submit
    const kioskKeys = [
      'patient_name', 'patient_complaint', 'chief_complaint', 'patient_age',
      'patient_gender', 'patient_phone', 'patient_language', 'patient_session',
      'session_id', 'ayush_mode', 'red_flag_triggered', 'patient_medications', 'patient_condition'
    ];
    kioskKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('interview_')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('interview_')) {
        sessionStorage.removeItem(key);
      }
    });
    sessionStorage.removeItem('seen_data_fiduciary_notice');

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative overflow-hidden font-body">
      <MandalaBackground />
      <div className="w-full max-w-2xl z-10 flex flex-col items-center text-center bg-white p-8 sm:p-12 rounded-[24px] shadow-xl border-2 border-primary/20">
        <div className="w-20 h-20 mb-6 flex items-center justify-center shrink-0" data-testid="success-checkmark-container">
          <svg
            className="w-20 h-20 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.25" />
            <path
              d="M5 13l4 4L19 7"
              className="checkmark-draw"
            />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-charcoal mb-4">
          {isMr ? 'धन्यवाद!' : isBn ? 'ধন্যবাদ!' : isHi ? 'धन्यवाद!' : 'Thank you!'}
        </h1>
        <p className="text-lg sm:text-xl text-muted font-semibold mb-6">
          {isMr
            ? 'आपली माहिती यशस्वीरित्या सादर झाली आहे. कृपया डॉक्टरांची प्रतीक्षा करा.'
            : isBn
            ? 'আপনার তথ্য সফলভাবে জমা দেওয়া হয়েছে। অনুগ্রহ করে ডাক্তারের জন্য অপেক্ষা করুন।'
            : isHi
            ? 'आपकी जानकारी सफलतापूर्वक सबमिट हो गई है। कृपया डॉक्टर की प्रतीक्षा करें।'
            : 'Your information has been successfully submitted. Please wait for the doctor.'}
        </p>

        {/* Collapsible "What we heard" section */}
        <div className="w-full mb-8 bg-sand/60 border border-warmgray rounded-2xl overflow-hidden text-left shadow-xs transition-all">
          <div className="w-full flex items-center justify-between p-4 bg-sand/90 rounded-t-2xl">
            <button
              type="button"
              onClick={() => setIsAccordionOpen(prev => !prev)}
              className="flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg p-1 -m-1"
              aria-expanded={isAccordionOpen}
            >
              <span className="text-primary font-bold text-base sm:text-lg">
                {isMr ? 'आम्ही ऐकलेली माहिती' : isBn ? 'আমরা যা শুনেছি' : isHi ? 'हमारे द्वारा सुनी गई जानकारी' : 'What we heard'}
              </span>
              {summaryData.hasRedFlag && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-danger/10 text-danger px-2.5 py-0.5 rounded-full border border-danger/20">
                  <AlertTriangle className="w-3 h-3" />
                  {isMr ? 'तातडीचे लक्ष' : isBn ? 'জরুরি দৃষ্টি আকর্ষণ' : isHi ? 'तत्काल ध्यान' : 'Immediate Attention'}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 text-muted">
              <button
                type="button"
                onClick={() => speak(plainSummaryText, ttsLang)}
                className="p-1.5 rounded-lg hover:bg-white text-primary transition-colors focus:outline-none"
                title={isMr ? 'पुन्हा ऐका' : isBn ? 'আবার শুনুন' : isHi ? 'पुनः सुनें' : 'Listen again'}
                aria-label={isMr ? 'पुन्हा ऐका' : isBn ? 'আবার শুনুন' : isHi ? 'पुनः सुनें' : 'Listen again'}
              >
                <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-secondary' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsAccordionOpen(prev => !prev)}
                className="p-1 hover:text-charcoal transition-colors focus:outline-none"
                aria-label={isAccordionOpen ? 'Collapse section' : 'Expand section'}
              >
                {isAccordionOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isAccordionOpen && (
            <div className="p-5 border-t border-warmgray/50 bg-white/70">
              <p
                id="plain-summary-text"
                className="text-base sm:text-lg text-charcoal leading-relaxed font-medium"
              >
                {plainSummaryText}
              </p>
              {summaryData.hasRedFlag && (
                <div className="mt-3 flex items-center gap-2 text-danger text-sm font-semibold bg-danger/5 p-2.5 rounded-xl border border-danger/15">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {isMr
                      ? 'कृपया त्वरित डॉक्टर किंवा रुग्णालय कर्मचाऱ्यांना कळवा.'
                      : isBn
                      ? 'অনুগ্রহ করে অবিলম্বে হাসপাতালের কর্মী বা ডাক্তারকে জানান।'
                      : isHi
                      ? 'कृपया तुरंत डॉक्टर या अस्पताल के कर्मचारियों को सूचित करें।'
                      : 'Please notify hospital staff or the doctor immediately.'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-semibold text-lg rounded-xl shadow-md hover:bg-primary/90 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          {isMr ? 'पूर्ण करा आणि बाहेर पडा' : isBn ? 'সম্পূর্ণ ও প্রস্থান করুন' : isHi ? 'समाप्त करें और बाहर निकलें' : 'Finish & Logout'}
        </button>
        <p className="text-xs text-muted mt-3">
          {isMr ? `${countdown} सेकंदात आपोआप रीडायरेक्ट` : isBn ? `${countdown} সেকেন্ডে স্বয়ংক্রিয়ভাবে রিডাইরেক্ট` : isHi ? `${countdown} सेकंड में स्वतः रीडायरेक्ट` : `Auto-redirecting in ${countdown}s`}
        </p>
      </div>
      <VoiceGuideButton
        clipId="submitted"
        language={ttsLang}
        fallbackText={plainSummaryText}
      />
    </div>
  );
}

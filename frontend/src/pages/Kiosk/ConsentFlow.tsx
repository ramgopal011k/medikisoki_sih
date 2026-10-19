import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { HeartPulse, Thermometer, Brain, Activity, Wind, CircleHelp, MapPin, Building2, Mic, Loader2, Stethoscope, Leaf } from 'lucide-react';
import { MandalaBackground } from '../../components/MandalaBackground';
import { LeafStepIndicator } from '../../components/LeafStepIndicator';
import { AudioExplanationButton } from '../../components/AudioExplanationButton';
import { QuestionCard } from '../../components/QuestionCard';
import { VoiceGuideButton } from '../../components/VoiceGuideButton';
import { useAsr } from '@/hooks/useAsr';
import { useAudio } from '@/hooks/useAudio';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { API_URL } from '@/lib/api';
import { loadHospitalsSWR } from '@/lib/hospitalsCache';
import { extractDigitsFromSpokenText, matchSpokenLanguage } from '@/lib/speechUtils';
import { cleanTranscript, extractName, parseDemographics } from '@/lib/transcriptCleaner';

export { extractName, parseDemographics };
import { useTranslation, type Language } from '@/lib/i18n';

type Step = 'language' | 'hospital' | 'patient_type' | 'new_patient' | 'identity' | 'otp' | 'history' | 'consent' | 'complaint' | 'success';

export default function ConsentFlow() {
  const { hospitalId: urlHospitalId } = useParams();
  const [searchParams] = useSearchParams();

  const urlLang = searchParams.get('lang');
  const savedLang = localStorage.getItem('patient_language') || urlLang || '';
  const [step, setStep] = useState<Step>(savedLang ? (urlHospitalId ? 'patient_type' : 'hospital') : 'language');
  const [stepHistory, setStepHistory] = useState<Step[]>([]);

  const goToStep = (nextStep: Step) => {
    setStepHistory((prev) => [...prev, step]);
    setStep(nextStep);
  };

  const handleBack = () => {
    if (stepHistory.length === 0) return;
    const prevStep = stepHistory[stepHistory.length - 1];
    setStepHistory((prev) => prev.slice(0, -1));
    setStep(prevStep);
  };
  const [language, setLanguage] = useState(savedLang);
  const isHi = language === 'hi';
  const isMr = language === 'mr';
  const isBn = language === 'bn';
  const isHindi = isHi;
  const ttsLang = isHi ? 'hi-IN' : isMr ? 'mr-IN' : isBn ? 'bn-IN' : 'en-IN';
  const { t } = useTranslation(language as Language);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState(urlHospitalId || '');
  const [abhaId, setAbhaId] = useState('');
  const [mockOtp, setMockOtp] = useState('');
  const [userOtp, setUserOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [complaint, setComplaint] = useState('Chest pain');
  const [complaintTab, setComplaintTab] = useState<'symptoms'|'ayush'>('symptoms');
  const [patientType, setPatientType] = useState<'existing' | 'new'>('existing');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  // Voice state machine for new patient registration: name → age → gender
  const [newPatientVoiceField, setNewPatientVoiceField] = useState<'name' | 'age' | 'gender'>('name');
  const [ayushMode, setAyushMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const navigate = useNavigate();

  // Legacy selectedRegions state (defaults to empty without BodyMap)
  const [selectedRegions] = useState<string[]>(() => []);
  const suggestedComplaints = useMemo<string[]>(() => [], []);

  const { isListening, isProcessing, transcript, startListening, stopListening, clearTranscript, setTranscript } = useAsr();
  const { speak, stop } = useAudio();

  // Task 2: Immediate audio cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const baseAbhaIdRef = useRef('');

  const [consentClinicalCare, setConsentClinicalCare] = useState(true);
  const [consentDataAnalytics, setConsentDataAnalytics] = useState(true);
  const [consentABDM, setConsentABDM] = useState(true);
  const [consentResearch, setConsentResearch] = useState(true);
  const [isCaregiver, setIsCaregiver] = useState(() => sessionStorage.getItem('caregiver_mode') === 'true');
  const [voiceFailCount, setVoiceFailCount] = useState(0);

  const wasListeningRef = useRef(false);
  const prevListeningRef = useRef(false);

  useEffect(() => {
    clearTranscript();
    setVoiceFailCount(0);
  }, [step, clearTranscript]);

  useEffect(() => {
    if (prevListeningRef.current && !isListening) {
      if (transcript && transcript.trim().length > 0) {
        setVoiceFailCount(c => c + 1);
      }
    }
    prevListeningRef.current = isListening;
  }, [isListening, transcript]);

  useEffect(() => {
    if (isListening && !wasListeningRef.current) {
      baseAbhaIdRef.current = abhaId;
      wasListeningRef.current = true;
    } else if (!isListening) {
      wasListeningRef.current = false;
    }
  }, [isListening, abhaId]);

  useEffect(() => {
    if (urlLang && !urlHospitalId) {
      loadHospitalsSWR((data) => setHospitals(data || []));
    }
  }, [urlLang, urlHospitalId]);

  // Process ASR voice input based on current step
  useEffect(() => {
    if (!transcript) return;
    const cleaned = cleanTranscript(transcript, { language: language as 'en' | 'hi' });
    const matchTranscript = cleaned || transcript;
    const lower = matchTranscript.toLowerCase().trim();

    if (step === 'language') {
      const matched = matchSpokenLanguage(transcript);
      if (matched) {
        stopListening();
        setTranscript('');
        handleLanguageSelect(matched);
      }
    } else if (step === 'hospital') {
      if (hospitals.length > 0) {
        const match = hospitals.find(
          (h) =>
            lower.includes(h.hospital_name.toLowerCase()) ||
            lower.includes(h.location.toLowerCase())
        );
        if (match) {
          stopListening();
          setTranscript('');
          handleHospitalSelect(match.hospital_id);
        } else if (
          lower.includes('one') ||
          lower.includes('first') ||
          lower.includes('पहला') ||
          lower.includes('पहिले') ||
          lower.includes('पहिला') ||
          lower.includes('প্রথম') ||
          lower.includes('1')
        ) {
          stopListening();
          setTranscript('');
          handleHospitalSelect(hospitals[0].hospital_id);
        }
      }
    } else if (step === 'patient_type') {
      if (
        lower.includes('abha') ||
        lower.includes('आभा') ||
        lower.includes('আভা') ||
        lower.includes('yes') ||
        lower.includes('existing') ||
        lower.includes('होय') ||
        lower.includes('হ্যাঁ')
      ) {
        stopListening();
        setTranscript('');
        setPatientType('existing');
        goToStep('identity');
      } else if (
        lower.includes('new') ||
        lower.includes('नया') ||
        lower.includes('नवीन') ||
        lower.includes('নতুন') ||
        lower.includes('no') ||
        lower.includes('नाही') ||
        lower.includes('না')
      ) {
        stopListening();
        setTranscript('');
        setPatientType('new');
        setAbhaId(`TEMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
        goToStep('new_patient');
      }
    } else if (step === 'new_patient') {
      if (
        lower.includes('continue') ||
        lower.includes('next') ||
        lower.includes('आगे') ||
        lower.includes('पुढे') ||
        lower.includes('चालিয়ে যান') ||
        lower.includes('পরবর্তী')
      ) {
        if (patientName && patientAge && patientGender) {
          stopListening();
          goToStep('consent');
          setTranscript('');
          return;
        }
      }

      // Extract structured demographics (Name, Age, Gender) from natural conversation
      const demo = parseDemographics(transcript);
      if (demo.name && demo.name.length >= 2) {
        setPatientName(demo.name);
      }
      if (demo.age) {
        setPatientAge(demo.age);
      }
      if (demo.gender) {
        setPatientGender(demo.gender);
      }
    } else if (step === 'identity') {
      // Extract digits from spoken numbers (handles words like "one two", "एक दो", Devanagari/Bengali numerals, etc.)
      const digits = extractDigitsFromSpokenText(transcript);
      if (digits.length > 0) {
        const nextId = (baseAbhaIdRef.current + digits).slice(0, 14);
        setAbhaId(nextId);

        // If all 14 digits reached or user says continue, advance to OTP
        if (
          nextId.length >= 14 ||
          lower.includes('continue') ||
          lower.includes('next') ||
          lower.includes('आगे') ||
          lower.includes('पुढे') ||
          lower.includes('चालিয়ে যান')
        ) {
          stop();
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setMockOtp(code);
          goToStep('otp');
        }
      } else if (
        lower.includes('continue') ||
        lower.includes('next') ||
        lower.includes('आगे') ||
        lower.includes('पुढे') ||
        lower.includes('चालিয়ে যান')
      ) {
        if (abhaId.length >= 14) {
          stop();
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setMockOtp(code);
          goToStep('otp');
        }
      }
    } else if (step === 'history') {
      if (
        lower.includes('continue') ||
        lower.includes('next') ||
        lower.includes('आगे') ||
        lower.includes('नई') ||
        lower.includes('new') ||
        lower.includes('पुढे') ||
        lower.includes('नवीन') ||
        lower.includes('নতুন') ||
        lower.includes('চালিয়ে যান')
      ) {
        stop();
        goToStep('consent');
      }
    } else if (step === 'consent') {
      if (
        lower.includes('agree') ||
        lower.includes('yes') ||
        lower.includes('हाँ') ||
        lower.includes('सहमत') ||
        lower.includes('ok') ||
        lower.includes('continue') ||
        lower.includes('होय') ||
        lower.includes('मान्य') ||
        lower.includes('হ্যাঁ') ||
        lower.includes('সম্মত') ||
        lower.includes('ঠিক আছে')
      ) {
        stopListening();
        stop();
        setTranscript('');
        goToStep('complaint');
      }
    } else if (step === 'complaint') {
      const clean = transcript.toLowerCase().trim();

      // Check AYUSH Assessment toggle (e.g. "Ayush", "Ayurveda", "Traditional medicine", "आयुष", "আয়ুষ")
      if (
        clean.includes('ayush') ||
        clean.includes('ayurveda') ||
        clean.includes('ayurvedic') ||
        clean.includes('traditional') ||
        clean.includes('आयुष') ||
        clean.includes('आयुर्वेद') ||
        clean.includes('पारंपरिक') ||
        clean.includes('আয়ুষ') ||
        clean.includes('আয়ুর্বেদ')
      ) {
        setAyushMode(true);
      }

      // Check Start / Begin command
      if (
        clean === 'start' ||
        clean === 'begin' ||
        clean.includes('start interview') ||
        clean.includes('begin interview') ||
        clean.includes('start assessment') ||
        clean.includes('shuru') ||
        clean.includes('शुरू') ||
        clean.includes('सुरू') ||
        clean.includes('শুরু')
      ) {
        stopListening();
        setTranscript('');
        startSession();
        return;
      }

      // Check complaints with conversational filler handling
      if (
        clean.includes('chest') ||
        clean.includes('heart') ||
        clean.includes('छाती') ||
        clean.includes('सीना') ||
        clean.includes('हृदय') ||
        clean.includes('বুক') ||
        clean.includes('বুকে')
      )
        setComplaint('Chest pain');
      else if (
        clean.includes('fever') ||
        clean.includes('temperature') ||
        clean.includes('bukhar') ||
        clean.includes('बुखार') ||
        clean.includes('ताप') ||
        clean.includes('জ্বর')
      )
        setComplaint('Fever');
      else if (
        clean.includes('stomach') ||
        clean.includes('abdomen') ||
        clean.includes('abdominal') ||
        clean.includes('belly') ||
        clean.includes('पेट') ||
        clean.includes('पोट') ||
        clean.includes('पोटात') ||
        clean.includes('পেট') ||
        clean.includes('পেটে')
      )
        setComplaint('Abdominal pain');
      else if (
        clean.includes('head') ||
        clean.includes('headache') ||
        clean.includes('सिर') ||
        clean.includes('डोके') ||
        clean.includes('डोकं') ||
        clean.includes('माथा') ||
        clean.includes('মাথাব্যথা')
      )
        setComplaint('Headache');
      else if (
        clean.includes('back') ||
        clean.includes('spine') ||
        clean.includes('पीठ') ||
        clean.includes('कमर') ||
        clean.includes('पाठ') ||
        clean.includes('पाठीत') ||
        clean.includes('পিঠ') ||
        clean.includes('পিঠে')
      )
        setComplaint('Back pain');
      else if (
        clean.includes('cough') ||
        clean.includes('coughing') ||
        clean.includes('khansi') ||
        clean.includes('खांसी') ||
        clean.includes('खोकला') ||
        clean.includes('কাশি')
      )
        setComplaint('Cough');
      else if (
        clean.includes('other') ||
        clean.includes('अन्य') ||
        clean.includes('दूसरा') ||
        clean.includes('इतर') ||
        clean.includes('অন্যান্য')
      )
        setComplaint('Other');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, step, hospitals]);

  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('patient_language', lang);
    if (urlHospitalId) {
      // If we already have a hospital ID from the URL, skip the hospital selection step
      goToStep('patient_type');
    } else {
      loadHospitalsSWR((data) => {
        setHospitals(data || []);
        goToStep('hospital');
      });
    }
  };

  const handleHospitalSelect = (hId: string) => {
    setHospitalId(hId);
    goToStep('patient_type');
  };

  const playAudioConsent = async () => {
    const text = isMr
      ? 'तुम्ही वैद्यकीय तपासणीसाठी तुमचा डेटा शेअर करण्यास सहमत आहात का?'
      : isBn
      ? 'আপনি কি ক্লিনিকাল মূল্যায়নের জন্য আপনার ডেটা ভাগ করতে সম্মত?'
      : isHi
      ? 'क्या आप अपना डेटा साझा करने के लिए सहमत हैं?'
      : 'Do you consent to share your data for clinical assessment?';
    
    setIsPlaying(true);
    await speak(text, ttsLang, 'consent');
    setIsPlaying(false);
  };

  const startSession = async () => {
    setIsStarting(true);
    const validHospitalId = (hospitalId === 'demo' || !hospitalId) ? '11111111-1111-1111-1111-111111111111' : hospitalId;
    const validComplaint = complaint || 'Chest pain';
    const validLang = language || 'en';
    const validAbha = abhaId || '00000000000000';

    const complaintMap: Record<string, string> = {
      'Chest pain': 'chest_pain',
      'Fever': 'fever',
      'Abdominal pain': 'stomach_ache',
      'Headache': 'headache',
      'Back pain': 'back_pain',
      'Cough': 'cough',
      'Other': 'other'
    };
    const chiefKey = complaintMap[validComplaint] || validComplaint.toLowerCase().replace(/\s+/g, '_');

    try {
      const payload: any = {
        hospital_id: validHospitalId,
        patient_name: patientType === 'new' ? (patientName || 'New Patient') : (validAbha !== '00000000000000' ? `Patient ••${validAbha.slice(-4)}` : 'Patient'),
        dummy_aadhaar: validAbha,
        language: validLang,
        chief_complaint: validComplaint,
        patient_type: patientType,
        ayush_opt_in: ayushMode,
        body_regions: selectedRegions,
        caregiver_mode: isCaregiver,
        proxy_respondent: isCaregiver ? 'true' : 'false',
        consents: {
          clinical_care: consentClinicalCare,
          ai_analytics: consentDataAnalytics,
          abdm_sharing: consentABDM,
          research: consentResearch,
          clinicalCare: consentClinicalCare,
          dataAnalytics: consentDataAnalytics
        }
      };
      
      if (patientType === 'new') {
        payload.age = patientAge;
        payload.gender = patientGender;
        payload.phone = patientPhone;
      }

      const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize session');

      const sData = data.data || data.session;
      const sessionToken = sData?.session_id || sData?.id || data.data?.session_token || crypto.randomUUID();

      sessionStorage.setItem('patient_session', sessionToken);
      sessionStorage.setItem('session_id', sessionToken);
      if (isCaregiver) {
        sessionStorage.setItem('caregiver_mode', 'true');
      }
      if (patientName) sessionStorage.setItem('patient_name', patientName);
      if (patientAge) sessionStorage.setItem('patient_age', patientAge);
      if (patientGender) sessionStorage.setItem('patient_gender', patientGender);
      sessionStorage.setItem('patient_complaint', validComplaint);
      sessionStorage.setItem('chief_complaint', chiefKey);
      localStorage.setItem('patient_language', validLang);
      sessionStorage.setItem('ayush_mode', ayushMode.toString());
      
      setStep('success');
      setTimeout(() => {
        if (ayushMode) {
          navigate('/ayush-assessment');
        } else {
          navigate('/interview');
        }
      }, 400);
    } catch (err: any) {
      console.warn('Network issue starting session, using local session:', err);
      const fallbackToken = crypto.randomUUID();
      sessionStorage.setItem('patient_session', fallbackToken);
      sessionStorage.setItem('session_id', fallbackToken);
      if (patientName) sessionStorage.setItem('patient_name', patientName);
      if (patientAge) sessionStorage.setItem('patient_age', patientAge);
      if (patientGender) sessionStorage.setItem('patient_gender', patientGender);
      sessionStorage.setItem('patient_complaint', validComplaint);
      sessionStorage.setItem('chief_complaint', chiefKey);
      localStorage.setItem('patient_language', validLang);
      sessionStorage.setItem('ayush_mode', ayushMode.toString());
      
      setStep('success');
      setTimeout(() => {
        if (ayushMode) {
          navigate('/ayush-assessment');
        } else {
          navigate('/interview');
        }
      }, 400);
    } finally {
      setIsStarting(false);
    }
  };

  // Reusable Voice ASR Bar Component for each slide
  // eslint-disable-next-line
  const VoiceActionBar = ({ hint }: { hint: string }) => (
    <div className="flex flex-col items-center mt-6 pt-4 border-t border-warmgray/60 w-full">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isProcessing}
          onClick={() =>
            isListening
              ? stopListening()
              : startListening({ lang: ttsLang })
          }
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
            isListening
              ? 'bg-primary text-white scale-105 ring-2 ring-primary/40 animate-pulse'
              : isProcessing
              ? 'bg-amber-600 text-white'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
          title="Speak your response"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
        <div className="text-left">
          <p className="text-xs font-semibold text-charcoal">
            {isProcessing
              ? (isMr ? 'ऑडिओ प्रक्रिया होत आहे...' : isBn ? 'অডিও প্রক্রিয়া করা হচ্ছে...' : isHi ? 'ऑडियो प्रोसेस हो रहा है...' : 'Processing Audio...')
              : isListening
              ? (isMr ? 'ऐकत आहोत (थांबवण्यासाठी टॅप करा)...' : isBn ? 'শুনছি (থামাতে ট্যাপ করুন)...' : isHi ? 'सुन रहे हैं (रोकने के लिए टैप करें)...' : 'Listening (tap to finish)...')
              : (isMr ? 'आवाज इनपुट (ASR)' : isBn ? 'ভয়েস ইনপুট (ASR)' : isHi ? 'वॉयस इनपुट (ASR)' : 'Voice Input (ASR)')}
          </p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
      </div>
      {transcript && (
        <div className="flex flex-col items-center mt-2">
          <p className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
            "{transcript}"
          </p>
          {(() => {
            const cleaned = cleanTranscript(transcript, { language: (isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en') as any });
            if (cleaned && cleaned !== transcript) {
              return (
                <p className="text-[10px] text-muted font-medium italic mt-1">
                  {isMr ? `सुधारित: "${cleaned}"` : isBn ? `সংশোধিত: "${cleaned}"` : isHi ? `संशोधित: "${cleaned}"` : `Cleaned: "${cleaned}"`}
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}
      {voiceFailCount >= 2 && (
        <div className="mt-3 text-center animate-in fade-in">
          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg inline-block shadow-xs">
            {isMr
              ? 'आवाज ओळखता आला नाही. कृपया आपल्या पसंतीवर टॅप करा.'
              : isBn
              ? 'ভয়েস শনাক্ত করা যায়নি। অনুগ্রহ করে বিকল্পটিতে স্পর্শ করুন।'
              : isHi
              ? 'आवाज पहचानी नहीं गई। कृपया विकल्प पर टैप करें।'
              : 'Voice not recognized. Please tap your choice.'}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-4 sm:p-6 pb-28 sm:pb-12 pb-[env(safe-area-inset-bottom,32px)] relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      
      <div className="w-full max-w-[768px] z-10 flex flex-col gap-6 mb-16 sm:mb-8">
        
        {step !== 'language' && step !== 'success' && stepHistory.length > 0 && (
          <div className="w-full flex items-center justify-start">
            <button
              type="button"
              id="kiosk-back-btn"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-charcoal bg-white/90 border border-warmgray hover:bg-white hover:border-primary/50 shadow-xs transition-all cursor-pointer"
              aria-label="Back"
            >
              <span>← {t('common.back')}</span>
            </button>
          </div>
        )}

        {step !== 'language' && step !== 'success' && (
           <div className="w-full flex justify-center pb-2">
              <LeafStepIndicator total={4} current={['language', 'hospital', 'identity', 'consent', 'complaint'].indexOf(step) - 1} />
           </div>
        )}

      {step === 'language' && (
        <div className="w-full text-center flex flex-col items-center">
          <QuestionCard className="w-full max-w-2xl py-10 flex flex-col items-center">
            <div className="mb-2">
              <h1 className="font-display text-4xl lg:text-5xl text-charcoal mb-2">Choose your language</h1>
              <h2 className="font-hindi text-3xl lg:text-4xl text-muted">अपनी भाषा चुनें</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 justify-center mt-8 w-full px-4 sm:px-8">
              <Button id="consent-lang-en" className="w-full h-[64px] rounded-[12px] text-xl font-body bg-primary hover:bg-primary/90 text-white focus:outline-none focus:ring-2 focus:ring-warmgray" onClick={() => handleLanguageSelect('en')}>English</Button>
              <Button id="consent-lang-hi" className="w-full h-[64px] rounded-[12px] text-2xl font-hindi bg-white text-charcoal border-2 border-warmgray hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-warmgray" onClick={() => handleLanguageSelect('hi')}>हिंदी (Hindi)</Button>
              <Button id="consent-lang-mr" className="w-full h-[64px] rounded-[12px] text-2xl font-body bg-white text-charcoal border-2 border-warmgray hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-warmgray" onClick={() => handleLanguageSelect('mr')}>मराठी (Marathi)</Button>
              <Button id="consent-lang-bn" className="w-full h-[64px] rounded-[12px] text-2xl font-body bg-white text-charcoal border-2 border-warmgray hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-warmgray" onClick={() => handleLanguageSelect('bn')}>বাংলা (Bengali)</Button>
            </div>
            <VoiceActionBar hint='Say "English", "हिंदी", "मराठी", or "বাংলা"' />
          </QuestionCard>
          <div className="mt-4">
             <p className="text-muted font-body text-sm">
               {isMr
                 ? 'मदत हवी आहे? कृपया समोरच्या कर्मचाऱ्यांना विचारा.'
                 : isBn
                 ? 'সাহায্য প্রয়োজন? অনুগ্রহ করে ফ্রন্ট ডেস্ক কর্মীদের জিজ্ঞাসা করুন।'
                 : isHi
                 ? 'मदद चाहिए? कृपया रिसेप्शन स्टाफ से पूछें।'
                 : 'Need help? Please ask the front desk staff.'}
             </p>
          </div>
        </div>
      )}

      {step === 'hospital' && (
        <div className="w-full text-center flex flex-col items-center">
           <div className="mb-6">
             <h1 className="font-display text-3xl text-charcoal">
               {isMr ? 'आज तुम्ही कोठे आहात?' : isBn ? 'আজ আপনি কোথায় আছেন?' : isHi ? 'आज आप कहाँ हैं?' : 'Where are you today?'}
             </h1>
           </div>
          <div className="w-full max-w-2xl flex flex-col gap-4">
            {hospitals.map(h => {
              const isAyush = h.hospital_type.toLowerCase().includes('ayush') || h.hospital_type.toLowerCase().includes('ayurvedic');
              return (
                <button 
                  key={h.hospital_id} 
                  className={`w-full min-h-[76px] p-4 flex items-center justify-between bg-white rounded-[16px] border-2 transition-all duration-300 shadow-xs hover:shadow-md ${isAyush ? 'border-terracotta hover:bg-terracotta/5' : 'border-warmgray hover:border-primary/30'}`}
                  onClick={() => handleHospitalSelect(h.hospital_id)}
                >
                  <div className="flex items-center gap-4 text-left">
                     <div className={`p-3 rounded-full ${isAyush ? 'bg-terracotta/10 text-terracotta' : 'bg-primary/10 text-primary'}`}>
                        <Building2 className="w-6 h-6" />
                     </div>
                     <div>
                       <div className="font-body text-lg font-semibold text-charcoal">{h.hospital_name}</div>
                       <div className="flex items-center gap-1 text-muted text-sm mt-0.5">
                          <MapPin className="w-3.5 h-3.5" /> {h.location}
                       </div>
                     </div>
                  </div>
                  {isAyush && (
                    <span className="text-xs font-body font-bold text-terracotta bg-terracotta/10 px-3 py-1 rounded-full">AYUSH</span>
                  )}
                </button>
              );
            })}
            <VoiceActionBar
              hint={
                isMr
                  ? 'रुग्णालयाचे नाव किंवा "पहिले रुग्णालय" म्हणा'
                  : isBn
                  ? 'হাসপাতালের নাম বা "প্রথম হাসপাতাল" বলুন'
                  : isHi
                  ? 'अस्पताल का नाम या "पहला अस्पताल" बोलें'
                  : 'Say hospital name or "First hospital"'
              }
            />
          </div>
        </div>
      )}

      {step === 'patient_type' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {t('consent.patient_type_q')}
             </h1>
          </div>
          <div className="space-y-4 mt-6">
            <div className="flex items-center gap-3 p-3.5 bg-sand/80 rounded-xl border border-warmgray text-left">
              <input 
                id="caregiver-checkbox"
                type="checkbox"
                checked={isCaregiver}
                onChange={e => {
                  const checked = e.target.checked;
                  setIsCaregiver(checked);
                  sessionStorage.setItem('caregiver_mode', checked ? 'true' : 'false');
                }}
                className="w-5 h-5 accent-primary rounded cursor-pointer shrink-0"
              />
              <label htmlFor="caregiver-checkbox" className="text-sm font-semibold text-charcoal cursor-pointer select-none">
                {t('consent.answering_caregiver')}
              </label>
            </div>

            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body" 
              onClick={() => {
                setVoiceFailCount(0);
                setPatientType('existing');
                goToStep('identity');
              }}
            >
              {t('consent.have_abha')}
            </Button>
            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-white text-primary border-2 border-primary hover:bg-primary/5 font-body" 
              onClick={() => {
                setVoiceFailCount(0);
                setPatientType('new');
                setAbhaId(`TEMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
                goToStep('new_patient');
              }}
            >
              {t('consent.new_patient')}
            </Button>
            <VoiceActionBar
              hint={
                isMr
                  ? 'बोला "आभा" किंवा "मी नवीन रुग्ण आहे"'
                  : isBn
                  ? 'বলুন "আভা" বা "নতুন রোগী"'
                  : isHi
                  ? 'बोलें "आभा" या "नया मरीज"'
                  : 'Say "ABHA" or "I am new"'
              }
            />
          </div>
        </QuestionCard>
      )}

      {step === 'new_patient' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {t('consent.new_patient_reg')}
             </h1>
             <p className="text-sm text-muted">{t('consent.please_fill')}</p>
          </div>
          <div className="space-y-4 mt-6 text-left">
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">{t('consent.fullName')}</label>
              <input 
                type="text" 
                placeholder="John Doe"
                className={`w-full p-3 min-h-[48px] border-2 rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 font-body ${/\d/.test(patientName) ? 'border-red-500 focus:ring-red-500' : 'border-warmgray focus:ring-primary'}`}
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
              />
              {/\d/.test(patientName) && <p className="text-red-500 text-xs mt-1">Name cannot contain numbers</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">{t('consent.age')}</label>
                <input 
                  type="number" 
                  placeholder="30"
                  className={`w-full p-3 min-h-[48px] border-2 rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 font-body ${(patientAge !== '' && (parseInt(patientAge) <= 0 || parseInt(patientAge) > 120)) ? 'border-red-500 focus:ring-red-500' : 'border-warmgray focus:ring-primary'}`}
                  value={patientAge}
                  onChange={e => setPatientAge(e.target.value)}
                  min="1"
                  max="120"
                />
                {(patientAge !== '' && (parseInt(patientAge) <= 0 || parseInt(patientAge) > 120)) && <p className="text-red-500 text-xs mt-1">Age must be between 1 and 120</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">{t('consent.gender')}</label>
                <select 
                  className="w-full p-3 min-h-[48px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
                  value={patientGender}
                  onChange={e => setPatientGender(e.target.value)}
                >
                  <option value="">{t('consent.select')}</option>
                  <option value="Male">{t('consent.male')}</option>
                  <option value="Female">{t('consent.female')}</option>
                  <option value="Other">{t('consent.other')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">{t('consent.phone')}</label>
              <input 
                type="tel" 
                placeholder="1234567890"
                className="w-full p-3 min-h-[48px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
                value={patientPhone}
                onChange={e => setPatientPhone(e.target.value)}
              />
            </div>
            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body mt-4" 
              disabled={!patientName || !patientAge || !patientGender || /\d/.test(patientName) || parseInt(patientAge) <= 0 || parseInt(patientAge) > 120}
              onClick={() => goToStep('consent')}
            >
              {t('common.continue')}
            </Button>
            <VoiceActionBar
              hint={
                isMr
                  ? 'तपशील भरा आणि पुढे जा वर क्लिक करा'
                  : isBn
                  ? 'বিবরণ পূরণ করুন এবং চালিয়ে যান ক্লিক করুন'
                  : isHi
                  ? 'विवरण भरें और जारी रखें पर क्लिक करें'
                  : 'Fill details and click Continue'
              }
            />
          </div>
        </QuestionCard>
      )}

      {step === 'identity' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {t('consent.identity_q')}
             </h1>
             <p className="text-sm text-muted">{t('consent.abha_desc')}</p>
          </div>
          <div className="space-y-4 mt-6">
            <input 
              type="text" 
              placeholder="91 1234 5678 9012"
              className="w-full text-center text-3xl tracking-[0.2em] p-5 min-h-[64px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
              value={abhaId}
              onChange={e => setAbhaId(e.target.value.replace(/\D/g, '').slice(0, 14))}
            />
            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body" 
              disabled={abhaId.length < 14}
              onClick={() => {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                setMockOtp(code);
                goToStep('otp');
              }}
            >
              {t('common.continue')}
            </Button>
            <VoiceActionBar
              hint={
                isMr
                  ? '१४ अंकी आभा नंबर बोला'
                  : isBn
                  ? '১৪ অঙ্কের আভা নম্বর বলুন'
                  : isHi
                  ? '14 अंकों का आभा नंबर बोलें'
                  : 'Speak 14 digits or say your ABHA ID'
              }
            />
          </div>
        </QuestionCard>
      )}

      {step === 'otp' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {t('consent.otp_q')}
             </h1>
             <p className="text-sm text-muted">{t('consent.otp_desc')}</p>
             <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-200">
               {t('consent.otp_hint')}: <span className="font-bold tracking-widest ml-2 text-lg">{mockOtp}</span>
             </div>
          </div>
          <div className="space-y-4 mt-6">
            <input 
              type="text" 
              placeholder="123456"
              maxLength={6}
              className="w-full text-center text-3xl tracking-[0.3em] p-5 min-h-[64px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
              value={userOtp}
              onChange={e => {
                setOtpError('');
                setUserOtp(e.target.value.replace(/\D/g, ''));
              }}
            />
            {otpError && <p className="text-red-500 text-sm font-semibold">{otpError}</p>}
            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body" 
              disabled={userOtp.length < 6}
              onClick={() => {
                if (userOtp === mockOtp) {
                  // Fetch patient records
                  fetch(`${API_URL}/api/patient/visits/${abhaId}`)
                    .then(res => res.json())
                    .then(data => {
                      if (data.data && data.data.length > 0) {
                        setPastVisits(data.data);
                        goToStep('history');
                      } else {
                        goToStep('consent');
                      }
                    })
                    .catch(err => {
                      console.error('Failed to fetch history', err);
                      goToStep('consent');
                    });
                } else {
                  setOtpError(t('consent.invalid_otp'));
                }
              }}
            >
              {t('common.verify')}
            </Button>
          </div>
        </QuestionCard>
      )}

      {step === 'history' && (
        <QuestionCard className="w-full max-w-2xl mx-auto flex flex-col items-center">
           <div className="mb-4 text-center">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {t('consent.past_records')}
             </h1>
             <p className="text-sm text-muted">{t('consent.past_records_sub')}</p>
           </div>
           
           <div className="w-full max-h-[300px] overflow-y-auto space-y-3 mt-4 pr-2">
             {pastVisits.map((visit: any) => (
               <div key={visit.id} className="p-4 bg-white border border-warmgray rounded-xl shadow-sm text-left">
                 <div className="flex justify-between items-start mb-2">
                   <div className="font-semibold text-charcoal">{new Date(visit.created_at).toLocaleDateString()}</div>
                   <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">{visit.status}</div>
                 </div>
                 <div className="text-sm text-muted">
                   <strong>{isMr ? 'तक्रार:' : isBn ? 'অভিযোগ:' : isHi ? 'शिकायत:' : 'Complaint:'}</strong> {visit.chief_complaint}
                 </div>
               </div>
             ))}
           </div>
           
           <Button 
             className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body mt-6" 
             onClick={() => goToStep('consent')}
           >
             {t('consent.continue_new_visit')}
           </Button>
           <VoiceActionBar
             hint={
               isMr
                 ? 'बोला "पुढे सुरू ठेवा"'
                 : isBn
                 ? 'বলুন "চালিয়ে যান"'
                 : isHi
                 ? 'बोलें "आगे बढ़ें"'
                 : 'Say "Continue"'
             }
           />
        </QuestionCard>
      )}

      {step === 'consent' && (
        <QuestionCard className="w-full max-w-2xl mx-auto flex flex-col items-center">
           <AudioExplanationButton 
             onClick={playAudioConsent} 
             isSpeaking={isPlaying} 
             className="mb-6"
             aria-label="Listen to consent explanation"
           />
           
            <div className="w-full space-y-3">
               <div className="flex items-start gap-4 p-3.5 bg-white rounded-xl border border-warmgray">
                  <input 
                    id="consent-clinical-care" 
                    type="checkbox" 
                    checked={consentClinicalCare} 
                    onChange={e => setConsentClinicalCare(e.target.checked)}
                    className="w-6 h-6 mt-1 accent-primary border-warmgray rounded shrink-0" 
                  />
                  <div className="text-left">
                    <label htmlFor="consent-clinical-care" className="font-body text-base font-semibold text-charcoal cursor-pointer block">
                      {t('consent.clinical_care')}
                    </label>
                    <div className="text-muted text-xs mt-0.5 font-body">
                      {t('consent.clinical_care_desc')}
                    </div>
                  </div>
               </div>
               <div className="flex items-start gap-4 p-3.5 bg-white rounded-xl border border-warmgray">
                  <input 
                    id="consent-ai-analytics" 
                    type="checkbox" 
                    checked={consentDataAnalytics} 
                    onChange={e => setConsentDataAnalytics(e.target.checked)}
                    className="w-6 h-6 mt-1 accent-primary border-warmgray rounded shrink-0" 
                  />
                  <div className="text-left">
                    <label htmlFor="consent-ai-analytics" className="font-body text-base font-semibold text-charcoal cursor-pointer block">
                      {t('consent.ai_analytics')}
                    </label>
                    <div className="text-muted text-xs mt-0.5 font-body">
                      {t('consent.ai_analytics_desc')}
                    </div>
                  </div>
               </div>
               <div className="flex items-start gap-4 p-3.5 bg-white rounded-xl border border-warmgray">
                  <input 
                    id="consent-abdm-sharing" 
                    type="checkbox" 
                    checked={consentABDM} 
                    onChange={e => setConsentABDM(e.target.checked)}
                    className="w-6 h-6 mt-1 accent-primary border-warmgray rounded shrink-0" 
                  />
                  <div className="text-left">
                    <label htmlFor="consent-abdm-sharing" className="font-body text-base font-semibold text-charcoal cursor-pointer block">
                      {t('consent.abdm_sharing')}
                    </label>
                    <div className="text-muted text-xs mt-0.5 font-body">
                      {t('consent.abdm_sharing_desc')}
                    </div>
                  </div>
               </div>
               <div className="flex items-start gap-4 p-3.5 bg-white rounded-xl border border-warmgray">
                  <input 
                    id="consent-research" 
                    type="checkbox" 
                    checked={consentResearch} 
                    onChange={e => setConsentResearch(e.target.checked)}
                    className="w-6 h-6 mt-1 accent-primary border-warmgray rounded shrink-0" 
                  />
                  <div className="text-left">
                    <label htmlFor="consent-research" className="font-body text-base font-semibold text-charcoal cursor-pointer block">
                      {t('consent.research')}
                    </label>
                    <div className="text-muted text-xs mt-0.5 font-body">
                      {t('consent.research_desc')}
                    </div>
                  </div>
               </div>
            </div>
           
            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body mt-6" 
              onClick={() => {
                 stop();
                 goToStep('complaint');
              }}
            >
             {t('consent.agree_button')}
           </Button>
           <VoiceActionBar
             hint={
               isMr
                 ? 'बोला "सहमत आहे" किंवा "होय"'
                 : isBn
                 ? 'বলুন "সম্মত" বা "হ্যাঁ"'
                 : isHi
                 ? 'बोलें "सहमत हूँ" या "हाँ"'
                 : 'Say "I agree" or "हाँ / सहमत हूँ"'
             }
           />
        </QuestionCard>
      )}

      {step === 'complaint' && (
        <div className="w-full max-w-[850px] text-center">
           <div className="mb-6">
             <h1 className="font-display text-3xl lg:text-4xl text-charcoal mb-1">
               {isMr ? 'आज तुम्हाला येथे काय आणले आहे?' : isBn ? 'আজ আপনাকে এখানে কী নিয়ে এসেছে?' : isHi ? 'आज आप यहाँ किस परेशानी से आए हैं?' : 'What brings you here today?'}
             </h1>
             <p className="text-muted text-sm mt-2 max-w-md mx-auto">
                {isMr ? 'आजची तुमची मुख्य समस्या किंवा सामान्य लक्षणे निवडा.' : isBn ? 'আজ আপনার প্রধান সমস্যা বা সাধারণ লক্ষণ বেছে নিন।' : isHi ? 'आज की अपनी मुख्य परेशानी या सामान्य लक्षण चुनें।' : 'Choose your primary symptom or reason for visit today.'}
             </p>
           </div>

           {/* Top Navigation Tabs */}
           <div className="flex items-center justify-between w-full max-w-sm mx-auto bg-white rounded-full p-1.5 mb-6 border border-sand shadow-xs">
              <button 
                onClick={() => { setComplaintTab('symptoms'); setAyushMode(false); }} 
                className={`flex-1 py-2.5 px-3 sm:px-4 rounded-full text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all ${complaintTab === 'symptoms' ? 'bg-[#0B4A3F] text-white shadow-md' : 'bg-transparent text-muted hover:bg-sand/30'}`}>
                <Stethoscope className={`w-4 h-4 ${complaintTab === 'symptoms' ? 'text-blue-300' : 'text-blue-500'}`} />
                Symptoms
                {complaint && <span className={`${complaintTab === 'symptoms' ? 'bg-white text-[#0B4A3F]' : 'bg-[#0B4A3F] text-white'} text-[10px] w-5 h-5 rounded-full flex items-center justify-center`}>1</span>}
              </button>
              <button 
                onClick={() => { setComplaintTab('ayush'); setAyushMode(true); }} 
                className={`flex-1 py-2.5 px-3 sm:px-4 rounded-full text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all ${complaintTab === 'ayush' ? 'bg-[#0B4A3F] text-white shadow-md' : 'bg-transparent text-muted hover:bg-sand/30'}`}>
                <Leaf className={`w-4 h-4 ${complaintTab === 'ayush' ? 'text-green-300' : 'text-green-600'}`} />
                AYUSH
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </button>
           </div>

           {/* AYUSH Info Banner */}
           {complaintTab === 'ayush' && (
             <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
               <Leaf className="w-5 h-5 text-emerald-600 shrink-0" />
               <div>
                 <span className="font-bold">{t('consent.ayush_toggle')}:</span> {t('consent.ayush_desc')}
               </div>
             </div>
           )}

           {/* Symptoms List */}
           {(complaintTab === 'symptoms' || complaintTab === 'ayush') && (
             <>
               {/* Auto-suggested complaints banner based on selected regions */}
               {suggestedComplaints.length > 0 && (
                 <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs sm:text-sm text-primary font-bold">
                   <span>✨ {t('consent.based_on_selection')}</span>
                   <span className="underline">{suggestedComplaints.join(', ')}</span>
                 </div>
               )}

               <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 lg:gap-4 mt-2">
                 {[
                   { id: 'chest_pain', en: 'Chest pain', hi: 'छाती में दर्द', mr: 'छातीत दुखणे', bn: 'বুকে ব্যথা', icon: HeartPulse, color: 'text-danger', bg: 'bg-danger/10' },
                   { id: 'fever', en: 'Fever', hi: 'बुखार', mr: 'ताप', bn: 'জ্বর', icon: Thermometer, color: 'text-turmeric', bg: 'bg-turmeric/10' },
                   { id: 'abdominal_pain', en: 'Abdominal pain', hi: 'पेट में दर्द', mr: 'पोटदुखी', bn: 'পেটে ব্যথা', icon: Activity, color: 'text-muted', bg: 'bg-muted/10' },
                   { id: 'headache', en: 'Headache', hi: 'सिरदर्द', mr: 'डोकेदुखी', bn: 'মাথাব্যথা', icon: Brain, color: 'text-lavender', bg: 'bg-lavender/10' },
                   { id: 'back_pain', en: 'Back pain', hi: 'पीठ में दर्द', mr: 'पाठदुखी', bn: 'পিঠে ব্যথা', icon: Activity, color: 'text-terracotta', bg: 'bg-terracotta/10' },
                   { id: 'cough', en: 'Cough', hi: 'खांसी', mr: 'खोकला', bn: 'কাশি', icon: Wind, color: 'text-success', bg: 'bg-success/10' },
                   { id: 'other', en: 'Other', hi: 'अन्य', mr: 'इतर', bn: 'অন্যান্য', icon: CircleHelp, color: 'text-charcoal', bg: 'bg-charcoal/10' }
                 ].map(c => (
                <button
                  key={c.id}
                  onClick={() => setComplaint(c.en)}
                  className={`min-h-[90px] relative flex flex-col items-center justify-center p-4 bg-white rounded-[16px] border-2 transition-all duration-300 ${complaint === c.en ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20' : suggestedComplaints.includes(c.en) ? 'border-secondary/60 bg-secondary/5 hover:border-primary/40' : 'border-warmgray hover:border-primary/40'}`}
                >
                  {suggestedComplaints.includes(c.en) && complaint !== c.en && (
                    <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-white shadow-2xs">
                      {t('consent.suggested')}
                    </span>
                  )}
                  <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-2 ${c.bg} ${c.color}`}>
                    <c.icon className="w-6 h-6" />
                  </div>
                  <span className="font-body font-semibold text-charcoal text-base">
                    {isMr ? c.mr : isBn ? c.bn : isHi ? c.hi : c.en}
                  </span>
                </button>
              ))}
           </div>
           </>
           )}
           
           <div className="mt-6 flex justify-center pb-[env(safe-area-inset-bottom,24px)]">
              <Button 
                id="btn-start-session"
                className="w-full max-w-sm min-h-[56px] sm:min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body focus:outline-none focus:ring-2 focus:ring-warmgray focus:ring-offset-2 disabled:opacity-50 shadow-md" 
                disabled={isStarting}
                onClick={startSession}
              >
                {isStarting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('consent.starting')}
                  </span>
                ) : (
                  t('consent.start')
                )}
              </Button>
            </div>

            <VoiceActionBar
              hint={
                isMr
                  ? 'सांगा "छातीत दुखणे", "ताप", "खोकला", किंवा "डोकेदुखी"'
                  : isBn
                  ? 'বলুন "বুকে ব্যথা", "জ্বর", "কাশি", বা "মাথাব্যথা"'
                  : isHi
                  ? 'बोलें "छाती में दर्द", "बुखार", "खांसी", या "सिरदर्द"'
                  : 'Say "Chest pain", "Fever", "Cough", or "Headache"'
              }
            />
        </div>
      )}

      {step === 'success' && (
        <div className="w-full text-center flex flex-col items-center">
          <QuestionCard className="w-full max-w-2xl py-12 flex flex-col items-center">
            <div className="mb-6 p-4 bg-success/10 text-success rounded-full">
               <HeartPulse className="w-14 h-14" />
            </div>
            <h1 className="font-display text-4xl text-charcoal mb-2">
               {t('consent.ready')}
            </h1>
            <p className="font-body text-lg text-muted">
               {t('consent.interview_begins')}
            </p>
          </QuestionCard>
        </div>
      )}

      </div>
      <VoiceGuideButton 
        clipId={
          step === 'patient_type' ? 'patient_type' :
          step === 'identity' ? 'abha' :
          step === 'otp' ? 'otp' :
          step === 'consent' ? 'consent' :
          step === 'complaint' ? 'chief_complaint' :
          step === 'new_patient' ? 'patient_name' :
          undefined
        }
        text={
          step === 'patient_type' ? (
            isMr ? 'कृपया निवडा की तुमच्याकडे आभा आयडी आहे किंवा तुम्ही नवीन रुग्ण आहात.' :
            isBn ? 'আপনার আভা আইডি আছে নাকি আপনি নতুন রোগী তা নির্বাচন করুন।' :
            isHi ? 'कृपया चुनें कि क्या आपके पास आभा आईडी है या आप नए मरीज हैं।' :
            'Please select whether you have an existing ABHA ID or want to register as a new patient.'
          ) :
          step === 'identity' ? (
            isMr ? 'कृपया आपला १४ अंकी आभा नंबर नोंदवा.' :
            isBn ? 'অনুগ্রহ করে আপনার ১৪ অঙ্কের আভা নম্বর লিখুন।' :
            isHi ? 'कृपया अपना 14 अंकों का आभा नंबर दर्ज करें।' :
            'Please enter your 14-digit ABHA number.'
          ) :
          step === 'otp' ? (
            isMr ? 'कृपया ६ अंकी ओटीपी नोंदवा.' :
            isBn ? 'অনুগ্রহ করে ৬ অঙ্কের ওটিপি দিন।' :
            isHi ? 'कृपया 6 अंकों का ओटीपी दर्ज करें।' :
            'Please enter the 6-digit OTP sent to your phone.'
          ) :
          step === 'consent' ? (
            isMr ? 'कृपया आपल्या संमती पर्यायांचे पुनरावलोकन करा.' :
            isBn ? 'অনুগ্রহ করে আপনার স্বাস্থ্য ডেটা সম্মতির বিকল্পগুলি পর্যালোচনা করুন।' :
            isHi ? 'कृपया अपनी सहमति विकल्पों की समीक्षा करें।' :
            'Please review and select your health data consent choices.'
          ) :
          step === 'complaint' ? (
            isMr ? 'आज तुम्हाला काय त्रास होत आहे ते कृपया निवडा.' :
            isBn ? 'আজ আপনার কি সমস্যা হচ্ছে তা অনুগ্রহ করে নির্বাচন করুন।' :
            isHi ? 'आज आपको क्या परेशानी है, कृपया चुनें।' :
            'Please select your primary health concern or symptom.'
          ) :
          step === 'new_patient' ? (
            isMr ? 'कृपया नवीन रुग्ण म्हणून आपले नाव, वय आणि लिंग नोंदवा.' :
            isBn ? 'অনুগ্রহ করে নতুন রোগী হিসেবে আপনার নাম, বয়স এবং লিঙ্গ প্রদান করুন।' :
            isHi ? 'कृपया नए मरीज के रूप में अपना नाम, उम्र और लिंग दर्ज करें।' :
            'Please provide your full name, age, and gender.'
          ) :
          (
            isMr ? 'कृपया आपली माहिती आणि संमती तपासा.' :
            isBn ? 'অনুগ্রহ করে আপনার তথ্য ও সম্মতি পর্যালোচনা করুন।' :
            isHi ? 'कृपया अपनी जानकारी एवं सहमति भरें।' :
            'Please review and select your health data consent choices.'
          )
        }
        language={ttsLang} 
      />
    </div>
  );
}

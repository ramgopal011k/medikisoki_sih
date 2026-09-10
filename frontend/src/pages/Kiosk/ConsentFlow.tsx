import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { HeartPulse, Thermometer, Brain, Activity, Wind, CircleHelp, MapPin, Building2, Flower2, Mic, Loader2 } from 'lucide-react';
import { MandalaBackground } from '../../components/MandalaBackground';
import { LeafStepIndicator } from '../../components/LeafStepIndicator';
import { AudioExplanationButton } from '../../components/AudioExplanationButton';
import { QuestionCard } from '../../components/QuestionCard';
import { useAsr } from '@/hooks/useAsr';
import { API_URL } from '@/lib/api';
import { extractDigitsFromSpokenText, matchSpokenLanguage } from '@/lib/speechUtils';

type Step = 'language' | 'hospital' | 'patient_type' | 'new_patient' | 'identity' | 'otp' | 'history' | 'consent' | 'complaint' | 'success';

export default function ConsentFlow() {
  const { hospitalId: urlHospitalId } = useParams();
  const [searchParams] = useSearchParams();
  const urlLang = searchParams.get('lang');
  
  const [step, setStep] = useState<Step>(urlLang ? (urlHospitalId ? 'patient_type' : 'hospital') : 'language');
  const [language, setLanguage] = useState(urlLang || '');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState(urlHospitalId || '');
  const [abhaId, setAbhaId] = useState('');
  const [mockOtp, setMockOtp] = useState('');
  const [userOtp, setUserOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [complaint, setComplaint] = useState('Chest pain');
  const [patientType, setPatientType] = useState<'existing' | 'new'>('existing');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [ayushMode, setAyushMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const navigate = useNavigate();

  const { isListening, isProcessing, transcript, startListening, stopListening } = useAsr();

  const baseAbhaIdRef = useRef('');

  const wasListeningRef = useRef(false);

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
      // If language was provided but no hospital ID, fetch hospitals
      fetch(`${API_URL}/api/hospitals`)
        .then(res => res.json())
        .then(data => {
          setHospitals(data.data || []);
        })
        .catch(console.error);
    }
  }, [urlLang, urlHospitalId]);

  // Process ASR voice input based on current step
  useEffect(() => {
    if (!transcript) return;
    const lower = transcript.toLowerCase().trim();

    if (step === 'language') {
      const matched = matchSpokenLanguage(transcript);
      if (matched) {
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
          handleHospitalSelect(match.hospital_id);
        } else if (
          lower.includes('one') ||
          lower.includes('first') ||
          lower.includes('पहला') ||
          lower.includes('1')
        ) {
          handleHospitalSelect(hospitals[0].hospital_id);
        }
      }
    } else if (step === 'patient_type') {
      if (lower.includes('abha') || lower.includes('आभा') || lower.includes('yes') || lower.includes('existing')) {
        setPatientType('existing');
        setStep('identity');
      } else if (lower.includes('new') || lower.includes('नया') || lower.includes('no')) {
        setPatientType('new');
        setAbhaId(`TEMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
        setStep('new_patient');
      }
    } else if (step === 'new_patient') {
      if (lower.includes('continue') || lower.includes('next') || lower.includes('आगे')) {
        setStep('consent');
      }
    } else if (step === 'identity') {
      // Extract digits from spoken numbers (handles words like "one two" or "एक दो" or digits)
      const digits = extractDigitsFromSpokenText(transcript);
      if (digits.length > 0) {
        const nextId = (baseAbhaIdRef.current + digits).slice(0, 14);
        setAbhaId(nextId);

        // If all 14 digits reached or user says continue, advance to OTP
        if (nextId.length >= 14 || lower.includes('continue') || lower.includes('next') || lower.includes('आगे')) {
          window.speechSynthesis?.cancel();
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setMockOtp(code);
          setStep('otp');
        }
      } else if (lower.includes('continue') || lower.includes('next') || lower.includes('आगे')) {
        if (abhaId.length >= 14) {
          window.speechSynthesis?.cancel();
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setMockOtp(code);
          setStep('otp');
        }
      }
    } else if (step === 'history') {
      if (
        lower.includes('continue') ||
        lower.includes('next') ||
        lower.includes('आगे') ||
        lower.includes('नई') ||
        lower.includes('new')
      ) {
        window.speechSynthesis?.cancel();
        setStep('consent');
      }
    } else if (step === 'consent') {
      if (
        lower.includes('agree') ||
        lower.includes('yes') ||
        lower.includes('हाँ') ||
        lower.includes('सहमत') ||
        lower.includes('ok') ||
        lower.includes('continue')
      ) {
        window.speechSynthesis?.cancel();
        setStep('complaint');
      }
    } else if (step === 'complaint') {
      if (lower.includes('chest') || lower.includes('छाती')) setComplaint('Chest pain');
      else if (lower.includes('fever') || lower.includes('बुखार')) setComplaint('Fever');
      else if (
        lower.includes('stomach') ||
        lower.includes('abdomen') ||
        lower.includes('abdominal') ||
        lower.includes('पेट')
      )
        setComplaint('Abdominal pain');
      else if (lower.includes('head') || lower.includes('headache') || lower.includes('सिर'))
        setComplaint('Headache');
      else if (lower.includes('back') || lower.includes('पीठ')) setComplaint('Back pain');
      else if (lower.includes('cough') || lower.includes('खांसी')) setComplaint('Cough');
      else if (lower.includes('other') || lower.includes('अन्य')) setComplaint('Other');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, step, hospitals]);

  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('patient_language', lang);
    if (urlHospitalId) {
      // If we already have a hospital ID from the URL, skip the hospital selection step
      setStep('patient_type');
    } else {
      fetch(`${API_URL}/api/hospitals`)
        .then(res => res.json())
        .then(data => {
          setHospitals(data.data || []);
          setStep('hospital');
        })
        .catch(console.error);
    }
  };

  const handleHospitalSelect = (hId: string) => {
    setHospitalId(hId);
    setStep('patient_type');
  };

  const playAudioConsent = () => {
    const text = language === 'hi' 
      ? 'क्या आप अपना डेटा साझा करने के लिए सहमत हैं?' 
      : 'Do you consent to share your data for clinical assessment?';
    
    if ('speechSynthesis' in window) {
      setIsPlaying(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const startSession = async () => {
    setIsStarting(true);
    const validHospitalId = hospitalId || '11111111-1111-1111-1111-111111111111';
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
        patient_type: patientType
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
      const sessionToken = data.data?.session_token || data.data?.id || crypto.randomUUID();

      localStorage.setItem('patient_session', sessionToken);
      localStorage.setItem('session_id', sessionToken);
      if (patientName) localStorage.setItem('patient_name', patientName);
      localStorage.setItem('patient_complaint', validComplaint);
      localStorage.setItem('chief_complaint', chiefKey);
      localStorage.setItem('patient_language', validLang);
      localStorage.setItem('ayush_mode', ayushMode.toString());
      
      setStep('success');
      setTimeout(() => {
        if (ayushMode) {
          navigate('/ayush-assessment');
        } else {
          navigate('/interview');
        }
      }, 400);
    } catch (err) {
      console.warn('Network issue starting session, using local session:', err);
      const fallbackToken = crypto.randomUUID();
      localStorage.setItem('patient_session', fallbackToken);
      localStorage.setItem('session_id', fallbackToken);
      if (patientName) localStorage.setItem('patient_name', patientName);
      localStorage.setItem('patient_complaint', validComplaint);
      localStorage.setItem('chief_complaint', chiefKey);
      localStorage.setItem('patient_language', validLang);
      localStorage.setItem('ayush_mode', ayushMode.toString());
      
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
              : startListening({ lang: language === 'hi' ? 'hi-IN' : 'en-IN' })
          }
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
            isListening
              ? 'bg-primary text-white scale-105 ring-2 ring-primary/40'
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
              ? 'Processing Audio...'
              : isListening
              ? 'Listening (tap to finish)...'
              : 'Voice Input (ASR)'}
          </p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
      </div>
      {transcript && (
        <p className="mt-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
          "{transcript}"
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      
      <div className="w-full max-w-[768px] z-10 flex flex-col gap-6">
        
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
            <div className="flex flex-col sm:flex-row gap-6 justify-center mt-8 w-full px-8">
              <Button className="w-full sm:w-64 h-[72px] rounded-[12px] text-2xl font-body bg-primary hover:bg-primary/90 text-white focus:outline-none focus:ring-2 focus:ring-warmgray focus:ring-offset-2" onClick={() => handleLanguageSelect('en')}>English</Button>
              <Button className="w-full sm:w-64 h-[72px] rounded-[12px] text-3xl font-hindi bg-white text-charcoal border-2 border-warmgray hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-warmgray focus:ring-offset-2" onClick={() => handleLanguageSelect('hi')}>हिंदी</Button>
            </div>
            <VoiceActionBar hint='Say "English" or "Hindi"' />
          </QuestionCard>
          <div className="mt-4">
             <p className="text-muted font-body text-sm">Need help? Please ask the front desk staff.</p>
          </div>
        </div>
      )}

      {step === 'hospital' && (
        <div className="w-full text-center flex flex-col items-center">
           <div className="mb-6">
             <h1 className="font-display text-3xl text-charcoal">Where are you today?</h1>
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
            <VoiceActionBar hint='Say hospital name or "First hospital"' />
          </div>
        </div>
      )}

      {step === 'patient_type' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {language === 'hi' ? 'आप क्या हैं?' : 'Are you a new or existing patient?'}
             </h1>
          </div>
          <div className="space-y-4 mt-6">
            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body" 
              onClick={() => {
                setPatientType('existing');
                setStep('identity');
              }}
            >
              {language === 'hi' ? 'मेरे पास आभा (ABHA) आईडी है' : 'I have an ABHA ID'}
            </Button>
            <Button 
              className="w-full min-h-[58px] text-lg rounded-[12px] bg-white text-primary border-2 border-primary hover:bg-primary/5 font-body" 
              onClick={() => {
                setPatientType('new');
                setAbhaId(`TEMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
                setStep('new_patient');
              }}
            >
              {language === 'hi' ? 'मैं एक नया मरीज हूँ' : 'I am a new patient'}
            </Button>
            <VoiceActionBar hint='Say "I have ABHA" or "I am new"' />
          </div>
        </QuestionCard>
      )}

      {step === 'new_patient' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {language === 'hi' ? 'नया मरीज पंजीकरण' : 'New Patient Registration'}
             </h1>
             <p className="text-sm text-muted">Please fill in your details to continue</p>
          </div>
          <div className="space-y-4 mt-6 text-left">
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe"
                className="w-full p-3 min-h-[48px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Age</label>
                <input 
                  type="number" 
                  placeholder="30"
                  className="w-full p-3 min-h-[48px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
                  value={patientAge}
                  onChange={e => setPatientAge(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Gender</label>
                <select 
                  className="w-full p-3 min-h-[48px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary font-body"
                  value={patientGender}
                  onChange={e => setPatientGender(e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Phone Number (Optional)</label>
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
              disabled={!patientName || !patientAge || !patientGender}
              onClick={() => setStep('consent')}
            >
              {language === 'hi' ? 'जारी रखें' : 'Continue'}
            </Button>
            <VoiceActionBar hint='Fill details and click Continue' />
          </div>
        </QuestionCard>
      )}

      {step === 'identity' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {language === 'hi' ? 'अपना आभा (ABHA) आईडी दर्ज करें' : 'Enter your ABHA ID'}
             </h1>
             <p className="text-sm text-muted">14-digit Ayushman Bharat Health Account</p>
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
                setStep('otp');
              }}
            >
              {language === 'hi' ? 'जारी रखें' : 'Continue'}
            </Button>
            <VoiceActionBar hint='Speak 14 digits or say your ABHA ID' />
          </div>
        </QuestionCard>
      )}

      {step === 'otp' && (
        <QuestionCard className="w-full max-w-2xl mx-auto text-center">
          <div className="mb-4">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {language === 'hi' ? 'ओटीपी दर्ज करें' : 'Enter OTP'}
             </h1>
             <p className="text-sm text-muted">A verification code has been sent to your registered number.</p>
             <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-200">
               Mock OTP (for demo): <span className="font-bold tracking-widest ml-2 text-lg">{mockOtp}</span>
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
                        setStep('history');
                      } else {
                        setStep('consent');
                      }
                    })
                    .catch(err => {
                      console.error('Failed to fetch history', err);
                      setStep('consent');
                    });
                } else {
                  setOtpError(language === 'hi' ? 'गलत ओटीपी' : 'Invalid OTP. Please try again.');
                }
              }}
            >
              {language === 'hi' ? 'सत्यापित करें' : 'Verify'}
            </Button>
          </div>
        </QuestionCard>
      )}

      {step === 'history' && (
        <QuestionCard className="w-full max-w-2xl mx-auto flex flex-col items-center">
           <div className="mb-4 text-center">
             <h1 className="font-display text-3xl text-charcoal mb-1">
                {language === 'hi' ? 'पिछले रिकॉर्ड' : 'Past Records Found'}
             </h1>
             <p className="text-sm text-muted">We found previous visits linked to this ABHA ID.</p>
           </div>
           
           <div className="w-full max-h-[300px] overflow-y-auto space-y-3 mt-4 pr-2">
             {pastVisits.map((visit: any) => (
               <div key={visit.id} className="p-4 bg-white border border-warmgray rounded-xl shadow-sm text-left">
                 <div className="flex justify-between items-start mb-2">
                   <div className="font-semibold text-charcoal">{new Date(visit.created_at).toLocaleDateString()}</div>
                   <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">{visit.status}</div>
                 </div>
                 <div className="text-sm text-muted"><strong>Complaint:</strong> {visit.chief_complaint}</div>
               </div>
             ))}
           </div>
           
           <Button 
             className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body mt-6" 
             onClick={() => setStep('consent')}
           >
             {language === 'hi' ? 'नई विजिट के रूप में जारी रखें' : 'Continue as New Visit'}
           </Button>
           <VoiceActionBar hint='Say "Continue"' />
        </QuestionCard>
      )}

      {step === 'consent' && (
        <QuestionCard className="w-full max-w-2xl mx-auto flex flex-col items-center">
           <AudioExplanationButton 
             onClick={playAudioConsent} 
             isSpeaking={isPlaying} 
             className="mb-6"
           />
           
           <div className="w-full space-y-4">
              <div className="flex items-start gap-4 p-4 border-b border-warmgray bg-white rounded-xl border">
                 <input type="checkbox" className="w-6 h-6 mt-1 accent-primary border-warmgray rounded shrink-0" defaultChecked />
                 <div className="text-left">
                   <div className="font-body text-base font-semibold text-charcoal">
                     {language === 'hi' ? 'मैं अपनी जानकारी साझा करने के लिए सहमत हूँ' : 'I agree to share my information'}
                   </div>
                   <div className="text-muted text-sm mt-0.5 font-body">
                     {language === 'hi' ? 'आपके डेटा का उपयोग केवल आपके इलाज के लिए किया जाएगा।' : 'Your data will only be used for your treatment.'}
                   </div>
                 </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-warmgray">
                 <input type="checkbox" className="w-6 h-6 mt-1 accent-primary border-warmgray rounded shrink-0" defaultChecked />
                 <div className="text-left">
                   <div className="font-body text-base font-semibold text-charcoal">
                     {language === 'hi' ? 'आवाज़ रिकॉर्डिंग' : 'Voice Recording'}
                   </div>
                   <div className="text-muted text-sm mt-0.5 font-body">
                     {language === 'hi' ? 'हम बातचीत रिकॉर्ड करेंगे।' : 'We will record conversation.'}
                   </div>
                 </div>
              </div>
           </div>
           
           <Button 
             className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body mt-6" 
             onClick={() => {
                window.speechSynthesis.cancel();
                setStep('complaint');
             }}
           >
             {language === 'hi' ? 'मैं समझता/समझती हूँ और सहमत हूँ' : 'I understand and agree'}
           </Button>
           <VoiceActionBar hint='Say "I agree" or "हाँ / सहमत हूँ"' />
        </QuestionCard>
      )}

      {step === 'complaint' && (
        <div className="w-full max-w-[850px] text-center">
           <div className="mb-6">
             <h1 className="font-display text-3xl lg:text-4xl text-charcoal mb-1">
               {language === 'hi' ? 'आज आपको क्या परेशानी है?' : 'What brings you here today?'}
             </h1>
           </div>
          
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 lg:gap-4 mt-6">
              {[
                { id: 'chest_pain', en: 'Chest pain', hi: 'छाती में दर्द', icon: HeartPulse, color: 'text-danger', bg: 'bg-danger/10' },
                { id: 'fever', en: 'Fever', hi: 'बुखार', icon: Thermometer, color: 'text-turmeric', bg: 'bg-turmeric/10' },
                { id: 'abdominal_pain', en: 'Abdominal pain', hi: 'पेट में दर्द', icon: Activity, color: 'text-muted', bg: 'bg-muted/10' },
                { id: 'headache', en: 'Headache', hi: 'सिरदर्द', icon: Brain, color: 'text-lavender', bg: 'bg-lavender/10' },
                { id: 'back_pain', en: 'Back pain', hi: 'पीठ में दर्द', icon: Activity, color: 'text-terracotta', bg: 'bg-terracotta/10' },
                { id: 'cough', en: 'Cough', hi: 'खांसी', icon: Wind, color: 'text-success', bg: 'bg-success/10' },
                { id: 'other', en: 'Other', hi: 'अन्य', icon: CircleHelp, color: 'text-charcoal', bg: 'bg-charcoal/10' }
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => setComplaint(c.en)}
                  className={`min-h-[90px] flex flex-col items-center justify-center p-4 bg-white rounded-[16px] border-2 transition-all duration-300 ${complaint === c.en ? 'border-primary bg-primary/5 shadow-sm' : 'border-warmgray hover:border-primary/40'}`}
                >
                  <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-2 ${c.bg} ${c.color}`}>
                    <c.icon className="w-6 h-6" />
                  </div>
                  <span className="font-body font-semibold text-charcoal text-base">{language === 'hi' ? c.hi : c.en}</span>
                </button>
              ))}
           </div>
           
           <div className="mt-6 max-w-sm mx-auto">
             <button
                onClick={() => setAyushMode(!ayushMode)}
                className={`w-full p-3.5 rounded-[12px] border-2 flex items-center justify-between transition-all duration-300 ${ayushMode ? 'bg-terracotta/10 border-terracotta text-terracotta' : 'bg-white border-warmgray text-muted hover:border-terracotta/50'}`}
             >
                <div className="flex items-center gap-3">
                   <Flower2 className={`w-5 h-5 ${ayushMode ? 'text-terracotta' : 'text-muted'}`} />
                   <div className="text-left">
                     <div className={`font-body font-semibold text-base ${ayushMode ? 'text-terracotta' : 'text-charcoal'}`}>
                       {language === 'hi' ? 'आयुष मोड' : 'AYUSH Assessment'}
                     </div>
                     <div className="text-xs font-body opacity-80">
                        {language === 'hi' ? 'पारंपरिक चिकित्सा मूल्यांकन' : 'Traditional medicine evaluation'}
                     </div>
                   </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${ayushMode ? 'border-terracotta bg-terracotta' : 'border-warmgray'}`}>
                   {ayushMode && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
             </button>
           </div>
           
           <div className="mt-6 flex justify-center">
              <Button 
                className="w-full max-w-sm min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body focus:outline-none focus:ring-2 focus:ring-warmgray focus:ring-offset-2 disabled:opacity-50" 
                disabled={isStarting}
                onClick={startSession}
              >
                {isStarting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {language === 'hi' ? 'शुरू हो रहा है...' : 'Starting...'}
                  </span>
                ) : (
                  language === 'hi' ? 'शुरू करें' : 'Start'
                )}
              </Button>
            </div>

            <VoiceActionBar hint='Say "Chest pain", "Fever", "Cough", or "Headache"' />
        </div>
      )}

      {step === 'success' && (
        <div className="w-full text-center flex flex-col items-center">
          <QuestionCard className="w-full max-w-2xl py-12 flex flex-col items-center">
            <div className="mb-6 p-4 bg-success/10 text-success rounded-full">
               <HeartPulse className="w-14 h-14" />
            </div>
            <h1 className="font-display text-4xl text-charcoal mb-2">
               {language === 'hi' ? 'तैयार!' : 'Ready!'}
            </h1>
            <p className="font-body text-lg text-muted">
               {language === 'hi' ? 'आपका साक्षात्कार जल्द ही शुरू होगा...' : 'Your clinical interview will begin shortly...'}
            </p>
          </QuestionCard>
        </div>
      )}

      </div>
    </div>
  );
}

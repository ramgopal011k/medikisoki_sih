import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, set } from 'idb-keyval';
import { MandalaBackground } from '../components/MandalaBackground';
import { QuestionCard } from '../components/QuestionCard';
import { LeafStepIndicator } from '../components/LeafStepIndicator';
import { Button } from '../components/ui/button';
import { Volume2, VolumeX, Mic, ShieldCheck } from 'lucide-react';
import { useAsr } from '@/hooks/useAsr';
import { cleanTranscript } from '@/lib/transcriptCleaner';
import { useAudio } from '@/hooks/useAudio';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { VoiceGuideButton } from '../components/VoiceGuideButton';

interface SessionState {
  id: string;
  language: string;
}

interface OfflineMedicalHistory {
  session_id: string;
  items: { category: string; value: string; }[];
}

const OFFLINE_MH_QUEUE_KEY = 'medikiosk_offline_medical_history';

const ROS_SYSTEMS = [
  { id: 'general', en: 'General', hi: 'सामान्य', mr: 'सामान्य', bn: 'সাধারণ', symptoms: ['Fever', 'Weight loss', 'Fatigue', 'Night sweats', 'None'] },
  { id: 'cardio', en: 'Cardiovascular', hi: 'हृदय रोग', mr: 'हृदय व रक्तवाहिन्या', bn: 'হৃদযন্ত্র', symptoms: ['Chest pain', 'Palpitations', 'Swelling (Edema)', 'None'] },
  { id: 'resp', en: 'Respiratory', hi: 'श्वसन', mr: 'श्वसन संस्था', bn: 'শ্বাসযন্ত্র', symptoms: ['Cough', 'Breathlessness (Dyspnea)', 'Wheezing', 'None'] },
  { id: 'gi', en: 'Gastrointestinal', hi: 'पेट/पाचन', mr: 'पचनसंस्था / पोट', bn: 'পরিপাকতন্ত্র', symptoms: ['Nausea/Vomiting', 'Abdominal pain', 'Diarrhea', 'None'] },
  { id: 'gu', en: 'Genitourinary', hi: 'मूत्र संबंधी', mr: 'मूत्रसंस्था', bn: 'মূত্রনালী', symptoms: ['Urinary issues', 'Painful urination', 'None'] },
  { id: 'neuro', en: 'Neurological', hi: 'तंत्रिका', mr: 'मज्जासंस्था', bn: 'স্নায়ুতন্ত্র', symptoms: ['Headache', 'Dizziness', 'Numbness/Tingling', 'None'] },
  { id: 'msk', en: 'Musculoskeletal', hi: 'मांसपेशियां/हड्डियां', mr: 'स्नायू व सांधे', bn: 'পেশী ও হাড়', symptoms: ['Joint pain', 'Muscle weakness', 'Back pain', 'None'] }
];

const OPTION_TRANSLATIONS: Record<string, { hi: string; mr: string; bn: string }> = {
  // Allergies
  'Penicillin': { hi: 'पेनिसिलिन', mr: 'पेनिसिलिन', bn: 'পেনিসিলিন' },
  'Sulfa drugs': { hi: 'सल्फा दवाएं', mr: 'सल्फा औषधे', bn: 'সালফা ওষুধ' },
  'Peanuts': { hi: 'मूंगफली', mr: 'शेंगदाणे', bn: 'বাদাম' },
  'Dust/Pollen': { hi: 'धूल/पराग', mr: 'धूळ / परागकण', bn: 'ধুলো / পরাগ' },
  'None': { hi: 'कोई नहीं', mr: 'काही नाही', bn: 'কিছু নেই' },
  'Other': { hi: 'अन्य', mr: 'इतर', bn: 'অন্যান্য' },

  // Conditions & Family History
  'Diabetes': { hi: 'मधुमेह', mr: 'मधुमेह', bn: 'ডায়াবেটিস' },
  'Hypertension (High BP)': { hi: 'उच्च रक्तचाप (High BP)', mr: 'उच्च रक्तदाब (High BP)', bn: 'উচ্চ রক্তচাপ' },
  'Hypertension': { hi: 'उच्च रक्तचाप', mr: 'उच्च रक्तदाब', bn: 'উচ্চ রক্তচাপ' },
  'Asthma': { hi: 'दमा (अस्थमा)', mr: 'दमा (अस्थमा)', bn: 'হাঁপানি' },
  'Thyroid': { hi: 'थायराइड', mr: 'थायरॉईड', bn: 'থাইরয়েড' },
  'Heart Disease': { hi: 'हृदय रोग', mr: 'हृदयरोग', bn: 'হৃদরোগ' },
  'Cancer': { hi: 'कैंसर', mr: 'कर्करोग (कॅन्सर)', bn: 'ক্যান্সার' },
  'Stroke': { hi: 'स्ट्रोक (पक्षाघात)', mr: 'पक्षाघात (स्ट्रोक)', bn: 'স্ট্রোক' },

  // Personal History
  'Smoking': { hi: 'धूम्रपान', mr: 'धूम्रपान', bn: 'ধূমপান' },
  'Alcohol': { hi: 'शराब', mr: 'मद्यपान', bn: 'মদ্যপান' },
  'Tobacco chewing': { hi: 'तम्बाकू चबाना', mr: 'तंबाखू खाणे', bn: 'তামাক চিবানো' },
  'Vegetarian diet': { hi: 'शाकाहारी आहार', mr: 'शाकाहारी आहार', bn: 'নিরামিষ আহার' },
  'Non-vegetarian diet': { hi: 'मांसाहारी आहार', mr: 'मांसाहारी आहार', bn: 'আমিষ আহার' },
  'Sedentary lifestyle': { hi: 'गतिहीन जीवनशैली', mr: 'बैठी जीवनशैली', bn: 'শারীরিক পরিশ্রমহীন জীবন' },
  'Regular exercise': { hi: 'नियमित व्यायाम', mr: 'नियमित व्यायाम', bn: 'নিয়মিত ব্যায়াম' },

  // Review of Systems
  'Fever': { hi: 'बुखार', mr: 'ताप', bn: 'জ্বর' },
  'Weight loss': { hi: 'वजन कम होना', mr: 'वजन कमी होणे', bn: 'ওজন হ্রাস' },
  'Fatigue': { hi: 'थकान', mr: 'थकवा', bn: 'ক্লান্তি' },
  'Night sweats': { hi: 'रात में पसीना आना', mr: 'रात्री घाम येणे', bn: 'রাতে ঘাম' },
  'Chest pain': { hi: 'छाती में दर्द', mr: 'छातीत दुखणे', bn: 'বুকে ব্যথা' },
  'Palpitations': { hi: 'धड़कन तेज होना', mr: 'धडधड वाढणे', bn: 'বুক ধড়ফড়' },
  'Swelling (Edema)': { hi: 'सूजन', mr: 'सूज', bn: 'ফোলা ভাব' },
  'Cough': { hi: 'खांसी', mr: 'खोकला', bn: 'কাশি' },
  'Breathlessness (Dyspnea)': { hi: 'सांस फूलना', mr: 'श्वास लागणे', bn: 'শ্বাসকষ্ট' },
  'Wheezing': { hi: 'घरघराहट', mr: 'घरघर आवाज', bn: 'ঘড়ঘড় শব্দ' },
  'Nausea/Vomiting': { hi: 'उल्टी / मिचली', mr: 'उलटी / मळमळ', bn: 'বমি বমি ভাব / বমি' },
  'Abdominal pain': { hi: 'पेट में दर्द', mr: 'पोटदुखी', bn: 'পেটে ব্যথা' },
  'Diarrhea': { hi: 'दस्त / दस्त लगना', mr: 'जुलाब', bn: 'ডায়রিয়া' },
  'Urinary issues': { hi: 'पेशाब की समस्या', mr: 'लघवीचा त्रास', bn: 'মূত্রনালীর সমস্যা' },
  'Painful urination': { hi: 'पेशाब में दर्द', mr: 'लघवी करताना वेदना', bn: 'প্রস্রাবে ব্যথা' },
  'Headache': { hi: 'सिरदर्द', mr: 'डोकेदुखी', bn: 'মাথাব্যথা' },
  'Dizziness': { hi: 'चक्कर आना', mr: 'चक्कर येणे', bn: 'মাথা ঘোরা' },
  'Numbness/Tingling': { hi: 'सुन्नपन / झनझनाहट', mr: 'बधीरपणा / मुंग्या येणे', bn: 'অসাড়তা / ঝিমঝিম' },
  'Joint pain': { hi: 'जोड़ों में दर्द', mr: 'सांधेदुखी', bn: 'গাঁটে ব্যথা' },
  'Muscle weakness': { hi: 'मांसपेशियों की कमजोरी', mr: 'स्नायूंचा अशक्तपणा', bn: 'পেশীর দুর্বলতা' },
  'Back pain': { hi: 'पीठ में दर्द', mr: 'पाठदुखी', bn: 'পিঠে ব্যথা' }
};

export default function MedicalHistoryFlow() {
  const navigate = useNavigate();
  // Lazily initialize session
  const [session] = useState<SessionState | null>(() => {
    const sessionId = sessionStorage.getItem('patient_session') || sessionStorage.getItem('session_id');
    const lang = localStorage.getItem('patient_language') || 'en';
    if (!sessionId) return null;
    return { id: sessionId, language: lang };
  });
  
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form State
  const [allergies, setAllergies] = useState<string[]>([]);
  const [otherAllergy, setOtherAllergy] = useState('');
  const [medications, setMedications] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [otherCondition, setOtherCondition] = useState('');
  const [surgeries, setSurgeries] = useState('');
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [personalHistory, setPersonalHistory] = useState<string[]>([]);
  const [rosSymptoms, setRosSymptoms] = useState<Record<string, string[]>>({});
  const [activeRosTab, setActiveRosTab] = useState('general');

  const { speak, isPlaying } = useAudio();
  const { isListening, transcript, startListening, stopListening } = useAsr();
  const { t } = useTranslation();

  const baseMedicationsRef = useRef('');
  const baseSurgeriesRef = useRef('');

  const wasListeningRef = useRef(false);

  useEffect(() => {
    if (isListening && !wasListeningRef.current) {
      if (step === 1) baseMedicationsRef.current = medications;
      if (step === 3) baseSurgeriesRef.current = surgeries;
      wasListeningRef.current = true;
    } else if (!isListening) {
      wasListeningRef.current = false;
    }
  }, [isListening, step, medications, surgeries]);

  const flushOfflineQueue = useCallback(async () => {
    const queue: OfflineMedicalHistory[] | undefined = await get(OFFLINE_MH_QUEUE_KEY);
    if (!queue || queue.length === 0) return;

    await Promise.resolve();
    setIsSyncing(true);
    const remainingQueue: OfflineMedicalHistory[] = [];

    for (const item of queue) {
      try {
        const res = await fetch(`${API_URL}/medical-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (!res.ok) throw new Error('Sync failed');
      } catch {
        remainingQueue.push(item);
      }
    }

    await set(OFFLINE_MH_QUEUE_KEY, remainingQueue);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    if (!session) {
      navigate('/consent');
      return;
    }

    const init = async () => {
      await flushOfflineQueue();
    };
    init();

    const handleOnline = () => { flushOfflineQueue(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session, navigate, flushOfflineQueue]);

  const userLang = session?.language || localStorage.getItem('patient_language') || 'en';
  const isMr = userLang === 'mr';
  const isBn = userLang === 'bn';
  const isHi = userLang === 'hi';
  const ttsLang = isMr ? 'mr-IN' : isBn ? 'bn-IN' : isHi ? 'hi-IN' : 'en-IN';
  const activeLang = (isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en') as 'en' | 'hi' | 'mr' | 'bn';

  const getOptionLabel = (item: string) => {
    if (isMr) return OPTION_TRANSLATIONS[item]?.mr || item;
    if (isBn) return OPTION_TRANSLATIONS[item]?.bn || item;
    if (isHi) return OPTION_TRANSLATIONS[item]?.hi || item;
    return item;
  };

  // Voice recognition handling for each step
  useEffect(() => {
    if (!transcript) return;
    const cleaned = cleanTranscript(transcript, { language: activeLang });
    const matchTranscript = cleaned || transcript;
    const lower = matchTranscript.toLowerCase();

    const isMatch = (item: string) => {
      const eng = item.toLowerCase().split('/')[0].split(' ')[0];
      if (lower.includes(eng)) return true;
      const trans = OPTION_TRANSLATIONS[item];
      if (trans) {
        if (trans.hi && lower.includes(trans.hi.toLowerCase())) return true;
        if (trans.mr && lower.includes(trans.mr.toLowerCase())) return true;
        if (trans.bn && lower.includes(trans.bn.toLowerCase())) return true;
      }
      return false;
    };

    const isNone = lower.includes('no') || lower.includes('none') || 
                   lower.includes('कोई नहीं') || lower.includes('नही') || 
                   lower.includes('काही नाही') || lower.includes('नाही') || 
                   lower.includes('कुछ नहीं') || lower.includes('কিছু নেই') || lower.includes('না');

    if (lower.includes('continue') || lower.includes('next') || lower.includes('finish') || 
        lower.includes('submit') || lower.includes('आगे') || lower.includes('समाप्त') || 
        lower.includes('पुढे') || lower.includes('चालू') || lower.includes('পরবর্তী') || lower.includes('চালিয়ে')) {
      stopListening();
      const btn = document.getElementById('btn-medical-next');
      if (btn && !(btn as HTMLButtonElement).disabled) {
        btn.click();
      }
      return;
    }

    if (step === 0) {
      // Allergies
      const allergyOptions = ['Penicillin', 'Sulfa drugs', 'Peanuts', 'Dust/Pollen', 'None', 'Other'];
      if (isNone) {
        setAllergies(['None']);
      } else {
        allergyOptions.forEach(item => {
          if (isMatch(item)) {
            toggleSelection(item, allergies, setAllergies);
          }
        });
      }
    } else if (step === 1) {
      // Medications - dictate text
      const base = baseMedicationsRef.current;
      const newMeds = base ? base + (base.endsWith(', ') || base.endsWith(',') ? ' ' : ', ') + matchTranscript : matchTranscript;
      setMedications(newMeds);
    } else if (step === 2) {
      // Conditions
      if (isNone) {
        setConditions(['None']);
      } else {
        ['Diabetes', 'Hypertension (High BP)', 'Asthma', 'Thyroid', 'Heart Disease', 'Other'].forEach(item => {
          if (isMatch(item)) {
            toggleSelection(item, conditions, setConditions);
          }
        });
      }
    } else if (step === 3) {
      // Surgeries - dictate text
      const base = baseSurgeriesRef.current;
      const newSurgs = base ? base + (base.endsWith(', ') || base.endsWith(',') ? ' ' : ', ') + matchTranscript : matchTranscript;
      setSurgeries(newSurgs);
    } else if (step === 4) {
      // Family History
      if (isNone) {
        setFamilyHistory(['None']);
      } else {
        ['Diabetes', 'Hypertension', 'Heart Disease', 'Cancer', 'Asthma', 'Stroke'].forEach(item => {
          if (isMatch(item)) {
            toggleSelection(item, familyHistory, setFamilyHistory);
          }
        });
      }
    } else if (step === 5) {
      // Personal History
      if (isNone) {
        setPersonalHistory(['None']);
      } else {
        ['Smoking', 'Alcohol', 'Tobacco chewing', 'Vegetarian diet', 'Non-vegetarian diet', 'Sedentary lifestyle', 'Regular exercise'].forEach(item => {
          if (isMatch(item)) {
            toggleSelection(item, personalHistory, setPersonalHistory);
          }
        });
      }
    } else if (step === 6) {
      // ROS categorized parsing
      if (isNone) {
        setRosSymptoms(prev => ({ ...prev, [activeRosTab]: ['None'] }));
      } else {
        ROS_SYSTEMS.forEach(sys => {
          sys.symptoms.forEach(sym => {
            if (sym === 'None') return;
            if (isMatch(sym)) {
              setRosSymptoms(prev => {
                const current = prev[sys.id] || [];
                let newList = current.filter(i => i !== 'None');
                if (!newList.includes(sym)) newList.push(sym);
                return { ...prev, [sys.id]: newList };
              });
            }
          });
        });
      }
    }
    // eslint-disable-next-line
  }, [transcript, step]);

  const toggleSelection = (item: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (item === 'None') {
      setList(['None']);
      return;
    }
    
    let newList = list.filter(i => i !== 'None');
    if (newList.includes(item)) {
      newList = newList.filter(i => i !== item);
    } else {
      newList.push(item);
    }
    setList(newList);
  };

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      submitHistory();
    }
  };

  const submitHistory = async () => {
    if (!session) return;
    setIsSubmitting(true);
    
    let finalAllergies = allergies.filter(a => a !== 'Other').join(', ');
    if (allergies.includes('Other') && otherAllergy) {
      finalAllergies += (finalAllergies ? ', ' : '') + otherAllergy;
    }

    let finalConditions = conditions.filter(c => c !== 'Other').join(', ');
    if (conditions.includes('Other') && otherCondition) {
      finalConditions += (finalConditions ? ', ' : '') + otherCondition;
    }

    const finalFamily = familyHistory.filter(f => f !== 'None').join(', ');
    const finalPersonal = personalHistory.filter(p => p !== 'None').join(', ');
    let finalRosArray: string[] = [];
    ROS_SYSTEMS.forEach(sys => {
      const selected = rosSymptoms[sys.id] || [];
      const valid = selected.filter(r => r !== 'None');
      if (valid.length > 0) {
        finalRosArray.push(`${sys.en}: ${valid.join(', ')}`);
      }
    });
    const finalRos = finalRosArray.length > 0 ? finalRosArray.join('; ') : 'None reported';

    const items = [
      { category: 'Allergies', value: finalAllergies || 'None reported' },
      { category: 'Medications', value: medications || 'None reported' },
      { category: 'Conditions', value: finalConditions || 'None reported' },
      { category: 'Surgeries', value: surgeries || 'None reported' },
      { category: 'Family History', value: finalFamily || 'None reported' },
      { category: 'Personal History', value: finalPersonal || 'None reported' },
      { category: 'Review of Systems', value: finalRos || 'None reported' }
    ];

    const payload = { session_id: session.id, items };

    try {
      if (!navigator.onLine) throw new Error('Offline');
      const res = await fetch(`${API_URL}/medical-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Server error');
    } catch {
      const queue: OfflineMedicalHistory[] = (await get(OFFLINE_MH_QUEUE_KEY)) || [];
      queue.push(payload);
      await set(OFFLINE_MH_QUEUE_KEY, queue);
    } finally {
      setIsSubmitting(false);
      setIsFinished(true);
    }
  };

  if (isFinished) {
    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative overflow-hidden font-body text-charcoal">
        <MandalaBackground />
        <QuestionCard className="w-full max-w-2xl text-center z-10 p-12">
          <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="font-display text-4xl text-charcoal mb-3">
            {t('mh.completed.title')}
          </h1>
          <p className="font-body text-lg text-muted mb-8">
            {t('mh.completed.sub')}
          </p>
          <Button
            onClick={() => navigate('/preview')}
            className="w-full min-h-[58px] text-lg rounded-[12px] bg-primary hover:bg-primary/90 text-white font-body"
          >
            {t('mh.completed.btn')}
          </Button>
          {isSyncing && (
             <p className="text-primary text-sm font-body animate-pulse mt-4">Syncing offline data...</p>
          )}
        </QuestionCard>
      </div>
    );
  }

  const getStepTitle = () => {
    switch (step) {
      case 0: return t('mh.title.0');
      case 1: return t('mh.title.1');
      case 2: return t('mh.title.2');
      case 3: return t('mh.title.3');
      case 4: return t('mh.title.4');
      case 5: return t('mh.title.5');
      case 6: return t('mh.title.6');
      default: return '';
    }
  };

  const getStepHint = () => {
    switch (step) {
      case 0: return t('mh.hint.0');
      case 1: return t('mh.hint.1');
      case 2: return t('mh.hint.2');
      case 3: return t('mh.hint.3');
      case 4: return t('mh.hint.4');
      case 5: return t('mh.hint.5');
      case 6: return t('mh.hint.6');
      default: return '';
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col gap-3.5 mt-4">
            
            <div className="grid grid-cols-2 gap-3">
              {['Penicillin', 'Sulfa drugs', 'Peanuts', 'Dust/Pollen', 'None', 'Other'].map(item => (
                <button
                  key={item}
                  onClick={() => toggleSelection(item, allergies, setAllergies)}
                  className={cn(
                    "min-h-[58px] px-4 py-3 flex items-center justify-center text-center",
                    "bg-white border-2 rounded-xl transition-all duration-300 font-body text-base font-semibold",
                    allergies.includes(item)
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-warmgray text-charcoal hover:border-primary/40 hover:bg-sand/30"
                  )}
                >
                  {getOptionLabel(item)}
                </button>
              ))}
            </div>

            {allergies.includes('Other') && (
              <input
                type="text"
                value={otherAllergy}
                onChange={e => setOtherAllergy(e.target.value)}
                placeholder={t('mh.other.specify')}
                className="w-full text-center text-base p-3.5 mt-1 border-2 border-primary/40 rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
        );
      case 1:
        return (
          <div className="flex flex-col gap-3 mt-4">
            <p className="text-muted text-xs -mt-1 font-body">
              {t('mh.meds.hint')}
            </p>
            <textarea
              value={medications}
              onChange={e => setMedications(e.target.value)}
              placeholder={t('mh.meds.placeholder')}
              className="w-full text-base p-4 min-h-[110px] border-2 border-warmgray rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        );
      case 2:
        return (
          <div className="flex flex-col gap-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              {['Diabetes', 'Hypertension (High BP)', 'Asthma', 'Thyroid', 'Heart Disease', 'None', 'Other'].map(item => (
                <button
                  key={item}
                  onClick={() => toggleSelection(item, conditions, setConditions)}
                  className={cn(
                    "min-h-[58px] px-4 py-3 flex items-center justify-center text-center",
                    "bg-white border-2 rounded-xl transition-all duration-300 font-body text-base font-semibold",
                    conditions.includes(item)
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-warmgray text-charcoal hover:border-primary/40 hover:bg-sand/30"
                  )}
                >
                  {getOptionLabel(item)}
                </button>
              ))}
            </div>

            {conditions.includes('Other') && (
              <input
                type="text"
                value={otherCondition}
                onChange={e => setOtherCondition(e.target.value)}
                placeholder={t('mh.other.specify')}
                className="w-full text-center text-base p-3.5 mt-1 border-2 border-primary/40 rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col gap-3 mt-4">
            <p className="text-muted text-xs -mt-1 font-body">
              {t('mh.surg.hint')}
            </p>
            <textarea
              value={surgeries}
              onChange={e => setSurgeries(e.target.value)}
              placeholder={t('mh.surg.placeholder')}
              className="w-full text-base p-4 min-h-[110px] border-2 border-warmgray rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col gap-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              {['Diabetes', 'Hypertension', 'Heart Disease', 'Cancer', 'Asthma', 'Stroke', 'None'].map(item => (
                <button
                  key={item}
                  onClick={() => toggleSelection(item, familyHistory, setFamilyHistory)}
                  className={cn(
                    "min-h-[58px] px-4 py-3 flex items-center justify-center text-center",
                    "bg-white border-2 rounded-xl transition-all duration-300 font-body text-base font-semibold",
                    familyHistory.includes(item)
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-warmgray text-charcoal hover:border-primary/40 hover:bg-sand/30"
                  )}
                >
                  {getOptionLabel(item)}
                </button>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="flex flex-col gap-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              {['Smoking', 'Alcohol', 'Tobacco chewing', 'Vegetarian diet', 'Non-vegetarian diet', 'Sedentary lifestyle', 'Regular exercise', 'None'].map(item => (
                <button
                  key={item}
                  onClick={() => toggleSelection(item, personalHistory, setPersonalHistory)}
                  className={cn(
                    "min-h-[58px] px-4 py-3 flex items-center justify-center text-center",
                    "bg-white border-2 rounded-xl transition-all duration-300 font-body text-base font-semibold",
                    personalHistory.includes(item)
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-warmgray text-charcoal hover:border-primary/40 hover:bg-sand/30"
                  )}
                >
                  {getOptionLabel(item)}
                </button>
              ))}
            </div>
          </div>
        );
      case 6:
        const currentSystem = ROS_SYSTEMS.find(s => s.id === activeRosTab) || ROS_SYSTEMS[0];
        const selectedSymptoms = rosSymptoms[activeRosTab] || [];
        
        return (
          <div className="flex flex-col gap-4 mt-2">
            <p className="text-muted text-xs -mt-2 font-body">
              {t('mh.ros.hint')}
            </p>
            
            {/* System Tabs */}
            <div className="flex overflow-x-auto pb-2 gap-2 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {ROS_SYSTEMS.map(sys => (
                <button
                  key={sys.id}
                  onClick={() => setActiveRosTab(sys.id)}
                  className={cn(
                    "whitespace-nowrap px-4 py-2 rounded-full font-body text-sm font-semibold transition-colors snap-start",
                    activeRosTab === sys.id
                      ? "bg-primary text-white"
                      : "bg-white text-muted border border-warmgray hover:bg-sand"
                  )}
                >
                  {isMr ? (sys.mr || sys.en) : isBn ? (sys.bn || sys.en) : isHi ? sys.hi : sys.en}
                </button>
              ))}
            </div>

            {/* Symptoms Grid */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              {currentSystem.symptoms.map(item => (
                <button
                  key={item}
                  onClick={() => {
                    setRosSymptoms(prev => {
                      const current = prev[activeRosTab] || [];
                      let newList;
                      if (item === 'None') {
                        newList = ['None'];
                      } else {
                        newList = current.filter(i => i !== 'None');
                        if (newList.includes(item)) {
                          newList = newList.filter(i => i !== item);
                        } else {
                          newList.push(item);
                        }
                      }
                      return { ...prev, [activeRosTab]: newList };
                    });
                  }}
                  className={cn(
                    "min-h-[58px] px-4 py-3 flex items-center justify-center text-center",
                    "bg-white border-2 rounded-xl transition-all duration-300 font-body text-base font-semibold",
                    selectedSymptoms.includes(item)
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-warmgray text-charcoal hover:border-primary/40 hover:bg-sand/30"
                  )}
                >
                  {getOptionLabel(item)}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const isNextDisabled = () => {
    if (step === 0) return allergies.length === 0;
    if (step === 2) return conditions.length === 0;
    if (step === 4) return familyHistory.length === 0;
    if (step === 5) return personalHistory.length === 0;
    if (step === 6) return Object.keys(rosSymptoms).length === 0;
    return false;
  };

  const stepTitle = getStepTitle();

  return (
    <div className="min-h-screen bg-sand flex flex-col pt-10 p-4 sm:p-6 pb-28 sm:pb-12 pb-[env(safe-area-inset-bottom,32px)] relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      
      <div className="w-full max-w-[768px] mx-auto flex flex-col gap-5 z-10 mb-16 sm:mb-8">
        <div className="w-full flex justify-center pb-1">
           <LeafStepIndicator total={7} current={step} />
        </div>

        <div className="w-full bg-[#f7f4ed] rounded-[28px] border border-warmgray shadow-xs p-6 sm:p-10 flex flex-col">
          
          {/* Header with Title and Speaker */}
          <div className="flex justify-between items-start mb-2 gap-4">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal leading-tight">
              {stepTitle}
            </h2>
            <button
              onClick={() => speak(stepTitle, ttsLang)}
              className="w-11 h-11 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors shrink-0"
              title="Listen to question"
            >
              {isPlaying ? <VolumeX className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          {renderStep()}

          {/* Voice ASR Input Bar */}
          <div className="flex flex-col items-center mt-6 pt-4 border-t border-warmgray/60 w-full">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startListening({ lang: ttsLang }))}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                  isListening 
                    ? 'bg-primary text-white scale-105 ring-2 ring-primary/40' 
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
                title="Speak your answer"
              >
                <Mic className="w-5 h-5" />
              </button>
              <div className="text-left">
                <p className="text-xs font-semibold text-charcoal">
                  {isListening 
                    ? (isMr ? 'ऐकत आहे...' : isBn ? 'শুনছি...' : isHi ? 'सुन रहा है...' : 'Listening...')
                    : (isMr ? 'आवाज इनपुट (ASR)' : isBn ? 'ভয়েস ইনপুট (ASR)' : isHi ? 'आवाज इनपुट (ASR)' : 'Voice Input (ASR)')}
                </p>
                <p className="text-xs text-muted">{getStepHint()}</p>
              </div>
            </div>
            {transcript && (
              <div className="flex flex-col items-center mt-2">
                <p className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                  "{transcript}"
                </p>
                {(() => {
                  const cleaned = cleanTranscript(transcript, { language: activeLang });
                  if (cleaned && cleaned !== transcript) {
                    return (
                      <p className="text-[10px] text-muted font-medium italic mt-0.5">
                        {isMr ? `संपादित: "${cleaned}"` : isBn ? `সংশোধিত: "${cleaned}"` : isHi ? `संशोधित: "${cleaned}"` : `Cleaned: "${cleaned}"`}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
          
          <div className="w-full pb-[env(safe-area-inset-bottom,24px)]">
            <Button
              id="btn-medical-next"
              onClick={handleNext}
              disabled={isNextDisabled() || isSubmitting}
              className="mt-6 w-full min-h-[56px] sm:min-h-[58px] text-lg rounded-[12px] bg-primary text-white font-body focus:outline-none focus:ring-2 focus:ring-primary hover:bg-primary/90 transition-colors shadow-md"
            >
              {isSubmitting 
                ? t('common.loading') 
                : step === 6 
                  ? t('common.submit') 
                  : t('common.continue')}
            </Button>
          </div>
        </div>
      </div>
      <VoiceGuideButton 
        clipId="medical_history"
        fallbackText={
          isMr 
            ? 'आता तुमचा मागील वैद्यकीय इतिहास आणि जुने आजार तपासा.'
            : isBn
            ? 'এখন আপনার অতীতের চিকিৎসা ইতিহাস এবং রোগ পর্যালোচনা করুন।'
            : isHi
            ? 'अब अपनी पुरानी बीमारियों और मेडिकल इतिहास की समीक्षा करें।'
            : 'Now let us review your past medical history and conditions.'
        } 
        language={ttsLang} 
      />
    </div>
  );
}

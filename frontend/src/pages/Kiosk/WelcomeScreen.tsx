import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { MandalaBackground } from '../../components/MandalaBackground';
import { MediKioskLogo } from '../../components/MediKioskLogo';
import { AccessibilityToggle } from '../../components/AccessibilityToggle';
import { useAsr } from '../../hooks/useAsr';
import { useVoiceGuidance } from '../../hooks/useVoiceGuidance';
import { Mic, Volume2 } from 'lucide-react';

const WELCOME_TTS = {
  en: 'Welcome to MediKiosk. Please tap your preferred language to begin.',
  hi: 'मेडीकियोस्क में आपका स्वागत है। कृपया अपनी पसंदीदा भाषा चुनें।',
  mr: 'MediKiosk मध्ये आपले स्वागत आहे. कृपया तुमची भाषा निवडा.',
  bn: 'MediKiosk-এ আপনাকে স্বাগতম। অনুগ্রহ করে আপনার পছন্দের ভাষা নির্বাচন করুন।',
};

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { hospitalId } = useParams();
  const { isListening, transcript, startListening, stopListening } = useAsr();
  const { speak } = useVoiceGuidance();

  const [voiceFailCount, setVoiceFailCount] = React.useState(0);
  const prevListeningRef = React.useRef(false);
  const hasAutoPlayedRef = React.useRef(false);

  // Auto-play multilingual welcome greeting once on mount
  useEffect(() => {
    if (hasAutoPlayedRef.current) return;
    hasAutoPlayedRef.current = true;
    const timer = setTimeout(() => {
      const muted =
        localStorage.getItem('voice_muted') === 'true' ||
        localStorage.getItem('kiosk_muted') === 'true' ||
        localStorage.getItem('voice_assist_muted') === 'true';
      if (!muted) {
        speak({ fallbackText: WELCOME_TTS.en, language: 'en-IN' }).catch(() => {});
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [speak]);

  // Voice language selection on WelcomeScreen — match on interim transcripts
  useEffect(() => {
    if (!transcript) return;
    const lower = transcript.toLowerCase().trim();
    if (lower.includes('hindi') || lower.includes('हिंदी') || lower.includes('हिन्दी')) {
      setVoiceFailCount(0);
      stopListening();
      handleStart('hi');
    } else if (lower.includes('english') || lower.includes('अंग्रेजी') || lower.includes('अंग्रेज़ी') || lower.includes('start')) {
      setVoiceFailCount(0);
      stopListening();
      handleStart('en');
    } else if (lower.includes('marathi') || lower.includes('मराठी') || lower.includes('marata') || lower.includes('maratha')) {
      setVoiceFailCount(0);
      stopListening();
      handleStart('mr');
    } else if (lower.includes('bengali') || lower.includes('bangla') || lower.includes('বাংলা') || lower.includes('बंगाली') || lower.includes('বাঙলা')) {
      setVoiceFailCount(0);
      stopListening();
      handleStart('bn');
    }
  }, [transcript, stopListening]);

  useEffect(() => {
    if (prevListeningRef.current && !isListening) {
      if (transcript && transcript.trim().length > 0) {
        const lower = transcript.toLowerCase().trim();
        const matched = lower.includes('hindi') || lower.includes('हिंदी') || lower.includes('हिन्दी') ||
          lower.includes('english') || lower.includes('अंग्रेजी') || lower.includes('अंग्रेज़ी') || lower.includes('start') ||
          lower.includes('marathi') || lower.includes('मराठी') || lower.includes('marata') || lower.includes('maratha') ||
          lower.includes('bengali') || lower.includes('bangla') || lower.includes('বাংলা') || lower.includes('बंगाली') || lower.includes('বাঙলা');
        if (!matched) {
          setVoiceFailCount(c => c + 1);
        }
      }
    }
    prevListeningRef.current = isListening;
  }, [isListening, transcript]);

  // Clear all kiosk session and patient state when landing on welcome screen
  useEffect(() => {
    const kioskKeys = [
      'patient_session', 'session_id', 'chief_complaint', 'patient_complaint',
      'patient_name', 'patient_age', 'patient_gender', 'patient_phone',
      'patient_language', 'ayush_mode'
    ];
    kioskKeys.forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
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
  }, []);

  const handleStart = (lang: string) => {
    localStorage.setItem('patient_language', lang);
    if (hospitalId) {
      navigate(`/hospital/${hospitalId}/notice?lang=${lang}`);
    } else {
      navigate(`/notice?lang=${lang}`);
    }
  };

  const handleVoiceAssist = () => {
    // Play a combined multilingual greeting
    speak({ fallbackText: WELCOME_TTS.en, language: 'en-IN' }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-sand flex flex-col relative overflow-hidden font-body selection:bg-primary/20">
      <MandalaBackground />
      
      {/* Top Bar for Accessibility */}
      <div className="absolute top-0 right-0 p-3 sm:p-4 z-50 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handleVoiceAssist}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-all"
          aria-label="Listen to instructions"
        >
          <Volume2 className="w-4 h-4" />
          <span className="hidden sm:inline">Voice Assist</span>
        </button>
        <AccessibilityToggle />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 z-10 min-h-screen">
        <div className="w-full max-w-sm sm:max-w-[480px] flex flex-col items-center text-center space-y-6 sm:space-y-8">
          
          <div className="welcome-scale-fade">
            <MediKioskLogo className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 mx-auto drop-shadow-xl" />
          </div>
          
          <div className="space-y-2">
            <h1
              className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-charcoal tracking-tight welcome-rise-fade"
              style={{ animationDelay: '150ms', '--rise-dist': '12px' } as React.CSSProperties}
            >
              MediKiosk
            </h1>
            <p
              className="font-body text-base sm:text-xl md:text-2xl text-muted font-medium welcome-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              Your Health, Your Story
            </p>
            {/* Multilingual taglines */}
            <p
              className="font-body text-sm sm:text-base text-muted/70 welcome-fade-in"
              style={{ animationDelay: '450ms' }}
            >
              आपका स्वास्थ्य, आपकी कहानी &nbsp;•&nbsp; তোমার স্বাস্থ্য, তোমার গল্প
            </p>
          </div>

          {/* Language Selection Buttons */}
          <div
            className="w-full pt-2 space-y-3 welcome-rise-fade"
            style={{ animationDelay: '500ms', animationDuration: '300ms', '--rise-dist': '8px' } as React.CSSProperties}
          >
            {/* Primary row */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button 
                id="lang-btn-hi"
                className="w-full min-h-[56px] sm:min-h-[64px] text-base sm:text-lg rounded-[14px] bg-primary hover:bg-primary/90 text-white font-body shadow-md border-2 border-primary active:scale-95 transition-transform"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('hi');
                }}
                aria-label="Start Kiosk Session in Hindi"
              >
                हिंदी
                <span className="block text-[10px] sm:text-xs opacity-80 font-normal">Hindi</span>
              </Button>
              <Button 
                id="lang-btn-en"
                className="w-full min-h-[56px] sm:min-h-[64px] text-base sm:text-lg rounded-[14px] bg-white text-primary hover:bg-primary/5 font-body shadow-xs border-2 border-primary active:scale-95 transition-transform"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('en');
                }}
                aria-label="Start Kiosk Session in English"
              >
                English
                <span className="block text-[10px] sm:text-xs opacity-60 font-normal">अंग्रेजी</span>
              </Button>
            </div>
            {/* Secondary row */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button 
                id="lang-btn-mr"
                className="w-full min-h-[52px] sm:min-h-[60px] text-sm sm:text-base rounded-[14px] bg-white text-primary hover:bg-primary/5 font-body shadow-xs border-2 border-primary/50 active:scale-95 transition-transform"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('mr');
                }}
                aria-label="Start Kiosk Session in Marathi"
              >
                मराठी
                <span className="block text-[10px] sm:text-xs opacity-60 font-normal">Marathi</span>
              </Button>
              <Button 
                id="lang-btn-bn"
                className="w-full min-h-[52px] sm:min-h-[60px] text-sm sm:text-base rounded-[14px] bg-white text-primary hover:bg-primary/5 font-body shadow-xs border-2 border-primary/50 active:scale-95 transition-transform"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('bn');
                }}
                aria-label="Start Kiosk Session in Bengali"
              >
                বাংলা
                <span className="block text-[10px] sm:text-xs opacity-60 font-normal">Bengali</span>
              </Button>
            </div>

            {voiceFailCount >= 2 && (
              <div className="text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-sm font-semibold animate-in fade-in">
                Voice not recognized. Please tap your choice above.
              </div>
            )}

            {/* Voice mic row */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => isListening ? stopListening() : startListening({ lang: 'hi-IN' })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-primary text-white ring-2 ring-primary/40 animate-pulse border-transparent'
                    : 'bg-white text-primary border-primary/30 hover:bg-primary/5'
                }`}
                aria-label="Speak preferred language"
              >
                <Mic className="w-4 h-4" />
                <span>
                  {isListening
                    ? 'Listening… Say "English", "हिंदी", "मराठी" or "বাংলা"'
                    : 'Tap to speak language / भाषा बोलें'}
                </span>
              </button>
            </div>
          </div>

        </div>
      </main>
      
      <footer className="relative bottom-0 w-full text-center z-10 pb-4 opacity-60">
        <p className="text-xs font-semibold text-charcoal">Secure & Confidential • Powered by Swasthya Network</p>
      </footer>
    </div>
  );
}

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { MandalaBackground } from '../../components/MandalaBackground';
import { MediKioskLogo } from '../../components/MediKioskLogo';
import { AccessibilityToggle } from '../../components/AccessibilityToggle';
import { VoiceGuidanceButton } from '../../components/VoiceGuidanceButton';
import { useAsr } from '../../hooks/useAsr';
import { Mic } from 'lucide-react';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { hospitalId } = useParams();
  const { isListening, transcript, startListening, stopListening } = useAsr();

  const [voiceFailCount, setVoiceFailCount] = React.useState(0);
  const prevListeningRef = React.useRef(false);

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

  return (
    <div className="min-h-screen bg-sand flex flex-col relative overflow-hidden font-body selection:bg-primary/20">
      <MandalaBackground />
      
      {/* Top Bar for Accessibility */}
      <div className="absolute top-0 right-0 p-4 z-50 flex items-center gap-3">
        <VoiceGuidanceButton variant="inline" clipId="welcome" fallbackText="Welcome to MediKiosk. Please select your preferred language to begin." />
        <AccessibilityToggle />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="w-full max-w-[768px] flex flex-col items-center text-center space-y-8">
          
          <div className="mb-4 welcome-scale-fade">
            <MediKioskLogo className="w-32 h-32 md:w-40 md:h-40 mx-auto drop-shadow-xl" />
          </div>
          
          <div className="space-y-3">
            <h1
              className="font-display text-5xl md:text-7xl font-bold text-charcoal tracking-tight welcome-rise-fade"
              style={{ animationDelay: '150ms', '--rise-dist': '12px' } as React.CSSProperties}
            >
              MediKiosk
            </h1>
            <p
              className="font-body text-xl md:text-2xl text-muted font-medium welcome-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              Your Health, Your Story
            </p>
          </div>

          <div
            className="w-full max-w-md pt-8 space-y-4 welcome-rise-fade"
            style={{ animationDelay: '500ms', animationDuration: '300ms', '--rise-dist': '8px' } as React.CSSProperties}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <Button 
                id="lang-btn-hi"
                className="w-full min-h-[56px] text-lg rounded-[14px] bg-primary hover:bg-primary/90 text-white font-body shadow-md border-2 border-primary"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('hi');
                }}
                aria-label="Start Kiosk Session in Hindi"
              >
                हिंदी (Hindi)
              </Button>
              <Button 
                id="lang-btn-en"
                className="w-full min-h-[56px] text-lg rounded-[14px] bg-white text-primary hover:bg-primary/5 font-body shadow-xs border-2 border-primary"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('en');
                }}
                aria-label="Start Kiosk Session in English"
              >
                English
              </Button>
              <Button 
                id="lang-btn-mr"
                className="w-full min-h-[56px] text-lg rounded-[14px] bg-white text-primary hover:bg-primary/5 font-body shadow-xs border-2 border-primary/40"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('mr');
                }}
                aria-label="Start Kiosk Session in Marathi"
              >
                मराठी (Marathi)
              </Button>
              <Button 
                id="lang-btn-bn"
                className="w-full min-h-[56px] text-lg rounded-[14px] bg-white text-primary hover:bg-primary/5 font-body shadow-xs border-2 border-primary/40"
                onClick={() => {
                  setVoiceFailCount(0);
                  handleStart('bn');
                }}
                aria-label="Start Kiosk Session in Bengali"
              >
                বাংলা (Bengali)
              </Button>
            </div>
            {voiceFailCount >= 2 && (
              <div className="text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-sm font-semibold mt-2 animate-in fade-in">
                Voice not recognized. Please tap your choice.
              </div>
            )}
            <p className="text-sm text-muted mt-4 font-medium opacity-80">
              Tap your preferred language to begin
            </p>
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => isListening ? stopListening() : startListening({ lang: 'hi-IN' })}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  isListening ? 'bg-primary text-white ring-2 ring-primary/40 animate-pulse' : 'bg-white text-primary border-primary/30 hover:bg-primary/5'
                }`}
                aria-label="Speak preferred language"
              >
                <Mic className="w-4 h-4" />
                <span>{isListening ? 'Listening… (Say "English", "हिंदी", "मराठी", or "বাংলা")' : 'Tap to speak language'}</span>
              </button>
            </div>
          </div>

        </div>
      </main>
      
      <footer className="absolute bottom-4 w-full text-center z-10 opacity-60">
        <p className="text-xs font-semibold text-charcoal">Secure & Confidential • Powered by Swasthya Network</p>
      </footer>

      <VoiceGuidanceButton clipId="welcome" fallbackText="Welcome to MediKiosk. Please select your preferred language to begin." />
    </div>
  );
}

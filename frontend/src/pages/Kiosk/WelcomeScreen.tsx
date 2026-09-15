import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { MandalaBackground } from '../../components/MandalaBackground';
import { MediKioskLogo } from '../../components/MediKioskLogo';
import { AccessibilityToggle } from '../../components/AccessibilityToggle';
import { VoiceGuidanceButton } from '../../components/VoiceGuidanceButton';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { hospitalId } = useParams();

  // Clear any existing session data when landing on the welcome screen
  useEffect(() => {
    localStorage.removeItem('patient_session');
    localStorage.removeItem('session_id');
    localStorage.removeItem('chief_complaint');
    localStorage.removeItem('patient_language');
    localStorage.removeItem('ayush_mode');
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
        <VoiceGuidanceButton text="Welcome to MediKiosk. Please select your preferred language to begin." />
        <AccessibilityToggle />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="w-full max-w-[768px] flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="mb-4">
            <MediKioskLogo className="w-32 h-32 md:w-40 md:h-40 mx-auto drop-shadow-xl" />
          </div>
          
          <div className="space-y-3">
            <h1 className="font-display text-5xl md:text-7xl font-bold text-charcoal tracking-tight">
              MediKiosk
            </h1>
            <p className="font-body text-xl md:text-2xl text-muted font-medium">
              Your Health, Your Story
            </p>
          </div>

          <div className="w-full max-w-sm pt-8 space-y-4">
            <Button 
              className="w-full min-h-[64px] text-xl rounded-[16px] bg-primary hover:bg-primary/90 text-white font-body shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-primary"
              onClick={() => handleStart('hi')}
              aria-label="Start Kiosk Session in Hindi"
            >
              हिंदी में शुरू करें
            </Button>
            <Button 
              className="w-full min-h-[64px] text-xl rounded-[16px] bg-white text-primary hover:bg-primary/5 font-body shadow-sm transition-all duration-300 border-2 border-primary"
              onClick={() => handleStart('en')}
              aria-label="Start Kiosk Session in English"
            >
              Start in English
            </Button>
            <p className="text-sm text-muted mt-4 font-medium opacity-80">
              Tap your preferred language to begin
            </p>
          </div>

        </div>
      </main>
      
      <footer className="absolute bottom-4 w-full text-center z-10 opacity-60">
        <p className="text-xs font-semibold text-charcoal">Secure & Confidential • Powered by Swasthya Network</p>
      </footer>
    </div>
  );
}

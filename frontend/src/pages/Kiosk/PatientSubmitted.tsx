import React, { useState, useEffect } from 'react';
import { CheckCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MandalaBackground } from '../../components/MandalaBackground';
import { VoiceGuideButton } from '../../components/VoiceGuideButton';

export default function PatientSubmitted() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(30);

  // Auto-redirect after 30 seconds
  useEffect(() => {
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
      <div className="w-full max-w-2xl z-10 flex flex-col items-center text-center bg-white p-12 rounded-[24px] shadow-xl border-2 border-primary/20">
        <CheckCircle className="w-24 h-24 text-primary mb-8" />
        <h1 className="text-4xl font-display font-bold text-charcoal mb-6">
          Thank you!
        </h1>
        <p className="text-2xl text-muted font-semibold mb-8">
          Your information has been successfully submitted. Please wait for the doctor.
        </p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-semibold text-lg rounded-xl shadow-md hover:bg-primary/90 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          Finish & Logout
        </button>
        <p className="text-xs text-muted mt-3">Auto-redirecting in {countdown}s</p>
      </div>
      <VoiceGuideButton
        clipId="submitted"
        fallbackText="Your health assessment has been submitted successfully. Please wait for the doctor."
      />
    </div>
  );
}

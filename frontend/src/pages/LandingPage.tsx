import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, User, ShieldCheck, ArrowRight, Activity, Sparkles, Building2, Globe2 } from 'lucide-react';
import { MediKioskLogo } from '../components/MediKioskLogo';
import { MandalaBackground } from '../components/MandalaBackground';
import { AccessibilityToggle } from '../components/AccessibilityToggle';
import { VoiceGuideButton } from '../components/VoiceGuideButton';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-sand text-charcoal flex flex-col justify-between relative overflow-hidden font-body selection:bg-primary/20">
      <MandalaBackground />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MediKioskLogo className="w-10 h-10 drop-shadow-sm" />
          <span className="font-display font-bold text-xl text-primary tracking-tight">MediKiosk</span>
        </div>
        <div className="flex items-center gap-3">
          <AccessibilityToggle />
        </div>
      </header>

      {/* Hero Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <Sparkles className="w-4 h-4 text-terracotta" />
          <span>Next-Generation OPD Intake &amp; Triage</span>
        </div>

        {/* Logo and Headings */}
        <div className="mb-6 animate-in fade-in zoom-in-95 duration-700">
          <MediKioskLogo className="w-28 h-28 md:w-36 md:h-36 mx-auto drop-shadow-xl" />
        </div>

        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold text-charcoal tracking-tight mb-4 leading-tight">
          MediKiosk
        </h1>

        <p className="font-body text-xl sm:text-2xl md:text-3xl text-muted font-medium max-w-2xl mx-auto mb-10 leading-snug">
          AI-Assisted Clinical History for Indian OPDs
        </p>

        {/* Action Buttons */}
        <div className="w-full max-w-md flex flex-col gap-4 mb-12">
          {/* Big Primary Button */}
          <button
            onClick={() => navigate('/hospital/demo/kiosk')}
            className="group w-full min-h-[68px] px-8 py-4 bg-primary hover:bg-[#154a3a] text-white rounded-2xl font-bold text-xl md:text-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3 border-2 border-primary focus:outline-none focus:ring-4 focus:ring-primary/30"
            aria-label="Enter Patient Kiosk"
          >
            <User className="w-7 h-7 text-sand group-hover:scale-110 transition-transform" />
            <span>Enter Patient Kiosk</span>
            <ArrowRight className="w-6 h-6 text-sand/80 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary Button */}
          <button
            onClick={() => navigate('/doctor/login')}
            className="group w-full min-h-[58px] px-6 py-3.5 bg-white/90 hover:bg-white text-charcoal hover:text-primary rounded-2xl font-semibold text-lg md:text-xl shadow-md hover:shadow-lg border-2 border-warmgray hover:border-primary/40 transition-all duration-300 flex items-center justify-center gap-3 focus:outline-none focus:ring-4 focus:ring-primary/20"
            aria-label="Doctor Login"
          >
            <Stethoscope className="w-6 h-6 text-primary group-hover:rotate-12 transition-transform" />
            <span>Doctor Login</span>
          </button>
        </div>

        {/* Highlights / Features Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl text-left">
          <div className="bg-white/70 backdrop-blur-sm border border-warmgray/70 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
              <Globe2 className="w-4 h-4 text-terracotta" />
              <span>Multilingual</span>
            </div>
            <p className="text-xs text-muted">Voice &amp; touch interview in English, Hindi, and regional languages.</p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm border border-warmgray/70 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
              <Activity className="w-4 h-4 text-terracotta" />
              <span>Dual Triage</span>
            </div>
            <p className="text-xs text-muted">Seamless Allopathic red-flag triage paired with AYUSH Prakriti profiling.</p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm border border-warmgray/70 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
              <ShieldCheck className="w-4 h-4 text-terracotta" />
              <span>ABDM &amp; DPDP Ready</span>
            </div>
            <p className="text-xs text-muted">Zero unauthorized data retention, FHIR structured clinical summary.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-warmgray/80 bg-sand/80 backdrop-blur-sm py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} MediKiosk Systems. Swasthya Architecture.</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/admin/hospitals')}
              className="inline-flex items-center gap-1.5 text-primary hover:text-[#154a3a] font-semibold underline underline-offset-4 hover:no-underline transition-colors"
              aria-label="Hospital Admin"
            >
              <Building2 className="w-4 h-4" />
              <span>Hospital Admin</span>
            </button>
          </div>
        </div>
      </footer>

      <VoiceGuideButton clipId="welcome" fallbackText="Welcome to MediKiosk. AI-Assisted Clinical History for Indian OPDs. Please enter the Patient Kiosk to begin." />
    </div>
  );
}

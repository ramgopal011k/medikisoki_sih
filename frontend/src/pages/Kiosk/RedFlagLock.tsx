import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { MandalaBackground } from '../../components/MandalaBackground';
import { VoiceGuideButton } from '../../components/VoiceGuideButton';

export default function RedFlagLock() {
  return (
    <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-body">
      <MandalaBackground />
      <div className="w-full max-w-2xl z-10 flex flex-col items-center text-center bg-white p-12 rounded-[24px] shadow-2xl border-4 border-red-500">
        <AlertTriangle className="w-24 h-24 text-red-600 mb-8 animate-pulse" />
        <h1 className="text-4xl font-display font-bold text-red-700 mb-6">
          Important information has been identified.
        </h1>
        <p className="text-2xl text-charcoal font-semibold">
          Please notify hospital staff or wait for assistance.
        </p>
      </div>

      <VoiceGuideButton clipId="red_flag_message" fallbackText="Important information has been identified. Please notify hospital staff or wait for assistance." />
    </div>
  );
}

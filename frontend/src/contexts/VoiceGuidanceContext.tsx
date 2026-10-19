import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface VoiceGuidanceContextType {
  isVoiceAssistEnabled: boolean;
  setVoiceAssistEnabled: (enabled: boolean) => void;
  toggleVoiceAssist: () => boolean;
}

const VoiceGuidanceContext = createContext<VoiceGuidanceContextType | undefined>(undefined);

export function VoiceGuidanceProvider({ children }: { children: React.ReactNode }) {
  const [isVoiceAssistEnabled, setIsVoiceAssistEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('kiosk_voice_guidance') === 'true';
  });

  const setVoiceAssistEnabled = useCallback((enabled: boolean) => {
    setIsVoiceAssistEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiosk_voice_guidance', String(enabled));
    }
  }, []);

  const toggleVoiceAssist = useCallback(() => {
    let nextVal = false;
    setIsVoiceAssistEnabledState(prev => {
      nextVal = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('kiosk_voice_guidance', String(nextVal));
      }
      return nextVal;
    });
    return nextVal;
  }, []);

  // Listen for storage events across tabs/windows or local updates
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'kiosk_voice_guidance') {
        setIsVoiceAssistEnabledState(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <VoiceGuidanceContext.Provider
      value={{
        isVoiceAssistEnabled,
        setVoiceAssistEnabled,
        toggleVoiceAssist,
      }}
    >
      {children}
    </VoiceGuidanceContext.Provider>
  );
}

export function useVoiceGuidanceContext() {
  const context = useContext(VoiceGuidanceContext);
  if (!context) {
    const enabled = typeof window !== 'undefined' && localStorage.getItem('kiosk_voice_guidance') === 'true';
    return {
      isVoiceAssistEnabled: enabled,
      setVoiceAssistEnabled: (val: boolean) => {
        if (typeof window !== 'undefined') localStorage.setItem('kiosk_voice_guidance', String(val));
      },
      toggleVoiceAssist: () => {
        const next = !enabled;
        if (typeof window !== 'undefined') localStorage.setItem('kiosk_voice_guidance', String(next));
        return next;
      }
    };
  }
  return context;
}

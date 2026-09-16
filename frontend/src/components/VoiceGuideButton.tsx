import React, { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';

export interface VoiceGuideButtonProps {
  clipId?: string;
  fallbackText?: string;
  text?: string; // backward compatibility alias for fallbackText
  language?: string;
  className?: string;
  variant?: 'floating' | 'inline';
}

export const VoiceGuideButton: React.FC<VoiceGuideButtonProps> = ({
  clipId,
  fallbackText,
  text,
  language = 'en',
  className = '',
  variant = 'floating',
}) => {
  const [loading, setLoading] = useState(false);
  const { speak } = useVoiceGuidance();

  const isHindi = language.startsWith('hi');
  const targetText = fallbackText || text || '';

  const handleListen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      await speak({
        clipId,
        fallbackText: targetText,
        language
      });
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleListen}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-all shadow-xs hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
        title="Listen to instructions"
        aria-label="Listen to instructions"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
        <span>{isHindi ? 'निर्देश सुनें' : 'Listen'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleListen}
      disabled={loading}
      className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
      title="Listen to page instructions"
      aria-label="Listen to page instructions"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
      <span className="text-xs font-bold font-body tracking-wide">
        {isHindi ? 'निर्देश सुनें (Voice Assist)' : 'Voice Assist'}
      </span>
    </button>
  );
};

export const VoiceGuidanceButton = VoiceGuideButton;

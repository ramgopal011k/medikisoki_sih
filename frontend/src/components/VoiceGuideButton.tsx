import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
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
  const [clipPlaying, setClipPlaying] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const { speak, stop, isPlaying } = useVoiceGuidance();

  const isHi = language.startsWith('hi');
  const isMr = language.startsWith('mr');
  const isBn = language.startsWith('bn');
  const targetText = fallbackText || text || '';

  const isCurrentlyPlaying = isPlaying || clipPlaying;

  const stopAllAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    stop();
    setClipPlaying(false);
  };

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    // Toggle behavior: if already playing, stop audio immediately
    if (isCurrentlyPlaying) {
      stopAllAudio();
      return;
    }

    setLoading(true);
    try {
      // Pre-recorded clips exist for hi and en; for mr and bn use direct TTS
      if (clipId && (isHi || (!isMr && !isBn))) {
        try {
          const audio = new Audio(`/audio/v1/${isHi ? 'hi' : 'en'}/${clipId}.mp3`);
          activeAudioRef.current = audio;
          setClipPlaying(true);

          audio.onended = () => {
            setClipPlaying(false);
            activeAudioRef.current = null;
          };
          audio.onerror = async () => {
            setClipPlaying(false);
            activeAudioRef.current = null;
            await speak({
              clipId,
              fallbackText: targetText,
              language
            });
          };

          await audio.play();
          return;
        } catch {
          setClipPlaying(false);
          activeAudioRef.current = null;
          // fallback to tts
        }
      }

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
        onClick={handleToggle}
        disabled={loading}
        className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold transition-all shadow-xs hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          isCurrentlyPlaying
            ? 'bg-terracotta text-white border-terracotta/40'
            : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20'
        } ${className}`}
        title={isCurrentlyPlaying ? 'Stop instructions' : 'Listen to instructions'}
        aria-label={isCurrentlyPlaying ? 'Stop instructions' : 'Listen to instructions'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isCurrentlyPlaying ? (
          <Square className="w-3.5 h-3.5 fill-current shrink-0" />
        ) : (
          <Volume2 className="w-4 h-4 shrink-0" />
        )}
        <span>
          {isCurrentlyPlaying
            ? (isMr ? 'थांबवा' : isBn ? 'থামুন' : isHi ? 'रोकें' : 'Stop')
            : (isMr ? 'सूचना ऐका' : isBn ? 'নির্দেশনা শুনুন' : isHi ? 'निर्देश सुनें' : 'Listen')}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`group fixed top-3 right-3 sm:top-4 sm:right-4 z-40 min-h-[40px] px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border shadow-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        isCurrentlyPlaying
          ? 'bg-terracotta text-white border-terracotta/40 shadow-lg shadow-terracotta/20 animate-pulse'
          : 'bg-white/95 backdrop-blur-sm text-charcoal border-warmgray/80 hover:border-primary/40 hover:bg-white shadow-xs'
      } ${className}`}
      title={isCurrentlyPlaying ? 'Stop voice instructions' : 'Listen to page instructions'}
      aria-label={isCurrentlyPlaying ? 'Stop voice instructions' : 'Listen to page instructions'}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      ) : isCurrentlyPlaying ? (
        <Square className="w-3.5 h-3.5 fill-current shrink-0" />
      ) : (
        <Volume2 className="w-4 h-4 text-primary group-hover:scale-110 transition-transform shrink-0" />
      )}
      <span className="text-xs font-semibold font-body tracking-wide whitespace-nowrap">
        {isCurrentlyPlaying
          ? (isMr ? 'थांबवा' : isBn ? 'থামুন' : isHi ? 'रोकें' : 'Stop')
          : (isMr ? 'आवाज (Voice)' : isBn ? 'ভয়েস (Voice)' : isHi ? 'आवाज (Voice)' : 'Voice Assist')}
      </span>
    </button>
  );
};

export const VoiceGuidanceButton = VoiceGuideButton;

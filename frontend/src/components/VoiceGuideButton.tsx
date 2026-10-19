import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useVoiceGuidanceContext } from '@/contexts/VoiceGuidanceContext';

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
  const lastPlayedKeyRef = useRef<string | null>(null);

  const { speak, stop, isPlaying } = useVoiceGuidance();
  const { isVoiceAssistEnabled, setVoiceAssistEnabled } = useVoiceGuidanceContext();

  const isHi = language.startsWith('hi');
  const isMr = language.startsWith('mr');
  const isBn = language.startsWith('bn');
  const targetText = fallbackText || text || '';

  const isCurrentlyPlaying = isPlaying || clipPlaying;

  const stopAllAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    stop();
    setClipPlaying(false);
  }, [stop]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current = null;
      }
      stop();
    };
  }, [stop]);

  const playInstructions = useCallback(async () => {
    if (!targetText && !clipId) return;
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
              language,
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
        language,
      });
    } finally {
      setLoading(false);
    }
  }, [clipId, targetText, isHi, isMr, isBn, language, speak]);

  // Global persistence: when a new page loads (or step/clipId changes), if voice assist is enabled, auto-play
  useEffect(() => {
    const key = `${clipId || ''}_${targetText || ''}_${language || ''}`;
    if (isVoiceAssistEnabled && key && lastPlayedKeyRef.current !== key) {
      lastPlayedKeyRef.current = key;
      const timer = setTimeout(() => {
        playInstructions().catch(() => {});
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isVoiceAssistEnabled, clipId, targetText, language, playInstructions]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    // Toggle behavior: if already playing, stop audio and turn off global persistence
    if (isCurrentlyPlaying) {
      stopAllAudio();
      setVoiceAssistEnabled(false);
      return;
    }

    // Turn ON global Voice Assist persistence and speak
    setVoiceAssistEnabled(true);
    await playInstructions();
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
            : isVoiceAssistEnabled
            ? 'bg-primary/20 text-primary border-primary/40 shadow-xs'
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
            : isVoiceAssistEnabled
            ? (isMr ? 'आवाज (सुरू)' : isBn ? 'ভয়েস (চালু)' : isHi ? 'आवाज (चालू)' : 'Voice Assist (ON)')
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
          : isVoiceAssistEnabled
          ? 'bg-primary/15 text-primary border-primary/40 shadow-xs'
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
          : isVoiceAssistEnabled
          ? (isMr ? 'आवाज (सुरू)' : isBn ? 'ভয়েস (चालু)' : isHi ? 'आवाज (चालू)' : 'Voice Assist (ON)')
          : (isMr ? 'आवाज (Voice)' : isBn ? 'ভয়েস (Voice)' : isHi ? 'आवाज (Voice)' : 'Voice Assist')}
      </span>
    </button>
  );
};

export const VoiceGuidanceButton = VoiceGuideButton;

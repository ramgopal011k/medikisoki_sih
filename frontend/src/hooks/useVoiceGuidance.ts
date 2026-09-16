import { useState, useCallback, useRef, useEffect } from 'react';

export interface SpeakOptions {
  clipId?: string;
  fallbackText?: string;
  language?: string;
}

const audioCache = new Map<string, HTMLAudioElement>();

function getCachedAudio(path: string): HTMLAudioElement {
  let audio = audioCache.get(path);
  if (!audio) {
    audio = new Audio(path);
    audio.preload = 'auto';
    audioCache.set(path, audio);
  } else {
    audio.currentTime = 0;
  }
  return audio;
}

export function useVoiceGuidance() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, []);

  const playFallbackWebSpeech = useCallback((text: string, lang: string) => {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsPlaying(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      setIsPlaying(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[voiceGuidance] Browser WebSpeech fallback notice:', err);
      setIsPlaying(false);
    }
  }, []);

  const speak = useCallback(
    async (optionsOrText: SpeakOptions | string, langOverride?: string, clipIdParam?: string) => {
      stop();

      let clipId = '';
      let fallbackText = '';
      let language = 'en';

      if (typeof optionsOrText === 'string') {
        clipId = clipIdParam || '';
        fallbackText = optionsOrText;
        language = langOverride || 'en';
      } else {
        clipId = optionsOrText.clipId || '';
        fallbackText = optionsOrText.fallbackText || '';
        language = optionsOrText.language || langOverride || 'en';
      }

      const langFolder = language.toLowerCase().startsWith('hi') ? 'hi' : 'en';
      const bLang = language.toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN';

      // Path A: Static prompt clip from /audio/v1/{lang}/{clipId}.mp3
      if (clipId) {
        const audioPath = `/audio/v1/${langFolder}/${clipId}.mp3`;
        try {
          const audio = getCachedAudio(audioPath);
          audioRef.current = audio;
          setIsPlaying(true);

          audio.onended = () => {
            setIsPlaying(false);
            audioRef.current = null;
          };

          audio.onerror = (e) => {
            console.warn(`[voiceGuidance] Falling back for clip ${clipId} to WebSpeech:`, e);
            setIsPlaying(false);
            audioRef.current = null;
            playFallbackWebSpeech(fallbackText, bLang);
          };

          await audio.play();
          return;
        } catch (err) {
          console.warn(`[voiceGuidance] Could not play static audio clip ${clipId}, falling back:`, err);
          playFallbackWebSpeech(fallbackText, bLang);
          return;
        }
      }

      // Path B: Dynamic content fallback
      playFallbackWebSpeech(fallbackText, bLang);
    },
    [stop, playFallbackWebSpeech]
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { speak, stop, isPlaying };
}

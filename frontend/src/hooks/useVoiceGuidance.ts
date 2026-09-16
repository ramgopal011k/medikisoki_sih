import { useState, useCallback, useRef, useEffect } from 'react';
import { API_URL } from '@/lib/api';

export interface SpeakOptions {
  clipId?: string;
  fallbackText?: string;
  text?: string;
  language?: string;
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
      console.warn('[voiceGuidance] WebSpeech fallback error:', err);
      setIsPlaying(false);
    }
  }, []);

  const speak = useCallback(
    async (optionsOrText: SpeakOptions | string, langOverride?: string, clipIdParam?: string) => {
      stop();

      let targetText = '';
      let language = 'en';

      if (typeof optionsOrText === 'string') {
        targetText = optionsOrText;
        language = langOverride || 'en';
      } else {
        targetText = optionsOrText.fallbackText || optionsOrText.text || '';
        language = optionsOrText.language || langOverride || 'en';
      }

      if (!targetText) {
        return;
      }

      const isHindi = language.toLowerCase().startsWith('hi');
      const sarvamLang = isHindi ? 'hi-IN' : 'en-IN';
      const webSpeechLang = isHindi ? 'hi-IN' : 'en-IN';

      setIsPlaying(true);

      // Try Sarvam TTS via backend endpoint
      try {
        const response = await fetch(`${API_URL}/api/sarvam/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: targetText,
            language: sarvamLang
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audios && data.audios[0]) {
            const audioSrc = `data:audio/wav;base64,${data.audios[0]}`;
            const audio = new Audio(audioSrc);
            audioRef.current = audio;

            audio.onended = () => {
              setIsPlaying(false);
              audioRef.current = null;
            };

            audio.onerror = (e) => {
              console.warn('[voiceGuidance] Audio play error, falling back to WebSpeech:', e);
              audioRef.current = null;
              playFallbackWebSpeech(targetText, webSpeechLang);
            };

            await audio.play();
            return;
          }
        }
      } catch (err) {
        console.warn('[voiceGuidance] Sarvam TTS request failed, falling back to WebSpeech:', err);
      }

      // Fallback to browser WebSpeech API
      playFallbackWebSpeech(targetText, webSpeechLang);
    },
    [stop, playFallbackWebSpeech]
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { speak, stop, isPlaying };
}

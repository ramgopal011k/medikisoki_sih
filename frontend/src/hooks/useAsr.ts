/**
 * useAsr — Universal Cross-Browser ASR Hook for MediKiosk
 *
 * 3-Layer strategy (capability-based, not browser-sniff based):
 *  Layer 1: Native WebSpeech (SpeechRecognition / webkitSpeechRecognition) — Chrome, Edge, Samsung
 *  Layer 2: MediaRecorder + Backend ASR (Sarvam/Gemini) — Firefox, Safari, iOS, UC, etc.
 *  Layer 3: Graceful degradation to text input with clear user message
 *
 * Privacy: No patient health data or transcripts are logged at any point.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  selectAsrStrategy,
  getBestRecordingMime,
  setLastAsrError,
  logAsrDiagnostics,
} from '@/lib/asrDiagnostics';
import { API_URL } from '@/lib/api';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    simulateAsrInput: (text: string) => void;
  }
}

export interface UseAsrOptions {
  lang?: string;
  onResult?: (text: string) => void;
  onEnd?: () => void;
  maxDurationSeconds?: number;
}

export type AsrStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';
export type AsrMode = 'native' | 'cloud' | 'offline' | 'unavailable';

// Language tag maps: our 2-letter patient language code → BCP-47 tag for WebSpeech
const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  or: 'or-IN',
  as: 'as-IN',
};

// Language tag maps: our 2-letter patient language code → Sarvam language_code
const LANG_TO_SARVAM: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  or: 'or-IN',
  as: 'as-IN',
};

function getPatientLang(): string {
  if (typeof localStorage === 'undefined') return 'en';
  return localStorage.getItem('patient_language') || 'en';
}

function getBcpTag(options?: UseAsrOptions): string {
  const patientLang = getPatientLang();
  if (options?.lang) return options.lang;
  return LANG_TO_BCP47[patientLang] || 'en-IN';
}

function getSarvamLang(): string {
  return LANG_TO_SARVAM[getPatientLang()] || 'en-IN';
}

/**
 * Sends recorded audio blobs to the backend ASR endpoint.
 * Returns the transcript string or throws if ASR failed.
 */
async function sendAudioToBackend(
  chunks: Blob[],
  mime: string,
  sarvamLang: string
): Promise<string> {
  const blob = new Blob(chunks, { type: mime });
  const ext = mime.includes('mp4') || mime.includes('aac') ? 'm4a'
    : mime.includes('ogg') ? 'ogg'
    : mime.includes('wav') ? 'wav'
    : 'webm';

  const formData = new FormData();
  formData.append('audio', blob, `recording.${ext}`);
  formData.append('language_code', sarvamLang);

  // Use the shared API_URL from lib/api — correctly resolves to Render in production
  // (VITE_API_URL env var, or https://medikisoki-sih-backend.onrender.com)
  const response = await fetch(`${API_URL}/api/sarvam/asr`, {
    method: 'POST',
    body: formData,
    // NOTE: No auth token for this endpoint — it is explicitly public (see auth middleware)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ASR backend returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  // Both Sarvam and Gemini fallback return { transcript: "..." }
  const text: string = data?.transcript || data?.text || '';
  if (!text) throw new Error('Empty transcript from backend ASR');
  // Guard against any fake or mock fallback transcripts
  if (text.toLowerCase().includes('fallback asr') || text.toLowerCase().includes('mock asr transcript')) {
    throw new Error('Voice unavailable, please tap.');
  }
  return text.trim();
}

function startVad(stream: MediaStream, onSilence: () => void): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return () => {};

    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    let sampleCount = 0;
    let baselineNoiseMax = 0.005;
    let threshold = 0.02;

    let hasSpoken = false;
    let silenceDurationMs = 0;
    let active = true;

    // Poll RMS every 100ms
    const intervalId = setInterval(() => {
      if (!active) return;
      analyser.getFloatTimeDomainData(buffer);

      let sumSq = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSq += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSq / buffer.length);

      // Calibrate threshold from first 300ms
      if (sampleCount < 3) {
        sampleCount++;
        if (rms > baselineNoiseMax) baselineNoiseMax = rms;
        if (sampleCount === 3) {
          threshold = Math.max(0.015, baselineNoiseMax * 1.5);
        }
        return;
      }

      // Stop after 800ms silence post-speech
      if (rms > threshold) {
        hasSpoken = true;
        silenceDurationMs = 0;
      } else if (hasSpoken) {
        silenceDurationMs += 100;
        if (silenceDurationMs >= 800) {
          active = false;
          clearInterval(intervalId);
          onSilence();
        }
      }
    }, 100);

    return () => {
      active = false;
      clearInterval(intervalId);
      try { source.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
      if (audioCtx.state !== 'closed') {
        try { audioCtx.close(); } catch {}
      }
    };
  } catch (err) {
    console.warn('[MediKiosk ASR] WebAudio VAD init notice:', err);
    return () => {};
  }
}

export function useAsr() {
  const [isListening, setIsListening]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [status, setStatus]             = useState<AsrStatus>('idle');
  const [error, setError]               = useState<string | null>(null);

  const [mode, setMode]                 = useState<AsrMode>(() => {
    if (typeof window === 'undefined') return 'offline';
    if (!window.isSecureContext || !navigator?.mediaDevices?.getUserMedia) return 'offline';
    const strat = selectAsrStrategy();
    if (strat === 'native') return 'native';
    if (strat === 'mediarecorder') return 'cloud';
    return 'unavailable';
  });
  const [reason, setReason]             = useState<string>('');

  const recognitionRef   = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const timeoutRef       = useRef<any>(null);
  const isMountedRef     = useRef(true);
  const vadCleanupRef    = useRef<(() => void) | null>(null);

  const onResultCallbackRef = useRef<((text: string) => void) | undefined>(undefined);
  const onEndCallbackRef    = useRef<(() => void) | undefined>(undefined);
  const finalTranscriptRef  = useRef<string>('');
  const strategyRef         = useRef<'native' | 'mediarecorder' | 'none'>('none');

  // ──────────────────────────────────────────────────────
  // CLEANUP
  // ──────────────────────────────────────────────────────
  const cleanupMedia = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (vadCleanupRef.current) {
      vadCleanupRef.current();
      vadCleanupRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupMedia();
    };
  }, [cleanupMedia]);

  // ──────────────────────────────────────────────────────
  // STOP
  // ──────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (strategyRef.current === 'native' && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      // onend will clean up state
    } else if (strategyRef.current === 'mediarecorder' && mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        try {
          if (typeof mediaRecorderRef.current.requestData === 'function') {
            try { mediaRecorderRef.current.requestData(); } catch { /* ignore */ }
          }
          mediaRecorderRef.current.stop();
        } catch {
          cleanupMedia();
          if (isMountedRef.current) {
            setIsListening(false);
            setIsProcessing(false);
            setStatus('idle');
          }
        }
        // onstop handler will pick up and submit to backend
      } else {
        cleanupMedia();
        if (isMountedRef.current) {
          setIsListening(false);
          setIsProcessing(false);
          setStatus('idle');
        }
      }
    } else {
      cleanupMedia();
      if (isMountedRef.current) {
        setIsListening(false);
        setIsProcessing(false);
        setStatus('idle');
      }
    }
  }, [cleanupMedia]);

  const startNativeSpeech = useCallback((
    bcpLang: string,
    duration: number
  ) => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = bcpLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let usedMediaRecorderFallback = false;

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const current = (final + interim).trim();
      if (current && isMountedRef.current) {
        setTranscript(current);
        finalTranscriptRef.current = (final || current).trim();
        if (onResultCallbackRef.current) {
          onResultCallbackRef.current(current);
        }
      }
    };

    recognition.onerror = (e: any) => {
      const err: string = e.error || 'unknown';
      console.warn('[MediKiosk ASR] WebSpeech error:', err);
      setLastAsrError(err);

      if (err === 'not-allowed') {
        if (isMountedRef.current) {
          setError('Microphone access denied. Please allow microphone in browser settings.');
          setStatus('error');
          setIsListening(false);
        }
        cleanupMedia();

      } else if (err === 'service-not-allowed') {
        console.warn('[MediKiosk ASR] service-not-allowed — falling back to MediaRecorder+Sarvam backend');
        if (!usedMediaRecorderFallback && isMountedRef.current) {
          usedMediaRecorderFallback = true;
          try { recognition.abort(); } catch { /* ignore */ }
          recognitionRef.current = null;
          strategyRef.current = 'mediarecorder';
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((newStream) => {
              streamRef.current = newStream;
              startMediaRecorder(newStream, duration);
            })
            .catch(() => {
              if (isMountedRef.current) {
                setError('Voice input unavailable. Please tap your answer instead.');
                setStatus('error');
                setIsListening(false);
              }
              cleanupMedia();
            });
        } else {
          if (isMountedRef.current) {
            setError('Voice recognition unavailable. Please tap your answer instead.');
            setStatus('error');
            setIsListening(false);
          }
          cleanupMedia();
        }

      } else if (err === 'audio-capture') {
        if (isMountedRef.current) {
          setError('Could not access microphone. Please check your mic and try again.');
          setStatus('error');
          setIsListening(false);
        }
        cleanupMedia();

      } else if (err === 'network') {
        if (isMountedRef.current) {
          setError('Network error with speech recognition. Please check your connection.');
          setStatus('error');
        }

      } else if (err === 'no-speech') {
        if (isMountedRef.current) {
          setError('No speech detected. Please try again or tap your answer.');
          setStatus('error');
        }

      } else {
        if (isMountedRef.current) {
          setError('Voice input unavailable. Please tap your answer instead.');
          setStatus('error');
          setIsListening(false);
        }
        cleanupMedia();
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      if (isMountedRef.current) {
        setIsListening(false);
        setStatus('idle');
        const text = finalTranscriptRef.current.trim();
        if (text && onResultCallbackRef.current) {
          onResultCallbackRef.current(text);
        }
        if (onEndCallbackRef.current) onEndCallbackRef.current();
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (startErr: any) {
      console.warn('[MediKiosk ASR] Native recognition.start() failed:', startErr);
      if (isMountedRef.current) {
        setError('Could not start voice input. Please tap your answer instead.');
        setStatus('error');
        setIsListening(false);
      }
      return;
    }

    // Auto-stop timer (6s default)
    timeoutRef.current = setTimeout(() => {
      stopListening();
      if (!finalTranscriptRef.current && isMountedRef.current) {
        setError('No speech detected. Please tap your answer.');
        setStatus('error');
      }
    }, duration);
  }, [cleanupMedia, stopListening]);

  // ──────────────────────────────────────────────────────
  // LAYER 2: MEDIARECORDER + BACKEND ASR
  // ──────────────────────────────────────────────────────
  const startMediaRecorder = useCallback((
    stream: MediaStream,
    duration: number
  ) => {
    const mime = getBestRecordingMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        if (isMountedRef.current) {
          setError('Recording is not supported in this browser. Please type your answer.');
          setStatus('unsupported');
          setIsListening(false);
        }
        cleanupMedia();
        return;
      }
    }

    audioChunksRef.current = [];
    const sarvamLang = getSarvamLang();
    const effectiveMime = recorder.mimeType || mime;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;

      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];

      if (!isMountedRef.current) return;

      if (chunks.length === 0) {
        setIsListening(false);
        setIsProcessing(false);
        setStatus('idle');
        if (onEndCallbackRef.current) onEndCallbackRef.current();
        return;
      }

      setIsListening(false);
      setIsProcessing(true);
      setStatus('processing');

      try {
        const text = await sendAudioToBackend(chunks, effectiveMime, sarvamLang);
        if (!isMountedRef.current) return;
        setTranscript(text);
        finalTranscriptRef.current = text;
        setIsProcessing(false);
        setStatus('idle');
        if (onResultCallbackRef.current) onResultCallbackRef.current(text);
        if (onEndCallbackRef.current) onEndCallbackRef.current();
      } catch (err: any) {
        console.warn('[MediKiosk ASR] Backend ASR failed:', err.message);
        setLastAsrError(err.message);
        if (isMountedRef.current) {
          setTranscript('');
          finalTranscriptRef.current = '';
          setIsProcessing(false);
          setStatus('error');
          setError('Voice unavailable, please tap.');
          if (onEndCallbackRef.current) onEndCallbackRef.current();
        }
      }
    };

    recorder.onerror = (e: any) => {
      console.warn('[MediKiosk ASR] MediaRecorder error:', e?.error?.name);
      setLastAsrError(e?.error?.name || 'mediarecorder-error');
      if (isMountedRef.current) {
        setIsListening(false);
        setIsProcessing(false);
        setStatus('error');
        setError('Recording error. Please tap your answer instead.');
      }
      cleanupMedia();
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);

    // Attach VAD early-stop on mic stream (800ms silence post-speech)
    if (vadCleanupRef.current) {
      vadCleanupRef.current();
    }
    vadCleanupRef.current = startVad(stream, () => {
      console.log('[MediKiosk ASR] VAD detected 800ms silence post-speech, stopping recording early');
      stopListening();
    });

    // Auto-stop timer (6s default)
    timeoutRef.current = setTimeout(() => {
      stopListening();
      if (!finalTranscriptRef.current && isMountedRef.current) {
        setError('No speech detected. Please tap your answer.');
      }
    }, duration);
  }, [cleanupMedia, stopListening]);

  // ──────────────────────────────────────────────────────
  // START (public API)
  // ──────────────────────────────────────────────────────
  const startListening = useCallback((options?: UseAsrOptions) => {
    // Toggle off if already running
    if (isListening || isProcessing) {
      stopListening();
      return;
    }

    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';
    audioChunksRef.current = [];
    onResultCallbackRef.current = options?.onResult;
    onEndCallbackRef.current = options?.onEnd;

    if (import.meta.env?.DEV) {
      logAsrDiagnostics().catch(() => {});
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('unsupported');
      setError('Voice input requires HTTPS. Please tap your answer instead.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('Voice input is not supported in this browser. Please tap your answer instead.');
      return;
    }

    const strategy = selectAsrStrategy();
    strategyRef.current = strategy;

    if (strategy === 'none') {
      setStatus('unsupported');
      setError('Voice input is not supported in this browser. Please tap your answer instead.');
      return;
    }

    const bcpLang = getBcpTag(options);
    const duration = (options?.maxDurationSeconds || 6) * 1000;

    // Native WebSpeech Path (Desktop & Mobile Chrome/Edge): execute SpeechRecognition.start() synchronously inside user gesture handler
    if (strategy === 'native') {
      setIsListening(true);
      setStatus('listening');
      startNativeSpeech(bcpLang, duration);
      return;
    }

    // Fallback MediaRecorder Path: request mic and start MediaRecorder (Firefox, Safari, etc.)
    setIsListening(true);
    setStatus('listening');

    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
      .then((stream) => {
        if (!isMountedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        startMediaRecorder(stream, duration);
      })
      .catch((err: any) => {
        const name: string = err?.name || '';
        let msg = 'Microphone access denied. Please allow microphone in browser settings.';
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          msg = 'No microphone found. Please connect a microphone or tap your answer instead.';
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          msg = 'Microphone is busy with another app. Please close other apps using the mic.';
        }
        if (isMountedRef.current) {
          setLastAsrError(name || err.message);
          setError(msg);
          setStatus('error');
          setIsListening(false);
        }
      });
  }, [isListening, isProcessing, stopListening, startNativeSpeech, startMediaRecorder]);

  // ──────────────────────────────────────────────────────
  // DEV TEST HELPER  (never called in production)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.simulateAsrInput = (text: string) => {
        setTranscript(text);
        finalTranscriptRef.current = text;
        if (onResultCallbackRef.current) onResultCallbackRef.current(text);
      };
    }
  }, []);

  return {
    isListening,
    isProcessing,
    transcript,
    status,
    error,
    mode,
    reason,
    startListening,
    stopListening,
    setTranscript,
  };
}

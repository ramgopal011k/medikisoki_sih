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

type AsrStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

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

  // Use the shared API_URL from lib/api — correctly resolves to Railway in production
  // (VITE_API_URL env var, or https://medikisoki-production.up.railway.app on non-localhost)
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
  return text.trim();
}

export function useAsr() {
  const [isListening, setIsListening]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [status, setStatus]             = useState<AsrStatus>('idle');
  const [error, setError]               = useState<string | null>(null);

  const recognitionRef   = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const timeoutRef       = useRef<any>(null);
  const isMountedRef     = useRef(true);

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
        try { mediaRecorderRef.current.stop(); } catch {
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
    stream: MediaStream,
    bcpLang: string,
    duration: number
  ) => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = bcpLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Track whether we've already fallen back to MediaRecorder to avoid double-fallback
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
        if (final && onResultCallbackRef.current) {
          onResultCallbackRef.current(finalTranscriptRef.current);
        }
      }
    };

    recognition.onerror = (e: any) => {
      const err: string = e.error || 'unknown';
      console.warn('[MediKiosk ASR] WebSpeech error:', err);
      setLastAsrError(err);

      if (err === 'not-allowed') {
        // Hard permission denial — user must act in browser settings
        if (isMountedRef.current) {
          setError('Microphone access denied. Please allow microphone in browser settings.');
          setStatus('error');
          setIsListening(false);
        }
        cleanupMedia();

      } else if (err === 'service-not-allowed') {
        // Android Chrome: Google speech servers rate-limited or region-blocked.
        // Fall back to MediaRecorder + Sarvam backend instead of failing silently.
        console.warn('[MediKiosk ASR] service-not-allowed — falling back to MediaRecorder+Sarvam backend');
        if (!usedMediaRecorderFallback && !isMountedRef.current === false) {
          usedMediaRecorderFallback = true;
          try { recognition.abort(); } catch { /* ignore */ }
          recognitionRef.current = null;
          strategyRef.current = 'mediarecorder';
          // Re-acquire stream since the native recognition may have consumed it
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
        // Microphone hardware error
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
        // Not fatal — let onend handle cleanup, show gentle hint
        if (isMountedRef.current) {
          setError('No speech detected. Please try again or tap your answer.');
          setStatus('error');
        }

      } else {
        // aborted, language-not-supported, or unknown — surface to user, don't silently discard
        if (isMountedRef.current) {
          setError('Voice input unavailable. Please tap your answer instead.');
          setStatus('error');
          setIsListening(false);
        }
        cleanupMedia();
      }
    };

    recognition.onend = () => {
      // Release the stream tracks BEFORE updating state to avoid stale lock on iOS
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
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
    recognition.start();

    // Auto-stop timer
    timeoutRef.current = setTimeout(() => stopListening(), duration);
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
      // Some browsers don't accept the mime type in the constructor — try without
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
      // Release mic immediately to prevent OS-level lock
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
          setIsProcessing(false);
          setStatus('error');
          setError('Could not process voice. Please tap your answer instead.');
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
    // Collect in 250ms timeslices for better iOS compatibility
    recorder.start(250);

    // Auto-stop timer
    timeoutRef.current = setTimeout(() => stopListening(), duration);
  }, [cleanupMedia, stopListening]);

  // ──────────────────────────────────────────────────────
  // START (public API)
  // ──────────────────────────────────────────────────────
  const startListening = useCallback(async (options?: UseAsrOptions) => {
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

    // Log diagnostics in dev (non-blocking, no patient data)
    if (import.meta.env?.DEV) {
      logAsrDiagnostics().catch(() => {});
    }

    // Gate: HTTPS / secure context required
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('unsupported');
      setError('Voice input requires HTTPS. Please tap your answer instead.');
      return;
    }

    // Gate: getUserMedia must exist
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('Voice input is not supported in this browser. Please tap your answer instead.');
      return;
    }

    // Determine strategy
    const strategy = selectAsrStrategy();
    strategyRef.current = strategy;

    if (strategy === 'none') {
      setStatus('unsupported');
      setError('Voice input is not supported in this browser. Please tap your answer instead.');
      return;
    }

    // Acquire mic stream
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // sampleRate hint: Sarvam works best with 16kHz; browser may ignore this
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;
    } catch (err: any) {
      const name: string = err?.name || '';
      let msg = 'Microphone access denied. Please allow microphone in browser settings.';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No microphone found. Please connect a microphone or tap your answer instead.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = 'Microphone is busy with another app. Please close other apps using the mic.';
      } else if (name === 'OverconstrainedError') {
        // Retry without sampleRate constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
        } catch {
          setError('Could not start microphone. Please tap your answer instead.');
          setStatus('error');
          return;
        }
      }
      if (!stream) {
        setLastAsrError(name || err.message);
        setError(msg);
        setStatus('error');
        return;
      }
    }

    setIsListening(true);
    setStatus('listening');

    const bcpLang = getBcpTag(options);
    const duration = (options?.maxDurationSeconds || 10) * 1000;

    if (strategy === 'native') {
      startNativeSpeech(stream, bcpLang, duration);
    } else {
      // strategy === 'mediarecorder'
      // On iOS, native SpeechRecognition and getUserMedia conflict at the OS level.
      // We never open a SpeechRecognition instance when using MediaRecorder.
      startMediaRecorder(stream, duration);
    }
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
    startListening,
    stopListening,
    setTranscript,
  };
}

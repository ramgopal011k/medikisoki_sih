import { useState, useCallback, useRef, useEffect } from 'react';

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

export function useAsr() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'error' | 'unsupported'>('idle');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<any>(null);

  const onResultCallbackRef = useRef<((text: string) => void) | undefined>(undefined);
  const onEndCallbackRef = useRef<(() => void) | undefined>(undefined);
  const finalTranscriptRef = useRef<string>('');

  const cleanupMedia = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupMedia();
        setIsListening(false);
        setStatus('idle');
      }
    } else {
      cleanupMedia();
      setIsListening(false);
      setStatus('idle');
    }
  }, [cleanupMedia]);

  const startListening = useCallback(
    async (options?: UseAsrOptions) => {
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

      const patientLang = localStorage.getItem('patient_language') || 'en';
      const requestedLang = options?.lang || (patientLang === 'hi' ? 'hi-IN' : 'en-IN');

      // 1. Check for HTTPS or localhost
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setStatus('unsupported');
        setError('Voice input requires a secure connection (HTTPS). Please tap your answer instead.');
        setIsListening(false);
        return;
      }

      // 2. Acquire microphone stream
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        setError('Voice input is not supported in this browser. Please tap your answer instead.');
        setIsListening(false);
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;
      } catch (err: any) {
        console.warn('Microphone access failed:', err);
        setError(err.message || 'Microphone access denied. Please check permissions.');
        setStatus('error');
        setIsListening(false);
        return;
      }

      setIsListening(true);
      setStatus('listening');

      // Start WebSpeech API
      const SpeechRecognition =
        typeof window !== 'undefined'
          ? window.SpeechRecognition || window.webkitSpeechRecognition
          : null;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = requestedLang;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = 0; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript + ' ';
              } else {
                interim += event.results[i][0].transcript;
              }
            }

            const currentText = (final + interim).trim();
            if (currentText) {
              setTranscript(currentText);
              finalTranscriptRef.current = (final || currentText).trim();
              if (final && onResultCallbackRef.current) {
                 onResultCallbackRef.current(finalTranscriptRef.current);
              }
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('WebSpeech error:', e.error);
            if (e.error === 'not-allowed') {
              setError('Microphone access denied.');
              setStatus('error');
            }
          };

          recognition.onend = () => {
            setIsListening(false);
            setStatus('idle');
            const existingText = finalTranscriptRef.current.trim();
            if (existingText.length > 0 && onResultCallbackRef.current) {
               onResultCallbackRef.current(existingText);
            }
            if (onEndCallbackRef.current) {
              onEndCallbackRef.current();
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (speechErr) {
          console.warn('WebSpeech start error:', speechErr);
        }
      } else {
        setStatus('unsupported');
        setError('Voice input is not supported in this browser.');
        setIsListening(false);
        return;
      }

      // 4. Auto-stop timer (default 8 seconds or custom maxDuration)
      const duration = (options?.maxDurationSeconds || 8) * 1000;
      timeoutRef.current = setTimeout(() => {
        stopListening();
      }, duration);
    },
    [isListening, isProcessing, stopListening, cleanupMedia]
  );

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  // Support test simulation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.simulateAsrInput = (text: string) => {
        setTranscript(text);
        finalTranscriptRef.current = text;
        if (onResultCallbackRef.current) {
          onResultCallbackRef.current(text);
        }
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

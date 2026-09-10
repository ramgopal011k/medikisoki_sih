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
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData(); // Force flush chunks
        }
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Failed to stop MediaRecorder cleanly:', err);
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

      // 2. Setup MediaRecorder for robust backend AI transcription
      let recorder: MediaRecorder | null = null;
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          setIsListening(false);

          // We will send recorded audio chunks to Sarvam AI / Gemini backend first
          // and only fallback to Web Speech API if it fails.

          // Otherwise, send recorded audio chunks to Sarvam AI / Gemini backend
          if (audioChunksRef.current.length > 0) {
            setIsProcessing(true);
            setStatus('processing');

            try {
              const mimeType = recorder?.mimeType || 'audio/webm';
              const cleanMimeType = mimeType.split(';')[0];
              
              let fileExt = 'webm';
              if (cleanMimeType.includes('mp4') || cleanMimeType.includes('mp4a')) fileExt = 'mp4';
              else if (cleanMimeType.includes('ogg')) fileExt = 'ogg';

              const audioBlob = new Blob(audioChunksRef.current, {
                type: cleanMimeType,
              });

              const formData = new FormData();
              formData.append('file', audioBlob, `speech.${fileExt}`);
              formData.append('language', requestedLang);

              const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
              const response = await fetch(`${API_URL}/api/sarvam/asr`, {
                method: 'POST',
                body: formData,
              });

              if (response.ok) {
                const data = await response.json();
                if (data && data.transcript) {
                  const cleaned = data.transcript.trim();
                  setTranscript(cleaned);
                  finalTranscriptRef.current = cleaned;
                  if (onResultCallbackRef.current) {
                    onResultCallbackRef.current(cleaned);
                  }
                }
              } else {
                console.warn('Backend ASR returned non-200 status:', response.status);
                // Fallback to Web Speech on non-200
                const existingText = finalTranscriptRef.current.trim();
                if (existingText.length > 0) {
                  if (onResultCallbackRef.current) onResultCallbackRef.current(existingText);
                  setStatus('idle');
                } else {
                  setError('Backend transcription failed. Please try again or type your answer.');
                  setStatus('error');
                }
              }
            } catch (postErr) {
              console.warn('Failed to send audio to backend ASR:', postErr);
              // Fallback to Web Speech on network error
              const existingText = finalTranscriptRef.current.trim();
              if (existingText.length > 0) {
                if (onResultCallbackRef.current) onResultCallbackRef.current(existingText);
                setStatus('idle');
              } else {
                setError('Transcription failed. Please try again or type your answer.');
                setStatus('error');
              }
            } finally {
              setIsProcessing(false);
              setStatus('idle');
            }
          } else {
            // No audio chunks captured, fallback to Web Speech
            const existingText = finalTranscriptRef.current.trim();
            if (existingText.length > 0) {
              if (onResultCallbackRef.current) onResultCallbackRef.current(existingText);
              setStatus('idle');
            } else {
              setError('No audio captured. Please check your microphone permissions or speak louder.');
              setStatus('error');
            }
          }

          cleanupMedia();
          if (onEndCallbackRef.current) {
            onEndCallbackRef.current();
          }
        };

        recorder.start(1000); // Flush chunks every second for robust cross-platform capture
      } catch (recErr) {
        console.warn('MediaRecorder setup error:', recErr);
      }

      // 3. Start WebSpeech API in parallel for instant client-side interim feedback
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
              // Removed instant onResultCallbackRef to prevent preempting Sarvam ASR
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('WebSpeech interim error (will rely on MediaRecorder/Sarvam):', e.error);
          };

          recognition.onend = () => {
            // WebSpeech ended; MediaRecorder continues until user or timer stops it
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (speechErr) {
          console.warn('WebSpeech start error:', speechErr);
        }
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

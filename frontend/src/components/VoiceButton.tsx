import React from 'react';
import { Mic, Square, MicOff, Loader2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VoiceButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'status'> {
  status?: 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';
  isListening?: boolean;
  isProcessing?: boolean;
  /** Override displayed label */
  label?: string;
  showStatusLabel?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  status = 'idle',
  isListening,
  isProcessing,
  label,
  showStatusLabel = true,
  className,
  ...props
}) => {
  const isSpeaking     = status === 'listening' || isListening;
  const isTranscribing = status === 'processing' || isProcessing;
  const isError        = status === 'error';
  const isUnsupported  = status === 'unsupported';
  const isDisabled     = isError || isUnsupported || isTranscribing;

  const getStatusText = () => {
    if (label) return label;
    if (isTranscribing) return 'Processing audio…';
    if (isSpeaking)    return 'Listening — tap to stop';
    if (isError)       return 'Microphone error — tap to retry';
    if (isUnsupported) return 'Voice not supported — please type';
    return 'Tap to speak';
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        {/* Pulse ring while listening */}
        {isSpeaking && (
          <>
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <span className="absolute inset-[-6px] rounded-full border-2 border-primary/30" />
          </>
        )}
        {/* Spin ring while processing */}
        {isTranscribing && (
          <span className="absolute inset-[-6px] rounded-full border-2 border-amber-500/50 animate-spin" />
        )}

        <button
          type="button"
          disabled={isDisabled}
          aria-label={getStatusText()}
          aria-pressed={isSpeaking}
          title={getStatusText()}
          className={cn(
            // Base
            "relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center",
            "transition-all duration-300 shadow-md",
            "focus:outline-none focus:ring-4 focus:ring-primary/20",
            // Touch targets — larger on mobile via min-touch-area CSS pattern
            "touch-manipulation select-none",
            // Idle
            !isSpeaking && !isTranscribing && !isError && !isUnsupported &&
              "bg-white border-2 border-primary/30 text-primary hover:border-primary hover:bg-primary/5 hover:shadow-lg active:scale-95",
            // Listening
            isSpeaking && "bg-primary text-white border-2 border-primary shadow-lg scale-105 active:scale-100",
            // Processing (amber)
            isTranscribing && "bg-amber-600 text-white border-2 border-amber-700 shadow-md cursor-wait",
            // Error / Unsupported
            (isError || isUnsupported) &&
              "bg-slate-100 border-2 border-slate-300 text-slate-400 cursor-not-allowed",
            className
          )}
          {...props}
        >
          {isTranscribing ? (
            <Loader2 className="w-8 h-8 animate-spin" aria-hidden />
          ) : isSpeaking ? (
            <Square className="w-7 h-7 fill-current" aria-hidden />
          ) : isError ? (
            <Mic className="w-8 h-8" aria-hidden />   /* allow retry tap */
          ) : isUnsupported ? (
            <MicOff className="w-8 h-8" aria-hidden />
          ) : (
            <Mic className="w-8 h-8" aria-hidden />
          )}
        </button>
      </div>

      {showStatusLabel && (
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "text-xs font-body font-medium transition-colors duration-200 text-center max-w-[120px]",
            isSpeaking    && "text-primary font-semibold",
            isTranscribing && "text-amber-700 font-semibold",
            isError        && "text-red-600",
            isUnsupported  && "text-slate-400",
            !isSpeaking && !isTranscribing && !isError && !isUnsupported && "text-muted"
          )}
        >
          {getStatusText()}
        </span>
      )}
    </div>
  );
};

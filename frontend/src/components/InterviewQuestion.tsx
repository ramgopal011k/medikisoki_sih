import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { InterviewQuestion as QuestionType } from "@/types/interview-tree";
import { QuestionCard } from './QuestionCard';
import { LeafStepIndicator } from './LeafStepIndicator';
import { VoiceButton } from './VoiceButton';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';

import { useAsr } from '@/hooks/useAsr';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface InterviewQuestionProps {
  question: QuestionType;
  totalSteps: number;
  currentStep: number;
  onAnswer: (value: string | string[], answerText: string) => void;
  language?: string;
}

export const InterviewQuestion: React.FC<InterviewQuestionProps> = ({
  question,
  totalSteps,
  currentStep,
  onAnswer,
  language = 'en'
}) => {
  const { isListening, isProcessing, transcript, status, startListening, stopListening, setTranscript } = useAsr();
  const [textInput, setTextInput] = useState('');
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const pendingMatchRef = useRef<{ value: string; label: string } | null>(null);

  const augmentedOptions = React.useMemo(() => {
    if (!question.options) return undefined;
    if (question.type !== 'single_choice' && question.type !== 'multi_choice') return question.options;
    
    const hasUnknown = question.options.some(o => 
      o.value === 'unknown' || 
      o.value === 'none' || 
      o.label.toLowerCase().includes("don't know") ||
      o.label.toLowerCase().includes('not sure')
    );
    
    if (hasUnknown) return question.options;
    return [...question.options, { value: 'unknown', label: "I don't know / Not sure", label_hi: 'मुझे नहीं पता' }];
  }, [question.options, question.type]);


  const handleOptionTap = useCallback((value: string, label: string) => {
    if (question.type === 'single_choice') {
      onAnswer(value, label);
    } else if (question.type === 'multi_choice') {
      if (selectedMulti.includes(value)) {
        setSelectedMulti(prev => prev.filter(v => v !== value));
      } else {
        setSelectedMulti(prev => [...prev, value]);
      }
    }
  }, [question.type, onAnswer, selectedMulti]);

  const submitMultiChoice = useCallback(() => {
    if (selectedMulti.length > 0) {
      const labels = augmentedOptions
        ?.filter(opt => selectedMulti.includes(opt.value))
        .map(opt => language === 'hi' && opt.label_hi ? opt.label_hi : opt.label)
        .join(', ') || '';
      onAnswer(selectedMulti, labels);
    }
  }, [selectedMulti, augmentedOptions, language, onAnswer]);

  // Process voice transcript match via a callback
  const processTranscriptMatch = useCallback(async () => {
    if (!transcript) return;

    if (question.type === 'text' || question.type === 'number') {
      setTextInput(transcript);
      setTranscript('');
      return;
    }

    if (!augmentedOptions) return;

    const lowerTranscript = transcript.toLowerCase().trim();

    // Smart routing for multi-choice 'continue' command
    if (question.type === 'multi_choice' && 
        (lowerTranscript.includes('continue') || lowerTranscript.includes('next') || lowerTranscript.includes('finish') || lowerTranscript.includes('submit') || lowerTranscript.includes('confirm') || lowerTranscript.includes('आगे') || lowerTranscript.includes('पुष्टि'))) {
      if (selectedMulti.length > 0) {
        setTranscript('');
        submitMultiChoice();
        return;
      }
    }

    const match = augmentedOptions.find(opt =>
      lowerTranscript.includes(opt.label.toLowerCase()) ||
      (opt.label_hi && lowerTranscript.includes(opt.label_hi.toLowerCase()))
    );

    if (match) {
      pendingMatchRef.current = { value: match.value, label: match.label };
    } else {
      // Fallback to Gemini semantic matching
      try {
        const res = await fetch(`${API_URL}/match-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript, options: augmentedOptions })
        });
        const data = await res.json();
        if (data.match) {
          const geminiMatch = augmentedOptions.find(opt => opt.value === data.match);
          if (geminiMatch) {
            pendingMatchRef.current = { value: geminiMatch.value, label: geminiMatch.label };
          }
        }
      } catch (err) {
        console.error('Failed to match voice via Gemini:', err);
      }
    }
    
    if (pendingMatchRef.current) {
      const { value, label } = pendingMatchRef.current;
      pendingMatchRef.current = null;
      setTranscript('');
      
      if (question.type === 'multi_choice') {
        handleOptionTap(value, label);
      } else {
        onAnswer(value, label);
      }
    }
  }, [transcript, question, onAnswer, selectedMulti, handleOptionTap, submitMultiChoice, setTranscript]);

  // When listening stops, check for a match and fire onAnswer
  useEffect(() => {
    if (!isListening && transcript) {
      processTranscriptMatch();
    }
  }, [isListening, transcript, processTranscriptMatch]);

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening({ lang: language === 'hi' ? 'hi-IN' : 'en-IN' });
    }
  };


  const submitText = () => {
    if (textInput.trim()) {
      onAnswer(textInput.trim(), textInput.trim());
      setTextInput('');
    }
  };

  const renderInput = () => {
    if (question.type === 'single_choice' || question.type === 'multi_choice') {
      return (
        <div className="flex flex-col gap-4 w-full mt-8">
          {augmentedOptions?.map((opt) => {
            const isSelected = selectedMulti.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => handleOptionTap(opt.value, language === 'hi' && opt.label_hi ? opt.label_hi : opt.label)}
                className={cn(
                  "w-full min-h-[64px] px-6 py-4 flex items-center justify-center text-center",
                  "bg-white border-2 rounded-xl transition-all duration-300 font-body text-xl",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                    : "border-warmgray text-charcoal hover:border-primary/40 hover:bg-white/50",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                )}
              >
                {language === 'hi' && opt.label_hi ? opt.label_hi : opt.label}
              </button>
            );
          })}

          {question.type === 'multi_choice' && (
            <Button
              onClick={submitMultiChoice}
              disabled={selectedMulti.length === 0}
              className="mt-4 w-full min-h-[64px] text-xl rounded-[12px] bg-primary text-white font-body"
            >
              {language === 'hi' ? 'पुष्टि करें' : 'Confirm Selection'}
            </Button>
          )}
        </div>
      );
    }

    if (question.type === 'text' || question.type === 'number') {
      return (
        <div className="flex flex-col gap-4 w-full mt-8">
          <input
            type={question.type === 'number' ? 'number' : 'text'}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="w-full text-center text-2xl p-6 min-h-[64px] border-2 border-warmgray rounded-[12px] bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={question.type === 'number' ? '1-10' : (language === 'hi' ? 'यहां टाइप करें' : 'Type here...')}
            onKeyDown={(e) => e.key === 'Enter' && submitText()}
          />
          <Button
            onClick={submitText}
            disabled={!textInput.trim()}
            className="w-full min-h-[64px] text-xl rounded-[12px] bg-primary text-white font-body"
          >
            {language === 'hi' ? 'जारी रखें' : 'Continue'}
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full max-w-[768px] mx-auto flex flex-col gap-6 px-4 box-border">
      <div className="w-full flex justify-center pb-2">
         <LeafStepIndicator total={totalSteps} current={currentStep} />
      </div>

      <QuestionCard className="w-full text-center flex flex-col items-center pt-8 pb-10 px-6 sm:px-10">
        <h2 className="font-display text-3xl sm:text-4xl text-charcoal mb-2 leading-tight">
          {language === 'hi' && question.text_hi ? question.text_hi : question.text}
        </h2>

        {renderInput()}

        {/* Voice ASR for all question types */}
        <div className="mt-10 flex flex-col items-center">
          <p className="text-muted text-sm font-body mb-4">
            {language === 'hi' 
              ? (question.type === 'text' || question.type === 'number' ? 'अपना उत्तर बोलने के लिए टैप करें' : 'एक विकल्प चुनें या अपना उत्तर बोलें') 
              : (question.type === 'text' || question.type === 'number' ? 'Tap to speak your answer' : 'Tap an option or speak your answer')}
          </p>
          <VoiceButton
            isListening={isListening}
            isProcessing={isProcessing}
            status={status}
            onClick={toggleListen}
            label={
              isProcessing
                ? (language === 'hi' ? 'ऑडियो प्रोसेस हो रहा है...' : 'Transcribing audio...')
                : isListening
                ? (language === 'hi' ? 'सुन रहे हैं (रोकने के लिए टैप करें)' : 'Listening (tap to stop)')
                : (language === 'hi' ? 'उत्तर बोलने के लिए टैप करें' : 'Tap to speak answer')
            }
          />
          {status === 'error' && (
            <p className="mt-2 text-danger text-sm font-body text-center max-w-sm">
              {language === 'hi' ? 'माइक्रोफ़ोन त्रुटि या अनुमति अस्वीकृत। आप सीधे विकल्प चुन सकते हैं।' : 'Microphone error or permission denied. You can tap an option directly.'}
            </p>
          )}
          {status === 'unsupported' && (
            <p className="mt-2 text-warning-dark text-sm font-body">
              {language === 'hi' ? 'आवाज़ समर्थित नहीं है। कृपया विकल्प टैप करें।' : 'Voice not supported. Please tap an option.'}
            </p>
          )}
          {transcript && (
            <p className="mt-4 text-charcoal font-body text-lg animate-pulse">
              "{transcript}"
            </p>
          )}
          {!isListening && !isProcessing && transcript && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <p className="text-danger text-sm font-body">
                {language === 'hi' ? 'उत्तर मेल नहीं खाया, कृपया टैप करें या फिर से बोलें' : 'No match found, please tap an option or try speaking again'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setTranscript('');
                  toggleListen();
                }}
                className="text-xs text-primary font-semibold underline hover:text-primary/80"
              >
                {language === 'hi' ? 'फिर से बोलें' : 'Try speaking again'}
              </button>
            </div>
          )}
          </div>
          
          {/* Skip Button */}
          <div className="mt-8 pt-6 border-t border-warmgray w-full flex flex-col items-center">
            <button
              onClick={() => onAnswer('skip', 'Skipped')}
              className="text-sm font-semibold text-muted hover:text-charcoal transition-colors underline underline-offset-4"
            >
              {language === 'hi' ? 'इस प्रश्न को छोड़ें' : 'Skip this question'}
            </button>
            <p className="text-xs text-muted/70 mt-2">
              {language === 'hi' ? 'आप हमेशा डॉक्टर को व्यक्तिगत रूप से बता सकते हैं' : 'You can always tell the doctor in person'}
            </p>
          </div>
      </QuestionCard>
    </div>
  );
};

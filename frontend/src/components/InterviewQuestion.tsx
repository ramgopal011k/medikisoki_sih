import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { InterviewQuestion as QuestionType } from "@/types/interview-tree";
import { QuestionCard } from './QuestionCard';
import { LeafStepIndicator } from './LeafStepIndicator';
import { VoiceButton } from './VoiceButton';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { VoiceGuidanceButton } from './VoiceGuidanceButton';
import { MicWaveform } from './MicWaveform';

import { useAsr } from '@/hooks/useAsr';
import { cleanTranscript } from '@/lib/transcriptCleaner';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

import { smartMatchOption } from '@/lib/smartVoiceMatch';

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
  const { isListening, isProcessing, transcript, status, mode, startListening, stopListening, setTranscript } = useAsr();
  const [textInput, setTextInput] = useState('');
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [voiceFailCount, setVoiceFailCount] = useState(0);
  const pendingMatchRef = useRef<{ value: string; label: string } | null>(null);
  const isHi = language === 'hi';
  const isMr = language === 'mr';
  const isBn = language === 'bn';
  const isHindi = isHi;
  const ttsLang = isMr ? 'mr-IN' : isBn ? 'bn-IN' : isHi ? 'hi-IN' : 'en-IN';

  const getOptionLabel = useCallback((opt: any) => {
    if (isMr) return opt.label_mr || opt.label_hi || opt.label;
    if (isBn) return opt.label_bn || opt.label_hi || opt.label;
    if (isHi) return opt.label_hi || opt.label;
    return opt.label;
  }, [isMr, isBn, isHi]);

  const questionText = isMr
    ? (question.text_mr || question.text_hi || question.text)
    : isBn
    ? (question.text_bn || question.text_hi || question.text)
    : isHi
    ? (question.text_hi || question.text)
    : question.text;

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
    return [
      ...question.options,
      {
        value: 'unknown',
        label: "I don't know / Not sure",
        label_hi: 'मुझे नहीं पता',
        label_mr: 'मला माहित नाही / खात्री नाही',
        label_bn: 'জানা নেই / নিশ্চিত নই'
      }
    ];
  }, [question.options, question.type]);

  const handleOptionTap = useCallback((value: string, label: string) => {
    setVoiceFailCount(0);
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
        .map(opt => getOptionLabel(opt))
        .join(', ') || '';
      onAnswer(selectedMulti, labels);
    }
  }, [selectedMulti, augmentedOptions, getOptionLabel, onAnswer]);

  // Process voice transcript match via a smart matching engine
  const processTranscriptMatch = useCallback(async () => {
    if (!transcript) return;

    const cleaned = cleanTranscript(transcript, { language: (isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en') as any });
    const matchTranscript = cleaned || transcript;

    if (question.type === 'text' || question.type === 'number') {
      setTextInput(matchTranscript);
      setTranscript('');
      return;
    }

    if (!augmentedOptions) return;

    const lowerTranscript = matchTranscript.toLowerCase().trim();

    // Smart routing for multi-choice 'continue' command
    if (
      question.type === 'multi_choice' &&
      (
        lowerTranscript.includes('continue') ||
        lowerTranscript.includes('next') ||
        lowerTranscript.includes('finish') ||
        lowerTranscript.includes('submit') ||
        lowerTranscript.includes('confirm') ||
        lowerTranscript.includes('आगे') ||
        lowerTranscript.includes('पुष्टि') ||
        lowerTranscript.includes('पुढे') ||
        lowerTranscript.includes('सुरू ठेवा') ||
        lowerTranscript.includes('चालিয়ে যান') ||
        lowerTranscript.includes('নিশ্চিত')
      )
    ) {
      if (selectedMulti.length > 0) {
        setTranscript('');
        submitMultiChoice();
        return;
      }
    }

    // Run smart multi-tier natural language voice matching
    const result = await smartMatchOption(matchTranscript, augmentedOptions);
    if (result.matched) {
      setVoiceFailCount(0);
      stopListening(); // cancel recording immediately on match
      pendingMatchRef.current = null;
      setTranscript('');
      
      if (question.type === 'multi_choice') {
        handleOptionTap(result.value, result.label);
      } else {
        onAnswer(result.value, result.label);
      }
      return;
    } else {
      setVoiceFailCount(prev => prev + 1);
    }
  }, [transcript, question, onAnswer, selectedMulti, handleOptionTap, submitMultiChoice, setTranscript, augmentedOptions, stopListening, isMr, isBn, isHi]);

  // Immediate intent match on interim or final transcripts
  useEffect(() => {
    if (transcript) {
      processTranscriptMatch();
    }
  }, [transcript, processTranscriptMatch]);

  const toggleListen = () => {
    if (isListening) {
      // Manual interrupt: Mic tap while recording → stop + process
      stopListening();
      if (transcript) {
        processTranscriptMatch();
      }
    } else {
      startListening({ lang: ttsLang });
    }
  };


  const submitText = () => {
    setVoiceFailCount(0);
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
            const labelText = getOptionLabel(opt);
            return (
              <button
                key={opt.value}
                onClick={() => handleOptionTap(opt.value, labelText)}
                className={cn(
                  "w-full min-h-[64px] px-6 py-4 flex items-center justify-center text-center",
                  "bg-white border-2 rounded-xl transition-all duration-300 font-body text-xl",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                    : "border-warmgray text-charcoal hover:border-primary/40 hover:bg-white/50",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                )}
              >
                {labelText}
              </button>
            );
          })}

          {question.type === 'multi_choice' && (
            <Button
              onClick={submitMultiChoice}
              disabled={selectedMulti.length === 0}
              className="mt-4 w-full min-h-[64px] text-xl rounded-[12px] bg-primary text-white font-body"
            >
              {isMr ? 'निवडीची पुष्टी करा' : isBn ? 'নির্বাচন নিশ্চিত করুন' : isHi ? 'पुष्टि करें' : 'Confirm Selection'}
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
            placeholder={
              question.type === 'number'
                ? '1-10'
                : (isMr ? 'येथे टाईप करा...' : isBn ? 'এখানে লিখুন...' : isHi ? 'यहां टाइप करें...' : 'Type here...')
            }
            onKeyDown={(e) => e.key === 'Enter' && submitText()}
          />
          <Button
            onClick={submitText}
            disabled={!textInput.trim()}
            className="w-full min-h-[64px] text-xl rounded-[12px] bg-primary text-white font-body"
          >
            {isMr ? 'पुढे सुरू ठेवा' : isBn ? 'চালিয়ে যান' : isHi ? 'जारी रखें' : 'Continue'}
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
        <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
          <h2 className="font-display text-3xl sm:text-4xl text-charcoal leading-tight">
            {questionText}
          </h2>
          <VoiceGuidanceButton
            clipId={question.id}
            text={questionText}
            language={ttsLang}
          />
        </div>

        {renderInput()}

        {/* Voice ASR for all question types */}
        <div className="mt-10 flex flex-col items-center">
          {/* Input Mode Indicator Badge — icon only, text hidden visually */}
          <div className="mb-3" role="status" aria-live="polite">
            {(mode === 'native' || mode === 'cloud' || mode === 'offline') && (
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 border border-primary/30 shadow-xs"
                aria-label="Voice input available"
              >
                <span aria-hidden="true">🎤</span>
              </span>
            )}
            {mode === 'unavailable' && (
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 border border-red-300 shadow-xs"
                aria-label="Voice input unavailable"
              >
                <span aria-hidden="true">🎤</span>
              </span>
            )}
          </div>

          <p className="text-muted text-sm font-body mb-4">
            {isMr
              ? (question.type === 'text' || question.type === 'number' ? 'आपले उत्तर बोलण्यासाठी टॅप करा' : 'एक पर्याय निवडा किंवा उत्तर बोला')
              : isBn
              ? (question.type === 'text' || question.type === 'number' ? 'উত্তর বলতে ট্যাপ করুন' : 'একটি বিকল্প বেছে নিন বা উত্তর বলুন')
              : isHi 
              ? (question.type === 'text' || question.type === 'number' ? 'अपना उत्तर बोलने के लिए टैप करें' : 'एक विकल्प चुनें या अपना उत्तर बोलें') 
              : (question.type === 'text' || question.type === 'number' ? 'Tap to speak your answer' : 'Tap an option or speak your answer')}
          </p>
          <div className="relative inline-flex items-center justify-center">
            <VoiceButton
              isListening={isListening}
              isProcessing={isProcessing}
              status={status}
              onClick={toggleListen}
              label={
                isProcessing
                  ? (isMr ? 'ऑडिओ प्रक्रिया होत आहे...' : isBn ? 'অডিও প্রক্রিয়া হচ্ছে...' : isHi ? 'ऑडियो प्रोसेस हो रहा है...' : 'Transcribing audio...')
                  : isListening
                  ? (isMr ? 'ऐकत आहोत (थांबवण्यासाठी टॅप करा)' : isBn ? 'শুনছি (থামাতে ট্যাপ করুন)' : isHi ? 'सुन रहे हैं (रोकने के लिए टैप करें)' : 'Listening (tap to stop)')
                  : (isMr ? 'उत्तर बोलण्यासाठी टॅप करा' : isBn ? 'উত্তর বলতে ট্যাপ করুন' : isHi ? 'उत्तर बोलने के लिए टैप करें' : 'Tap to speak answer')
              }
            />
            {isListening && (
              <div className="absolute left-[calc(100%+12px)] top-9 -translate-y-1/2">
                <MicWaveform active={isListening} />
              </div>
            )}
          </div>
          {isListening && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-4 py-1.5 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>
                {isMr ? 'तुमचा आवाज रेकॉर्ड होत आहे... बोला' : isBn ? 'আপনার ভয়েস রেকর্ড হচ্ছে... বলুন' : isHi ? 'आपकी आवाज रिकॉर्ड हो रही है... बोलें' : 'Recording voice... Speak now'}
              </span>
            </div>
          )}
          {isProcessing && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-100 px-4 py-1.5 rounded-full animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>
                {isMr ? 'सरवम AI द्वारे प्रक्रिया होत आहे...' : isBn ? 'সারভম AI দ্বারা প্রক্রিয়া হচ্ছে...' : isHi ? 'सरवम AI द्वारा स्पीच प्रोसेस हो रही है...' : 'Transcribing speech via Sarvam AI...'}
              </span>
            </div>
          )}
          {transcript && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/15 border border-primary/30 px-4 py-1.5 rounded-full shadow-xs">
                <span>{isMr ? 'ओळखले:' : isBn ? 'শনাক্ত হয়েছে:' : isHi ? 'पहचाना गया:' : 'Recognized:'}</span>
                <span className="italic">"{transcript}"</span>
              </div>
              {(() => {
                const cleaned = cleanTranscript(transcript, { language: (isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en') as any });
                if (cleaned && cleaned !== transcript) {
                  return (
                    <p className="text-[11px] text-muted font-medium italic">
                      {isMr ? `सुधारित: "${cleaned}"` : isBn ? `সংশোধিত: "${cleaned}"` : isHi ? `संशोधित: "${cleaned}"` : `Cleaned: "${cleaned}"`}
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
          {status === 'error' && (
            <p className="mt-2 text-danger text-sm font-body text-center max-w-sm">
              {isMr
                ? 'मायक्रोफोन त्रुटी किंवा परवानगी नाकारली. आपण थेट पर्याय निवडू शकता.'
                : isBn
                ? 'মাইক্রোফোন ত্রুটি বা অনুমতি অস্বীকৃত। আপনি সরাসরি বিকল্প নির্বাচন করতে পারেন।'
                : isHi
                ? 'माइक्रोफ़ोन त्रुटि या अनुमति अस्वीकृत। आप सीधे विकल्प चुन सकते हैं।'
                : 'Microphone error or permission denied. You can tap an option directly.'}
            </p>
          )}
          {status === 'unsupported' && (
            <p className="mt-2 text-warning-dark text-sm font-body">
              {isMr
                ? 'आवाज समर्थित नाही. कृपया पर्यायावर टॅप करा.'
                : isBn
                ? 'ভয়েস সমর্থিত নয়। অনুগ্রহ করে বিকল্পটি ট্যাপ করুন।'
                : isHi
                ? 'आवाज़ समर्थित नहीं है। कृपया विकल्प टैप करें।'
                : 'Voice not supported. Please tap an option.'}
            </p>
          )}
          {!isListening && !isProcessing && transcript && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <p className="text-danger text-sm font-body">
                {isMr
                  ? 'उत्तर जुळले नाही, कृपया पर्यायावर टॅप करा किंवा पुन्हा बोला'
                  : isBn
                  ? 'কোন মিল পাওয়া যায়নি, বিকল্পটি ট্যাপ করুন বা আবার বলুন'
                  : isHi
                  ? 'उत्तर मेल नहीं खाया, कृपया टैप करें या फिर से बोलें'
                  : 'No match found, please tap an option or try speaking again'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setTranscript('');
                  toggleListen();
                }}
                className="text-xs text-primary font-semibold underline hover:text-primary/80"
              >
                {isMr ? 'पुन्हा बोला' : isBn ? 'আবার বলুন' : isHi ? 'फिर से बोलें' : 'Try speaking again'}
              </button>
            </div>
          )}
          {voiceFailCount >= 2 && (
            <div className="mt-3 text-center animate-in fade-in">
              <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg inline-block shadow-xs">
                {isMr
                  ? 'आवाज ओळखता आला नाही. कृपया आपल्या पसंतीवर टॅप करा.'
                  : isBn
                  ? 'ভয়েস শনাক্ত করা যায়নি। অনুগ্রহ করে বিকল্পটিতে স্পর্শ করুন।'
                  : isHi
                  ? 'आवाज पहचानी नहीं गई। कृपया विकल्प पर टैप करें।'
                  : 'Voice not recognized. Please tap your choice.'}
              </p>
            </div>
          )}
          </div>
          
          {/* Skip Button */}
          <div className="mt-8 pt-6 border-t border-warmgray w-full flex flex-col items-center">
            <button
              onClick={() => {
                setVoiceFailCount(0);
                onAnswer('skip', 'Skipped');
              }}
              className="text-sm font-semibold text-muted hover:text-charcoal transition-colors underline underline-offset-4"
            >
              {isMr ? 'हा प्रश्न वगळा' : isBn ? 'এই প্রশ্নটি এড়িয়ে যান' : isHi ? 'इस प्रश्न को छोड़ें' : 'Skip this question'}
            </button>
            <p className="text-xs text-muted/70 mt-2">
              {isMr
                ? 'तुम्ही नेहमी डॉक्टरांना प्रत्यक्ष सांगू शकता'
                : isBn
                ? 'আপনি সর্বদা ডাক্তারকে সরাসরি বলতে পারেন'
                : isHi
                ? 'आप हमेशा डॉक्टर को व्यक्तिगत रूप से बता सकते हैं'
                : 'You can always tell the doctor in person'}
            </p>
          </div>
      </QuestionCard>
    </div>
  );
};

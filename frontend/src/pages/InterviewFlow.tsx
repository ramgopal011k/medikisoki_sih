import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InterviewTree, RedFlagResult } from "@/types/interview-tree";
import { isRedFlag } from "@/types/interview-tree";
import { getInterviewTree } from '../lib/trees';
import { InterviewQuestion } from '../components/InterviewQuestion';
import { MandalaBackground } from '../components/MandalaBackground';
import { QuestionCard } from '../components/QuestionCard';
import { get, set } from 'idb-keyval';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/lib/api';
import { VoiceGuideButton } from '../components/VoiceGuideButton';

interface SessionState {
  id: string;
  complaint: string;
  language: string;
}

interface OfflineFact {
  session_id: string;
  complaint: string;
  question_id: string;
  question_text: string;
  answer: string;
  answer_value: string;
  red_flag_id?: string;
}

const OFFLINE_QUEUE_KEY = 'medikiosk_offline_facts';

export default function InterviewFlow() {
  const navigate = useNavigate();

  // Initialize session from sessionStorage lazily to avoid setState-in-effect
  const [session] = useState<SessionState | null>(() => {
    const sessionId = sessionStorage.getItem('patient_session') || sessionStorage.getItem('session_id');
    const complaint = sessionStorage.getItem('patient_complaint') || sessionStorage.getItem('chief_complaint') || 'Chest pain';
    const lang = localStorage.getItem('patient_language') || 'en';
    if (!sessionId) return null;
    return { id: sessionId, complaint, language: lang };
  });

  const [tree, setTree] = useState<InterviewTree | null>(null);
  const [currentQId, setCurrentQId] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [redFlagTriggered, setRedFlagTriggered] = useState<RedFlagResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load tree logic
  useEffect(() => {
    if (!session) return;
    const loadedTree = getInterviewTree(session.complaint);
    if (loadedTree) {
      setTree(loadedTree);
      
      // Feature 20: Session Recovery
      const savedQId = sessionStorage.getItem(`interview_qid_${session.id}`);
      const savedStepCount = sessionStorage.getItem(`interview_step_${session.id}`);
      
      if (savedQId) {
        setCurrentQId(savedQId);
        setStepCount(savedStepCount ? parseInt(savedStepCount, 10) : 0);
      } else {
        setCurrentQId(loadedTree.start_question_id);
      }
    } else {
      setIsFinished(true);
    }
  }, [session]);

  // Improvement 2: IndexedDB-based offline queue flush
  const flushOfflineQueue = useCallback(async () => {
    const queue: OfflineFact[] | undefined = await get(OFFLINE_QUEUE_KEY);
    if (!queue || queue.length === 0) return;

    setIsSyncing(true);
    const remainingQueue: OfflineFact[] = [];

    for (const fact of queue) {
      try {
        const res = await fetch(`${API_URL}/history-facts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fact)
        });
        if (!res.ok) throw new Error('Sync failed');
      } catch {
        remainingQueue.push(fact);
      }
    }

    await set(OFFLINE_QUEUE_KEY, remainingQueue);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    if (!session) {
      navigate('/consent');
      return;
    }

    // Flush any queued offline facts on mount
    const init = async () => {
      await flushOfflineQueue();
    };
    init();

    window.addEventListener('online', flushOfflineQueue);
    return () => window.removeEventListener('online', flushOfflineQueue);
  }, [session, navigate, flushOfflineQueue]);

  // Subscribe to realtime red flags
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('red-flags-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'red_flags',
        filter: `session_id=eq.${session.id}`
      }, (payload) => {
        setRedFlagTriggered({ 
          flag_id: payload.new.rule_id, 
        } as RedFlagResult);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleAnswer = async (value: string | string[], answerText: string) => {
    if (!currentQId || !tree || !session) return;

    const currentQ = tree.questions[currentQId];

    // Calculate next step first so we know if it's a red flag
    const nextResult = currentQ.next(value);
    const redFlag = isRedFlag(nextResult) ? nextResult : null;

    // Prepare fact payload
    const payload: OfflineFact = {
      session_id: session.id,
      complaint: session.complaint,
      question_id: currentQId,
      question_text: currentQ.text,
      answer: answerText,
      answer_value: Array.isArray(value) ? value.join(',') : value,
      ...(redFlag ? { red_flag_id: redFlag.flag_id } : {})
    };

    // Save fact (try online, fallback to IndexedDB queue)
    try {
      if (!navigator.onLine) throw new Error('Offline');
      const res = await fetch(`${API_URL}/history-facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Server error');
    } catch {
      // Improvement 2: IndexedDB offline fallback
      const queue: OfflineFact[] = (await get(OFFLINE_QUEUE_KEY)) || [];
      queue.push(payload);
      await set(OFFLINE_QUEUE_KEY, queue);
    }

    // Advance the interview
    setStepCount(prev => prev + 1);

    if (nextResult === null || isRedFlag(nextResult)) {
      if (redFlag) {
        setRedFlagTriggered(redFlag);
        // Persist red flag to dedicated table (fire and forget)
        if (navigator.onLine) {
          fetch(`${API_URL}/red-flags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: session.id,
              rule_id: redFlag.flag_id,
            })
          }).catch(console.error);
        }
      }
      setIsFinished(true);
      sessionStorage.removeItem(`interview_qid_${session.id}`);
      sessionStorage.removeItem(`interview_step_${session.id}`);
    } else {
      setCurrentQId(nextResult);
      sessionStorage.setItem(`interview_qid_${session.id}`, nextResult);
      sessionStorage.setItem(`interview_step_${session.id}`, (stepCount + 1).toString());
    }
  };

  const lang = session?.language || 'en';
  const isHi = lang === 'hi';
  const isMr = lang === 'mr';
  const isBn = lang === 'bn';
  const ttsLang = isMr ? 'mr-IN' : isBn ? 'bn-IN' : isHi ? 'hi-IN' : 'en-IN';

  if (isFinished) {
    const redFlagTitle = isMr
      ? 'त्वरित वैद्यकीय लक्ष आवश्यक'
      : isBn
      ? 'জরুরী মনোযোগ প্রয়োজন'
      : isHi
      ? 'तत्काल ध्यान आवश्यक'
      : 'Immediate Attention Required';

    const redFlagMsg = isMr
      ? 'महत्त्वाची लक्षणे आढळली आहेत. कृपया रुग्णालय कर्मचाऱ्यांना कळवा किंवा मदतीची प्रतीक्षा करा.'
      : isBn
      ? 'গুরুত্বপূর্ণ লক্ষণ শনাক্ত হয়েছে। অনুগ্রহ করে হাসপাতাল কর্মীদের জানান বা সহায়তার জন্য অপেক্ষা করুন।'
      : isHi
      ? 'महत्वपूर्ण जानकारी पहचानी गई है। कृपया अस्पताल के कर्मचारियों को सूचित करें या सहायता की प्रतीक्षा करें।'
      : 'Important information has been identified. Please notify hospital staff or wait for assistance.';

    const doneTitle = isMr ? 'धन्यवाद' : isBn ? 'ধন্যবাদ' : isHi ? 'धन्यवाद' : 'Thank you';

    const doneMsg = isMr
      ? 'तुमची तपासणी पूर्ण झाली आहे. कृपया आणखी काही प्रश्नांची उत्तरे द्या.'
      : isBn
      ? 'আপনার ইন্টারভিউ সম্পন্ন হয়েছে। অনুগ্রহ করে আরো কয়েকটি প্রশ্নের উত্তর দিন।'
      : isHi
      ? 'आपका साक्षात्कार पूरा हो गया है। कृपया कुछ और सवालों के जवाब दें।'
      : 'Your interview is complete. Please answer a few more questions.';

    const continueBtn = isMr ? 'पुढे सुरू ठेवा' : isBn ? 'চালিয়ে যান' : isHi ? 'जारी रखें' : 'Continue';

    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-x-hidden">
        <MandalaBackground />
        <QuestionCard className="w-full max-w-2xl text-center z-10 p-8 sm:p-12 box-border">
          {redFlagTriggered ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
                <span className="text-danger text-3xl">⚠</span>
              </div>
              <h1 className="font-display text-4xl text-danger mb-4">
                {redFlagTitle}
              </h1>
              <p className="font-body text-xl text-charcoal mb-4">
                {redFlagMsg}
              </p>
              <div className="flex justify-center mb-4">
                <VoiceGuideButton
                  clipId="red_flag_message"
                  fallbackText={redFlagMsg}
                  language={ttsLang}
                  variant="inline"
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl text-charcoal mb-4">
                {doneTitle}
              </h1>
              <p className="font-body text-xl text-muted mb-8">
                {doneMsg}
              </p>
              <button
                onClick={() => {
                  if (sessionStorage.getItem('ayush_mode') === 'true') {
                    navigate('/ayush-assessment');
                  } else {
                    navigate('/records-upload');
                  }
                }}
                className="w-full min-h-[64px] text-xl rounded-[12px] bg-primary text-white font-body focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-primary/90 transition-colors"
              >
                {continueBtn}
              </button>
            </>
          )}
          {isSyncing && (
             <p className="text-primary text-sm font-body animate-pulse mt-4">Syncing offline data...</p>
          )}
        </QuestionCard>
      </div>
    );
  }

  if (!tree || !currentQId) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center">
        <p className="text-charcoal font-body text-lg">
          {isMr ? 'लोड होत आहे...' : isBn ? 'লোড হচ্ছে...' : isHi ? 'लोड हो रहा है...' : 'Loading...'}
        </p>
      </div>
    );
  }

  const currentQ = tree.questions[currentQId];
  const questionPrompt = isMr
    ? (currentQ.text_mr || currentQ.text_hi || currentQ.text)
    : isBn
    ? (currentQ.text_bn || currentQ.text_hi || currentQ.text)
    : isHi
    ? (currentQ.text_hi || currentQ.text)
    : currentQ.text;

  return (
    <div className="min-h-screen bg-sand flex flex-col pt-12 p-4 sm:p-6 relative overflow-x-hidden">
      <MandalaBackground />
      <div className="z-10 w-full box-border">
         <InterviewQuestion
           question={currentQ}
           totalSteps={Object.keys(tree.questions).length}
           currentStep={stepCount}
           onAnswer={handleAnswer}
           language={session?.language}
         />
      </div>
      {isSyncing && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-full shadow-lg font-body text-sm animate-pulse z-50">
          Syncing offline data...
        </div>
      )}
      <VoiceGuideButton 
        text={questionPrompt} 
        language={ttsLang} 
      />
    </div>
  );
}

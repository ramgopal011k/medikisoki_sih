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

  // Initialize session from localStorage lazily to avoid setState-in-effect
  const [session] = useState<SessionState | null>(() => {
    const sessionId = localStorage.getItem('patient_session') || localStorage.getItem('session_id');
    const complaint = localStorage.getItem('patient_complaint') || localStorage.getItem('chief_complaint') || 'Chest pain';
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
      const savedQId = localStorage.getItem(`interview_qid_${session.id}`);
      const savedStepCount = localStorage.getItem(`interview_step_${session.id}`);
      
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
      localStorage.removeItem(`interview_qid_${session.id}`);
      localStorage.removeItem(`interview_step_${session.id}`);
    } else {
      setCurrentQId(nextResult);
      localStorage.setItem(`interview_qid_${session.id}`, nextResult);
      localStorage.setItem(`interview_step_${session.id}`, (stepCount + 1).toString());
    }
  };

  if (isFinished) {
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
                {session?.language === 'hi' ? 'तत्काल ध्यान आवश्यक' : 'Immediate Attention Required'}
              </h1>
              <p className="font-body text-xl text-charcoal mb-4">
                {session?.language === 'hi'
                  ? 'आपके लक्षणों पर तुरंत ध्यान देने की आवश्यकता है। कृपया नर्स स्टेशन को सूचित करें।'
                  : 'Your symptoms require immediate attention. Please alert the nurse station.'}
              </p>
              <p className="font-body text-sm text-muted">
                Flag: {redFlagTriggered.flag_id}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl text-charcoal mb-4">
                {session?.language === 'hi' ? 'धन्यवाद' : 'Thank you'}
              </h1>
              <p className="font-body text-xl text-muted mb-8">
                {session?.language === 'hi'
                  ? 'आपका साक्षात्कार पूरा हो गया है। कृपया कुछ और सवालों के जवाब दें।'
                  : 'Your interview is complete. Please answer a few more questions.'}
              </p>
              <button
                onClick={() => {
                  if (localStorage.getItem('ayush_mode') === 'true') {
                    navigate('/ayush-assessment');
                  } else {
                    navigate('/records-upload');
                  }
                }}
                className="w-full min-h-[64px] text-xl rounded-[12px] bg-primary text-white font-body focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-primary/90 transition-colors"
              >
                {session?.language === 'hi' ? 'जारी रखें' : 'Continue'}
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
    return <div className="min-h-screen bg-sand flex items-center justify-center"><p>Loading...</p></div>;
  }

  const currentQ = tree.questions[currentQId];

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
        text={currentQ ? (session?.language === 'hi' ? (currentQ.text_hi || currentQ.text) : currentQ.text) : 'Please answer the clinical interview question.'} 
        language={session?.language === 'hi' ? 'hi-IN' : 'en-IN'} 
      />
    </div>
  );
}

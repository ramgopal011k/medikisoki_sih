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
import { API_URL, getAuthHeaders } from '@/lib/api';
import { VoiceGuideButton } from '../components/VoiceGuideButton';
import { useAsr } from '@/hooks/useAsr';
import { isReplannerEnabled, replan, scoreDifferentialPanel, fetchLlmFollowups, getDynamicQuestion, resetLlmFollowupCache } from '../lib/replan';
import type { Tier } from '../lib/expectedSeverity';

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
  retry_count?: number;
  provenance?: string;
  generated_by?: string;
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
  const { stopListening, clearTranscript } = useAsr();

  useEffect(() => {
    if (currentQId) {
      stopListening();
      clearTranscript();
    }
  }, [currentQId, stopListening, clearTranscript]);

  const [stepCount, setStepCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [redFlagTriggered, setRedFlagTriggered] = useState<RedFlagResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [replannerTier, setReplannerTier] = useState<Tier | null>(() => {
    const saved = sessionStorage.getItem('current_tier');
    return (saved as Tier) || null;
  });
  const [currentEs, setCurrentEs] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('current_es');
    return saved ? parseFloat(saved) : null;
  });
  const [currentConfidence, setCurrentConfidence] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('current_confidence');
    return saved ? parseInt(saved, 10) : null;
  });
  const [firedFlags, setFiredFlags] = useState<string[]>([]);
  const [accumulatedAnswers, setAccumulatedAnswers] = useState<Record<string, string | string[]>>({});
  const [answerHistory, setAnswerHistory] = useState<Array<{ question_id: string; question_text: string; answer: string }>>([]);
  const [panelUnavailable, setPanelUnavailable] = useState(false);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [answersSinceLastPanel, setAnswersSinceLastPanel] = useState(0);

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
        sessionStorage.removeItem('current_tier');
        sessionStorage.removeItem('current_es');
        sessionStorage.removeItem('current_confidence');
        resetLlmFollowupCache();
        setReplannerTier(null);
        setCurrentEs(null);
        setCurrentConfidence(null);
        setFiredFlags([]);
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
      const attempts = (fact.retry_count || 0) + 1;
      try {
        const res = await fetch(`${API_URL}/history-facts`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(fact)
        });

        // 404: Session no longer exists (stale) -> remove from IndexedDB
        if (res.status === 404) {
          console.warn(`[InterviewFlow] Dropping stale fact for non-existent session ${fact.session_id}`);
          continue;
        }

        // 200/201: Successfully synced -> remove from queue
        if (res.ok) {
          continue;
        }

        // 5xx: Transient server error -> keep in queue up to 3 attempts
        if (attempts < 3) {
          remainingQueue.push({ ...fact, retry_count: attempts });
        } else {
          console.warn(`[InterviewFlow] Dropping fact after max 3 retries:`, fact);
        }
      } catch {
        // Network failure -> keep in queue up to 3 attempts
        if (attempts < 3) {
          remainingQueue.push({ ...fact, retry_count: attempts });
        } else {
          console.warn(`[InterviewFlow] Dropping fact after max 3 retries:`, fact);
        }
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

    const currentQ = tree.questions[currentQId] || getDynamicQuestion(currentQId);
    if (!currentQ) return;

    // Calculate next step first so we know if it's a red flag
    let nextResult = currentQ.next(value);
    const redFlag = isRedFlag(nextResult) ? nextResult : null;

    // Prepare fact payload
    const isLlmQuestion = currentQId.startsWith('llm_q_');
    const payload: OfflineFact = {
      session_id: session.id,
      complaint: session.complaint,
      question_id: currentQId,
      question_text: currentQ.text,
      answer: answerText,
      answer_value: Array.isArray(value) ? value.join(',') : value,
      ...(redFlag ? { red_flag_id: redFlag.flag_id } : {}),
      ...(isLlmQuestion ? { provenance: 'patient_reported', generated_by: 'llm' } : {})
    };

    // Save fact (try online, fallback to IndexedDB queue)
    try {
      if (!navigator.onLine) throw new Error('Offline');
      const res = await fetch(`${API_URL}/history-facts`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      if (res.status === 404) {
        console.warn(`[InterviewFlow] Session ${session.id} not found — dropping fact`);
      } else if (!res.ok) {
        throw new Error('Server error');
      }
    } catch {
      // Improvement 2: IndexedDB offline fallback
      const queue: OfflineFact[] = (await get(OFFLINE_QUEUE_KEY)) || [];
      queue.push(payload);
      await set(OFFLINE_QUEUE_KEY, queue);
    }

    // FLAG OFF PATH: 100% legacy behavior
    if (!isReplannerEnabled()) {
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
      return;
    }

    // FLAG ON PATH: Expected Severity replanner decides next action
    // 1. Mark flag as fired (do NOT short-circuit interview immediately)
    let updatedFiredFlags = firedFlags;
    if (redFlag) {
      if (!updatedFiredFlags.includes(redFlag.flag_id)) {
        updatedFiredFlags = [...updatedFiredFlags, redFlag.flag_id];
        setFiredFlags(updatedFiredFlags);
      }
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

    // 2. Record answers in replanner state
    const updatedAnswers = { ...accumulatedAnswers, [currentQId]: value };
    const updatedHistory = [
      ...answerHistory,
      {
        question_id: currentQId,
        question_text: currentQ.text,
        answer: answerText,
        ...(isLlmQuestion ? { provenance: 'patient_reported', generated_by: 'llm' } : {})
      }
    ];
    setAccumulatedAnswers(updatedAnswers);
    setAnswerHistory(updatedHistory);
    const newAnswersCount = answersSinceLastPanel + 1;
    setAnswersSinceLastPanel(newAnswersCount);

    let activeTier = replannerTier;

    // 3. Differential panel refresh (after 2+ answers, red flag, or uninitialized tier)
    if (newAnswersCount >= 2 || redFlag || activeTier === null) {
      setIsPanelLoading(true);
      try {
        const patientAge = sessionStorage.getItem('patient_age');
        const patientGender = sessionStorage.getItem('patient_gender');

        const panelResult = await scoreDifferentialPanel(session.complaint, {
          currentQId,
          answers: updatedAnswers,
          history: updatedHistory,
          firedFlags: updatedFiredFlags,
          patientContext: {
            age: patientAge ? parseInt(patientAge, 10) : null,
            sex: (patientGender as any) || null
          }
        });

        if (panelResult) {
          activeTier = panelResult.tier;
          setReplannerTier(panelResult.tier);
          setCurrentEs(panelResult.expected_severity);
          sessionStorage.setItem('current_es', String(panelResult.expected_severity));
          sessionStorage.setItem('current_tier', panelResult.tier);
          if (typeof panelResult.confidence === 'number') {
            setCurrentConfidence(panelResult.confidence);
            sessionStorage.setItem('current_confidence', String(panelResult.confidence));
          }
          setAnswersSinceLastPanel(0);
          setPanelUnavailable(false);
        } else {
          setPanelUnavailable(true);
        }
      } catch (panelErr) {
        console.warn('[InterviewFlow] panel error fallback:', panelErr);
        setPanelUnavailable(true);
      } finally {
        setIsPanelLoading(false);
      }
    }

    // Trigger dynamic LLM follow-ups once when 2+ answers or comorbidities are present
    const comorbStorage = sessionStorage.getItem('patient_comorbidities') || sessionStorage.getItem('comorbidities');
    const patientAge = sessionStorage.getItem('patient_age');
    const patientGender = sessionStorage.getItem('patient_gender');
    if (newAnswersCount >= 2 || comorbStorage || Object.values(updatedAnswers).some(a => /diabet|hypertens|sugar|bp/i.test(String(a)))) {
      try {
        await fetchLlmFollowups(session.complaint, {
          currentQId,
          answers: updatedAnswers,
          history: updatedHistory,
          firedFlags: updatedFiredFlags,
          patientContext: {
            age: patientAge ? parseInt(patientAge, 10) : null,
            sex: (patientGender as any) || null
          }
        });
      } catch (llmErr) {
        console.warn('[InterviewFlow] fetchLlmFollowups error:', llmErr);
      }
    }

    // 4. If critical tier triggered by ES panel, lock interview immediately
    if (activeTier === 'critical') {
      const critFlag: RedFlagResult = redFlag || { type: 'red_flag', flag_id: 'PANEL_CRITICAL' };
      setRedFlagTriggered(critFlag);
      setIsFinished(true);
      sessionStorage.removeItem(`interview_qid_${session.id}`);
      sessionStorage.removeItem(`interview_step_${session.id}`);
      return;
    }

    // 5. Let replan() decide next action based on tier
    const replanned = replan(
      tree,
      {
        currentQId,
        answers: updatedAnswers,
        history: updatedHistory,
        firedFlags: updatedFiredFlags,
        patientContext: {
          age: patientAge ? parseInt(patientAge, 10) : null,
          sex: (patientGender as any) || null
        }
      },
      activeTier || 'low'
    );

    let nextQId: string | null = null;
    if (replanned === null) {
      nextQId = null;
    } else if (typeof replanned === 'string') {
      nextQId = replanned;
    } else if (typeof replanned === 'object' && 'id' in replanned) {
      nextQId = (replanned as any).id;
    } else if (isRedFlag(replanned as any)) {
      setRedFlagTriggered(replanned as RedFlagResult);
      setIsFinished(true);
      sessionStorage.removeItem(`interview_qid_${session.id}`);
      sessionStorage.removeItem(`interview_step_${session.id}`);
      return;
    }

    // Advance the interview
    setStepCount(prev => prev + 1);

    if (nextQId === null) {
      setIsFinished(true);
      sessionStorage.removeItem(`interview_qid_${session.id}`);
      sessionStorage.removeItem(`interview_step_${session.id}`);
    } else {
      setCurrentQId(nextQId);
      sessionStorage.setItem(`interview_qid_${session.id}`, nextQId);
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
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-4 sm:p-6 pb-28 sm:pb-12 pb-[env(safe-area-inset-bottom,32px)] relative overflow-x-hidden">
        <MandalaBackground />
        <QuestionCard className="w-full max-w-2xl text-center z-10 p-8 sm:p-12 box-border mb-8 sm:mb-0">
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
              <div className="w-full pb-[env(safe-area-inset-bottom,24px)]">
                <button
                  onClick={() => {
                    if (sessionStorage.getItem('ayush_mode') === 'true') {
                      navigate('/ayush-assessment');
                    } else {
                      navigate('/records-upload');
                    }
                  }}
                  className="w-full min-h-[56px] sm:min-h-[64px] text-xl rounded-[12px] bg-primary text-white font-body focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-primary/90 transition-colors shadow-md"
                >
                  {continueBtn}
                </button>
              </div>
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

  const currentQ = tree.questions[currentQId] || getDynamicQuestion(currentQId);
  if (!currentQ) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center">
        <p className="text-charcoal font-body text-lg">
          {isMr ? 'लोड होत आहे...' : isBn ? 'লোড হচ্ছে...' : isHi ? 'लोड हो रहा है...' : 'Loading...'}
        </p>
      </div>
    );
  }
  const questionPrompt = isMr
    ? (currentQ.text_mr || currentQ.text_hi || currentQ.text)
    : isBn
    ? (currentQ.text_bn || currentQ.text_hi || currentQ.text)
    : isHi
    ? (currentQ.text_hi || currentQ.text)
    : currentQ.text;

  return (
    <div className="min-h-screen bg-sand flex flex-col pt-12 p-4 sm:p-6 pb-28 sm:pb-12 pb-[env(safe-area-inset-bottom,32px)] relative overflow-x-hidden">
      <MandalaBackground />
      <div className="z-10 w-full box-border mb-16 sm:mb-8">
         {isReplannerEnabled() && (
           <div
             className={`max-w-xl mx-auto mb-3 flex items-center justify-between px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold shadow-xs transition-all ${
               isPanelLoading || (!replannerTier && !panelUnavailable && stepCount === 0)
                 ? 'bg-gray-500/10 border-gray-500/30 text-gray-700'
                 : panelUnavailable || !replannerTier
                 ? 'bg-amber-500/10 border-amber-500/30 text-amber-800'
                 : replannerTier === 'critical'
                 ? 'bg-red-500/10 border-red-500/30 text-red-700'
                 : replannerTier === 'high'
                 ? 'bg-orange-500/10 border-orange-500/30 text-orange-700'
                 : replannerTier === 'moderate'
                 ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-800'
                 : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800'
             } ${
               currentConfidence !== null && currentConfidence < 50
                 ? 'border-amber-400 border-2'
                 : ''
             }`}
           >
             <span className="flex items-center gap-1.5">
               {isPanelLoading || (!replannerTier && !panelUnavailable && stepCount === 0) ? (
                 <>
                   <span className="text-gray-500">●</span>
                   <span>ES: Analyzing...</span>
                 </>
               ) : panelUnavailable || !replannerTier ? (
                 <>
                   <span className="text-amber-600">●</span>
                   <span>ES: Unavailable (LLM Error)</span>
                 </>
               ) : (
                 <>
                   <span
                     className={
                       replannerTier === 'critical'
                         ? 'text-red-600'
                         : replannerTier === 'high'
                         ? 'text-orange-600'
                         : replannerTier === 'moderate'
                         ? 'text-yellow-600'
                         : 'text-emerald-600'
                     }
                   >
                     ●
                   </span>
                   <span>
                     {replannerTier === 'critical' && 'CRITICAL'}
                     {replannerTier === 'high' && 'HIGH'}
                     {replannerTier === 'moderate' && 'MODERATE'}
                     {replannerTier === 'low' && 'LOW'}
                     {currentEs !== null && !isNaN(currentEs)
                       ? ` (ES: ${currentEs.toFixed(1)}${currentConfidence !== null ? ` | ${currentConfidence}% conf` : ''})`
                       : ''}
                     {currentConfidence !== null && currentConfidence < 50 && (
                       <span className="ml-1 text-amber-600 font-bold" title="Low certainty">*</span>
                     )}
                   </span>
                 </>
               )}
             </span>
             <span className="text-[11px] opacity-75 font-normal uppercase tracking-wider">
               {isPanelLoading || (!replannerTier && !panelUnavailable && stepCount === 0)
                 ? 'Analyzing'
                 : panelUnavailable || !replannerTier
                 ? 'Fallback'
                 : currentConfidence !== null && currentConfidence < 50
                 ? 'Low Certainty'
                 : 'Expected Severity'}
             </span>
           </div>
         )}
         <InterviewQuestion
           key={currentQ.id}
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

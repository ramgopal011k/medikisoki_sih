import type { InterviewTree, InterviewQuestion, RedFlagResult, InterviewOption } from '@/types/interview-tree';
import { isRedFlag } from '@/types/interview-tree';
import type { Tier, DifferentialPanel, ExpectedSeverityResult } from './expectedSeverity';
import { computeExpectedSeverity } from './expectedSeverity';
import { API_URL, getAuthHeaders, getAuthToken } from './api';

export const isReplannerEnabled = (): boolean => {
  if (typeof sessionStorage !== 'undefined') {
    const override = sessionStorage.getItem('VITE_INTERVIEW_REPLANNER');
    if (override === 'true') return true;
    if (override === 'false') return false;
  }
  if (typeof window !== 'undefined' && (window as any).__VITE_INTERVIEW_REPLANNER !== undefined) {
    return (window as any).__VITE_INTERVIEW_REPLANNER === true;
  }
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_INTERVIEW_REPLANNER === 'true';
};

export interface ReplanState {
  currentQId: string;
  answers: Record<string, string | string[]>;
  history?: Array<{
    question_id: string;
    question_text: string;
    answer: string;
  }>;
  firedFlags?: string[];
  patientContext?: {
    age?: number | null;
    sex?: 'male' | 'female' | 'other' | null;
    comorbidities?: string[];
    medications?: string[];
  };
  smartVoiceConfidence?: number;
}

// Module-level timestamp and cache for debouncing panel requests
let lastPanelCallTimestamp = 0;
let lastCachedPanelResult: (ExpectedSeverityResult & { recommended_probe?: string | null; confidence?: number }) | null = null;
let pendingPanelPromise: Promise<(ExpectedSeverityResult & { recommended_probe?: string | null; confidence?: number }) | null> | null = null;
let lastRecommendedProbe: string | null = null;

export interface DynamicLlmQuestion {
  id: string;
  text: string;
  text_hi?: string;
  text_mr?: string;
  text_bn?: string;
  type: 'single_choice';
  options: InterviewOption[];
  reasoning?: string;
}

let cachedLlmQuestions: DynamicLlmQuestion[] = [];
let hasFetchedLlmQuestions = false;
let isFetchingLlmQuestions = false;
const dynamicQuestionsRegistry: Record<string, InterviewQuestion> = {};

export function getDynamicQuestion(id: string): InterviewQuestion | undefined {
  return dynamicQuestionsRegistry[id];
}

export function registerDynamicQuestion(q: InterviewQuestion): void {
  dynamicQuestionsRegistry[q.id] = q;
}

export function getCachedLlmQuestions(): DynamicLlmQuestion[] {
  return cachedLlmQuestions;
}

export function resetLlmFollowupCache(): void {
  cachedLlmQuestions = [];
  hasFetchedLlmQuestions = false;
  isFetchingLlmQuestions = false;
  for (const k of Object.keys(dynamicQuestionsRegistry)) {
    delete dynamicQuestionsRegistry[k];
  }
}

export function getLastRecommendedProbe(): string | null {
  return lastRecommendedProbe;
}

export function setLastRecommendedProbe(probe: string | null): void {
  lastRecommendedProbe = probe;
}

/** Rule 1: SKIP — drop questions whose prerequisites are unmet */
export function isQuestionSkipped(questionId: string, state: ReplanState): boolean {
  // Prerequisite checks: e.g. which arm / radiation details when patient reported no radiation
  if (questionId === 'q_chest_radiation_arm' || questionId === 'q_radiation_loc') {
    const radAnswer = state.answers['q_chest_radiation'] || state.answers['radiation'];
    if (radAnswer === 'No' || radAnswer === 'None' || radAnswer === 'no' || radAnswer === 'none') {
      return true;
    }
  }

  // Cough blood character when cough blood is 'No'
  if (questionId === 'q_cough_blood_amt') {
    const bloodAns = state.answers['q_cough_blood'] || state.answers['blood'];
    if (bloodAns === 'No' || bloodAns === 'no') {
      return true;
    }
  }

  return false;
}

/** Rule 2: PRIORITY — calculate question priority score based on tier and clinical weight */
export function getQuestionPriorityScore(q: InterviewQuestion, tier: Tier): number {
  let score = 50;

  // High urgency questions get elevated priority if tier is high or critical
  const text = (q.text || '').toLowerCase();
  const id = (q.id || '').toLowerCase();

  const isCriticalTopic =
    id.includes('severity') ||
    id.includes('breath') ||
    id.includes('radiation') ||
    id.includes('blood') ||
    text.includes('severe') ||
    text.includes('breath') ||
    text.includes('radiat') ||
    text.includes('blood');

  if (tier === 'critical' || tier === 'high') {
    if (isCriticalTopic) score += 40;
  } else if (tier === 'moderate') {
    if (isCriticalTopic) score += 20;
  }

  return score;
}

/** Rule 3: PROBE — find probe questions in the tree for high/critical tier */
export function getProbes(
  tree: InterviewTree,
  state: ReplanState,
  tier: Tier
): InterviewQuestion[] {
  if (tier !== 'high' && tier !== 'critical') {
    return [];
  }

  const probes: InterviewQuestion[] = [];
  for (const qId of Object.keys(tree.questions)) {
    // If not yet answered and not current question
    if (!state.answers[qId] && qId !== state.currentQId && !isQuestionSkipped(qId, state)) {
      const q = tree.questions[qId];
      const priority = getQuestionPriorityScore(q, tier);
      if (priority >= 70) {
        probes.push(q);
      }
    }
  }

  return probes;
}

/** Rule 4: CLARIFY — trigger LLM clarify check when voice confidence is low */
export function shouldClarify(state: ReplanState): boolean {
  if (state.smartVoiceConfidence !== undefined && state.smartVoiceConfidence < 0.6) {
    return true;
  }
  return false;
}

/** Rule 5: SCORE — call /api/ai/differential-panel with 500ms debounce */
export async function scoreDifferentialPanel(
  chiefComplaint: string,
  state: ReplanState,
  debounceMs: number = 500
): Promise<(ExpectedSeverityResult & { recommended_probe?: string | null; confidence?: number }) | null> {
  const now = Date.now();
  if (now - lastPanelCallTimestamp < debounceMs && lastCachedPanelResult) {
    return lastCachedPanelResult;
  }

  if (pendingPanelPromise) {
    return pendingPanelPromise;
  }

  const sessionId = typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('session_id') || sessionStorage.getItem('patient_session') || undefined)
    : undefined;

  const payload = {
    session_id: sessionId,
    chief_complaint: chiefComplaint,
    answers: state.history || Object.entries(state.answers).map(([qid, ans]) => ({
      question_id: qid,
      question_text: qid,
      answer: Array.isArray(ans) ? ans.join(', ') : String(ans)
    })),
    patient_context: {
      age: state.patientContext?.age ?? null,
      sex: state.patientContext?.sex ?? null,
      comorbidities: state.patientContext?.comorbidities || [],
      medications: state.patientContext?.medications || []
    },
    fired_flags: state.firedFlags || []
  };

  const token = getAuthToken();
  if (!token) {
    console.warn('[replan] No auth token available, skipping differential panel call');
    return null;
  }

  pendingPanelPromise = (async () => {
    try {
      lastPanelCallTimestamp = Date.now();
      const res = await fetch(`${API_URL}/api/ai/differential-panel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Panel API returned status ${res.status}`);
      }

      const data = await res.json();
      lastRecommendedProbe = data.recommended_probe ?? null;

      const answeredList = state.history?.map(h => h.question_id) || Object.keys(state.answers || {});
      const hasUnansweredProbe = Boolean(data.recommended_probe && !answeredList.includes(data.recommended_probe));

      const effectiveTier = (data.tier === 'critical' && hasUnansweredProbe)
        ? 'high'
        : data.tier;

      const result: ExpectedSeverityResult & { recommended_probe?: string | null; confidence?: number } = {
        expected_severity: data.expected_severity,
        safety_override: data.safety_override,
        override_reason: data.override_reason,
        tier: effectiveTier,
        normalized_panel: data.panel || [],
        recommended_probe: data.recommended_probe ?? null,
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined
      };

      lastCachedPanelResult = result;
      return result;
    } catch (err) {
      console.warn('[replan] scoreDifferentialPanel fallback:', err);
      return null;
    } finally {
      pendingPanelPromise = null;
    }
  })();

  return pendingPanelPromise;
}

/**
 * Fetches dynamic 1-2 LLM generated follow-up questions based on patient comorbidities and answers.
 */
export async function fetchLlmFollowups(
  chiefComplaint: string,
  state: ReplanState
): Promise<DynamicLlmQuestion[]> {
  if (hasFetchedLlmQuestions) {
    return cachedLlmQuestions;
  }
  if (isFetchingLlmQuestions) {
    return [];
  }

  const token = getAuthToken();
  if (!token) return [];

  const ageStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('patient_age') : null;
  const genderStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('patient_gender') : null;
  const comorbiditiesStr = typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('patient_comorbidities') || sessionStorage.getItem('comorbidities'))
    : null;

  let comorbidities: string[] = state.patientContext?.comorbidities ? [...state.patientContext.comorbidities] : [];
  if (comorbiditiesStr) {
    try {
      const parsed = JSON.parse(comorbiditiesStr);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!comorbidities.includes(item)) comorbidities.push(item);
        }
      }
    } catch {
      const items = comorbiditiesStr.split(',').map(s => s.trim()).filter(Boolean);
      for (const item of items) {
        if (!comorbidities.includes(item)) comorbidities.push(item);
      }
    }
  }

  // Also check answers history for comorbidities
  const historyAnswers = state.history || [];
  for (const h of historyAnswers) {
    const text = `${h.question_id} ${h.answer}`.toLowerCase();
    if (text.includes('diabet') && !comorbidities.includes('diabetes')) comorbidities.push('diabetes');
    if ((text.includes('hypertens') || text.includes('bp') || text.includes('blood pressure')) && !comorbidities.includes('hypertension')) comorbidities.push('hypertension');
    if ((text.includes('asthma') || text.includes('copd')) && !comorbidities.includes('asthma')) comorbidities.push('asthma');
  }

  const payload = {
    chief_complaint: chiefComplaint,
    answers: state.history || Object.entries(state.answers).map(([qid, ans]) => ({
      question_id: qid,
      question_text: qid,
      answer: Array.isArray(ans) ? ans.join(', ') : String(ans)
    })),
    patient_context: {
      age: state.patientContext?.age ?? (ageStr ? parseInt(ageStr, 10) : null),
      sex: state.patientContext?.sex ?? (genderStr as any) ?? null,
      comorbidities,
      medications: state.patientContext?.medications || []
    }
  };

  isFetchingLlmQuestions = true;
  try {
    const res = await fetch(`${API_URL}/api/ai/generate-followups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions)) {
        cachedLlmQuestions = data.questions.map((q: any, idx: number) => {
          const id = q.id || `llm_q_${idx + 1}`;
          const formatted: DynamicLlmQuestion = {
            id,
            text: q.text,
            text_hi: q.text_hi || q.text,
            type: 'single_choice' as const,
            options: [
              { value: 'Yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
              { value: 'No', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' },
              { value: 'Not sure', label: 'Not sure', label_hi: 'पता नहीं', label_mr: 'माहित नाही', label_bn: 'জানি না' }
            ],
            reasoning: q.reasoning
          };

          const interviewQ: InterviewQuestion = {
            id: formatted.id,
            text: formatted.text,
            text_hi: formatted.text_hi,
            type: 'single_choice',
            options: formatted.options,
            next: () => 'next_after_probe'
          };
          registerDynamicQuestion(interviewQ);
          return formatted;
        });
        hasFetchedLlmQuestions = true;
      }
    }
  } catch (err) {
    console.warn('[replan] fetchLlmFollowups error:', err);
  } finally {
    isFetchingLlmQuestions = false;
  }

  return cachedLlmQuestions;
}

/**
 * Resolves the next question in the tree when resuming after a probe question
 */
export function normalTreeNext(
  tree: InterviewTree,
  state: ReplanState
): InterviewQuestion | string | null {
  // 1. If history exists, find the question asked immediately before this probe
  if (state.history && state.history.length > 0) {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const qId: string = state.history[i].question_id;
      // Skip probe questions and LLM questions
      if (qId.startsWith('llm_q_')) {
        continue;
      }
      const existingQ: InterviewQuestion | undefined = tree.questions[qId] || dynamicQuestionsRegistry[qId];
      if (existingQ) {
        try {
          const dummyNext = existingQ.next('dummy' as any);
          if (dummyNext === 'next_after_probe') {
            continue;
          }
        } catch {
          // Ignore
        }
      }
      const prevQ: InterviewQuestion | undefined = tree.questions[qId];
      if (prevQ) {
        const prevAns = state.answers[qId];
        const prevNext = prevAns !== undefined ? prevQ.next(prevAns) : null;
        let contId: string | null = null;
        if (typeof prevNext === 'string' && prevNext !== 'next_after_probe') {
          contId = prevNext;
        } else if (isRedFlag(prevNext) && prevQ.options) {
          for (const opt of prevQ.options) {
            const alt = prevQ.next(opt.value);
            if (typeof alt === 'string' && alt !== 'next_after_probe' && !state.answers[alt]) {
              contId = alt;
              break;
            }
          }
        }
        if (contId && !state.answers[contId]) {
          return tree.questions[contId] || contId;
        }
      }
    }
  }

  // 2. Main tree traversal from start_question_id following recorded answers
  let curr: string | null = tree.start_question_id;
  const visited = new Set<string>();
  while (curr && !visited.has(curr)) {
    visited.add(curr);
    const ans: string | string[] | undefined = state.answers[curr];
    if (ans === undefined) {
      return tree.questions[curr] || curr;
    }
    const q: InterviewQuestion | undefined = tree.questions[curr];
    if (!q) break;
    let n: string | RedFlagResult | null = null;
    try {
      n = q.next(ans);
    } catch {
      n = null;
    }
    if (typeof n === 'string' && n !== 'next_after_probe') {
      curr = n;
    } else if (isRedFlag(n) && q.options) {
      let foundAlt = false;
      for (const opt of q.options) {
        const alt = q.next(opt.value);
        if (typeof alt === 'string' && alt !== 'next_after_probe' && !state.answers[alt]) {
          curr = alt;
          foundAlt = true;
          break;
        }
      }
      if (!foundAlt) break;
    } else {
      break;
    }
  }

  // 3. Fallback to first unasked non-probe question in tree
  for (const qId of Object.keys(tree.questions)) {
    const q: InterviewQuestion | undefined = tree.questions[qId];
    if (!state.answers[qId] && qId !== state.currentQId && !isQuestionSkipped(qId, state)) {
      try {
        if (q && q.next('dummy' as any) !== 'next_after_probe') {
          return q || qId;
        }
      } catch {
        return q || qId;
      }
    }
  }

  return null;
}

/**
 * Main replan() function
 * Returns next question ID, next Question object, RedFlagResult, or null
 */
export function replan(
  tree: InterviewTree,
  state: ReplanState,
  tier: Tier,
  panelResponse?: { recommended_probe?: string | null } | null
): InterviewQuestion | string | RedFlagResult | null {
  // If tier is critical, safety override locks/stops interview flow
  if (tier === 'critical') {
    return null;
  }

  const currentQ: InterviewQuestion | undefined = tree.questions[state.currentQId] || dynamicQuestionsRegistry[state.currentQId];
  if (!currentQ) return null;

  const currentAnswer = state.answers[state.currentQId];
  const standardNext = currentAnswer !== undefined ? currentQ.next(currentAnswer) : null;

  const answeredIds: string[] = (state as any).answered || Object.keys(state.answers || {});

  // Handle resume logic after probe / LLM question:
  // The `next_after_probe` sentinel maps to the node the tree would have gone to without the probe.
  if (standardNext === 'next_after_probe') {
    // If another LLM question in queue is still unanswered, ask it next
    for (const llmQ of cachedLlmQuestions) {
      if (!answeredIds.includes(llmQ.id) && state.currentQId !== llmQ.id) {
        const interviewQ: InterviewQuestion = dynamicQuestionsRegistry[llmQ.id] || {
          id: llmQ.id,
          text: llmQ.text,
          text_hi: llmQ.text_hi,
          type: 'single_choice',
          options: llmQ.options,
          next: () => 'next_after_probe'
        };
        registerDynamicQuestion(interviewQ);
        if (tree && !tree.questions[llmQ.id]) {
          tree.questions[llmQ.id] = interviewQ;
        }
        return interviewQ;
      }
    }
    return normalTreeNext(tree, state);
  }

  // Before returning standard tree question, check for recommended probe
  const recommendedProbe = panelResponse !== undefined
    ? panelResponse?.recommended_probe
    : lastRecommendedProbe;

  if (
    recommendedProbe &&
    !answeredIds.includes(recommendedProbe) &&
    tree.questions[recommendedProbe] &&
    state.currentQId !== recommendedProbe
  ) {
    if (lastRecommendedProbe === recommendedProbe) {
      lastRecommendedProbe = null;
    }
    return tree.questions[recommendedProbe];
  }

  // Check for dynamic LLM generated questions
  for (const llmQ of cachedLlmQuestions) {
    if (!answeredIds.includes(llmQ.id) && state.currentQId !== llmQ.id) {
      const interviewQ: InterviewQuestion = dynamicQuestionsRegistry[llmQ.id] || {
        id: llmQ.id,
        text: llmQ.text,
        text_hi: llmQ.text_hi,
        type: 'single_choice',
        options: llmQ.options,
        next: () => 'next_after_probe'
      };
      registerDynamicQuestion(interviewQ);
      if (tree && !tree.questions[llmQ.id]) {
        tree.questions[llmQ.id] = interviewQ;
      }
      return interviewQ;
    }
  }

  // If a red flag was returned by next()
  let nextCandidateId: string | null = null;

  if (isRedFlag(standardNext)) {
    // Under replanner mode, a red flag alone does not terminate if tier is not critical.
    // Try to find the continuation question from alternative branches first
    if (currentQ.options) {
      for (const opt of currentQ.options) {
        const altNext = currentQ.next(opt.value);
        if (typeof altNext === 'string' && !state.answers[altNext]) {
          nextCandidateId = altNext;
          break;
        }
      }
    }

    // If tier is high, see if a higher-priority probe should take precedence
    if (tier === 'high') {
      const probes = getProbes(tree, state, tier);
      if (probes.length > 0) {
        probes.sort((a, b) => getQuestionPriorityScore(b, tier) - getQuestionPriorityScore(a, tier));
        return probes[0];
      }
    }

    // Fallback to first unasked question in the tree
    if (!nextCandidateId) {
      for (const qId of Object.keys(tree.questions)) {
        if (!state.answers[qId] && qId !== state.currentQId && !isQuestionSkipped(qId, state)) {
          nextCandidateId = qId;
          break;
        }
      }
    }

    if (nextCandidateId) {
      return tree.questions[nextCandidateId] || nextCandidateId;
    }

    return null;
  } else {
    nextCandidateId = typeof standardNext === 'string' ? standardNext : null;
  }

  // Apply Rule 1: SKIP — skip questions whose prerequisites are unmet
  while (nextCandidateId && isQuestionSkipped(nextCandidateId, state)) {
    const skippedQ = tree.questions[nextCandidateId];
    if (skippedQ) {
      const skipNext = skippedQ.next('N/A');
      if (typeof skipNext === 'string') {
        nextCandidateId = skipNext;
      } else {
        nextCandidateId = null;
        break;
      }
    } else {
      nextCandidateId = null;
      break;
    }
  }

  // Apply Rule 2 & 3: PROBE / PRIORITY when in high tier
  if (tier === 'high') {
    const probes = getProbes(tree, state, tier);
    if (probes.length > 0) {
      // Find the highest priority probe that hasn't been answered
      probes.sort((a, b) => getQuestionPriorityScore(b, tier) - getQuestionPriorityScore(a, tier));
      return probes[0];
    }
  }

  return nextCandidateId ? tree.questions[nextCandidateId] || nextCandidateId : null;
}

import type { InterviewTree, InterviewQuestion, RedFlagResult } from '@/types/interview-tree';
import { isRedFlag } from '@/types/interview-tree';
import type { Tier, DifferentialPanel, ExpectedSeverityResult } from './expectedSeverity';
import { computeExpectedSeverity } from './expectedSeverity';
import { API_URL, getAuthHeaders } from './api';

export const isReplannerEnabled = (): boolean => {
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
let lastCachedPanelResult: ExpectedSeverityResult | null = null;
let pendingPanelPromise: Promise<ExpectedSeverityResult | null> | null = null;

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
): Promise<ExpectedSeverityResult | null> {
  const now = Date.now();
  if (now - lastPanelCallTimestamp < debounceMs && lastCachedPanelResult) {
    return lastCachedPanelResult;
  }

  if (pendingPanelPromise) {
    return pendingPanelPromise;
  }

  const payload = {
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

  pendingPanelPromise = (async () => {
    try {
      lastPanelCallTimestamp = Date.now();
      const res = await fetch(`${API_URL}/api/ai/differential-panel`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Panel API returned status ${res.status}`);
      }

      const data = await res.json();
      const result: ExpectedSeverityResult = {
        expected_severity: data.expected_severity,
        safety_override: data.safety_override,
        override_reason: data.override_reason,
        tier: data.tier,
        normalized_panel: data.panel || []
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
 * Main replan() function
 * Returns next question ID, next Question object, RedFlagResult, or null
 */
export function replan(
  tree: InterviewTree,
  state: ReplanState,
  tier: Tier
): InterviewQuestion | string | RedFlagResult | null {
  // If tier is critical, safety override locks/stops interview flow
  if (tier === 'critical') {
    return null;
  }

  const currentQ = tree.questions[state.currentQId];
  if (!currentQ) return null;

  const currentAnswer = state.answers[state.currentQId];
  const standardNext = currentAnswer !== undefined ? currentQ.next(currentAnswer) : null;

  // If a red flag was returned by next()
  if (isRedFlag(standardNext)) {
    return standardNext;
  }

  let nextCandidateId: string | null = typeof standardNext === 'string' ? standardNext : null;

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

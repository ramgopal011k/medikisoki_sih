import type { InterviewTree, InterviewQuestion, RedFlagResult } from '@/types/interview-tree';
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
let lastCachedPanelResult: (ExpectedSeverityResult & { recommended_probe?: string | null }) | null = null;
let pendingPanelPromise: Promise<(ExpectedSeverityResult & { recommended_probe?: string | null }) | null> | null = null;
let lastRecommendedProbe: string | null = null;

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

      const result: ExpectedSeverityResult & { recommended_probe?: string | null } = {
        expected_severity: data.expected_severity,
        safety_override: data.safety_override,
        override_reason: data.override_reason,
        tier: effectiveTier,
        normalized_panel: data.panel || [],
        recommended_probe: data.recommended_probe ?? null
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
 * Resolves the next question in the tree when resuming after a probe question
 */
export function normalTreeNext(
  tree: InterviewTree,
  state: ReplanState
): InterviewQuestion | string | null {
  // 1. If history exists, find the question asked immediately before this probe
  if (state.history && state.history.length > 0) {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const qId = state.history[i].question_id;
      // Skip probe questions
      if (tree.questions[qId]) {
        try {
          const dummyNext = tree.questions[qId].next('dummy' as any);
          if (dummyNext === 'next_after_probe') {
            continue;
          }
        } catch {
          // Ignore
        }
      }
      const prevQ = tree.questions[qId];
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
    const ans = state.answers[curr];
    if (ans === undefined) {
      return tree.questions[curr] || curr;
    }
    const q = tree.questions[curr];
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
    const q = tree.questions[qId];
    if (!state.answers[qId] && qId !== state.currentQId && !isQuestionSkipped(qId, state)) {
      try {
        if (q.next('dummy' as any) !== 'next_after_probe') {
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

  const currentQ = tree.questions[state.currentQId];
  if (!currentQ) return null;

  const currentAnswer = state.answers[state.currentQId];
  const standardNext = currentAnswer !== undefined ? currentQ.next(currentAnswer) : null;

  // Handle resume logic after probe:
  // The `next_after_probe` sentinel maps to the node the tree would have gone to without the probe.
  if (standardNext === 'next_after_probe') {
    return normalTreeNext(tree, state);
  }

  // Before returning standard tree question, check for recommended probe
  const recommendedProbe = panelResponse !== undefined
    ? panelResponse?.recommended_probe
    : lastRecommendedProbe;

  const answeredIds: string[] = (state as any).answered || Object.keys(state.answers || {});

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

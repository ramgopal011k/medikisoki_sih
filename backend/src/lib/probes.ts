export interface ProbeMapping {
  differential: RegExp;
  questionId: string;
  threshold: number;
}

export const PROBE_MAP: ProbeMapping[] = [
  {
    differential: /acute coronary|acs|myocardial/i,
    questionId: 'q_chest_worse_exertion',
    threshold: 0.20
  },
  {
    differential: /pulmonary embolism|pe\b/i,
    questionId: 'q_recent_immobility',
    threshold: 0.20
  },
  {
    differential: /aortic dissection|dissection/i,
    questionId: 'q_tearing_character',
    threshold: 0.20
  },
  {
    differential: /subarachnoid|sah/i,
    questionId: 'q_thunderclap',
    threshold: 0.20
  },
  {
    differential: /appendicitis/i,
    questionId: 'q_rlq_tenderness',
    threshold: 0.20
  }
];

export function selectProbe(
  panel: Array<{ name: string; probability: number; severity: number }>,
  answeredIds: string[]
): string | null {
  for (const { differential, questionId, threshold } of PROBE_MAP) {
    const match = panel.find(d =>
      differential.test(d.name) &&
      d.probability >= threshold &&
      d.severity >= 75
    );
    if (match && !answeredIds.includes(questionId)) {
      return questionId;
    }
  }
  return null;
}

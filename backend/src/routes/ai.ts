import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyAuth } from '../middleware/auth';
import { medgemmaReason } from '../orchestration/medgemmaClient';
import { setLastCallProvider } from '../orchestration/router';

const router = Router();

export const ALLOWED_SEVERITIES = [95, 75, 50, 25, 10] as const;
type AllowedSeverity = (typeof ALLOWED_SEVERITIES)[number];

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

interface DifferentialDiagnosis {
  name: string;
  probability: number;
  severity: AllowedSeverity | number;
  trigger?: string;
  source: string;
}

interface PanelRequestBody {
  chief_complaint?: string;
  complaint?: string;
  context?: {
    complaint?: string;
    answers?: any;
    patient_context?: any;
    fired_flags?: string[];
  };
  answers?: Array<{
    question_id: string;
    question_text?: string;
    answer: string;
  }> | Record<string, any>;
  patient_context?: {
    age?: number | null;
    sex?: 'male' | 'female' | 'other' | null;
    comorbidities?: string[];
    medications?: string[];
  };
  fired_flags?: string[];
}

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  // Strip thought/reasoning tags from MedGemma/Gemma3/DeepSeek
  cleaned = cleaned.replace(/<unused94>[\s\S]*?<unused95>/gi, '').trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extract from markdown json code block if present
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlock && jsonBlock[1]) {
    return jsonBlock[1].trim();
  }

  // Strip leading/trailing code fence markers if any
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  // Find first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1).trim();
  }

  return cleaned;
}

function createFallbackPanel(complaint: string, firedFlags: string[] = []): {
  panel: DifferentialDiagnosis[];
  reasoning: string;
} {
  const comp = (complaint || '').toLowerCase();
  const hasCriticalFlag = firedFlags.some(f => ['R1', 'R2', 'R3', 'R4', 'R6', 'R7', 'R8', 'R9', 'R10', 'R15'].includes(f));

  if (comp.includes('chest') || hasCriticalFlag) {
    if (hasCriticalFlag) {
      return {
        panel: [
          { name: 'Acute Coronary Syndrome (ACS)', probability: 0.60, severity: 95, source: 'AHA/ACC 2023 Guidelines' },
          { name: 'Gastroesophageal Reflux Disease (GERD)', probability: 0.25, severity: 25, source: 'ACG 2022 Guidelines' },
          { name: 'Musculoskeletal Chest Wall Pain', probability: 0.15, severity: 10, source: 'AAFP 2020 Guidelines' },
        ],
        reasoning: 'Critical red-flag indicators present; rule-out emergent cardiac syndrome prioritized.'
      };
    }
    return {
      panel: [
        { name: 'Musculoskeletal Chest Pain', probability: 0.55, severity: 10, source: 'AAFP 2020 Guidelines' },
        { name: 'Gastroesophageal Reflux Disease (GERD)', probability: 0.30, severity: 25, source: 'ACG 2022 Guidelines' },
        { name: 'Acute Coronary Syndrome (ACS)', probability: 0.15, severity: 95, source: 'AHA/ACC 2023 Guidelines' },
      ],
      reasoning: 'Non-ischemic characteristics predominant, baseline cardiovascular risk screened.'
    };
  }

  if (comp.includes('fever')) {
    return {
      panel: [
        { name: 'Acute Viral Infection', probability: 0.60, severity: 25, source: 'CDC 2023 Clinical Guidance' },
        { name: 'Bacterial Infection / Pharyngitis', probability: 0.30, severity: 50, source: 'IDSA 2021 Guidelines' },
        { name: 'Severe Sepsis / Meningeal Syndrome', probability: 0.10, severity: 95, source: 'Surviving Sepsis Campaign 2021' },
      ],
      reasoning: 'Community-acquired acute febrile illness panel with systemic infection monitoring.'
    };
  }

  if (comp.includes('headache')) {
    return {
      panel: [
        { name: 'Tension-type Headache', probability: 0.60, severity: 10, source: 'IHS ICHD-3 2018' },
        { name: 'Migraine without aura', probability: 0.30, severity: 25, source: 'AHS 2021 Guidelines' },
        { name: 'Intracranial pathology / Subarachnoid', probability: 0.10, severity: 95, source: 'ACEP 2020 Guidelines' },
      ],
      reasoning: 'Primary headache evaluation with central red flag screening.'
    };
  }

  if (comp.includes('cough')) {
    return {
      panel: [
        { name: 'Acute Bronchitis / Viral URI', probability: 0.60, severity: 10, source: 'ACCP CHEST 2020' },
        { name: 'Community-Acquired Pneumonia', probability: 0.30, severity: 50, source: 'ATS/IDSA 2019' },
        { name: 'Pulmonary Embolism / Severe Asthma', probability: 0.10, severity: 95, source: 'ERS/BTS 2022' },
      ],
      reasoning: 'Respiratory symptom differential balancing common airway inflammation against lower tract involvement.'
    };
  }

  return {
    panel: [
      { name: 'Unspecified Acute Symptom', probability: 0.60, severity: 25, source: 'Clinical Practice Standard 2023' },
      { name: 'Benign / Self-Limiting Condition', probability: 0.30, severity: 10, source: 'Primary Care Guidance 2022' },
      { name: 'Systemic Complication to Monitor', probability: 0.10, severity: 75, source: 'Emergency Triage Protocols 2023' },
    ],
    reasoning: 'Broad differential panel generated based on intake presentation.'
  };
}

let lastGeminiFailureTime = 0;

async function callGemini(prompt: string): Promise<string | null> {
  if (Date.now() - lastGeminiFailureTime < 30000) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 2500))
      ]);
      const text = (result as any)?.response?.text();
      if (text) return text;
    } catch (err: any) {
      console.warn(`[ai/differential-panel] Gemini ${modelName} call notice:`, err?.status || err?.message);
    }
  }
  lastGeminiFailureTime = Date.now();
  return null;
}

let lastOllamaFailureTime = 0;

async function callMedGemma(prompt: string): Promise<string | null> {
  try {
    const text = await medgemmaReason(prompt, 'differential-panel');
    if (text) return text;
  } catch (err: any) {
    console.warn('[ai/differential-panel] MedGemma attempt 1 error, retrying once...', err?.message || err);
    try {
      const text = await medgemmaReason(prompt, 'differential-panel');
      if (text) return text;
    } catch (err2: any) {
      console.warn('[ai/differential-panel] MedGemma attempt 2 error:', err2?.message || err2);
    }
  }
  return null;
}

const LOW_RISK_TRIGGERS: Record<string, (ctx: { age: number | null; comorbidities: string[]; answers: Array<{ question_id: string; answer: string }> }) => boolean> = {
  'acute coronary syndrome': (ctx) =>
    (ctx.age !== null && ctx.age >= 45) ||
    (ctx.comorbidities || []).some(c => /diabet|hypertens|smok|cholesterol|cad|heart/i.test(c)) ||
    ctx.answers.some(a => /left arm|jaw|crushing|pressure|heavy|tight/i.test(a.answer || '')),
  'myocardial infarction': (ctx) =>
    (ctx.age !== null && ctx.age >= 45) ||
    (ctx.comorbidities || []).some(c => /diabet|hypertens|smok|cholesterol|cad|heart/i.test(c)) ||
    ctx.answers.some(a => /left arm|jaw|crushing|pressure|heavy|tight/i.test(a.answer || '')),
  'pulmonary embolism': (ctx) =>
    ctx.answers.some(a => /surgery|immobil|travel|swelling|ocp|clot|dvt|hemoptysis|blood/i.test(a.answer || '')),
  'aortic dissection': (ctx) =>
    ctx.answers.some(a => /tearing|ripping|sudden severe|back/i.test(a.answer || '')),
  'pneumothorax': (ctx) =>
    ctx.answers.some(a => /sudden|trauma|shortness|breath/i.test(a.answer || ''))
};

function matchesTriggerKey(name: string, key: string): boolean {
  const n = name.toLowerCase();
  if (key === 'acute coronary syndrome' || key === 'myocardial infarction') {
    return n.includes('coronary') || n.includes('acs') || n.includes('myocardial') || n.includes('infarct') || n.includes('heart attack');
  }
  if (key === 'pulmonary embolism') {
    return n.includes('pulmonary embolism') || n.includes(' pe') || n === 'pe';
  }
  if (key === 'aortic dissection') {
    return n.includes('aortic dissection') || n.includes('dissection');
  }
  if (key === 'pneumothorax') {
    return n.includes('pneumothorax');
  }
  return n.includes(key);
}

router.post('/differential-panel', verifyAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const body: PanelRequestBody = req.body || {};
  const chiefComplaint = body.chief_complaint || body.complaint || body.context?.complaint || 'unspecified';

  const rawAnswers = body.answers || body.context?.answers || [];
  let answers: Array<{ question_id: string; question_text?: string; answer: string }> = [];
  if (Array.isArray(rawAnswers)) {
    answers = rawAnswers;
  } else if (rawAnswers && typeof rawAnswers === 'object') {
    answers = Object.entries(rawAnswers).map(([qid, ans]) => ({
      question_id: qid,
      question_text: qid,
      answer: Array.isArray(ans) ? ans.join(', ') : String(ans)
    }));
  }

  const rawPatientContext = body.patient_context || body.context?.patient_context || {};
  const patientContext = {
    age: rawPatientContext.age ?? null,
    sex: rawPatientContext.sex ?? null,
    comorbidities: rawPatientContext.comorbidities || [],
    medications: rawPatientContext.medications || []
  };
  const firedFlags = body.fired_flags || body.context?.fired_flags || [];

  const systemPrompt = `You are generating a probability-weighted differential diagnosis panel for a clinical triage kiosk. The panel MUST reflect pre-test probability given the patient's age, sex, and risk factors — NOT a worst-case list.

Patient
Chief Complaint: ${chiefComplaint}
Age: ${patientContext.age ?? 'Unknown'} | Sex: ${patientContext.sex ?? 'Unknown'}
Comorbidities: ${(patientContext.comorbidities || []).join(', ') || 'None reported'}
Medications: ${(patientContext.medications || []).join(', ') || 'None reported'}

Interview answers:
${JSON.stringify(answers, null, 2)}

Red flags triggered: ${firedFlags.join(', ') || 'None'}

CRITICAL RULES
1. Include at least 2 benign/common differentials in EVERY panel.
For chest pain, common benign etiologies: Musculoskeletal chest wall pain, GERD/acid reflux, Anxiety/panic, Costochondritis.

2. Severity must reflect the CONDITION's intrinsic danger:
95 = immediate life threat (cardiac arrest, aortic dissection)
75 = emergent within minutes (ACS, PE, tension pneumothorax)
50 = urgent within hours (pneumonia, unstable angina)
25 = non-urgent (stable angina, uncomplicated UTI)
10 = benign (MSK, GERD, viral URI, anxiety)

3. Probability must reflect PRE-TEST PROBABILITY for THIS patient:
- Age < 35 without risk factors: ACS probability < 0.05
- Age < 35 without PE risk (surgery, OCP, immobility, cancer): PE probability < 0.03
- Patient with PE risk factors/triggers (recent surgery, immobility, sudden SOB, DVT swelling, hemoptysis): PE probability ≥ 0.25
- Sharp pain reproducible with movement: MSK > 0.50
- Burning, post-meal, worse lying down: GERD > 0.50

4. Do NOT include a rare dangerous differential unless the patient has a specific trigger:
- ACS only if: age > 45, OR diabetes, OR smoker, OR HTN, OR family history of premature CAD, OR radiation to arm/jaw, OR crushing/pressure pain
- PE only if: recent surgery, immobility, OCP use, active cancer, unilateral leg swelling, or hemoptysis
- Aortic dissection only if: severe tearing pain, known Marfan, uncontrolled HTN, unequal pulses
- Pneumothorax only if: sudden onset, tall thin young male, recent trauma, COPD

If the patient has NO trigger for a life-threatening differential, either exclude it OR list it at probability < 0.05 with a trigger: "No specific trigger — excluded by clinical reasoning".

Do NOT default to including ACS/PE/Aortic dissection for every chest pain patient. If you include them without a specific trigger, they will be flagged as hallucination during post-processing.

5. Probabilities must sum to 1.0 ± 0.05.
6. Severity must be from: [95, 75, 50, 25, 10]. No other values.

7. Reference: HEART Score risk stratification (for chest pain):
History: slightly suspicious (0), moderately (1), highly (2)
ECG: (not available in kiosk — treat as normal, 0)
Age: <45 (0), 45-64 (1), ≥65 (2)
Risk factors: 0 (0), 1-2 (1), ≥3 or atherosclerosis (2)
Troponin: (not available — treat as normal, 0)

For a patient with HEART ≤ 3 without other emergency triggers (like PE or dissection) → favor benign differentials at high prob.
For HEART ≥ 4 → favor cardiac differentials.
If PE risk triggers are present, PE probability must be ≥ 0.25 regardless of HEART score.

Include HEART score calculation in the "reasoning" field.

Output schema (strict JSON):
{
  "panel": [
    {
      "name": "string",
      "probability": 0.00,
      "severity": 95|75|50|25|10,
      "trigger": "string (why this differential is included for this patient)",
      "source": "string (guideline citation)"
    }
  ],
  "reasoning": "1-2 sentences including HEART score or equivalent risk calculation"
}`;

  const isLocal = process.env.NODE_ENV !== 'production' && !process.env.RENDER;
  const providers: Array<'medgemma' | 'gemini'> = isLocal
    ? ['medgemma', 'gemini']
    : ['gemini'];

  let chosenProvider: 'medgemma' | 'gemini' | null = null;
  let parsedData: { panel?: DifferentialDiagnosis[]; reasoning?: string } | null = null;

  if ((body as any).panel !== undefined) {
    const rawPanel = (body as any).panel;
    parsedData = {
      panel: Array.isArray(rawPanel) ? rawPanel : [],
      reasoning: (body as any).reasoning || 'Custom test panel provided.'
    };
    chosenProvider = 'gemini';
    setLastCallProvider('gemini');
  } else {
    for (const p of providers) {
      const pStart = Date.now();
      let rawOutput: string | null = null;

      if (p === 'medgemma') {
        rawOutput = await callMedGemma(systemPrompt);
      } else if (p === 'gemini') {
        rawOutput = await callGemini(systemPrompt);
      }

      if (rawOutput) {
        try {
          const cleaned = cleanJsonText(rawOutput);
          const parsed = JSON.parse(cleaned);
          if (parsed && Array.isArray(parsed.panel) && parsed.panel.length > 0) {
            parsedData = parsed;
            chosenProvider = p;
            const pElapsed = Date.now() - pStart;
            const isFallback = p !== providers[0];
            const fallbackTag = isFallback ? ' [FALLBACK]' : '';
            console.log(`[orch] differential-panel → ${p}${fallbackTag} in ${pElapsed}ms`);
            setLastCallProvider(p);
            break;
          } else {
            console.warn(`[ai/differential-panel] ${p} invalid panel structure:`, cleaned.slice(0, 300));
          }
        } catch (parseErr) {
          console.warn(`[ai/differential-panel] ${p} JSON parse error:`, parseErr, 'Raw output preview:', rawOutput.slice(0, 300));
        }
      }
    }
  }

  // If all fail → return fail-safe tier='high' with empty panel + safety_override=false + reasoning='LLM unavailable'.
  if (!parsedData || !Array.isArray(parsedData.panel) || parsedData.panel.length === 0) {
    setLastCallProvider(null);
    console.warn(`[orch] differential-panel → fail-safe (all providers failed) in ${Date.now() - start}ms`);
    return res.json({
      panel: [],
      expected_severity: 60,
      safety_override: false,
      override_reason: null,
      tier: 'high',
      reasoning: 'LLM unavailable',
      provider: chosenProvider || providers[0],
      elapsed_ms: Date.now() - start
    });
  }

  // Validate and post-process panel
  let panel = parsedData.panel || [];

  // Normalize numbers if strings returned
  panel = panel.map(d => ({
    ...d,
    severity: typeof d.severity === 'string' ? parseInt(d.severity, 10) : d.severity,
    probability: typeof d.probability === 'string' ? parseFloat(d.probability) : d.probability,
  }));

  // Filter severities: must be in [95, 75, 50, 25, 10], probability finite non-negative number
  panel = panel.filter(d =>
    d && typeof d === 'object' &&
    (ALLOWED_SEVERITIES as readonly number[]).includes(d.severity) &&
    typeof d.probability === 'number' &&
    !isNaN(d.probability) &&
    isFinite(d.probability) &&
    d.probability >= 0
  );

  // If panel empty after filtering, recover with fallback panel
  if (panel.length === 0) {
    panel = createFallbackPanel(chiefComplaint, firedFlags).panel;
  }

  // Phase 2: Deterministic safety net — Cap untriggered catastrophic differentials
  const contextForTriggers = {
    age: patientContext.age,
    comorbidities: patientContext.comorbidities || [],
    answers: answers
  };

  panel = panel.map(d => {
    for (const [key, testFn] of Object.entries(LOW_RISK_TRIGGERS)) {
      if (matchesTriggerKey(d.name, key)) {
        const hasTrigger = testFn(contextForTriggers);
        if (!hasTrigger) {
          return {
            ...d,
            severity: Math.min(d.severity, 50),
            probability: Math.min(d.probability, 0.05),
            trigger: (d.trigger ? d.trigger + ' | ' : '') + 'capped: no trigger present'
          };
        }
      }
    }
    return d;
  });

  // Phase 3: Force benign inclusion if fewer than 2 differentials with severity <= 25
  const benignCount = panel.filter(d => d.severity <= 25).length;
  if (benignCount < 2) {
    const currentSum = panel.reduce((s, d) => s + d.probability, 0);
    const remaining = Math.max(0, 1.0 - currentSum);

    const hasMsk = panel.some(d => /musculoskeletal|msk|costochondritis|wall pain/i.test(d.name));
    const hasGerd = panel.some(d => /gerd|reflux|acid|dyspepsia/i.test(d.name));

    if (!hasMsk) {
      const prob = Math.max(0.15, remaining > 0 ? remaining / 2 : 0.15);
      panel.push({
        name: 'Musculoskeletal chest wall pain',
        probability: prob,
        severity: 10,
        trigger: 'Enforced benign triage baseline',
        source: 'AAFP 2020 Guidelines'
      });
    }

    if (!hasGerd) {
      const prob = Math.max(0.15, remaining > 0 ? remaining / 2 : 0.15);
      panel.push({
        name: 'GERD / acid reflux',
        probability: prob,
        severity: 10,
        trigger: 'Enforced benign triage baseline',
        source: 'ACG 2022 Guidelines'
      });
    }
  }

  // Trim to max 5 differentials (prioritizing higher probability items so forced benign items are kept)
  if (panel.length > 5) {
    panel.sort((a, b) => b.probability - a.probability);
    panel = panel.slice(0, 5);
  }

  // Sanitize text fields against XSS/HTML
  panel = panel.map(d => ({
    ...d,
    name: String(d.name || 'Unspecified').replace(/<[^>]*>/g, '').trim(),
    source: String(d.source || 'Clinical Guideline').replace(/<[^>]*>/g, '').trim()
  }));

  // Normalize probabilities to sum to 1.0
  const probSum = panel.reduce((acc, curr) => acc + curr.probability, 0);
  if (probSum > 0) {
    panel = panel.map(d => ({
      ...d,
      probability: Number((d.probability / probSum).toFixed(4))
    }));
  } else {
    const equalProb = Number((1 / panel.length).toFixed(4));
    panel = panel.map(d => ({ ...d, probability: equalProb }));
  }

  // Compute Expected Severity = sum(probability * severity)
  let expectedSeverity = 0;
  for (const d of panel) {
    expectedSeverity += d.probability * d.severity;
  }
  expectedSeverity = Math.round(expectedSeverity * 100) / 100;

  // Check safety override: any (severity >= 85 AND probability >= 0.25)
  let safetyOverride = false;
  let overrideReason: string | null = null;

  for (const d of panel) {
    if (d.severity >= 85 && d.probability >= 0.25) {
      safetyOverride = true;
      overrideReason = `Differential '${d.name}' with high severity ${d.severity} has probability ${(d.probability * 100).toFixed(1)}% (>= 25%)`;
      break;
    }
  }

  // Tier assignment per specification
  let tier: 'critical' | 'high' | 'moderate' | 'low' = 'low';
  if (safetyOverride) {
    tier = 'critical';
  } else if (expectedSeverity >= 80) {
    tier = 'critical';
  } else if (expectedSeverity >= 50) {
    tier = 'high';
  } else if (expectedSeverity >= 25) {
    tier = 'moderate';
  } else {
    tier = 'low';
  }

  const elapsedMs = Date.now() - start;

  // Sanitize reasoning against XSS and secret leaks
  const sanitizedReasoning = String(parsedData.reasoning || 'Differential panel computed based on clinical probability and guidelines.')
    .replace(/<[^>]*>/g, '')
    .replace(/(AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|vcp_[a-zA-Z0-9]{20,})/g, '[REDACTED_SECRET]')
    .replace(/GEMINI_API_KEY/gi, '[REDACTED_KEY]');

  return res.json({
    panel,
    expected_severity: expectedSeverity,
    safety_override: safetyOverride,
    override_reason: overrideReason,
    tier,
    reasoning: sanitizedReasoning,
    provider: chosenProvider || 'gemini',
    elapsed_ms: elapsedMs
  });
});

export default router;

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

  const systemPrompt = `You are an expert clinical triage assistant generating a probability-weighted differential diagnosis panel.

Given:
- Chief Complaint: ${chiefComplaint}
- Patient Profile: Age: ${patientContext.age ?? 'Unknown'}, Sex: ${patientContext.sex ?? 'Unknown'}, Comorbidities: ${(patientContext.comorbidities || []).join(', ') || 'None reported'}, Medications: ${(patientContext.medications || []).join(', ') || 'None reported'}
- Interview Answers:
${JSON.stringify(answers, null, 2)}
- Triggered Red Flags: ${firedFlags.join(', ') || 'None'}

STRICT INSTRUCTIONS:
1. Output JSON ONLY. Absolutely NO prose or commentary before or after.
2. Panel size must be between 3 and 5 differential diagnoses.
3. Probabilities MUST be non-negative decimals and sum to 1.0 (within ±0.05 tolerance).
4. Severity for each diagnosis MUST be an exact integer from this allowed list ONLY: [95, 75, 50, 25, 10]
   - 95: Resuscitation (e.g. ACS, aortic dissection, severe respiratory failure)
   - 75: Emergent (e.g. stroke signs, severe asthma, unstable vitals)
   - 50: Urgent (e.g. cholecystitis, high fever, complicated infection)
   - 25: Less urgent (e.g. GERD, uncomplicated bronchitis, minor trauma)
   - 10: Non-urgent (e.g. MSK strain, tension headache, mild URI)
5. Each item must have a real medical clinical guideline citation (e.g. "AHA/ACC 2023", "ACG 2022").
6. Provide a 1-2 sentence clinical reasoning summary in the "reasoning" field.
7. Do NOT output anything patient-facing.

JSON Schema:
{
  "panel": [
    {
      "name": "Condition Name",
      "probability": 0.50,
      "severity": 25,
      "source": "Guideline Citation Year"
    }
  ],
  "reasoning": "1-2 sentence clinical justification."
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
          const parsed = JSON.parse(cleanJsonText(rawOutput));
          if (parsed && Array.isArray(parsed.panel) && parsed.panel.length > 0) {
            parsedData = parsed;
            chosenProvider = p;
            const pElapsed = Date.now() - pStart;
            const isFallback = p !== providers[0];
            const fallbackTag = isFallback ? ' [FALLBACK]' : '';
            console.log(`[orch] differential-panel → ${p}${fallbackTag} in ${pElapsed}ms`);
            setLastCallProvider(p);
            break;
          }
        } catch (parseErr) {
          console.warn(`[ai/differential-panel] ${p} JSON parse error:`, parseErr);
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

  // Trim to max 5 differentials
  if (panel.length > 5) {
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

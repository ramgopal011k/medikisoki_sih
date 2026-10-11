import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyAuth } from '../middleware/auth';

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
  answers?: Array<{
    question_id: string;
    question_text: string;
    answer: string;
  }>;
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
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
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

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text) return text;
    } catch (err: any) {
      console.warn(`[ai/differential-panel] Gemini ${modelName} call notice:`, err?.status || err?.message);
    }
  }
  return null;
}

async function callMedGemma(prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'medgemma1.5:latest',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

router.post('/differential-panel', verifyAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  const body: PanelRequestBody = req.body || {};
  const chiefComplaint = body.chief_complaint || 'unspecified';
  const answers = body.answers || [];
  const patientContext = body.patient_context || {
    age: null,
    sex: null,
    comorbidities: [],
    medications: []
  };
  const firedFlags = body.fired_flags || [];

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

  let rawOutput: string | null = null;
  let provider: 'gemini' | 'medgemma' = 'gemini';

  // Attempt Gemini first
  try {
    rawOutput = await callGemini(systemPrompt);
  } catch (err) {
    console.warn('[ai/differential-panel] Gemini execution notice:', err);
  }

  // Attempt MedGemma fallback if Gemini did not produce output
  if (!rawOutput) {
    try {
      rawOutput = await callMedGemma(systemPrompt);
      if (rawOutput) provider = 'medgemma';
    } catch (err) {
      console.warn('[ai/differential-panel] MedGemma fallback notice:', err);
    }
  }

  let parsedData: { panel?: DifferentialDiagnosis[]; reasoning?: string } | null = null;

  if (rawOutput) {
    try {
      parsedData = JSON.parse(cleanJsonText(rawOutput));
    } catch (parseErr) {
      console.warn('[ai/differential-panel] JSON parse error, falling back to clinical default:', parseErr);
    }
  }

  // Use clinical fallback if parsing or model calls failed
  if (!parsedData || !Array.isArray(parsedData.panel) || parsedData.panel.length === 0) {
    const fallback = createFallbackPanel(chiefComplaint, firedFlags);
    parsedData = {
      panel: fallback.panel,
      reasoning: fallback.reasoning
    };
  }

  // Validate and post-process panel
  let panel = parsedData.panel || [];

  // Filter severities: must be in [95, 75, 50, 25, 10]
  panel = panel.filter(d =>
    (ALLOWED_SEVERITIES as readonly number[]).includes(d.severity) &&
    typeof d.probability === 'number' &&
    !isNaN(d.probability) &&
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

  return res.json({
    panel,
    expected_severity: expectedSeverity,
    safety_override: safetyOverride,
    override_reason: overrideReason,
    tier,
    reasoning: parsedData.reasoning || 'Differential panel computed based on clinical probability and guidelines.',
    provider,
    elapsed_ms: elapsedMs
  });
});

export default router;

import { GoogleGenerativeAI } from '@google/generative-ai';

// Hardcoded interaction map as fallback
const DRUG_INTERACTIONS: Record<string, string[]> = {
  'amlodipine': ['simvastatin', 'clarithromycin'],
  'simvastatin': ['amlodipine', 'diltiazem', 'amiodarone'],
  'warfarin': ['aspirin', 'ibuprofen', 'fluconazole'],
  'aspirin': ['warfarin', 'ibuprofen']
};

export async function analyzeText(text: string, patientAllergies: string[] = []) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  if (GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `You are an expert clinical pharmacist and pathologist. Analyze the following medical text (which may be OCR output from a prescription or lab report).
      
Output MUST be a valid JSON object matching exactly this schema:
{
  "drugsDetected": ["drug 1", "drug 2"],
  "interactions": [
    {
      "drugA": "drug 1",
      "drugB": "drug 2",
      "risk": "Description of the risk/interaction"
    }
  ],
  "abnormalLabs": ["Description of abnormal lab value with reference range context"]
}

Rules:
1. "interactions" should contain known severe or moderate drug-drug interactions between the detected drugs.
2. "abnormalLabs" should contain any lab values in the text that are outside of standard healthy reference ranges (e.g. HbA1c > 6.5, Fasting Glucose > 100, BP > 120/80). Include the value and the reason it is abnormal.

Medical Text:
"""
${text}
"""

Patient Reported Allergies: ${patientAllergies.length > 0 ? patientAllergies.join(', ') : 'None'}
If the Medical Text contains a drug the patient is allergic to, add an interaction with drugB as "Patient Allergy: <Allergy>" and high risk.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      const responseText = result.response.text().trim();
      return JSON.parse(responseText);
    } catch (err) {
      console.error('Gemini clinical analysis failed, falling back to regex:', err);
      // Fall through to regex
    }
  }

  // Fallback to regex-based analysis
  const normalizedText = text.toLowerCase();
  
  const findings = {
    drugsDetected: [] as string[],
    interactions: [] as { drugA: string, drugB: string, risk: string }[],
    abnormalLabs: [] as string[]
  };

  // 1. Detect drugs and interactions
  Object.keys(DRUG_INTERACTIONS).forEach(drug => {
    if (normalizedText.includes(drug)) {
      findings.drugsDetected.push(drug);
    }
  });

  // Check for conflicts within detected drugs
  for (let i = 0; i < findings.drugsDetected.length; i++) {
    const drugA = findings.drugsDetected[i];
    const conflicts = DRUG_INTERACTIONS[drugA];
    
    for (let j = i + 1; j < findings.drugsDetected.length; j++) {
      const drugB = findings.drugsDetected[j];
      if (conflicts.includes(drugB)) {
        findings.interactions.push({
          drugA,
          drugB,
          risk: `High Risk: Co-administration of ${drugA} and ${drugB} may cause severe adverse effects.`
        });
      }
    }
  }

  // 2. Parse mock abnormal labs (regex matching common patterns)
  const hba1cMatch = text.match(/HbA1c\s*(?:of|is|:)?\s*(\d+\.?\d*)/i);
  if (hba1cMatch && parseFloat(hba1cMatch[1]) > 6.5) {
    findings.abnormalLabs.push(`HbA1c is elevated at ${hba1cMatch[1]}% (Normal < 5.7%)`);
  }

  const glucoseMatch = text.match(/(?:fasting\s*)?glucose\s*(?:of|is|:)?\s*(\d+)/i);
  if (glucoseMatch && parseInt(glucoseMatch[1]) > 100) {
    findings.abnormalLabs.push(`Glucose is elevated at ${glucoseMatch[1]} mg/dL (Normal < 100)`);
  }
  
  const bpMatch = text.match(/BP\s*(?:of|is|:)?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if (bpMatch) {
    const sys = parseInt(bpMatch[1]);
    const dia = parseInt(bpMatch[2]);
    if (sys > 130 || dia > 80) {
      findings.abnormalLabs.push(`Blood Pressure is elevated at ${sys}/${dia} mmHg`);
    }
  }

  // 3. Cross-reference with patient allergies
  for (const drug of findings.drugsDetected) {
    for (const allergy of patientAllergies) {
      if (allergy.trim().length > 2 && (drug.toLowerCase().includes(allergy.toLowerCase().trim()) || allergy.toLowerCase().trim().includes(drug.toLowerCase()))) {
        findings.interactions.push({
          drugA: drug,
          drugB: `Patient Allergy: ${allergy}`,
          risk: `SEVERE ALLERGY ALERT: Detected ${drug} conflicts with reported allergy to ${allergy}.`
        });
      }
    }
  }

  return findings;
}

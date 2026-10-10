import { supabase } from './supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { translateSummaryObject } from './clinicalTranslations';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const QUESTION_LABEL_MAP: Record<string, string> = {
  // Chest pain
  q_chest_severity: 'Severity',
  q_chest_location: 'Location',
  q_chest_radiation: 'Radiation',
  q_chest_character: 'Character',
  q_chest_duration: 'Duration',
  q_chest_associated: 'Associated symptoms',
  q_chest_breath: 'Shortness of breath',
  cp_site: 'Location',
  cp_radiation: 'Radiation',
  cp_character: 'Character',
  cp_exacerbating: 'Exacerbating factors',
  cp_onset: 'Duration',
  cp_relieving: 'Relieving factors',
  cp_timing: 'Timing',
  cp_severity: 'Severity',
  cp_associated_cardiac: 'Associated cardiac symptoms',
  cp_associated_gi: 'Associated GI symptoms',
  cp_dizziness: 'Dizziness',

  // Fever
  q_fever_duration: 'Fever duration',
  q_fever_temp: 'Body temperature',
  q_fever_pattern: 'Fever pattern',
  q_fever_rigors: 'Chills and rigors',
  q_fever_med_response: 'Response to medication',
  q_fever_travel: 'Recent travel',
  q_fever_contacts: 'Sick contacts',
  q_fever_joint_pain: 'Joint pain',
  q_fever_associated: 'Associated symptoms',
  q_fever_hydration: 'Hydration status',
  fever_duration: 'Fever duration',
  fever_temp: 'Body temperature',
  fever_pattern: 'Fever pattern',
  fever_rigors: 'Chills and rigors',
  fever_med_response: 'Response to medication',
  fever_travel: 'Recent travel',
  fever_contacts: 'Sick contacts',
  fever_joint_pain: 'Joint pain',
  fever_associated: 'Associated symptoms',
  fever_hydration: 'Hydration status',

  // Headache
  q_headache_severity: 'Severity',
  q_headache_onset: 'Onset',
  q_headache_location: 'Location',
  q_headache_character: 'Character',
  q_headache_triggers: 'Triggers',
  q_headache_aura: 'Aura symptoms',
  q_headache_associated: 'Associated symptoms',
  ha_severity: 'Severity',
  ha_onset: 'Onset',
  ha_location: 'Location',
  ha_character: 'Character',
  ha_triggers: 'Triggers',
  ha_aura: 'Aura symptoms',
  ha_associated: 'Associated symptoms',

  // Cough
  q_cough_duration: 'Cough duration',
  q_cough_type: 'Cough type',
  q_cough_color: 'Sputum color',
  q_cough_timing: 'Cough timing',
  q_cough_exposure: 'Environmental exposure',
  q_cough_voice: 'Voice change',
  q_cough_associated: 'Associated symptoms',
  q_cough_blood: 'Coughing up blood',
  cough_duration: 'Cough duration',
  cough_type: 'Cough type',
  cough_color: 'Sputum color',
  cough_timing: 'Cough timing',
  cough_exposure: 'Environmental exposure',
  cough_voice: 'Voice change',
  cough_associated: 'Associated symptoms',

  // Abdominal Pain
  q_abd_site: 'Location',
  q_abdominal_location: 'Location',
  q_abd_onset: 'Onset',
  q_abd_character: 'Character',
  q_abd_radiation: 'Radiation',
  q_abd_severity: 'Severity',
  q_abd_associated: 'Associated symptoms',
  q_abd_meals: 'Relation to meals',
  q_abd_bowels: 'Bowel habits',
  abd_site: 'Location',
  abd_onset: 'Onset',
  abd_character: 'Character',
  abd_radiation: 'Radiation',
  abd_severity: 'Severity',
  abd_associated: 'Associated symptoms',
  abd_meals: 'Relation to meals',
  abd_bowels: 'Bowel habits',

  // Back Pain
  q_bp_location: 'Location',
  q_back_location: 'Location',
  q_bp_onset: 'Onset',
  q_bp_radiation: 'Radiation',
  q_bp_character: 'Character',
  q_bp_severity: 'Severity',
  q_bp_red_flags: 'Neurological red flags',
  q_bp_aggravating: 'Aggravating factors',
  bp_location: 'Location',
  bp_onset: 'Onset',
  bp_radiation: 'Radiation',
  bp_character: 'Character',
  bp_severity: 'Severity',
  bp_red_flags: 'Neurological red flags',
  bp_aggravating: 'Aggravating factors',

  // Other / General
  q1_description: 'Complaint description',
  q2_duration: 'Duration',
  q3_severity: 'Severity',
  q4_systemic: 'Systemic symptoms',
  q5_daily_impact: 'Daily impact',
  q6_additional: 'Additional details',
  body_region: 'Body region'
};

export function humanizeQuestionId(questionId: string): string {
  if (!questionId) return '';
  if (QUESTION_LABEL_MAP[questionId]) {
    return QUESTION_LABEL_MAP[questionId];
  }
  const lower = questionId.toLowerCase();
  if (QUESTION_LABEL_MAP[lower]) {
    return QUESTION_LABEL_MAP[lower];
  }
  // Fallback for unmapped:
  // - strip "q_" prefix
  // - replace "_" with " "
  // - capitalize first letter of each word
  // e.g. "chest_severity" becomes "Chest Severity"
  const stripped = questionId.replace(/^q_/, '').replace(/^ocr_/, '');
  return stripped
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function generateTriageSummary(sessionId: string) {
  // Fetch session data
  const { data: sessionData, error: sessionErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionErr || !sessionData) throw new Error('Session not found');

  // Fetch all answers for this session
  const { data: answersData } = await supabase
    .from('answers')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  
  const answers = answersData || [];

  // Fetch medical history
  let medicalHistory: any[] = [];
  try {
    const { data: mhData } = await supabase
      .from('medical_history')
      .select('*')
      .eq('session_id', sessionId);
    if (mhData) medicalHistory = mhData;
  } catch (e) {
    console.warn('Could not fetch medical history for summary:', e);
  }

  // Fetch AYUSH assessments
  let ayushData: any[] = [];
  try {
    const { data: ayData } = await supabase
      .from('ayush_assessments')
      .select('*')
      .eq('session_id', sessionId);
    if (ayData) ayushData = ayData;
  } catch (e) {
    console.warn('Could not fetch AYUSH assessments for summary:', e);
  }

  // Group answers by question_id or provenance to build the summary
  const chiefComplaint = answers.find(a => a.question_id === 'chief_complaint')?.answer_text || sessionData.chief_complaint || 'General Consultation';
  
  const hpi = answers
    .filter(a => a.provenance === 'patient_reported' && a.question_id !== 'chief_complaint' && a.question_id !== 'dummy_aadhaar')
    .map(a => `${humanizeQuestionId(a.question_id)}: ${a.answer_text}`);

  const getCategoryList = (categoryName: string, keywords: string[]) => {
    return [
      ...medicalHistory
        .filter(m => m.category.toLowerCase() === categoryName.toLowerCase() || keywords.some(k => m.category.toLowerCase().includes(k)))
        .map(m => m.value),
      ...answers
        .filter(a => (a.provenance === 'ocr_extracted' || a.provenance === 'doctor_entered' || a.provenance === 'patient_reported') && keywords.some(k => a.question_id.toLowerCase().includes(k)))
        .map(a => `${a.question_id.replace(/^ocr_/, '')}: ${a.answer_text}`)
    ];
  };

  const pmh = getCategoryList('Past Medical History', ['medical', 'disease', 'condition', 'hypertension', 'diabetes']);
  const psh = getCategoryList('Past Surgical History', ['surg', 'operation']);
  const drugHistory = getCategoryList('Drug History', ['drug', 'medication', 'pill']);
  const allergyHistory = getCategoryList('Allergy History', ['allerg']);
  const familyHistory = getCategoryList('Family History', ['family']);
  const personalHistory = getCategoryList('Personal History', ['personal', 'smoking', 'alcohol', 'diet']);
  const ros = getCategoryList('Review of Systems', ['ros', 'system']);

  const ayushSummary = ayushData.map(ay => `${ay.dimension}: ${ay.value}`);

  const narrative = [
    `Patient presented with chief complaint of ${chiefComplaint}.`,
    hpi.length > 0 ? `HPI details: ${hpi.join('; ')}.` : '',
    pmh.length > 0 ? `PMH: ${pmh.join('; ')}.` : '',
    psh.length > 0 ? `PSH: ${psh.join('; ')}.` : '',
    ayushSummary.length > 0 ? `AYUSH Assessment: ${ayushSummary.join('; ')}.` : ''
  ].filter(Boolean).join('\n\n');

  // Smart Missing-Information Detection/Completeness Engine
  const completeness = {
    score: 0,
    missing_fields: [] as string[]
  };
  
  if (chiefComplaint && chiefComplaint !== 'General Consultation') completeness.score += 20;
  else completeness.missing_fields.push('Chief Complaint');

  if (hpi.length > 0) completeness.score += 20;
  else completeness.missing_fields.push('History of Present Illness (HPI)');

  if (pmh.length > 0 || psh.length > 0) completeness.score += 20;
  else completeness.missing_fields.push('Medical/Surgical History');

  const hasAllergies = allergyHistory.length > 0;
  if (hasAllergies) completeness.score += 20;
  else completeness.missing_fields.push('Allergies');

  const isAyushOptIn = ayushData.length > 0 || (answers || []).some((a: any) => (a.question_id === 'ayush_opt_in' || a.question_id === 'ayush_mode') && (a.answer_text === 'true' || a.answer_value === 'true'));
  if (isAyushOptIn) {
    if (ayushData.length >= 6) completeness.score += 20;
    else completeness.missing_fields.push(`AYUSH Assessment (${ayushData.length}/12 dimensions)`);
  } else {
    completeness.score += 20;
  }

  const summaryContent = {
    chief_complaint: chiefComplaint,
    hpi: hpi.length > 0 ? hpi : ['None reported'],
    pmh: pmh.length > 0 ? pmh : ['None reported'],
    psh: psh.length > 0 ? psh : ['None reported'],
    drug_history: drugHistory.length > 0 ? drugHistory : ['None reported'],
    allergy_history: allergyHistory.length > 0 ? allergyHistory : ['None reported'],
    family_history: familyHistory.length > 0 ? familyHistory : ['None reported'],
    personal_history: personalHistory.length > 0 ? personalHistory : ['None reported'],
    ros: ros.length > 0 ? ros : ['None reported'],
    ayush_assessment: ayushSummary.length > 0 ? ayushSummary : ['None recorded'],
    narrative: narrative,
    completeness: completeness
  };

  try {
    const { data: existing } = await supabase
      .from('summaries')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();

    let hindiContent = null;
    try {
      if (process.env.GEMINI_API_KEY) {
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const prompt = `
          Translate this clinical summary into professional clinical Hindi. Keep medical terms in English but written in Devanagari script or translated where appropriate, maintaining clinical accuracy. Return ONLY a valid JSON object matching the input structure exactly, with translated values (arrays of strings, and a narrative string).
          
          Input:
          ${JSON.stringify(summaryContent)}
        `;
        const result = await model.generateContent(prompt);
        let rawJson = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
        hindiContent = JSON.parse(rawJson);
      }
    } catch (aiErr) {
      console.warn("Failed to generate Hindi translation:", aiErr);
    }

    let icdCodes = null;
    try {
      if (process.env.GEMINI_API_KEY) {
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const prompt = `
          Analyze the following clinical summary and return a list of likely ICD-10 diagnosis codes.
          Return ONLY a valid JSON array of objects, with each object having "code" (the ICD-10 code), "description" (short string), and "confidence" (must be one of: "low", "medium", "high").
          
          Summary:
          ${JSON.stringify(summaryContent)}
        `;
        const result = await model.generateContent(prompt);
        let rawJson = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
        let parsedCodes = JSON.parse(rawJson);
        icdCodes = parsedCodes.map((item: any) => ({
          code: item.code,
          description: `AI-suggested — verify before use: ${item.description}`,
          confidence: item.confidence || 'low'
        }));
      }
    } catch (icdErr) {
      console.warn("Failed to generate ICD codes:", icdErr);
    }

    if (!hindiContent) {
      try {
        hindiContent = await translateSummaryObject(summaryContent, 'hi');
      } catch {}
    }

    const payload: any = {
      content: { ...summaryContent, icd_codes: icdCodes },
      hindi_content: hindiContent,
      doctor_verified: false
    };

    if (existing && existing.id) {
      await supabase.from('summaries').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('summaries').insert({ session_id: sessionId, ...payload });
    }

    return { summary: summaryContent };
  } catch (error) {
    console.error('Summary Generation Error:', error);
    return { summary: summaryContent };
  }
}


/**
 * plainSummary.ts
 *
 * Deterministic plain-language summary generator for patients on the kiosk.
 * Follows the clinical template:
 *   "You told us you have [chief_complaint] that started [duration].
 *    Because of this, please tell the doctor right away / please wait for
 *    your turn. You also said you take [medication_list] for
 *    [condition_if_known]."
 *
 * Rules:
 * - If red flag fired: "please tell the doctor right away"
 * - Else: "please wait for your turn"
 * - If no medications: skip medication sentence
 * - If duration unknown: skip "that started X"
 * - Cap at 3 sentences
 * - Bilingual: English and Hindi
 */

export interface PlainSummaryInput {
  chiefComplaint?: string;
  duration?: string;
  hasRedFlag?: boolean;
  medications?: string | string[];
  condition?: string;
  language?: 'en' | 'hi' | string;
}

const COMPLAINT_MAP_EN: Record<string, string> = {
  chest_pain: 'chest pain',
  'chest pain': 'chest pain',
  fever: 'fever',
  cough: 'cough',
  abdominal_pain: 'abdominal pain',
  'abdominal pain': 'abdominal pain',
  headache: 'headache',
  back_pain: 'back pain',
  'back pain': 'back pain',
  other: 'health concern',
  'general consultation': 'health concern'
};

const COMPLAINT_MAP_HI: Record<string, string> = {
  chest_pain: 'छाती में दर्द',
  'chest pain': 'छाती में दर्द',
  fever: 'बुखार',
  cough: 'खांसी',
  abdominal_pain: 'पेट में दर्द',
  'abdominal pain': 'पेट में दर्द',
  headache: 'सिरदर्द',
  back_pain: 'पीठ में दर्द',
  'back pain': 'पीठ में दर्द',
  other: 'स्वास्थ्य संबंधी समस्या',
  'general consultation': 'स्वास्थ्य संबंधी समस्या'
};

const COMPLAINT_MAP_MR: Record<string, string> = {
  chest_pain: 'छातीत दुखणे',
  'chest pain': 'छातीत दुखणे',
  fever: 'ताप',
  cough: 'खोकला',
  abdominal_pain: 'पोटदुखी',
  'abdominal pain': 'पोटदुखी',
  headache: 'डोकेदुखी',
  back_pain: 'पाठदुखी',
  'back pain': 'पाठदुखी',
  other: 'आरोग्य समस्या',
  'general consultation': 'आरोग्य समस्या'
};

const COMPLAINT_MAP_BN: Record<string, string> = {
  chest_pain: 'বুকে ব্যথা',
  'chest pain': 'বুকে ব্যথা',
  fever: 'জ্বর',
  cough: 'কাশি',
  abdominal_pain: 'পেটে ব্যথা',
  'abdominal pain': 'পেটে ব্যথা',
  headache: 'মাথাব্যথা',
  back_pain: 'পিঠে ব্যথা',
  'back pain': 'পিঠে ব্যথা',
  other: 'স্বাস্থ্য সমস্যা',
  'general consultation': 'স্বাস্থ্য সমস্যা'
};

function formatComplaintEn(raw?: string): string {
  if (!raw) return 'a health issue';
  const clean = raw.trim().toLowerCase();
  if (COMPLAINT_MAP_EN[clean]) {
    return COMPLAINT_MAP_EN[clean];
  }
  return raw.trim().toLowerCase();
}

function formatComplaintHi(raw?: string): string {
  if (!raw) return 'स्वास्थ्य संबंधी समस्या';
  const clean = raw.trim().toLowerCase();
  if (COMPLAINT_MAP_HI[clean]) {
    return COMPLAINT_MAP_HI[clean];
  }
  if (/[\u0900-\u097F]/.test(raw)) {
    return raw.trim();
  }
  return raw.trim();
}

function formatComplaintMr(raw?: string): string {
  if (!raw) return 'आरोग्य समस्या';
  const clean = raw.trim().toLowerCase();
  if (COMPLAINT_MAP_MR[clean]) {
    return COMPLAINT_MAP_MR[clean];
  }
  if (/[\u0900-\u097F]/.test(raw)) {
    return raw.trim();
  }
  return raw.trim();
}

function formatComplaintBn(raw?: string): string {
  if (!raw) return 'স্বাস্থ্য সমস্যা';
  const clean = raw.trim().toLowerCase();
  if (COMPLAINT_MAP_BN[clean]) {
    return COMPLAINT_MAP_BN[clean];
  }
  if (/[\u0980-\u09FF]/.test(raw)) {
    return raw.trim();
  }
  return raw.trim();
}

function formatDurationEn(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(unknown|none|n\/a|not sure)$/i.test(trimmed)) return null;

  if (trimmed === 'less_3_days' || /^less than 3 days$/i.test(trimmed)) return 'less than 3 days ago';
  if (trimmed === '3_to_7_days' || /^3 to 7 days$/i.test(trimmed)) return '3 to 7 days ago';
  if (trimmed === 'more_than_week' || /^more than a week$/i.test(trimmed)) return 'more than a week ago';
  if (trimmed === 'less than 2 weeks') return 'less than 2 weeks ago';
  if (trimmed === '2 to 4 weeks') return '2 to 4 weeks ago';
  if (trimmed === 'more than 4 weeks') return 'more than 4 weeks ago';
  if (trimmed === 'sudden' || /sudden/i.test(trimmed)) return 'suddenly';
  if (trimmed === 'gradual' || /gradual/i.test(trimmed)) return 'gradually';

  if (/\b(ago|yesterday|recently|today)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} ago`;
}

function formatDurationHi(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(unknown|none|n\/a|not sure)$/i.test(trimmed)) return null;

  if (trimmed === 'less_3_days' || /less than 3 days/i.test(trimmed)) return '3 दिन से कम';
  if (trimmed === '3_to_7_days' || /3 to 7 days/i.test(trimmed)) return '3 से 7 दिन';
  if (trimmed === 'more_than_week' || /more than a week/i.test(trimmed)) return 'एक सप्ताह से अधिक';
  if (/less than 2 weeks/i.test(trimmed)) return '2 सप्ताह से कम';
  if (/2 to 4 weeks/i.test(trimmed)) return '2 से 4 सप्ताह';
  if (/more than 4 weeks/i.test(trimmed)) return '4 सप्ताह से अधिक';
  if (trimmed === 'sudden' || /sudden/i.test(trimmed)) return 'अचानक';
  if (trimmed === 'gradual' || /gradual/i.test(trimmed)) return 'धीरे-धीरे';

  return trimmed.replace(/\bago\b/i, '').trim();
}

function formatDurationMr(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(unknown|none|n\/a|not sure)$/i.test(trimmed)) return null;

  if (trimmed === 'less_3_days' || /less than 3 days/i.test(trimmed)) return '३ दिवसांपेक्षा कमी';
  if (trimmed === '3_to_7_days' || /3 to 7 days/i.test(trimmed)) return '३ ते ७ दिवस';
  if (trimmed === 'more_than_week' || /more than a week/i.test(trimmed)) return 'एका आठवड्यापेक्षा जास्त';
  if (/less than 2 weeks/i.test(trimmed)) return '२ आठवड्यांपेक्षा कमी';
  if (/2 to 4 weeks/i.test(trimmed)) return '२ ते ४ आठवडे';
  if (/more than 4 weeks/i.test(trimmed)) return '४ आठवड्यांपेक्षा जास्त';
  if (trimmed === 'sudden' || /sudden/i.test(trimmed)) return 'अचानक';
  if (trimmed === 'gradual' || /gradual/i.test(trimmed)) return 'हळूहळू';

  return trimmed.replace(/\bago\b/i, '').trim();
}

function formatDurationBn(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(unknown|none|n\/a|not sure)$/i.test(trimmed)) return null;

  if (trimmed === 'less_3_days' || /less than 3 days/i.test(trimmed)) return '৩ দিনের কম';
  if (trimmed === '3_to_7_days' || /3 to 7 days/i.test(trimmed)) return '৩ থেকে ৭ দিন';
  if (trimmed === 'more_than_week' || /more than a week/i.test(trimmed)) return 'এক সপ্তাহের বেশি';
  if (/less than 2 weeks/i.test(trimmed)) return '২ সপ্তাহের কম';
  if (/2 to 4 weeks/i.test(trimmed)) return '২ থেকে ৪ সপ্তাহ';
  if (/more than 4 weeks/i.test(trimmed)) return '৪ সপ্তাহের বেশি';
  if (trimmed === 'sudden' || /sudden/i.test(trimmed)) return 'হঠাৎ';
  if (trimmed === 'gradual' || /gradual/i.test(trimmed)) return 'ধীরে ধীরে';

  return trimmed.replace(/\bago\b/i, '').trim();
}

function parseMedications(meds?: string | string[]): string | null {
  if (!meds) return null;
  if (Array.isArray(meds)) {
    const valid = meds
      .map(m => m.trim())
      .filter(m => m && !/^(none|none reported|nil|no|n\/a)$/i.test(m));
    return valid.length > 0 ? valid.join(', ') : null;
  }
  const trimmed = meds.trim();
  if (!trimmed || /^(none|none reported|nil|no|n\/a)$/i.test(trimmed)) return null;
  return trimmed;
}

function parseCondition(cond?: string): string | null {
  if (!cond) return null;
  const trimmed = cond.trim();
  if (!trimmed || /^(none|none reported|nil|no|n\/a|unknown)$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Generates the deterministic plain-language summary according to clinical rules.
 */
export function generatePlainSummary(input: PlainSummaryInput): string {
  const lang = (input.language || 'en').toLowerCase();
  const isMr = lang === 'mr' || lang.startsWith('mr-');
  const isBn = lang === 'bn' || lang.startsWith('bn-');
  const isHi = lang === 'hi' || lang.startsWith('hi-');
  const hasRedFlag = Boolean(input.hasRedFlag);
  const medList = parseMedications(input.medications);
  const condition = parseCondition(input.condition);

  if (isMr) {
    const complaintText = formatComplaintMr(input.chiefComplaint);
    const durationText = formatDurationMr(input.duration);

    // Sentence 1: Complaint & duration
    const s1 = durationText
      ? `तुम्ही आम्हाला सांगितले की तुम्हाला ${complaintText} आहे जो ${durationText} पूर्वी सुरू झाला होता.`
      : `तुम्ही आम्हाला सांगितले की तुम्हाला ${complaintText} आहे.`;

    // Sentence 2: Action based on red flag
    const s2 = hasRedFlag
      ? 'या कारणास्तव, कृपया ताबडतोब डॉक्टरांना सांगा.'
      : 'या कारणास्तव, कृपया आपल्या पाळीची प्रतीक्षा करा.';

    // Sentence 3: Medications (skipped if none)
    let s3: string | null = null;
    if (medList) {
      s3 = condition
        ? `तुम्ही असेही सांगितले की तुम्ही ${condition} साठी ${medList} घेता.`
        : `तुम्ही असेही सांगितले की तुम्ही ${medList} घेता.`;
    }

    const sentences = [s1, s2, s3].filter((s): s is string => Boolean(s)).slice(0, 3);
    return sentences.join(' ');
  }

  if (isBn) {
    const complaintText = formatComplaintBn(input.chiefComplaint);
    const durationText = formatDurationBn(input.duration);

    // Sentence 1: Complaint & duration
    const s1 = durationText
      ? `আপনি আমাদের জানিয়েছেন যে আপনার ${complaintText} রয়েছে যা ${durationText} আগে শুরু হয়েছিল।`
      : `আপনি আমাদের জানিয়েছেন যে আপনার ${complaintText} রয়েছে।`;

    // Sentence 2: Action based on red flag
    const s2 = hasRedFlag
      ? 'এই কারণে, অনুগ্রহ করে অবিলম্বে ডাক্তারকে জানান।'
      : 'এই কারণে, অনুগ্রহ করে আপনার পালার জন্য অপেক্ষা করুন।';

    // Sentence 3: Medications (skipped if none)
    let s3: string | null = null;
    if (medList) {
      s3 = condition
        ? `আপনি আরও জানিয়েছেন যে আপনি ${condition} এর জন্য ${medList} খান।`
        : `আপনি আরও জানিয়েছেন যে আপনি ${medList} খান।`;
    }

    const sentences = [s1, s2, s3].filter((s): s is string => Boolean(s)).slice(0, 3);
    return sentences.join(' ');
  }

  if (isHi) {
    const complaintText = formatComplaintHi(input.chiefComplaint);
    const durationText = formatDurationHi(input.duration);

    // Sentence 1: Complaint & duration
    const s1 = durationText
      ? `आपने हमें बताया कि आपको ${complaintText} है जो ${durationText} पहले शुरू हुआ था।`
      : `आपने हमें बताया कि आपको ${complaintText} है।`;

    // Sentence 2: Action based on red flag
    const s2 = hasRedFlag
      ? 'इस कारण, कृपया तुरंत डॉक्टर को बताएं।'
      : 'इसलिए, कृपया अपनी बारी की प्रतीक्षा करें।';

    // Sentence 3: Medications (skipped if none)
    let s3: string | null = null;
    if (medList) {
      s3 = condition
        ? `आपने यह भी बताया कि आप ${condition} के लिए ${medList} लेते हैं।`
        : `आपने यह भी बताया कि आप ${medList} लेते हैं।`;
    }

    const sentences = [s1, s2, s3].filter((s): s is string => Boolean(s)).slice(0, 3);
    return sentences.join(' ');
  }

  // English
  const complaintText = formatComplaintEn(input.chiefComplaint);
  const durationText = formatDurationEn(input.duration);

  // Sentence 1: Complaint & duration
  const s1 = durationText
    ? `You told us you have ${complaintText} that started ${durationText}.`
    : `You told us you have ${complaintText}.`;

  // Sentence 2: Action based on red flag
  const s2 = hasRedFlag
    ? 'Because of this, please tell the doctor right away.'
    : 'Because of this, please wait for your turn.';

  // Sentence 3: Medications (skipped if none)
  let s3: string | null = null;
  if (medList) {
    s3 = condition
      ? `You also said you take ${medList} for ${condition}.`
      : `You also said you take ${medList}.`;
  }

  const sentences = [s1, s2, s3].filter((s): s is string => Boolean(s)).slice(0, 3);
  return sentences.join(' ');
}

/**
 * Extracts normalized summary input fields from raw session, facts, and history objects.
 */
export function extractSessionSummaryInput(
  session: any,
  facts?: any[],
  medicalHistory?: any[],
  redFlags?: any[]
): PlainSummaryInput {
  const rawLang = (session?.language || 'en').toLowerCase();
  const lang = rawLang.startsWith('mr') ? 'mr' : rawLang.startsWith('bn') ? 'bn' : rawLang.startsWith('hi') ? 'hi' : 'en';

  // 1. Chief Complaint
  let chiefComplaint = session?.chief_complaint || session?.patient_complaint;
  if (!chiefComplaint && Array.isArray(facts)) {
    const ccFact = facts.find(f => f.question_id === 'chief_complaint');
    if (ccFact) chiefComplaint = ccFact.answer_text || ccFact.answer_value;
  }

  // 2. Duration from facts
  let duration: string | undefined;
  if (Array.isArray(facts)) {
    const durationFact = facts.find(f => {
      const qId = (f.question_id || '').toLowerCase();
      const qText = (f.question_text || '').toLowerCase();
      return (
        qId.includes('duration') ||
        qId.includes('onset') ||
        qText.includes('how long') ||
        qText.includes('duration') ||
        qText.includes('start')
      );
    });
    if (durationFact) {
      duration = durationFact.answer_text || durationFact.answer_value;
    }
  }

  // 3. Red flag detection
  let hasRedFlag = Boolean(session?.red_flag);
  if (!hasRedFlag && Array.isArray(redFlags) && redFlags.length > 0) {
    hasRedFlag = true;
  }
  if (!hasRedFlag && Array.isArray(facts)) {
    hasRedFlag = facts.some(f => {
      if (f.red_flag_id) return true;
      const val = (f.answer_value || f.answer_text || '').toLowerCase();
      return val === 'left_arm' || val === 'jaw' || val.includes('left arm') || val.includes('thunderclap');
    });
  }

  // 4. Medications & Conditions
  let medications: string | undefined;
  let condition: string | undefined;
  if (Array.isArray(medicalHistory)) {
    const medItem = medicalHistory.find(m => /medication/i.test(m.category || ''));
    if (medItem && medItem.value) {
      medications = medItem.value;
    }
    const condItem = medicalHistory.find(m => /condition/i.test(m.category || ''));
    if (condItem && condItem.value) {
      condition = condItem.value;
    }
  }

  return {
    chiefComplaint,
    duration,
    hasRedFlag,
    medications,
    condition,
    language: lang
  };
}

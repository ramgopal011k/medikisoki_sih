/**
 * Smart Voice Matching Engine for MediKiosk
 * 
 * Handles real-world speech from diverse patients (elderly, non-tech, multi-lingual):
 * 1. Preamble & filler words: "My name is X and I have...", "Doctor sahab mujhe lagbhag..."
 * 2. Parentheses & sub-phrase extraction: "Subacute (3 to 8 weeks)" -> matches "3 to 8 weeks", "3 to 8", "subacute"
 * 3. Numeric & duration range detection: "2 weeks", "3 to 8 weeks", "more than 2 months"
 * 4. Pain severity scale (1-10 / Mild / Moderate / Severe)
 * 5. Multi-lingual Hindi + English synonyms & colloquial affirmations
 * 6. Token Overlap / Word Jaccard + Gemini fallback
 */

import { API_URL, getAuthHeaders } from './api';

export interface MatchOption {
  value: string;
  label: string;
  label_hi?: string;
  label_mr?: string;
  label_bn?: string;
}

export interface MatchResult {
  matched: boolean;
  value: string;
  label: string;
  confidence: number;
  reason?: string;
}

// Common conversational preamble & filler phrases to strip
const FILLER_PATTERNS = [
  /^(?:hello|namaste|hi|hey|namaskar|doctor\s*sahab|doctor|dr)\b[,\s]*/i,
  /^(?:my\s*name\s*is|i\s*am|mera\s*naam|main\s*hoon|naam)\s+[\w\s]+?\s+(?:and|hai|aur|have|suffering|problem|issue)\b/i,
  /^(?:i\s*am\s*having|i\s*have|mujhe|mujhe\s*lagta\s*hai|i\s*think|i\s*feel|lagta\s*hai)\b/i,
  /^(?:it\s*is|it\s*has\s*been|since|from|for|around|about|approx|lagbhag|almost|nearly)\b/i,
  /^(?:actually|basically|well|you\s*know|to\s*be\s*honest|dekhiye|batao)\b/i,
  /\b(?:please|kripya|bataiye|doctor)\b/gi
];

// Number word to digit mapping (English & Hindi)
const NUMBER_WORDS: Record<string, string> = {
  'zero': '0', 'shunya': '0', 'shoonya': '0',
  'one': '1', 'ek': '1', 'एक': '1',
  'two': '2', 'do': '2', 'दो': '2',
  'three': '3', 'teen': '3', 'तीन': '3',
  'four': '4', 'chaar': '4', 'char': '4', 'चार': '4',
  'five': '5', 'paanch': '5', 'panch': '5', 'पांच': '5',
  'six': '6', 'chhah': '6', 'che': '6', 'छह': '6',
  'seven': '7', 'saat': '7', 'सात': '7',
  'eight': '8', 'aath': '8', 'आठ': '8',
  'nine': '9', 'nau': '9', 'नौ': '9',
  'ten': '10', 'das': '10', 'दस': '10'
};

/**
 * Normalizes user transcript:
 * - Lowercases and trims
 * - Replaces written number words with digits (e.g. "three to eight" -> "3 to 8")
 * - Removes leading conversational filler if an answer follows
 */
export function normalizeTranscript(text: string): string {
  if (!text) return '';
  let cleaned = text.toLowerCase().trim();

  // Convert word numbers to digits
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, digit);
  }

  // Remove common filler patterns
  for (const pattern of FILLER_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ').trim();
  }

  // Normalize punctuation and whitespace
  cleaned = cleaned.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Extracts sub-phrases from option label (e.g. text inside and outside parentheses)
 * "Subacute (3 to 8 weeks)" -> ["subacute (3 to 8 weeks)", "subacute", "3 to 8 weeks", "3 to 8", "3-8 weeks"]
 */
export function extractOptionSubPhrases(label: string, labelHi?: string, labelMr?: string, labelBn?: string): string[] {
  const phrases: string[] = [];

  const addLangPhrases = (text?: string) => {
    if (!text) return;
    const rawLang = text.toLowerCase();
    phrases.push(rawLang);
    const outside = rawLang.replace(/\(.*?\)/g, '').trim();
    if (outside && outside !== rawLang) phrases.push(outside);
    const parenMatches = rawLang.match(/\((.*?)\)/g);
    if (parenMatches) {
      for (const m of parenMatches) {
        const inside = m.replace(/[()]/g, '').trim();
        if (inside) {
          phrases.push(inside);
          if (inside.includes('/')) {
            inside.split('/').forEach(part => {
              const p = part.trim();
              if (p) phrases.push(p);
            });
          }
          if (inside.includes('to')) {
            phrases.push(inside.replace(/\bto\b/g, '-').replace(/\s+/g, ''));
            phrases.push(inside.replace(/\bto\b/g, ' '));
          }
        }
      }
    }
    if (rawLang.includes('/')) {
      rawLang.split('/').forEach(part => {
        const p = part.trim();
        if (p) phrases.push(p);
      });
    }
  };

  addLangPhrases(label);
  addLangPhrases(labelHi);
  addLangPhrases(labelMr);
  addLangPhrases(labelBn);

  return Array.from(new Set(phrases.map(p => p.toLowerCase().trim()).filter(Boolean)));
}

/**
 * Checks if duration/timeline matches known categories:
 * - Acute (< 3 weeks)
 * - Subacute (3 to 8 weeks)
 * - Chronic (> 8 weeks / long standing)
 */
function matchDurationCategory(transcript: string, options: MatchOption[]): MatchOption | null {
  const clean = normalizeTranscript(transcript);

  // Check Subacute (3 to 8 weeks)
  const isSubacute = (
    /\b(?:subacute|sub-acute|3\s*(?:to|-|se)\s*8\s*weeks?|3\s*to\s*8|3-8|3\s*se\s*8\s*hafte|3\s*se\s*8|month|1\s*month|one\s*month|ek\s*mahina|4\s*weeks?|5\s*weeks?|6\s*weeks?|7\s*weeks?)\b/i.test(clean) ||
    (clean.includes('3') && clean.includes('8'))
  );
  if (isSubacute) {
    const subOpt = options.find(o => 
      o.value.toLowerCase().includes('subacute') || 
      o.label.toLowerCase().includes('subacute') || 
      o.label.toLowerCase().includes('3 to 8') ||
      o.label.toLowerCase().includes('3-8')
    );
    if (subOpt) return subOpt;
  }

  // Check Acute (< 3 weeks)
  const isAcute = !clean.includes('subacute') && (
    /\b(?:acute|less\s*than\s*3\s*weeks?|under\s*3\s*weeks?|<3|< 3|few\s*days|recent|just\s*started|1\s*week|2\s*weeks?|1-2\s*weeks?|kuch\s*din|1\s*hafta|2\s*hafte)\b/i.test(clean) ||
    (/\b(?:1|2)\s*weeks?\b/i.test(clean) && !clean.includes('8'))
  );
  if (isAcute) {
    const acuteOpt = options.find(o => 
      o.value.toLowerCase().includes('acute') || 
      o.label.toLowerCase().includes('acute') || 
      o.label.toLowerCase().includes('less than 3') ||
      o.label.toLowerCase().includes('< 3')
    );
    if (acuteOpt) return acuteOpt;
  }

  // Check Chronic (> 8 weeks / Long standing)
  const isChronic = (
    /\b(?:chronic|more\s*than\s*8\s*weeks?|>8|> 8|long\s*standing|long\s*time|years|months|2\s*months|3\s*months|bahut\s*purani|kafi\s*samay|8\s*hafte\s*se\s*zyada)\b/i.test(clean) ||
    (/\b(?:8|9|10|12)\s*weeks?\b/i.test(clean) && clean.includes('more'))
  );
  if (isChronic) {
    const chronicOpt = options.find(o => 
      o.value.toLowerCase().includes('chronic') || 
      o.label.toLowerCase().includes('chronic') || 
      o.label.toLowerCase().includes('more than 8') ||
      o.label.toLowerCase().includes('long standing')
    );
    if (chronicOpt) return chronicOpt;
  }

  return null;
}

/**
 * Checks if pain/severity rating matches:
 * - 7-10 Severe / Crushing / Unbearable
 * - 4-6 Moderate / Medium
 * - 1-3 Mild / Slight
 */
function matchSeverityCategory(transcript: string, options: MatchOption[]): MatchOption | null {
  const clean = normalizeTranscript(transcript);

  // Severe (7-10)
  const isSevere = (
    /\b(?:severe|crushing|unbearable|extreme|heavy|terrible|bahut\s*zyada|asahiya|bhyankar|7|8|9|10|7-10|7\s*to\s*10|8\/10|9\/10|10\/10)\b/i.test(clean)
  );
  if (isSevere) {
    const sevOpt = options.find(o => 
      o.value.toLowerCase().includes('severe') || 
      o.value.includes('7-10') || 
      o.value.includes('7_10') ||
      o.label.toLowerCase().includes('severe') || 
      o.label.toLowerCase().includes('7-10') ||
      o.label.toLowerCase().includes('7 to 10')
    );
    if (sevOpt) return sevOpt;
  }

  // Moderate (4-6)
  const isModerate = (
    /\b(?:moderate|medium|tolerable|beech\s*ka|madhyam|sahyogya|4|5|6|4-6|4\s*to\s*6|5\/10)\b/i.test(clean)
  );
  if (isModerate) {
    const modOpt = options.find(o => 
      o.value.toLowerCase().includes('moderate') || 
      o.value.includes('4-6') || 
      o.label.toLowerCase().includes('moderate') || 
      o.label.toLowerCase().includes('4-6')
    );
    if (modOpt) return modOpt;
  }

  // Mild (1-3)
  const isMild = (
    /\b(?:mild|slight|little|halka|thoda|kam|1|2|3|1-3|1\s*to\s*3|2\/10)\b/i.test(clean)
  );
  if (isMild) {
    const mildOpt = options.find(o => 
      o.value.toLowerCase().includes('mild') || 
      o.value.includes('1-3') || 
      o.label.toLowerCase().includes('mild') || 
      o.label.toLowerCase().includes('1-3')
    );
    if (mildOpt) return mildOpt;
  }

  return null;
}

/**
 * Checks Yes / No / Don't Know / Not Sure
 */
function matchBinaryOrUnknown(transcript: string, options: MatchOption[]): MatchOption | null {
  const clean = normalizeTranscript(transcript);

  // Unknown / Not sure
  const isUnknown = /\b(?:don'?t\s*know|not\s*sure|no\s*idea|unsure|pata\s*nahi|maloom\s*nahi|nahi\s*pata|yaad\s*nahi|koi\s*idea\s*nahi|mahiti\s*nahi|thik\s*nahi|jana\s*nei|janina|thik\s*nei|माहिती नाही|माहीत नाही|জানা নেই|জানিনা)\b/i.test(clean);
  if (isUnknown) {
    const unkOpt = options.find(o => 
      o.value === 'unknown' || 
      o.value === 'not_sure' || 
      o.label.toLowerCase().includes("don't know") || 
      o.label.toLowerCase().includes('not sure') ||
      (o.label_hi && o.label_hi.includes('नहीं पता')) ||
      (o.label_mr && o.label_mr.includes('माहित नाही')) ||
      (o.label_bn && o.label_bn.includes('জানা নেই'))
    );
    if (unkOpt) return unkOpt;
  }

  // Affirmative (Yes)
  const isAffirmative = /\b(?:yes|yeah|yep|yup|haan|ha|bilkul|sahi|correct|true|ji\s*haan|sure|definitely|हाँ|जी हाँ|हो|होय|नक्कीच|होय नक्की|হ্যাঁ|নিশ্চয়ই)\b/i.test(clean);
  // Negative (No)
  const isNegative = /\b(?:no|nah|nope|nahi|na|galat|false|ji\s*nahi|bilkul\s*nahi|none|नहीं|जी नहीं|नाही|मुळीच नाही|ना|না|কখনও না)\b/i.test(clean);

  if (isAffirmative && !isNegative) {
    const yesOpt = options.find(o => o.value === 'yes' || o.value === 'true' || o.value === '1' || o.label.toLowerCase() === 'yes' || o.label.toLowerCase().startsWith('yes'));
    if (yesOpt) return yesOpt;
  }

  if (isNegative && !isAffirmative) {
    const noOpt = options.find(o => o.value === 'no' || o.value === 'false' || o.value === '0' || o.value === 'none' || o.label.toLowerCase() === 'no' || o.label.toLowerCase().startsWith('no'));
    if (noOpt) return noOpt;
  }

  return null;
}

/**
 * Main Smart Match Function
 * Runs client-side fuzzy, sub-phrase, token overlap, and semantic rules,
 * with async fallback to backend Gemini API.
 */
export async function smartMatchOption(
  rawTranscript: string,
  options: MatchOption[]
): Promise<MatchResult> {
  if (!rawTranscript || !options || options.length === 0) {
    return { matched: false, value: '', label: '', confidence: 0 };
  }

  const raw = rawTranscript.trim();
  const rawLower = raw.toLowerCase();
  const clean = normalizeTranscript(raw);

  // 1. Check Duration / Timeline special rule (e.g. "3 to 8 weeks", "< 3 weeks")
  const durationMatch = matchDurationCategory(raw, options);
  if (durationMatch) {
    return { matched: true, value: durationMatch.value, label: durationMatch.label, confidence: 0.98, reason: 'duration_range' };
  }

  // 2. Check Severity / Pain scale special rule (e.g. "Severe", "7-10", "8/10")
  const severityMatch = matchSeverityCategory(raw, options);
  if (severityMatch) {
    return { matched: true, value: severityMatch.value, label: severityMatch.label, confidence: 0.98, reason: 'severity_scale' };
  }

  // 3. Check Yes / No / Unknown
  const binaryMatch = matchBinaryOrUnknown(raw, options);
  if (binaryMatch) {
    return { matched: true, value: binaryMatch.value, label: binaryMatch.label, confidence: 0.95, reason: 'binary_or_unknown' };
  }

  // 4. Sub-phrase bidirectional containment
  // Check if option sub-phrases contain the cleaned transcript, OR transcript contains option sub-phrase
  for (const opt of options) {
    const subPhrases = extractOptionSubPhrases(opt.label, opt.label_hi, opt.label_mr, opt.label_bn);
    for (const phrase of subPhrases) {
      if (phrase.length < 2) continue;

      // Exact phrase in transcript
      if (rawLower.includes(phrase) || clean.includes(phrase)) {
        return { matched: true, value: opt.value, label: opt.label, confidence: 0.95, reason: 'phrase_in_transcript' };
      }

      // Transcript in phrase (e.g., user says "3 to 8 weeks" which is contained in "Subacute (3 to 8 weeks)")
      if (phrase.includes(clean) && clean.length >= 3) {
        return { matched: true, value: opt.value, label: opt.label, confidence: 0.92, reason: 'transcript_in_phrase' };
      }

      // Value match
      if (clean === opt.value.toLowerCase() || rawLower.includes(opt.value.toLowerCase())) {
        return { matched: true, value: opt.value, label: opt.label, confidence: 0.95, reason: 'value_match' };
      }
    }
  }

  // 5. Token Overlap / Word Jaccard scoring
  const transcriptTokens = new Set(clean.split(/\s+/).filter(w => w.length > 1));
  let bestScore = 0;
  let bestOpt: MatchOption | null = null;

  for (const opt of options) {
    const subPhrases = extractOptionSubPhrases(opt.label, opt.label_hi, opt.label_mr, opt.label_bn);
    for (const phrase of subPhrases) {
      const phraseTokens = new Set(phrase.replace(/[(),/]/g, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 1));
      if (phraseTokens.size === 0) continue;

      let intersectionCount = 0;
      for (const token of transcriptTokens) {
        if (phraseTokens.has(token)) {
          intersectionCount++;
        }
      }

      const unionCount = new Set([...transcriptTokens, ...phraseTokens]).size;
      const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;
      const overlapRatio = phraseTokens.size > 0 ? intersectionCount / phraseTokens.size : 0;
      const score = Math.max(jaccard, overlapRatio);

      if (score > bestScore) {
        bestScore = score;
        bestOpt = opt;
      }
    }
  }

  // If we found a strong token overlap match (e.g. > 40%)
  if (bestOpt && bestScore >= 0.4) {
    return { matched: true, value: bestOpt.value, label: bestOpt.label, confidence: bestScore, reason: 'token_overlap' };
  }

  // 6. Asynchronous Backend AI Gemini Fallback
  try {
    const res = await fetch(`${API_URL}/api/match-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer medikiosk-demo-token'
      },
      body: JSON.stringify({
        text: rawTranscript,
        options: options.map(o => ({
          value: o.value,
          label: o.label,
          label_hi: o.label_hi
        }))
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.match) {
        const geminiOpt = options.find(o => o.value === data.match);
        if (geminiOpt) {
          return { matched: true, value: geminiOpt.value, label: geminiOpt.label, confidence: 0.85, reason: 'gemini_ai_fallback' };
        }
      }
    }
  } catch (err) {
    console.warn('[SmartVoiceMatch] Gemini API fallback error:', err);
  }

  return { matched: false, value: '', label: '', confidence: 0 };
}

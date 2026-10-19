/**
 * Universal ASR Transcript Cleaner
 *
 * Removes natural spoken filler words, hesitation sounds, and stutter repetitions
 * for English, Hindi, Marathi, and Bengali speech without altering clinical meaning.
 */

export interface CleanTranscriptOptions {
  language?: 'en' | 'hi' | 'mr' | 'bn' | string;
}

const EN_MULTI_WORD_FILLERS = [
  'you know',
  'i mean',
  'sort of',
  'kind of'
];

const EN_SINGLE_WORD_FILLERS = [
  'um',
  'uh',
  'er',
  'ah',
  'hmm',
  'mm',
  'like',
  'basically',
  'actually',
  'literally',
  'right',
  'okay',
  'so',
  'well',
  'anyway',
  'anyways'
];

const HI_MULTI_WORD_FILLERS = [
  'ठीक है'
];

const HI_SINGLE_WORD_FILLERS = [
  'अरे',
  'हाँ',
  'तो',
  'मतलब',
  'वो',
  'अच्छा',
  'और',
  'फिर'
];

const MR_SINGLE_WORD_FILLERS = [
  'बरं',
  'म्हणजे',
  'हो',
  'आणि',
  'मग',
  'अरे',
  'अच्छा',
  'ना'
];

const BN_SINGLE_WORD_FILLERS = [
  'মানে',
  'হ্যাঁ',
  'আর',
  'তো',
  'আচ্ছা',
  'তারপর',
  'হুম'
];

/**
 * Removes 1 to 4 consecutive word duplicates (e.g., "I am I am Raju" -> "I am Raju")
 */
export function removeConsecutiveDuplicates(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw;
  let prev = '';

  for (let pass = 0; pass < 5; pass++) {
    prev = text;
    // 4 words:
    text = text.replace(/(^|[\s,]+)([\p{L}\p{M}\d]+[\s,]+[\p{L}\p{M}\d]+[\s,]+[\p{L}\p{M}\d]+[\s,]+[\p{L}\p{M}\d]+)(?:[\s,]+\2)+(?=[\s,]+|$)/giu, '$1$2');
    // 3 words:
    text = text.replace(/(^|[\s,]+)([\p{L}\p{M}\d]+[\s,]+[\p{L}\p{M}\d]+[\s,]+[\p{L}\p{M}\d]+)(?:[\s,]+\2)+(?=[\s,]+|$)/giu, '$1$2');
    // 2 words:
    text = text.replace(/(^|[\s,]+)([\p{L}\p{M}\d]+[\s,]+[\p{L}\p{M}\d]+)(?:[\s,]+\2)+(?=[\s,]+|$)/giu, '$1$2');
    // 1 word:
    text = text.replace(/(^|[\s,]+)([\p{L}\p{M}\d]+)(?:[\s,]+\2)+(?=[\s,]+|$)/giu, '$1$2');
    if (text === prev) break;
  }
  return text;
}

/**
 * Clean spoken ASR transcripts by filtering filler words, stuttering, and stray punctuation.
 */
export function cleanTranscript(raw: string, opts?: CleanTranscriptOptions): string {
  if (!raw || typeof raw !== 'string') return '';
  const lang = opts?.language || 'en';
  let text = raw;

  // 1. Initial stutter repetition collapse (1 to 4 consecutive words)
  text = removeConsecutiveDuplicates(text);

  const filterList = (phrases: string[]) => {
    for (const p of phrases) {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp('(^|[\\s,]+)' + escaped + '(?=[\\s,]+|$)', 'gi');
      text = text.replace(reg, ' ');
    }
  };

  // 2. Remove fillers based on selected language
  if (lang === 'en' || !opts?.language) {
    filterList(EN_MULTI_WORD_FILLERS);
    filterList(EN_SINGLE_WORD_FILLERS);
  }
  if (lang === 'hi' || !opts?.language) {
    filterList(HI_MULTI_WORD_FILLERS);
    filterList(HI_SINGLE_WORD_FILLERS);
  }
  if (lang === 'mr' || !opts?.language) {
    filterList(MR_SINGLE_WORD_FILLERS);
  }
  if (lang === 'bn' || !opts?.language) {
    filterList(BN_SINGLE_WORD_FILLERS);
  }

  // 3. Second pass on stutter repetitions after fillers have been stripped
  text = removeConsecutiveDuplicates(text);

  // 4. Clean stray commas/dandas/punctuation left over from filler excision
  text = text.replace(/^[,\s।.-]+/u, '');
  text = text.replace(/[,\s।.-]+$/u, '');
  text = text.replace(/\s*,\s*,+/g, ',');
  text = text.replace(/\s*,\s*/g, ' ');

  // 5. Collapse multiple spaces and trim
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Context-Aware Patient Name Extraction for Registration fields.
 *
 * Strips common prefixes ("my name is", "i am", "mera naam", "main", etc.)
 * Strips age / trailing details ("age 30", "30 years old", "hai", etc.)
 * Returns a capitalized name, or falls back to the cleaned transcript if empty.
 */
export function extractName(rawTranscript: string): string {
  if (!rawTranscript || typeof rawTranscript !== 'string') return '';
  const cleaned = cleanTranscript(rawTranscript);
  if (!cleaned) return '';

  let text = cleaned.trim();

  // Non-name isolated commands / system keywords to ignore
  const SYSTEM_KEYWORDS = new Set([
    'male', 'female', 'other', 'yes', 'no', 'continue', 'next', 'back', 'submit',
    'पुरुष', 'महिला', 'अन्य', 'हाँ', 'नहीं', 'आगे', 'पीछे',
    'नवीन', 'रुग्ण', 'पुढे', 'नाही', 'होय',
    'নতুন', 'রোগী', 'পরবর্তী', 'না', 'হ্যাঁ'
  ]);

  if (SYSTEM_KEYWORDS.has(text.toLowerCase()) || /^\d+$/.test(text)) {
    return '';
  }

  // 1. Strip common introductory prefixes (case-insensitive)
  // English: "my name is", "i am", "i'm", "this is", "name is"
  // Hindi / Hinglish: "mera naam", "mera nam", "main hoon", "main", "mai", "mera name"
  // Marathi: "maze naav", "majhe naav", "mi"
  // Bengali: "amar naam", "ami"
  const prefixRegex = /^(?:my\s+name\s+is|i\s+am|i'm|this\s+is|name\s+is|mera\s+naam(?:\s+hai)?|mera\s+nam(?:\s+hai)?|mera\s+name(?:\s+is)?|main\s+hoon|main|mai\s+hoon|mai|maze\s+naav|majhe\s+naav|mi\s+aahe|mi|amar\s+naam|ami)\s+/iu;
  text = text.replace(prefixRegex, '').trim();

  // 2. Strip age / trailing information:
  // e.g., "age 30", "age is 30", "30 years old", "30 years", "30 saal", "years old", "hai", "hoon", "ahe", "male", "female"
  const trailingRegex = /\s+(?:(?:and\s+)?(?:my\s+)?age(?:\s+is)?\s*.*|\d+\s*(?:years?\s*(?:old)?|saal|varsh).*|years?\s*old.*|(?:and\s+)?(?:i\s+am\s+)?(?:male|female|other|purush|mahila).*|(?:hai|hoon|hun|ahe|achhe)\b.*)$/iu;
  text = text.replace(trailingRegex, '').trim();

  // Strip standalone trailing words like "hai", "hoon", etc. if remaining at end
  text = text.replace(/\s+(?:hai|hoon|hun|ahe|achhe)$/iu, '').trim();

  // Strip any trailing numbers / digits leftover
  text = text.replace(/\s+\d+.*$/, '').trim();

  // If extraction resulted in an empty string, fallback to cleaned transcript
  if (!text) {
    text = cleaned;
  }

  // If after fallback it's only digits or system keywords, return empty
  if (SYSTEM_KEYWORDS.has(text.toLowerCase()) || /^\d+$/.test(text)) {
    return '';
  }

  // Capitalize words (e.g., "raju kumar" -> "Raju Kumar")
  const capitalized = text
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim();

  return capitalized || cleaned;
}

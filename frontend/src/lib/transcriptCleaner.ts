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
 * Clean spoken ASR transcripts by filtering filler words, stuttering, and stray punctuation.
 */
export function cleanTranscript(raw: string, opts?: CleanTranscriptOptions): string {
  if (!raw || typeof raw !== 'string') return '';
  const lang = opts?.language || 'en';
  let text = raw;

  // 1. Initial stutter repetition collapse (e.g., "I I have" -> "I have")
  text = text.replace(/(^|[\s,]+)([\p{L}\p{M}]+)(?:[\s,]+\2)+(?=[\s,]+|$)/giu, '$1$2');

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
  text = text.replace(/(^|[\s,]+)([\p{L}\p{M}]+)(?:[\s,]+\2)+(?=[\s,]+|$)/giu, '$1$2');
  text = text.replace(/(^|[\s,]+)([\p{L}\p{M}]+)(?:[\s,]+\2)+(?=[\s,]+|$)/giu, '$1$2');

  // 4. Clean stray commas/dandas/punctuation left over from filler excision
  text = text.replace(/^[,\s।.-]+/u, '');
  text = text.replace(/[,\s।.-]+$/u, '');
  text = text.replace(/\s*,\s*,+/g, ',');
  text = text.replace(/\s*,\s*/g, ' ');

  // 5. Collapse multiple spaces and trim
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

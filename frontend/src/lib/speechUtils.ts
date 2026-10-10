/**
 * Utility functions to parse and normalize spoken ASR inputs (English, Hindi, Marathi, Bengali)
 */

export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'bn';

const WORD_TO_DIGIT: Record<string, string> = {
  // English words
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',

  // Devanagari numerals (Hindi & Marathi)
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',

  // Hindi number words
  'शून्य': '0',
  'एक': '1',
  'दो': '2',
  'तीन': '3',
  'चार': '4',
  'पाँच': '5',
  'पांच': '5',
  'छह': '6',
  'छः': '6',
  'सात': '7',
  'आठ': '8',
  'नौ': '9',

  // Marathi number words
  'दोन': '2',
  'पाच': '5',
  'सहा': '6',
  'नऊ': '9',

  // Bengali numerals
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',

  // Bengali number words
  'এক': '1',
  'দুই': '2',
  'তিন': '3',
  'চার': '4',
  'পাঁচ': '5',
  'ছয়': '6',
  'ছয়': '6',
  'সাত': '7',
  'আট': '8',
  'নয়': '9',
  'নয়': '9',
  'দশ': '10',

  // Transliterations
  shunya: '0',
  ek: '1',
  do: '2',
  don: '2',
  dui: '2',
  teen: '3',
  tin: '3',
  char: '4',
  chaar: '4',
  paanch: '5',
  panch: '5',
  paach: '5',
  che: '6',
  chhe: '6',
  saha: '6',
  chhoy: '6',
  saat: '7',
  sat: '7',
  shaat: '7',
  aath: '8',
  ath: '8',
  aat: '8',
  nau: '9',
  nauv: '9',
  noy: '9'
};

/**
 * Extracts a sequence of digits from spoken text, handling raw digits,
 * English number words, Hindi, Marathi, and Bengali number words and numerals.
 */
export function extractDigitsFromSpokenText(spokenText: string): string {
  if (!spokenText) return '';

  // Clean and split into individual word tokens
  const tokens = spokenText
    .toLowerCase()
    .replace(/[,.-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let result = '';

  for (const token of tokens) {
    if (/\d/.test(token)) {
      result += token.replace(/\D/g, '');
    } else if (WORD_TO_DIGIT[token]) {
      result += WORD_TO_DIGIT[token];
    } else {
      // Check for compound spoken tokens or Devanagari/Bengali numerals
      for (const char of token) {
        if (WORD_TO_DIGIT[char]) {
          result += WORD_TO_DIGIT[char];
        } else if (/\d/.test(char)) {
          result += char;
        }
      }
    }
  }

  return result;
}

/**
 * Matches spoken language selection keywords (English, Hindi, Marathi, Bengali)
 */
export function matchSpokenLanguage(text: string): SupportedLanguage | null {
  const lower = text.toLowerCase();
  if (
    lower.includes('hindi') ||
    lower.includes('हिंदी') ||
    lower.includes('हिन्दी') ||
    lower.includes('hind')
  ) {
    return 'hi';
  }
  if (
    lower.includes('english') ||
    lower.includes('अंग्रेजी') ||
    lower.includes('अंग्रेज़ी') ||
    lower.includes('angrezi') ||
    lower.includes('eng')
  ) {
    return 'en';
  }
  if (
    lower.includes('marathi') ||
    lower.includes('मराठी') ||
    lower.includes('marath')
  ) {
    return 'mr';
  }
  if (
    lower.includes('bengali') ||
    lower.includes('bangla') ||
    lower.includes('বাংলা') ||
    lower.includes('बंगाली') ||
    lower.includes('বাঙলা')
  ) {
    return 'bn';
  }
  return null;
}

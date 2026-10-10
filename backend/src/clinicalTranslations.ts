/**
 * Comprehensive Multi-Lingual Clinical Translation Engine
 * Supports: English ('en'), Hindi ('hi'), Marathi ('mr'), Bengali ('bn')
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { translate as sarvamTranslate } from './orchestration/sarvamClient';

export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'bn';

interface TranslationEntry {
  hi: string;
  mr: string;
  bn: string;
}

export const CLINICAL_DICTIONARY: Record<string, TranslationEntry> = {
  // --- Placeholders & Standard Fallbacks ---
  'none reported': {
    hi: 'कोई विवरण दर्ज नहीं',
    mr: 'कोणतीही नोंद नाही',
    bn: 'কোনো বিবরণ লিপিবদ্ধ নেই'
  },
  'none': {
    hi: 'कोई नहीं',
    mr: 'काही नाही',
    bn: 'কিছু নেই'
  },
  'no prior chronic conditions recorded': {
    hi: 'कोई पूर्व पुरानी बीमारी दर्ज नहीं है',
    mr: 'पूर्वीचा कोणताही जुनाट आजार नोंदवलेला नाही',
    bn: 'কোনো দীর্ঘস্থায়ী অসুস্থতা লিপিবদ্ধ নেই'
  },
  'not elicited in this session': {
    hi: 'इस सत्र में नहीं पूछा गया',
    mr: 'या सत्रात विचारले नाही',
    bn: 'এই সেশনে জিজ্ঞাসা করা হয়নি'
  },
  'no data': {
    hi: 'कोई डेटा नहीं',
    mr: 'माहिती उपलब्ध नाही',
    bn: 'কোন তথ্য নেই'
  },
  'unknown': {
    hi: 'अज्ञात / निश्चित नहीं',
    mr: 'अज्ञात / माहिती नाही',
    bn: 'অজানা / নিশ্চিত নয়'
  },
  'n/a': {
    hi: 'लागू नहीं',
    mr: 'लागू नाही',
    bn: 'প্রযোজ্য নয়'
  },

  // --- Chief Complaints ---
  'chest pain': {
    hi: 'छाती में दर्द',
    mr: 'छातीत दुखणे',
    bn: 'বুকে ব্যথা'
  },
  'fever': {
    hi: 'बुखार',
    mr: 'ताप',
    bn: 'জ্বর'
  },
  'abdominal pain': {
    hi: 'पेट में दर्द',
    mr: 'पोटदुखी',
    bn: 'পেটে ব্যথা'
  },
  'headache': {
    hi: 'सिरदर्द',
    mr: 'डोकेदुखी',
    bn: 'মাথাব্যথা'
  },
  'back pain': {
    hi: 'पीठ में दर्द',
    mr: 'पाठदुखी',
    bn: 'পিঠে ব্যথা'
  },
  'cough': {
    hi: 'खांसी',
    mr: 'खोकला',
    bn: 'কাশি'
  },
  'other': {
    hi: 'अन्य स्वास्थ्य समस्या',
    mr: 'इतर आरोग्य समस्या',
    bn: 'অন্যান্য স্বাস্থ্য समस्या'
  },
  'general clinical consultation': {
    hi: 'सामान्य नैदानिक परामर्श',
    mr: 'सामान्य वैद्यकीय सल्ला',
    bn: 'সাধারণ ক্লিনিক্যাল পরামর্শ'
  },
  'shortness of breath': {
    hi: 'सांस लेने में तकलीफ',
    mr: 'श्वास घेण्यास त्रास',
    bn: 'শ্বাসকষ্ট'
  },
  'dizziness': {
    hi: 'चक्कर आना',
    mr: 'चक्कर येणे',
    bn: 'মাথা ঘোরা'
  },
  'vomiting': {
    hi: 'उल्टी होना',
    mr: 'उलटी होणे',
    bn: 'বমি হওয়া'
  },

  // --- Symptoms & Localizations ---
  'in the middle of my chest': {
    hi: 'छाती के बीच में',
    mr: 'छातीच्या मध्यभागी',
    bn: 'বুকের মাঝখানে'
  },
  'on the left side': {
    hi: 'बाईं ओर',
    mr: 'डाव्या बाजूला',
    bn: 'বাম দিকে'
  },
  'on the right side': {
    hi: 'दाईं ओर',
    mr: 'उजव्या बाजूला',
    bn: 'ডান দিকে'
  },
  'down my left arm': {
    hi: 'मेरे बाएं हाथ के नीचे',
    mr: 'माझ्या डाव्या हाताकडे',
    bn: 'আমার বাম হাতের দিকে'
  },
  'up to my jaw or neck': {
    hi: 'मेरे जबड़े या गर्दन तक',
    mr: 'माझ्या जबड्यापर्यंत किंवा मानेपर्यंत',
    bn: 'আমার চোয়াল বা ঘাড় পর্যন্ত'
  },
  'through to my back': {
    hi: 'मेरी पीठ तक',
    mr: 'माझ्या पाठीकडे',
    bn: 'আমার পিঠের দিকে'
  },
  'no, it stays in one place': {
    hi: 'नहीं, यह एक ही जगह रहता है',
    mr: 'नाही, ते एकाच जागी राहते',
    bn: 'না, এটি এক জায়গায় থাকে'
  },
  'sharp stabbing': {
    hi: 'तेज चुभने वाला दर्द',
    mr: 'तीव्र टोचल्यासारखे दुखणे',
    bn: 'তীব্র তীক্ষ্ণ ব্যথা'
  },
  'burning': {
    hi: 'जलन जैसा दर्द',
    mr: 'जळजळ होणारे दुखणे',
    bn: 'জ্বলুনিযুক্ত ব্যথা'
  },
  'heavy crushing pressure': {
    hi: 'भारी दबाव या जकड़न',
    mr: 'जड दाब किंवा जकडणे',
    bn: 'ভারী চাপ বা অস্বস্তি'
  },
  'dull ache': {
    hi: 'हल्का धीमा दर्द',
    mr: 'मंद दुखणे',
    bn: 'মৃদু ব্যথা'
  },

  // --- Medical Conditions ---
  'hypertension': {
    hi: 'उच्च रक्तचाप (Hypertension)',
    mr: 'उच्च रक्तदाब (Hypertension)',
    bn: 'উচ্চ রক্তচাপ (Hypertension)'
  },
  'diabetes': {
    hi: 'मधुमेह (Diabetes)',
    mr: 'मधुमेह (Diabetes)',
    bn: 'ডায়াবেটিস (Diabetes)'
  },
  'asthma': {
    hi: 'दमा (Asthma)',
    mr: 'दमा (Asthma)',
    bn: 'হাঁপানি (Asthma)'
  },
  'heart disease': {
    hi: 'हृदय रोग (Heart Disease)',
    mr: 'हृदयरोग (Heart Disease)',
    bn: 'হৃদরোগ (Heart Disease)'
  },
  'cancer': {
    hi: 'कैंसर (Cancer)',
    mr: 'कर्करोग (Cancer)',
    bn: 'ক্যান্সার (Cancer)'
  },
  'tuberculosis': {
    hi: 'टीबी / तपेदिक (Tuberculosis)',
    mr: 'क्षयरोग (Tuberculosis)',
    bn: 'যক্ষ্মা (Tuberculosis)'
  },
  'appendectomy': {
    hi: 'अपेंडिक्स सर्जरी (Appendectomy)',
    mr: 'अपेंडिक्स शस्त्रक्रिया (Appendectomy)',
    bn: 'অ্যাপেন্ডিক্স অপারেশন (Appendectomy)'
  },
  'cholecystectomy': {
    hi: 'पित्ताशय की सर्जरी (Cholecystectomy)',
    mr: 'पित्ताशयाची शस्त्रक्रिया (Cholecystectomy)',
    bn: 'পিত্তথলি অস্ত্রোপচার (Cholecystectomy)'
  },

  // --- Lifestyle & Habits ---
  'non-smoker, active lifestyle': {
    hi: 'धूम्रपान रहित, सक्रिय जीवनशैली',
    mr: 'धूम्रपान नाही, सक्रिय जीवनशैली',
    bn: 'অধূমপায়ী, সক্রিয় জীবনধারা'
  },
  'regular exercise': {
    hi: 'नियमित व्यायाम',
    mr: 'नियमित व्यायाम',
    bn: 'নিয়মিত ব্যায়াম'
  },
  'vegetarian': {
    hi: 'शाकाहारी आहार',
    mr: 'शाकाहारी आहार',
    bn: 'নিরামিষভোজী'
  },
  'non-vegetarian': {
    hi: 'मांसाहारी आहार',
    mr: 'मांसाहारी आहार',
    bn: 'আমিষভোজী'
  },

  // --- Review of Systems & Constitutional ---
  'constitutional: alert, oriented': {
    hi: 'शारीरिक स्थिति: सतर्क, सचेत एवं होश में',
    mr: 'शारीरिक स्थिती: सतर्क आणि जागरूक',
    bn: 'শারীরিক অবস্থা: সচেতন এবং সজাগ'
  },
  'alert, oriented': {
    hi: 'सतर्क एवं सचेत',
    mr: 'सतर्क आणि जागरूक',
    bn: 'সচেতন এবং স্বাভাবিক'
  },
  'patient presented for triage evaluation.': {
    hi: 'मरीज ट्राइएज मूल्यांकन एवं परामर्श के लिए उपस्थित हुआ।',
    mr: 'रुग्ण ट्रायज तपासणी आणि सल्ल्यासाठी उपस्थित झाला.',
    bn: 'রোগী ট্রায়াজ মূল্যায়ন ও পরামর্শের জন্য উপস্থিত হয়েছেন।'
  },
  'patient presented with acute chest tightness. vital signs stable. ecg and cardiac enzymes ordered.': {
    hi: 'मरीज को छाती में तीव्र जकड़न की शिकायत है। महत्वपूर्ण लक्षण (वाइटल्स) स्थिर हैं। ईसीजी और कार्डियक एंजाइम जांच के निर्देश दिए गए।',
    mr: 'रुग्णाला छातीत तीव्र जकडण्याची तक्रार आहे. जीवनचिन्हे स्थिर आहेत. ईसीजी आणि कार्डियाक एन्झाइम्स चाचणीचे निर्देश दिले.',
    bn: 'রোগীর বুকে তীব্র চাপ অনুভূত হচ্ছে। শারীরিক লক্ষণসমূহ স্থিতিশীল। ইসিজি এবং কার্ডিয়াক এনজাইম পরীক্ষার নির্দেশ দেওয়া হয়েছে।'
  },
  'immediate attention required': {
    hi: 'तत्काल ध्यान आवश्यक',
    mr: 'त्वरित वैद्यकीय लक्ष आवश्यक',
    bn: 'অবিলম্বে মনোযোগ প্রয়োজন'
  }
};

// Section headers mapping for canonical summary display
export const CLINICAL_SECTION_LABELS: Record<string, Record<string, string>> = {
  en: {
    chief_complaint: 'Chief Complaint',
    hpi: 'History of Present Illness (HPI)',
    pmh: 'Past Medical History',
    psh: 'Past Surgical History',
    drug_history: 'Drug History',
    allergy_history: 'Allergy History',
    family_history: 'Family History',
    personal_history: 'Personal History',
    ros: 'Review of Systems (ROS)'
  },
  hi: {
    chief_complaint: 'मुख्य शिकायत (Chief Complaint)',
    hpi: 'वर्तमान बीमारी का इतिहास (HPI)',
    pmh: 'पूर्व चिकित्सा इतिहास (Past Medical History)',
    psh: 'पूर्व शल्य चिकित्सा इतिहास (Surgical History)',
    drug_history: 'दवाओं का इतिहास (Drug History)',
    allergy_history: 'एलर्जी का इतिहास (Allergy History)',
    family_history: 'पारिवारिक इतिहास (Family History)',
    personal_history: 'व्यक्तिगत इतिहास (Personal History)',
    ros: 'शारीरिक प्रणालियों की समीक्षा (Review of Systems)'
  },
  mr: {
    chief_complaint: 'मुख्य तक्रार (Chief Complaint)',
    hpi: 'सध्याच्या आजाराचा इतिहास (HPI)',
    pmh: 'मागील वैद्यकीय इतिहास (Past Medical History)',
    psh: 'मागील शस्त्रक्रिया इतिहास (Surgical History)',
    drug_history: 'औषधांचा इतिहास (Drug History)',
    allergy_history: 'ॲलर्जीचा इतिहास (Allergy History)',
    family_history: 'कौटुंबिक इतिहास (Family History)',
    personal_history: 'वैयक्तिक इतिहास (Personal History)',
    ros: 'शारीरिक प्रणाली पुनरावलोकन (Review of Systems)'
  },
  bn: {
    chief_complaint: 'প্রধান অভিযোগ (Chief Complaint)',
    hpi: 'বর্তমান অসুস্থতার ইতিহাস (HPI)',
    pmh: 'অতীত চিকিৎসার ইতিহাস (Past Medical History)',
    psh: 'অতীত অস্ত্রোপচারের ইতিহাস (Surgical History)',
    drug_history: 'ওষুধের ইতিহাস (Drug History)',
    allergy_history: 'অ্যালার্জির ইতিহাস (Allergy History)',
    family_history: 'পারিবারিক ইতিহাস (Family History)',
    personal_history: 'ব্যক্তিগত ইতিহাস (Personal History)',
    ros: 'শারীরিক সিস্টেম পর্যালোচনা (Review of Systems)'
  }
};

const phraseMemoryCache = new Map<string, string>();

/**
 * Normalizes text to lookup keys
 */
function cleanKey(text: string): string {
  return text.trim().toLowerCase().replace(/[.]+$/, '');
}

/**
 * Multi-tier translation function:
 * 1. Direct dictionary match
 * 2. Token / substring replacement
 * 3. Sarvam AI translation
 * 4. Gemini Generative AI translation
 * 5. Rule-based medical transliteration
 */
export async function translateClinicalText(text: string, targetLang: 'hi' | 'mr' | 'bn'): Promise<string> {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';

  const cacheKey = `${targetLang}:${trimmed}`;
  if (phraseMemoryCache.has(cacheKey)) {
    return phraseMemoryCache.get(cacheKey)!;
  }

  const normalized = cleanKey(trimmed);

  // 1. Direct dictionary lookup
  if (CLINICAL_DICTIONARY[normalized] && CLINICAL_DICTIONARY[normalized][targetLang]) {
    const result = CLINICAL_DICTIONARY[normalized][targetLang];
    phraseMemoryCache.set(cacheKey, result);
    return result;
  }

  // 2. Compound / Substring replacement (e.g. "Appendectomy (2018)", "Metformin 500mg, Atorvastatin 20mg")
  let compound = trimmed;
  let didReplace = false;
  for (const [enTerm, entry] of Object.entries(CLINICAL_DICTIONARY)) {
    if (enTerm.length < 3) continue;
    const regex = new RegExp(`\\b${enTerm}\\b`, 'gi');
    if (regex.test(compound)) {
      compound = compound.replace(regex, entry[targetLang]);
      didReplace = true;
    }
  }
  if (didReplace) {
    phraseMemoryCache.set(cacheKey, compound);
    return compound;
  }

  // 3. Try Sarvam AI translation if available
  const sarvamCode = targetLang === 'mr' ? 'mr-IN' : targetLang === 'bn' ? 'bn-IN' : 'hi-IN';
  try {
    const sarvamRes: any = await sarvamTranslate(trimmed, 'en-IN', sarvamCode);
    if (sarvamRes && sarvamRes.translated_text && sarvamRes.translated_text !== trimmed) {
      phraseMemoryCache.set(cacheKey, sarvamRes.translated_text);
      return sarvamRes.translated_text;
    }
  } catch {}

  // 4. Try Gemini Generative AI if key exists
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const langName = targetLang === 'hi' ? 'Hindi' : targetLang === 'mr' ? 'Marathi' : 'Bengali';
      const prompt = `Translate this clinical phrase into accurate, patient-friendly medical ${langName}. Return ONLY the translated string without any markdown or quotation marks.\n\nText: ${trimmed}`;
      const res = await model.generateContent(prompt);
      const textOut = res.response.text().trim();
      if (textOut && textOut.length > 0) {
        phraseMemoryCache.set(cacheKey, textOut);
        return textOut;
      }
    } catch {}
  }

  // 5. Try Ollama local LLM fallback on localhost:11434
  try {
    const langName = targetLang === 'hi' ? 'Hindi' : targetLang === 'mr' ? 'Marathi' : 'Bengali';
    const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt: `Translate this medical phrase to ${langName}. Output only the translation: "${trimmed}"`,
        stream: false
      })
    });
    if (ollamaRes.ok) {
      const oJson = (await ollamaRes.json()) as any;
      const oText = oJson.response?.trim();
      if (oText && oText.length > 0 && !oText.includes('\n')) {
        phraseMemoryCache.set(cacheKey, oText);
        return oText;
      }
    }
  } catch {}

  // Fallback: return trimmed original
  return trimmed;
}

/**
 * Translates an entire canonical clinical summary content object
 */
export async function translateSummaryObject(contentObj: any, targetLang: 'hi' | 'mr' | 'bn'): Promise<any> {
  if (!contentObj) return contentObj;
  if (typeof contentObj !== 'object') {
    return await translateClinicalText(String(contentObj), targetLang);
  }

  const translated: Record<string, any> = Array.isArray(contentObj) ? [] : { ...contentObj };

  for (const [key, value] of Object.entries(contentObj)) {
    if (key === 'completeness' || key === 'icd_codes' || key === 'session_id') {
      translated[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      translated[key] = await translateClinicalText(value, targetLang);
    } else if (Array.isArray(value)) {
      translated[key] = await Promise.all(
        value.map(async (item: any) => {
          if (typeof item === 'string') {
            return await translateClinicalText(item, targetLang);
          }
          return item;
        })
      );
    } else if (typeof value === 'object' && value !== null) {
      translated[key] = await translateSummaryObject(value, targetLang);
    } else {
      translated[key] = value;
    }
  }

  return translated;
}

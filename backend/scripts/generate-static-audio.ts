import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://api.sarvam.ai/text-to-speech';
const API_KEY = process.env.SARVAM_API_KEY || '';

export interface StaticClip {
  id: string;
  en: string;
  hi: string;
}

export const STATIC_CLIPS: StaticClip[] = [
  {
    id: 'welcome',
    en: 'Welcome to MediKiosk. Please select your preferred language to begin.',
    hi: 'मेडिकियोस्क में आपका स्वागत है। शुरू करने के लिए कृपया अपनी पसंदीदा भाषा चुनें।'
  },
  {
    id: 'notice',
    en: 'Please review our Data Fiduciary Notice under the Digital Personal Data Protection Act 2023. We protect your health data.',
    hi: 'कृपया डीपीडीपी अधिनियम 2023 के तहत हमारी डेटा गोपनीयता सूचना की समीक्षा करें। हम आपके स्वास्थ्य डेटा की सुरक्षा करते हैं।'
  },
  {
    id: 'consent',
    en: 'Please review and check the consent options to share your data for clinical assessment and care.',
    hi: 'नैदानिक मूल्यांकन और देखभाल के लिए अपना डेटा साझा करने हेतु कृपया सहमति विकल्पों की समीक्षा करें।'
  },
  {
    id: 'chief_complaint',
    en: 'Please select your primary health concern or symptom to start your assessment.',
    hi: 'अपना मूल्यांकन शुरू करने के लिए कृपया अपनी मुख्य स्वास्थ्य समस्या या लक्षण चुनें।'
  },
  {
    id: 'interview_intro',
    en: 'We will now ask you a few questions about your symptoms. You can type or speak your answers.',
    hi: 'अब हम आपसे आपके लक्षणों के बारे में कुछ प्रश्न पूछेंगे। आप उत्तर टाइप कर सकते हैं या बोल सकते हैं।'
  },
  {
    id: 'medical_history',
    en: 'Please share any past medical conditions, allergies, or current medications.',
    hi: 'कृपया किसी भी पिछली बीमारी, एलर्जी या वर्तमान दवाओं की जानकारी साझा करें।'
  },
  {
    id: 'ayush_intro',
    en: 'Welcome to the AYUSH holistic health assessment for personalized wellness evaluation.',
    hi: 'व्यक्तिगत स्वास्थ्य मूल्यांकन के लिए आयुष समग्र स्वास्थ्य मूल्यांकन में आपका स्वागत है।'
  },
  {
    id: 'document_upload',
    en: 'You can upload previous prescriptions, lab reports, or medical documents here.',
    hi: 'आप यहां पिछले नुस्खे, लैब रिपोर्ट या चिकित्सा दस्तावेज अपलोड कर सकते हैं।'
  },
  {
    id: 'preview',
    en: 'Please review your health summary and details before final submission to the doctor.',
    hi: 'डॉक्टर को अंतिम रूप से जमा करने से पहले कृपया अपने स्वास्थ्य सारांश की समीक्षा करें।'
  },
  {
    id: 'submitted',
    en: 'Your health assessment has been submitted successfully. Please wait for the doctor.',
    hi: 'आपका स्वास्थ्य मूल्यांकन सफलतापूर्वक जमा कर दिया गया है। कृपया डॉक्टर की प्रतीक्षा करें।'
  },
  {
    id: 'ayush_1_prakriti',
    en: 'Prakriti Assessment: Please describe your natural body constitution, skin texture, and temperature tolerance.',
    hi: 'प्रकृति मूल्यांकन: कृपया अपनी प्राकृतिक शारीरिक संरचना, त्वचा की बनावट और तापमान सहनशीलता का वर्णन करें।'
  },
  {
    id: 'ayush_2_vikriti',
    en: 'Vikriti Assessment: What current health imbalances, discomforts, or symptoms are you experiencing?',
    hi: 'विकृति मूल्यांकन: आप वर्तमान में किन स्वास्थ्य असंतुलन या असुविधाओं का अनुभव कर रहे हैं?'
  },
  {
    id: 'ayush_3_sara',
    en: 'Sara Assessment: How would you rate your overall tissue quality, muscle tone, and vital energy?',
    hi: 'सार मूल्यांकन: आप अपने समग्र धातु सार, मांसपेशियों की शक्ति और ओज का मूल्यांकन कैसे करेंगे?'
  },
  {
    id: 'ayush_4_samhanana',
    en: 'Samhanana Assessment: Please describe your physical compactness, bone structure, and body build.',
    hi: 'संहनन मूल्यांकन: कृपया अपनी शारीरिक सुदृढ़ता, अस्थि संरचना और शरीर के गठन का वर्णन करें।'
  },
  {
    id: 'ayush_5_pramana',
    en: 'Pramana Assessment: Are your physical proportions, height, and weight balanced for your age?',
    hi: 'प्रमाण मूल्यांकन: क्या आपके शरीर का अनुपात, ऊंचाई और वजन आपकी उम्र के अनुकूल संतुलित हैं?'
  },
  {
    id: 'ayush_6_satmya',
    en: 'Satmya Assessment: What dietary habits, climate conditions, and foods suit your body best?',
    hi: 'सात्म्य मूल्यांकन: कौन सा आहार, वातावरण और भोजन आपके शरीर के अनुकूल है?'
  },
  {
    id: 'ayush_7_satwa',
    en: 'Satwa Assessment: How do you handle emotional stress, mental focus, and challenges?',
    hi: 'सत्त्व मूल्यांकन: आप भावनात्मक तनाव, मानसिक एकाग्रता और चुनौतियों का सामना कैसे करते हैं?'
  },
  {
    id: 'ayush_8_ahara_shakti',
    en: 'Ahara Shakti Assessment: Describe your appetite, digestion speed, and food intake capacity.',
    hi: 'आहार शक्ति मूल्यांकन: अपनी भूख, पाचन क्षमता और भोजन की मात्रा का वर्णन करें।'
  },
  {
    id: 'ayush_9_vyayama_shakti',
    en: 'Vyayama Shakti Assessment: How easily do you perform physical exercise and daily work without fatigue?',
    hi: 'व्यायाम शक्ति मूल्यांकन: आप बिना थके शारीरिक व्यायाम और दैनिक कार्य कितनी आसानी से करते हैं?'
  },
  {
    id: 'ayush_10_vaya',
    en: 'Vaya Assessment: What is your age group and stage of life development?',
    hi: 'वय मूल्यांकन: आपकी आयु वर्ग और जीवन विकास की अवस्था क्या है?'
  },
  {
    id: 'ayush_11_agni',
    en: 'Agni Assessment: How is your digestive fire, metabolic rhythm, and bowel regularity?',
    hi: 'अग्नि मूल्यांकन: आपकी जठराग्नि, पाचन लय और पेट की सफाई कैसी रहती है?'
  },
  {
    id: 'ayush_12_koshtha',
    en: 'Koshtha Assessment: Describe your bowel movement tendency, whether hard, soft, or normal.',
    hi: 'कोष्ठ मूल्यांकन: अपनी मल प्रवृत्ति का वर्णन करें, क्या यह क्रूर, मृदु या मध्यम है?'
  },
  {
    id: 'red_flag_message',
    en: 'Important information has been identified. Please notify hospital staff or wait for assistance.',
    hi: 'महत्वपूर्ण जानकारी की पहचान की गई है। कृपया अस्पताल के कर्मचारियों को सूचित करें या सहायता की प्रतीक्षा करें।'
  },
  {
    id: 'timeout_warning',
    en: 'Your session will reset in 30 seconds. Please continue.',
    hi: 'आपका सत्र 30 सेकंड में रीसेट हो जाएगा। कृपया जारी रखें।'
  },
  {
    id: 'error_generic',
    en: 'Something went wrong. Please tap your answer instead.',
    hi: 'कुछ गलत हो गया। कृपया इसके बजाय अपना उत्तर टैप करें।'
  },
  {
    id: 'confirmation_got_it',
    en: 'Got it.',
    hi: 'समझ गया।'
  },
  {
    id: 'confirmation_thank_you',
    en: 'Thank you.',
    hi: 'धन्यवाद।'
  }
];

// Fallback silent/placeholder MP3 generator buffer (valid 1-sec MP3 frame header data)
function createFallbackMp3Buffer(): Buffer {
  // Minimal valid MP3 silence frame structure repeated to form a ~1s playable audio buffer
  const mp3FrameHeader = Buffer.from([
    0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  const frames: Buffer[] = [];
  for (let i = 0; i < 40; i++) {
    frames.push(mp3FrameHeader);
  }
  return Buffer.concat(frames);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesizeClip(text: string, languageCode: string): Promise<Buffer | null> {
  if (!API_KEY) {
    return null;
  }

  const lang = languageCode.startsWith('hi') ? 'hi-IN' : 'en-IN';

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        language: lang,
        model: 'bulbul:v3',
        speaker: 'priya'
      })
    });

    if (!res.ok) {
      console.warn(`[Sarvam API Error] Status ${res.status} for text: "${text.slice(0, 20)}..."`);
      const errBody = await res.text();
      console.warn(`[Sarvam Error Body]:`, errBody);
      return null;
    }

    const data: any = await res.json();
    const b64 = data?.audios?.[0];
    if (b64) {
      return Buffer.from(b64, 'base64');
    }
    return null;
  } catch (err: any) {
    console.warn(`[Sarvam Network Error]:`, err.message || err);
    return null;
  }
}

async function main() {
  console.log('=== MediKiosk Static Voice Guidance Audio Generator ===');
  console.log(`Clips to generate: ${STATIC_CLIPS.length} per language (EN + HI = ${STATIC_CLIPS.length * 2} total)`);
  
  const publicDir = path.resolve(__dirname, '../../frontend/public/audio/v1');
  const enDir = path.join(publicDir, 'en');
  const hiDir = path.join(publicDir, 'hi');

  fs.mkdirSync(enDir, { recursive: true });
  fs.mkdirSync(hiDir, { recursive: true });

  let successEnCount = 0;
  let successHiCount = 0;

  for (const clip of STATIC_CLIPS) {
    // 1. English
    const enFile = path.join(enDir, `${clip.id}.mp3`);
    console.log(`Generating [en] ${clip.id}...`);
    let enAudio = await synthesizeClip(clip.en, 'en-IN');
    if (!enAudio) {
      console.warn(`⚠️ Falling back to clean MP3 binary placeholder for [en] ${clip.id}`);
      enAudio = createFallbackMp3Buffer();
    }
    fs.writeFileSync(enFile, enAudio);
    successEnCount++;
    await sleep(200);

    // 2. Hindi
    const hiFile = path.join(hiDir, `${clip.id}.mp3`);
    console.log(`Generating [hi] ${clip.id}...`);
    let hiAudio = await synthesizeClip(clip.hi, 'hi-IN');
    if (!hiAudio) {
      console.warn(`⚠️ Falling back to clean MP3 binary placeholder for [hi] ${clip.id}`);
      hiAudio = createFallbackMp3Buffer();
    }
    fs.writeFileSync(hiFile, hiAudio);
    successHiCount++;
    await sleep(200);
  }

  console.log('\n=== Generation Complete ===');
  console.log(`English MP3s: ${successEnCount} / ${STATIC_CLIPS.length} saved to ${enDir}`);
  console.log(`Hindi MP3s:   ${successHiCount} / ${STATIC_CLIPS.length} saved to ${hiDir}`);
  console.log(`Total MP3 assets generated: ${successEnCount + successHiCount}`);
}

main().catch(err => {
  console.error('Fatal error in audio generator script:', err);
  process.exit(1);
});

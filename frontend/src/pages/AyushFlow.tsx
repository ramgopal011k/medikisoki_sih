import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MandalaBackground } from '../components/MandalaBackground';
import { QuestionCard } from '../components/QuestionCard';
import { Volume2, VolumeX, Mic, Flower2 } from 'lucide-react';
import { useAsr } from '@/hooks/useAsr';
import { cleanTranscript } from '@/lib/transcriptCleaner';
import { useAudio } from '@/hooks/useAudio';
import { get, set } from 'idb-keyval';
import { API_URL } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { smartMatchOption } from '@/lib/smartVoiceMatch';
import { VoiceGuideButton } from '../components/VoiceGuideButton';

const OFFLINE_QUEUE_KEY = 'medikiosk_offline_ayush';

interface SessionState {
  id: string;
  language: string;
}
interface AyushAssessment {
  session_id: string;
  dimension: string;
  value: string;
}

type AyushStep = 'prakriti' | 'vikriti' | 'sara' | 'samhanana' | 'pramana' | 'satmya' | 'sattva' | 'ahara_shakti' | 'vyayama_shakti' | 'vaya' | 'ahara_vihara' | 'agni' | 'koshtha';

const steps: AyushStep[] = ['prakriti', 'vikriti', 'sara', 'samhanana', 'pramana', 'satmya', 'sattva', 'ahara_shakti', 'vyayama_shakti', 'vaya', 'ahara_vihara', 'agni', 'koshtha'];

const stepContent: Record<AyushStep, { en: string; hi: string; mr: string; bn: string; title: string; options: { id: string; en: string; hi: string; mr: string; bn: string }[] }> = {
  prakriti: {
    title: '1. Prakriti Pariksha (Body Constitution)',
    en: 'Which of these physical traits best describes you?',
    hi: 'इनमें से कौन सा शारीरिक गुण आपका सबसे अच्छा वर्णन करता है?',
    mr: 'यापैकी कोणते शारीरिक गुणधर्म तुमचे सर्वोत्तम वर्णन करतात?',
    bn: 'এর মধ্যে কোন শারীরিক বৈশিষ্ট্যটি আপনার সবচেয়ে ভালো বর্ণনা দেয়?',
    options: [
      { id: 'vata', en: 'Dry skin, cold intolerance, thin build', hi: 'रूखी त्वचा, ठंड बर्दाश्त न होना, पतला शरीर', mr: 'कोरडी त्वचा, थंडी सहन न होणे, सडपातळ शरीर', bn: 'শুষ্ক ত্বক, ঠান্ডা সহ্য না হওয়া, রোগা গঠন' },
      { id: 'pitta', en: 'Warm body, excessive sweating, medium build', hi: 'गर्म शरीर, अधिक पसीना आना, मध्यम शरीर', mr: 'उष्ण शरीर, जास्त घाम येणे, मध्यम बांधा', bn: 'উষ্ণ শরীর, অতিরিক্ত ঘাম, মাঝারি গঠন' },
      { id: 'kapha', en: 'Oily skin, calm nature, broad build', hi: 'तैलीय त्वचा, शांत स्वभाव, भारी शरीर', mr: 'तेलकट त्वचा, शांत स्वभाव, भरभक्कम शरीर', bn: 'তৈলাক্ত ত্বক, শান্ত স্বভাব, ভারী শরীর' },
      { id: 'dwandvaja', en: 'A mix of the above', hi: 'उपरोक्त का मिश्रण', mr: 'वरील लक्षणांचे मिश्रण', bn: 'উপরের মিশ্রণ' }
    ]
  },
  vikriti: {
    title: '2. Vikriti Pariksha (Current Dosha Imbalance)',
    en: 'What is your primary ongoing discomfort or health concern?',
    hi: 'वर्तमान में आपकी मुख्य स्वास्थ्य असुविधा क्या है?',
    mr: 'सध्या तुमचा मुख्य शारीरिक त्रास किंवा अस्वस्थता काय आहे?',
    bn: 'বর্তমানে আপনার প্রধান শারীরিক সমস্যা কি?',
    options: [
      { id: 'vata', en: 'Joint Pain & Dryness (Gas, stiffness, variable digestion)', hi: 'जोड़ों का दर्द और सूखापन (गैस, जकड़न)', mr: 'सांधेदुखी आणि कोरडेपणा (गॅस, ताठरपणा, मंद पचन)', bn: 'জয়েন্টে ব্যথা এবং শুষ্কতা (গ্যাস, শক্ত হওয়া)' },
      { id: 'pitta', en: 'Heat & Inflammation (Acidity, rashes, burning sensation)', hi: 'गर्मी और सूजन (एसिडिटी, दाने, जलन)', mr: 'उष्णता आणि जळजळ (ॲसिडिटी, पुरळ, जळजळ)', bn: 'উত্তাপ এবং প্রদাহ (অ্যাসিডিটি, ফুসকুড়ি, জ্বালাপোড়া)' },
      { id: 'kapha', en: 'Heaviness & Congestion (Lethargy, slow digestion)', hi: 'भारीपन और कफ (सुस्ती, धीमी पाचन)', mr: 'जडपणा आणि कफ (आळस, मंद पचन)', bn: 'ভারী ভাব এবং কফ (অলসতা, ধীর হজম)' },
      { id: 'tridoshic', en: 'Multiple complex symptoms', hi: 'कई जटिल लक्षण', mr: 'अनेक गुंतागुंतीची लक्षणे', bn: 'একাধিক জটিল লক্ষণ' }
    ]
  },
  sara: {
    title: '3. Sara Pariksha (Tissue Quality)',
    en: 'How is the overall quality and strength of your bodily tissues (skin, muscles, bones)?',
    hi: 'आपकी शारीरिक धातुओं (त्वचा, मांसपेशियां, हड्डियां) की गुणवत्ता कैसी है?',
    mr: 'तुमच्या शारीरिक धातूंची (त्वचा, स्नायू, हाडे) एकूण गुणवत्ता कशी आहे?',
    bn: 'আপনার শারীরিক ধাতুগুলির (ত্বক, পেশী, হাড়) সামগ্রিক গুণমান কেমন?',
    options: [
      { id: 'excellent', en: 'Pravara Sara (Clear skin, strong muscles/bones, radiant)', hi: 'प्रवर सार (साफ त्वचा, मजबूत मांसपेशियां/हड्डियां)', mr: 'प्रवर सार (तेजस्वी त्वचा, मजबूत स्नायू व हाडे)', bn: 'উত্তম সার (উজ্জ্বল ত্বক, শক্তিশালী পেশী ও হাড়)' },
      { id: 'moderate', en: 'Madhyama Sara (Average strength, occasional issues)', hi: 'मध्यम सार (सामान्य ताकत, कभी-कभी समस्याएं)', mr: 'मध्यम सार (सामान्य ताकद, अधूनमधून समस्या)', bn: 'মাঝারি সার (স্বাভাবিক শক্তি, মাঝে মাঝে সমস্যা)' },
      { id: 'weak', en: 'Avara Sara (Dry skin, weak muscles/bones, prone to injury)', hi: 'अवर सार (सूखी त्वचा, कमजोर मांसपेशियां)', mr: 'अवर सार (कोरडी त्वचा, कमकुवत स्नायू, वारंवार दुखापती)', bn: 'দুর্বল সার (শুষ্ক ত্বক, দুর্বল পেশী)' }
    ]
  },
  samhanana: {
    title: '4. Samhanana Pariksha (Physical Build & Compactness)',
    en: 'How would you describe your overall physical build and structural compactness?',
    hi: 'आप अपनी शारीरिक बनावट और सुगठन का वर्णन कैसे करेंगे?',
    mr: 'तुम्ही तुमच्या शरीराच्या सुगठित बांधणीचे वर्णन कसे कराल?',
    bn: 'আপনি আপনার শরীরের গঠনের বর্ণনা কীভাবে দেবেন?',
    options: [
      { id: 'compact', en: 'Su-samhanana (Well-built, strong, compact body)', hi: 'सु-संहनन (मजबूत, सुगठित शरीर)', mr: 'सु-संहनन (मजबूत, सुगठित व प्रमाणबद्ध शरीर)', bn: 'সু-সংহনন (মজবুত, সুগঠিত শরীর)' },
      { id: 'moderate', en: 'Madhyama Samhanana (Moderate body structure)', hi: 'मध्यम संहनन (सामान्य शारीरिक संरचना)', mr: 'मध्यम संहनन (मध्यम शारीरिक रचना)', bn: 'মাঝারি সংহনন (মাঝারি শারীরিক গঠন)' },
      { id: 'loose', en: 'Avara Samhanana (Frail, poorly proportioned build)', hi: 'अवर संहनन (कमजोर संरचना)', mr: 'अवर संहनन (कमकुवत किंवा अप्रमाणबद्ध शरीर)', bn: 'দুর্বল সংহনন (দুর্বল গঠন)' }
    ]
  },
  pramana: {
    title: '5. Pramana Pariksha (Body Proportions)',
    en: 'Are your body proportions (height, weight, limb length) balanced and normal?',
    hi: 'क्या आपके शरीर का अनुपात (ऊंचाई, वजन) संतुलित है?',
    mr: 'तुमच्या शरीराचे प्रमाण (उंची, वजन, अवयवांचे प्रमाण) संतुलित आहे का?',
    bn: 'আপনার শরীরের অনুপাত (উচ্চতা, ওজন) কি সুষম ও স্বাভাবিক?',
    options: [
      { id: 'balanced', en: 'Sama Pramana (Balanced & normal proportions)', hi: 'सम प्रमाण (संतुलित और सामान्य)', mr: 'सम प्रमाण (संतुलित आणि सामान्य प्रमाण)', bn: 'সম প্রমাণ (সুষম এবং স্বাভাবিক)' },
      { id: 'overweight', en: 'Ati Pramana (Excessive, overweight, heavily built)', hi: 'अति प्रमाण (अत्यधिक वजन, भारी)', mr: 'अति प्रमाण (जास्त वजन, लठ्ठपणा, जड शरीर)', bn: 'অতি প্রমাণ (অতিরিক্ত ওজন, ভারী)' },
      { id: 'underweight', en: 'Hina Pramana (Deficient, underweight, very thin)', hi: 'हीन प्रमाण (कम वजन, बहुत पतला)', mr: 'हीन प्रमाण (कमी वजन, खूप सडपातळ)', bn: 'হীন প্রমাণ (কম ওজন, খুব পাতলা)' }
    ]
  },
  satmya: {
    title: '6. Satmya Pariksha (Adaptability & Habituation)',
    en: 'How well do you adapt to changes in diet, weather, and surroundings?',
    hi: 'आप आहार, मौसम और परिवेश में बदलाव के प्रति कितने अनुकूल हैं?',
    mr: 'आहार, हवामान आणि वातावरणातील बदलांशी तुम्ही किती सहज जुळवून घेता?',
    bn: 'খাদ্য, আবহাওয়া এবং পরিবেশ পরিবর্তনের সাথে আপনি কতটা খাপ খাইয়ে নিতে পারেন?',
    options: [
      { id: 'excellent', en: 'Pravara Satmya (Adapt easily to all tastes and seasons)', hi: 'प्रवर सात्म्य (सभी स्वादों और मौसमों के अनुकूल)', mr: 'प्रवर सात्म्य (सर्व चवी आणि ऋतूंशी सहज जुळवून घेता येते)', bn: 'উত্তম সাৎম্য (সব স্বাদ এবং ঋতুতে সহজেই খাপ খায়)' },
      { id: 'moderate', en: 'Madhyama Satmya (Adapt to most things, some sensitivities)', hi: 'मध्यम सात्म्य (अधिकांश चीजों के अनुकूल)', mr: 'मध्यम सात्म्य (बहुतेक गोष्टी सहन होतात, काही संवेदनशीलता)', bn: 'মাঝারি সাৎম্য (বেশিরভাগ জিনিসে খাপ খায়)' },
      { id: 'poor', en: 'Avara Satmya (Very sensitive to changes in diet/weather)', hi: 'अवर सात्म्य (मौसम/आहार में बदलाव के प्रति संवेदनशील)', mr: 'अवर सात्म्य (बदलांमुळे लगेच त्रास होतो)', bn: 'দুর্বল সাৎম্য (আবহাওয়া/খাদ্য পরিবর্তনে সংবেদনশীল)' }
    ]
  },
  sattva: {
    title: '7. Sattva Pariksha (Mental Resilience & Stress Tolerance)',
    en: 'How do you cope with psychological stress, anxiety, or pain?',
    hi: 'आप मानसिक तनाव, चिंता या दर्द को कैसे सहन करते हैं (सत्व)?',
    mr: 'मानसिक तणाव, चिंता किंवा वेदना तुम्ही कशा प्रकारे सहन करता (सत्त्व)?',
    bn: 'আপনি মানসিক চাপ, উদ্বেগ বা ব্যথা কীভাবে মোকাবেলা করেন (সত্ত্ব)?',
    options: [
      { id: 'strong', en: 'Pravara Sattva (Calm, highly resilient, patient under stress)', hi: 'प्रवर सत्व (शांत, अत्यंत धैर्यवान और सहनशील)', mr: 'प्रवर सत्त्व (शांत, अत्यंत संयमी, तणावात धीर धरणारे)', bn: 'উত্তম সত্ত্ব (শান্ত, অত্যন্ত সহনশীল ও ধৈর্যশীল)' },
      { id: 'moderate', en: 'Madhyama Sattva (Moderate tolerance, manage with reassurance)', hi: 'मध्यम सत्व (सामान्य सहनशीलता)', mr: 'मध्यम सत्त्व (मध्यम सहनशीलता, समजावल्यावर शांत होणारे)', bn: 'মাঝারি সত্ত্ব (মাঝারি সহনশীলতা)' },
      { id: 'weak', en: 'Avara Sattva (Easily overwhelmed, anxious, low pain tolerance)', hi: 'अवर सत्व (जल्दी घबरा जाने वाले)', mr: 'अवर सत्त्व (लगेच घाबरणारे, जास्त चिंता, वेदना सहन न होणे)', bn: 'দুর্বল সত্ত্ব (সহজেই আতঙ্কিত, উদ্বেগপ্রবণ)' }
    ]
  },
  ahara_shakti: {
    title: '8. Ahara Shakti (Digestive Capacity & Intake)',
    en: 'How would you rate your digestive capacity and food intake ability?',
    hi: 'आप अपनी पाचन क्षमता और भोजन की मात्रा (आहार शक्ति) को कैसे आंकते हैं?',
    mr: 'तुमची पचन क्षमता आणि भूक (आहार शक्ती) कशी आहे?',
    bn: 'আপনার হজম ক্ষমতা এবং খাদ্যের পরিমাণ (আহার শক্তি) কেমন?',
    options: [
      { id: 'high', en: 'Pravara Ahara Shakti (High capacity, digest heavy meals easily)', hi: 'प्रवर आहार शक्ति (उच्च पाचन क्षमता)', mr: 'प्रवर आहार शक्ती (उत्तम पचन, जड अन्नही सहज पचते)', bn: 'উচ্চ আহার শক্তি (উচ্চ হজম ক্ষমতা, ভালো ক্ষুধা)' },
      { id: 'moderate', en: 'Madhyama Ahara Shakti (Moderate capacity, normal appetite)', hi: 'मध्यम आहार शक्ति (सामान्य क्षमता)', mr: 'मध्यम आहार शक्ती (मध्यम क्षमता, सामान्य भूक)', bn: 'মাঝারি আহার শক্তি (মাঝারি ক্ষমতা, স্বাভাবিক ক্ষুধা)' },
      { id: 'low', en: 'Avara Ahara Shakti (Low capacity, weak appetite)', hi: 'अवर आहार शक्ति (कम भूख व कमजोर पाचन)', mr: 'अवर आहार शक्ती (कमी भूक, अशक्त पचन)', bn: 'দুর্বল আহার শক্তি (কম ক্ষুধা ও দুর্বল হজম)' }
    ]
  },
  vyayama_shakti: {
    title: '9. Vyayama Shakti (Physical Capacity & Stamina)',
    en: 'What is your capacity for physical exercise and strenuous work?',
    hi: 'शारीरिक व्यायाम और कठिन परिश्रम करने की आपकी क्षमता क्या है?',
    mr: 'शारीरिक व्यायाम आणि कठीण परिश्रम करण्याची तुमची क्षमता काय आहे?',
    bn: 'শারীরিক ব্যায়াম এবং কঠোর পরিশ্রম করার ক্ষমতা কেমন?',
    options: [
      { id: 'high', en: 'Pravara Vyayama Shakti (High stamina, perform heavy work without tiring)', hi: 'प्रवर व्यायाम शक्ति (उच्च स्टेमिना)', mr: 'प्रवर व्यायाम शक्ती (उत्कृष्ट स्टॅमिना, न थकता काम करणे)', bn: 'উচ্চ ব্যায়াম শক্তি (উচ্চ স্ট্যামিনা)' },
      { id: 'moderate', en: 'Madhyama Vyayama Shakti (Moderate stamina, average capacity)', hi: 'मध्यम व्यायाम शक्ति (सामान्य स्टेमिना)', mr: 'मध्यम व्यायाम शक्ती (मध्यम स्टॅमिना, सामान्य क्षमता)', bn: 'মাঝারি ব্যায়াম শক্তি (মাঝারি স্ট্যামিনা)' },
      { id: 'low', en: 'Avara Vyayama Shakti (Low stamina, exhausted quickly)', hi: 'अवर व्यायाम शक्ति (जल्दी थक जाना)', mr: 'अवर व्यायाम शक्ती (कमी स्टॅमिना, लवकर थकवा येणे)', bn: 'দুর্বল ব্যায়াম শক্তি (দ্রুত ক্লান্ত হয়ে পড়া)' }
    ]
  },
  vaya: {
    title: '10. Vaya Pariksha (Age & Stage of Life)',
    en: 'How do you relate to your current stage of life and aging?',
    hi: 'आप अपने जीवन के वर्तमान चरण और उम्र बढ़ने की प्रक्रिया को कैसे देखते हैं?',
    mr: 'तुम्ही तुमच्या आयुष्यातील सध्याच्या टप्प्याकडे कसे पाहता?',
    bn: 'আপনি জীবনের বর্তমান পর্যায়কে কীভাবে দেখেন?',
    options: [
      { id: 'youth', en: 'Bala / Yuva Vaya (Youth/Growing Phase, active growth)', hi: 'बाल्य/युवावस्था (उच्च ऊर्जा)', mr: 'बाल्य / युवा वय (तारुण्य, वाढीचा टप्पा, उच्च ऊर्जा)', bn: 'তারুণ্য / যৌবন (উচ্চ শক্তি)' },
      { id: 'middle', en: 'Madhyama Vaya (Middle Age, maintenance phase)', hi: 'मध्यम आयु (स्थिर ऊर्जा)', mr: 'मध्यम वय (प्रौढावस्था, स्थिर टप्पा)', bn: 'মধ্য বয়স (স্থিতিশীল শক্তি)' },
      { id: 'old', en: 'Vriddha Vaya (Old Age, tissue wear & tear phase)', hi: 'वृद्धावस्था (घटती ऊर्जा)', mr: 'वृद्ध वय (वृद्धावस्था, घटती ऊर्जा)', bn: 'বার্ধক্য (হ্রাসপ্রাপ্ত শক্তি)' }
    ]
  },
  ahara_vihara: {
    title: 'Supplementary 1. Ahara-Vihara (Diet & Lifestyle Routine)',
    en: 'How would you describe your daily diet and lifestyle habits?',
    hi: 'आपका दैनिक आहार और दिनचर्या (आहार-विहार) कैसी है?',
    mr: 'तुमचा रोजचा आहार आणि जीवनशैली (आहार-विहार) कशी आहे?',
    bn: 'আপনার দৈনন্দিন খাদ্য ও জীবনযাত্রার রুটিন কেমন?',
    options: [
      { id: 'regular', en: 'Sattvic & Regular (Fresh meals, active routine)', hi: 'नियमित व सात्विक (समय पर भोजन, सक्रिय दिनचर्या)', mr: 'नियमित व सात्विक (ताजे जेवण, वेळेवर झोप, सक्रिय दिनचर्या)', bn: 'নিয়মিত ও সাত্ত্বিক (সময়মতো তাজা খাবার, সক্রিয় রুটিন)' },
      { id: 'irregular', en: 'Irregular (Untimely meals, sedentary, late nights)', hi: 'अनियमित (बेवक्त खाना, देर रात जागना)', mr: 'अनियमित (अवेळी जेवण, उशिरा झोपणे, बैठी जीवनशैली)', bn: 'অনিয়মিত (অনিয়মিত খাবার, দেরিতে ঘুমানো)' },
      { id: 'spicy_processed', en: 'Spicy / Processed (Heavy, fried, oily foods)', hi: 'तीखा / तला-भुना आहार', mr: 'तिखट / तेलकट / जंक फूड (तळलेले व जड अन्न)', bn: 'ঝাল / ভাজাভুজি / প্রক্রিয়াজাত খাবার' }
    ]
  },
  agni: {
    title: 'Supplementary 2. Agni Pariksha (Digestive Fire & Metabolism)',
    en: 'How is your digestion and appetite pattern (Agni)?',
    hi: 'आपकी पाचन शक्ति और भूख (अग्नि) कैसी है?',
    mr: 'तुमची पचनशक्ती आणि पोटातील अग्नी (भूक) कशी आहे?',
    bn: 'আপনার হজম ক্ষমতা এবং ক্ষুধার ধরন (অগ্নি) কেমন?',
    options: [
      { id: 'regular', en: 'Sama Agni (Balanced, consistent hunger, smooth digestion)', hi: 'सम अग्नि (संतुलित भूख और सुचारू पाचन)', mr: 'सम अग्नी (संतुलित भूक, सुलभ आणि नियमित पचन)', bn: 'সম অগ্নি (সুষম ক্ষুধা ও সহজ হজম)' },
      { id: 'intense', en: 'Tikshna Agni (Intense hunger, burning sensation, acidity)', hi: 'तीक्ष्ण अग्नि (अत्यधिक भूख, जलन, एसिडिटी)', mr: 'तीक्ष्ण अग्नी (जास्त भूक, छातीत जळजळ, ॲसिडिटी)', bn: 'তীক্ষ্ণ অগ্নি (তীব্র ক্ষুধা, বুকজ্বালা, অম্লতা)' },
      { id: 'sluggish', en: 'Manda Agni (Slow digestion, heaviness after small meals)', hi: 'मंद अग्नि (धीमी पाचन, भारीपन)', mr: 'मंद अग्नी (मंद पचन, थोडे खाल्ल्यावरही पोट जड होणे)', bn: 'মন্দ অগ্নি (ধীর হজম, ভারী ভাব)' },
      { id: 'irregular', en: 'Visham Agni (Unpredictable, variable appetite)', hi: 'विषम अग्नि (अनियमित भूख)', mr: 'विषम अग्नी (अनपेक्षित भूक, कधी जास्त कधी कमी)', bn: 'বিষম অগ্নি (অনিয়মিত ক্ষুধা)' }
    ]
  },
  koshtha: {
    title: 'Supplementary 3. Koshtha Pariksha (Bowel Nature & Elimination)',
    en: 'How are your regular bowel movements and elimination (Koshtha)?',
    hi: 'आपकी आंतों की गति और पेट साफ होने की स्थिति (कोष्ठ) कैसी है?',
    mr: 'तुमचे पोट साफ होण्याची सवय (कोष्ठ) कशी आहे?',
    bn: 'আপনার মলত্যাগের স্বভাব এবং নিয়মিততা (কোষ্ঠ) কেমন?',
    options: [
      { id: 'regular', en: 'Madhyama Koshtha (Regular, comfortable, 1-2 times daily)', hi: 'मध्यम कोष्ठ (नियमित, सहज)', mr: 'मध्यम कोष्ठ (नियमित, सहज आणि दिवसातून १-२ वेळा)', bn: 'মাঝারি কোষ্ঠ (নিয়মিত, স্বাভাবিক, দিনে ১-২ বার)' },
      { id: 'hard', en: 'Krura Koshtha (Hard, dry stools, constipation tendency)', hi: 'क्रूर कोष्ठ (कब्ज, सूखा मल)', mr: 'क्रूर कोष्ठ (कठीण शौच, बद्धकोष्ठता, कष्टाने पोट साफ होणे)', bn: 'কঠিন কোষ্ঠ (কোষ্ঠকাঠিন্য, শক্ত মল)' },
      { id: 'soft', en: 'Mridu Koshtha (Loose, frequent, sensitive bowel)', hi: 'मृदु कोष्ठ (नरम/ढीला मल)', mr: 'मृदू कोष्ठ (पातळ संडास, वारंवार पोट साफ होणे, संवेदनशील)', bn: 'মৃদু কোষ্ঠ (নরম মল, সংবেদনশীল পেট)' }
    ]
  }
};

const ayushClipMap: Record<AyushStep, string> = {
  prakriti: 'ayush_1_prakriti',
  vikriti: 'ayush_2_vikriti',
  sara: 'ayush_3_sara',
  samhanana: 'ayush_4_samhanana',
  pramana: 'ayush_5_pramana',
  satmya: 'ayush_6_satmya',
  sattva: 'ayush_7_satwa',
  ahara_shakti: 'ayush_8_ahara_shakti',
  vyayama_shakti: 'ayush_9_vyayama_shakti',
  vaya: 'ayush_10_vaya',
  ahara_vihara: 'ayush_supp_ahara_vihara',
  agni: 'ayush_supp_agni',
  koshtha: 'ayush_supp_koshtha'
};

export default function AyushFlow() {
  const navigate = useNavigate();
  const [session] = useState<SessionState | null>(() => {
    const sessionId = sessionStorage.getItem('patient_session') || sessionStorage.getItem('session_id');
    const lang = localStorage.getItem('patient_language') || 'en';
    if (!sessionId) return null;
    return { id: sessionId, language: lang };
  });

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { speak, isPlaying } = useAudio();
  const { isListening, transcript, startListening, stopListening } = useAsr();
  const { t } = useTranslation();

  const flushOfflineQueue = useCallback(async () => {
    const queue: AyushAssessment[] | undefined = await get(OFFLINE_QUEUE_KEY);
    if (!queue || queue.length === 0) return;

    setIsSyncing(true);
    const remainingQueue: AyushAssessment[] = [];

    for (const assessment of queue) {
      try {
        const res = await fetch(`${API_URL}/ayush-assessment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assessment)
        });
        if (!res.ok) throw new Error('Sync failed');
      } catch {
        remainingQueue.push(assessment);
      }
    }

    await set(OFFLINE_QUEUE_KEY, remainingQueue);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    if (!session) {
      navigate('/consent');
      return;
    }

    const init = async () => {
      await flushOfflineQueue();
    };
    init();

    const handleOnline = () => { flushOfflineQueue(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session, navigate, flushOfflineQueue]);

  const currentStepId = steps[currentStepIndex];
  const content = stepContent[currentStepId];

  const lang = session?.language || localStorage.getItem('patient_language') || 'en';
  const isHi = lang === 'hi';
  const isMr = lang === 'mr';
  const isBn = lang === 'bn';
  const isHindi = isHi;
  const ttsLang = isMr ? 'mr-IN' : isBn ? 'bn-IN' : isHi ? 'hi-IN' : 'en-IN';

  // ASR Voice recognition matching
  useEffect(() => {
    if (!transcript || !content) return;
    
    const matchTranscript = async () => {
      const activeLang = (isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en') as any;
      const cleaned = cleanTranscript(transcript, { language: activeLang });
      const targetText = cleaned || transcript;

      const optionsToMatch = content.options.map(opt => ({
        value: opt.id,
        label: opt.en,
        label_hi: opt.hi,
        label_mr: opt.mr,
        label_bn: opt.bn
      }));

      const result = await smartMatchOption(targetText, optionsToMatch);
      if (result.matched) {
        stopListening();
        handleAnswer(result.value);
      }
    };
    
    matchTranscript();
    // eslint-disable-next-line
  }, [transcript, content]);

  const handleAnswer = async (value: string) => {
    if (!session) return;
    const dimension = steps[currentStepIndex];

    const payload: AyushAssessment = {
      session_id: session.id,
      dimension,
      value
    };

    try {
      if (!navigator.onLine) throw new Error('Offline');
      const res = await fetch(`${API_URL}/ayush-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Server error');
    } catch {
      const queue: AyushAssessment[] = (await get(OFFLINE_QUEUE_KEY)) || [];
      queue.push(payload);
      await set(OFFLINE_QUEUE_KEY, queue);
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleSkip = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleSkipAll = () => {
    setIsFinished(true);
  };

  if (!session) return null;

  if (isFinished) {
    const continueBtnText = isMr
      ? 'कागदपत्र अपलोड सुरू ठेवा'
      : isBn
      ? 'নথি আপলোডে এগিয়ে যান'
      : isHi
      ? 'दस्तावेज़ अपलोड पर जारी रखें'
      : 'Continue to Document Upload';

    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative overflow-hidden font-body text-charcoal">
        <MandalaBackground />
        <QuestionCard className="w-full max-w-2xl text-center z-10 p-12 border-terracotta/30">
          <div className="w-16 h-16 bg-terracotta/10 text-terracotta rounded-full flex items-center justify-center mx-auto mb-6">
            <Flower2 className="w-8 h-8" />
          </div>
          <h1 className="font-display text-4xl text-terracotta mb-3">
            {t('ayush.title')}
          </h1>
          <p className="font-body text-lg text-muted mb-8">
            {t('ayush.sub')}
          </p>
          <button
            onClick={() => navigate('/records-upload')}
            className="w-full min-h-[58px] text-lg rounded-[12px] bg-terracotta text-white font-body focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 hover:bg-terracotta/90 transition-colors shadow-sm"
          >
            {continueBtnText}
          </button>
          {isSyncing && (
            <p className="text-terracotta text-sm font-body animate-pulse mt-4">Syncing offline data...</p>
          )}
        </QuestionCard>
      </div>
    );
  }

  const questionText = isMr ? content.mr : isBn ? content.bn : isHi ? content.hi : content.en;

  return (
    <div className="min-h-screen bg-sand flex flex-col pt-10 p-6 relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      <div className="z-10 w-full flex flex-col items-center max-w-3xl mx-auto">
        
        {/* Step Indicator */}
        <div className="w-full flex flex-col gap-1.5 mb-4 px-2">
          <div className="text-xs font-bold uppercase tracking-wider text-terracotta">
            {isMr
              ? (currentStepIndex < 10 ? "दशविध परीक्षा — १० शास्त्रीय निकष" : "पूरक मूल्यमापन")
              : isBn
              ? (currentStepIndex < 10 ? "দশবিধ পরীক্ষা — ১০টি শাস্ত্রীয় মানদণ্ড" : "সম্পূরক মূল্যায়ন")
              : isHi
              ? (currentStepIndex < 10 ? "दशविध परीक्षा — 10 शास्त्रीय पैरामीटर" : "पूरक मूल्यांकन")
              : (currentStepIndex < 10 ? "Dashavidha Pariksha — 10 classical parameters" : "Supplementary assessments")}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-terracotta bg-terracotta/10 px-3 py-1 rounded-full">
              {currentStepIndex < 10 
                ? (isMr ? `शास्त्रीय निकष ${currentStepIndex + 1} / १०` : isBn ? `শাস্ত্রীয় মানদণ্ড ${currentStepIndex + 1} / ১০` : isHi ? `शास्त्रीय पैरामीटर ${currentStepIndex + 1} / 10` : `Classical Parameter ${currentStepIndex + 1} of 10`)
                : (isMr ? `पूरक ${currentStepIndex - 9} / ३` : isBn ? `সম্পূরক ${currentStepIndex - 9} / ৩` : isHi ? `पूरक ${currentStepIndex - 9} / 3` : `Supplementary ${currentStepIndex - 9} of 3`)}
            </span>
            <span className="text-xs font-medium text-muted">
              {content.title}
            </span>
          </div>
        </div>

        {/* Question Card */}
        <div className="w-full bg-[#f7f4ed] rounded-[28px] border border-terracotta/30 shadow-xs p-6 sm:p-10 flex flex-col">
          
          {/* Header with Title and Speaker */}
          <div className="flex justify-between items-start mb-6 gap-4">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal leading-tight">
              {questionText}
            </h2>
            <button
              onClick={() => speak(questionText, ttsLang, ayushClipMap[currentStepId])}
              className="w-11 h-11 rounded-full bg-terracotta/10 hover:bg-terracotta/20 text-terracotta flex items-center justify-center transition-colors shrink-0"
              title="Listen to question"
              aria-label={isPlaying ? 'Stop audio' : 'Listen to question'}
            >
              {isPlaying ? <VolumeX className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full mb-6">
            {content.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                className="w-full p-4 sm:p-5 text-left rounded-[16px] border-2 border-warmgray bg-white hover:border-terracotta hover:bg-terracotta/5 focus:outline-none focus:ring-2 focus:ring-terracotta transition-all shadow-xs"
              >
                <div className="font-body text-base sm:text-lg font-semibold text-charcoal">
                  {isMr ? opt.mr : isBn ? opt.bn : isHi ? opt.hi : opt.en}
                </div>
              </button>
            ))}
          </div>

          {/* Voice ASR Input Bar */}
          <div className="flex flex-col items-center pt-4 border-t border-warmgray/60 w-full">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startListening({ lang: ttsLang }))}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                  isListening 
                    ? 'bg-terracotta text-white scale-105 ring-2 ring-terracotta/40' 
                    : 'bg-terracotta text-white hover:bg-terracotta/90'
                }`}
                title="Speak your answer"
                aria-label={isListening ? 'Stop listening' : 'Speak your answer'}
              >
                <Mic className="w-5 h-5" />
              </button>
              <div className="text-left">
                <p className="text-xs font-semibold text-charcoal">
                  {isListening 
                    ? (isMr ? 'ऐकत आहोत...' : isBn ? 'শুনছি...' : isHi ? 'सुन रहे हैं...' : 'Listening...') 
                    : (isMr ? 'आवाज इनपुट (ASR)' : isBn ? 'ভয়েস ইনপুট (ASR)' : isHi ? 'वॉयस इनपुट (ASR)' : 'Voice Input (ASR)')}
                </p>
                <p className="text-xs text-muted">
                  {isMr 
                    ? 'निवडण्यासाठी आपले उत्तर बोला' 
                    : isBn 
                    ? 'নির্বাচন করতে আপনার উত্তর বলুন' 
                    : isHi 
                    ? 'चुनने के लिए अपना उत्तर बोलें' 
                    : 'Speak your answer to select'}
                </p>
              </div>
            </div>
            {transcript && (
              <div className="flex flex-col items-center mt-2">
                <p className="text-xs font-medium text-terracotta bg-terracotta/10 px-3 py-1 rounded-full">
                  "{transcript}"
                </p>
                {(() => {
                  const activeLang = (isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en') as any;
                  const cleaned = cleanTranscript(transcript, { language: activeLang });
                  if (cleaned && cleaned !== transcript) {
                    return (
                      <p className="text-[10px] text-muted font-medium italic mt-0.5">
                        {isMr ? `सुधारित: "${cleaned}"` : isBn ? `সংশোধিত: "${cleaned}"` : isHi ? `संशोधित: "${cleaned}"` : `Cleaned: "${cleaned}"`}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>

          {/* Skip Controls */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-warmgray/60 w-full">
            <button
              type="button"
              onClick={handleSkipAll}
              className="text-xs font-semibold text-muted hover:text-terracotta underline transition-colors focus:outline-none"
            >
              {isMr 
                ? 'आयुष मूल्यमापन वगळा (Skip AYUSH)' 
                : isBn 
                ? 'সম্পূর্ণ আয়ুষ মূল্যায়ন এড়িয়ে যান' 
                : isHi 
                ? 'आयुष मूल्यांकन छोड़ें (Skip AYUSH)' 
                : 'Skip Entire AYUSH Assessment'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 rounded-xl bg-warmgray/50 hover:bg-warmgray/80 text-charcoal text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            >
              {isMr 
                ? 'हा प्रश्न वगळा ➔' 
                : isBn 
                ? 'এই প্রশ্নটি এড়িয়ে যান ➔' 
                : isHi 
                ? 'यह प्रश्न छोड़ें ➔' 
                : 'Skip Question ➔'}
            </button>
          </div>

        </div>
      </div>

      {isSyncing && (
        <div className="fixed bottom-4 right-4 bg-terracotta text-white px-4 py-2 rounded-full shadow-lg font-body text-sm animate-pulse z-50">
          Syncing offline data...
        </div>
      )}
      <VoiceGuideButton
        clipId={ayushClipMap[currentStepId]}
        text={questionText}
        language={ttsLang}
      />
    </div>
  );
}

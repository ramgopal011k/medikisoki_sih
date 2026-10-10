import type { InterviewTree } from "@/types/interview-tree";

export const otherTree: InterviewTree = {
  complaint: 'Other',
  start_question_id: 'q1_description',
  questions: {
    q1_description: {
      id: 'q1_description',
      text: 'Please describe your main health concern or symptoms',
      text_hi: 'कृपया अपनी मुख्य स्वास्थ्य समस्या या लक्षणों का वर्णन करें',
      text_mr: 'कृपया तुमच्या मुख्य आरोग्याच्या समस्येचे किंवा लक्षणांचे वर्णन करा',
      text_bn: 'অনুগ্রহ করে আপনার প্রধান স্বাস্থ্য সমস্যা বা উপসর্গগুলো বর্ণনা করুন',
      type: 'text',
      next: () => 'q2_duration'
    },
    q2_duration: {
      id: 'q2_duration',
      text: 'How long has this issue been going on?',
      text_hi: 'यह समस्या कब से हो रही है?',
      text_mr: 'ही समस्या कधीपासून होत आहे?',
      text_bn: 'এই সমস্যা কত দিন ধরে চলছে?',
      type: 'single_choice',
      options: [
        { value: 'today', label: 'Started today (Acute)', label_hi: 'आज ही शुरू हुआ', label_mr: 'आजच सुरू झाले (तीव्र)', label_bn: 'আজই শুরু হয়েছে (হঠাৎ)' },
        { value: 'this_week', label: 'In the last few days / this week', label_hi: 'पिछले कुछ दिनों / इस सप्ताह से', label_mr: 'गेल्या काही दिवसांत / या आठवड्यात', label_bn: 'গত কয়েক দিনে / এই সপ্তাহে' },
        { value: 'this_month', label: 'A few weeks / this month', label_hi: 'कुछ हफ्तों या इस महीने से', label_mr: 'काही आठवडे / या महिन्यात', label_bn: 'কয়েক সপ্তাহ / এই মাসে' },
        { value: 'longer', label: 'Longer than a month (Chronic condition)', label_hi: 'एक महीने से अधिक समय से', label_mr: 'एका महिन्यापेक्षा जास्त काळ (दीर्घकालीन)', label_bn: 'এক মাসের বেশি সময় ধরে (দীর্ঘস্থায়ী)' }
      ],
      next: () => 'q3_severity'
    },
    q3_severity: {
      id: 'q3_severity',
      text: 'How severe is your discomfort?',
      text_hi: 'आपकी तकलीफ कितनी तेज है?',
      text_mr: 'तुमचा त्रास किती तीव्र आहे?',
      text_bn: 'আপনার অস্বস্তি কতটা মারাত্মক?',
      type: 'single_choice',
      options: [
        { value: 'mild', label: 'Mild (Noticeable but manageable)', label_hi: 'हल्का (महसूस होता है पर काम कर सकते हैं)', label_mr: 'सौम्य (जाणवतो पण काम करता येते)', label_bn: 'মৃদু (বোঝা যায় তবে কাজ করা যায়)' },
        { value: 'moderate', label: 'Moderate (Affects daily activities)', label_hi: 'मध्यम (रोजमर्रा के कामों में दिक्कत)', label_mr: 'मध्यम (दैनंदिन कामात अडचण)', label_bn: 'মাঝারি (দৈনন্দিন কাজে ব্যাঘাত ঘটে)' },
        { value: 'severe', label: 'Severe (Unbearable)', label_hi: 'गंभीर (असहनीय)', label_mr: 'तीव्र (असह्य)', label_bn: 'তীব্র (অসহ্য)' }
      ],
      next: () => 'q4_systemic'
    },
    q4_systemic: {
      id: 'q4_systemic',
      text: 'Are you experiencing any generalized or systemic symptoms?',
      text_hi: 'क्या आपको पूरे शरीर में इनमें से कोई अन्य लक्षण महसूस हो रहे हैं?',
      text_mr: 'तुम्हाला संपूर्ण शरीरात यापैकी इतर कोणती लक्षणे जाणवत आहेत का?',
      text_bn: 'আপনি কি পুরো শরীরে এই লক্ষণগুলোর কোনটি অনুভব করছেন?',
      type: 'multi_choice',
      options: [
        { value: 'fever_chills', label: 'Fever or chills', label_hi: 'बुखार या ठंड लगना', label_mr: 'ताप किंवा थंडी वाजणे', label_bn: 'জ্বর বা ঠান্ডা লাগা' },
        { value: 'dizziness', label: 'Dizziness, lightheadedness, or feeling faint', label_hi: 'चक्कर आना या बेहोशी जैसा लगना', label_mr: 'चक्कर येणे, डोके हलके वाटणे किंवा भोवळ येणे', label_bn: 'মাথা ঘোরা বা অজ্ঞান হওয়ার অনুভূতি' },
        { value: 'weight_loss', label: 'Unexplained significant weight loss', label_hi: 'अचानक वजन कम होना', label_mr: 'विनाकारण वजन लक्षणीयरीत्या कमी होणे', label_bn: 'অকারণে উল্লেখযোগ্য ওজন হ্রাস' },
        { value: 'fatigue', label: 'Extreme weakness or exhaustion', label_hi: 'अत्यधिक कमजोरी या थकान', label_mr: 'अतिशय अशक्तपणा किंवा थकवा', label_bn: 'চরম দুর্বলতা বা ক্লান্তি' },
        { value: 'none', label: 'None of these', label_hi: 'इनमें से कोई नहीं', label_mr: 'यापैकी काहीही नाही', label_bn: 'এগুলোর কোনটিই নয়' }
      ],
      next: (answer) => {
        if (Array.isArray(answer) && answer.includes('dizziness')) return { type: 'red_flag', flag_id: 'general_severe_dizziness' };
        return 'q5_daily_impact';
      }
    },
    q5_daily_impact: {
      id: 'q5_daily_impact',
      text: 'How much does this condition affect your normal daily activities or work?',
      text_hi: 'यह समस्या आपके दैनिक कामकाज को कितना प्रभावित कर रही है?',
      text_mr: 'या समस्येचा तुमच्या दैनंदिन कामावर किंवा दिनचर्येवर किती परिणाम होत आहे?',
      text_bn: 'এই সমস্যা আপনার স্বাভাবিক দৈনন্দিন কাজকর্মকে কতটা প্রভাবিত করছে?',
      type: 'single_choice',
      options: [
        { value: 'severe_bedridden', label: 'Unable to perform basic tasks (Bedridden / Severe restriction)', label_hi: 'दैनिक काम करने में असमर्थ / बिस्तर पर आराम', label_mr: 'मूलभूत कामे करण्यास असमर्थ (अंथरूणावर खिळलेले / तीव्र मर्यादा)', label_bn: 'সাধারণ কাজ করতে অক্ষম (বিছানায় পড়ে থাকা / তীব্র সীমাবদ্ধতা)' },
        { value: 'moderate', label: 'Moderate limitation (Able to do light work only)', label_hi: 'मध्यम प्रभाव (केवल हल्का काम कर पा रहे हैं)', label_mr: 'मध्यम मर्यादा (फक्त हलके काम करू शकता)', label_bn: 'মাঝারি সীমাবদ্ধতা (শুধু হালকা কাজ করা সম্ভব)' },
        { value: 'mild', label: 'Mild (Able to manage routine normally)', label_hi: 'हल्का प्रभाव (सामान्य दिनचर्या जारी है)', label_mr: 'सौम्य (नेहमीची दिनचर्या सांभाळता येते)', label_bn: 'সামান্য (স্বাভাবিক কাজকর্ম চালানো যায়)' }
      ],
      next: () => 'q6_additional'
    },
    q6_additional: {
      id: 'q6_additional',
      text: 'Is there any specific detail or allergy you would like the doctor to know?',
      text_hi: 'क्या आप डॉक्टर को कोई विशेष बात या दवा से एलर्जी बताना चाहते हैं?',
      text_mr: 'तुम्हाला डॉक्टरांना सांगायची असलेली कोणतीही विशेष बाब किंवा औषधाची अ‍ॅलर्जी आहे का?',
      text_bn: 'ডাক্তারকে জানাতে চান এমন কোনো বিশেষ তথ্য বা অ্যালার্জি আছে কি?',
      type: 'text',
      next: () => null // end interview
    }
  }
};

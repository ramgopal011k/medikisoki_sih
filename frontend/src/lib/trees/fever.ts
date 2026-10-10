import type { InterviewTree } from "@/types/interview-tree";

export const feverTree: InterviewTree = {
  complaint: 'Fever',
  start_question_id: 'fever_duration',
  questions: {
    fever_duration: {
      id: 'fever_duration',
      text: 'How long have you had the fever?',
      text_hi: 'आपको बुखार कब से है?',
      text_mr: 'तुम्हाला ताप कधीपासून आहे?',
      text_bn: 'আপনার জ্বর কত দিন ধরে?',
      type: 'single_choice',
      options: [
        { value: 'less_3_days', label: 'Less than 3 days', label_hi: '3 दिन से कम', label_mr: '३ दिवसांपेक्षा कमी', label_bn: '৩ দিনের কম' },
        { value: '3_to_7_days', label: '3 to 7 days', label_hi: '3 से 7 दिन', label_mr: '३ ते ७ दिवस', label_bn: '৩ থেকে ৭ দিন' },
        { value: 'more_than_week', label: 'More than a week', label_hi: 'एक सप्ताह से अधिक', label_mr: 'एका आठवड्यापेक्षा जास्त', label_bn: 'এক সপ্তাহের বেশি' }
      ],
      next: (answer) => {
        if (answer === 'more_than_week') return 'fever_travel';
        return 'fever_temp';
      }
    },
    fever_temp: {
      id: 'fever_temp',
      text: 'How high is your body temperature?',
      text_hi: 'आपका तापमान कितना तेज है?',
      text_mr: 'तुमचा ताप किती भरला आहे?',
      text_bn: 'আপনার জ্বর কতটা বেশি?',
      type: 'single_choice',
      options: [
        { value: 'mild', label: 'Mild (Below 100°F / 37.8°C)', label_hi: 'हल्का (100°F से कम)', label_mr: 'सौम्य (१००°F पेक्षा कमी)', label_bn: 'মৃদু (১০০°F এর নিচে)' },
        { value: 'moderate', label: 'Moderate (100°F - 102°F)', label_hi: 'मध्यम (100°F - 102°F)', label_mr: 'मध्यम (१००°F - १०२°F)', label_bn: 'মাঝারি (১০০°F - ১০২°F)' },
        { value: 'high', label: 'High (Above 102°F / 38.9°C)', label_hi: 'तेज (102°F से अधिक)', label_mr: 'जास्त ताप (१०२°F पेक्षा जास्त)', label_bn: 'তীব্র (১০২°F এর বেশি)' },
        { value: 'unknown', label: 'I haven\'t measured it', label_hi: 'नापा नहीं है', label_mr: 'मोजला नाही', label_bn: 'মেপে দেখা হয়নি' }
      ],
      next: (answer) => {
        if (answer === 'high') return { type: 'red_flag', flag_id: 'fever_high_temp' };
        return 'fever_pattern';
      }
    },
    fever_pattern: {
      id: 'fever_pattern',
      text: 'What pattern does your fever follow throughout the day?',
      text_hi: 'दिन भर में आपका बुखार किस तरह रहता है?',
      text_mr: 'दिवसभरात तुमचा ताप कसा राहतो?',
      text_bn: 'সারাদিনে আপনার জ্বর কেমন থাকে?',
      type: 'single_choice',
      options: [
        { value: 'continuous', label: 'Continuous (Stay elevated all day)', label_hi: 'लगातार बना रहता है', label_mr: 'दिवसभर सतत ताप राहतो', label_bn: 'সারাদিন একটানা জ্বর থাকে' },
        { value: 'intermittent', label: 'Comes and goes in spikes with chills', label_hi: 'कंपकंपी के साथ चढ़ता-उतरता है', label_mr: 'थंडी वाजून ताप चढतो आणि उतरतो', label_bn: 'কাঁপুনি দিয়ে জ্বর বাড়ে এবং কমে' },
        { value: 'evening_rise', label: 'Rises mainly in the evening or night', label_hi: 'शाम या रात में बढ़ जाता है', label_mr: 'मुख्यतः संध्याकाळी किंवा रात्री वाढतो', label_bn: 'মূলত সন্ধ্যা বা রাতে বাড়ে' },
        { value: 'irregular', label: 'Irregular / Unpredictable', label_hi: 'अनियमित', label_mr: 'अनियमित / सांगता येत नाही', label_bn: 'অনিয়মিত' }
      ],
      next: (answer) => {
        if (answer === 'intermittent') return 'fever_rigors';
        return 'fever_med_response';
      }
    },
    fever_rigors: {
      id: 'fever_rigors',
      text: 'Do you experience severe shaking chills followed by heavy sweating?',
      text_hi: 'क्या आपको तेज कंपकंपी के बाद बहुत पसीना आता है?',
      text_mr: 'तुम्हाला तीव्र थंडी वाजून नंतर खूप घाम येतो का?',
      text_bn: 'আপনার কি তীব্র কাঁপুনি দিয়ে জ্বর এসে পরে খুব ঘাম হয়?',
      type: 'single_choice',
      options: [
        { value: 'yes_shivering', label: 'Yes, severe shivering and sweats', label_hi: 'हाँ, तेज कंपकंपी और पसीना', label_mr: 'होय, तीव्र थंडी आणि घाम', label_bn: 'হ্যাঁ, তীব্র কাঁপুনি এবং ঘাম' },
        { value: 'no', label: 'No, just normal fever', label_hi: 'नहीं, सामान्य बुखार', label_mr: 'नाही, फक्त सामान्य ताप', label_bn: 'না, সাধারণ জ্বর' }
      ],
      next: (_answer) => {
        return 'fever_med_response';
      }
    },
    fever_med_response: {
      id: 'fever_med_response',
      text: 'Does fever medicine (like Paracetamol) bring your temperature down?',
      text_hi: 'क्या बुखार की दवा (जैसे पैरासिटामोल) लेने पर बुखार कम होता है?',
      text_mr: 'तापाचे औषध (उदा. पॅरासिटामॉल) घेतल्यावर ताप उतरतो का?',
      text_bn: 'জ্বরের ওষুধ (যেমন প্যারাসিটামল) খেলে কি জ্বর কমে?',
      type: 'single_choice',
      options: [
        { value: 'yes_temporary', label: 'Yes, but it returns after a few hours', label_hi: 'हाँ, पर कुछ घंटों बाद फिर आ जाता है', label_mr: 'होय, पण काही तासांनंतर पुन्हा येतो', label_bn: 'হ্যাঁ, তবে কয়েক ঘণ্টা পর আবার আসে' },
        { value: 'no_response', label: 'No, fever remains high despite medicine', label_hi: 'नहीं, दवा से भी बुखार नहीं उतरता', label_mr: 'नाही, औषध घेऊनही ताप उतरत नाही', label_bn: 'না, ওষুধেও জ্বর কমে না' },
        { value: 'not_taken', label: 'I haven\'t taken any medicine yet', label_hi: 'अभी तक कोई दवा नहीं ली है', label_mr: 'अद्याप कोणतेही औषध घेतलेले नाही', label_bn: 'এখনও কোনো ওষুধ খাইনি' }
      ],
      next: (_answer) => {
        return 'fever_associated';
      }
    },
    fever_travel: {
      id: 'fever_travel',
      text: 'Have you traveled outside your local area or visited forested/waterlogged areas recently?',
      text_hi: 'क्या आपने हाल ही में किसी अन्य क्षेत्र या जलभराव वाले स्थान की यात्रा की है?',
      text_mr: 'तुम्ही अलीकडे बाहेरगावी प्रवास केला आहे किंवा जंगल/पाणी साचलेल्या भागात गेला आहात का?',
      text_bn: 'আপনি কি সম্প্রতি বাইরে কোথাও ভ্রমণ করেছেন বা জঙ্গল/জলাবদ্ধ এলাকায় গেছেন?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'fever_contacts';
      }
    },
    fever_contacts: {
      id: 'fever_contacts',
      text: 'Have you been in close contact with anyone who has been sick recently?',
      text_hi: 'क्या आप हाल ही में किसी बीमार व्यक्ति के संपर्क में आए हैं?',
      text_mr: 'तुम्ही अलीकडे कोणत्याही आजारी व्यक्तीच्या संपर्कात आला आहात का?',
      text_bn: 'আপনি কি সম্প্রতি কোনো অসুস্থ ব্যক্তির সংস্পর্শে এসেছেন?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'fever_joint_pain';
      }
    },
    fever_joint_pain: {
      id: 'fever_joint_pain',
      text: 'Are you experiencing severe joint or muscle pain?',
      text_hi: 'क्या आपको जोड़ों या मांसपेशियों में गंभीर दर्द हो रहा है?',
      text_mr: 'तुम्हाला सांधे किंवा स्नायूंमध्ये तीव्र वेदना होत आहेत का?',
      text_bn: 'আপনার কি তীব্র হাড়ের জোড়ে বা পেশীতে ব্যথা হচ্ছে?',
      type: 'single_choice',
      options: [
        { value: 'yes_severe', label: 'Yes, very severe (bone-breaking pain)', label_hi: 'हाँ, बहुत तेज (हड्डी टूटने जैसा दर्द)', label_mr: 'होय, खूप तीव्र (हाडे मोडल्यासारख्या वेदना)', label_bn: 'হ্যাঁ, খুব তীব্র (হাড় ভাঙার মতো ব্যথা)' },
        { value: 'mild', label: 'Mild body ache', label_hi: 'हल्का बदन दर्द', label_mr: 'सौम्य अंगदुखी', label_bn: 'হালকা শরীর ব্যথা' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (answer) => {
        if (answer === 'yes_severe') return { type: 'red_flag', flag_id: 'fever_suspected_dengue' };
        return 'fever_associated';
      }
    },
    fever_associated: {
      id: 'fever_associated',
      text: 'Are you experiencing any of these other symptoms?',
      text_hi: 'क्या आपको इनमें से कोई अन्य लक्षण महसूस हो रहा है?',
      text_mr: 'तुम्हाला यापैकी इतर कोणती लक्षणे जाणवत आहेत का?',
      text_bn: 'আপনি কি এই উপসর্গগুলোর কোনটি অনুভব করছেন?',
      type: 'multi_choice',
      options: [
        { value: 'chills', label: 'Chills or body shivering', label_hi: 'ठंड लगना या कंपकंपी', label_mr: 'थंडी वाजणे किंवा थरथरणे', label_bn: 'ঠান্ডা লাগা বা কাঁপুনি' },
        { value: 'rash', label: 'A new skin rash or red spots', label_hi: 'शरीर पर लाल दाने या चकत्ते', label_mr: 'अंगावर नवीन पुरळ किंवा लाल डाग', label_bn: 'শরীরে নতুন ফুসকুড়ি বা লাল দাগ' },
        { value: 'neck_stiffness', label: 'Severe stiff neck / Inability to bend neck', label_hi: 'गर्दन में तेज अकड़न', label_mr: 'मान ताठरणे / मान वाकवता न येणे', label_bn: 'ঘাড়ে তীব্র শক্তভাব / ঘাড় বাঁকাতে না পারা' },
        { value: 'burning_urine', label: 'Pain or burning while urinating', label_hi: 'पेशाब में जलन या दर्द', label_mr: 'लघवी करताना वेदना किंवा जळजळ', label_bn: 'প্রস্রাবে ব্যথা বা জ্বালাপোড়া' },
        { value: 'severe_headache', label: 'Intense headache behind the eyes', label_hi: 'आंखों के पीछे तेज सिरदर्द', label_mr: 'डोळ्यांच्या मागे तीव्र डोकेदुखी', label_bn: 'চোখের পেছনে তীব্র মাথাব্যথা' },
        { value: 'none', label: 'None of these', label_hi: 'इनमें से कोई नहीं', label_mr: 'यापैकी काहीही नाही', label_bn: 'এগুলোর কোনটিই নয়' }
      ],
      next: (answer) => {
        if (Array.isArray(answer) && answer.includes('neck_stiffness')) return { type: 'red_flag', flag_id: 'fever_neck_stiffness' };
        return 'fever_hydration';
      }
    },
    fever_hydration: {
      id: 'fever_hydration',
      text: 'Are you able to drink water and retain oral fluids without vomiting?',
      text_hi: 'क्या आप बिना उल्टी किए पर्याप्त पानी और तरल पदार्थ पी पा रहे हैं?',
      text_mr: 'तुम्ही उलटी न होता पाणी आणि द्रवपदार्थ पिऊ शकत आहात का?',
      text_bn: 'আপনি কি বমি না করে পর্যাপ্ত জল ও তরল খাবার খেতে পারছেন?',
      type: 'single_choice',
      options: [
        { value: 'drinking_well', label: 'Yes, drinking adequate water and fluids', label_hi: 'हाँ, पर्याप्त पानी पी पा रहा हूँ', label_mr: 'होय, पुरेसे पाणी आणि द्रवपदार्थ पीत आहे', label_bn: 'হ্যাঁ, পর্যাপ্ত জল খাচ্ছি' },
        { value: 'reduced_intake', label: 'Drinking less due to nausea or low appetite', label_hi: 'भूख/उल्टी की वजह से कम पी पा रहा हूँ', label_mr: 'मळमळ किंवा भूक मंदावल्यामुळे कमी पीत आहे', label_bn: 'বমি ভাব বা ক্ষুধামান্দ্যের কারণে কম খাচ্ছি' },
        { value: 'unable_to_retain', label: 'Unable to keep any liquids down (vomiting everything)', label_hi: 'बिल्कुल पानी नहीं पच रहा (लगातार उल्टी)', label_mr: 'काहीही पोटात टिकत नाही (सतत उलटी होत आहे)', label_bn: 'কোনো জল পেটে থাকছে না (সব বমি হয়ে যাচ্ছে)' }
      ],
      next: (answer) => {
        if (answer === 'unable_to_retain') return { type: 'red_flag', flag_id: 'fever_severe_dehydration' };
        return null;
      }
    }
  }
};

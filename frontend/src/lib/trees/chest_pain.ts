import type { InterviewTree } from "@/types/interview-tree";

export const chestPainTree: InterviewTree = {
  complaint: 'Chest pain',
  start_question_id: 'cp_site',
  questions: {
    cp_site: {
      id: 'cp_site',
      text: 'Where exactly is the pain?',
      text_hi: 'दर्द ठीक कहाँ है?',
      text_mr: 'नेमके कुठे दुखत आहे?',
      text_bn: 'ঠিক কোথায় ব্যথা করছে?',
      type: 'single_choice',
      options: [
        { value: 'central', label: 'In the middle of my chest', label_hi: 'छाती के बीच में', label_mr: 'छातीच्या मध्यभागी', label_bn: 'বুকের মাঝখানে' },
        { value: 'left', label: 'On the left side', label_hi: 'बाईं ओर', label_mr: 'डाव्या बाजूला', label_bn: 'বাম দিকে' },
        { value: 'right', label: 'On the right side', label_hi: 'दाईं ओर', label_mr: 'उजव्या बाजूला', label_bn: 'ডান দিকে' }
      ],
      next: (answer) => {
        if (answer === 'right') return 'cp_exacerbating';
        return 'cp_radiation';
      }
    },
    cp_radiation: {
      id: 'cp_radiation',
      text: 'Does the pain spread anywhere else?',
      text_hi: 'क्या दर्द कहीं और फैलता है?',
      text_mr: 'हे दुखणे इतर कुठे पसरते का?',
      text_bn: 'ব্যথা কি অন্য কোথাও ছড়িয়ে পড়ে?',
      type: 'single_choice',
      options: [
        { value: 'left_arm', label: 'Down my left arm', label_hi: 'मेरे बाएं हाथ के नीचे', label_mr: 'माझ्या डाव्या हाताकडे', label_bn: 'আমার বাম হাতের দিকে' },
        { value: 'jaw', label: 'Up to my jaw or neck', label_hi: 'मेरे जबड़े या गर्दन तक', label_mr: 'माझ्या जबड्यापर्यंत किंवा मानेपर्यंत', label_bn: 'আমার চোয়াল বা ঘাড় পর্যন্ত' },
        { value: 'back', label: 'Through to my back', label_hi: 'मेरी पीठ तक', label_mr: 'माझ्या पाठीकडे', label_bn: 'আমার পিঠের দিকে' },
        { value: 'no', label: 'No, it stays in one place', label_hi: 'नहीं, यह एक ही जगह रहता है', label_mr: 'नाही, ते एकाच जागी राहते', label_bn: 'না, এটি এক জায়গায় থাকে' }
      ],
      next: (answer) => {
        if (answer === 'left_arm') return { type: 'red_flag', flag_id: 'chest_pain_left_arm_radiation' };
        if (answer === 'jaw') return { type: 'red_flag', flag_id: 'chest_pain_jaw_radiation' };
        return 'cp_character';
      }
    },
    cp_character: {
      id: 'cp_character',
      text: 'What does the pain feel like?',
      text_hi: 'दर्द कैसा महसूस होता है?',
      text_mr: 'दुखणे कसे वाटते?',
      text_bn: 'ব্যথা কেমন অনুভূত হয়?',
      type: 'single_choice',
      options: [
        { value: 'crushing', label: 'Heavy, tight, or crushing', label_hi: 'भारी, जकड़न या कुचलने वाला', label_mr: 'जड, दाब पडल्यासारखे किंवा आवळल्यासारखे', label_bn: 'ভারী, চাপ ধরা বা পিষে ফেলার মতো' },
        { value: 'sharp', label: 'Sharp or stabbing', label_hi: 'तेज या चुभने वाला', label_mr: 'तीव्र किंवा टोचल्यासारखे', label_bn: 'তীব্র বা বিঁধার মতো' },
        { value: 'burning', label: 'Burning', label_hi: 'जलन', label_mr: 'जळजळ', label_bn: 'জ্বলুনি' }
      ],
      next: (answer) => {
        if (answer === 'crushing') return 'cp_associated_cardiac';
        if (answer === 'burning') return 'cp_associated_gi';
        return 'cp_exacerbating';
      }
    },
    cp_exacerbating: {
      id: 'cp_exacerbating',
      text: 'What makes the pain worse?',
      text_hi: 'दर्द किससे बढ़ जाता है?',
      text_mr: 'कशामुळे दुखणे वाढते?',
      text_bn: 'কিসে ব্যথা বাড়ে?',
      type: 'single_choice',
      options: [
        { value: 'breathing', label: 'Taking a deep breath or coughing', label_hi: 'गहरी सांस लेना या खांसना', label_mr: 'दीर्घ श्वास घेणे किंवा खोकणे', label_bn: 'লম্বা শ্বাস নেওয়া বা কাশি দিলে' },
        { value: 'pressing', label: 'Pressing on my chest', label_hi: 'छाती पर दबाव डालना', label_mr: 'छातीवर दाब दिल्याने', label_bn: 'বুকে চাপ দিলে' },
        { value: 'exertion', label: 'Walking or physical effort', label_hi: 'चलना या शारीरिक प्रयास', label_mr: 'चालणे किंवा शारीरिक कष्ट', label_bn: 'হাঁটা বা শারীরিক পরিশ্রম করলে' },
        { value: 'nothing', label: 'Nothing specific', label_hi: 'कुछ खास नहीं', label_mr: 'विशेष काही नाही', label_bn: 'নির্দিষ্ট কিছু নয়' }
      ],
      next: (_answer) => {
        return 'cp_onset';
      }
    },
    cp_onset: {
      id: 'cp_onset',
      text: 'When did this pain start?',
      text_hi: 'यह दर्द कब शुरू हुआ?',
      text_mr: 'हे दुखणे कधी सुरू झाले?',
      text_bn: 'এই ব্যথা কখন শুরু হয়েছিল?',
      type: 'single_choice',
      options: [
        { value: 'minutes_ago', label: 'In the last few minutes/hours', label_hi: 'पिछले कुछ मिनटों/घंटों में', label_mr: 'गेल्या काही मिनिटांत किंवा तासांत', label_bn: 'গত কয়েক মিনিট বা ঘণ্টায়' },
        { value: 'days_ago', label: 'A few days ago', label_hi: 'कुछ दिन पहले', label_mr: 'काही दिवसांपूर्वी', label_bn: 'কয়েক দিন আগে' },
        { value: 'months_ago', label: 'Weeks or months ago', label_hi: 'हफ्तों या महीनों पहले', label_mr: 'आठवडे किंवा महिन्यांपूर्वी', label_bn: 'কয়েক সপ্তাহ বা মাস আগে' }
      ],
      next: (_answer) => {
        return 'cp_relieving';
      }
    },
    cp_relieving: {
      id: 'cp_relieving',
      text: 'What makes the pain better?',
      text_hi: 'किससे दर्द में आराम मिलता है?',
      text_mr: 'कशामुळे दुखणे कमी होते?',
      text_bn: 'কিসে ব্যথা কমে?',
      type: 'single_choice',
      options: [
        { value: 'rest', label: 'Resting', label_hi: 'आराम करना', label_mr: 'विश्रांती घेतल्याने', label_bn: 'বিশ্রাম নিলে' },
        { value: 'medication', label: 'Taking medication', label_hi: 'दवा लेना', label_mr: 'औषध घेतल्याने', label_bn: 'ওষুধ খেলে' },
        { value: 'posture', label: 'Changing posture', label_hi: 'मुद्रा बदलना', label_mr: 'बसण्याची किंवा झोपण्याची स्थिती बदलल्याने', label_bn: 'শরীরের ভঙ্গি পরিবর্তন করলে' },
        { value: 'nothing', label: 'Nothing', label_hi: 'कुछ नहीं', label_mr: 'कशानेही नाही', label_bn: 'কিছুতেই না' }
      ],
      next: (_answer) => {
        return 'cp_timing';
      }
    },
    cp_timing: {
      id: 'cp_timing',
      text: 'Is the pain constant or does it come and go?',
      text_hi: 'क्या दर्द लगातार है या आता-जाता रहता है?',
      text_mr: 'दुखणे सतत असते की येते-जाते?',
      text_bn: 'ব্যথা কি একটানা থাকে নাকি আসে যায়?',
      type: 'single_choice',
      options: [
        { value: 'constant', label: 'Constant', label_hi: 'लगातार', label_mr: 'सतत', label_bn: 'একটানা' },
        { value: 'intermittent', label: 'Comes and goes', label_hi: 'आता-जाता रहता है', label_mr: 'येत-जात राहते', label_bn: 'আসে যায়' }
      ],
      next: (_answer) => {
        return 'cp_severity';
      }
    },
    cp_severity: {
      id: 'cp_severity',
      text: 'How severe is the chest pain?',
      text_hi: 'छाती में दर्द कितना तेज है?',
      text_mr: 'छातीतील दुखणे किती तीव्र आहे?',
      text_bn: 'বুকের ব্যথা কতটা তীব্র?',
      type: 'single_choice',
      options: [
        { value: 'mild', label: 'Mild (Noticeable but manageable)', label_hi: 'हल्का (महसूस होता है पर काम कर सकते हैं)', label_mr: 'सौम्य (जाणवते पण काम करता येते)', label_bn: 'মৃদু (বোঝা যায় তবে কাজ করা যায়)' },
        { value: 'moderate', label: 'Moderate (Affects daily activities)', label_hi: 'मध्यम (रोजमर्रा के कामों में दिक्कत)', label_mr: 'मध्यम (दैनंदिन कामात अडचण)', label_bn: 'মাঝারি (দৈনন্দিন কাজে ব্যাঘাত ঘটে)' },
        { value: 'severe', label: 'Severe (Unbearable or worst ever)', label_hi: 'गंभीर (असहनीय या अब तक का सबसे तेज दर्द)', label_mr: 'तीव्र (असह्य किंवा आतापर्यंतचे सर्वाधिक)', label_bn: 'তীব্র (অসহ্য বা জীবনের সবচেয়ে মারাত্মক)' }
      ],
      next: (_answer) => {
        return 'cp_dizziness';
      }
    },
    cp_associated_cardiac: {
      id: 'cp_associated_cardiac',
      text: 'Are you experiencing any of these other symptoms?',
      text_hi: 'क्या आपको इनमें से कोई अन्य लक्षण महसूस हो रहा है?',
      text_mr: 'तुम्हाला यापैकी इतर कोणती लक्षणे जाणवत आहेत का?',
      text_bn: 'আপনি কি এই উপসর্গগুলোর কোনটি অনুভব করছেন?',
      type: 'multi_choice',
      options: [
        { value: 'sweating', label: 'Excessive sweating', label_hi: 'बहुत पसीना आना', label_mr: 'खूप घाम येणे', label_bn: 'অতিরিক্ত ঘাম হওয়া' },
        { value: 'nausea', label: 'Nausea or vomiting', label_hi: 'जी मिचलाना या उल्टी', label_mr: 'मळमळ किंवा उलटी', label_bn: 'বমি বমি ভাব বা বমি' },
        { value: 'breathless', label: 'Shortness of breath', label_hi: 'सांस लेने में तकलीफ', label_mr: 'श्वास घेण्यास त्रास', label_bn: 'শ্বাসকষ্ট' },
        { value: 'none', label: 'None of the above', label_hi: 'इनमें से कोई नहीं', label_mr: 'यापैकी काहीही नाही', label_bn: 'উপরের কোনটিই নয়' }
      ],
      next: (answer) => {
        if (Array.isArray(answer) && answer.includes('sweating')) return { type: 'red_flag', flag_id: 'chest_pain_sweating' };
        if (Array.isArray(answer) && answer.includes('breathless')) return { type: 'red_flag', flag_id: 'chest_pain_breathlessness' };
        return 'cp_onset';
      }
    },
    cp_associated_gi: {
      id: 'cp_associated_gi',
      text: 'Is the pain related to meals?',
      text_hi: 'क्या दर्द का भोजन से कोई संबंध है?',
      text_mr: 'दुखण्याचा जेवणाशी काही संबंध आहे का?',
      text_bn: 'ব্যথার সাথে খাবারের কি কোনো সম্পর্ক আছে?',
      type: 'single_choice',
      options: [
        { value: 'worse_eating', label: 'It gets worse after eating', label_hi: 'खाने के बाद बढ़ जाता है', label_mr: 'जेवणानंतर वाढते', label_bn: 'খাওয়ার পর বেড়ে যায়' },
        { value: 'better_eating', label: 'It gets better after eating', label_hi: 'खाने के बाद कम हो जाता है', label_mr: 'जेवणानंतर कमी होते', label_bn: 'খাওয়ার পর উপশম হয়' },
        { value: 'unrelated', label: 'Not related to meals', label_hi: 'भोजन से संबंधित नहीं', label_mr: 'जेवणाशी कोणताही संबंध नाही', label_bn: 'খাবারের সাথে কোনো সম্পর্ক নেই' }
      ],
      next: (_answer) => {
        return 'cp_onset';
      }
    },
    cp_dizziness: {
      id: 'cp_dizziness',
      text: 'Are you feeling lightheaded, dizzy, or like you might faint?',
      text_hi: 'क्या आपको चक्कर आ रहे हैं या बेहोशी जैसा महसूस हो रहा है?',
      text_mr: 'तुम्हाला चक्कर येत आहे किंवा भोवळ आल्यासारखे वाटते आहे का?',
      text_bn: 'আপনার কি মাথা ঘুরছে বা অজ্ঞান হয়ে যাওয়ার মতো লাগছে?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (answer) => {
        if (answer === 'yes') return { type: 'red_flag', flag_id: 'chest_pain_dizziness' };
        return null; // End of interview
      }
    },
    q_chest_worse_exertion: {
      id: 'q_chest_worse_exertion',
      text: 'Does the pain get worse with physical activity?',
      text_hi: 'क्या दर्द शारीरिक गतिविधि से बढ़ता है?',
      text_mr: 'शारीरिक हालचालीने त्रास वाढतो का?',
      text_bn: 'শারীরিক পরিশ্রমের সাথে কি ব্যথা বাড়ে?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' },
        { value: 'unsure', label: "I don't know", label_hi: 'पता नहीं', label_mr: 'माहित नाही', label_bn: 'জানি না' }
      ],
      next: () => 'next_after_probe'
    },
    q_recent_immobility: {
      id: 'q_recent_immobility',
      text: 'Have you had recent surgery, long travel, or leg swelling?',
      text_hi: 'क्या हाल ही में सर्जरी, लंबी यात्रा, या पैर में सूजन हुई है?',
      text_mr: 'नुकतीच शस्त्रक्रिया, मोठा प्रवास किंवा पायाला सूज आली आहे का?',
      text_bn: 'সম্প্রতি কি কোনো সার্জারি, দীর্ঘ ভ্রমণ বা পায়ে ফোলা ভাব হয়েছে?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' },
        { value: 'unsure', label: "I don't know", label_hi: 'पता नहीं', label_mr: 'माहित नाही', label_bn: 'জানি না' }
      ],
      next: () => 'next_after_probe'
    },
    q_tearing_character: {
      id: 'q_tearing_character',
      text: 'Is the pain tearing or ripping in character?',
      text_hi: 'क्या दर्द फटने या चीरने जैसा है?',
      text_mr: 'वेदना फाडल्यासारख्या किंवा चिरल्यासारख्या आहेत का?',
      text_bn: 'ব্যথা কি ফেটে যাওয়া বা ছিঁড়ে যাওয়ার মতো তীব্র?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' },
        { value: 'unsure', label: "I don't know", label_hi: 'पता नहीं', label_mr: 'माहित नाही', label_bn: 'জানি না' }
      ],
      next: () => 'next_after_probe'
    }
  }
};

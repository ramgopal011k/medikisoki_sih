import type { InterviewTree } from "@/types/interview-tree";

export const abdominalPainTree: InterviewTree = {
  complaint: 'Abdominal pain',
  start_question_id: 'abd_site',
  questions: {
    abd_site: {
      id: 'abd_site',
      text: 'Where does your stomach or abdomen hurt the most?',
      text_hi: 'पेट में दर्द सबसे ज्यादा कहाँ हो रहा है?',
      text_mr: 'पोटात सर्वात जास्त कुठे दुखत आहे?',
      text_bn: 'পেটে সবচেয়ে বেশি কোথায় ব্যথা করছে?',
      type: 'single_choice',
      options: [
        { value: 'upper_right', label: 'Upper right (below ribs)', label_hi: 'ऊपर दाईं ओर (पसलियों के नीचे)', label_mr: 'वरच्या उजव्या बाजूला (बरगड्यांखाली)', label_bn: 'উপরের ডান দিকে (পাঁজরের নিচে)' },
        { value: 'upper_left', label: 'Upper left', label_hi: 'ऊपर बाईं ओर', label_mr: 'वरच्या डाव्या बाजूला', label_bn: 'উপরের বাম দিকে' },
        { value: 'lower_right', label: 'Lower right (near hip/groin)', label_hi: 'नीचे दाईं ओर (अपेंडिक्स क्षेत्र)', label_mr: 'खालच्या उजव्या बाजूला (अपेंडिक्स भाग)', label_bn: 'নিচের ডান দিকে (অ্যাপেন্ডিক্স এলাকা)' },
        { value: 'lower_left', label: 'Lower left', label_hi: 'नीचे बाईं ओर', label_mr: 'खालच्या डाव्या बाजूला', label_bn: 'নিচের বাম দিকে' },
        { value: 'central', label: 'All over / Around navel (Central)', label_hi: 'नाभि के पास या पूरे पेट में', label_mr: 'बेंबीजवळ किंवा संपूर्ण पोटात', label_bn: 'নাভির চারপাশে বা পুরো পেটে' }
      ],
      next: (answer) => {
        if (answer === 'lower_right') return { type: 'red_flag', flag_id: 'abdominal_lower_right_appendicitis' };
        return 'abd_onset';
      }
    },
    abd_onset: {
      id: 'abd_onset',
      text: 'How did the abdominal pain start?',
      text_hi: 'पेट का दर्द कैसे शुरू हुआ?',
      text_mr: 'पोटदुखी कशी सुरू झाली?',
      text_bn: 'পেটে ব্যথা কীভাবে শুরু হয়েছিল?',
      type: 'single_choice',
      options: [
        { value: 'sudden', label: 'Suddenly like a lightning bolt (Instantly severe)', label_hi: 'अचानक और बहुत तेजी से', label_mr: 'अचानक आणि खूप तीव्रपणे', label_bn: 'হঠাৎ তীব্রভাবে' },
        { value: 'gradual', label: 'Gradually developing over hours or days', label_hi: 'धीरे-धीरे घंटों या दिनों में', label_mr: 'हळूहळू काही तासांत किंवा दिवसांत', label_bn: 'ধীরে ধীরে কয়েক ঘণ্টা বা দিনে' }
      ],
      next: (answer) => {
        if (answer === 'sudden') return { type: 'red_flag', flag_id: 'abdominal_sudden_onset' };
        return 'abd_character';
      }
    },
    abd_character: {
      id: 'abd_character',
      text: 'What does the pain feel like?',
      text_hi: 'दर्द किस प्रकार का महसूस होता है?',
      text_mr: 'दुखणे कशा प्रकारचे जाणवते?',
      text_bn: 'ব্যথা কেমন অনুভূত হয়?',
      type: 'single_choice',
      options: [
        { value: 'sharp', label: 'Sharp, stabbing or cutting', label_hi: 'तेज, चुभने वाला या काटने जैसा', label_mr: 'तीव्र, टोचल्यासारखे किंवा कापल्यासारखे', label_bn: 'তীব্র, বিঁধার মতো বা কাটার মতো' },
        { value: 'cramping', label: 'Colicky / Cramping (comes in waves)', label_hi: 'मरोड़ या लहरों में उठने वाला दर्द', label_mr: 'पोटात पीळ पडणे / मुरडा येणे', label_bn: 'মোচড় দিয়ে বা থেমে থেমে ব্যথা' },
        { value: 'burning', label: 'Burning sensation in upper belly', label_hi: 'ऊपरी पेट में तेज जलन', label_mr: 'वरच्या पोटात तीव्र जळजळ', label_bn: 'উপরের পেটে তীব্র জ্বালা' },
        { value: 'dull', label: 'Constant dull continuous ache', label_hi: 'लगातार मीठा/हल्का भारी दर्द', label_mr: 'सतत मंद आणि जड दुखणे', label_bn: 'একটানা মৃদু কিন্তু ভারী ব্যথা' }
      ],
      next: (answer) => {
        if (answer === 'burning') return 'abd_food_relation';
        return 'abd_radiation';
      }
    },
    abd_radiation: {
      id: 'abd_radiation',
      text: 'Does the pain spread or shoot to other areas?',
      text_hi: 'क्या दर्द पेट से निकलकर कहीं और फैलता है?',
      text_mr: 'पोटातील दुखणे इतर कुठे पसरते का?',
      text_bn: 'পেটের ব্যথা কি অন্য কোথাও ছড়িয়ে পড়ে?',
      type: 'single_choice',
      options: [
        { value: 'to_back', label: 'Straight through to my back', label_hi: 'सीधे पीठ की तरफ', label_mr: 'थेट पाठीकडे', label_bn: 'সোজা পিঠের দিকে' },
        { value: 'to_shoulder', label: 'Up to the right shoulder blade', label_hi: 'दाहिने कंधे की तरफ', label_mr: 'उजव्या खांद्याकडे', label_bn: 'ডান কাঁধের দিকে' },
        { value: 'to_groin', label: 'Downwards into the groin / inner thigh', label_hi: 'नीचे जांघ या कमर की तरफ', label_mr: 'खाली जांघेच्या किंवा कमरेच्या भागात', label_bn: 'নিচে কুঁচকি বা উরুর দিকে' },
        { value: 'nowhere', label: 'No, it stays strictly in the stomach', label_hi: 'नहीं, सिर्फ पेट में ही रहता है', label_mr: 'नाही, फक्त पोटातच राहते', label_bn: 'না, শুধু পেটের মধ্যেই থাকে' }
      ],
      next: (_answer) => {
        return 'abd_food_relation';
      }
    },
    abd_food_relation: {
      id: 'abd_food_relation',
      text: 'How is the pain affected by eating meals or oily food?',
      text_hi: 'खाना या तला-भुना खाने से दर्द पर क्या असर पड़ता है?',
      text_mr: 'जेवण किंवा तेलकट अन्न खाल्ल्यावर दुखण्यावर काय परिणाम होतो?',
      text_bn: 'খাবার বা তেলযুক্ত খাবার খেলে ব্যথার কী পরিবর্তন হয়?',
      type: 'single_choice',
      options: [
        { value: 'worse_after_food', label: 'Worse after eating (especially heavy/fatty food)', label_hi: 'खाने के बाद बढ़ जाता है (खासकर भारी खाने से)', label_mr: 'जेवणानंतर वाढते (विशेषतः तेलकट/जड अन्नाने)', label_bn: 'খাওয়ার পর বাড়ে (বিশেষ করে ভারী বা চর্বিযুক্ত খাবারে)' },
        { value: 'relieved_by_food', label: 'Relieved temporarily after eating or milk', label_hi: 'खाना खाने या दूध पीने से आराम मिलता है', label_mr: 'अन्न किंवा दूध घेतल्यावर तात्पुरता आराम मिळतो', label_bn: 'খাবার বা দুধ খেলে সাময়িক আরাম হয়' },
        { value: 'no_relation', label: 'No relation to food or meals', label_hi: 'भोजन से कोई संबंध नहीं', label_mr: 'जेवणाशी कोणताही संबंध नाही', label_bn: 'খাবারের সাথে কোনো সম্পর্ক নেই' }
      ],
      next: (_answer) => {
        return 'abd_bowel';
      }
    },
    abd_bowel: {
      id: 'abd_bowel',
      text: 'Have you noticed any changes in your bowel movements or stool?',
      text_hi: 'क्या आपको शौच या पेट साफ होने में कोई बदलाव दिखा है?',
      text_mr: 'तुमच्या शौचात किंवा पोट साफ होण्यात काही बदल झाला आहे का?',
      text_bn: 'পায়খানায় বা পেট পরিষ্কার হওয়ার ক্ষেত্রে কি কোনো পরিবর্তন লক্ষ্য করেছেন?',
      type: 'single_choice',
      options: [
        { value: 'diarrhea', label: 'Watery diarrhea or loose stools', label_hi: 'दस्त या पतला शौच', label_mr: 'पातळ जुलाब किंवा संडास', label_bn: 'পাতলা পায়খানা বা ডায়রিয়া' },
        { value: 'constipation', label: 'Unable to pass gas or stool (Constipation)', label_hi: 'कब्ज या गैस/मल बिल्कुल न निकलना', label_mr: 'मलबद्धता / गॅस किंवा शौचास न होणे', label_bn: 'কোষ্ঠকাঠিন্য / গ্যাস বা মলত্যাগে অক্ষমতা' },
        { value: 'blood', label: 'Red blood or black tarry stool', label_hi: 'मल में खून या काला मल', label_mr: 'शौचातून रक्त पडणे किंवा काळी संडास', label_bn: 'পায়খানায় রক্ত বা কালো আলকাতরার মতো পায়খানা' },
        { value: 'normal', label: 'Normal bowel movements', label_hi: 'सामान्य', label_mr: 'सामान्य', label_bn: 'স্বাভাবিক' }
      ],
      next: (answer) => {
        if (answer === 'blood') return { type: 'red_flag', flag_id: 'abdominal_blood_in_stool' };
        return 'abd_jaundice';
      }
    },
    abd_jaundice: {
      id: 'abd_jaundice',
      text: 'Have you noticed any yellowish discoloration of your eyes or skin?',
      text_hi: 'क्या आपने अपनी आँखों या त्वचा में पीलापन देखा है (पीलिया)?',
      text_mr: 'तुम्हाला डोळ्यांमध्ये किंवा त्वचेवर पिवळेपणा जाणवला आहे का (कावीळ)?',
      text_bn: 'চোখে বা ত্বকে কি হলদে ভাব লক্ষ্য করেছেন (জন্ডিস)?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'abd_urinary';
      }
    },
    abd_urinary: {
      id: 'abd_urinary',
      text: 'Are you experiencing any pain or burning sensation when you urinate?',
      text_hi: 'क्या आपको पेशाब करते समय कोई दर्द या जलन महसूस होती है?',
      text_mr: 'लघवी करताना तुम्हाला वेदना किंवा जळजळ जाणवते का?',
      text_bn: 'প্রস্রাব করার সময় কি কোনো ব্যথা বা জ্বালাপোড়া অনুভব করছেন?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'abd_vomiting';
      }
    },
    abd_vomiting: {
      id: 'abd_vomiting',
      text: 'Are you experiencing persistent nausea or vomiting?',
      text_hi: 'क्या आपको लगातार उल्टी या जी मिचलाने की समस्या है?',
      text_mr: 'तुम्हाला सतत मळमळ किंवा उलट्या होत आहेत का?',
      text_bn: 'আপনার কি ক্রমাগত বমি ভাব বা বমি হচ্ছে?',
      type: 'single_choice',
      options: [
        { value: 'coffee_ground', label: 'Vomiting blood or coffee-ground material', label_hi: 'उल्टी में खून या काले रंग का पदार्थ', label_mr: 'उलटीतून रक्त पडणे किंवा कॉफीसारखा काळा पदार्थ', label_bn: 'বমিতে রক্ত বা কফির গুঁড়োর মতো পদার্থ' },
        { value: 'food_bile', label: 'Vomiting food or greenish bile', label_hi: 'भोजन या हरे/पीले पानी की उल्टी', label_mr: 'अन्नाची किंवा हिरवट-पिवळ्या पाण्याची उलटी', label_bn: 'খাবার বা সবুজাভ পিত্ত বমি' },
        { value: 'nausea_only', label: 'Nausea without vomiting', label_hi: 'सिर्फ जी मिचलाना, उल्टी नहीं', label_mr: 'फक्त मळमळ, उलटी नाही', label_bn: 'শুধু বমি বমি ভাব, বমি নয়' },
        { value: 'none', label: 'No nausea or vomiting', label_hi: 'कोई उल्टी नहीं', label_mr: 'मळमळ किंवा उलटी नाही', label_bn: 'বমি বা বমি ভাব নেই' }
      ],
      next: (answer) => {
        if (answer === 'coffee_ground') return { type: 'red_flag', flag_id: 'abdominal_hematemesis' };
        return null;
      }
    },
    q_rlq_tenderness: {
      id: 'q_rlq_tenderness',
      text: 'Does the pain hurt more when you press the lower right abdomen?',
      text_hi: 'क्या निचले दाएं पेट पर दबाने से दर्द बढ़ता है?',
      text_mr: 'पोटाच्या उजव्या बाजूला खाली दाबल्यास वेदना जास्त होतात का?',
      text_bn: 'পেটের নিচের ডান দিকে চাপ দিলে কি ব্যথা বেশি লাগে?',
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

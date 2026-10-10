import type { InterviewTree } from "@/types/interview-tree";

export const backPainTree: InterviewTree = {
  complaint: 'Back pain',
  start_question_id: 'bp_location',
  questions: {
    bp_location: {
      id: 'bp_location',
      text: 'Where is the back pain located precisely?',
      text_hi: 'पीठ में दर्द ठीक कहाँ है?',
      text_mr: 'पाठीत नेमके कुठे दुखत आहे?',
      text_bn: 'পিঠে ঠিক কোথায় ব্যথা করছে?',
      type: 'single_choice',
      options: [
        { value: 'upper', label: 'Upper back / Between shoulder blades / Neck', label_hi: 'ऊपरी पीठ / कंधों के बीच / गर्दन', label_mr: 'वरची पाठ / खांद्यांच्या मध्ये / मान', label_bn: 'উপরের পিঠ / কাঁধের ব্লেডের মাঝে / ঘাড়' },
        { value: 'lower', label: 'Lower back (Lumbar area)', label_hi: 'निचली पीठ (कमर का निचला हिस्सा)', label_mr: 'खालची पाठ (कंबर / लंबर भाग)', label_bn: 'কোমর / নিচের পিঠ (লাম্বার এলাকা)' },
        { value: 'buttocks', label: 'Buttocks or tailbone area (Sacral/Coccyx)', label_hi: 'कूल्हों या टेलबोन के पास', label_mr: 'नितंब किंवा माकडहाड भाग (टेलबोन)', label_bn: 'নিতম্ব বা টেলবোন এলাকা (টেইলবোন)' }
      ],
      next: (_answer) => {
        return 'bp_onset';
      }
    },
    bp_onset: {
      id: 'bp_onset',
      text: 'How did the back pain start?',
      text_hi: 'पीठ का दर्द कैसे शुरू हुआ?',
      text_mr: 'पाठदुखी कशी सुरू झाली?',
      text_bn: 'পিঠের ব্যথা কীভাবে শুরু হয়েছিল?',
      type: 'single_choice',
      options: [
        { value: 'trauma', label: 'After an accident, heavy fall, or direct injury', label_hi: 'दुर्घटना, गिरने या सीधी चोट के बाद', label_mr: 'अपघात, जोरात पडल्याने किंवा थेट मार लागल्याने', label_bn: 'দুর্ঘটনা, পড়ে যাওয়া বা সরাসরি আঘাতের পর' },
        { value: 'lifting', label: 'Immediately after lifting heavy weights or sudden twist', label_hi: 'भारी वजन उठाने या अचानक झुकने/मुड़ने से', label_mr: 'जड वजन उचलल्यानंतर किंवा अचानक वाकल्याने/मुरगळल्याने', label_bn: 'ভারী জিনিস তোলার পর বা হঠাৎ মোচড় লাগায়' },
        { value: 'spontaneous', label: 'Gradually on its own without any obvious injury', label_hi: 'बिना किसी चोट के धीरे-धीरे अपने आप', label_mr: 'कोणत्याही दुखापतीशिवाय हळूहळू आपोआप', label_bn: 'কোনো স্পষ্ট আঘাত ছাড়াই ধীরে ধীরে নিজে থেকে' }
      ],
      next: (answer) => {
        if (answer === 'trauma') return { type: 'red_flag', flag_id: 'back_pain_trauma' };
        return 'bp_radiation';
      }
    },
    bp_radiation: {
      id: 'bp_radiation',
      text: 'Does the pain travel or shoot anywhere down your body?',
      text_hi: 'क्या दर्द नीचे पैरों या किसी अन्य हिस्से में फैलता है?',
      text_mr: 'दुखणे खाली पायात किंवा इतर भागात पसरते का?',
      text_bn: 'ব্যথা কি নিচে পায়ের দিকে বা অন্য কোথাও ছড়িয়ে যায়?',
      type: 'single_choice',
      options: [
        { value: 'one_leg', label: 'Shooting down one leg past the knee (Sciatica)', label_hi: 'एक पैर में घुटने के नीचे तक (साइटिका)', label_mr: 'एका पायात गुडघ्याखाली पसरते (सायटिका)', label_bn: 'এক পায়ে হাঁটুর নিচ পর্যন্ত ছড়িয়ে যায় (সায়াটিকা)' },
        { value: 'both_legs', label: 'Shooting down both legs', label_hi: 'दोनों पैरों में नीचे तक', label_mr: 'दोन्ही पायांत खाली पसरते', label_bn: 'দুই পায়ে নিচ পর্যন্ত ছড়িয়ে যায়' },
        { value: 'arms', label: 'Into my shoulders or arms', label_hi: 'कंधों या हाथों में', label_mr: 'माझ्या खांद्यांत किंवा हातांत', label_bn: 'আমার কাঁধে বা বাহুতে' },
        { value: 'nowhere', label: 'No, it stays confined to my back', label_hi: 'नहीं, सिर्फ पीठ/कमर तक सीमित है', label_mr: 'नाही, फक्त पाठीत/कमरेतच मर्यादित आहे', label_bn: 'না, এটি শুধু পিঠ বা কোমরেই সীমাবদ্ধ থাকে' }
      ],
      next: (_answer) => {
        return 'bp_stiffness';
      }
    },
    bp_stiffness: {
      id: 'bp_stiffness',
      text: 'Do you feel severe stiffness in your back when you wake up in the morning?',
      text_hi: 'क्या सुबह उठने पर कमर में तेज जकड़न महसूस होती है?',
      text_mr: 'सकाळी उठल्यावर पाठीत किंवा कमरेत तीव्र ताठरता/जकडण जाणवते का?',
      text_bn: 'সকালে ঘুম থেকে উঠলে কি পিঠে বা কোমরে তীব্র শক্তভাব অনুভূত হয়?',
      type: 'single_choice',
      options: [
        { value: 'prolonged', label: 'Yes, lasts longer than 30-45 minutes (improves with movement)', label_hi: 'हाँ, 30 मिनट से अधिक रहती है (चलने-फिरने से कम होती है)', label_mr: 'होय, ३०-४५ मिनिटांपेक्षा जास्त राहते (हालचालीने सुधारते)', label_bn: 'হ্যাঁ, ৩০-৪৫ মিনিটের বেশি থাকে (চলাফেরা করলে কমে)' },
        { value: 'brief', label: 'Brief stiffness (relieved in a few minutes)', label_hi: 'थोड़ी देर (कुछ मिनटों में ठीक हो जाती है)', label_mr: 'थोड्या वेळासाठी (काही मिनिटांत बरी होते)', label_bn: 'সামান্য সময় (কয়েক মিনিটে ঠিক হয়ে যায়)' },
        { value: 'no_stiffness', label: 'No morning stiffness, hurts more with activity', label_hi: 'सुबह जकड़न नहीं, काम करने से दर्द बढ़ता है', label_mr: 'सकाळी ताठरता नाही, काम केल्याने दुखणे वाढते', label_bn: 'সকালে কোনো শক্তভাব থাকে না, কাজ করলে ব্যথা বাড়ে' }
      ],
      next: (_answer) => {
        return 'bp_numbness';
      }
    },
    bp_numbness: {
      id: 'bp_numbness',
      text: 'Are you experiencing any of these critical red flag symptoms?',
      text_hi: 'क्या आपको इनमें से कोई गंभीर लक्षण महसूस हो रहे हैं?',
      text_mr: 'तुम्हाला यापैकी कोणतीही गंभीर लक्षणे जाणवत आहेत का?',
      text_bn: 'আপনি কি এই গুরুতর বিপদজনক লক্ষণগুলোর কোনটি অনুভব করছেন?',
      type: 'multi_choice',
      options: [
        { value: 'saddle_anesthesia', label: 'Numbness in the groin, buttocks, or genital area', label_hi: 'कूल्हों, जांघों के बीच या जननांग क्षेत्र में सुन्नता', label_mr: 'जांघेत, नितंबांवर किंवा गुप्तांगांच्या भागात बधिरता', label_bn: 'কুঁচকি, নিতম্ব বা যৌনাঙ্গে অসাড়তা' },
        { value: 'bladder', label: 'Loss of bladder / bowel control or inability to urinate', label_hi: 'पेशाब या शौच पर नियंत्रण खोना या पेशाब रुक जाना', label_mr: 'लघवी किंवा शौचावर नियंत्रण न राहणे किंवा लघवी अडकणे', label_bn: 'প্রস্রাব বা মলত্যাগে নিয়ন্ত্রণ হারানো বা প্রস্রাব আটকে যাওয়া' },
        { value: 'leg_weakness', label: 'Severe weakness or foot drop (tripping while walking)', label_hi: 'पैरों में भारी कमजोरी या पैर का लड़खड़ाना', label_mr: 'पायांत तीव्र अशक्तपणा किंवा चालताना पाय लटपटणे', label_bn: 'পায়ে তীব্র দুর্বলতা বা হাঁটার সময় পা ফেলা কঠিন হওয়া' },
        { value: 'none', label: 'None of these', label_hi: 'इनमें से कोई नहीं', label_mr: 'यापैकी काहीही नाही', label_bn: 'এগুলোর কোনটিই নয়' }
      ],
      next: (answer) => {
        if (Array.isArray(answer) && answer.includes('saddle_anesthesia')) return { type: 'red_flag', flag_id: 'back_pain_cauda_equina_saddle' };
        if (Array.isArray(answer) && answer.includes('bladder')) return { type: 'red_flag', flag_id: 'back_pain_cauda_equina_bladder' };
        if (Array.isArray(answer) && answer.includes('leg_weakness')) return { type: 'red_flag', flag_id: 'back_pain_cauda_equina_weakness' };
        return null;
      }
    }
  }
};

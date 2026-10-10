import type { InterviewTree } from "@/types/interview-tree";

export const coughTree: InterviewTree = {
  complaint: 'Cough',
  start_question_id: 'cough_duration',
  questions: {
    cough_duration: {
      id: 'cough_duration',
      text: 'How long have you been coughing?',
      text_hi: 'आपको खांसी कब से आ रही है?',
      text_mr: 'तुम्हाला खोकला कधीपासून येत आहे?',
      text_bn: 'আপনার কাশি কত দিন ধরে হচ্ছে?',
      type: 'single_choice',
      options: [
        { value: 'less_3_weeks', label: 'Acute (Less than 3 weeks)', label_hi: 'हालिया (3 सप्ताह से कम)', label_mr: 'अलीकडचा (३ आठवड्यांपेक्षा कमी)', label_bn: 'সাম্প্রতিক (৩ সপ্তাহের কম)' },
        { value: '3_to_8_weeks', label: 'Subacute (3 to 8 weeks)', label_hi: '3 से 8 सप्ताह', label_mr: '३ ते ८ आठवडे', label_bn: '৩ থেকে ৮ সপ্তাহ' },
        { value: 'more_8_weeks', label: 'Chronic (More than 8 weeks / Long standing)', label_hi: 'पुरानी खांसी (8 सप्ताह से अधिक)', label_mr: 'दीर्घकालीन खोकला (८ आठवड्यांपेक्षा जास्त)', label_bn: 'দীর্ঘস্থায়ী কাশি (৮ সপ্তাহের বেশি)' }
      ],
      next: (_answer) => {
        return 'cough_type';
      }
    },
    cough_type: {
      id: 'cough_type',
      text: 'What kind of cough are you experiencing?',
      text_hi: 'खांसी किस प्रकार की है?',
      text_mr: 'खोकला कोणत्या प्रकारचा आहे?',
      text_bn: 'কাশি কোন ধরনের হচ্ছে?',
      type: 'single_choice',
      options: [
        { value: 'dry', label: 'Dry, irritating, and tickly (No phlegm)', label_hi: 'सूखी और गले में खराश वाली (बिना बलगम)', label_mr: 'कोरडा खोकला / घशात खाज (कफ नसलेला)', label_bn: 'শুকনো এবং গলায় সুরসুরি হওয়া (কফ ছাড়া)' },
        { value: 'productive', label: 'Wet / Productive (Coughing up mucus/phlegm)', label_hi: 'गीली / बलगम वाली खांसी', label_mr: 'कफयुक्त खोकला (बेडका पडणारा)', label_bn: 'কফযুক্ত কাশি (শ্লেষ্মা ওঠা)' },
        { value: 'barking', label: 'Barking or seal-like harsh cough', label_hi: 'गंभीर या सीटी जैसी आवाज वाली', label_mr: 'मोठ्या आवाजाचा किंवा शिट्टीसारखा खोकला', label_bn: 'তীক্ষ্ণ বা ঘেউ ঘেউ করার মতো তীব্র কাশি' }
      ],
      next: (answer) => {
        if (answer === 'productive') return 'cough_color';
        return 'cough_timing';
      }
    },
    cough_color: {
      id: 'cough_color',
      text: 'What is the color or appearance of the phlegm/mucus?',
      text_hi: 'बलगम का रंग कैसा है?',
      text_mr: 'कफाचा रंग कसा आहे?',
      text_bn: 'কফের রঙ কেমন?',
      type: 'single_choice',
      options: [
        { value: 'clear', label: 'Clear, watery or white', label_hi: 'सफेद या पानी जैसा पारदर्शी', label_mr: 'पांढरा किंवा पाण्यासारखा पारदर्शक', label_bn: 'সাদা বা জলের মতো স্বচ্ছ' },
        { value: 'yellow', label: 'Thick yellow, green or foul smelling', label_hi: 'गाढ़ा पीला या हरा', label_mr: 'घट्ट पिवळा, हिरवा किंवा दुर्गंधीयुक्त', label_bn: 'ঘন হলুদ, সবুজ বা দুর্গন্ধযুক্ত' },
        { value: 'blood', label: 'Red streaks, rust colored, or coughing pure blood', label_hi: 'बलगम में खून या जंग जैसा लाल रंग', label_mr: 'कफात रक्त किंवा लालसर रंग', label_bn: 'কফে রক্ত বা মরচে রঙের দাগ' }
      ],
      next: (answer) => {
        if (answer === 'blood') return { type: 'red_flag', flag_id: 'cough_hemoptysis' };
        return 'cough_timing';
      }
    },
    cough_timing: {
      id: 'cough_timing',
      text: 'When is your cough most severe or triggered?',
      text_hi: 'खांसी किस समय या किस वजह से ज्यादा बढ़ जाती है?',
      text_mr: 'खोकला कोणत्या वेळी किंवा कशामुळे जास्त वाढतो?',
      text_bn: 'কাশি কোন সময়ে বা কী কারণে বেশি হয়?',
      type: 'single_choice',
      options: [
        { value: 'night', label: 'Worse at night or waking from sleep', label_hi: 'रात में या सोने पर ज्यादा', label_mr: 'रात्री किंवा झोपेतून उठल्यावर जास्त', label_bn: 'রাতে বা ঘুম থেকে ওঠার পর বাড়ে' },
        { value: 'cold_air', label: 'Triggered by cold air, dust, pollution or smoke', label_hi: 'ठंडी हवा, धूल या धुएं से', label_mr: 'थंड हवा, धूळ, प्रदूषण किंवा धुरामुळे', label_bn: 'ঠান্ডা বাতাস, ধুলোবালি বা ধোঁয়ায়' },
        { value: 'post_meal', label: 'Worse after meals or lying flat (Acid reflux)', label_hi: 'खाना खाने या लेटने के बाद (एसिडिटी)', label_mr: 'जेवणानंतर किंवा झोपल्यावर वाढतो (अ‍ॅसिडिटी)', label_bn: 'খাওয়ার পর বা শুয়ে থাকলে বাড়ে (অ্যাসিডিটি)' },
        { value: 'constant', label: 'Constant throughout the entire day', label_hi: 'पूरे दिन लगातार', label_mr: 'दिवसभर सतत खोकला असतो', label_bn: 'সারাদিন একটানা হয়' }
      ],
      next: (_answer) => {
        return 'cough_exposure';
      }
    },
    cough_exposure: {
      id: 'cough_exposure',
      text: 'Have you recently been exposed to a lot of dust, smoke, or known allergens?',
      text_hi: 'क्या आप हाल ही में बहुत अधिक धूल, धुएं या किसी एलर्जी के संपर्क में आए हैं?',
      text_mr: 'तुम्ही अलीकडे जास्त धूळ, धूर किंवा इतर अ‍ॅलर्जीच्या संपर्कात आला आहात का?',
      text_bn: 'আপনি কি সম্প্রতি অতিরিক্ত ধুলোবালি, ধোঁয়া বা অ্যালার্জেনের সংস্পর্শে এসেছেন?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'cough_voice';
      }
    },
    cough_voice: {
      id: 'cough_voice',
      text: 'Have you noticed any hoarseness or changes in your voice?',
      text_hi: 'क्या आपने अपनी आवाज़ में भारीपन या कोई बदलाव महसूस किया है?',
      text_mr: 'तुमच्या आवाजात जडपणा किंवा काही बदल जाणवला आहे का?',
      text_bn: 'আপনার গলার স্বর কি বসে গেছে বা কোনো পরিবর্তন হয়েছে?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'cough_associated';
      }
    },
    cough_associated: {
      id: 'cough_associated',
      text: 'Are you experiencing any of these other symptoms with your cough?',
      text_hi: 'क्या आपको खांसी के साथ इनमें से कोई अन्य लक्षण हैं?',
      text_mr: 'तुम्हाला खोकल्यासोबत यापैकी इतर कोणती लक्षणे जाणवत आहेत का?',
      text_bn: 'কাশির সাথে আপনার কি এই উপসর্গগুলোর কোনটি আছে?',
      type: 'multi_choice',
      options: [
        { value: 'breathless', label: 'Severe difficulty breathing or gasping for air', label_hi: 'सांस लेने में भारी तकलीफ या सांस फूलना', label_mr: 'श्वास घेण्यास तीव्र अडचण किंवा धाप लागणे', label_bn: 'তীব্র শ্বাসকষ্ট বা শ্বাস নিতে কষ্ট' },
        { value: 'wheezing', label: 'Wheezing or whistling sound in chest while breathing', label_hi: 'सांस लेते समय छाती से सीटी जैसी आवाज (घरघराहट)', label_mr: 'श्वास घेताना छातीतून शिटीसारखा आवाज (घरघर)', label_bn: 'শ্বাস নেওয়ার সময় বুকে বাঁশির মতো শব্দ (হাঁপানি)' },
        { value: 'fever', label: 'High grade fever with chills', label_hi: 'कंपकंपी के साथ तेज बुखार', label_mr: 'थंडी वाजून तीव्र ताप', label_bn: 'কাঁপুনি দিয়ে তীব্র জ্বর' },
        { value: 'weight_loss', label: 'Unexplained weight loss or drenching night sweats', label_hi: 'अचानक वजन घटना या रात में पसीना आना', label_mr: 'अचानक वजन कमी होणे किंवा रात्री खूप घाम येणे', label_bn: 'হঠাৎ ওজন কমে যাওয়া বা রাতে অতিরিক্ত ঘাম' },
        { value: 'none', label: 'None of these', label_hi: 'इनमें से कोई नहीं', label_mr: 'यापैकी काहीही नाही', label_bn: 'এগুলোর কোনটিই নয়' }
      ],
      next: (answer) => {
        if (Array.isArray(answer) && answer.includes('breathless')) return { type: 'red_flag', flag_id: 'cough_severe_breathlessness' };
        if (Array.isArray(answer) && answer.includes('weight_loss')) return { type: 'red_flag', flag_id: 'cough_unexplained_weight_loss' };
        return null;
      }
    }
  }
};

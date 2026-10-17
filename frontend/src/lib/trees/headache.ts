import type { InterviewTree } from "@/types/interview-tree";

export const headacheTree: InterviewTree = {
  complaint: 'Headache',
  start_question_id: 'ha_onset',
  questions: {
    ha_onset: {
      id: 'ha_onset',
      text: 'How quickly did the headache start?',
      text_hi: 'सिरदर्द कितनी तेजी से शुरू हुआ?',
      text_mr: 'डोकेदुखी किती वेगाने सुरू झाली?',
      text_bn: 'মাথাব্যথা কত দ্রুত শুরু হয়েছিল?',
      type: 'single_choice',
      options: [
        { value: 'thunderclap', label: 'Instantly severe, like a thunderclap (Worst pain of my life)', label_hi: 'अचानक बिजली की तरह (जीवन का सबसे तेज दर्द)', label_mr: 'विजेच्या कडकडाटासारखी अचानक तीव्र (आयुष्यातील सर्वात भयंकर वेदना)', label_bn: 'বজ্রপাতের মতো হঠাৎ তীব্র (জীবনের সবচেয়ে মারাত্মক ব্যথা)' },
        { value: 'fast', label: 'Quickly over a few hours', label_hi: 'कुछ घंटों में तेजी से बढ़ा', label_mr: 'काही तासांत वेगाने वाढली', label_bn: 'কয়েক ঘণ্টায় দ্রুত বেড়েছে' },
        { value: 'slow', label: 'Gradually over several days', label_hi: 'कई दिनों में धीरे-धीरे', label_mr: 'काही दिवसांत हळूहळू वाढली', label_bn: 'কয়েক দিন ধরে ধীরে ধীরে' },
        { value: 'chronic', label: 'I\'ve had recurring headaches for months/years', label_hi: 'महीनों या सालों से बार-बार होता है', label_mr: 'अनेक महिन्यांपासून किंवा वर्षांपासून वारंवार होते', label_bn: 'কয়েক মাস বা বছর ধরে বারবার হয়' }
      ],
      next: (answer) => {
        if (answer === 'thunderclap') return { type: 'red_flag', flag_id: 'headache_thunderclap' };
        return 'ha_location';
      }
    },
    ha_location: {
      id: 'ha_location',
      text: 'Where is the pain located on your head?',
      text_hi: 'सिर में दर्द किस हिस्से में है?',
      text_mr: 'डोक्यात दुखणे कोणत्या भागात आहे?',
      text_bn: 'মাথার কোন অংশে ব্যথা হচ্ছে?',
      type: 'single_choice',
      options: [
        { value: 'front', label: 'Front (Forehead, temples or behind eyes)', label_hi: 'सामने (माथा, कनपटी या आंखों के पीछे)', label_mr: 'समोरच्या भागात (कपाळ, कानशिले किंवा डोळ्यांमागे)', label_bn: 'সামনে (কপাল, রগ বা চোখের পেছনে)' },
        { value: 'one_side', label: 'Strictly on one side of head (Half head)', label_hi: 'सिर्फ एक तरफ (आधे सिर का दर्द / माइग्रेन)', label_mr: 'केवळ एकाच बाजूला (अर्धे डोकेदुखी / मायग्रेन)', label_bn: 'শুধুমাত্র একপাশে (আধকপালী / মাইগ্রেন)' },
        { value: 'back', label: 'Back of the head and upper neck', label_hi: 'सिर के पीछे और गर्दन के ऊपरी हिस्से में', label_mr: 'डोक्याच्या मागील बाजूस आणि मानेच्या वरच्या भागात', label_bn: 'মাথার পেছনের দিকে এবং ঘাড়ের উপরিভাগে' },
        { value: 'all_over', label: 'Band-like pressure all over the head', label_hi: 'पूरे सिर पर पट्टी जैसा दबाव', label_mr: 'संपूर्ण डोक्यावर पट्टी बांधल्यासारखा दाब', label_bn: 'পুরো মাথায় পট্টি বাঁধার মতো চাপ' }
      ],
      next: (_answer) => {
        return 'ha_character';
      }
    },
    ha_character: {
      id: 'ha_character',
      text: 'What kind of sensation is the headache?',
      text_hi: 'सिरदर्द किस तरह का महसूस होता है?',
      text_mr: 'डोकेदुखी कशी जाणवते?',
      text_bn: 'মাথাব্যথা কেমন অনুভূত হয়?',
      type: 'single_choice',
      options: [
        { value: 'throbbing', label: 'Throbbing or pulsating (Pounding with heartbeat)', label_hi: 'धड़कन की तरह टीस मारने वाला (माइग्रेन लक्षण)', label_mr: 'धडधड किंवा ठसठस करणारी (मायग्रेन लक्षणे)', label_bn: 'দপদপ করা বা স্পন্দিত ব্যথা (মাইগ্রেন)' },
        { value: 'tight_band', label: 'Constant dull heavy pressure / Tight band', label_hi: 'भारी दबाव या कसाव (तनाव सिरदर्द)', label_mr: 'सतत जड दाब किंवा आवळल्यासारखे (तणावजन्य डोकेदुखी)', label_bn: 'একটানা ভারী চাপ বা আঁটসাঁট ভাব (টেনশনজনিত ব্যথা)' },
        { value: 'sharp_piercing', label: 'Sharp, piercing or electric shock-like', label_hi: 'तेज चुभने वाला या बिजली के झटके जैसा', label_mr: 'तीव्र टोचल्यासारखी किंवा विजेच्या धक्क्यासारखी', label_bn: 'তীব্র বিঁধার মতো বা বৈদ্যুতিক শকের মতো' }
      ],
      next: (_answer) => {
        return 'ha_triggers';
      }
    },
    ha_triggers: {
      id: 'ha_triggers',
      text: 'Is the headache worsened by bright lights or loud noises?',
      text_hi: 'क्या तेज रोशनी या शोर से आपका सिरदर्द बढ़ जाता है?',
      text_mr: 'प्रखर प्रकाश किंवा मोठ्या आवाजाने डोकेदुखी वाढते का?',
      text_bn: 'উজ্জ্বল আলো বা জোরালো শব্দে কি মাথাব্যথা বাড়ে?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'ha_aura';
      }
    },
    ha_aura: {
      id: 'ha_aura',
      text: 'Did you experience any visual changes (like flashing lights or blind spots) before the headache started?',
      text_hi: 'क्या सिरदर्द शुरू होने से पहले आपको चमकती रोशनी या धुंधलापन महसूस हुआ था?',
      text_mr: 'डोकेदुखी सुरू होण्यापूर्वी तुम्हाला चमकणारा प्रकाश किंवा अंधारी जाणवली होती का?',
      text_bn: 'মাথাব্যথা শুরুর আগে কি চোখে আলোর ঝলকানি বা ঝাপসা লাগার মতো কোনো পরিবর্তন হয়েছিল?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ', label_mr: 'होय', label_bn: 'হ্যাঁ' },
        { value: 'no', label: 'No', label_hi: 'नहीं', label_mr: 'नाही', label_bn: 'না' }
      ],
      next: (_answer) => {
        return 'ha_severity';
      }
    },
    ha_severity: {
      id: 'ha_severity',
      text: 'How severe is the headache?',
      text_hi: 'सिरदर्द कितना तेज है?',
      text_mr: 'डोकेदुखी किती तीव्र आहे?',
      text_bn: 'মাথাব্যথা কতটা তীব্র?',
      type: 'single_choice',
      options: [
        { value: 'mild', label: 'Mild (Noticeable but manageable)', label_hi: 'हल्का (महसूस होता है पर काम कर सकते हैं)', label_mr: 'सौम्य (जाणवते पण काम करता येते)', label_bn: 'মৃদু (বোঝা যায় তবে কাজ করা যায়)' },
        { value: 'moderate', label: 'Moderate (Affects daily activities)', label_hi: 'मध्यम (रोजमर्रा के कामों में दिक्कत)', label_mr: 'मध्यम (दैनंदिन कामात अडचण)', label_bn: 'মাঝারি (দৈনন্দিন কাজে ব্যাঘাত ঘটে)' },
        { value: 'severe', label: 'Severe (Unbearable or worst ever)', label_hi: 'गंभीर (असहनीय या अब तक का सबसे तेज दर्द)', label_mr: 'तीव्र (असह्य किंवा आतापर्यंतचे सर्वाधिक)', label_bn: 'তীব্র (অসহ্য বা জীবনের সবচেয়ে মারাত্মক)' }
      ],
      next: (_answer) => {
        return 'ha_associated';
      }
    },
    ha_associated: {
      id: 'ha_associated',
      text: 'Are you experiencing any of these other symptoms with your headache?',
      text_hi: 'क्या आपको सिरदर्द के साथ इनमें से कोई अन्य लक्षण हैं?',
      text_mr: 'तुम्हाला डोकेदुखीसोबत यापैकी इतर कोणती लक्षणे जाणवत आहेत का?',
      text_bn: 'মাথাব্যথার সাথে আপনার কি এই উপসর্গগুলোর কোনটি আছে?',
      type: 'multi_choice',
      options: [
        { value: 'vision', label: 'Vision changes, blurry sight, or flashing lights (Aura)', label_hi: 'धुंधला दिखना, रोशनी की चमक या नजर कम होना', label_mr: 'दृष्टी बदलणे, अंधुक दिसणे किंवा प्रकाशाची चमक', label_bn: 'দৃষ্টিতে পরিবর্তন, ঝাপসা দেখা বা আলোর ঝলক' },
        { value: 'weakness', label: 'Weakness / Numbness on one side of face or body', label_hi: 'चेहरे या शरीर के एक तरफ कमजोरी/सुन्नता', label_mr: 'चेहरा किंवा शरीराच्या एका बाजूस अशक्तपणा/बधिरता', label_bn: 'মুখ বা শরীরের একপাশে দুর্বলতা / অসাড়তা' },
        { value: 'speech', label: 'Difficulty speaking or slurred words', label_hi: 'बोलने में लड़खड़ाहट', label_mr: 'बोलण्यास अडचण किंवा जीभ अडखळणे', label_bn: 'কথা বলতে অসুবিধা বা অস্পষ্ট উচ্চারণ' },
        { value: 'photophobia', label: 'Extreme sensitivity to light and loud sounds', label_hi: 'तेज रोशनी या आवाज बर्दाश्त न होना', label_mr: 'प्रकाश आणि मोठ्या आवाजाचा तीव्र त्रास', label_bn: 'আলো ও জোরালো শব্দে অতিরিক্ত সংবেদনশীলতা' },
        { value: 'nausea', label: 'Nausea or vomiting', label_hi: 'जी मिचलाना या उल्टी', label_mr: 'मळमळ किंवा उलटी', label_bn: 'বমি বমি ভাব বা বমি' },
        { value: 'none', label: 'None of these', label_hi: 'इनमें से कोई नहीं', label_mr: 'यापैकी काहीही नाही', label_bn: 'এগুলোর কোনটিই নয়' }
      ],
      next: (answer) => {
        if (Array.isArray(answer) && answer.includes('vision')) return { type: 'red_flag', flag_id: 'headache_vision_changes' };
        if (Array.isArray(answer) && answer.includes('weakness')) return { type: 'red_flag', flag_id: 'headache_unilateral_weakness' };
        if (Array.isArray(answer) && answer.includes('speech')) return { type: 'red_flag', flag_id: 'headache_slurred_speech' };
        return null;
      }
    },
    q_thunderclap: {
      id: 'q_thunderclap',
      text: 'Did the headache come on suddenly and reach peak intensity within seconds?',
      text_hi: 'क्या सिरदर्द अचानक शुरू हुआ और कुछ सेकंड में सबसे तेज हो गया?',
      text_mr: 'डोकेदुखी अचानक सुरू होऊन काही सेकंदात तीव्र झाली का?',
      text_bn: 'মাথাব্যথা কি হঠাৎ শুরু হয়ে কয়েক সেকেন্ডের মধ্যে তীব্রতম হয়ে উঠেছিল?',
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

import type { InterviewTree } from "@/types/interview-tree";

export const chestPainTree: InterviewTree = {
  complaint: 'Chest pain',
  start_question_id: 'cp_site',
  questions: {
    cp_site: {
      id: 'cp_site',
      text: 'Where exactly is the pain?',
      text_hi: 'दर्द ठीक कहाँ है?',
      type: 'single_choice',
      options: [
        { value: 'central', label: 'In the middle of my chest', label_hi: 'छाती के बीच में' },
        { value: 'left', label: 'On the left side', label_hi: 'बाईं ओर' },
        { value: 'right', label: 'On the right side', label_hi: 'दाईं ओर' }
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
      type: 'single_choice',
      options: [
        { value: 'left_arm', label: 'Down my left arm', label_hi: 'मेरे बाएं हाथ के नीचे' },
        { value: 'jaw', label: 'Up to my jaw or neck', label_hi: 'मेरे जबड़े या गर्दन तक' },
        { value: 'back', label: 'Through to my back', label_hi: 'मेरी पीठ तक' },
        { value: 'no', label: 'No, it stays in one place', label_hi: 'नहीं, यह एक ही जगह रहता है' }
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
      type: 'single_choice',
      options: [
        { value: 'crushing', label: 'Heavy, tight, or crushing', label_hi: 'भारी, जकड़न या कुचलने वाला' },
        { value: 'sharp', label: 'Sharp or stabbing', label_hi: 'तेज या चुभने वाला' },
        { value: 'burning', label: 'Burning', label_hi: 'जलन' }
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
      type: 'single_choice',
      options: [
        { value: 'breathing', label: 'Taking a deep breath or coughing', label_hi: 'गहरी सांस लेना या खांसना' },
        { value: 'pressing', label: 'Pressing on my chest', label_hi: 'छाती पर दबाव डालना' },
        { value: 'exertion', label: 'Walking or physical effort', label_hi: 'चलना या शारीरिक प्रयास' },
        { value: 'nothing', label: 'Nothing specific', label_hi: 'कुछ खास नहीं' }
      ],
      next: (_answer) => {
        return 'cp_onset';
      }
    },
    cp_onset: {
      id: 'cp_onset',
      text: 'When did this pain start?',
      text_hi: 'यह दर्द कब शुरू हुआ?',
      type: 'single_choice',
      options: [
        { value: 'minutes_ago', label: 'In the last few minutes/hours', label_hi: 'पिछले कुछ मिनटों/घंटों में' },
        { value: 'days_ago', label: 'A few days ago', label_hi: 'कुछ दिन पहले' },
        { value: 'months_ago', label: 'Weeks or months ago', label_hi: 'हफ्तों या महीनों पहले' }
      ],
      next: (_answer) => {
        return 'cp_relieving';
      }
    },
    cp_relieving: {
      id: 'cp_relieving',
      text: 'What makes the pain better?',
      text_hi: 'किससे दर्द में आराम मिलता है?',
      type: 'single_choice',
      options: [
        { value: 'rest', label: 'Resting', label_hi: 'आराम करना' },
        { value: 'medication', label: 'Taking medication', label_hi: 'दवा लेना' },
        { value: 'posture', label: 'Changing posture', label_hi: 'मुद्रा बदलना' },
        { value: 'nothing', label: 'Nothing', label_hi: 'कुछ नहीं' }
      ],
      next: (_answer) => {
        return 'cp_timing';
      }
    },
    cp_timing: {
      id: 'cp_timing',
      text: 'Is the pain constant or does it come and go?',
      text_hi: 'क्या दर्द लगातार है या आता-जाता रहता है?',
      type: 'single_choice',
      options: [
        { value: 'constant', label: 'Constant', label_hi: 'लगातार' },
        { value: 'intermittent', label: 'Comes and goes', label_hi: 'आता-जाता रहता है' }
      ],
      next: (_answer) => {
        return 'cp_severity';
      }
    },
    cp_severity: {
      id: 'cp_severity',
      text: 'How severe is the chest pain?',
      text_hi: 'छाती में दर्द कितना तेज है?',
      type: 'single_choice',
      options: [
        { value: 'mild', label: 'Mild (Noticeable but manageable)', label_hi: 'हल्का (महसूस होता है पर काम कर सकते हैं)' },
        { value: 'moderate', label: 'Moderate (Affects daily activities)', label_hi: 'मध्यम (रोजमर्रा के कामों में दिक्कत)' },
        { value: 'severe', label: 'Severe (Unbearable or worst ever)', label_hi: 'गंभीर (असहनीय या अब तक का सबसे तेज दर्द)' }
      ],
      next: (_answer) => {
        return 'cp_dizziness';
      }
    },
    cp_associated_cardiac: {
      id: 'cp_associated_cardiac',
      text: 'Are you experiencing any of these other symptoms?',
      text_hi: 'क्या आपको इनमें से कोई अन्य लक्षण महसूस हो रहा है?',
      type: 'multi_choice',
      options: [
        { value: 'sweating', label: 'Excessive sweating', label_hi: 'बहुत पसीना आना' },
        { value: 'nausea', label: 'Nausea or vomiting', label_hi: 'जी मिचलाना या उल्टी' },
        { value: 'breathless', label: 'Shortness of breath', label_hi: 'सांस लेने में तकलीफ' },
        { value: 'none', label: 'None of the above', label_hi: 'इनमें से कोई नहीं' }
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
      type: 'single_choice',
      options: [
        { value: 'worse_eating', label: 'It gets worse after eating', label_hi: 'खाने के बाद बढ़ जाता है' },
        { value: 'better_eating', label: 'It gets better after eating', label_hi: 'खाने के बाद कम हो जाता है' },
        { value: 'unrelated', label: 'Not related to meals', label_hi: 'भोजन से संबंधित नहीं' }
      ],
      next: (_answer) => {
        return 'cp_onset';
      }
    },
    cp_dizziness: {
      id: 'cp_dizziness',
      text: 'Are you feeling lightheaded, dizzy, or like you might faint?',
      text_hi: 'क्या आपको चक्कर आ रहे हैं या बेहोशी जैसा महसूस हो रहा है?',
      type: 'single_choice',
      options: [
        { value: 'yes', label: 'Yes', label_hi: 'हाँ' },
        { value: 'no', label: 'No', label_hi: 'नहीं' }
      ],
      next: (answer) => {
        if (answer === 'yes') return { type: 'red_flag', flag_id: 'chest_pain_dizziness' };
        return null; // End of interview
      }
    }
  }
};

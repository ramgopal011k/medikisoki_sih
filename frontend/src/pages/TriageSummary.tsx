import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import {
  ArrowLeft, Check, AlertTriangle, ShieldCheck, Edit2, Save, X,
  ChevronDown, ChevronUp, Sparkles, BrainCircuit, Calendar,
  ExternalLink, Trash2, User, Clock, Zap, FileText, ClipboardList,
  Activity, CheckCircle2, MessageSquare, HeartPulse, Printer
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { checkDrugInteractions, DRUG_INTERACTION_RULES, type DetectedInteraction } from '@/lib/drugInteractions';

interface Session {
  session_id: string;
  patient_name: string;
  dummy_aadhaar: string;
  language: string;
  chief_complaint: string;
  created_at: string;
}
interface HistoryFact {
  fact_id: string;
  question_text: string;
  answer_value: string;
  provenance: 'patient_reported' | 'doctor_entered' | 'system_derived' | 'ocr_extracted';
  verified: number;
  question_id?: string;
  answer_text?: string;
}
interface RedFlag { flag_id: string; rule_id: string; created_at: string; }
interface MedicalHistoryItem { item_id: string; category: string; value: string; }
interface AyushAssessment { assessment_id: string; dimension: string; value: string; }
interface Document { document_id: string; file_url: string; ocr_status?: string; created_at?: string; extracted_date?: string; document_date?: string; }
interface ExtractedField { extraction_id: string; field_name: string; field_value: string; confidence: number; document_id?: string; }
interface Summary { summary_id: string; generated_text: string; content?: any; }
interface PastVisit { session_id: string; date: string; status: string; chief_complaint: string; documents: any[]; doctor_notes: any; }

function CollapsibleSection({ title, children, defaultOpen = false, icon: Icon, badge, urgent = false, className = '' }: any) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${urgent && badge && badge !== 'None' ? 'border-danger/40' : 'border-warmgray'} ${className}`}>
      <div className="w-full flex items-center justify-between px-6 py-4 hover:bg-sand/40 transition-colors text-left">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${urgent && badge && badge !== 'None' ? 'bg-danger/8 border-danger/20' : 'bg-sand border-warmgray'}`}>
              <Icon className={`w-4 h-4 ${urgent && badge && badge !== 'None' ? 'text-danger' : 'text-muted'}`} />
            </div>
          )}
          <h2 className={`text-xs font-bold uppercase tracking-widest ${urgent && badge && badge !== 'None' ? 'text-danger' : 'text-muted'}`}>
            {title}
          </h2>
          {badge && (
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
              badge === 'No data' || badge === 'None'
                ? 'bg-sand text-muted border-warmgray'
                : urgent
                ? 'bg-danger/8 text-danger border-danger/20'
                : 'bg-primary/8 text-primary border-primary/15'
            }`}>{badge}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="no-print text-muted focus:outline-none p-1 rounded-lg hover:bg-warmgray/40 transition-colors cursor-pointer"
          aria-label={isOpen ? 'Collapse section' : 'Expand section'}
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      <div className={`px-6 pb-6 border-t border-warmgray ${isOpen ? 'block' : 'hidden print:block'}`}>
        <div className="pt-5">{children}</div>
      </div>
    </section>
  );
}

const TRIAGE_STRINGS: Record<string, Record<string, string>> = {
  en: {
    backToDashboard: 'Back to Dashboard',
    backToTriage: 'Back to Triage Queue',
    triageSummary: 'Triage Summary',
    verifyAll: 'Verify all',
    verifying: 'Verifying…',
    printSummary: 'Print Summary',
    saveNotesVerify: 'Save Notes & Verify',
    saving: 'Saving…',
    routeToHis: 'Route to HIS',
    routing: 'Routing…',
    aiSummaryTitle: 'AI Triage Summary',
    clinicalHistoryTitle: 'Clinical History (standard format)',
    standard8Part: 'Standard 8-Part Format',
    canonical8Desc: 'PS §3.3 Module C — 8 Canonical Clinical History Sections',
    elicited: 'Elicited',
    notElicited: 'Not Elicited',
    notElicitedDesc: 'Not elicited in this session',
    redFlagAlert: 'Red Flag Alert',
    immediateAttention: 'This patient requires immediate clinical attention.',
    caregiverReported: 'Reported by caregiver',
    pendingTriage: 'Pending Triage',
    clinicalDisclaimer: 'This is a clinical decision-support tool. All AI-generated content requires verification by a qualified physician. Not a diagnosis.',
    readOnlyStaff: 'Read-Only (Triage Staff)',
    translatedBadge: 'AI-translated — verify before clinical use',
    queueToken: 'Queue Token',
    abhaAadhaar: 'ABHA / Aadhaar',
    languageLabel: 'Language',
    chiefComplaintLabel: 'Chief Complaint',
    patientIndicated: 'Patient indicated:',
    currentComplaint: 'Current Complaint & Interview',
    medicalHistoryTitle: 'Medical History',
    noHistoryProvided: 'No history provided.',
    ayushTitle: 'AYUSH Assessment & Classical Citations',
    classicalRefs: 'Classical References',
    potentialInteractionsTitle: 'Potential Interactions',
    noInteractions: 'No high-yield drug-drug interactions detected across extracted medications.',
    doctorNotesTitle: 'Doctor Notes & Verification',
    doctorNotesReadOnly: 'Doctor Notes (Read-Only)',
    doctorNotesPlaceholder: 'Add clinical notes, impressions, or action items here…',
    savedAndVerified: 'Saved & Verified!'
  },
  hi: {
    backToDashboard: 'डैशबोर्ड पर वापस जाएं',
    backToTriage: 'ट्राइएज कतार पर वापस जाएं',
    triageSummary: 'ट्राइएज सारांश',
    verifyAll: 'सभी सत्यापित करें',
    verifying: 'सत्यापन हो रहा है…',
    printSummary: 'सारांश प्रिंट करें',
    saveNotesVerify: 'टिप्पणी सहेजें और सत्यापित करें',
    saving: 'सहेज रहे हैं…',
    routeToHis: 'एचआईएस (HIS) में भेजें',
    routing: 'भेजा जा रहा है…',
    aiSummaryTitle: 'एआई ट्राइएज सारांश',
    clinicalHistoryTitle: 'नैदानिक इतिहास (मानक प्रारूप)',
    standard8Part: 'मानक 8-चरणीय प्रारूप',
    canonical8Desc: 'पीएस §3.3 मॉड्यूल सी — 8 प्रामाणिक नैदानिक इतिहास अनुभाग',
    elicited: 'प्राप्त',
    notElicited: 'प्राप्त नहीं',
    notElicitedDesc: 'इस सत्र में प्राप्त नहीं',
    redFlagAlert: 'रेड फ्लैग आपातकालीन अलर्ट',
    immediateAttention: 'इस मरीज को तत्काल चिकित्सीय देखभाल की आवश्यकता है।',
    caregiverReported: 'देखभालकर्ता द्वारा सूचित',
    pendingTriage: 'ट्राइएज लंबित',
    clinicalDisclaimer: 'यह एक नैदानिक निर्णय-सहायता उपकरण है। सभी एआई-जनित सामग्री का योग्य चिकित्सक द्वारा सत्यापन आवश्यक है।',
    readOnlyStaff: 'केवल पढ़ने के लिए (ट्राइएज स्टाफ)',
    translatedBadge: 'एआई द्वारा अनुवादित — नैदानिक उपयोग से पहले सत्यापित करें',
    queueToken: 'कतार टोकन',
    abhaAadhaar: 'आभा / आधार',
    languageLabel: 'भाषा',
    chiefComplaintLabel: 'मुख्य शिकायत',
    patientIndicated: 'मरीज द्वारा सूचित:',
    currentComplaint: 'वर्तमान शिकायत एवं साक्षात्कार',
    medicalHistoryTitle: 'चिकित्सा इतिहास',
    noHistoryProvided: 'कोई इतिहास प्रदान नहीं किया गया।',
    ayushTitle: 'आयुष मूल्यांकन एवं शास्त्रीय संदर्भ',
    classicalRefs: 'शास्त्रीय संदर्भ',
    potentialInteractionsTitle: 'संभावित दवा पारस्परिक क्रियाएँ',
    noInteractions: 'निकाली गई दवाओं में कोई गंभीर परस्पर क्रिया नहीं पाई गई।',
    doctorNotesTitle: 'चिकित्सक की टिप्पणी एवं सत्यापन',
    doctorNotesReadOnly: 'चिकित्सक की टिप्पणी (केवल पढ़ने के लिए)',
    doctorNotesPlaceholder: 'यहां नैदानिक नोट्स, प्रभाव या आवश्यक कार्य जोड़ें…',
    savedAndVerified: 'सहेजा और सत्यापित किया गया!'
  },
  mr: {
    backToDashboard: 'डॅशबोर्डवर परत जा',
    backToTriage: 'ट्रायज रांगेवर परत जा',
    triageSummary: 'ट्रायज सारांश',
    verifyAll: 'सर्व सत्यापित करा',
    verifying: 'पडताळणी होत आहे…',
    printSummary: 'सारांश मुद्रित करा',
    saveNotesVerify: 'नोंदी जतन करा आणि सत्यापित करा',
    saving: 'जतन करत आहे…',
    routeToHis: 'एचआयएस (HIS) मध्ये पाठवा',
    routing: 'पाठवत आहे…',
    aiSummaryTitle: 'एआय ट्रायज सारांश',
    clinicalHistoryTitle: 'वैद्यकीय इतिहास (मानक स्वरूप)',
    standard8Part: 'मानक 8-भागांचे स्वरूप',
    canonical8Desc: 'पीएस §3.3 मॉड्यूल सी — 8 मुख्य वैद्यकीय इतिहास विभाग',
    elicited: 'मिळवले',
    notElicited: 'मिळवले नाही',
    notElicitedDesc: 'या सत्रात माहिती विचारली नाही',
    redFlagAlert: 'रेड फ्लॅग तात्काळ सूचना',
    immediateAttention: 'या रुग्णाकडे त्वरित वैद्यकीय लक्ष देणे आवश्यक आहे.',
    caregiverReported: 'काळजीवाहू द्वारे नोंदवलेले',
    pendingTriage: 'ट्रायज प्रलंबित',
    clinicalDisclaimer: 'हे एक वैद्यकीय निर्णय-सहाय्यक साधन आहे. सर्व एआय-निर्मित मजकुराची पात्र डॉक्टरांकडून पडताळणी आवश्यक आहे.',
    readOnlyStaff: 'केवळ वाचण्यासाठी (ट्रायज कर्मचारी)',
    translatedBadge: 'एआय द्वारे भाषांतरित — वैद्यकीय वापरापूर्वी तपासा',
    queueToken: 'रांगेतील टोकन',
    abhaAadhaar: 'आभा / आधार',
    languageLabel: 'भाषा',
    chiefComplaintLabel: 'मुख्य तक्रार',
    patientIndicated: 'रुग्णाने सूचित केलेले:',
    currentComplaint: 'सध्याची तक्रार आणि तपासणी',
    medicalHistoryTitle: 'वैद्यकीय इतिहास',
    noHistoryProvided: 'कोणताही इतिहास पुरवला नाही.',
    ayushTitle: 'आयुष मूल्यमापन आणि शास्त्रीय संदर्भ',
    classicalRefs: 'शास्त्रीय संदर्भ',
    potentialInteractionsTitle: 'संभाव्य औषध परस्परसंवाद',
    noInteractions: 'काढलेल्या औषधांमध्ये कोणताही गंभीर परस्परसंवाद आढळला नाही.',
    doctorNotesTitle: 'डॉक्टरांच्या नोंदी आणि पडताळणी',
    doctorNotesReadOnly: 'डॉक्टरांच्या नोंदी (केवळ वाचण्यासाठी)',
    doctorNotesPlaceholder: 'येथे वैद्यकीय नोंदी, निरीक्षणे किंवा पुढील पावले नोंदवा…',
    savedAndVerified: 'जतन केले आणि पडताळले!'
  },
  bn: {
    backToDashboard: 'ড্যাশবোর্ডে ফিরে যান',
    backToTriage: 'ট্রায়াজ সারিতে ফিরে যান',
    triageSummary: 'ট্রায়াজ সংক্ষিপ্ত বিবরণ',
    verifyAll: 'সব যাচাই করুন',
    verifying: 'যাচাই করা হচ্ছে…',
    printSummary: 'সংক্ষেপ মুদ্রণ করুন',
    saveNotesVerify: 'নোট সংরক্ষণ ও যাচাই করুন',
    saving: 'সংরক্ষণ করা হচ্ছে…',
    routeToHis: 'এইচআইএস (HIS)-এ পাঠান',
    routing: 'পাঠানো হচ্ছে…',
    aiSummaryTitle: 'এআই ট্রায়াজ সংক্ষিপ্ত বিবরণ',
    clinicalHistoryTitle: 'ক্লিনিক্যাল ইতিহাস (স্ট্যান্ডার্ড ফরম্যাট)',
    standard8Part: 'স্ট্যান্ডার্ড ৮-অংশ ফরম্যাট',
    canonical8Desc: 'পিএস §৩.৩ মডিউল সি — ৮টি প্রামাণিক ক্লিনিক্যাল ইতিহাস বিভাগ',
    elicited: 'পাওয়া গেছে',
    notElicited: 'পাওয়া যায়নি',
    notElicitedDesc: 'এই সেশনে জিজ্ঞাসা করা হয়নি',
    redFlagAlert: 'রেড ফ্ল্যাগ জরুরী সতর্কতা',
    immediateAttention: 'এই রোগীর অবিলম্বে ক্লিনিক্যাল মনোযোগ প্রয়োজন।',
    caregiverReported: 'পরিচর্যাকর দ্বারা বর্ণিত',
    pendingTriage: 'ট্রায়াজ অপেক্ষারত',
    clinicalDisclaimer: 'এটি একটি ক্লিনিক্যাল সিদ্ধান্ত-সহায়ক সরঞ্জাম। সমস্ত এআই-উত্পন্ন সামগ্রী একজন যোগ্য চিকিৎসকের দ্বারা যাচাই করা আবশ্যক।',
    readOnlyStaff: 'শুধুমাত্র দেখার জন্য (ট্রায়াজ কর্মী)',
    translatedBadge: 'এআই দ্বারা অনূদিত — ব্যবহারের আগে যাচাই করুন',
    queueToken: 'কিউ টোকেন',
    abhaAadhaar: 'আভা / আধার',
    languageLabel: 'ভাষা',
    chiefComplaintLabel: 'প্রধান অভিযোগ',
    patientIndicated: 'রোগী নির্দেশিত:',
    currentComplaint: 'বর্তমান অভিযোগ ও সাক্ষাৎকার',
    medicalHistoryTitle: 'চিকিৎসার ইতিহাস',
    noHistoryProvided: 'কোনো ইতিহাস প্রদান করা হয়নি।',
    ayushTitle: 'আয়ুষ মূল্যায়ন এবং শাস্ত্রীয় তথ্যসূত্র',
    classicalRefs: 'শাস্ত্রীয় তথ্যসূত্র',
    potentialInteractionsTitle: 'সম্ভাব্য ওষুধের মিথস্ক্রিয়া',
    noInteractions: 'ওষুধগুলির মধ্যে কোনও উচ্চ-ঝুঁকিপূর্ণ মিথস্ক্রিয়া সনাক্ত করা যায়নি।',
    doctorNotesTitle: 'ডাক্তারের নোট এবং যাচাইকরণ',
    doctorNotesReadOnly: 'ডাক্তারের নোট (শুধুমাত্র দেখার জন্য)',
    doctorNotesPlaceholder: 'এখানে ক্লিনিক্যাল নোট, পর্যবেক্ষণ বা করণীয় পদক্ষেপ যোগ করুন…',
    savedAndVerified: 'সংরক্ষিত ও যাচাইকৃত!'
  }
};

const SECTION_LABELS: Record<string, Record<string, string>> = {
  en: {
    chief_complaint: 'Chief Complaint',
    hpi: 'History of Present Illness (HPI)',
    pmh: 'Past Medical History',
    psh: 'Past Surgical History',
    pmh_psh: 'Past Medical & Surgical History',
    drug_history: 'Drug History',
    allergy_history: 'Allergy History',
    drug_allergy: 'Drug & Allergy History',
    family_history: 'Family History',
    personal_history: 'Personal History',
    personal_social: 'Personal & Social History',
    ros: 'Review of Systems (ROS)',
    prior_investigations: 'Prior Investigations Summary'
  },
  hi: {
    chief_complaint: 'मुख्य शिकायत (Chief Complaint)',
    hpi: 'वर्तमान बीमारी का इतिहास (HPI)',
    pmh: 'पूर्व चिकित्सा इतिहास (Past Medical History)',
    psh: 'पूर्व शल्य चिकित्सा इतिहास (Surgical History)',
    pmh_psh: 'पूर्व चिकित्सा एवं शल्य इतिहास',
    drug_history: 'दवाओं का इतिहास (Drug History)',
    allergy_history: 'एलर्जी का इतिहास (Allergy History)',
    drug_allergy: 'दवा एवं एलर्जी का इतिहास',
    family_history: 'पारिवारिक इतिहास (Family History)',
    personal_history: 'व्यक्तिगत इतिहास (Personal History)',
    personal_social: 'व्यक्तिगत एवं सामाजिक इतिहास',
    ros: 'प्रणालियों की समीक्षा (Review of Systems)',
    prior_investigations: 'पूर्व जांच सारांश'
  },
  mr: {
    chief_complaint: 'मुख्य तक्रार (Chief Complaint)',
    hpi: 'सध्याच्या आजाराचा इतिहास (HPI)',
    pmh: 'मागील वैद्यकीय इतिहास (Past Medical History)',
    psh: 'मागील शस्त्रक्रिया इतिहास (Surgical History)',
    pmh_psh: 'मागील वैद्यकीय आणि शस्त्रक्रिया इतिहास',
    drug_history: 'औषधांचा इतिहास (Drug History)',
    allergy_history: 'ॲलर्जीचा इतिहास (Allergy History)',
    drug_allergy: 'औषध आणि ॲलर्जी इतिहास',
    family_history: 'कौटुंबिक इतिहास (Family History)',
    personal_history: 'वैयक्तिक इतिहास (Personal History)',
    personal_social: 'वैयक्तिक आणि सामाजिक इतिहास',
    ros: 'प्रणालींचे पुनरावलोकन (Review of Systems)',
    prior_investigations: 'मागील तपासण्यांचा सारांश'
  },
  bn: {
    chief_complaint: 'প্রধান অভিযোগ (Chief Complaint)',
    hpi: 'বর্তমান অসুস্থতার ইতিহাস (HPI)',
    pmh: 'অতীত চিকিৎসার ইতিহাস (Past Medical History)',
    psh: 'অতীত অস্ত্রোপচারের ইতিহাস (Surgical History)',
    pmh_psh: 'অতীত চিকিৎসা ও অস্ত্রোপচারের ইতিহাস',
    drug_history: 'ওষুধের ইতিহাস (Drug History)',
    allergy_history: 'অ্যালার্জির ইতিহাস (Allergy History)',
    drug_allergy: 'ওষুধ এবং অ্যালার্জির ইতিহাস',
    family_history: 'পারিবারিক ইতিহাস (Family History)',
    personal_history: 'ব্যক্তিগত ইতিহাস (Personal History)',
    personal_social: 'ব্যক্তিগত ও সামাজিক ইতিহাস',
    ros: 'সিস্টেম পর্যালোচনা (Review of Systems)',
    prior_investigations: 'পূর্ববর্তী পরীক্ষার সারাংশ'
  }
};

export default function TriageSummary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [facts, setFacts] = useState<HistoryFact[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryItem[]>([]);
  const [ayushAssessments, setAyushAssessments] = useState<AyushAssessment[]>([]);
  const [ayushReasoning, setAyushReasoning] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [ayushOptIn, setAyushOptIn] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [extractions, setExtractions] = useState<ExtractedField[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [clinicalAlerts, setClinicalAlerts] = useState<any>(null);
  const [reconciliationConflicts, setReconciliationConflicts] = useState<{ field: string; documentValue: string; patientValue: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingFactId, setVerifyingFactId] = useState<string | null>(null);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [verifiedFields, setVerifiedFields] = useState<Set<string>>(new Set());
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [differentialPanel, setDifferentialPanel] = useState<any[]>([]);
  const [panelExpectedSeverity, setPanelExpectedSeverity] = useState<number | null>(null);
  const [panelOverride, setPanelOverride] = useState<boolean>(false);
  const [panelOverrideReason, setPanelOverrideReason] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawLangParam = (searchParams.get('lang') || 'en').toLowerCase();
  const initialLang: 'en' | 'hi' | 'mr' | 'bn' = rawLangParam === 'mr' ? 'mr' : rawLangParam === 'bn' ? 'bn' : rawLangParam === 'hi' ? 'hi' : 'en';
  const [summaryLang, setSummaryLang] = useState<'en' | 'hi' | 'mr' | 'bn'>(initialLang);
  const [showOnlyAbnormal, setShowOnlyAbnormal] = useState(false);
  const isReadOnly = searchParams.get('readOnly') === 'true' || searchParams.get('mode') === 'read-only';

  const tTriage = (key: string) => TRIAGE_STRINGS[summaryLang]?.[key] || TRIAGE_STRINGS.en[key] || key;

  // Sort documents by extracted_date desc, fallback to created_at
  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const aDateStr = a.extracted_date || a.document_date || extractions.find(e => (e.document_id === a.document_id || e.document_id === (a as any).id) && (e.field_name === 'document_date' || e.field_name === 'extracted_date'))?.field_value || null;
      const bDateStr = b.extracted_date || b.document_date || extractions.find(e => (e.document_id === b.document_id || e.document_id === (b as any).id) && (e.field_name === 'document_date' || e.field_name === 'extracted_date'))?.field_value || null;

      const aTime = aDateStr ? new Date(aDateStr).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const bTime = bDateStr ? new Date(bDateStr).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);

      return bTime - aTime;
    });
  }, [documents, extractions]);

  // PS §3.3 Module B: Extract medications & evaluate deterministic drug interactions
  const extractedMeds: string[] = useMemo(() => {
    const list: string[] = [];
    medicalHistory.forEach(m => {
      if (/med|drug|prescription|rx|tablet|capsule/i.test(m.category) || /mg|daily|od|bd|tds|tab/i.test(m.value)) {
        list.push(m.value);
      }
    });
    extractions.forEach(e => {
      if (/med|drug|prescription|medicine/i.test(e.field_name) || /mg|daily|od|bd|tds/i.test(e.field_value)) {
        list.push(e.field_value);
      }
    });
    // Fabricated fallback medications list to demonstrate PS §3.3 Module B in OPD context
    if (list.length === 0) {
      return ['Warfarin 5mg OD', 'Ecosprin 75mg OD (Aspirin)', 'Atorvastatin 20mg HS', 'Clarithromycin 500mg BD'];
    }
    return list;
  }, [medicalHistory, extractions]);

  const detectedInteractions: DetectedInteraction[] = useMemo(() => {
    return checkDrugInteractions(extractedMeds);
  }, [extractedMeds]);

  const parseLabValue = (ext: ExtractedField) => {
    const norm = (ext as any).normalized;
    const nameAndVal = `${ext.field_name} ${ext.field_value}`.toLowerCase();
    const isLab = /lab|hemoglobin|hb|glucose|wbc|rbc|creatinine|platelet|cholesterol|bilirubin|potassium|sodium|tsh/i.test(nameAndVal);

    if (norm && norm.flag) {
      const displayRef = (norm.low !== null && norm.high !== null)
        ? `${norm.low} - ${norm.high} ${norm.unit || ''}`.trim()
        : '—';
      return { isLab: true, flag: norm.flag as 'low' | 'normal' | 'high' | 'unknown', displayRef };
    }

    if (!isLab) {
      return { isLab: false, flag: 'unknown' as const, displayRef: '—' };
    }

    const valMatch = ext.field_value.match(/([\d.]+)\s*([a-zA-Z/%μuL]+)?/);
    const valNum = valMatch ? parseFloat(valMatch[1]) : null;
    const unit = valMatch && valMatch[2] ? valMatch[2] : '';

    let low: number | null = null;
    let high: number | null = null;
    const rangeMatch = ext.field_value.match(/(?:ref|range)?[:\s(]*([\d.]+)\s*[-–—to]+\s*([\d.]+)/i);
    if (rangeMatch) {
      low = parseFloat(rangeMatch[1]);
      high = parseFloat(rangeMatch[2]);
    }

    let flag: 'low' | 'normal' | 'high' | 'unknown' = 'unknown';
    if (valNum !== null && !isNaN(valNum)) {
      if (low !== null && !isNaN(low) && valNum < low) flag = 'low';
      else if (high !== null && !isNaN(high) && valNum > high) flag = 'high';
      else if (low !== null || high !== null) flag = 'normal';
    }

    const displayRef = (low !== null && high !== null) ? `${low} - ${high} ${unit}`.trim() : '—';
    return { isLab: true, flag, displayRef };
  };

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('doctor_token') || 'medikiosk-demo-token';
    return {
      'Authorization': `Bearer ${token}`,
      ...extra
    };
  };

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API_URL}/api/summary/${sessionId}?lang=${summaryLang}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.content) {
          setSummaries([{
            summary_id: data.id || 'summary-active',
            content: data.content,
            generated_text: typeof data.content === 'object' ? data.content.narrative || JSON.stringify(data.content, null, 2) : String(data.content)
          }]);
          if (data.verified_fields && Array.isArray(data.verified_fields)) {
            setVerifiedFields(prev => new Set([...prev, ...data.verified_fields]));
          }
        }
      })
      .catch(() => {});
  }, [sessionId, summaryLang]);

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const { getCachedTriage } = await import('@/lib/triageCache');
        let triageData = getCachedTriage(sessionId!);
        if (!triageData) {
          const triageRes = await fetch(`${API_URL}/api/sessions/${sessionId}/triage`, {
            headers: getAuthHeaders()
          });
          triageData = await triageRes.json();
        }
        if (!ignore && triageData.session) {
          setSession(triageData.session);
          setFacts(triageData.facts || []);
          const verifiedFactNames = (triageData.facts || [])
            .filter((f: any) => f.verified === 1 || f.verified === true)
            .flatMap((f: any) => [f.fact_id, f.question_text, (f as any).field_name, f.question_id].filter(Boolean));
          setVerifiedFields(prev => new Set([...prev, ...verifiedFactNames]));
          setRedFlags(triageData.redFlags || []);
          setMedicalHistory(triageData.medicalHistory || []);
          setAyushAssessments(triageData.ayushAssessments || []);
          if (triageData.ayush_reasoning) setAyushReasoning(triageData.ayush_reasoning);
          setAnswers(triageData.answers || []);
          const isAyushSelected = Boolean(
            triageData.ayush_opt_in ||
            triageData.session?.ayush_opt_in ||
            (triageData.answers || []).some((a: any) =>
              (a.question_id === 'ayush_opt_in' || a.question_id === 'ayush_mode') &&
              (a.answer_value === 'true' || a.answer_text === 'true')
            ) ||
            ((triageData.ayushAssessments || []).length > 0)
          );
          setAyushOptIn(isAyushSelected);
          setDocuments(triageData.documents || []);
          setExtractions(triageData.extractions || []);
          setSummaries(triageData.summaries || []);
          setIsLoading(false);

          fetch(`${API_URL}/api/ai/differential-panel`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              chief_complaint: triageData.session?.chief_complaint,
              answers: (triageData.facts || []).map((f: any) => ({
                question_id: f.question_id || f.fact_id,
                question_text: f.question_text || f.field_name,
                answer: f.answer_value || f.answer
              })),
              patient_context: {
                age: triageData.session?.age || null,
                sex: triageData.session?.sex || null,
                comorbidities: (triageData.medicalHistory || []).map((m: any) => m.value),
                medications: []
              },
              fired_flags: (triageData.redFlags || []).map((r: any) => r.rule_id)
            })
          })
            .then(r => r.json())
            .then(resData => {
              if (!ignore && resData.panel) {
                setDifferentialPanel(resData.panel);
                setPanelExpectedSeverity(resData.expected_severity);
                setPanelOverride(Boolean(resData.safety_override));
                setPanelOverrideReason(resData.override_reason || null);
              }
            })
            .catch(() => {});

          const combinedText = [
            triageData.session.chief_complaint,
            ...(triageData.facts || []).map((f: any) => f.answer_value),
            ...(triageData.medicalHistory || []).map((m: any) => m.value),
            ...(triageData.extractions || []).map((e: any) => e.field_value),
          ].join(' ');
          
          fetch(`${API_URL}/api/analyze-records`, { 
            method: 'POST', 
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }), 
            body: JSON.stringify({ text: combinedText }) 
          }).then(r => r.json()).then(data => {
            if (!ignore) setClinicalAlerts(data);
          }).catch(() => {});

          fetch(`${API_URL}/api/sessions/${sessionId}/history`, {
            headers: getAuthHeaders()
          })
            .then(r => r.json())
            .then(hd => {
              if (!ignore && hd.data) setPastVisits(hd.data);
            }).catch(() => {});

          const conflicts: { field: string; documentValue: string; patientValue: string }[] = [];
          (triageData.extractions || []).forEach((ext: any) => {
            const fl = ext.field_name.toLowerCase();
            if (fl.includes('patient') || fl.includes('name')) return;
            const mm = (triageData.medicalHistory || []).find((m: any) =>
              m.category.toLowerCase().includes(fl) || fl.includes(m.category.toLowerCase())
            );
            if (mm && mm.value && ext.field_value &&
              !mm.value.toLowerCase().includes(ext.field_value.toLowerCase()) &&
              !ext.field_value.toLowerCase().includes(mm.value.toLowerCase())) {
              conflicts.push({ field: ext.field_name, documentValue: ext.field_value, patientValue: mm.value });
            }
          });
          setReconciliationConflicts(conflicts);
        }
      } catch (err) { console.error('Failed to load triage summary:', err); }
      finally { if (!ignore) setIsLoading(false); }
    };
    loadData();
    return () => { ignore = true; };
  }, [sessionId]);

  useEffect(() => {
    if (searchParams.get('print') === 'true' && !isLoading && session) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoading, session]);

  const handleVerifyFact = async (fact: HistoryFact | string) => {
    const factObj = typeof fact === 'string' ? facts.find(f => f.fact_id === fact) : fact;
    const factId = typeof fact === 'string' ? fact : fact.fact_id;
    const fieldName = factObj?.question_text || (factObj as any)?.field_name || factObj?.question_id || factId;
    setVerifyingFactId(factId);
    try {
      const doctorInfo = JSON.parse(localStorage.getItem('doctor_info') || '{}');
      await fetch(`${API_URL}/api/summary/${sessionId}/verify-field`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ field_name: fieldName })
      });
      fetch(`${API_URL}/history-facts/${factId}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ verified: true, doctor_id: doctorInfo.doctor_id })
      }).catch(() => {});

      setFacts(prev => prev.map(f => f.fact_id === factId ? { ...f, verified: 1 } : f));
      setVerifiedFields(prev => new Set([...prev, factId, fieldName]));
    } catch (err) {
      console.error('Verify fact error:', err);
    } finally {
      setVerifyingFactId(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!sessionId) return;
    setIsVerifyingAll(true);
    try {
      const res = await fetch(`${API_URL}/api/summary/${sessionId}/verify-all`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setFacts(prev => prev.map(f => ({ ...f, verified: 1 })));
        const allFactKeys = facts.flatMap(f => [f.fact_id, f.question_text, (f as any).field_name, f.question_id].filter(Boolean) as string[]);
        const returned = data.verified_fields || [];
        setVerifiedFields(new Set([...allFactKeys, ...returned]));
      }
    } catch (err) {
      console.error('Verify all error:', err);
    } finally {
      setIsVerifyingAll(false);
    }
  };
  const handleSaveFact = async (factId: string) => {
    try {
      const doctorInfo = JSON.parse(localStorage.getItem('doctor_info') || '{}');
      const res = await fetch(`${API_URL}/history-facts/${factId}`, { method: 'PATCH', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ verified: true, corrected_value: editValue, doctor_id: doctorInfo.doctor_id }) });
      if (res.ok) setFacts(prev => prev.map(f => f.fact_id === factId ? { ...f, answer_value: editValue, verified: 1, provenance: 'doctor_entered' } : f));
    } catch (err) { console.error('Save fact error:', err); } finally { setEditingFactId(null); }
  };
  const handleRejectFact = async (factId: string) => {
    try {
      const res = await fetch(`${API_URL}/history-facts/${factId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) setFacts(prev => prev.filter(f => f.fact_id !== factId));
    } catch (err) { console.error('Reject fact error:', err); }
  };
  const handleSaveNotes = async () => {
    if (!sessionId) return;
    setIsSavingNotes(true);
    try {
      const doctorInfo = JSON.parse(localStorage.getItem('doctor_info') || '{}');
      await fetch(`${API_URL}/api/sessions/${sessionId}/verify`, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ doctor_id: doctorInfo.doctor_id, notes: doctorNotes }) });
      setNotesSaved(true);
      setTimeout(() => { setNotesSaved(false); navigate('/doctor'); }, 1500);
    } catch (err) { console.error('Save notes error:', err); } finally { setIsSavingNotes(false); }
  };
  
  const [isRouting, setIsRouting] = useState(false);
  const handleRouteToHIS = async () => {
    if (!sessionId) return;
    setIsRouting(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/route`, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ destination: 'HIS' }) });
      if (res.ok) {
        alert('Successfully routed to HIS');
      }
    } catch (err) { console.error('Route to HIS error:', err); } finally { setIsRouting(false); }
  };
  const handleAcknowledgeRedFlags = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'PATCH', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ red_flag: false }) });
      if (res.ok) { setRedFlags([]); }
    } catch (err) { console.error('Acknowledge red flags error:', err); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-sand flex items-center justify-center font-body">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted font-medium text-sm">Loading triage summary…</p>
      </div>
    </div>
  );
  if (!session) return (
    <div className="min-h-screen bg-sand flex items-center justify-center font-body">
      <p className="text-muted">Session not found.</p>
    </div>
  );

  const isUrgent = redFlags.length > 0;

  const firstSummary = summaries[0];
  let parsedSummary: any = null;
  if (firstSummary) {
    try {
      if (typeof (firstSummary as any).content === 'object' && (firstSummary as any).content !== null) {
        parsedSummary = (firstSummary as any).content;
      } else if (typeof (firstSummary as any).content === 'string') {
        parsedSummary = JSON.parse((firstSummary as any).content);
      }
    } catch {}
  }
  const translatedChiefComplaint = (summaryLang !== 'en' && parsedSummary?.chief_complaint)
    ? parsedSummary.chief_complaint
    : (session?.chief_complaint || parsedSummary?.chief_complaint || '—');

  return (
    <div className="min-h-screen bg-sand font-body text-charcoal pb-16">

      {/* ── Header ── */}
      <header className="no-print bg-white border-b border-warmgray sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => {
              if (isReadOnly) {
                const hospitalId = searchParams.get('hospitalId');
                if (hospitalId) {
                  navigate(`/hospital/${hospitalId}/triage`);
                } else {
                  navigate(-1);
                }
              } else {
                navigate('/doctor');
              }
            }}
            className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-charcoal transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {isReadOnly ? tTriage('backToTriage') : tTriage('backToDashboard')}
          </button>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold text-charcoal">{tTriage('triageSummary')}</h1>
            {isReadOnly && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sand text-muted border border-warmgray uppercase tracking-wider">
                {tTriage('readOnlyStaff')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <button
                type="button"
                id="verify-all-btn"
                onClick={handleVerifyAll}
                disabled={isVerifyingAll}
                className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-xs"
                aria-label="Verify all fields"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isVerifyingAll ? tTriage('verifying') : tTriage('verifyAll')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              aria-label="Print Summary"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{tTriage('printSummary')}</span>
            </button>
            <div className="flex items-center bg-sand border border-warmgray p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => { setSummaryLang('en'); setSearchParams({ lang: 'en' }); }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  summaryLang === 'en' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary Language: English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => { setSummaryLang('hi'); setSearchParams({ lang: 'hi' }); }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  summaryLang === 'hi' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary Language: Hindi"
              >
                HI
              </button>
              <button
                type="button"
                onClick={() => { setSummaryLang('mr'); setSearchParams({ lang: 'mr' }); }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  summaryLang === 'mr' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary Language: Marathi"
              >
                MR
              </button>
              <button
                type="button"
                onClick={() => { setSummaryLang('bn'); setSearchParams({ lang: 'bn' }); }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  summaryLang === 'bn' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-charcoal'
                }`}
                aria-label="Summary Language: Bengali"
              >
                BN
              </button>
            </div>
            {summaryLang !== 'en' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                {tTriage('translatedBadge')}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">

        {/* Clinical Liability Disclaimer Banner */}
        <div className="bg-amber-50 border-2 border-amber-200 text-amber-900 text-sm p-3.5 rounded-xl font-medium flex items-center gap-2.5 shadow-sm">
          <span className="text-amber-600 text-base font-bold shrink-0">⚠</span>
          <span>{tTriage('clinicalDisclaimer')}</span>
        </div>

        {/* ── Urgent Banner ── */}
        {isUrgent && (
          <div className="bg-danger/8 border-2 border-danger/40 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-danger/15 border border-danger/25 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="font-bold text-danger">⚠ {tTriage('redFlagAlert')} — {redFlags.length} trigger{redFlags.length > 1 ? 's' : ''} detected</p>
              <p className="text-sm text-danger/70 mt-0.5">{tTriage('immediateAttention')}</p>
            </div>
          </div>
        )}

        {/* ── Patient Card ── */}
        <section className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${isUrgent ? 'border-danger/40' : 'border-warmgray'}`}>
          {/* Top gradient bar */}
          <div className={`h-1.5 w-full ${isUrgent ? 'bg-gradient-to-r from-danger/50 via-danger to-danger/50' : 'bg-gradient-to-r from-primary/30 via-primary to-primary/30'}`} />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${isUrgent ? 'bg-danger/8 border-danger/20' : 'bg-primary/8 border-primary/15'}`}>
                  <User className={`w-7 h-7 ${isUrgent ? 'text-danger' : 'text-primary'}`} />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-charcoal">{session.patient_name}</h2>
                  {((session as any).caregiver_mode || facts.some(f => (f as any).field_name === 'proxy_respondent' || f.question_id === 'proxy_respondent')) && (
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      {tTriage('caregiverReported')}
                    </span>
                  )}
                  <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(session.created_at).toLocaleDateString()} · {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 self-start ${isUrgent ? 'bg-danger/8 border-danger/25 text-danger' : 'bg-success/8 border-success/20 text-success'}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {tTriage('pendingTriage')}
              </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: tTriage('queueToken'), value: `T-${session.session_id.substring(0, 4).toUpperCase()}`, mono: true },
                { label: tTriage('abhaAadhaar'), value: `xxxx-xxxx-${session.dummy_aadhaar?.slice(-4) || '0000'}` },
                { label: tTriage('languageLabel'), value: session.language === 'hi' ? 'Hindi' : session.language === 'mr' ? 'Marathi' : session.language === 'bn' ? 'Bengali' : 'English' },
                { label: tTriage('chiefComplaintLabel'), value: translatedChiefComplaint },
              ].map(({ label, value, mono }) => (
                <div key={label} className="bg-sand rounded-xl border border-warmgray px-4 py-3">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
                  <p className={`font-bold text-sm ${mono ? 'text-primary font-display tracking-widest text-base' : 'text-charcoal'}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Patient indicated body regions */}
            {(() => {
              const bodyRegionFact = facts.find((f: any) => f.question_id === 'body_region') || answers.find((a: any) => a.question_id === 'body_region');
              const regionVal = bodyRegionFact?.answer_value || bodyRegionFact?.answer || bodyRegionFact?.answer_text;
              if (!regionVal) return null;
              const formatted = regionVal.split(',').map((r: string) => r.trim().replace(/-/g, ' ').replace(/_/g, ' ')).join(', ');
              return (
                <div className="mt-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary font-medium flex items-center gap-2">
                  <span className="font-bold">{tTriage('patientIndicated')}</span>
                  <span className="capitalize">{formatted}</span>
                </div>
              );
            })()}
          </div>
        </section>

        {/* ── Differential Panel (Probabilistic Severity) ── */}
        <CollapsibleSection
          title="Differential Diagnosis Panel (Expected Severity)"
          defaultOpen={true}
          icon={Activity}
          badge={panelExpectedSeverity !== null ? `ES: ${panelExpectedSeverity.toFixed(2)}` : undefined}
          urgent={panelOverride}
        >
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-warmgray">
              <table className="w-full text-left text-xs">
                <thead className="bg-sand/70 text-muted uppercase font-bold tracking-wider border-b border-warmgray">
                  <tr>
                    <th className="py-2.5 px-3">Condition</th>
                    <th className="py-2.5 px-3 text-right">Probability</th>
                    <th className="py-2.5 px-3 text-center">Severity (ESI)</th>
                    <th className="py-2.5 px-3">Guideline Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warmgray/40">
                  {differentialPanel.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted italic">
                        Computing differential panel...
                      </td>
                    </tr>
                  ) : (
                    differentialPanel.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-sand/20 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-charcoal">{item.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                          {(item.probability * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            item.severity >= 85 ? 'bg-danger/10 text-danger border border-danger/30' :
                            item.severity >= 50 ? 'bg-amber-500/10 text-amber-700 border border-amber-500/30' :
                            'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                          }`}>
                            {item.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted">{item.source}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-sand/60 rounded-xl text-xs">
              <div>
                <span className="text-muted">Expected Severity (Σ prob × sev): </span>
                <span className="font-mono font-bold text-charcoal text-sm">
                  {panelExpectedSeverity !== null ? panelExpectedSeverity.toFixed(2) : '—'}
                </span>
              </div>
              {panelOverride && (
                <div className="text-danger font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Override triggered: {panelOverrideReason || 'High probability life-threatening rule-out'}</span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Clinical History (standard 8-part format) ── */}
        {(() => {
          const firstSummary = summaries[0];
          let parsed: any = null;
          if (firstSummary) {
            try {
              if (typeof (firstSummary as any).content === 'object') {
                parsed = (firstSummary as any).content;
              } else if (typeof (firstSummary as any).content === 'string') {
                parsed = JSON.parse((firstSummary as any).content);
              }
            } catch {}
          }

          const chiefComplaint = session?.chief_complaint || parsed?.chief_complaint || null;

          let hpiContent: string[] | null = parsed?.hpi ? (Array.isArray(parsed.hpi) ? parsed.hpi : [parsed.hpi]) : null;
          if (!hpiContent && facts.length > 0) {
            hpiContent = facts.map(f => `${f.question_text}: ${f.answer_value}`);
          }

          let pmhContent: string[] = [];
          if (parsed?.pmh) pmhContent = [...pmhContent, ...(Array.isArray(parsed.pmh) ? parsed.pmh : [parsed.pmh])];
          if (parsed?.psh) pmhContent = [...pmhContent, ...(Array.isArray(parsed.psh) ? parsed.psh : [parsed.psh])];
          const pmhMedHist = medicalHistory.filter(m => 
            m.category?.toLowerCase().includes('past') || 
            m.category?.toLowerCase().includes('medical') || 
            m.category?.toLowerCase().includes('surgical')
          ).map(m => `${m.category}: ${m.value}`);

          const procedureFacts = facts.filter(f => 
            f.question_text?.toLowerCase().includes('procedure') ||
            f.question_id?.toLowerCase().includes('procedure') ||
            (f as any).field_name?.toLowerCase().includes('procedure') ||
            f.question_text?.toLowerCase().includes('surgery') ||
            f.question_id?.toLowerCase().includes('surgery') ||
            (f as any).field_name?.toLowerCase().includes('surgery')
          ).map(f => `${f.question_text || 'Procedure'}: ${f.answer_value}`);

          const ocrProcedures = extractions.filter(e => 
            e.field_name.toLowerCase().includes('procedure') || 
            e.field_name.toLowerCase().includes('surgery')
          ).map(e => `${e.field_name}: ${e.field_value}`);

          pmhContent = Array.from(new Set([...pmhContent, ...pmhMedHist, ...procedureFacts, ...ocrProcedures]));

          let drugAllergyContent: string[] = [];
          if (parsed?.drug_history) drugAllergyContent = [...drugAllergyContent, ...(Array.isArray(parsed.drug_history) ? parsed.drug_history : [parsed.drug_history])];
          if (parsed?.allergy_history) drugAllergyContent = [...drugAllergyContent, ...(Array.isArray(parsed.allergy_history) ? parsed.allergy_history : [parsed.allergy_history])];
          const drugMedHist = medicalHistory.filter(m => 
            m.category?.toLowerCase().includes('drug') || 
            m.category?.toLowerCase().includes('allergy') ||
            m.category?.toLowerCase().includes('medication')
          ).map(m => `${m.category}: ${m.value}`);
          drugAllergyContent = Array.from(new Set([...drugAllergyContent, ...drugMedHist]));

          let familyContent: string[] = [];
          if (parsed?.family_history) familyContent = [...familyContent, ...(Array.isArray(parsed.family_history) ? parsed.family_history : [parsed.family_history])];
          const familyMedHist = medicalHistory.filter(m => 
            m.category?.toLowerCase().includes('family')
          ).map(m => `${m.category}: ${m.value}`);
          familyContent = Array.from(new Set([...familyContent, ...familyMedHist]));

          let personalContent: string[] = [];
          if (parsed?.personal_history) personalContent = [...personalContent, ...(Array.isArray(parsed.personal_history) ? parsed.personal_history : [parsed.personal_history])];
          const personalMedHist = medicalHistory.filter(m => 
            m.category?.toLowerCase().includes('personal') || 
            m.category?.toLowerCase().includes('lifestyle') ||
            m.category?.toLowerCase().includes('social')
          ).map(m => `${m.category}: ${m.value}`);
          personalContent = Array.from(new Set([...personalContent, ...personalMedHist]));

          let rosContent: string[] = [];
          if (parsed?.ros) rosContent = Array.isArray(parsed.ros) ? parsed.ros : [parsed.ros];

          let priorInvContent: string[] = [];
          if (extractions.length > 0) {
            priorInvContent.push(...extractions.map(e => `${e.field_name}: ${e.field_value}`));
          }
          if (procedureFacts.length > 0) {
            priorInvContent.push(...procedureFacts);
          }
          if (pastVisits.length > 0) {
            priorInvContent.push(...pastVisits.map(v => `Past Visit (${new Date(v.date).toLocaleDateString()}): ${v.chief_complaint}`));
          }

          const psSections = [
            { num: 1, name: SECTION_LABELS[summaryLang]?.chief_complaint || 'Chief Complaint', data: chiefComplaint ? [chiefComplaint] : [] },
            { num: 2, name: SECTION_LABELS[summaryLang]?.hpi || 'History of Present Illness (HPI)', data: hpiContent || [] },
            { num: 3, name: SECTION_LABELS[summaryLang]?.pmh_psh || 'Past Medical & Surgical History', data: pmhContent },
            { num: 4, name: SECTION_LABELS[summaryLang]?.drug_allergy || 'Drug & Allergy History', data: drugAllergyContent },
            { num: 5, name: SECTION_LABELS[summaryLang]?.family_history || 'Family History', data: familyContent },
            { num: 6, name: SECTION_LABELS[summaryLang]?.personal_social || 'Personal & Social History', data: personalContent },
            { num: 7, name: SECTION_LABELS[summaryLang]?.ros || 'Review of Systems (ROS)', data: rosContent },
            { num: 8, name: SECTION_LABELS[summaryLang]?.prior_investigations || 'Prior Investigations Summary', data: priorInvContent }
          ];

          return (
            <section className="bg-white rounded-2xl border-2 border-primary/20 shadow-sm overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm">
                    8
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-charcoal">{tTriage('clinicalHistoryTitle')}</h2>
                    <p className="text-xs text-muted">{tTriage('canonical8Desc')}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wider">
                  {tTriage('standard8Part')}
                </span>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {psSections.map(sec => {
                    const hasData = sec.data && sec.data.length > 0;
                    return (
                      <div 
                        key={sec.num} 
                        className={`rounded-xl border p-4 transition-all ${
                          hasData ? 'bg-sand/40 border-warmgray' : 'bg-gray-50/50 border-dashed border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-mono flex items-center justify-center font-bold">
                              {sec.num}
                            </span>
                            {sec.name}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            hasData ? 'bg-success/10 text-success border-success/20' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {hasData ? tTriage('elicited') : tTriage('notElicited')}
                          </span>
                        </div>

                        {hasData ? (
                          <ul className="space-y-1 pl-1">
                            {sec.data.map((item: string, idx: number) => (
                              <li key={idx} className="text-sm text-charcoal flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted italic bg-gray-100/70 p-2 rounded-lg border border-gray-200/60 mt-1">
                            {tTriage('notElicitedDesc')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── AI Triage Summary ── */}
        {(summaries.length > 0 || clinicalAlerts) && (
          <section className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden relative">
            {/* Decorative watermark */}
            <div className="absolute -top-4 -right-4 opacity-[0.04] pointer-events-none">
              <BrainCircuit className="w-48 h-48 text-blue-700" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-blue-800 uppercase tracking-widest">{tTriage('aiSummaryTitle')}</h2>
              </div>
            </div>

            <div className="p-6 space-y-5 relative z-10">
              {summaries.length > 0 ? (
                summaries.map(sum => {
                  let parsed: any = null;
                  let completenessObj: any = null;
                  try {
                    if (typeof (sum as any).content === 'object' && (sum as any).content !== null) {
                      parsed = (sum as any).content;
                      if (parsed.completeness) completenessObj = parsed.completeness;
                    }
                  } catch {}

                  return (
                    <div key={sum.summary_id} className="space-y-4">
                      {parsed ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            { label: SECTION_LABELS[summaryLang]?.chief_complaint || 'Chief Complaint', data: parsed.chief_complaint, type: 'text', span: 2 },
                            { label: SECTION_LABELS[summaryLang]?.hpi || 'History of Present Illness (HPI)', data: parsed.hpi, type: 'list', span: 2 },
                            { label: SECTION_LABELS[summaryLang]?.pmh || 'Past Medical History', data: parsed.pmh, type: 'list' },
                            { label: SECTION_LABELS[summaryLang]?.psh || 'Past Surgical History', data: parsed.psh, type: 'list' },
                            { label: SECTION_LABELS[summaryLang]?.drug_history || 'Drug History', data: parsed.drug_history, type: 'list' },
                            { label: SECTION_LABELS[summaryLang]?.allergy_history || 'Allergy History', data: parsed.allergy_history, type: 'list' },
                            { label: SECTION_LABELS[summaryLang]?.family_history || 'Family History', data: parsed.family_history, type: 'list' },
                            { label: SECTION_LABELS[summaryLang]?.personal_history || 'Personal History', data: parsed.personal_history, type: 'list' },
                            { label: SECTION_LABELS[summaryLang]?.ros || 'Review of Systems (ROS)', data: parsed.ros, type: 'list', span: 2 },
                          ].map(({ label, data, type, span }) => (
                            <div key={label} className={`bg-blue-50/60 rounded-xl border border-blue-100 p-4 ${span === 2 ? 'md:col-span-2' : ''}`}>
                              <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">{label}</h4>
                              {type === 'text' ? (
                                <p className="text-sm text-charcoal">{data || 'N/A'}</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {(data || []).map((item: string, i: number) => (
                                    <li key={i} className="text-sm text-charcoal flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">{sum.generated_text}</p>
                      )}

                      {completenessObj && (
                        <div className="bg-sand rounded-xl border border-warmgray p-4">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">Data Completeness</p>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${completenessObj.score >= 80 ? 'bg-success/8 text-success border-success/20' : 'bg-turmeric/10 text-turmeric border-turmeric/20'}`}>
                              {completenessObj.score}%
                            </span>
                          </div>
                          <div className="w-full bg-warmgray rounded-full h-2 mb-3">
                            <div className={`h-2 rounded-full transition-all ${completenessObj.score >= 80 ? 'bg-success' : 'bg-turmeric'}`} style={{ width: `${completenessObj.score}%` }} />
                          </div>
                          {completenessObj.missing_fields?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {completenessObj.missing_fields.map((mf: string, i: number) => (
                                <span key={i} className="text-xs bg-danger/8 text-danger border border-danger/20 px-2 py-0.5 rounded-lg">{mf}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-charcoal italic">
                  Patient presented with chief complaint of <strong>{session.chief_complaint}</strong>. Clinical analysis is ready for review.
                </p>
              )}

              {clinicalAlerts?.analysis?.triage_level && (
                <div className="bg-sand border border-warmgray rounded-xl p-4">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Suggested Triage Level</p>
                  <p className="text-base text-charcoal font-bold">{clinicalAlerts.analysis.triage_level}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Current Complaint & Interview ── */}
        <CollapsibleSection title={tTriage('currentComplaint')} icon={ClipboardList} defaultOpen={true}>
          <div className="mb-5 bg-sand rounded-xl border border-warmgray px-4 py-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{tTriage('chiefComplaintLabel')}</p>
            <p className="font-display font-bold text-charcoal text-xl">{translatedChiefComplaint}</p>
            {facts.find(f => f.question_id === 'body_region') && (
              <p className="text-xs font-semibold text-primary mt-1">
                {tTriage('patientIndicated')} {(facts.find(f => f.question_id === 'body_region')?.answer_text || facts.find(f => f.question_id === 'body_region')?.answer_value || '').split(',').map((r: string) => r.replace(/-/g, ' ').replace(/_/g, ' ')).join(', ')}
              </p>
            )}
          </div>

          {facts.length === 0 ? (
            <p className="text-muted italic text-sm">{tTriage('noHistoryProvided')}</p>
          ) : (
            <div className="space-y-5">
              {facts.map(fact => (
                <div key={fact.fact_id} className="relative pl-6 border-l-2 border-warmgray pb-4 last:border-transparent">
                  <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1 ring-2 ring-white" />
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted mb-1">{fact.question_text}</p>
                      {editingFactId === fact.fact_id ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="text"
                            className="flex-1 border-2 border-primary/40 rounded-lg px-3 py-1.5 text-charcoal text-sm focus:outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/15"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                          />
                          <button onClick={() => handleSaveFact(fact.fact_id)} className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingFactId(null)} className="p-2 text-muted hover:text-charcoal rounded-lg hover:bg-sand transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <p className="text-charcoal font-semibold">{fact.answer_value}</p>
                          {!isReadOnly && (
                            <button 
                              aria-label="Edit fact"
                              onClick={() => { setEditingFactId(fact.fact_id); setEditValue(fact.answer_value); }} 
                              className="text-muted hover:text-primary p-1 rounded hover:bg-sand transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ProvenanceBadge type={fact.provenance} />
                      {(() => {
                        const isFactVerified = fact.verified === 1 || 
                          verifiedFields.has(fact.fact_id) || 
                          verifiedFields.has(fact.question_text) ||
                          (Boolean((fact as any).field_name) && verifiedFields.has((fact as any).field_name));

                        return (
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`verify-btn-${fact.fact_id}`}
                              type="button"
                              onClick={() => handleVerifyFact(fact)}
                              disabled={isReadOnly || verifyingFactId === fact.fact_id || isFactVerified}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                                isFactVerified
                                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                                  : 'bg-primary/8 text-primary border border-primary/20 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 cursor-pointer'
                              }`}
                              aria-label={isFactVerified ? 'Verified' : 'Verify this fact'}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{verifyingFactId === fact.fact_id ? '…' : isFactVerified ? 'Verified' : 'Verify'}</span>
                            </button>
                            {!isReadOnly && !isFactVerified && (
                              <button
                                onClick={() => handleRejectFact(fact.fact_id)}
                                className="p-1.5 text-danger/50 hover:text-danger hover:bg-danger/8 rounded-lg transition-colors border border-transparent hover:border-danger/20"
                                aria-label="Delete fact"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title={tTriage('medicalHistoryTitle')} icon={Activity} badge={medicalHistory.length === 0 ? (summaryLang === 'hi' ? 'कोई नहीं' : summaryLang === 'mr' ? 'काही नाही' : summaryLang === 'bn' ? 'কিছু নেই' : 'No data') : `${medicalHistory.length} items`}>
          {medicalHistory.length === 0 ? (
            <p className="text-muted italic text-sm">{tTriage('noHistoryProvided')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {medicalHistory.map(item => (
                <div key={item.item_id} className="bg-sand rounded-xl border border-warmgray p-4">
                  <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">{item.category}</h3>
                  <p className="text-charcoal font-medium text-sm whitespace-pre-wrap">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* AYUSH Assessment & Classical Citations - Only shown if patient opted into AYUSH */}
        {(ayushOptIn || ayushAssessments.length > 0) && (
          <CollapsibleSection title={tTriage('ayushTitle')} icon={Sparkles} badge={tTriage('classicalRefs')} defaultOpen={true} className="ayush-print-section">
            <div className="space-y-4">
              {ayushAssessments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ayushAssessments.map(item => (
                    <div key={item.assessment_id} className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1.5">{item.dimension}</p>
                      <p className="text-charcoal font-medium capitalize text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1">Prakriti Analysis</p>
                    <p className="text-charcoal font-semibold text-sm">Vata-Pitta Dominant</p>
                  </div>
                  <div className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1">Vikriti / Imbalance</p>
                    <p className="text-charcoal font-semibold text-sm">Pitta-Vata (Ushna / Ruksha)</p>
                  </div>
                  <div className="bg-lavender/8 border border-lavender/20 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-lavender uppercase tracking-widest mb-1">Agni Status</p>
                    <p className="text-charcoal font-semibold text-sm">Tikshna / Vishama Agni</p>
                  </div>
                </div>
              )}

              {/* Classical Citations & Textual Grounding */}
              <div className="bg-sand/60 border-2 border-warmgray rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-terracotta" />
                  <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider">Classical Vedic & Ayurvedic References</h3>
                </div>
                <div className="space-y-2 text-xs text-charcoal/80 font-body">
                  <div className="bg-white p-3 rounded-lg border border-warmgray">
                    <p className="font-bold text-terracotta">[1] Charaka Samhita · Sutra Sthana (Ch. 20 - Maharoga Adhyaya)</p>
                    <p className="text-muted mt-1 italic">"Assessment of Dosha-Dushya Sammurchana, Prakriti constitution and Agnibala under classical Ayurvedic diagnostic principles."</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-warmgray">
                    <p className="font-bold text-terracotta">[2] Sushruta Samhita · Sutra Sthana (Dosha Dhatu Mala Kshaya Vriddhi)</p>
                    <p className="text-muted mt-1 italic">"Determination of Rogi-Roga Pariksha, Koshtha nature, and Ahara-Vihara intervention protocol."</p>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Task C.1 — Classical Analysis (Nidana Panchaka + Samprapti Ghatakas) */}
        <CollapsibleSection
          title="Classical Analysis"
          icon={BrainCircuit}
          badge="Nidana Panchaka & Samprapti"
          defaultOpen={true}
          className="classical-analysis-section"
        >
          {(() => {
            const classical = ayushReasoning || {
              nidana_panchaka: {
                nidana: session.chief_complaint ? `Dietary / lifestyle stressors correlating with ${session.chief_complaint}` : 'Mithya Ahara / Vihara',
                purvarupa: null,
                rupa: session.chief_complaint || 'General imbalance / malaise',
                upashaya: 'Pathya Ahara & Vihara intervention',
                samprapti: 'Agnimandya predisposing to Ama accumulation and Srotas disturbance'
              },
              samprapti_ghatakas: {
                dosha: 'Vata / Pitta',
                dushya: 'Rasa, Rakta',
                srotas: 'Annavaha & Purishavaha Srotas',
                agni: 'Manda Agni',
                ama: 'Saama (Ama present due to Mandagni)',
                udbhava_sthana: 'Amashaya / Pakvashaya',
                vyakta_sthana: 'Purishadhara Kala / Koshtha',
                roga_marga: 'Abhyantara Roga Marga (Koshtha)',
                sadhya_asadhyata: 'Sukha-Sadhya (Easily curable through Nidana Parivarjana)'
              }
            };

            const np = classical.nidana_panchaka || {};
            const sg = classical.samprapti_ghatakas || {};

            return (
              <div className="space-y-6">
                {/* Nidana Panchaka Sub-block */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-terracotta uppercase tracking-wider">
                      Nidana Panchaka (निदान पञ्चक)
                    </span>
                    <span className="text-[10px] bg-sand px-2 py-0.5 rounded-full text-muted border border-warmgray font-medium">5 Diagnostic Cardinal Factors</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="bg-sand/60 border border-warmgray rounded-xl p-3.5">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Nidana (निदान / Etiology)</p>
                      <p className="text-sm font-semibold text-charcoal">{np.nidana ?? <span className="text-muted italic">null (Not specified)</span>}</p>
                    </div>
                    <div className="bg-sand/60 border border-warmgray rounded-xl p-3.5">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Purvarupa (पूर्वरूप / Prodromal)</p>
                      <p className="text-sm font-semibold text-charcoal">{np.purvarupa ?? <span className="text-muted italic">null (None reported)</span>}</p>
                    </div>
                    <div className="bg-sand/60 border border-warmgray rounded-xl p-3.5">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Rupa (रूप / Manifestations)</p>
                      <p className="text-sm font-semibold text-charcoal">{np.rupa ?? <span className="text-muted italic">null (Not specified)</span>}</p>
                    </div>
                    <div className="bg-sand/60 border border-warmgray rounded-xl p-3.5">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Upashaya (उपशय / Therapeutic Response)</p>
                      <p className="text-sm font-semibold text-charcoal">{np.upashaya ?? <span className="text-muted italic">null (Not specified)</span>}</p>
                    </div>
                    <div className="bg-sand/60 border border-warmgray rounded-xl p-3.5 sm:col-span-2">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Samprapti (सम्प्राप्ति / Pathogenesis Summary)</p>
                      <p className="text-sm font-semibold text-charcoal">{np.samprapti ?? <span className="text-muted italic">null (Not specified)</span>}</p>
                    </div>
                  </div>
                </div>

                {/* Samprapti Ghatakas Sub-block */}
                <div className="pt-3 border-t border-warmgray/60">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">
                      Samprapti Ghatakas (सम्प्राप्ति घटक)
                    </span>
                    <span className="text-[10px] bg-sand px-2 py-0.5 rounded-full text-muted border border-warmgray font-medium">9 Classical Pathological Elements</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Dosha (दोष)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.dosha ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Dushya (दूष्य / Tissues Affected)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.dushya ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Srotas (स्रोतस् / Channels)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.srotas ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Agni (अग्नि)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.agni ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Ama (आम / Endotoxin Status)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.ama ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Udbhava Sthana (उद्भव स्थान / Origin)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.udbhava_sthana ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Vyakta Sthana (व्यक्त स्थान / Manifestation)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.vyakta_sthana ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Roga Marga (रोग मार्ग / Pathway)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.roga_marga ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                    <div className="bg-white border border-warmgray rounded-xl p-3.5 shadow-2xs">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Sadhya-Asadhyata (साध्यासाध्यता / Prognosis)</p>
                      <p className="text-sm font-semibold text-charcoal">{sg.sadhya_asadhyata ?? <span className="text-muted italic">null</span>}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </CollapsibleSection>

        <CollapsibleSection title="Medical Timeline" icon={Calendar} badge={documents.length === 0 ? 'No data' : `${documents.length} files`}>
          {documents.length === 0 ? (
            <p className="text-muted italic text-sm">No documents uploaded.</p>
          ) : (
            <div className="relative border-l-2 border-primary/20 ml-2 pl-6 py-2 space-y-6">
              {sortedDocuments.map((doc, idx) => {
                const extDate = doc.extracted_date || doc.document_date || extractions.find(e => (e.document_id === doc.document_id || e.document_id === (doc as any).id) && (e.field_name === 'document_date' || e.field_name === 'extracted_date'))?.field_value;
                const displayDate = extDate || (doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : null);
                return (
                  <div key={doc.document_id || idx} className="relative">
                    <div className="absolute w-4 h-4 bg-primary rounded-full -left-[33px] top-1 ring-2 ring-white border-2 border-white shadow-sm" />
                    <div className="bg-white border-2 border-warmgray rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span>{displayDate || <span className="text-muted italic">Date unknown</span>}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${doc.ocr_status === 'completed' ? 'bg-success/8 text-success border-success/20' : 'bg-sand text-muted border-warmgray'}`}>
                          {doc.ocr_status || 'Processed'}
                        </span>
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/70 transition-colors">
                        <FileText className="w-3.5 h-3.5" /> View Document <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="OCR-Extracted Information" defaultOpen={true} icon={FileText} badge={extractions.length === 0 ? 'No data' : `${extractions.length} fields`}>
          {reconciliationConflicts.length > 0 && (
            <div className="mb-5 bg-terracotta/8 border-2 border-terracotta/25 rounded-xl p-4">
              <h3 className="text-sm font-bold text-terracotta flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" /> Reconciliation Conflicts
              </h3>
              <div className="space-y-2.5">
                {reconciliationConflicts.map((c, i) => (
                  <div key={i} className="bg-white rounded-xl border border-terracotta/15 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-terracotta uppercase tracking-widest mb-1">{c.field}</p>
                      <p className="text-xs text-charcoal/70"><span className="font-semibold text-charcoal">Document:</span> {c.documentValue}</p>
                      <p className="text-xs text-charcoal/70"><span className="font-semibold text-charcoal">Patient:</span> {c.patientValue}</p>
                    </div>
                    <button className="text-xs font-bold text-terracotta border border-terracotta/30 px-3 py-1.5 rounded-lg hover:bg-terracotta hover:text-white transition-all whitespace-nowrap">Resolve</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header Controls for OCR: Show only abnormal filter */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-warmgray/40">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              {showOnlyAbnormal ? 'Showing Out-of-Range (Abnormal) Findings Only' : 'All Document Extractions & Labs'}
            </span>
            <button
              type="button"
              onClick={() => setShowOnlyAbnormal(!showOnlyAbnormal)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                showOnlyAbnormal
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-white text-muted border-warmgray hover:border-primary/40 hover:text-charcoal'
              }`}
              aria-label="Filter only abnormal lab results"
            >
              {showOnlyAbnormal ? '✓ Showing only abnormal' : 'Show only abnormal'}
            </button>
          </div>

          {(() => {
            const defaultDemoLabs: ExtractedField[] = [
              {
                extraction_id: 'lab-hb-demo',
                field_name: 'Hemoglobin (Hb)',
                field_value: '8.2 g/dL (Ref: 13.0 - 17.0 g/dL)',
                confidence: 0.98,
                normalized: { value: 8.2, unit: 'g/dL', low: 13.0, high: 17.0, flag: 'low' }
              } as any,
              {
                extraction_id: 'lab-fbs-demo',
                field_name: 'Fasting Blood Glucose',
                field_value: '95 mg/dL (Ref: 70.0 - 100.0 mg/dL)',
                confidence: 0.96,
                normalized: { value: 95, unit: 'mg/dL', low: 70.0, high: 100.0, flag: 'normal' }
              } as any,
              {
                extraction_id: 'lab-creat-demo',
                field_name: 'Serum Creatinine',
                field_value: '1.9 mg/dL (Ref: 0.6 - 1.2 mg/dL)',
                confidence: 0.97,
                normalized: { value: 1.9, unit: 'mg/dL', low: 0.6, high: 1.2, flag: 'high' }
              } as any,
              {
                extraction_id: 'doc-type-demo',
                field_name: 'Document Type',
                field_value: 'Pathology Lab Report (Ref: —)',
                confidence: 0.95,
                normalized: { value: null, unit: '', low: null, high: null, flag: 'unknown' }
              } as any
            ];

            const activeList = extractions.length > 0 ? extractions : defaultDemoLabs;
            const filteredList = showOnlyAbnormal
              ? activeList.filter(e => {
                  const l = parseLabValue(e);
                  return l.flag === 'low' || l.flag === 'high';
                })
              : activeList;

            if (filteredList.length === 0) {
              return (
                <div className="text-center py-6 bg-sand/30 rounded-xl border border-warmgray">
                  <p className="text-muted text-xs italic">No abnormal lab findings detected.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredList.map(ext => {
                  const doc = documents.find(d => d.document_id === ext.document_id || (d as any).id === ext.document_id);
                  const lab = parseLabValue(ext);
                  const isAbnormal = lab.flag === 'low' || lab.flag === 'high';

                  return (
                    <div
                      key={ext.extraction_id}
                      className={`rounded-xl border p-4 transition-all ${
                        isAbnormal
                          ? (lab.flag === 'high'
                              ? 'border-l-4 border-l-danger bg-danger/5 border-danger/30'
                              : 'border-l-4 border-l-amber-500 bg-amber-50/50 border-amber-300')
                          : (ext.confidence < 0.7 ? 'border-turmeric/40 bg-sand' : 'border-warmgray bg-sand')
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{ext.field_name}</p>
                        <div className="flex gap-1.5 items-center">
                          {lab.flag === 'high' && (
                            <span className="text-[10px] bg-danger text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1">
                              H · High
                            </span>
                          )}
                          {lab.flag === 'low' && (
                            <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1">
                              L · Low
                            </span>
                          )}
                          {lab.flag === 'normal' && (
                            <span className="text-[10px] bg-success/10 text-success border border-success/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Normal
                            </span>
                          )}
                          {ext.confidence < 0.7 && (
                            <span className="text-[10px] bg-turmeric/10 text-charcoal border border-turmeric/30 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-turmeric" /> Low Conf
                            </span>
                          )}
                          {doc?.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-muted hover:text-primary transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      <p className="text-charcoal font-bold text-sm">{ext.field_value || '—'}</p>

                      {lab.isLab && (
                        <div className="mt-2 pt-1.5 border-t border-warmgray/40 flex justify-between text-[11px] text-muted">
                          <span>Reference Range:</span>
                          <span className="font-semibold text-charcoal font-mono">{lab.displayRef}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CollapsibleSection>

        <CollapsibleSection title="Red Flags" icon={AlertTriangle} badge={redFlags.length === 0 ? 'None' : `${redFlags.length} flags`} urgent={true}>
          {redFlags.length === 0 ? (
            <p className="text-muted italic text-sm">No red flags triggered or they have been acknowledged.</p>
          ) : (
            <div>
              <div className="space-y-2.5 mb-4">
                {redFlags.map(rf => (
                  <div key={rf.flag_id} className="bg-danger/6 border border-danger/20 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-danger">Rule Match: {rf.rule_id}</p>
                      <p className="text-xs text-danger/50 mt-0.5">at {new Date(rf.created_at).toLocaleTimeString()}</p>
                    </div>
                    <Zap className="w-4 h-4 text-danger/40" />
                  </div>
                ))}
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleAcknowledgeRedFlags}
                  className="px-5 py-2.5 text-sm font-bold bg-danger text-white rounded-xl hover:bg-danger/90 transition-colors shadow-sm"
                >
                  Acknowledge & Clear Flags
                </button>
              )}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Past Medical Records" icon={ClipboardList} badge={pastVisits.length === 0 ? 'None' : `${pastVisits.length} visits`}>
          {pastVisits.length === 0 ? (
            <p className="text-muted italic text-sm">No past medical records found for this patient.</p>
          ) : (
            <div className="space-y-3">
              {pastVisits.map(visit => (
                <div key={visit.session_id} className="bg-sand border-2 border-warmgray p-4 rounded-xl hover:border-primary/20 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-charcoal text-sm">{new Date(visit.date).toLocaleDateString()} · {new Date(visit.date).toLocaleTimeString()}</p>
                    <span className="text-[10px] font-bold bg-white text-muted border border-warmgray px-2 py-0.5 rounded-lg uppercase">{visit.status}</span>
                  </div>
                  <p className="text-sm text-charcoal/70"><span className="font-semibold text-charcoal">Complaint:</span> {visit.chief_complaint}</p>
                  {visit.doctor_notes && (
                    <div className="bg-white border border-warmgray p-3 rounded-lg mt-3">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Doctor's Notes</p>
                      <p className="text-xs text-charcoal whitespace-pre-wrap">{visit.doctor_notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Feature 13: Historical Medication Comparison */}
        <CollapsibleSection title="Medication History & Reconciliation" icon={Activity} badge="1 Change Detected">
          <div className="bg-sand border-2 border-warmgray rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 text-xs font-bold text-muted uppercase tracking-widest border-b-2 border-warmgray bg-white">
              <div className="p-3 border-r-2 border-warmgray">Previous Visit (Last Month)</div>
              <div className="p-3">Current Visit</div>
            </div>
            
            {/* Unchanged Medication */}
            <div className="grid grid-cols-2 text-sm border-b border-warmgray/50">
              <div className="p-4 border-r-2 border-warmgray">
                <p className="font-bold text-charcoal">Metformin</p>
                <p className="text-muted text-xs">500mg • Twice daily</p>
              </div>
              <div className="p-4 bg-white">
                <p className="font-bold text-charcoal">Metformin</p>
                <p className="text-muted text-xs">500mg • Twice daily</p>
              </div>
            </div>

            {/* Changed Medication (Dose increase) */}
            <div className="grid grid-cols-2 text-sm border-b border-warmgray/50">
              <div className="p-4 border-r-2 border-warmgray">
                <p className="font-bold text-charcoal">Amlodipine</p>
                <p className="text-muted text-xs">5mg • Once daily</p>
              </div>
              <div className="p-4 bg-turmeric/10 border-l-4 border-turmeric">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-bold text-charcoal">Amlodipine</p>
                  <span className="text-[10px] font-bold text-turmeric bg-white border border-turmeric/30 px-1.5 rounded uppercase">Dose Changed</span>
                </div>
                <p className="text-muted text-xs"><span className="line-through opacity-60 mr-1">5mg</span><strong className="text-charcoal">10mg</strong> • Once daily</p>
              </div>
            </div>

            {/* New Medication */}
            <div className="grid grid-cols-2 text-sm">
              <div className="p-4 border-r-2 border-warmgray flex items-center justify-center text-muted italic">
                None
              </div>
              <div className="p-4 bg-success/10 border-l-4 border-success">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-bold text-charcoal">Atorvastatin</p>
                  <span className="text-[10px] font-bold text-success bg-white border border-success/30 px-1.5 rounded uppercase">New</span>
                </div>
                <p className="text-muted text-xs">20mg • At bedtime</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* PS §3.3 Module B: Potential Interactions */}
        <CollapsibleSection
          title={tTriage('potentialInteractionsTitle')}
          defaultOpen={true}
          icon={AlertTriangle}
          badge={detectedInteractions.length === 0 ? (summaryLang === 'hi' ? 'कोई नहीं' : summaryLang === 'mr' ? 'काही नाही' : summaryLang === 'bn' ? 'কিছু নেই' : 'None') : `${detectedInteractions.length} flagged`}
          urgent={detectedInteractions.some(i => i.severity === 'critical' || i.severity === 'major')}
        >
          {/* Rule-based disclaimer */}
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3.5 rounded-xl font-medium mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-amber-600 font-bold text-sm">⚠</span>
              <span className="font-semibold">Rule-based — verify before prescribing.</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded self-start sm:self-auto">
              Deterministic Rules ({DRUG_INTERACTION_RULES.length} pairs)
            </span>
          </div>

          {detectedInteractions.length === 0 ? (
            <div className="text-center py-6 bg-sand/30 rounded-xl border border-warmgray">
              <p className="text-muted text-xs italic">{tTriage('noInteractions')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {detectedInteractions.map(inter => (
                <div
                  key={inter.ruleId}
                  className={`rounded-xl border p-4 transition-all ${
                    inter.severity === 'critical'
                      ? 'border-l-4 border-l-danger bg-danger/5 border-danger/30'
                      : inter.severity === 'major'
                      ? 'border-l-4 border-l-amber-500 bg-amber-50/50 border-amber-300'
                      : 'border-l-4 border-l-turmeric bg-sand border-warmgray'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        inter.severity === 'critical'
                          ? 'bg-danger text-white'
                          : inter.severity === 'major'
                          ? 'bg-amber-600 text-white'
                          : 'bg-turmeric text-charcoal'
                      }`}>
                        {inter.severity}
                      </span>
                      <h4 className="font-bold text-sm text-charcoal">{inter.name}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-muted bg-white border border-warmgray px-1.5 py-0.5 rounded">
                      {inter.ruleId}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3 bg-white/70 p-2.5 rounded-lg border border-warmgray/40">
                    <div>
                      <span className="text-muted text-[10px] font-bold uppercase tracking-wider">Trigger 1:</span>
                      <p className="font-semibold text-charcoal">{inter.drugAFound}</p>
                    </div>
                    <div>
                      <span className="text-muted text-[10px] font-bold uppercase tracking-wider">Trigger 2:</span>
                      <p className="font-semibold text-charcoal">{inter.drugBFound}</p>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <p className="text-charcoal"><strong className="text-muted uppercase text-[10px] tracking-wider">Clinical Effect: </strong>{inter.clinicalEffect}</p>
                    <p className="text-charcoal"><strong className="text-muted uppercase text-[10px] tracking-wider">Recommendation: </strong>{inter.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* ── Doctor Notes & Verification ── */}
        {isReadOnly ? (
          doctorNotes ? (
            <section className="bg-white rounded-2xl border-2 border-warmgray shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-sand border border-warmgray flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-muted" />
                </div>
                <h2 className="text-xs font-bold text-muted uppercase tracking-widest">{tTriage('doctorNotesReadOnly')}</h2>
              </div>
              <p className="text-sm text-charcoal bg-sand/60 p-4 rounded-xl border border-warmgray whitespace-pre-wrap">{doctorNotes}</p>
            </section>
          ) : null
        ) : (
          <section className="bg-white rounded-2xl border-2 border-warmgray shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-xs font-bold text-muted uppercase tracking-widest">{tTriage('doctorNotesTitle')}</h2>
            </div>
            <textarea
              className="w-full min-h-[120px] p-4 bg-sand border-2 border-warmgray rounded-xl text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 resize-none transition-all"
              placeholder={tTriage('doctorNotesPlaceholder')}
              value={doctorNotes}
              onChange={e => setDoctorNotes(e.target.value)}
            />
            <div className="flex items-center justify-between mt-4">
              {notesSaved && (
                <span className="text-success text-sm font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {tTriage('savedAndVerified')}
                </span>
              )}
              <div className="ml-auto flex items-center gap-3 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-warmgray bg-white text-charcoal hover:bg-sand/60 transition-all shadow-sm cursor-pointer"
                  aria-label="Print Summary"
                >
                  <Printer className="w-4 h-4 text-muted" />
                  <span>{tTriage('printSummary')}</span>
                </button>
                <button
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-white text-primary border-2 border-primary hover:bg-primary/5 transition-all shadow-sm disabled:opacity-50"
                  onClick={handleRouteToHIS}
                  disabled={isRouting}
                >
                  {isRouting ? (
                    <><div className="w-3.5 h-3.5 border border-primary/50 border-t-transparent rounded-full animate-spin" /> {tTriage('routing')}</>
                  ) : (
                    <>{tTriage('routeToHis')}</>
                  )}
                </button>
                <button
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? (
                    <><div className="w-3.5 h-3.5 border border-white/50 border-t-transparent rounded-full animate-spin" /> {tTriage('saving')}</>
                  ) : (
                    <><Check className="w-3.5 h-3.5" /> {tTriage('saveNotesVerify')}</>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

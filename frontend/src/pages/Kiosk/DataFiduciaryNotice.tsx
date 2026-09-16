import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, Clock, AlertTriangle, FileText, User } from 'lucide-react';
import { MandalaBackground } from '../../components/MandalaBackground';
import { VoiceGuideButton } from '../../components/VoiceGuideButton';

export default function DataFiduciaryNotice() {
  const navigate = useNavigate();
  const { hospitalId } = useParams();
  const [searchParams] = useSearchParams();

  const lang = localStorage.getItem('patient_language') || searchParams.get('lang') || 'en';
  const isHindi = lang === 'hi';

  const handleConsent = () => {
    sessionStorage.setItem('seen_data_fiduciary_notice', 'true');
    const langQuery = lang ? `?lang=${lang}` : '';
    if (hospitalId) {
      navigate(`/hospital/${hospitalId}/consent${langQuery}`);
    } else {
      navigate(`/consent${langQuery}`);
    }
  };

  return (
    <div className="min-h-screen bg-sand text-charcoal relative overflow-hidden font-body">
      <MandalaBackground />
      
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 flex flex-col min-h-screen">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-terracotta/10 text-terracotta mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-charcoal">
            {isHindi ? 'डेटा फ़िडूशियरी (डेटा संरक्षक) सूचना' : 'Data Fiduciary Notice'}
          </h1>
          <p className="text-muted mt-2">
            {isHindi ? 'डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP) अधिनियम, 2023 के तहत आवश्यक' : 'Required under the Digital Personal Data Protection (DPDP) Act, 2023'}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-xl border border-white/40 flex-grow space-y-6 overflow-y-auto mb-8">
          
          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <User className="mr-2" size={20} /> {isHindi ? '1. आपका डेटा कौन संसाधित करता है' : '1. Who processes your data'}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              <strong>{isHindi ? 'ऑल इंडिया इंस्टीट्यूट ऑफ आयुर्वेद (AIIA) / मेडिकियोस्क' : 'All India Institute of Ayurveda (AIIA) / MediKiosk'}</strong> {isHindi ? 'डेटा फ़िडूशियरी (डेटा संरक्षक) के रूप में कार्य करता है।' : 'acts as the Data Fiduciary.'} 
              <br />{isHindi ? 'संपर्क:' : 'Contact:'} privacy@aiia.gov.in
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <FileText className="mr-2" size={20} /> {isHindi ? '2. हम क्या जानकारी एकत्र करते हैं' : '2. What we collect'}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {isHindi 
                ? 'हम आपका नैदानिक इतिहास (लक्षण), डेमोग्राफिक जानकारी, अपलोड किए गए चिकित्सा दस्तावेज़ (OCR निष्कर्षण), और आयुष-विशिष्ट मूल्यांकन (प्रकृति, विकृति आदि) एकत्र करते हैं।' 
                : 'We collect your clinical history, demographic information, uploaded medical documents (OCR extractions), and AYUSH-specific assessments (Prakriti, Vikriti, etc.).'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <CheckCircle className="mr-2" size={20} /> {isHindi ? '3. हम इसे क्यों एकत्र करते हैं' : '3. Why we collect it'}
            </h2>
            <ul className="text-sm md:text-base text-charcoal/80 pl-7 list-disc list-inside space-y-1 mt-2">
              <li>{isHindi ? 'आपको प्रत्यक्ष चिकित्सीय देखभाल एवं ट्राइएज सेवाएं प्रदान करने के लिए।' : 'To provide direct clinical care and triage services.'}</li>
              <li>{isHindi ? 'चिकित्सकों को एआई-संचालित नैदानिक सारांश प्रदान करने के लिए।' : 'To assist doctors with AI-powered clinical summarization.'}</li>
              <li>{isHindi ? 'आभा / एबीडीएम डेटा साझाकरण (केवल आपकी पृथक सहमति पर)।' : 'For ABDM sharing (only if you provide separate consent).'}</li>
              <li>{isHindi ? 'अनामित चिकित्सा अनुसंधान (केवल आपकी पृथक सहमति पर)।' : 'For medical research (only if you provide separate consent).'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <Clock className="mr-2" size={20} /> {isHindi ? '4. हम इसे कब तक सुरक्षित रखते हैं' : '4. How long we keep it'}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {isHindi 
                ? 'डेटा सुरक्षा के लिए आपकी जानकारी अधिकतम 90 दिनों तक रखी जाती है, जिसके बाद इसे पूरी तरह से मिटा या अनामित कर दिया जाता है।' 
                : 'For this prototype phase, your data is retained for a maximum of 90 days, after which it is anonymized or purged.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <AlertTriangle className="mr-2" size={20} /> {isHindi ? '5. आपके कानूनी अधिकार' : '5. Your rights'}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {isHindi 
                ? 'डीपीडीपी अधिनियम के तहत, आपको अपने डेटा तक पहुंच, सुधार और डेटा मिटाने का अधिकार (Right to Erasure) प्राप्त है। आप किसी भी समय अपनी सहमति वापस ले सकते हैं।' 
                : 'Under the DPDP Act, you have the Right to Access, Right to Correction, and the Right to Erasure. You may revoke your consent at any point during this session.'}
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <User className="mr-2" size={20} /> {isHindi ? '6. शिकायत निवारण अधिकारी' : '6. Grievance Officer'}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {isHindi ? 'गोपनीयता संबंधी शिकायतों के लिए संपर्क करें:' : 'For privacy-related complaints, contact:'} grievance.officer@aiia.gov.in
            </p>
          </section>

        </div>

        <div className="flex justify-center pb-8">
          <button
            onClick={handleConsent}
            className="bg-terracotta hover:bg-terracotta/90 text-white font-bold py-4 px-10 rounded-full shadow-lg transition-transform transform hover:scale-105 flex items-center text-lg w-full md:w-auto justify-center"
          >
            <CheckCircle className="mr-2" size={24} />
            {isHindi ? 'मैं समझ गया/गयी हूँ और आगे बढ़ें' : 'I Have Read & Understood'}
          </button>
        </div>

      </div>

      <VoiceGuideButton 
        clipId="notice"
        fallbackText={isHindi ? 'कृपया डीपीडीपी अधिनियम 2023 के तहत हमारी डेटा गोपनीयता सूचना की समीक्षा करें। हम आपके स्वास्थ्य डेटा की सुरक्षा करते हैं। आगे बढ़ने के लिए बटन दबाएं।' : 'Please review our Data Fiduciary Notice under the Digital Personal Data Protection Act 2023. We protect your health data.'} 
        language={isHindi ? 'hi-IN' : 'en-IN'} 
      />
    </div>
  );
}

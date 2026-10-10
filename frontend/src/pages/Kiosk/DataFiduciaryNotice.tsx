import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, Clock, AlertTriangle, FileText, User } from 'lucide-react';
import { MandalaBackground } from '../../components/MandalaBackground';
import { VoiceGuideButton } from '../../components/VoiceGuideButton';
import { useTranslation, type Language } from '../../lib/i18n';

export default function DataFiduciaryNotice() {
  const navigate = useNavigate();
  const { hospitalId } = useParams();
  const [searchParams] = useSearchParams();

  const urlLang = searchParams.get('lang') as Language;
  const savedLang = (localStorage.getItem('patient_language') || urlLang || 'en') as Language;
  const activeLang: Language = (savedLang === 'hi' || savedLang === 'mr' || savedLang === 'bn') ? savedLang : 'en';

  const { t } = useTranslation(activeLang);
  const ttsLang = activeLang === 'hi' ? 'hi-IN' : activeLang === 'mr' ? 'mr-IN' : activeLang === 'bn' ? 'bn-IN' : 'en-IN';

  const handleConsent = () => {
    sessionStorage.setItem('seen_data_fiduciary_notice', 'true');
    const langQuery = activeLang ? `?lang=${activeLang}` : '';
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
            {t('notice.title')}
          </h1>
          <p className="text-muted mt-2">
            {t('notice.subtitle')}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-xl border border-white/40 flex-grow space-y-6 overflow-y-auto mb-8">
          
          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <User className="mr-2" size={20} /> {t('notice.who_title')}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              <strong>All India Institute of Ayurveda (AIIA) / MediKiosk</strong> {t('notice.who_body')}
              <br />{t('notice.contact')} privacy@aiia.gov.in
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <FileText className="mr-2" size={20} /> {t('notice.collect_title')}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {t('notice.collect_body')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <CheckCircle className="mr-2" size={20} /> {t('notice.why_title')}
            </h2>
            <ul className="text-sm md:text-base text-charcoal/80 pl-7 list-disc list-inside space-y-1 mt-2">
              <li>{t('notice.why_care')}</li>
              <li>{t('notice.why_ai')}</li>
              <li>{t('notice.why_abdm')}</li>
              <li>{t('notice.why_research')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <Clock className="mr-2" size={20} /> {t('notice.retention_title')}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {t('notice.retention_body')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <AlertTriangle className="mr-2" size={20} /> {t('notice.rights_title')}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {t('notice.rights_body')}
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <User className="mr-2" size={20} /> {t('notice.grievance_title')}
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              {t('notice.grievance_contact')} grievance.officer@aiia.gov.in
            </p>
          </section>

        </div>

        <div className="flex justify-center pb-8">
          <button
            onClick={handleConsent}
            className="bg-terracotta hover:bg-terracotta/90 text-white font-bold py-4 px-10 rounded-full shadow-lg transition-transform transform hover:scale-105 flex items-center text-lg w-full md:w-auto justify-center"
          >
            <CheckCircle className="mr-2" size={24} />
            {t('notice.read_agree')}
          </button>
        </div>

      </div>

      <VoiceGuideButton 
        clipId="notice"
        fallbackText={t('notice.audio_fallback')} 
        language={ttsLang} 
      />
    </div>
  );
}

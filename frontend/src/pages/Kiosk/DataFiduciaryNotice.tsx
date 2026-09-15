import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, CheckCircle, Clock, AlertTriangle, FileText, User } from 'lucide-react';
import { MandalaBackground } from '../../components/MandalaBackground';

export default function DataFiduciaryNotice() {
  const navigate = useNavigate();
  const { hospitalId } = useParams();

  const handleConsent = () => {
    sessionStorage.setItem('seen_data_fiduciary_notice', 'true');
    if (hospitalId) {
      navigate(`/hospital/${hospitalId}/consent`);
    } else {
      navigate('/consent');
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
          <h1 className="text-3xl md:text-4xl font-display font-bold text-charcoal">Data Fiduciary Notice</h1>
          <p className="text-muted mt-2">Required under the Digital Personal Data Protection (DPDP) Act, 2023</p>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-xl border border-white/40 flex-grow space-y-6 overflow-y-auto mb-8">
          
          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <User className="mr-2" size={20} /> 1. Who processes your data
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              <strong>All India Institute of Ayurveda (AIIA) / MediKiosk</strong> acts as the Data Fiduciary. 
              Contact: privacy@aiia.gov.in
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <FileText className="mr-2" size={20} /> 2. What we collect
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              We collect your clinical history, demographic information, uploaded medical documents (OCR extractions), and AYUSH-specific assessments (Prakriti, Vikriti, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <CheckCircle className="mr-2" size={20} /> 3. Why we collect it
            </h2>
            <ul className="text-sm md:text-base text-charcoal/80 pl-7 list-disc list-inside space-y-1 mt-2">
              <li>To provide direct clinical care and triage services.</li>
              <li>To assist doctors with AI-powered clinical summarization.</li>
              <li>For ABDM sharing (only if you provide separate consent).</li>
              <li>For medical research (only if you provide separate consent).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <Clock className="mr-2" size={20} /> 4. How long we keep it
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              For this prototype phase, your data is retained for a maximum of <strong>90 days</strong>, after which it is anonymized or purged.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <AlertTriangle className="mr-2" size={20} /> 5. Your rights
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              Under the DPDP Act, you have the Right to Access, Right to Correction, and the <strong>Right to Erasure</strong>. You may revoke your consent at any point during this session.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold flex items-center text-forest mb-2">
              <User className="mr-2" size={20} /> 6. Grievance Officer
            </h2>
            <p className="text-sm md:text-base text-charcoal/80 pl-7">
              For privacy-related complaints, contact: grievance.officer@aiia.gov.in
            </p>
          </section>

        </div>

        <div className="flex justify-center pb-8">
          <button
            onClick={handleConsent}
            className="bg-terracotta hover:bg-terracotta/90 text-white font-bold py-4 px-10 rounded-full shadow-lg transition-transform transform hover:scale-105 flex items-center text-lg w-full md:w-auto justify-center"
          >
            I have read and understood this notice
            <CheckCircle className="ml-2" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

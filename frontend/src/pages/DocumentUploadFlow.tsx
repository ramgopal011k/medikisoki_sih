import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { Camera, UploadCloud, CheckCircle, AlertTriangle, Volume2, VolumeX, Mic } from 'lucide-react';
import { MandalaBackground } from '../components/MandalaBackground';
import { QuestionCard } from '../components/QuestionCard';
import { useAsr } from '@/hooks/useAsr';
import { useAudio } from '@/hooks/useAudio';
import { API_URL } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface ExtractedField {
  field_name: string;
  field_value: string;
  raw_text: string;
  confidence: number;
}

export default function DocumentUploadFlow() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [session] = useState(() => {
    const sessionId = localStorage.getItem('patient_session') || localStorage.getItem('session_id');
    const lang = localStorage.getItem('patient_language') || 'en';
    if (!sessionId) return null;
    return { id: sessionId, language: lang };
  });

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [_isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState('');
  const [extractions, setExtractions] = useState<ExtractedField[]>([
    { field_name: 'Patient Name', field_value: '', raw_text: '', confidence: 1 },
    { field_name: 'Diagnosis', field_value: '', raw_text: '', confidence: 1 },
    { field_name: 'Medications', field_value: '', raw_text: '', confidence: 1 }
  ]);

  const [step, setStep] = useState<'upload' | 'processing' | 'correction' | 'success'>('upload');

  const { speak, isPlaying } = useAudio();
  const { isListening, transcript, startListening, stopListening } = useAsr();
  const { t } = useTranslation();

  useEffect(() => {
    if (!session) {
      navigate('/consent');
    }
  }, [session, navigate]);

  // Voice ASR handler
  useEffect(() => {
    if (!transcript) return;
    const lower = transcript.toLowerCase();

    if (step === 'upload') {
      if (lower.includes('skip') || lower.includes('छोड़ें') || lower.includes('आगे')) {
        navigate('/medical-history');
      } else if (lower.includes('camera') || lower.includes('photo') || lower.includes('picture') || lower.includes('कैमरा') || lower.includes('फोटो') || lower.includes('upload')) {
        fileInputRef.current?.click();
      }
    } else if (step === 'correction') {
      if (lower.includes('confirm') || lower.includes('save') || lower.includes('सही') || lower.includes('सहेजें') || lower.includes('done')) {
        // eslint-disable-next-line
        handleSave();
      }
    }
    // eslint-disable-next-line
  }, [transcript, step, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) {
        setValidationError('File size exceeds 5MB limit.');
        return;
      }
      
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setValidationError('Invalid file type. Please upload an image or PDF.');
        return;
      }

      setSelectedFile(file);
      startProcessing(file);
    }
  };
  const handleFileUpload = handleFileChange;

  const startProcessing = async (file: File) => {
    setUploadError(false);
    setStep('processing');
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (session?.id) {
        formData.append('session_id', session.id);
      }

      const res = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error('Failed to upload document');
      
      const data = await res.json();
      if (data.document_id) {
        setDocumentId(data.document_id);
      } else {
        throw new Error('No document_id');
      }
    } catch (err) {
      console.error(err);
      setUploadError(true);
      setStep('upload');
      setIsProcessing(false);
      return;
    }

    try {
      let text = '';
      
      // Try Sarvam OCR backend
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        setProgress(30); // Simulated progress

        const ocrRes = await fetch(`${API_URL}/ocr-vision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64 })
        });
        
        if (ocrRes.ok) {
          const ocrData = await ocrRes.json();
          if (ocrData.text && !ocrData.fallback) {
            text = ocrData.text;
            setProgress(100);
          }
        }
      } catch (backendErr) {
        console.warn('Backend OCR failed, falling back to Tesseract', backendErr);
      }

      // Fallback to Tesseract
      if (!text) {
        const tesseractRes = await Tesseract.recognize(
          file,
          'eng+hin',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                // scale remaining 70% progress
                setProgress(30 + Math.round(m.progress * 70));
              }
            }
          }
        );
        text = tesseractRes.data.text;
      }

      setRawText(text);

      // Try AI Extraction via Gemini
      try {
        const geminiRes = await fetch(`${API_URL}/api/gemini/extract-entities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (geminiRes.ok) {
          const aiData = await geminiRes.json();
          const docType = aiData.document_type || 'Unknown Document';
          const nameVal = aiData.patient_name || '';
          const diagVal = (aiData.diagnoses || []).join(', ');
          const procVal = (aiData.procedures || []).join(', ');
          
          let medsVal = '';
          if (aiData.medications && Array.isArray(aiData.medications)) {
            medsVal = aiData.medications.map((m: any) => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`.trim()).join(', ');
          }

          let labsVal = '';
          if (aiData.lab_results && Array.isArray(aiData.lab_results)) {
            labsVal = aiData.lab_results.map((l: any) => `${l.test_name}: ${l.value} (${l.reference_range || ''})`.trim()).join(', ');
          }

          setExtractions([
            { field_name: 'Document Type', field_value: docType, raw_text: text, confidence: docType !== 'Unknown Document' ? 0.95 : 0.4 },
            { field_name: 'Patient Name', field_value: nameVal, raw_text: text, confidence: nameVal ? 0.95 : 0 },
            { field_name: 'Diagnosis', field_value: diagVal, raw_text: text, confidence: diagVal ? 0.95 : 0 },
            { field_name: 'Procedures', field_value: procVal, raw_text: text, confidence: procVal ? 0.95 : 0 },
            { field_name: 'Medications', field_value: medsVal, raw_text: text, confidence: medsVal ? 0.95 : 0 },
            ...(labsVal ? [{ field_name: 'Lab Results', field_value: labsVal, raw_text: text, confidence: 0.95 }] : [])
          ]);
        } else {
          throw new Error('Gemini API returned error');
        }
      } catch (geminiErr) {
        console.warn('Gemini extraction failed, falling back to regex', geminiErr);
        
        // Fallback: basic regex extraction
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        let nameVal = '';
        let diagVal = '';
        let medsVal = '';
        let procVal = '';
        let docType = 'Unknown Document';
        
        const fullTextLower = text.toLowerCase();
        if (fullTextLower.includes('discharge') || fullTextLower.includes('summary')) docType = 'Discharge Summary';
        else if (fullTextLower.includes('lab') || fullTextLower.includes('report') || fullTextLower.includes('pathology')) docType = 'Lab Report';
        else if (fullTextLower.includes('rx') || fullTextLower.includes('prescription') || fullTextLower.includes('clinic')) docType = 'Prescription';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase().trim();
          
          if (lowerLine.includes('patient:') || lowerLine.includes('name:')) {
            nameVal = line.split(/[:]/)[1]?.trim() || line;
          } else if (lowerLine === 'patient' || lowerLine === 'name') {
            if (i + 1 < lines.length) nameVal = lines[i + 1].replace(/DATE/ig, '').trim();
          }

          if (lowerLine.includes('diagnosis:') || lowerLine.includes('dx:')) {
            diagVal = line.split(/[:]/)[1]?.trim() || line;
          } else if (lowerLine === 'diagnosis' || lowerLine === 'dx') {
            if (i + 1 < lines.length) diagVal = lines[i + 1].trim();
          }

          if (lowerLine.includes('procedure:') || lowerLine.includes('surgery:') || lowerLine.includes('operation:')) {
            procVal += (procVal ? ', ' : '') + (line.split(/[:]/)[1]?.trim() || '');
          }

          if (
            lowerLine.includes('rx:') || lowerLine.includes('tab') || lowerLine.includes('cap') || 
            lowerLine.includes('mg') || lowerLine.includes('ml') || lowerLine.includes('syrup')
          ) {
            if (!lowerLine.includes('drug dosage') && !lowerLine.includes('medications')) {
              medsVal += (medsVal ? ', ' : '') + line.trim();
            }
          }
        }

        setExtractions([
          { field_name: 'Document Type', field_value: docType, raw_text: text, confidence: docType !== 'Unknown Document' ? 0.9 : 0.4 },
          { field_name: 'Patient Name', field_value: nameVal || '', raw_text: text, confidence: nameVal ? 0.8 : 0 },
          { field_name: 'Diagnosis', field_value: diagVal || '', raw_text: text, confidence: diagVal ? 0.7 : 0 },
          { field_name: 'Procedures', field_value: procVal || '', raw_text: text, confidence: procVal ? 0.75 : 0 },
          { field_name: 'Medications', field_value: medsVal || '', raw_text: text, confidence: medsVal ? 0.75 : 0 }
        ]);
      }


      setStep('correction');
    } catch (err) {
      console.error('OCR Processing error:', err);
      setUploadError(true);
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateExtraction = (idx: number, val: string) => {
    setExtractions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], field_value: val, confidence: 1 };
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await fetch(`${API_URL}/documents/extractions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          session_id: session?.id,
          extractions
        })
      });
      setStep('success');
      setTimeout(() => {
        navigate('/medical-history');
      }, 1000);
    } catch (err) {
      console.error(err);
      navigate('/medical-history');
    }
  };

  if (!session) return null;

  // headerTitle removed – was unused

  return (
    <div className="min-h-screen bg-sand flex flex-col p-6 relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      
      <div className="z-10 w-full max-w-4xl mx-auto mt-8 flex flex-col gap-6">
        
        {step === 'upload' && (
          <QuestionCard className="text-center p-8 sm:p-12">
            <div className="flex justify-between items-start mb-4">
              <div className="mb-8 text-left">
                <h1 className="font-display text-3xl sm:text-4xl text-charcoal mb-2">
                  {t('upload.title')}
                </h1>
                <p className="text-muted text-sm sm:text-base">
                  {t('upload.subtitle')}
                </p>
              </div>
              <button
                onClick={() => speak(t('upload.title') + '. ' + t('upload.subtitle'), session.language === 'hi' ? 'hi-IN' : 'en-US')}
                className="w-11 h-11 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center shrink-0"
                title="Listen to instruction"
              >
                {isPlaying ? <VolumeX className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            {validationError && (
              <div className="bg-danger/10 text-danger p-4 rounded-xl mb-6 flex flex-col items-center border border-danger/20">
                <AlertTriangle className="w-6 h-6 mb-2" />
                <p className="font-bold">{validationError}</p>
              </div>
            )}

            {uploadError && (
              <div className="bg-danger/10 text-danger p-6 rounded-2xl mb-8 flex flex-col items-center border border-danger/20">
                <AlertTriangle className="w-8 h-8 mb-2" />
                <p className="font-bold text-lg">Failed to upload document</p>
                <p className="text-sm mt-1 mb-6 text-danger/80">Please check your connection and try again.</p>
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button onClick={() => selectedFile && startProcessing(selectedFile)} className="px-6 py-3 font-bold bg-danger text-white rounded-xl hover:bg-danger/90">
                    Retry Upload
                  </button>
                  <button onClick={() => navigate('/medical-history')} className="px-6 py-3 font-bold bg-white text-danger border-2 border-danger rounded-xl hover:bg-danger/5">
                    Skip Document
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-64 min-h-[140px] rounded-[16px] bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 flex flex-col items-center justify-center transition-colors shadow-xs"
              >
                <Camera className="w-10 h-10 text-primary mb-3" />
                <span className="text-lg font-bold text-primary">Open Camera</span>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-64 min-h-[140px] rounded-[16px] bg-white hover:bg-sand border-2 border-warmgray flex flex-col items-center justify-center transition-colors shadow-xs"
              >
                <UploadCloud className="w-10 h-10 text-muted mb-3" />
                <span className="text-lg font-bold text-charcoal">{t('upload.button')}</span>
              </button>
            </div>
            
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />

            {/* Voice ASR Input Bar */}
            <div className="flex flex-col items-center mt-8 pt-4 border-t border-warmgray/60 w-full">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => (isListening ? stopListening() : startListening({ lang: session.language === 'hi' ? 'hi-IN' : 'en-IN' }))}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                    isListening 
                      ? 'bg-primary text-white scale-105 ring-2 ring-primary/40' 
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                  title="Voice command"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <div className="text-left">
                  <p className="text-xs font-semibold text-charcoal">{isListening ? 'Listening...' : 'Voice Input (ASR)'}</p>
                  <p className="text-xs text-muted">Say "Camera", "Upload", or "Skip"</p>
                </div>
              </div>
              {transcript && (
                <p className="mt-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                  "{transcript}"
                </p>
              )}
            </div>

            <div className="mt-6">
              <button 
                onClick={() => navigate('/medical-history')}
                className="text-muted hover:text-charcoal underline underline-offset-4 text-sm"
              >
                {t('upload.skip')}
              </button>
            </div>
          </QuestionCard>
        )}

        {step === 'processing' && (
          <QuestionCard className="text-center p-16">
             <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
             <h2 className="font-display text-3xl text-charcoal mb-4">{t('upload.processing')}</h2>
             <div className="w-full max-w-md mx-auto bg-warmgray rounded-full h-4 mb-4 overflow-hidden">
               <div className="bg-primary h-4 transition-all duration-300" style={{ width: `${progress}%` }}></div>
             </div>
             <p className="text-primary font-bold text-lg">{progress}% Complete</p>
          </QuestionCard>
        )}

        {step === 'correction' && (
          <QuestionCard className="p-8">
            <h2 className="font-display text-3xl text-charcoal mb-2">{t('upload.correction')}</h2>
            <p className="text-muted mb-6">{t('upload.correction_sub')}</p>

            {extractions.every(e => !e.field_value) && (
              <div className="bg-terracotta/10 text-terracotta p-4 rounded-xl mb-8 flex flex-col items-center text-center border border-terracotta/20">
                <AlertTriangle className="w-6 h-6 mb-2" />
                <p className="font-bold">Could not automatically extract all fields</p>
                <p className="text-sm mt-1">Please enter the information manually or confirm to proceed.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-sand/50 p-6 rounded-[12px] border border-warmgray max-h-[360px] overflow-y-auto">
                 <h3 className="font-bold text-charcoal mb-3">Raw Scanned Text</h3>
                 <pre className="text-xs text-muted whitespace-pre-wrap font-sans">
                   {rawText || 'No text could be extracted.'}
                 </pre>
               </div>

               <div className="space-y-4">
                 {extractions.map((field, idx) => (
                   <div key={field.field_name} className="flex flex-col">
                     <label className="text-sm font-semibold text-charcoal mb-1 flex items-center justify-between">
                       <span>{field.field_name}</span>
                       {field.confidence < 0.5 && field.field_value ? (
                         <span className="flex items-center gap-1 text-danger text-xs px-2 py-0.5 bg-danger/10 rounded-full">
                           <AlertTriangle className="w-3 h-3" /> Low Confidence
                         </span>
                       ) : null}
                     </label>
                     <input
                       type="text"
                       className="p-3 border-2 border-warmgray rounded-[12px] text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                       value={field.field_value}
                       onChange={e => updateExtraction(idx, e.target.value)}
                       placeholder={`Enter ${field.field_name.toLowerCase()}`}
                     />
                   </div>
                 ))}

                 <button 
                   onClick={handleSave}
                   className="w-full p-4 mt-4 bg-primary text-white text-lg font-bold rounded-[12px] hover:bg-primary/90 transition-colors shadow-xs"
                 >
                   Confirm & Save (or say "Save")
                 </button>
               </div>
            </div>
          </QuestionCard>
        )}

        {step === 'success' && (
          <QuestionCard className="text-center p-16">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="font-display text-3xl text-charcoal mb-2">Saved Successfully</h2>
            <p className="text-muted text-base">Routing you to Medical History...</p>
          </QuestionCard>
        )}

      </div>
    </div>
  );
}

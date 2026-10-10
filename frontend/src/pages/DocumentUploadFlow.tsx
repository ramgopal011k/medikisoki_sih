import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { 
  Camera, 
  UploadCloud, 
  CheckCircle, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Mic, 
  Trash2, 
  RotateCw, 
  FileText, 
  Plus 
} from 'lucide-react';
import { MandalaBackground } from '../components/MandalaBackground';
import { QuestionCard } from '../components/QuestionCard';
import { useAsr } from '@/hooks/useAsr';
import { cleanTranscript } from '@/lib/transcriptCleaner';
import { useAudio } from '@/hooks/useAudio';
import { API_URL } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { VoiceGuideButton } from '../components/VoiceGuideButton';

interface ExtractedField {
  field_name: string;
  field_value: string;
  raw_text: string;
  confidence: number;
  normalized?: any;
}

export interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'extracting' | 'done' | 'failed' | 'skipped';
  progress: number;
  error?: string;
  documentId?: string;
  extractedDate?: string | null;
  extractions?: ExtractedField[];
  rawText?: string;
}

export default function DocumentUploadFlow() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [session] = useState(() => {
    const sessionId = sessionStorage.getItem('patient_session') || sessionStorage.getItem('session_id');
    const lang = localStorage.getItem('patient_language') || 'en';
    if (!sessionId) return null;
    return { id: sessionId, language: lang };
  });

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadItem[]>([]);
  const filesRef = useRef<UploadItem[]>(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const [rawText, setRawText] = useState('');
  const [extractedDate, setExtractedDate] = useState<string | null>(null);
  const [extractions, setExtractions] = useState<ExtractedField[]>([
    { field_name: 'Patient Name', field_value: '', raw_text: '', confidence: 1 },
    { field_name: 'Diagnosis', field_value: '', raw_text: '', confidence: 1 },
    { field_name: 'Medications', field_value: '', raw_text: '', confidence: 1 }
  ]);

  const [step, setStep] = useState<'upload' | 'correction' | 'success'>('upload');

  const { speak, isPlaying } = useAudio();
  const { isListening, transcript, startListening, stopListening } = useAsr();
  const { t } = useTranslation();

  const userLang = session?.language || localStorage.getItem('patient_language') || 'en';
  const isMr = userLang === 'mr';
  const isBn = userLang === 'bn';
  const isHi = userLang === 'hi';
  const ttsLang = isMr ? 'mr-IN' : isBn ? 'bn-IN' : isHi ? 'hi-IN' : 'en-IN';
  const activeLang = (isMr ? 'mr' : isBn ? 'bn' : isHi ? 'hi' : 'en') as 'en' | 'hi' | 'mr' | 'bn';

  useEffect(() => {
    if (!session) {
      navigate('/consent');
    }
  }, [session, navigate]);

  // Helper to update a single file item in state and ref
  const updateFileItem = (id: string, updates: Partial<UploadItem>) => {
    setFiles(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...updates } : item);
      filesRef.current = updated;
      return updated;
    });
  };

  // Voice ASR handler
  useEffect(() => {
    if (!transcript) return;
    const cleaned = cleanTranscript(transcript, { language: activeLang });
    const matchTranscript = cleaned || transcript;
    const lower = matchTranscript.toLowerCase();

    if (step === 'upload') {
      if (lower.includes('skip') || lower.includes('छोड़ें') || lower.includes('आगे') || 
          lower.includes('सोडा') || lower.includes('पुढे') || 
          lower.includes('বাদ') || lower.includes('পরবর্তী') || lower.includes('এড়িয়ে')) {
        navigate('/medical-history');
      } else if (lower.includes('camera') || lower.includes('photo') || lower.includes('picture') || 
                 lower.includes('कैमरा') || lower.includes('फोटो') || 
                 lower.includes('कॅमेरा') || lower.includes('ছবি') || lower.includes('ক্যামেরা')) {
        cameraInputRef.current?.click();
      } else if (lower.includes('upload') || lower.includes('दस्तावेज़') || lower.includes('अपलोड') || 
                 lower.includes('कागदपत्र') || lower.includes('নথি')) {
        fileInputRef.current?.click();
      }
    } else if (step === 'correction') {
      if (lower.includes('confirm') || lower.includes('save') || 
          lower.includes('सही') || lower.includes('सहेजें') || lower.includes('done') ||
          lower.includes('नक्की') || lower.includes('जतन') || 
          lower.includes('সংরক্ষণ') || lower.includes('নিশ্চিত')) {
        handleSave();
      }
    }
    // eslint-disable-next-line
  }, [transcript, step, navigate, activeLang]);

  // Validate and add files to the list
  const addFilesToQueue = (selectedFileList: FileList | File[]) => {
    setValidationError(null);
    setWarningMessage(null);

    const incoming = Array.from(selectedFileList);
    if (incoming.length === 0) return;

    const currentFiles = filesRef.current;
    const totalCount = currentFiles.length + incoming.length;

    let allowedIncoming = incoming;
    if (totalCount > 5) {
      setWarningMessage('Maximum 5 files allowed. First 5 files selected.');
      const slotsRemaining = Math.max(0, 5 - currentFiles.length);
      allowedIncoming = incoming.slice(0, slotsRemaining);
    }

    if (allowedIncoming.length === 0) return;

    const newItems: UploadItem[] = allowedIncoming.map((file, idx) => {
      const id = `${file.name}-${file.size}-${Date.now()}-${idx}`;
      
      const isValidType = 
        file.type === 'application/pdf' || 
        file.type.startsWith('image/jpeg') || 
        file.type.startsWith('image/png') || 
        file.type.startsWith('image/jpg') ||
        /\.(pdf|jpe?g|png)$/i.test(file.name);

      const isUnder20MB = file.size <= 20 * 1024 * 1024;

      if (!isValidType) {
        return {
          id,
          file,
          status: 'failed',
          progress: 0,
          error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.'
        };
      }

      if (!isUnder20MB) {
        return {
          id,
          file,
          status: 'failed',
          progress: 0,
          error: 'File size exceeds 20MB limit.'
        };
      }

      return {
        id,
        file,
        status: 'pending',
        progress: 0
      };
    });

    setFiles(prev => {
      const updated = [...prev, ...newItems];
      filesRef.current = updated;
      return updated;
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFilesToQueue(e.target.files);
    }
  };

  const handleCameraUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFilesToQueue([e.target.files[0]]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      filesRef.current = updated;
      return updated;
    });
  };

  const skipFile = (id: string) => {
    updateFileItem(id, { status: 'skipped', error: undefined });
  };

  const retryFile = (id: string) => {
    updateFileItem(id, { status: 'pending', error: undefined, progress: 0 });
    setTimeout(() => {
      startSequentialProcessing();
    }, 50);
  };

  // Sequential processing loop
  const startSequentialProcessing = async () => {
    if (isProcessingQueue) return;
    setIsProcessingQueue(true);

    // Continue processing as long as there is any pending item
    while (true) {
      const nextPending = filesRef.current.find(f => f.status === 'pending');
      if (!nextPending) break;

      const item = nextPending;
      console.log('[UPLOAD FLOW] Processing next file:', item.file.name, item.status);
      updateFileItem(item.id, { status: 'uploading', progress: 15, error: undefined });

      let docId: string | null = null;
      // Step 1: Upload
      try {
        console.log('[UPLOAD FLOW] Calling /api/documents/upload for:', item.file.name);
        const formData = new FormData();
        formData.append('file', item.file);
        if (session?.id) {
          formData.append('session_id', session.id);
        }

        const res = await fetch(`${API_URL}/api/documents/upload`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) throw new Error('Failed to upload document');
        const data = await res.json();
        if (!data.document_id) throw new Error('No document_id returned');
        docId = data.document_id;
        setDocumentId(docId);
        updateFileItem(item.id, { documentId: docId || undefined, progress: 35 });
        console.log('[UPLOAD FLOW] Upload success for:', item.file.name, 'docId:', docId);
      } catch (err: any) {
        console.error(`Upload error for ${item.file.name}:`, err);
        updateFileItem(item.id, { status: 'failed', error: err?.message || 'Failed to upload document' });
        continue; // Process next file sequentially
      }

      // Step 2: Extract
      console.log('[UPLOAD FLOW] Starting extraction for:', item.file.name);
      updateFileItem(item.id, { status: 'extracting', progress: 45 });

      try {
        let text = '';
        let backendLabResults: any[] = [];
        let backendDocType = '';
        let backendPatientName = '';
        let itemExtractedDate: string | null = null;

        // Try Backend OCR
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(item.file);
          const base64 = await base64Promise;

          updateFileItem(item.id, { progress: 60 });

          const ocrRes = await fetch(`${API_URL}/ocr-vision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: base64 })
          });

          if (ocrRes.ok) {
            const ocrData = await ocrRes.json();
            if (ocrData.text) text = ocrData.text;
            if (ocrData.document_type) backendDocType = ocrData.document_type;
            if (ocrData.patient_name) backendPatientName = ocrData.patient_name;
            if (ocrData.extracted_date) itemExtractedDate = ocrData.extracted_date;
            if (Array.isArray(ocrData.results) && ocrData.results.length > 0) {
              backendLabResults = ocrData.results;
            } else if (Array.isArray(ocrData.lab_results) && ocrData.lab_results.length > 0) {
              backendLabResults = ocrData.lab_results;
            }
          }
        } catch (backendErr) {
          console.warn('Backend OCR failed, checking fallback', backendErr);
        }

        // Client Tesseract fallback for images only
        if (!text && item.file.type.startsWith('image/')) {
          try {
            const tesseractRes = await Tesseract.recognize(
              item.file,
              'eng+hin',
              {
                logger: m => {
                  if (m.status === 'recognizing text') {
                    updateFileItem(item.id, { progress: 60 + Math.round(m.progress * 30) });
                  }
                }
              }
            );
            text = tesseractRes.data.text;
          } catch (tessErr) {
            console.warn('Client Tesseract failed:', tessErr);
          }
        }

        updateFileItem(item.id, { rawText: text, progress: 80 });

        // Entity extraction
        let itemExtractions: ExtractedField[] = [];
        try {
          if (!text) throw new Error('No text to extract');

          const geminiRes = await fetch(`${API_URL}/api/gemini/extract-entities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          });

          if (geminiRes.ok) {
            const aiData = await geminiRes.json();
            const docType = aiData.document_type || backendDocType || 'Unknown Document';
            const nameVal = aiData.patient_name || backendPatientName || '';
            const diagVal = (aiData.diagnoses || []).join(', ');
            const procVal = (aiData.procedures || []).join(', ');
            
            let medsVal = '';
            if (aiData.medications && Array.isArray(aiData.medications)) {
              medsVal = aiData.medications.map((m: any) => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`.trim()).join(', ');
            }

            let labsVal = '';
            const labFieldExtractions: any[] = [];
            const finalLabResults = (aiData.lab_results && aiData.lab_results.length > 0) ? aiData.lab_results : backendLabResults;
            if (finalLabResults && Array.isArray(finalLabResults) && finalLabResults.length > 0) {
              labsVal = finalLabResults.map((l: any) => {
                const ref = l.reference_range || l.ref_text || '';
                const unit = l.unit || '';
                return `${l.test_name}: ${l.value}${unit ? ` ${unit}` : ''} (${ref ? `Ref: ${ref}` : 'Ref: —'})`.trim();
              }).join(', ');
              finalLabResults.forEach((l: any) => {
                const ref = l.reference_range || l.ref_text || '';
                const unit = l.unit || '';
                labFieldExtractions.push({
                  field_name: `Lab: ${l.test_name}`,
                  field_value: `${l.value}${unit ? ` ${unit}` : ''} (${ref ? `Ref: ${ref}` : 'Ref: —'})`,
                  raw_text: text,
                  confidence: 0.95,
                  normalized: l.normalized || {
                    value: typeof l.value === 'number' ? l.value : parseFloat(l.value) || null,
                    unit: l.unit || '',
                    low: l.ref_low ?? null,
                    high: l.ref_high ?? null,
                    flag: l.flag || 'unknown'
                  }
                });
              });
            }

            itemExtractions = [
              { field_name: 'Document Type', field_value: docType, raw_text: text, confidence: docType !== 'Unknown Document' ? 0.95 : 0.4 },
              { field_name: 'Patient Name', field_value: nameVal, raw_text: text, confidence: nameVal ? 0.95 : 0 },
              { field_name: 'Diagnosis', field_value: diagVal, raw_text: text, confidence: diagVal ? 0.95 : 0 },
              { field_name: 'Procedures', field_value: procVal, raw_text: text, confidence: procVal ? 0.95 : 0 },
              { field_name: 'Medications', field_value: medsVal, raw_text: text, confidence: medsVal ? 0.95 : 0 },
              ...(labsVal ? [{ field_name: 'Lab Results', field_value: labsVal, raw_text: text, confidence: 0.95 }] : []),
              ...labFieldExtractions
            ];
          } else {
            throw new Error('Gemini API returned error');
          }
        } catch (geminiErr) {
          console.warn('Gemini extraction fallback to regex/backend results', geminiErr);
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          let nameVal = backendPatientName || '';
          let diagVal = '';
          let medsVal = '';
          let procVal = '';
          let docType = backendDocType || 'Unknown Document';

          const fullTextLower = text.toLowerCase();
          if (fullTextLower.includes('discharge') || fullTextLower.includes('summary')) docType = 'Discharge Summary';
          else if (fullTextLower.includes('lab') || fullTextLower.includes('report') || fullTextLower.includes('pathology') || backendLabResults.length > 0) docType = 'Lab Report';
          else if (fullTextLower.includes('rx') || fullTextLower.includes('prescription') || fullTextLower.includes('clinic')) docType = 'Prescription';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase().trim();
            if (!nameVal && (lowerLine.includes('patient:') || lowerLine.includes('name:'))) {
              nameVal = line.split(/[:]/)[1]?.trim() || line;
            } else if (!nameVal && (lowerLine === 'patient' || lowerLine === 'name')) {
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

          let labsVal = '';
          const labFieldExtractions: any[] = [];
          if (backendLabResults && Array.isArray(backendLabResults) && backendLabResults.length > 0) {
            labsVal = backendLabResults.map((l: any) => {
              const ref = l.reference_range || l.ref_text || '';
              const unit = l.unit || '';
              return `${l.test_name}: ${l.value}${unit ? ` ${unit}` : ''} (${ref ? `Ref: ${ref}` : 'Ref: —'})`.trim();
            }).join(', ');
            backendLabResults.forEach((l: any) => {
              const ref = l.reference_range || l.ref_text || '';
              const unit = l.unit || '';
              labFieldExtractions.push({
                field_name: `Lab: ${l.test_name}`,
                field_value: `${l.value}${unit ? ` ${unit}` : ''} (${ref ? `Ref: ${ref}` : 'Ref: —'})`,
                raw_text: text,
                confidence: 0.95,
                normalized: {
                  value: typeof l.value === 'number' ? l.value : parseFloat(l.value) || null,
                  unit: l.unit || '',
                  low: l.ref_low ?? null,
                  high: l.ref_high ?? null,
                  flag: l.flag || 'unknown'
                }
              });
            });
          }

          itemExtractions = [
            { field_name: 'Document Type', field_value: docType, raw_text: text, confidence: docType !== 'Unknown Document' ? 0.9 : 0.4 },
            { field_name: 'Patient Name', field_value: nameVal || '', raw_text: text, confidence: nameVal ? 0.8 : 0 },
            { field_name: 'Diagnosis', field_value: diagVal || '', raw_text: text, confidence: diagVal ? 0.7 : 0 },
            { field_name: 'Procedures', field_value: procVal || '', raw_text: text, confidence: procVal ? 0.75 : 0 },
            { field_name: 'Medications', field_value: medsVal || '', raw_text: text, confidence: medsVal ? 0.75 : 0 },
            ...(labsVal ? [{ field_name: 'Lab Results', field_value: labsVal, raw_text: text, confidence: 0.95 }] : []),
            ...labFieldExtractions
          ];
        }

        // Persist extractions for this document right away
        if (docId) {
          try {
            await fetch(`${API_URL}/documents/extractions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                document_id: docId,
                session_id: session?.id,
                extractions: itemExtractions,
                extracted_date: itemExtractedDate
              })
            });
          } catch (persistErr) {
            console.warn('Failed to persist extractions immediately:', persistErr);
          }
        }

        console.log('[UPLOAD FLOW] Completed extraction for:', item.file.name, 'marking as done');
        updateFileItem(item.id, {
          status: 'done',
          progress: 100,
          extractions: itemExtractions,
          extractedDate: itemExtractedDate,
          rawText: text
        });

      } catch (err: any) {
        console.error(`[UPLOAD FLOW] Extraction error for ${item.file.name}:`, err);
        updateFileItem(item.id, { 
          status: 'failed', 
          error: err?.message || 'Failed to extract text from document' 
        });
      }
    }

    setIsProcessingQueue(false);
  };

  // Preserved single-file flow fallback
  const startProcessing = async (file: File) => {
    addFilesToQueue([file]);
    setTimeout(() => {
      startSequentialProcessing();
    }, 50);
  };

  const handleContinue = () => {
    const doneFiles = files.filter(f => f.status === 'done');
    if (doneFiles.length === 0) {
      navigate('/medical-history');
      return;
    }

    // Combine raw text
    const combinedRawText = doneFiles
      .map(f => `=== ${f.file.name} ===\n${f.rawText || ''}`)
      .join('\n\n');
    setRawText(combinedRawText);

    // Combine extractions across all done files
    const aggregatedDocType = Array.from(
      new Set(doneFiles.map(f => f.extractions?.find(e => e.field_name === 'Document Type')?.field_value).filter(Boolean))
    ).join(', ') || 'Medical Document';

    const aggregatedPatientName = doneFiles
      .map(f => f.extractions?.find(e => e.field_name === 'Patient Name')?.field_value)
      .find(Boolean) || '';

    const aggregatedDiagnosis = Array.from(
      new Set(
        doneFiles.flatMap(f => 
          (f.extractions?.find(e => e.field_name === 'Diagnosis')?.field_value || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        )
      )
    ).join(', ');

    const aggregatedProcedures = Array.from(
      new Set(
        doneFiles.flatMap(f => 
          (f.extractions?.find(e => e.field_name === 'Procedures')?.field_value || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        )
      )
    ).join(', ');

    const aggregatedMeds = Array.from(
      new Set(
        doneFiles.flatMap(f => 
          (f.extractions?.find(e => e.field_name === 'Medications')?.field_value || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        )
      )
    ).join(', ');

    const allLabItems: ExtractedField[] = [];
    const seenLabNames = new Set<string>();
    doneFiles.forEach(f => {
      (f.extractions || []).forEach(e => {
        if (e.field_name.startsWith('Lab:') && !seenLabNames.has(e.field_name)) {
          seenLabNames.add(e.field_name);
          allLabItems.push(e);
        }
      });
    });

    const aggregatedLabResults = allLabItems.map(l => l.field_value).join(', ');

    const finalExtractions: ExtractedField[] = [
      { field_name: 'Document Type', field_value: aggregatedDocType, raw_text: combinedRawText, confidence: 0.95 },
      { field_name: 'Patient Name', field_value: aggregatedPatientName, raw_text: combinedRawText, confidence: aggregatedPatientName ? 0.95 : 0 },
      { field_name: 'Diagnosis', field_value: aggregatedDiagnosis, raw_text: combinedRawText, confidence: aggregatedDiagnosis ? 0.95 : 0 },
      { field_name: 'Procedures', field_value: aggregatedProcedures, raw_text: combinedRawText, confidence: aggregatedProcedures ? 0.95 : 0 },
      { field_name: 'Medications', field_value: aggregatedMeds, raw_text: combinedRawText, confidence: aggregatedMeds ? 0.95 : 0 },
      ...(aggregatedLabResults ? [{ field_name: 'Lab Results', field_value: aggregatedLabResults, raw_text: combinedRawText, confidence: 0.95 }] : []),
      ...allLabItems
    ];

    setExtractions(finalExtractions);
    setExtractedDate(doneFiles.map(f => f.extractedDate).find(Boolean) || null);
    setStep('correction');
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
      const doneFiles = files.filter(f => f.status === 'done');
      for (const f of doneFiles) {
        if (f.documentId) {
          await fetch(`${API_URL}/documents/extractions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_id: f.documentId,
              session_id: session?.id,
              extractions,
              extracted_date: f.extractedDate || extractedDate
            })
          });
        }
      }

      if (documentId && !doneFiles.some(f => f.documentId === documentId)) {
        await fetch(`${API_URL}/documents/extractions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: documentId,
            session_id: session?.id,
            extractions,
            extracted_date: extractedDate
          })
        });
      }

      setStep('success');
      setTimeout(() => {
        navigate('/medical-history');
      }, 1000);
    } catch (err) {
      console.error('Save error:', err);
      navigate('/medical-history');
    }
  };

  if (!session) return null;

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const doneCount = files.filter(f => f.status === 'done').length;
  const allDoneOrSkipped = files.length > 0 && files.every(f => f.status === 'done' || f.status === 'skipped');

  return (
    <div className="min-h-screen bg-sand flex flex-col p-6 relative overflow-hidden font-body text-charcoal">
      <MandalaBackground />
      
      <div className="z-10 w-full max-w-4xl mx-auto mt-8 flex flex-col gap-6">
        
        {step === 'upload' && (
          <QuestionCard className="text-center p-8 sm:p-12">
            <div className="flex justify-between items-start mb-4">
              <div className="mb-6 text-left">
                <h1 className="font-display text-3xl sm:text-4xl text-charcoal mb-2">
                  {files.length === 0 ? t('upload.title') : (isMr ? 'वैद्यकीय कागदपत्रे अपलोड करा' : isBn ? 'চিকিৎসা সংক্রান্ত নথি আপলোড করুন' : isHi ? 'चिकित्सा दस्तावेज़ अपलोड करें' : 'Upload Medical Documents')}
                </h1>
                <p className="text-muted text-sm sm:text-base">
                  {files.length === 0 
                    ? t('upload.subtitle') 
                    : (isMr 
                        ? `एकामागून एक अपलोड करा (कमाल 5 फाइल्स). ${files.length} पैकी ${doneCount} पूर्ण.` 
                        : isBn 
                        ? `ধারাবাহিকভাবে আপলোড করুন (সর্বোচ্চ ৫টি ফাইল)। ${files.length} টির মধ্যে ${doneCount} সম্পন্ন।`
                        : isHi 
                        ? `क्रमशः अपलोड करें (अधिकतम 5 फाइलें)। ${files.length} में से ${doneCount} संसाधित।` 
                        : `Upload sequentially (Max 5 files). ${doneCount} of ${files.length} processed.`)}
                </p>
              </div>
              <button
                onClick={() => speak(t('upload.title') + '. ' + t('upload.subtitle'), ttsLang, 'document_upload')}
                className="w-11 h-11 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center shrink-0"
                title="Listen to instruction"
              >
                {isPlaying ? <VolumeX className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            {/* Warning Message (e.g. >5 files selected) */}
            {warningMessage && (
              <div className="bg-amber-50 text-amber-800 border border-amber-300 p-4 rounded-xl mb-6 flex items-center gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="font-semibold text-sm">{warningMessage}</p>
              </div>
            )}

            {/* Validation Error */}
            {validationError && (
              <div className="bg-danger/10 text-danger p-4 rounded-xl mb-6 flex items-center gap-3 text-left border border-danger/20">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="font-bold text-sm">{validationError}</p>
              </div>
            )}

            {/* Initial Selection Buttons (if no files chosen yet) */}
            {files.length === 0 && (
              <div className="flex flex-col sm:flex-row gap-6 justify-center my-4">
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-64 min-h-[140px] rounded-[16px] bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 flex flex-col items-center justify-center transition-colors shadow-xs"
                >
                  <Camera className="w-10 h-10 text-primary mb-3" />
                  <span className="text-lg font-bold text-primary">{isMr ? 'कॅमेरा उघडा' : isBn ? 'ক্যামেরা খুলুন' : isHi ? 'कैमरा खोलें' : 'Open Camera'}</span>
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-64 min-h-[140px] rounded-[16px] bg-white hover:bg-sand border-2 border-warmgray flex flex-col items-center justify-center transition-colors shadow-xs"
                >
                  <UploadCloud className="w-10 h-10 text-muted mb-3" />
                  <span className="text-lg font-bold text-charcoal">{t('upload.button')} {isMr ? '(अनेक)' : isBn ? '(একাধিক)' : isHi ? '(एकाधिक)' : '(Multiple)'}</span>
                </button>
              </div>
            )}

            {/* File List View */}
            {files.length > 0 && (
              <div className="space-y-4 mb-6 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-warmgray">
                  <span className="text-sm font-bold text-charcoal">
                    {isMr ? `निवडलेली कागदपत्रे (${files.length}/5)` : isBn ? `নির্বাচিত নথি (${files.length}/৫)` : isHi ? `चयनित दस्तावेज़ (${files.length}/5)` : `Selected Documents (${files.length}/5)`}
                  </span>
                  {files.length < 5 && !isProcessingQueue && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> {isMr ? 'आणखी जोडा' : isBn ? 'আরও যোগ করুন' : isHi ? 'और जोड़ें' : 'Add more'}
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {files.map(item => (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        item.status === 'failed' 
                          ? 'bg-danger/5 border-danger/30' 
                          : item.status === 'done' 
                            ? 'bg-success/5 border-success/30' 
                            : item.status === 'uploading' || item.status === 'extracting'
                              ? 'bg-primary/5 border-primary/40 shadow-xs'
                              : 'bg-white border-warmgray'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className={`w-5 h-5 shrink-0 ${item.status === 'failed' ? 'text-danger' : item.status === 'done' ? 'text-success' : 'text-primary'}`} />
                          <div className="min-w-0">
                            <p className="font-semibold text-charcoal truncate text-sm sm:text-base">
                              {item.file.name}
                            </p>
                            <p className="text-xs text-muted">
                              {(item.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Per-file Status Badge */}
                          {item.status === 'pending' && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sand text-muted border border-warmgray">
                              {isMr ? 'प्रलंबित' : isBn ? 'অপেক্ষমাণ' : isHi ? 'लंबित' : 'pending'}
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                              {isMr ? 'अपलोड होत आहे' : isBn ? 'আপলোড হচ্ছে' : isHi ? 'अपलोड हो रहा है' : 'uploading'}
                            </span>
                          )}
                          {item.status === 'extracting' && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                              {isMr ? 'माहिती काढत आहे' : isBn ? 'তথ্য বের করা হচ্ছে' : isHi ? 'जानकारी निकाली जा रही है' : 'extracting'}
                            </span>
                          )}
                          {item.status === 'done' && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> {isMr ? 'पूर्ण' : isBn ? 'সম্পন্ন' : isHi ? 'पूर्ण' : 'done'}
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-danger/15 text-danger border border-danger/30 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> {isMr ? 'अयशस्वी' : isBn ? 'ব্যর্থ' : isHi ? 'विफल' : 'failed'}
                            </span>
                          )}
                          {item.status === 'skipped' && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-300">
                              {isMr ? 'वगळले' : isBn ? 'বাদ দেওয়া হয়েছে' : isHi ? 'छोड़ दिया' : 'skipped'}
                            </span>
                          )}

                          {/* Remove button before upload starts */}
                          {item.status === 'pending' && !isProcessingQueue && (
                            <button
                              onClick={() => removeFile(item.id)}
                              className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-danger/5 transition-colors"
                              title="Remove file before upload"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Error and Retry / Skip for failed files */}
                      {item.status === 'failed' && (
                        <div className="mt-3 pt-3 border-t border-danger/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="text-xs font-medium text-danger flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {item.error || 'Failed to process document'}
                          </p>
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              onClick={() => retryFile(item.id)}
                              className="px-3 py-1 text-xs font-bold bg-danger/10 text-danger border border-danger/30 rounded-lg hover:bg-danger/20 transition-colors flex items-center gap-1"
                            >
                              <RotateCw className="w-3 h-3" /> {isMr ? 'पुन्हा प्रयत्न' : isBn ? 'পুনরায় চেষ্টা' : isHi ? 'पुनः प्रयास' : 'Retry'}
                            </button>
                            <button
                              onClick={() => skipFile(item.id)}
                              className="px-3 py-1 text-xs font-bold bg-sand text-muted border border-warmgray rounded-lg hover:bg-warmgray/40 transition-colors"
                            >
                              {isMr ? 'सोडा' : isBn ? 'বাদ দিন' : isHi ? 'छोड़ें' : 'Skip'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Queue Actions */}
                <div className="space-y-3 pt-2">
                  {pendingCount > 0 && !isProcessingQueue && (
                    <button 
                      onClick={startSequentialProcessing}
                      className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-xs flex items-center justify-center gap-2"
                    >
                      <UploadCloud className="w-5 h-5" />
                      {isMr ? `अपलोड सुरू करा (${pendingCount} प्रलंबित)` : isBn ? `আপলোড শুরু করুন (${pendingCount}টি অপেক্ষমাণ)` : isHi ? `अपलोड शुरू करें (${pendingCount} लंबित)` : `Start Upload (${pendingCount} pending)`}
                    </button>
                  )}

                  {isProcessingQueue && (
                    <div className="p-3 bg-primary/10 rounded-xl flex items-center justify-center gap-3 text-primary text-sm font-semibold">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>{isMr ? 'फाइल्सवर प्रक्रिया होत आहे... कृपया प्रतीक्षा करा.' : isBn ? 'ফাইল প্রসেসিং হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।' : isHi ? 'फाइलों को संसाधित किया जा रहा है... कृपया प्रतीक्षा करें।' : 'Processing files sequentially... Please wait.'}</span>
                    </div>
                  )}

                  {/* Continue Button */}
                  <button
                    onClick={handleContinue}
                    disabled={!allDoneOrSkipped}
                    className={`w-full py-4 font-bold text-lg rounded-xl transition-all shadow-xs ${
                      allDoneOrSkipped
                        ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
                        : 'bg-warmgray/40 text-muted cursor-not-allowed border border-warmgray'
                    }`}
                  >
                    {t('common.continue')}
                  </button>
                </div>
              </div>
            )}
            
            {/* Hidden file inputs */}
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
            />
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={cameraInputRef}
              onChange={handleCameraUpload}
            />

            {/* Voice ASR Input Bar */}
            <div className="flex flex-col items-center mt-8 pt-4 border-t border-warmgray/60 w-full">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => (isListening ? stopListening() : startListening({ lang: ttsLang }))}
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
                  <p className="text-xs font-semibold text-charcoal">
                    {isListening 
                      ? (isMr ? 'ऐकत आहे...' : isBn ? 'শুনছি...' : isHi ? 'सुन रहा है...' : 'Listening...')
                      : (isMr ? 'आवाज इनपुट (ASR)' : isBn ? 'ভয়েস ইনপুট (ASR)' : isHi ? 'आवाज इनपुट (ASR)' : 'Voice Input (ASR)')}
                  </p>
                  <p className="text-xs text-muted">
                    {isMr ? 'म्हणा "कॅमेरा", "अपलोड", किंवा "सोडा"' : isBn ? 'বলুন "ক্যামেরা", "আপলোড", অথবা "বাদ দিন"' : isHi ? 'बोलें "कैमरा", "अपलोड", या "छोड़ें"' : 'Say "Camera", "Upload", or "Skip"'}
                  </p>
                </div>
              </div>
              {transcript && (
                <div className="flex flex-col items-center mt-2">
                  <p className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                    "{transcript}"
                  </p>
                  {(() => {
                    const cleaned = cleanTranscript(transcript, { language: activeLang });
                    if (cleaned && cleaned !== transcript) {
                      return (
                        <p className="text-[10px] text-muted font-medium italic mt-0.5">
                          {isMr ? `संपादित: "${cleaned}"` : isBn ? `সংশোধিত: "${cleaned}"` : isHi ? `संशोधित: "${cleaned}"` : `Cleaned: "${cleaned}"`}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
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
                   <div key={`${field.field_name}-${idx}`} className="flex flex-col">
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
                   {isMr ? 'नक्की करा आणि जतन करा' : isBn ? 'নিশ্চিত করুন এবং সংরক্ষণ করুন' : isHi ? 'पुष्टि करें और सहेजें' : 'Confirm & Save (or say "Save")'}
                 </button>
               </div>
            </div>
          </QuestionCard>
        )}

        {step === 'success' && (
          <QuestionCard className="text-center p-16">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="font-display text-3xl text-charcoal mb-2">
              {isMr ? 'यशस्वीरित्या जतन झाले' : isBn ? 'সফলভাবে সংরক্ষিত হয়েছে' : isHi ? 'सफलतापूर्वक सहेजा गया' : 'Saved Successfully'}
            </h2>
            <p className="text-muted text-base">
              {isMr ? 'वैद्यकीय इतिहासाकडे नेत आहोत...' : isBn ? 'চিকিৎসা ইতিহাসে নিয়ে যাওয়া হচ্ছে...' : isHi ? 'मेडिकल इतिहास पर ले जा रहे हैं...' : 'Routing you to Medical History...'}
            </p>
          </QuestionCard>
        )}

      </div>
      <VoiceGuideButton clipId="document_upload" language={ttsLang} />
    </div>
  );
}

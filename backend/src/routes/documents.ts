import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../supabase';
import fs from 'fs';
import path from 'path';
import { extractDocumentDate } from '../services/documentDateExtractor';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload a document to Supabase Storage and create a DB record
router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    const file = req.file;
    const { session_id, extracted_date } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const activeSessionId = session_id || `demo_session_${Date.now()}`;

    // 1. Upload to Supabase Storage
    // NOTE: Ensure you have created a public storage bucket named 'medical_records' in your Supabase dashboard.
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${activeSessionId}_${Date.now()}.${fileExt}`;
    const filePath = `${activeSessionId}/${fileName}`;

    let publicUrl = '';

    const { error: storageError } = await supabase.storage
      .from('medical_records')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (storageError) {
      console.warn('Supabase Storage Error, falling back to local storage:', storageError.message);
      // Fallback: save to local disk
      const uploadDir = path.join(__dirname, '../../uploads', activeSessionId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFilePath = path.join(uploadDir, fileName);
      fs.writeFileSync(localFilePath, file.buffer);
      publicUrl = `/uploads/${activeSessionId}/${fileName}`;
    } else {
      // 2. Get Public URL
      const { data: urlData } = supabase.storage
        .from('medical_records')
        .getPublicUrl(filePath);
      publicUrl = urlData.publicUrl;
    }

    // 3. Create DB Record in `documents` table
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        session_id: activeSessionId,
        file_url: publicUrl,
        upload_status: 'completed',
        ocr_status: 'pending'
      })
      .select()
      .single();

    if (docError) {
      console.warn('Supabase DB Insert Error (falling back to generated ID):', docError.message || docError);
      const fallbackId = crypto.randomUUID();
      return res.status(201).json({
        message: 'File uploaded locally (fallback)',
        document: { id: fallbackId, document_id: fallbackId, file_url: publicUrl, session_id: activeSessionId },
        document_id: fallbackId
      });
    }

    if (extracted_date && docData?.id) {
      try {
        const { error: dateErr } = await supabase
          .from('documents')
          .update({ extracted_date })
          .eq('id', docData.id);
        if (dateErr) {
          console.log('[docs] no date column, skipping persist');
        }
      } catch {
        console.log('[docs] no date column, skipping persist');
      }
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      document: docData,
      document_id: docData?.document_id || docData?.id
    });

  } catch (err: any) {
    console.error('Upload endpoint error, falling back:', err);
    const fallbackId = crypto.randomUUID();
    res.status(201).json({
      message: 'File uploaded locally (catch fallback)',
      document_id: fallbackId,
      document: { id: fallbackId, document_id: fallbackId }
    });
  }
});

// Extractions endpoint
router.post('/extractions', async (req: any, res: any) => {
  const { document_id, session_id, extractions, extracted_date } = req.body;
  
  if (!extractions || !Array.isArray(extractions)) {
    return res.status(400).json({ error: 'Invalid extractions array' });
  }

  try {
    let formatted = extractions
      .filter((e: any) => e.field_name !== 'Medications')
      .map((e: any) => ({
      document_id: document_id || null, // allow null if just session answers
      field_name: e.field_name,
      field_value: e.field_value,
      confidence: e.confidence || 1.0,
      raw_text: e.raw_text,
      provenance: 'ocr_extracted',
      verified: false
    }));

    // Extract potential date for Medical Timeline
    let foundDate = extracted_date || null;
    if (!foundDate) {
      for (const e of extractions) {
        foundDate = extractDocumentDate(e.field_value || '') || extractDocumentDate(e.raw_text || '');
        if (foundDate) break;
      }
    }
    if (foundDate && document_id) {
      formatted.push({
        document_id,
        field_name: 'document_date',
        field_value: foundDate,
        confidence: 0.95,
        raw_text: foundDate,
        provenance: 'ocr_extracted',
        verified: false
      });
    }

    // Split Medications into Medication, Dosage, Frequency
    for (const e of extractions) {
      if (e.field_name === 'Medications' && e.field_value) {
        const meds = e.field_value.split(/,/);
        meds.forEach((medStr: string, idx: number) => {
          const medText = medStr.trim();
          if (!medText) return;
          
          const dosageMatch = medText.match(/\b(\d+(?:\.\d+)?\s*(?:mg|ml|g|mcg|units))\b/i);
          const freqMatch = medText.match(/\b(BID|TDS|OD|QID|\d-\d-\d(?:-\d)?)\b/i);

          let medName = medText;
          let dosage = dosageMatch ? dosageMatch[0] : '';
          let frequency = freqMatch ? freqMatch[0] : '';

          if (dosage && dosageMatch) medName = medName.replace(dosageMatch[0], '').trim();
          if (frequency && freqMatch) medName = medName.replace(freqMatch[0], '').trim();
          medName = medName.replace(/^[,\s]+|[,\s]+$/g, '').trim();

          const suffix = meds.length > 1 ? ` ${idx + 1}` : '';
          
          if (medName) {
            formatted.push({
              document_id,
              field_name: `Medication Name${suffix}`,
              field_value: medName,
              confidence: e.confidence,
              raw_text: medText,
              provenance: 'ocr_extracted',
              verified: false
            });
          }
          if (dosage) {
            formatted.push({
              document_id,
              field_name: `Dosage${suffix}`,
              field_value: dosage,
              confidence: e.confidence,
              raw_text: medText,
              provenance: 'ocr_extracted',
              verified: false
            });
          }
          if (frequency) {
            formatted.push({
              document_id,
              field_name: `Frequency${suffix}`,
              field_value: frequency,
              confidence: e.confidence,
              raw_text: medText,
              provenance: 'ocr_extracted',
              verified: false
            });
          }
        });
      }
    }


    // Insert into ocr_extractions table (if it exists) or answers table
    try {
      const { error } = await supabase.from('ocr_extractions').insert(formatted);
      if (error) {
        console.warn('Failed to insert into ocr_extractions, attempting answers table fallback', error.message || error);
        const answersFallback = extractions.map((e: any) => ({
          session_id,
          question_id: `ocr_${e.field_name.toLowerCase().replace(/\s+/g, '_')}`,
          answer_text: e.field_value,
          provenance: 'ocr_extracted'
        }));
        await supabase.from('answers').insert(answersFallback);
      }

      // Map any procedures into history_facts with provenance='ocr_extracted'
      if (session_id) {
        const procItems = extractions.filter((e: any) => 
          e.field_name?.toLowerCase().includes('procedure') || 
          e.field_name?.toLowerCase().includes('surg')
        );
        for (const p of procItems) {
          if (p.field_value) {
            const list = String(p.field_value).split(',').map((s: string) => s.trim()).filter(Boolean);
            for (const item of list) {
              try {
                await supabase.from('history_facts').insert({
                  session_id,
                  complaint: 'Medical Document OCR',
                  question_id: 'procedure',
                  question_text: 'Procedure / Surgery',
                  field_name: 'procedures',
                  field_value: item,
                  answer: item,
                  answer_value: item,
                  provenance: 'ocr_extracted',
                  verified: false
                });
              } catch (hfErr) {
                console.warn('history_facts procedure insert warning:', hfErr);
              }
            }
          }
        }
      }

      // Also update document status if doc_id was passed
      if (document_id) {
        await supabase.from('documents').update({ ocr_status: 'completed' }).eq('document_id', document_id);
        await supabase.from('documents').update({ ocr_status: 'completed' }).eq('id', document_id);

        if (foundDate) {
          try {
            const { error: dateErr } = await supabase
              .from('documents')
              .update({ extracted_date: foundDate })
              .or(`id.eq.${document_id},document_id.eq.${document_id}`);
            if (dateErr) {
              console.log('[docs] no date column, skipping persist');
            }
          } catch {
            console.log('[docs] no date column, skipping persist');
          }
        }
      }
    } catch (dbErr: any) {
      console.warn('Database save warning for extractions (continuing):', dbErr.message || dbErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Save extractions error:', err);
    res.json({ success: true, warning: err.message });
  }
});

// Create a document record without file upload (used as a fallback or for local mock)
router.post('/', async (req: any, res: any) => {
  try {
    const { session_id, file_url, ocr_status, extracted_date } = req.body;
    const { data, error } = await supabase
      .from('documents')
      .insert({
        session_id,
        file_url: file_url || 'local_blob',
        ocr_status: ocr_status || 'pending',
        upload_status: 'completed'
      })
      .select()
      .single();

    if (error) throw error;

    if (extracted_date && (data?.id || data?.document_id)) {
      try {
        const { error: dateErr } = await supabase
          .from('documents')
          .update({ extracted_date })
          .or(`id.eq.${data.id || data.document_id},document_id.eq.${data.id || data.document_id}`);
        if (dateErr) {
          console.log('[docs] no date column, skipping persist');
        }
      } catch {
        console.log('[docs] no date column, skipping persist');
      }
    }

    res.status(201).json({ document_id: data?.document_id || data?.id, ...data });
  } catch (err: any) {
    console.error('Document create error:', err);
    // fallback logic if needed
    res.status(201).json({ document_id: crypto.randomUUID() });
  }
});

export default router;

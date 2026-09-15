import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../supabase';
import fs from 'fs';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload a document to Supabase Storage and create a DB record
router.post('/upload', upload.single('file'), async (req: any, res: any) => {
  try {
    const file = req.file;
    const { session_id } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    // 1. Upload to Supabase Storage
    // NOTE: Ensure you have created a public storage bucket named 'medical_records' in your Supabase dashboard.
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${session_id}_${Date.now()}.${fileExt}`;
    const filePath = `${session_id}/${fileName}`;

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
      const uploadDir = path.join(__dirname, '../../uploads', session_id);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFilePath = path.join(uploadDir, fileName);
      fs.writeFileSync(localFilePath, file.buffer);
      publicUrl = `/uploads/${session_id}/${fileName}`;
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
        session_id,
        file_url: publicUrl,
        upload_status: 'completed',
        ocr_status: 'pending'
      })
      .select()
      .single();

    if (docError) {
      console.error('Supabase DB Insert Error:', docError);
      // We uploaded the file but failed to record it, still returning 500 but log is important
      return res.status(500).json({ error: 'Failed to save document record', details: docError });
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      document: docData,
      document_id: docData?.document_id || docData?.id
    });

  } catch (err: any) {
    console.error('Upload endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Extractions endpoint
router.post('/extractions', async (req: any, res: any) => {
  const { document_id, session_id, extractions } = req.body;
  
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
    let foundDate = null;
    const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/i;
    for (const e of extractions) {
      const match = (e.field_value || '').match(dateRegex) || (e.raw_text || '').match(dateRegex);
      if (match) {
        foundDate = match[0];
        break;
      }
    }
    if (foundDate && document_id) {
      formatted.push({
        document_id,
        field_name: 'document_date',
        field_value: foundDate,
        confidence: 0.8,
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
    const { error } = await supabase.from('ocr_extractions').insert(formatted);
    if (error) {
      console.warn('Failed to insert into ocr_extractions, attempting answers table fallback', error);
      // Fallback: save to answers
      const answersFallback = extractions.map((e: any) => ({
        session_id,
        question_id: `ocr_${e.field_name.toLowerCase().replace(/\s+/g, '_')}`,
        answer_text: e.field_value,
        provenance: 'ocr_extracted'
      }));
      await supabase.from('answers').insert(answersFallback);
    }

    // Also update document status if doc_id was passed
    if (document_id) {
      await supabase.from('documents').update({ ocr_status: 'completed' }).eq('document_id', document_id);
      await supabase.from('documents').update({ ocr_status: 'completed' }).eq('id', document_id);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Save extractions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a document record without file upload (used as a fallback or for local mock)
router.post('/', async (req: any, res: any) => {
  try {
    const { session_id, file_url, ocr_status } = req.body;
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
    res.status(201).json({ document_id: data?.document_id || data?.id, ...data });
  } catch (err: any) {
    console.error('Document create error:', err);
    // fallback logic if needed
    res.status(201).json({ document_id: crypto.randomUUID() });
  }
});

export default router;

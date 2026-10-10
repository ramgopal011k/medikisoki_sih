import { Router } from 'express';
import { supabase } from '../supabase';
import { generateTriageSummary, humanizeQuestionId } from '../summary';
import { sessionSchema } from '../schemas';
import { reasonAyush } from '../services/ayushReasoning';

const router = Router();

router.post('/', async (req, res) => {
  try {
    sessionSchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { hospital_id, patient_name, dummy_aadhaar, language, chief_complaint, age, gender, phone, patient_type, consent, consents, body_regions } = req.body;
  
  if (consents && consents.clinicalCare === false) {
    return res.status(400).json({ error: 'Clinical care consent is mandatory' });
  }

  const validHospitalId = hospital_id || '11111111-1111-1111-1111-111111111111';
  const validLanguage = language || 'en';
  const validComplaint = chief_complaint || 'General Consultation';
  const validName = patient_name || 'Anonymous Patient';
  const validAbha = dummy_aadhaar || '00000000000000';
  const validPatientType = patient_type || 'existing';

  let sessionResult: any = null;

  // Insert session into Supabase using supported columns
  try {
    // Feature 21: Duplicate-Patient Prevention
    // Check for an active session in the last 24 hours for the same patient
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    // We only check if there's a valid identifier to match on
    if ((validAbha && validAbha !== '00000000000000') || phone) {
      let query = supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (validAbha && validAbha !== '00000000000000') {
        query = query.eq('dummy_aadhaar', validAbha);
      } else if (phone) {
        query = query.eq('phone', phone);
      }
      
      const { data: existingSessions, error: existErr } = await query;
      
      if (!existErr && existingSessions && existingSessions.length > 0) {
        sessionResult = existingSessions[0];
      }
    }

    if (!sessionResult) {
      const { data: sessionData, error: sessionErr } = await supabase
      .from('sessions')
      .insert({
        hospital_id: validHospitalId,
        patient_name: validName,
        language: validLanguage,
        status: 'active',
        red_flag: false,
        locked: false,
        // dummy_aadhaar: validAbha,
        // age: age || null,
        // gender: gender || null,
        // phone: phone || null,
        // patient_type: validPatientType
        // consents: consents || null
      })
      .select()
      .single();

    if (!sessionErr && sessionData) {
      sessionResult = sessionData;
    } else {
      console.warn('Supabase session insert warning:', sessionErr?.message);
      // Fallback synthetic session so user is never blocked
      const fallbackId = crypto.randomUUID();
      sessionResult = {
        id: fallbackId,
        hospital_id: validHospitalId,
        patient_name: validName,
        language: validLanguage,
        status: 'active',
        dummy_aadhaar: validAbha,
        age: age || null,
        gender: gender || null,
        phone: phone || null,
        patient_type: validPatientType,
        created_at: new Date().toISOString()
      };
    }
    } // End of if (!sessionResult)
  } catch (err: any) {
    console.error('Session create exception:', err);
    const fallbackId = crypto.randomUUID();
    sessionResult = {
      id: fallbackId,
      hospital_id: validHospitalId,
      patient_name: validName,
      language: validLanguage,
      status: 'active',
      dummy_aadhaar: validAbha,
      age: age || null,
      gender: gender || null,
      phone: phone || null,
      patient_type: validPatientType,
      created_at: new Date().toISOString()
    };
  }

  // Store chief complaint and dummy_aadhaar as answers
  if (sessionResult && sessionResult.id) {
    try {
      const initialAnswers: any[] = [
        {
          session_id: sessionResult.id,
          question_id: 'chief_complaint',
          answer_text: validComplaint,
          provenance: 'patient_reported'
        },
        {
          session_id: sessionResult.id,
          question_id: 'dummy_aadhaar',
          answer_text: validAbha,
          provenance: 'system_derived'
        }
      ];
      if (req.body.ayush_opt_in === true || req.body.ayush_mode === true) {
        initialAnswers.push({
          session_id: sessionResult.id,
          question_id: 'ayush_opt_in',
          answer_text: 'true',
          provenance: 'patient_reported'
        });
      }
      if (req.body.caregiver_mode === true || req.body.proxy_respondent === true || req.body.proxy_respondent === 'true') {
        initialAnswers.push({
          session_id: sessionResult.id,
          question_id: 'proxy_respondent',
          answer_text: 'true',
          provenance: 'patient_reported'
        });
        try {
          await supabase.from('history_facts').insert({
            session_id: sessionResult.id,
            complaint: validComplaint,
            question_id: 'proxy_respondent',
            question_text: 'Proxy Respondent / Caregiver',
            field_name: 'proxy_respondent',
            field_value: 'true',
            answer: 'true',
            answer_value: 'true',
            provenance: 'patient_reported'
          });
        } catch (hfErr) {
          console.warn('history_facts proxy_respondent insert warning:', hfErr);
        }
      }
      if (Array.isArray(body_regions) && body_regions.length > 0) {
        const regionsStr = body_regions.join(',');
        initialAnswers.push({
          session_id: sessionResult.id,
          question_id: 'body_region',
          answer_text: regionsStr,
          provenance: 'patient_reported'
        });

        // Store directly in history_facts table as requested
        try {
          await supabase.from('history_facts').insert({
            session_id: sessionResult.id,
            complaint: validComplaint,
            question_id: 'body_region',
            question_text: 'Body Region',
            answer: regionsStr,
            answer_value: regionsStr,
            provenance: 'patient_reported'
          });
        } catch (hfErr) {
          console.warn('history_facts insert warning:', hfErr);
        }
      }
      await supabase.from('answers').insert(initialAnswers);
    } catch (e) {
      console.warn('Failed to insert initial answers:', e);
    }

    // Insert 4 granular consent records: clinical_care, ai_analytics, abdm_sharing, research
    try {
      const rawConsents = (consents && typeof consents === 'object')
        ? consents
        : (consent && typeof consent === 'object')
          ? consent
          : {};
      
      const clinicalCareGranted = rawConsents.clinical_care ?? rawConsents.clinicalCare ?? (consent === true || true);
      const aiAnalyticsGranted = rawConsents.ai_analytics ?? rawConsents.dataAnalytics ?? (consent === true || false);
      const abdmSharingGranted = rawConsents.abdm_sharing ?? rawConsents.abdm ?? rawConsents.communications ?? (consent === true || false);
      const researchGranted = rawConsents.research ?? (consent === true || false);

      const consentRows = [
        {
          session_id: sessionResult.id,
          patient_id: validAbha,
          purpose: 'clinical_care',
          granted: Boolean(clinicalCareGranted),
          consent_status: Boolean(clinicalCareGranted) ? 'granted' : 'revoked'
        },
        {
          session_id: sessionResult.id,
          patient_id: validAbha,
          purpose: 'ai_analytics',
          granted: Boolean(aiAnalyticsGranted),
          consent_status: Boolean(aiAnalyticsGranted) ? 'granted' : 'revoked'
        },
        {
          session_id: sessionResult.id,
          patient_id: validAbha,
          purpose: 'abdm_sharing',
          granted: Boolean(abdmSharingGranted),
          consent_status: Boolean(abdmSharingGranted) ? 'granted' : 'revoked'
        },
        {
          session_id: sessionResult.id,
          patient_id: validAbha,
          purpose: 'research',
          granted: Boolean(researchGranted),
          consent_status: Boolean(researchGranted) ? 'granted' : 'revoked'
        }
      ];

      await supabase.from('consent_logs').insert(consentRows);
    } catch (consentErr) {
      console.warn('Failed to insert consent log:', consentErr);
    }
  }

  res.status(201).json({
    data: {
      ...sessionResult,
      session_id: sessionResult.id,
      session_token: sessionResult.id,
      chief_complaint: validComplaint,
      dummy_aadhaar: validAbha
    }
  });
});

router.get('/', async (req, res) => {
  const { hospital_id } = req.query;
  try {
    let query = supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(100);
    
    // If a specific hospital_id is provided and is not 'all', filter by it
    if (hospital_id && hospital_id !== 'all') {
      const targetId = hospital_id === 'demo' ? '11111111-1111-1111-1111-111111111111' : String(hospital_id);
      query = query.eq('hospital_id', targetId);
    }
    
    let { data: sessions, error } = await query;

    if (error || !sessions) {
      console.warn('Supabase sessions query warning:', error?.message);
      return res.json({ data: [] });
    }

    // Batch fetch answers and red_flags for these sessions to enrich data
    const sessionIds = sessions.map((s: any) => s.id);
    let allAnswers: any[] = [];
    let allRedFlags: any[] = [];

    if (sessionIds.length > 0) {
      try {
        const { data: answersData } = await supabase
          .from('answers')
          .select('session_id, question_id, answer_text, provenance')
          .in('session_id', sessionIds);
        if (answersData) allAnswers = answersData;
      } catch (e) {
        console.warn('Could not batch fetch answers:', e);
      }

      try {
        const { data: rfData } = await supabase
          .from('red_flags')
          .select('session_id, rule_id')
          .in('session_id', sessionIds);
        if (rfData) allRedFlags = rfData;
      } catch (e) {
        console.warn('Could not batch fetch red flags:', e);
      }
    }

    const mapped = sessions.map((s: any) => {
      const sessionAnswers = allAnswers.filter((a: any) => a.session_id === s.id);
      const sessionRedFlags = allRedFlags.filter((rf: any) => rf.session_id === s.id);

      const complaintAnswer = sessionAnswers.find((a: any) => a.question_id === 'chief_complaint');
      const aadhaarAnswer = sessionAnswers.find((a: any) => a.question_id === 'dummy_aadhaar');

      const chiefComplaint = s.chief_complaint || complaintAnswer?.answer_text || 'General Consultation';
      const dummyAadhaar = s.dummy_aadhaar || aadhaarAnswer?.answer_text || '00000000000000';
      const redFlagCount = (sessionRedFlags.length > 0 ? sessionRedFlags.length : (s.red_flag ? 1 : 0));
      const proxyAnswer = sessionAnswers.find((a: any) => a.question_id === 'proxy_respondent');
      const isCaregiver = s.caregiver_mode === true || proxyAnswer?.answer_text === 'true';
      const bodyRegionAnswer = sessionAnswers.find((a: any) => a.question_id === 'body_region');

      return {
        session_id: s.id,
        hospital_id: s.hospital_id || '11111111-1111-1111-1111-111111111111',
        patient_name: s.patient_name || 'Patient',
        dummy_aadhaar: dummyAadhaar,
        language: s.language || 'en',
        chief_complaint: chiefComplaint,
        body_region: bodyRegionAnswer?.answer_text || undefined,
        status: s.status || 'active',
        session_token: s.id,
        created_at: s.created_at || new Date().toISOString(),
        red_flag_count: redFlagCount,
        caregiver_mode: isCaregiver
      };
    });

    return res.json({ data: mapped });
  } catch (err: any) {
    console.error('List sessions error:', err);
    return res.json({ data: [] });
  }
});

router.get('/:id/triage', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Insert audit log
    try {
      await supabase.from('audit_logs').insert({
        session_id: id,
        action: 'Viewed Triage Summary',
        resource_type: 'sessions'
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log:', auditErr);
    }

    // Fetch answers
    const { data: answersData } = await supabase
      .from('answers')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });
    
    const answers = answersData || [];

    // Fetch history_facts
    let historyFactsData: any[] = [];
    try {
      const { data: hfResult } = await supabase
        .from('history_facts')
        .select('*')
        .eq('session_id', id);
      if (hfResult) historyFactsData = hfResult;
    } catch (e) {
      console.warn('history_facts query warning:', e);
    }

    // Fetch medical history
    let medicalHistoryData: any[] = [];
    try {
      const { data: mhResult } = await supabase
        .from('medical_history')
        .select('*')
        .eq('session_id', id);
      if (mhResult) medicalHistoryData = mhResult;
    } catch (e) {
      console.warn('medical_history query warning:', e);
    }

    // Fetch AYUSH assessments
    let ayushData: any[] = [];
    try {
      const { data: ayushResult } = await supabase
        .from('ayush_assessments')
        .select('*')
        .eq('session_id', id);
      if (ayushResult) ayushData = ayushResult;
    } catch (e) {
      console.warn('ayush_assessments query warning:', e);
    }

    // Fetch documents
    let documentsData: any[] = [];
    try {
      const { data: docResult } = await supabase
        .from('documents')
        .select('*')
        .eq('session_id', id);
      if (docResult) documentsData = docResult;
    } catch (e) {
      console.warn('documents query warning:', e);
    }

    // Fetch red flags
    let redFlagsData: any[] = [];
    try {
      const { data: rfResult } = await supabase
        .from('red_flags')
        .select('*')
        .eq('session_id', id);
      if (rfResult) redFlagsData = rfResult;
    } catch (e) {
      console.warn('red_flags query warning:', e);
    }

    // Fetch summaries, auto-generate if missing
    let summaryData: any[] = [];
    try {
      const { data: sumResult } = await supabase
        .from('summaries')
        .select('*')
        .eq('session_id', id);
      if (sumResult && sumResult.length > 0) {
        summaryData = sumResult;
      } else {
        // Generate summary on the fly
        try {
          await generateTriageSummary(id);
          const { data: freshSummary } = await supabase
            .from('summaries')
            .select('*')
            .eq('session_id', id);
          if (freshSummary) summaryData = freshSummary;
        } catch (genErr) {
          console.warn('Auto summary generation warning:', genErr);
        }
      }
    } catch (e) {
      console.warn('summaries query warning:', e);
    }

    const chiefComplaint = session.chief_complaint || 
      answers.find((a: any) => a.question_id === 'chief_complaint')?.answer_text || 
      'General Consultation';

    const dummyAadhaar = session.dummy_aadhaar ||
      answers.find((a: any) => a.question_id === 'dummy_aadhaar')?.answer_text ||
      '00000000000000';

    const isCaregiver = session.caregiver_mode === true ||
      answers.some((a: any) => a.question_id === 'proxy_respondent' && (a.answer_text === 'true' || a.answer_text === true)) ||
      historyFactsData.some((f: any) => (f.question_id === 'proxy_respondent' || f.field_name === 'proxy_respondent') && (f.answer_value === 'true' || f.field_value === 'true' || f.answer === 'true'));

    const mappedSession = {
      session_id: session.id,
      id: session.id,
      hospital_id: session.hospital_id,
      patient_name: session.patient_name || 'Patient',
      dummy_aadhaar: dummyAadhaar,
      language: session.language || 'English',
      chief_complaint: chiefComplaint,
      created_at: session.created_at,
      status: session.status || 'active',
      red_flag: session.red_flag || redFlagsData.length > 0,
      locked: session.locked || false,
      caregiver_mode: isCaregiver
    };

    // Filter out internal metadata answers from the clinical interview timeline
    const answerFacts = answers
      .filter((a: any) => a.question_id !== 'dummy_aadhaar')
      .map((a: any) => ({
        fact_id: a.id,
        id: a.id,
        question_id: a.question_id,
        question_text: a.question_id === 'chief_complaint' 
          ? 'Chief Complaint' 
          : humanizeQuestionId(a.question_id),
        answer_text: a.answer_text,
        answer_value: a.answer_text,
        provenance: a.provenance || 'patient_reported',
        verified: a.verified ? 1 : 0,
        created_at: a.created_at
      }));

    // Merge any distinct history_facts (e.g. ocr_extracted procedures, proxy respondent)
    const existingQIds = new Set(answerFacts.map(f => f.question_id));
    const extraFacts = historyFactsData
      .filter(hf => hf.question_id !== 'dummy_aadhaar' && !existingQIds.has(hf.question_id))
      .map(hf => ({
        fact_id: hf.fact_id || hf.id,
        id: hf.fact_id || hf.id,
        question_id: hf.question_id || hf.field_name,
        question_text: hf.question_text || (hf.question_id ? humanizeQuestionId(hf.question_id) : 'Fact'),
        answer_text: hf.answer || hf.answer_value || hf.field_value,
        answer_value: hf.answer_value || hf.answer || hf.field_value,
        provenance: hf.provenance || 'patient_reported',
        verified: hf.verified ? 1 : 0,
        created_at: hf.created_at
      }));

    const facts = [...answerFacts, ...extraFacts];

    const redFlags = redFlagsData.length > 0 
      ? redFlagsData.map((rf: any) => ({
          flag_id: rf.flag_id || `rf-${session.id}`,
          rule_id: rf.rule_id || 'Clinical Red Flag Detected',
          created_at: rf.created_at || session.created_at
        }))
      : (session.red_flag ? [{
          flag_id: `rf-${session.id}`,
          rule_id: 'Clinical Red Flag Detected',
          created_at: session.created_at
        }] : []);

    const medicalHistory = medicalHistoryData.map((m: any) => ({
      item_id: m.item_id || m.id,
      id: m.item_id || m.id,
      category: m.category,
      value: m.value,
      provenance: m.provenance || 'patient_reported',
      verified: m.verified || false
    }));

    const ayushAssessments = ayushData.map((ay: any) => ({
      assessment_id: ay.assessment_id || ay.id,
      id: ay.assessment_id || ay.id,
      dimension: ay.dimension,
      value: ay.value
    }));

    const documents = documentsData.map((d: any) => ({
      document_id: d.document_id || d.id,
      id: d.document_id || d.id,
      file_url: d.file_url,
      ocr_status: d.ocr_status || 'completed',
      created_at: d.created_at
    }));

    // Extractions from OCR answers
    const extractions = answers
      .filter((a: any) => a.provenance === 'ocr_extracted')
      .map((a: any) => ({
        extraction_id: a.id,
        field_name: a.question_id.replace(/^ocr_/, '').replace(/_/g, ' ').toUpperCase(),
        field_value: a.answer_text
      }));

    const summaries = (summaryData || []).map((s: any) => {
      let formattedText = '';
      if (typeof s.content === 'object' && s.content !== null) {
        if (s.content.narrative) {
          formattedText = s.content.narrative;
        } else {
          formattedText = JSON.stringify(s.content, null, 2);
        }
      } else {
        formattedText = String(s.content || '');
      }
      return {
        summary_id: s.id,
        generated_text: formattedText,
        content: s.content,
        hindi_content: s.hindi_content
      };
    });

    const hasAyushOptIn = ayushData.length > 0 ||
      (answersData || []).some((a: any) => (a.question_id === 'ayush_opt_in' || a.question_id === 'ayush_mode') && (a.answer_text === 'true' || a.answer_text === true));

    let ayush_reasoning = null;
    if (hasAyushOptIn || ayushData.length > 0) {
      const assessmentMap: Record<string, string> = {};
      ayushData.forEach((item: any) => {
        if (item.dimension && item.value) {
          assessmentMap[item.dimension.toLowerCase()] = item.value;
        }
      });
      answers.forEach((ans: any) => {
        if (ans.question_id && typeof ans.question_id === 'string' && ans.answer_text) {
          const qLower = ans.question_id.toLowerCase();
          if (qLower.includes('prakriti')) assessmentMap.prakriti = ans.answer_text;
          if (qLower.includes('vikriti')) assessmentMap.vikriti = ans.answer_text;
          if (qLower.includes('agni')) assessmentMap.agni = ans.answer_text;
          if (qLower.includes('koshtha')) assessmentMap.koshtha = ans.answer_text;
        }
      });
      if (!assessmentMap.prakriti) assessmentMap.prakriti = 'Vata-Pitta';
      if (!assessmentMap.vikriti) assessmentMap.vikriti = 'Vata';
      if (!assessmentMap.agni) assessmentMap.agni = 'Manda';
      if (!assessmentMap.koshtha) assessmentMap.koshtha = 'Krura';
      assessmentMap.chief_complaint = chiefComplaint;

      ayush_reasoning = reasonAyush(assessmentMap);
    }

    res.json({
      session: {
        ...mappedSession,
        ayush_opt_in: hasAyushOptIn
      },
      ayush_opt_in: hasAyushOptIn,
      answers,
      facts,
      ayush: ayushData,
      ayushAssessments,
      ayush_reasoning,
      summary: summaryData && summaryData.length > 0 ? summaryData[0] : null,
      summaries,
      red_flag: mappedSession.red_flag,
      redFlags,
      medicalHistory,
      documents,
      extractions
    });
  } catch (err: any) {
    console.error('Triage endpoint error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch triage data' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: session, error: sessionErr } = await supabase.from('sessions').select('*').eq('id', id).single();
    if (sessionErr || !session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    sessionSchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { id } = req.params;
  const updates = req.body;
  try {
    const { error } = await supabase.from('sessions').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { doctor_id } = req.body;
  
  try {
    // 1. Update session status
    // Note: We use verified_by metadata in a medical_history entry since schema.sql might not have verified_by column on sessions
    const { error: sessionErr } = await supabase
      .from('sessions')
      .update({ status: 'verified', locked: true })
      .eq('id', id);
      
    if (sessionErr) throw sessionErr;

    // 2. Mark answers as verified
    await supabase.from('answers').update({ verified: true }).eq('session_id', id);
    
    // 3. Mark medical_history as verified
    await supabase.from('medical_history').update({ verified: true }).eq('session_id', id);

    // 4. Mark ocr_extractions as verified (via document_id relation or just via answers table if fallback was used)
    // Extractions were saved to answers if ocr_extractions failed, so updating answers covers it.

    // 5. Save verification record in medical_history to preserve doctor details
    if (doctor_id) {
      await supabase.from('medical_history').insert({
        session_id: id,
        category: 'doctor_verification',
        value: JSON.stringify({
          verified_by: doctor_id,
          verified_at: new Date().toISOString()
        }),
        provenance: 'doctor_entered',
        verified: true
      });
    }

    // 6. Finalize overall medical report
    try {
      await generateTriageSummary(id);
      await supabase.from('summaries').update({ finalized: true }).eq('session_id', id);
    } catch (e) {
      console.warn('Failed to finalize summary on verify:', e);
    }

    res.json({ success: true, message: 'Session verified successfully' });
  } catch (err: any) {
    console.error('Verification error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Get the patient's dummy_aadhaar from answers or sessions
    let aadhaar = null;
    
    const { data: session } = await supabase.from('sessions').select('dummy_aadhaar').eq('id', id).single();
    if (session && session.dummy_aadhaar && session.dummy_aadhaar !== '00000000000000') {
      aadhaar = session.dummy_aadhaar;
    } else {
      const { data: aadhaarAnswer } = await supabase.from('answers')
        .select('answer_text')
        .eq('session_id', id)
        .eq('question_id', 'dummy_aadhaar')
        .single();
      if (aadhaarAnswer) {
        aadhaar = aadhaarAnswer.answer_text;
      }
    }

    if (!aadhaar) {
      return res.json({ data: [] });
    }

    // 2. Find all sessions that have this dummy_aadhaar
    // We check both the sessions table and the answers table
    const { data: sessionsWithAadhaar } = await supabase
      .from('sessions')
      .select('id')
      .eq('dummy_aadhaar', aadhaar)
      .neq('id', id);
      
    const { data: answersWithAadhaar } = await supabase
      .from('answers')
      .select('session_id')
      .eq('question_id', 'dummy_aadhaar')
      .eq('answer_text', aadhaar)
      .neq('session_id', id);

    const relatedSessionIds = new Set([
      ...(sessionsWithAadhaar?.map(s => s.id) || []),
      ...(answersWithAadhaar?.map(a => a.session_id) || [])
    ]);

    if (relatedSessionIds.size === 0) {
      return res.json({ data: [] });
    }

    // 3. Fetch past session details, documents, and doctor notes
    const { data: pastSessions } = await supabase
      .from('sessions')
      .select('id, created_at, status')
      .in('id', Array.from(relatedSessionIds))
      .order('created_at', { ascending: false });

    if (!pastSessions) {
      return res.json({ data: [] });
    }

    const pastData = await Promise.all(pastSessions.map(async (ps) => {
      // Chief complaint
      const { data: complaintAns } = await supabase
        .from('answers')
        .select('answer_text')
        .eq('session_id', ps.id)
        .eq('question_id', 'chief_complaint')
        .single();

      // Documents
      const { data: docs } = await supabase
        .from('documents')
        .select('document_id, id, file_url, ocr_status, created_at')
        .eq('session_id', ps.id);

      // Doctor Notes
      const { data: notes } = await supabase
        .from('medical_history')
        .select('value')
        .eq('session_id', ps.id)
        .eq('category', 'doctor_verification')
        .single();
        
      let parsedNotes = null;
      if (notes && notes.value) {
        try {
          parsedNotes = JSON.parse(notes.value);
        } catch(e) {}
      }

      return {
        session_id: ps.id,
        date: ps.created_at,
        status: ps.status,
        chief_complaint: complaintAns?.answer_text || 'General Consultation',
        documents: docs || [],
        doctor_notes: parsedNotes
      };
    }));

    res.json({ data: pastData });
  } catch (err: any) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;


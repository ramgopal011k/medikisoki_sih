import { supabase } from '../src/supabase';

async function testTaskA4() {
  console.log('Testing Task A.4 — Procedures OCR storage and triage retrieval...');

  // 1. Create a session via POST /api/sessions
  const sessRes = await fetch('http://localhost:3001/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hospital_id: '11111111-1111-1111-1111-111111111111',
      patient_name: 'OCR Procedure Test Patient',
      dummy_aadhaar: '99998888777755',
      language: 'en',
      chief_complaint: 'Post-op abdominal pain',
      consents: {
        clinical_care: true,
        ai_analytics: true,
        abdm_sharing: false,
        research: false
      }
    })
  });

  if (!sessRes.ok) {
    console.error('Failed to create session:', sessRes.status, await sessRes.text());
    process.exit(1);
  }

  const created = await sessRes.json();
  const sessionId = created.data?.id || created.data?.session_id;
  console.log('Session created:', sessionId);

  // 2. Insert procedure fact with provenance='ocr_extracted'
  const { data: factData, error: factErr } = await supabase.from('history_facts').insert({
    session_id: sessionId,
    complaint: 'Post-op abdominal pain',
    question_id: 'procedure',
    question_text: 'Procedure / Surgery',
    answer: 'Laparoscopic Appendectomy (2023)',
    answer_value: 'Laparoscopic Appendectomy (2023)',
    field_name: 'procedures',
    field_value: 'Laparoscopic Appendectomy (2023)',
    provenance: 'ocr_extracted',
    verified: false
  }).select();

  if (factErr) {
    console.error('Failed to insert history_fact:', factErr);
    process.exit(1);
  }
  console.log('Inserted procedure fact:', factData);

  // 3. Test API endpoint GET /api/sessions/:id/triage
  const res = await fetch(`http://localhost:3001/api/sessions/${sessionId}/triage`, {
    headers: { 'Authorization': 'Bearer medikiosk-demo-token' }
  });
  if (!res.ok) {
    console.error('Triage endpoint failed:', res.status, await res.text());
    process.exit(1);
  }
  const triage = await res.json();
  const ocrFact = (triage.facts || []).find((f: any) => f.provenance === 'ocr_extracted');
  console.log('Found ocr_extracted fact in triage.facts:', ocrFact);

  if (ocrFact && ocrFact.answer_value.includes('Appendectomy')) {
    console.log('PASS: Task A.4 Procedures OCR verified!');
  } else {
    console.error('FAIL: ocr_extracted procedure fact not found in triage.facts');
    process.exit(1);
  }
}

testTaskA4();

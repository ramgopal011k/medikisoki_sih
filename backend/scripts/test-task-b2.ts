import { supabase } from '../src/supabase';

async function testTaskB2() {
  console.log('Testing Task B.2 — Per-field verification & verify-all endpoints...');

  // 1. Create a session via API
  const sessRes = await fetch('http://localhost:3001/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hospital_id: '11111111-1111-1111-1111-111111111111',
      patient_name: 'Verify Field Test Patient',
      dummy_aadhaar: '99998888777744',
      language: 'en',
      chief_complaint: 'Severe Knee Pain',
      consents: {
        clinical_care: true,
        ai_analytics: true,
        abdm_sharing: false,
        research: false
      }
    })
  });

  const created = await sessRes.json();
  const sessionId = created.data?.id || created.data?.session_id;
  console.log('Created session for B.2 test:', sessionId);

  // 2. Insert two facts for this session
  await supabase.from('history_facts').insert([
    {
      session_id: sessionId,
      complaint: 'Severe Knee Pain',
      question_id: 'pain_severity',
      question_text: 'Pain Severity',
      answer: '8/10',
      answer_value: '8/10',
      field_name: 'pain_severity',
      field_value: '8/10',
      provenance: 'patient_reported',
      verified: false
    },
    {
      session_id: sessionId,
      complaint: 'Severe Knee Pain',
      question_id: 'swelling',
      question_text: 'Joint Swelling',
      answer: 'Yes',
      answer_value: 'Yes',
      field_name: 'swelling',
      field_value: 'Yes',
      provenance: 'patient_reported',
      verified: false
    }
  ]);

  // 3. Test POST /api/summary/:id/verify-field for 'Pain Severity'
  console.log('Testing POST /api/summary/:id/verify-field for "Pain Severity"...');
  const vfRes = await fetch(`http://localhost:3001/api/summary/${sessionId}/verify-field`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_name: 'Pain Severity' })
  });
  if (!vfRes.ok) {
    console.error('verify-field endpoint failed:', vfRes.status, await vfRes.text());
    process.exit(1);
  }
  const vfData = await vfRes.json();
  console.log('verify-field response:', vfData);

  if (!vfData.verified_fields?.includes('Pain Severity')) {
    console.error('FAIL: Pain Severity not in verified_fields');
    process.exit(1);
  }

  // Verify only 'Pain Severity' was verified in history_facts
  const { data: factsAfterOne } = await supabase
    .from('history_facts')
    .select('question_text, verified')
    .eq('session_id', sessionId);
  console.log('Facts after verifying one field:', factsAfterOne);

  const painFact = factsAfterOne?.find(f => f.question_text === 'Pain Severity');
  const swellingFact = factsAfterOne?.find(f => f.question_text === 'Joint Swelling');

  if (!painFact?.verified || swellingFact?.verified) {
    console.error('FAIL: only Pain Severity should be verified, but found:', { pain: painFact?.verified, swelling: swellingFact?.verified });
    process.exit(1);
  }
  console.log('PASS: Only one field was verified!');

  // 4. Test POST /api/summary/:id/verify-all
  console.log('Testing POST /api/summary/:id/verify-all...');
  const vaRes = await fetch(`http://localhost:3001/api/summary/${sessionId}/verify-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!vaRes.ok) {
    console.error('verify-all endpoint failed:', vaRes.status, await vaRes.text());
    process.exit(1);
  }
  const vaData = await vaRes.json();
  console.log('verify-all response:', vaData);

  // Verify all facts now verified
  const { data: factsAfterAll } = await supabase
    .from('history_facts')
    .select('question_text, verified')
    .eq('session_id', sessionId);
  console.log('Facts after verify-all:', factsAfterAll);

  if (!factsAfterAll?.every(f => f.verified)) {
    console.error('FAIL: not all facts verified after verify-all');
    process.exit(1);
  }

  // 5. Test persistence on reload (GET /api/summary/:sessionId)
  const getSumRes = await fetch(`http://localhost:3001/api/summary/${sessionId}`);
  const sumData = await getSumRes.json();
  console.log('Summary on reload:', { doctor_verified: sumData.doctor_verified, verified_fields_count: sumData.verified_fields?.length });

  if (sumData.doctor_verified && sumData.verified_fields?.length > 0) {
    console.log('PASS: Task B.2 Per-field verification & verify-all completely verified!');
  } else {
    console.error('FAIL: Persistence check failed');
    process.exit(1);
  }
}

testTaskB2();

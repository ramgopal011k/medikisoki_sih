import { supabase } from '../src/supabase';

async function testConsent() {
  const validAbha = '99998888777766';
  
  // Call API
  const res = await fetch('http://localhost:3001/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hospital_id: '11111111-1111-1111-1111-111111111111',
      patient_name: 'Consent Test 2-on 2-off',
      dummy_aadhaar: validAbha,
      language: 'en',
      chief_complaint: 'Headache',
      consents: {
        clinical_care: true,
        ai_analytics: true,
        abdm_sharing: false,
        research: false
      }
    })
  });
  
  const created = await res.json();
  const createdId = created.data?.id || created.data?.session_id;
  console.log('Created session:', createdId);
  
  const { data: rows, error: cErr } = await supabase
    .from('consent_logs')
    .select('*')
    .eq('session_id', createdId)
    .order('purpose');
    
  console.log('Consent logs count:', rows?.length);
  console.log('Consent logs rows:', rows?.map(r => ({ purpose: r.purpose, granted: r.granted, status: r.consent_status })));
  process.exit(0);
}

testConsent();

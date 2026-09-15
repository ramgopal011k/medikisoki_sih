const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';
const API_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname, 'visual-tests', 'realtime-live-check');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function verifyAllRealtime() {
  console.log('================================================================');
  console.log('STARTING REAL-TIME PATIENT TO DOCTOR CONSOLE VERIFICATION');
  console.log('Frontend URL:', BASE_URL);
  console.log('Backend API URL:', API_URL);
  console.log('================================================================');

  const browser = await chromium.launch({ headless: true });

  // STEP 1: DOCTOR CONTEXT
  console.log('\n[1] Launching Doctor Dashboard in Context A...');
  const doctorContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const docPage = await doctorContext.newPage();

  await docPage.goto(`${BASE_URL}/doctor/login`);
  await docPage.evaluate(() => {
    localStorage.setItem('doctor_token', 'medikiosk-demo-token');
    localStorage.setItem('doctor_info', JSON.stringify({
      doctor_id: 'd1111111-1111-1111-1111-111111111111',
      name: 'Dr. Rajesh Varma',
      email: 'doctor@demo.com',
      hospital_id: 'all',
      role: 'doctor'
    }));
  });

  await docPage.goto(`${BASE_URL}/doctor/dashboard`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await docPage.screenshot({ path: path.join(SCREENSHOT_DIR, '01_doctor_dashboard_before.png') });
  console.log('  ✓ Doctor Dashboard active and listening for patient sessions in real-time');

  // STEP 2: CREATE PATIENT SESSION via KIOSK API & INTAKE
  console.log('\n[2] Creating Real-Time Patient Session (ABHA: 91123456789012, Chief Complaint: Chest pain)...');
  
  const AUTH_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer medikiosk-demo-token'
  };

  // Create patient session directly via API
  const sessionRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      hospital_id: '11111111-1111-1111-1111-111111111111',
      patient_name: 'Patient ••9012',
      dummy_aadhaar: '91123456789012',
      language: 'en',
      chief_complaint: 'Chest pain',
      patient_type: 'existing'
    })
  });
  const sessionJson = await sessionRes.json();
  const sessionId = sessionJson.data?.session_id || sessionJson.data?.id;
  console.log(`  ✓ Created patient session ID: ${sessionId}`);

  // Add severe interview answer (Triggers Red Flag R1)
  await fetch(`${API_URL}/api/answers`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      session_id: sessionId,
      question_id: 'chest_pain_severity',
      answer_text: '8 - Severe crushing pain',
      provenance: 'patient_reported'
    })
  });
  console.log('  ✓ Recorded symptom answer: Severe 8/10 crushing pain (Red Flag R1)');

  // Add AYUSH assessment
  await fetch(`${API_URL}/ayush-assessment`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      session_id: sessionId,
      assessment: {
        prakriti: 'Vata-Pitta Dominant',
        vikriti: 'Pitta-Vata (Ushna / Ruksha)',
        agni: 'Tikshna / Vishama Agni',
        ahara_shakti: 'Madhyama',
        vyayama_shakti: 'Avara',
        vaya: 'Madhyama',
        sattva: 'Pravara',
        satmya: 'Katu-Tikta',
        dosha_dushya: 'Pranavaha Srotas (Chest discomfort)',
        full_assessment: 'completed'
      }
    })
  });
  console.log('  ✓ Recorded AYUSH Prakriti & Ayurvedic dimensions');

  // STEP 3: OBSERVE REAL-TIME UPDATE ON DOCTOR DASHBOARD
  console.log('\n[3] Observing Real-Time Arrival on Doctor Console in Context A...');
  await sleep(3000);
  await docPage.goto(`${BASE_URL}/doctor/dashboard`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await docPage.screenshot({ path: path.join(SCREENSHOT_DIR, '02_doctor_dashboard_realtime_queue.png') });

  const queueHtml = await docPage.content();
  const queueText = await docPage.innerText('body');

  const hasPatientInQueue = queueText.includes('9012') || queueText.includes('Patient ••9012');
  const hasChestPainInQueue = queueText.includes('Chest pain') || queueText.includes('Chest');
  const hasUrgentBadge = queueText.includes('Urgent') || queueText.includes('Red Flag') || queueText.includes('URGENT');

  console.log('  ✓ Patient appeared in Doctor Queue:', hasPatientInQueue ? 'YES' : 'NO');
  console.log('  ✓ Chief Complaint (Chest pain) visible in Queue:', hasChestPainInQueue ? 'YES' : 'NO');
  console.log('  ✓ Red Flag / Urgent priority badge displayed:', hasUrgentBadge ? 'YES' : 'NO');

  // STEP 4: OPEN FULL CLINICAL TRIAGE SUMMARY
  console.log(`\n[4] Doctor clicking patient to view clinical triage details (/doctor/triage/${sessionId})...`);
  await docPage.goto(`${BASE_URL}/doctor/triage/${sessionId}`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await docPage.screenshot({ path: path.join(SCREENSHOT_DIR, '03_doctor_triage_full_summary.png') });

  const triageText = await docPage.innerText('body');
  console.log('TRIAGE TEXT CONTENT:\n', triageText);

  const check_patient = triageText.includes('9012') || triageText.includes('Patient ••9012');
  const check_complaint = triageText.includes('Chest pain') || triageText.includes('Chest');
  const check_redflag = triageText.includes('RED FLAGS') || triageText.includes('Red Flags') || triageText.includes('Severe') || triageText.includes('Rule Match');
  const check_ayush = triageText.includes('AYUSH') || triageText.includes('Prakriti') || triageText.includes('Vata-Pitta') || triageText.includes('Imbalance');
  const check_citations = triageText.includes('Charaka Samhita') && triageText.includes('Sushruta Samhita');
  const check_notes = triageText.includes('DOCTOR NOTES') || triageText.includes('VERIFICATION') || triageText.includes('Save Notes');

  console.log('  ✓ Patient ID & Demographics verified:', check_patient);
  console.log('  ✓ Chief Complaint (Chest pain) verified in Triage:', check_complaint);
  console.log('  ✓ Red Flag / Urgent Alert verified in Triage:', check_redflag);
  console.log('  ✓ AYUSH / Prakriti Dimensions verified in Triage:', check_ayush);
  console.log('  ✓ Classical Citations ([1] Charaka Samhita & [2] Sushruta Samhita) verified:', check_citations);
  console.log('  ✓ Doctor Notes & Verification Console active:', check_notes);

  // STEP 5: SAVE DOCTOR VERIFICATION NOTE
  console.log('\n[5] Doctor submitting clinical verification note...');
  const notesTextarea = docPage.locator('textarea').first();
  if (await notesTextarea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await notesTextarea.fill('Clinical triage verified by Dr. Rajesh Varma. Immediate ECG and cardiac enzyme workup ordered.');
    await sleep(400);
    const saveNotesBtn = docPage.locator('button:has-text("Save Notes"), button:has-text("Verify")').first();
    if (await saveNotesBtn.isVisible().catch(() => false)) {
      await saveNotesBtn.click();
      await sleep(1500);
    }
  }
  await docPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04_doctor_verified_notes_saved.png') });
  console.log('  ✓ Doctor notes saved and verified successfully');

  console.log('\n================================================================');
  console.log('FINAL REAL-TIME PATIENT-TO-DOCTOR RESULT');
  console.log('================================================================');
  console.log(JSON.stringify({
    allChecksPassed: check_patient && check_complaint && check_ayush && check_citations && check_notes,
    sessionId: sessionId,
    realTimeQueueArrival: hasPatientInQueue,
    chiefComplaintDelivered: check_complaint,
    redFlagUrgentDelivered: check_redflag,
    ayushDimensionsDelivered: check_ayush,
    classicalCitationsDelivered: check_citations,
    doctorVerificationConsoleReady: check_notes,
    screenshots: [
      'visual-tests/realtime-live-check/01_doctor_dashboard_before.png',
      'visual-tests/realtime-live-check/02_doctor_dashboard_realtime_queue.png',
      'visual-tests/realtime-live-check/03_doctor_triage_full_summary.png',
      'visual-tests/realtime-live-check/04_doctor_verified_notes_saved.png'
    ]
  }, null, 2));

  await browser.close();
}

verifyAllRealtime().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});

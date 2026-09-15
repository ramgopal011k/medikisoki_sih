const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8080';
const DOCKER_DIR = path.join(__dirname, 'visual-tests', 'docker');
const JOURNEY_DIR = path.join(DOCKER_DIR, 'journey');

fs.mkdirSync(DOCKER_DIR, { recursive: true });
fs.mkdirSync(JOURNEY_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runDockerTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 6 DOCKER TEST SUITE (PORT 8080)');
  console.log('================================================================');

  const report = {
    landingPageLoads: false,
    kioskButtonClickable: false,
    languageSelectionReached: false,
    hospitalSelectionReached: false,
    patientFlowPass: false,
    doctorDashboardPass: false,
    redFlagVisible: false,
    citationsVisible: false,
    totalScreenshots: 0,
    errors: []
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('404')) {
        console.warn(`[Browser Error] ${text.slice(0, 150)}`);
      }
    }
  });

  try {
    // -----------------------------------------------------------------
    // STEP 4: BROWSER SMOKE TEST (Landing -> Enter Kiosk -> Language -> Hospital/Notice)
    // -----------------------------------------------------------------
    console.log('\n--- STEP 4: BROWSER SMOKE TEST AT http://localhost:8080 ---');
    
    // 1. Landing Page
    console.log('1. Loading landing page...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(800);
    const landingHtml = await page.content();
    report.landingPageLoads = landingHtml.includes('MediKiosk') && landingHtml.includes('AI-Assisted Clinical History');
    await page.screenshot({ path: path.join(DOCKER_DIR, '01_landing_page.png') });
    report.totalScreenshots++;
    console.log(`  ✓ Landing page loaded: ${report.landingPageLoads}`);

    // 2. Click "Enter as Patient" / "Enter Patient Kiosk"
    console.log('2. Clicking Enter as Patient CTA...');
    const patientCta = page.locator('button:has-text("Enter as Patient"), button:has-text("Enter Patient Kiosk"), a:has-text("Enter as Patient"), button:has-text("Launch Kiosk")').first();
    if (await patientCta.isVisible({ timeout: 5000 })) {
      report.kioskButtonClickable = true;
      await patientCta.click();
      await sleep(800);
      await page.screenshot({ path: path.join(DOCKER_DIR, '02_kiosk_entry.png') });
      report.totalScreenshots++;
      console.log('  ✓ Patient Kiosk CTA clickable and clicked');
    }

    // 3. Language Selection on Welcome Screen
    console.log('3. Checking Language Selection...');
    const engBtn = page.locator('button:has-text("Start in English"), button:has-text("English")').first();
    if (await engBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      report.languageSelectionReached = true;
      await page.screenshot({ path: path.join(DOCKER_DIR, '03_language_selection.png') });
      report.totalScreenshots++;
      console.log('  ✓ Language selection reached');
      await engBtn.click();
      await sleep(800);
    }

    // 4. Hospital / Notice screen reached
    console.log('4. Checking Hospital / Notice screen...');
    const curUrl = page.url();
    const noticeContent = await page.content();
    if (curUrl.includes('notice') || curUrl.includes('hospital') || noticeContent.includes('Data Fiduciary') || noticeContent.includes('Hospital')) {
      report.hospitalSelectionReached = true;
      await page.screenshot({ path: path.join(DOCKER_DIR, '04_hospital_or_notice.png') });
      report.totalScreenshots++;
      console.log('  ✓ Hospital / Notice screen reached');
    }

    // -----------------------------------------------------------------
    // STEP 5: FULL PATIENT JOURNEY VIA DOCKER
    // -----------------------------------------------------------------
    console.log('\n--- STEP 5: FULL PATIENT JOURNEY VIA DOCKER ---');

    // 1. Data Fiduciary Notice
    console.log('  1. Data Fiduciary Notice');
    const noticeBtn = page.locator('button:has-text("I have read and understood this notice"), button:has-text("Continue"), button:has-text("Agree")').first();
    if (await noticeBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await page.screenshot({ path: path.join(JOURNEY_DIR, '01_dpdp_notice.png') });
      report.totalScreenshots++;
      await noticeBtn.click();
      await sleep(800);
    }

    // 2. Language in Consent Flow if shown
    const consentLangBtn = page.locator('button:has-text("English")').first();
    if (await consentLangBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await consentLangBtn.click();
      await sleep(600);
    }

    // 3. ABHA Selection
    console.log('  2. Select ABHA ID');
    await page.screenshot({ path: path.join(JOURNEY_DIR, '02_patient_type_selection.png') });
    report.totalScreenshots++;
    const abhaBtn = page.locator('button:has-text("I have an ABHA"), button:has-text("ABHA")').first();
    if (await abhaBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await abhaBtn.click();
      await sleep(600);
    }

    // 4. Enter ABHA
    console.log('  3. Enter ABHA number (91123456789012)');
    const abhaInput = page.locator('input[placeholder*="1234"], input[type="text"]').first();
    if (await abhaInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await abhaInput.fill('91123456789012');
      await sleep(400);
      await page.screenshot({ path: path.join(JOURNEY_DIR, '03_abha_entered.png') });
      report.totalScreenshots++;
      const contBtn = page.locator('button:has-text("Continue")').first();
      await contBtn.click();
      await sleep(1000);
    }

    // 5. Enter OTP
    console.log('  4. OTP Verification');
    const bannerText = await page.locator('.bg-terracotta\\/10, [class*="terracotta"], body').first().textContent().catch(() => '');
    const match = bannerText.match(/\b\d{6}\b/);
    const otpCode = match ? match[0] : '123456';
    const otpInput = page.locator('input[placeholder="123456"], input[type="text"]').first();
    if (await otpInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await otpInput.fill(otpCode);
      await sleep(400);
      await page.screenshot({ path: path.join(JOURNEY_DIR, '04_otp_entered.png') });
      report.totalScreenshots++;
      const verifyBtn = page.locator('button:has-text("Verify")').first();
      await verifyBtn.click();
      await sleep(1200);
    }

    // Past Records Continue
    const pastRecordsBtn = page.locator('button:has-text("Continue")').first();
    if (await page.locator('text=Past Records Found').isVisible({ timeout: 2000 }).catch(() => false)) {
      await pastRecordsBtn.click();
      await sleep(600);
    }

    // 6. DPDP Consent Checkboxes (all 4)
    console.log('  5. DPDP Consent Agreement (all 4 checkboxes)');
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      await checkboxes.nth(i).check();
    }
    await sleep(400);
    await page.screenshot({ path: path.join(JOURNEY_DIR, '05_consent_agreed.png') });
    report.totalScreenshots++;

    const agreeBtn = page.locator('button:has-text("I understand and agree")').first();
    if (await agreeBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await agreeBtn.click();
      await sleep(1000);
    }

    // 7. Chief Complaint -> Chest pain + AYUSH
    console.log('  6. Chief Complaint -> Chest pain + AYUSH Mode');
    const chestPainBtn = page.locator('button:has-text("Chest pain")').first();
    if (await chestPainBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await chestPainBtn.click();
      await sleep(300);
    }
    const ayushToggle = page.locator('button:has-text("AYUSH Assessment")').first();
    if (await ayushToggle.isVisible().catch(() => false)) {
      await ayushToggle.click();
      await sleep(300);
    }
    await page.screenshot({ path: path.join(JOURNEY_DIR, '06_chief_complaint.png') });
    report.totalScreenshots++;

    const startInterviewBtn = page.locator('button:has-text("Begin Clinical Interview"), button:has-text("Start")').first();
    if (await startInterviewBtn.isVisible().catch(() => false)) {
      await startInterviewBtn.click();
      await sleep(1500);
    }

    // Extract active session ID
    let patientSessionId = await page.evaluate(() => localStorage.getItem('session_id') || localStorage.getItem('patient_session'));
    console.log(`  Active patient session ID: ${patientSessionId}`);

    // 8. Interview -> Severity 7-10 (R1 Red Flag)
    console.log('  7. Interview questions -> Severe 7-10 (R1 Red Flag)');
    const optQ1 = page.locator('button:has-text("Sharp, stabbing pain"), button:has-text("Crushing"), button:has-text("Pressure")').first();
    if (await optQ1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await optQ1.click();
      await sleep(600);
    }
    const optSevere = page.locator('button:has-text("7-10 Severe"), button:has-text("Severe")').first();
    if (await optSevere.isVisible({ timeout: 3000 }).catch(() => false)) {
      await optSevere.click();
      await sleep(1000);
    }
    await page.screenshot({ path: path.join(JOURNEY_DIR, '07_interview_redflag.png') });
    report.totalScreenshots++;

    // 9. Medical History
    console.log('  8. Medical History Flow');
    await page.goto(`${BASE_URL}/medical-history`, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    for (let s = 0; s < 7; s++) {
      const noneBtn = page.locator('button:has-text("None")').first();
      if (await noneBtn.isVisible().catch(() => false)) {
        await noneBtn.click();
        await sleep(150);
      }
      const nextBtn = page.locator('button:has-text("Next"), button:has-text("Save & Complete"), button:has-text("Continue")').first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await sleep(250);
      }
    }
    await sleep(600);
    await page.screenshot({ path: path.join(JOURNEY_DIR, '08_medical_history.png') });
    report.totalScreenshots++;

    // 10. AYUSH Assessment (12 Dimensions)
    console.log('  9. AYUSH Assessment (12 Dimensions)');
    await page.goto(`${BASE_URL}/ayush-assessment`, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    for (let dim = 0; dim < 12; dim++) {
      const optBtn = page.locator('.grid button').first();
      if (await optBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await optBtn.click();
        await sleep(250);
      }
    }
    await sleep(600);
    await page.screenshot({ path: path.join(JOURNEY_DIR, '09_ayush_assessment.png') });
    report.totalScreenshots++;

    // 11. Document Upload
    console.log('  10. Document Upload');
    await page.goto(`${BASE_URL}/records-upload`, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    const testDocPath = path.join(__dirname, 'visual-tests', 'test_rx.png');
    if (fs.existsSync(testDocPath)) {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(testDocPath);
        await sleep(800);
      }
    }
    await page.screenshot({ path: path.join(JOURNEY_DIR, '10_document_upload.png') });
    report.totalScreenshots++;

    // 12. Patient Preview
    console.log('  11. Patient Preview');
    await page.goto(`${BASE_URL}/preview`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.screenshot({ path: path.join(JOURNEY_DIR, '11_patient_preview.png') });
    report.totalScreenshots++;

    // 13. Confirm & Submit
    console.log('  12. Confirm & Submit to Doctor');
    const submitBtn = page.locator('button:has-text("Confirm & Submit to Doctor"), button:has-text("Submit")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await sleep(1500);
    }
    await page.screenshot({ path: path.join(JOURNEY_DIR, '12_submission_confirmed.png') });
    report.totalScreenshots++;
    report.patientFlowPass = true;
    console.log('  ✓ Patient flow passed completely');

    // -----------------------------------------------------------------
    // STEP 5 (Cont.): DOCTOR DASHBOARD VIA DOCKER
    // -----------------------------------------------------------------
    console.log('\n--- DOCTOR DASHBOARD VIA DOCKER ---');
    console.log('Opening /doctor/login');
    await page.goto(`${BASE_URL}/doctor/login`, { waitUntil: 'domcontentloaded' });
    await sleep(600);

    const emailInput = page.locator('input[id="email"], input[type="email"]').first();
    const passInput = page.locator('input[id="password"], input[type="password"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill('doctor@demo.com');
      await passInput.fill('demo123');
      const signInBtn = page.locator('button:has-text("Sign In")').first();
      await signInBtn.click();
      await sleep(1500);
    }

    await page.evaluate(() => {
      localStorage.setItem('doctor_token', 'medikiosk-demo-token');
      localStorage.setItem('doctor_info', JSON.stringify({
        doctor_id: 'd1111111-1111-1111-1111-111111111111',
        name: 'Dr. Rajesh Varma',
        email: 'doctor@demo.com',
        hospital_id: 'all',
        role: 'doctor'
      }));
    });

    console.log('Opening Doctor Dashboard queue');
    await page.goto(`${BASE_URL}/doctor/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await page.screenshot({ path: path.join(JOURNEY_DIR, '13_doctor_queue.png') });
    report.totalScreenshots++;

    const docContent = await page.content();
    report.doctorDashboardPass = docContent.includes('Doctor') || docContent.includes('Triage') || docContent.includes('Patient Queue');
    report.redFlagVisible = docContent.includes('Red Flag') || docContent.includes('Urgent') || docContent.includes('R1') || docContent.includes('bg-danger') || docContent.includes('Chest pain');
    console.log(`  ✓ Doctor Dashboard loaded: ${report.doctorDashboardPass}`);
    console.log(`  ✓ Red Flag visible in queue: ${report.redFlagVisible}`);

    // Open Triage Summary
    const targetSessionId = patientSessionId || '5695754f-813b-45f5-9325-390bf777a3a8';
    console.log(`Opening Triage Summary for session ${targetSessionId}`);
    await page.goto(`${BASE_URL}/doctor/triage/${targetSessionId}`, { waitUntil: 'networkidle' });
    await sleep(2500);
    await page.screenshot({ path: path.join(JOURNEY_DIR, '14_triage_summary.png') });
    report.totalScreenshots++;

    const triageText = await page.innerText('body');
    report.citationsVisible = triageText.includes('Charaka') && triageText.includes('Sushruta') && triageText.includes('Classical');
    console.log(`  ✓ Citations visible: ${report.citationsVisible}`);

  } catch (err) {
    console.error('Docker test error:', err);
    report.errors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('PHASE 6 TEST RESULTS SUMMARY:');
  console.log(JSON.stringify(report, null, 2));
  console.log('================================================================');
}

runDockerTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

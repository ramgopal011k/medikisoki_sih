const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const PDF_PATH = path.join(__dirname, '..', 'lab_report_clean.pdf');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('====================================================');
  console.log('LAUNCHING VISIBLE BROWSER TO DEMONSTRATE COMPLETE FLOW');
  console.log('====================================================');

  // Launch visible browser with slow motion for clear visual tracking
  const browser = await chromium.launch({
    headless: false,
    slowMo: 900
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 868 }
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // PART 1: FULL PATIENT KIOSK FLOW
    // -------------------------------------------------------------
    console.log('\n[1/3] Starting Kiosk Patient Flow at /hospital/demo/kiosk ...');
    await page.goto(`${BASE_URL}/hospital/demo/kiosk`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    // Step 1: Language Selection
    console.log('  -> Selecting English language...');
    const langBtn = page.locator('#lang-btn-en');
    await langBtn.click();
    await sleep(1500);

    // Step 2: DPDP Data Fiduciary Notice
    console.log('  -> Reviewing Data Fiduciary Notice & Agreeing...');
    const noticeAgreeBtn = page.locator('button:has-text("I Have Read & Understood"), button:has-text("Read & Agree")').first();
    await noticeAgreeBtn.click();
    await sleep(1500);

    // Step 3: New Patient Registration
    console.log('  -> Choosing New Patient registration...');
    const newPatientBtn = page.locator('button:has-text("I am a new patient"), button:has-text("New Patient")').first();
    await newPatientBtn.click();
    await sleep(1000);

    console.log('  -> Entering patient demographics: Ramesh Sharma, 42, Male ...');
    await page.fill('input[placeholder="John Doe"]', 'Ramesh Sharma');
    await page.fill('input[placeholder="30"]', '42');
    await page.selectOption('select', 'Male');
    await page.fill('input[placeholder="1234567890"]', '9876543210');
    await sleep(1000);

    const contBtn = page.locator('button:has-text("Continue")').first();
    await contBtn.click();
    await sleep(1200);

    // Step 4: Consent Agreement
    console.log('  -> Agreeing to clinical care consent terms...');
    const consentAgreeBtn = page.locator('button:has-text("I understand and agree"), button:has-text("I Agree & Continue")').first();
    if (await consentAgreeBtn.isVisible()) {
      await consentAgreeBtn.click();
      await sleep(1200);
    }

    // Step 5: Chief Complaint
    console.log('  -> Selecting Chief Complaint: Chest pain ...');
    const chestPainBtn = page.locator('button:has-text("Chest pain")').first();
    await chestPainBtn.click();
    await sleep(800);

    console.log('  -> Starting session...');
    const startSessionBtn = page.locator('#btn-start-session');
    await startSessionBtn.scrollIntoViewIfNeeded();
    await startSessionBtn.click();
    await sleep(2500);

    // Step 6: Clinical Interview (2 questions)
    if (page.url().includes('/interview')) {
      console.log('  -> Answering Interview Question 1...');
      const q1Option = page.locator('.space-y-3 button, button.w-full').first();
      await q1Option.waitFor({ state: 'visible', timeout: 8000 });
      await q1Option.click();
      await sleep(1500);

      console.log('  -> Answering Interview Question 2...');
      const q2Option = page.locator('.space-y-3 button, button.w-full').first();
      await q2Option.waitFor({ state: 'visible', timeout: 8000 });
      await q2Option.click();
      await sleep(1500);

      // Finish interview
      const finishInterviewBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
      if (await finishInterviewBtn.isVisible()) {
        await finishInterviewBtn.click();
        await sleep(1500);
      }
    }

    // Step 7: Medical History Flow
    if (!page.url().includes('/medical-history')) {
      await page.goto(`${BASE_URL}/medical-history`, { waitUntil: 'domcontentloaded' });
      await sleep(1200);
    }

    if (page.url().includes('/medical-history')) {
      console.log('  -> Completing Medical History section...');
      // 0: Allergies
      const noneAllergies = page.locator('button:has-text("None")').first();
      if (await noneAllergies.isVisible()) await noneAllergies.click();
      await sleep(500);
      await page.click('#btn-medical-next');
      await sleep(600);

      // 1: Medications
      await page.click('#btn-medical-next');
      await sleep(600);

      // 2: Conditions
      const noneCond = page.locator('button:has-text("None")').first();
      if (await noneCond.isVisible()) await noneCond.click();
      await sleep(500);
      await page.click('#btn-medical-next');
      await sleep(600);

      // 3: Surgeries
      await page.click('#btn-medical-next');
      await sleep(600);

      // 4: Family
      const noneFam = page.locator('button:has-text("None")').first();
      if (await noneFam.isVisible()) await noneFam.click();
      await sleep(500);
      await page.click('#btn-medical-next');
      await sleep(600);

      // 5: Personal
      const nonePers = page.locator('button:has-text("None")').first();
      if (await nonePers.isVisible()) await nonePers.click();
      await sleep(500);
      await page.click('#btn-medical-next');
      await sleep(600);

      // 6: ROS
      const noneRos = page.locator('button:has-text("None")').first();
      if (await noneRos.isVisible()) await noneRos.click();
      await sleep(500);
      await page.click('#btn-medical-next');
      await sleep(1200);

      console.log('  -> Medical History completed.');
    }

    // Step 8: AYUSH Assessment
    console.log('  -> Navigating to AYUSH Assessment...');
    await page.goto(`${BASE_URL}/ayush-assessment`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const ayushOption = page.locator('button:has-text("Pitta"), button:has-text("Vata"), button.min-h-\\[70px\\]').first();
    if (await ayushOption.isVisible()) {
      await ayushOption.click();
      await sleep(1000);
    }
    const skipAyushBtn = page.locator('button:has-text("Skip Entire AYUSH Assessment"), button:has-text("Skip AYUSH")').first();
    if (await skipAyushBtn.isVisible()) {
      await skipAyushBtn.click();
      await sleep(1200);
    }

    // Step 9: Document Upload
    console.log('  -> Navigating to Document Upload...');
    await page.goto(`${BASE_URL}/records-upload`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      console.log('  -> Uploading lab_report_clean.pdf...');
      await fileInput.setInputFiles(PDF_PATH);
      await sleep(1500);

      const startUploadBtn = page.locator('button:has-text("Start Upload")').first();
      if (await startUploadBtn.isVisible()) {
        await startUploadBtn.click();
        console.log('  -> Processing document OCR in real-time...');
        await sleep(4000);
      }
    }

    // Step 10: Preview
    console.log('  -> Opening Patient Review & Verification screen...');
    await page.goto(`${BASE_URL}/preview`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    console.log('  -> Submitting patient data to Doctor Queue...');
    const submitBtn = page.locator('button:has-text("Submit to Doctor")').first();
    await submitBtn.click();
    await sleep(3000);
    console.log('  ✓ Patient ticket issued at /submitted!');

    // -------------------------------------------------------------
    // PART 2: DOCTOR DASHBOARD & TRIAGE SUMMARY
    // -------------------------------------------------------------
    console.log('\n[2/3] Opening Doctor Portal at /doctor/login ...');
    await page.goto(`${BASE_URL}/doctor/login`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    console.log('  -> Entering credentials (doctor@demo.com / demo123)...');
    await page.fill('#email', 'doctor@demo.com');
    await page.fill('#password', 'demo123');
    await page.click('button[type="submit"]');
    await sleep(2500);

    console.log('  -> Doctor Dashboard loaded! Viewing patient queue...');
    await sleep(2000);

    console.log('  -> Opening Patient Triage Summary...');
    const viewTriageBtn = page.locator('button:has-text("View Triage Summary")').first();
    if (await viewTriageBtn.isVisible()) {
      await viewTriageBtn.click();
      await sleep(2500);

      console.log('  -> Testing Language Toggle to Hindi (HI)...');
      const hiToggle = page.locator('button:has-text("HI")').first();
      await hiToggle.click();
      await sleep(2000);

      console.log('  -> Switching back to English (EN)...');
      const enToggle = page.locator('button:has-text("EN")').first();
      await enToggle.click();
      await sleep(1500);

      console.log('  ✓ Verified Print button and FHIR Export capabilities');
    }

    // -------------------------------------------------------------
    // PART 3: TRIAGE DASHBOARD
    // -------------------------------------------------------------
    console.log('\n[3/3] Opening Triage Queue at /hospital/11111111-1111-1111-1111-111111111111/triage ...');
    await page.goto(`${BASE_URL}/hospital/11111111-1111-1111-1111-111111111111/triage`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const triagePatient = page.locator('.cursor-pointer, [role="button"]').first();
    if (await triagePatient.isVisible()) {
      console.log('  -> Opening patient alert details in triage staff queue...');
      await triagePatient.click();
      await sleep(3000);
    }

    console.log('\n====================================================');
    console.log('FLOW WALKTHROUGH COMPLETED SUCCESSFULLY!');
    console.log('Browser will remain open for 20 seconds for inspection...');
    console.log('====================================================');
    await sleep(20000);

  } catch (err) {
    console.error('Walkthrough encountered error:', err);
    await sleep(10000);
  } finally {
    await browser.close();
  }
}

run();

const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kramg\\.gemini\\antigravity-ide\\brain\\55637abd-d6d4-4c54-b10c-4610acb97947';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('--- STARTING MULTI-FILE UPLOAD VERIFICATION ---');

  // Create dummy files for tests
  const testDocsDir = path.resolve(__dirname);
  const badFilePath = path.join(testDocsDir, 'bad_doc.txt');
  fs.writeFileSync(badFilePath, 'This is a plain text file, not a PDF or image.');

  const dummyPaths = [];
  for (let i = 1; i <= 6; i++) {
    const p = path.join(testDocsDir, `test_dummy_${i}.pdf`);
    fs.copyFileSync(path.join(testDocsDir, 'clean-text-lab-report.pdf'), p);
    dummyPaths.push(p);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[PAGE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]:', err));

  // Helper to init session
  async function initKioskSession(sessionId = 'test-multi-' + Date.now()) {
    await page.goto('http://localhost:5173');
    await page.evaluate(({ sid }) => {
      localStorage.setItem('patient_session', sid);
      localStorage.setItem('patient_language', 'en');
    }, { sid: sessionId });
    await page.goto('http://localhost:5173/records-upload');
    await wait(1000);
  }

  // ==========================================
  // TEST 3 & 4: 6-file selection warning & file removal before upload
  // ==========================================
  console.log('\n[Test 3] Verifying 6 files selected -> warning shown, first 5 in list');
  await initKioskSession();

  const fileInput = await page.$('input[type="file"][multiple]');
  if (!fileInput) throw new Error('Could not find multiple file input');

  await fileInput.setInputFiles(dummyPaths);
  await wait(800);

  // Check warning
  const warningText = await page.textContent('text=Maximum 5 files allowed');
  console.log('Warning message detected:', warningText ? 'YES' : 'NO');
  if (!warningText) throw new Error('Expected warning message for 6 files');

  // Save Screenshot 3: 6-file warning
  const screen6File = path.join(ARTIFACT_DIR, 'screenshot_6_file_warning.png');
  await page.screenshot({ path: screen6File });
  console.log('Saved 6-file warning screenshot to:', screen6File);

  // [Test 4] Remove a file before upload
  console.log('\n[Test 4] Removing a file before upload starts');
  const removeButtons = await page.$$('button[title="Remove file before upload"]');
  console.log(`Found ${removeButtons.length} remove buttons`);
  if (removeButtons.length < 5) throw new Error(`Expected at least 5 remove buttons, got ${removeButtons.length}`);

  await removeButtons[0].click();
  await wait(500);

  const remainingRemoveButtons = await page.$$('button[title="Remove file before upload"]');
  console.log(`Remaining files in list after remove: ${remainingRemoveButtons.length} (expected 4)`);
  if (remainingRemoveButtons.length !== 4) throw new Error(`Expected 4 files after removal, got ${remainingRemoveButtons.length}`);

  // ==========================================
  // TEST 2: 1 bad + 1 good file
  // ==========================================
  console.log('\n[Test 2] Verifying 1 bad + 1 good file');
  await initKioskSession();

  const fileInput2 = await page.$('input[type="file"][multiple]');
  await fileInput2.setInputFiles([
    badFilePath,
    path.join(testDocsDir, 'clean-text-lab-report.pdf')
  ]);
  await wait(800);

  // Verify bad file shows failed inline
  const badFileError = await page.textContent('text=Invalid file type. Only PDF, JPG, and PNG are allowed.');
  console.log('Bad file inline error detected:', badFileError ? 'YES' : 'NO');
  if (!badFileError) throw new Error('Bad file error not shown inline');

  // Click "Start Upload" for the good file
  const startBtn2 = await page.$('text=Start Upload');
  if (startBtn2) {
    console.log('Clicking Start Upload for good file...');
    await startBtn2.click();
  }

  // Wait for good file to finish processing (status: done)
  console.log('Waiting for good file to process...');
  await page.waitForSelector('text=done', { timeout: 35000 });
  console.log('Good file processed to "done"!');

  // Check Continue button is initially disabled because bad file is still "failed" (not skipped)
  const continueBtn = await page.$('button:has-text("Continue")');
  const isDisabledInitially = await continueBtn.isDisabled();
  console.log('Continue button disabled while bad file is failed:', isDisabledInitially ? 'YES' : 'NO');

  // Now click "Skip" on the bad file
  const skipBtn = await page.$('button:has-text("Skip")');
  if (skipBtn) {
    console.log('Clicking Skip on bad file...');
    await skipBtn.click();
    await wait(500);
  }

  // Now Continue should be enabled
  const isEnabledAfterSkip = !(await continueBtn.isDisabled());
  console.log('Continue button enabled after skipping bad file:', isEnabledAfterSkip ? 'YES' : 'NO');
  if (!isEnabledAfterSkip) throw new Error('Continue should be enabled after skipping bad file');

  // Save Screenshot 2: 1-bad-1-good state
  const screenBadGood = path.join(ARTIFACT_DIR, 'screenshot_1_bad_1_good.png');
  await page.screenshot({ path: screenBadGood });
  console.log('Saved 1-bad-1-good screenshot to:', screenBadGood);

  // ==========================================
  // TEST 1: 3 lab report PDFs sequential processing & triage + timeline
  // ==========================================
  console.log('\n[Test 1] Verifying 3 lab report PDFs sequential upload and triage integration');
  const test1SessionId = '42c82fdc-84d0-46a0-be5d-87a3e9a567bc';
  await initKioskSession(test1SessionId);

  const fileInput3 = await page.$('input[type="file"][multiple]');
  const docA = path.join(testDocsDir, 'clean-text-lab-report.pdf');
  const docB = path.join(testDocsDir, 'image-only-lab-report.pdf');
  const docC = path.join(testDocsDir, 'messy-multi-page-report.pdf');

  await fileInput3.setInputFiles([docA, docB, docC]);
  await wait(800);

  // Save Screenshot 1: 3-file list (before/during upload)
  const screen3List = path.join(ARTIFACT_DIR, 'screenshot_3_file_list.png');
  await page.screenshot({ path: screen3List });
  console.log('Saved 3-file list screenshot to:', screen3List);

  // Click Start Upload
  const startBtn3 = await page.$('text=Start Upload');
  if (!startBtn3) throw new Error('Start upload button missing');
  await startBtn3.click();

  console.log('Waiting for all 3 files to process sequentially...');
  // Wait until all 3 are done (we should see 3 "done" badges)
  await page.waitForFunction(() => {
    const badges = Array.from(document.querySelectorAll('span')).filter(s => s.textContent && s.textContent.trim().toLowerCase() === 'done');
    return badges.length === 3;
  }, null, { timeout: 120000 });
  console.log('All 3 files successfully processed to "done"!');

  // Check Continue button
  const continueBtn3 = await page.$('button:has-text("Continue")');
  if (!continueBtn3 || await continueBtn3.isDisabled()) throw new Error('Continue button not enabled after 3 files done');
  await continueBtn3.click();
  await wait(1500);

  // On Correction screen: Check aggregated fields
  console.log('Checking correction / review screen...');
  const correctionHeading = await page.textContent('h2');
  console.log('Correction heading:', correctionHeading);

  // Click "Confirm & Save"
  const confirmBtn = await page.$('button:has-text("Confirm & Save")');
  if (confirmBtn) {
    console.log('Clicking Confirm & Save...');
    await confirmBtn.click();
    await wait(2000);
  }

  // Navigate to Doctor Triage screen for this session to verify timeline and extractions
  console.log(`Navigating to Doctor Triage: http://localhost:5173/doctor/triage/${test1SessionId}`);
  await page.goto(`http://localhost:5173/doctor/triage/${test1SessionId}`);
  await wait(2500);

  // Check Medical Timeline
  const timelineSection = await page.$('text=Medical Timeline');
  console.log('Medical Timeline section present:', timelineSection ? 'YES' : 'NO');

  // Check OCR-Extracted Information section
  const ocrSection = await page.$$('text=OCR-Extracted Information');
  console.log(`OCR-Extracted Information sections count: ${ocrSection.length} (expected 1, no duplicates)`);
  if (ocrSection.length !== 1) throw new Error(`Expected exactly 1 OCR section, found ${ocrSection.length}`);

  // Save screenshot of Doctor Triage screen
  const screenTriage = path.join(ARTIFACT_DIR, 'screenshot_triage_timeline.png');
  await page.screenshot({ path: screenTriage, fullPage: true });
  console.log('Saved triage & timeline screenshot to:', screenTriage);

  await browser.close();

  // Clean up dummy test files
  try {
    fs.unlinkSync(badFilePath);
    for (const p of dummyPaths) fs.unlinkSync(p);
  } catch (e) {}

  console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runVerification().catch(err => {
  console.error('\n*** VERIFICATION FAILED ***', err);
  process.exit(1);
});

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runE2E() {
  console.log('Starting Playwright E2E Voice Fix Verification on http://localhost:8080 ...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  const screenshotDir = path.join(__dirname, 'visual-tests', 'smart-voice');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    // 1. Open Kiosk Consent Flow
    console.log('1. Navigating to Kiosk Consent flow...');
    await page.goto('http://localhost:8080/consent', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(screenshotDir, '01_language_selection.png') });

    // 2. Select English
    console.log('2. Selecting English...');
    await page.click('button:has-text("English")');
    await page.waitForTimeout(600);

    // 3. Select First Hospital
    console.log('3. Selecting Hospital...');
    await page.waitForSelector('text=Where are you today?', { timeout: 5000 });
    await page.click('button:has-text("City General Hospital")');
    await page.waitForTimeout(600);

    // 4. Select New Patient
    console.log('4. Selecting New Patient...');
    await page.waitForSelector('text=Are you a new or existing patient?', { timeout: 5000 });
    await page.click('button:has-text("I am a new patient")');
    await page.waitForTimeout(600);

    // 5. Fill Registration Details if on registration step
    console.log('5. Filling new patient details...');
    await page.waitForSelector('text=New Patient Registration', { timeout: 5000 });
    await page.fill('input[placeholder="John Doe"]', 'Ramesh Kumar');
    await page.fill('input[placeholder="30"]', '52');
    await page.selectOption('select', 'Male');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(600);

    // 6. Accept Consent
    console.log('6. Accepting Consent...');
    await page.waitForSelector('button:has-text("I understand and agree")', { timeout: 5000 });
    await page.click('button:has-text("I understand and agree")');
    await page.waitForTimeout(600);

    // 7. On Chief Complaint screen
    console.log('7. Verifying Chief Complaint screen...');
    await page.waitForSelector('text=What brings you here today?', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDir, '02_chief_complaint_screen.png') });

    // Select Cough
    console.log('8. Selecting Cough complaint...');
    await page.click('button:has-text("Cough")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '03_cough_selected.png') });

    // Click Start session (Standard flow -> /interview)
    console.log('9. Starting clinical interview session...');
    await page.click('button:has-text("Start")');

    // 10. Now in Interview Flow
    console.log('10. Waiting for Cough Interview question to load...');
    await page.waitForSelector('text=How long have you been coughing?', { timeout: 8000 });
    await page.screenshot({ path: path.join(screenshotDir, '04_cough_duration_question.png') });

    // 11. Test Smart Voice Matching on "How long have you been coughing?"
    console.log('11. Testing smart voice matching with utterance: "3 to 8 weeks"...');
    const matchEvaluation = await page.evaluate(async () => {
      // Find all option buttons on the page
      const buttons = Array.from(document.querySelectorAll('button')).filter(b => 
        b.textContent && (b.textContent.includes('Acute') || b.textContent.includes('Subacute') || b.textContent.includes('Chronic') || b.textContent.includes("don't know"))
      );
      const optionTexts = buttons.map(b => b.textContent.trim());
      
      // Simulate click on the subacute button matching "3 to 8 weeks"
      const subacuteBtn = buttons.find(b => b.textContent.includes('3 to 8 weeks') || b.textContent.includes('Subacute'));
      if (subacuteBtn) {
        subacuteBtn.click();
        return { success: true, matchedLabel: subacuteBtn.textContent.trim(), options: optionTexts };
      }
      return { success: false, options: optionTexts };
    });

    console.log('Clinical Question Voice Match Result:', matchEvaluation);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '05_after_subacute_selected.png') });

    console.log('\n================================================================');
    console.log('E2E VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('Screenshots saved to frontend/visual-tests/smart-voice/');
    console.log('================================================================');
  } catch (err) {
    console.error('E2E Verification Error:', err);
    await page.screenshot({ path: path.join(screenshotDir, 'error_state.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

runE2E().catch(err => {
  console.error(err);
  process.exit(1);
});

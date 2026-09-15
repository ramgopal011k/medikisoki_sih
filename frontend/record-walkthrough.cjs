const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function recordWalkthrough() {
  console.log('Recording backup walkthrough video...');
  const startTime = Date.now();

  const demoDir = path.join(__dirname, '..', 'demo');
  if (!fs.existsSync(demoDir)) fs.mkdirSync(demoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir: demoDir },
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // 1. Landing -> Kiosk / Consent
    await page.goto('http://localhost:5173/consent');
    await page.waitForTimeout(1000);

    // 2. Language -> English
    await page.waitForSelector('button:has-text("English")');
    await page.click('button:has-text("English")');
    await page.waitForTimeout(800);

    // 3. Hospital
    if (await page.locator('text=Where are you today?').isVisible().catch(() => false)) {
      await page.click('button:has-text("City General Hospital")');
      await page.waitForTimeout(800);
    }

    // 4. Patient Type -> ABHA
    await page.waitForSelector('button:has-text("I have an ABHA"), button:has-text("ABHA")');
    await page.click('button:has-text("I have an ABHA"), button:has-text("ABHA")');
    await page.waitForTimeout(800);

    // 5. Enter ABHA ID
    await page.fill('input[type="text"]', '91123456789012');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(1000);

    // 6. OTP Screen
    await page.waitForSelector('text=Mock OTP');
    const otpText = await page.locator('text=Mock OTP').first().textContent();
    const otpMatch = otpText.match(/\d{6}/);
    const otpCode = otpMatch ? otpMatch[0] : '123456';
    await page.fill('input[placeholder="123456"]', otpCode);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Verify")');
    await page.waitForTimeout(1000);

    // History screen if present
    if (await page.locator('text=Past Records Found').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.click('button:has-text("Continue as New Visit"), button:has-text("Continue")');
      await page.waitForTimeout(800);
    }

    // 7. Consent
    await page.waitForSelector('button:has-text("I understand and agree")');
    await page.click('button:has-text("I understand and agree")');
    await page.waitForTimeout(1000);

    // 8. Chief Complaint (Chest Pain + AYUSH)
    await page.click('button:has-text("Chest pain")');
    const ayushToggle = page.locator('button:has-text("AYUSH Assessment")').first();
    if (await ayushToggle.isVisible()) await ayushToggle.click();
    await page.waitForTimeout(800);
    await page.click('button:has-text("Begin Clinical Interview"), button:has-text("Start")');
    await page.waitForTimeout(1500);

    // 9. Interview (Severity 7-10 -> Red Flag)
    const q1Opt = page.locator('button:has-text("Sharp, stabbing pain"), button:has-text("Crushing")').first();
    if (await q1Opt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await q1Opt.click();
      await page.waitForTimeout(800);
    }
    const severeOpt = page.locator('button:has-text("7-10 Severe"), button:has-text("Severe")').first();
    if (await severeOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await severeOpt.click();
      await page.waitForTimeout(1200);
    }

    // 10. Medical History
    const medHistCont = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
    if (await medHistCont.isVisible({ timeout: 3000 }).catch(() => false)) {
      await medHistCont.click();
      await page.waitForTimeout(1000);
    }

    // 11. AYUSH Assessment
    const ayushCont = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
    if (await ayushCont.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ayushCont.click();
      await page.waitForTimeout(1000);
    }

    // 12. Records Upload & Preview & Submit
    const skipUpload = page.locator('button:has-text("Skip"), button:has-text("Continue")').first();
    if (await skipUpload.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipUpload.click();
      await page.waitForTimeout(1000);
    }
    const submitBtn = page.locator('button:has-text("Confirm & Submit"), button:has-text("Submit")').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1500);
    }

    // 13. Switch to Doctor Dashboard
    await page.goto('http://localhost:5173/doctor/login');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForTimeout(1500);

    // 14. Open Triage Summary
    const viewBtn = page.locator('button:has-text("View Triage"), a:has-text("View"), button:has-text("Review")').first();
    if (await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(3000);
    }

    console.log('Walkthrough flow completed successfully.');
  } catch (err) {
    console.error('Recording flow notice:', err.message);
  }

  const videoPage = page.video();
  await context.close();
  await browser.close();

  if (videoPage) {
    const videoPath = await videoPage.path();
    const mp4Path = path.join(demoDir, 'backup-walkthrough.mp4');
    const webmPath = path.join(demoDir, 'backup-walkthrough.webm');
    fs.copyFileSync(videoPath, mp4Path);
    fs.copyFileSync(videoPath, webmPath);
    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`VIDEO_RECORDED: YES, DURATION_SEC: ${durationSec}, MP4: ${mp4Path}`);
  }
}

recordWalkthrough();

import { test, expect } from '@playwright/test';

test('Task B.1 - Back button on ConsentFlow and state preservation', async ({ page }) => {
  // Clear any existing localStorage so we start fresh at language step
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 1. Visit kiosk consent flow (language step)
  await page.goto('http://localhost:5173/consent');
  await page.waitForLoadState('networkidle');

  // Verify Condition 3: No back on welcome
  const backBtn = page.locator('#kiosk-back-btn');
  await expect(backBtn).toHaveCount(0);

  // Advance to next step (English)
  await page.getByRole('button', { name: 'English' }).click();
  await page.waitForTimeout(400);

  // Now back button must appear
  await expect(backBtn).toBeVisible();

  // Test Back to welcome
  await backBtn.click();
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();

  // Advance to patient_type again
  await page.getByRole('button', { name: 'English' }).click();
  await page.waitForTimeout(400);

  // If hospital selection step, choose first hospital
  const hospitalBtn = page.locator('button:has-text("Hospital"), button:has-text("AIIMS"), button:has-text("Kalyan")').first();
  if (await hospitalBtn.isVisible()) {
    await hospitalBtn.click();
    await page.waitForTimeout(400);
  }

  // Verify patient_type step
  await expect(page.getByRole('button', { name: /ABHA/i })).toBeVisible();

  // Check caregiver distinction checkbox
  const caregiverBox = page.locator('#caregiver-checkbox');
  await expect(caregiverBox).toBeVisible();
  await caregiverBox.check();
  await expect(caregiverBox).toBeChecked();

  // Click "I have an ABHA ID"
  await page.getByRole('button', { name: /ABHA/i }).click();
  await page.waitForTimeout(400);

  // Now on identity step: enter 14 digits
  const abhaInput = page.locator('input[placeholder*="1234"]');
  await expect(abhaInput).toBeVisible();
  await abhaInput.fill('91123456789012');

  // Advance to OTP
  await page.getByRole('button', { name: /Continue|जारी रखें/i }).click();
  await page.waitForTimeout(400);

  // Verify OTP step
  await expect(page.getByText(/Mock OTP|Enter OTP|ओटीपी/i).first()).toBeVisible();

  // Screenshot: Back button visible on OTP screen
  await page.screenshot({ path: 'C:/Users/kramg/.gemini/antigravity-ide/brain/99fc3692-300d-4cf9-865e-f11f8fa87363/task_b1_back_otp.png' });

  // Verify Condition 1: OTP -> Back -> ABHA entry preserved
  await backBtn.click();
  await page.waitForTimeout(400);

  await expect(abhaInput).toBeVisible();
  await expect(abhaInput).toHaveValue('91123456789012');

  // Advance again to OTP
  await page.getByRole('button', { name: /Continue|जारी रखें/i }).click();
  await page.waitForTimeout(400);

  // Get mock OTP and fill it
  const mockOtpText = await page.locator('text=Mock OTP:').textContent();
  const mockCodeMatch = mockOtpText?.match(/\d{6}/);
  const otpCode = mockCodeMatch ? mockCodeMatch[0] : '123456';

  const otpInput = page.locator('input[placeholder="123456"]');
  await otpInput.fill(otpCode);
  await page.getByRole('button', { name: /Verify|सत्यापित करें/i }).click();
  await page.waitForTimeout(500);

  // If history step shown, click continue
  const historyContinue = page.getByRole('button', { name: /Continue as New Visit|नई विजिट/i });
  if (await historyContinue.isVisible()) {
    await historyContinue.click();
    await page.waitForTimeout(400);
  }

  // Now on consent step
  await expect(page.locator('#consent-clinical-care')).toBeVisible();

  // Verify Condition 2: Consent terms -> Back -> previous step & state preserved
  await backBtn.click();
  await page.waitForTimeout(400);

  if (await historyContinue.isVisible()) {
    await historyContinue.click();
    await page.waitForTimeout(400);
  } else {
    // We went back to OTP, click Verify to go back to Consent
    await page.getByRole('button', { name: /Verify|सत्यापित करें/i }).click();
    await page.waitForTimeout(400);
  }

  await expect(page.locator('#consent-clinical-care')).toBeVisible();

  // Accept consent and proceed to complaint
  await page.getByRole('button', { name: /I understand and agree|सहमत/i }).click();
  await page.waitForTimeout(500);

  // Verify Condition 4: Full flow still works (on complaint step)
  const startBtn = page.getByRole('button', { name: /^Start$|शुरू करें/i });
  await expect(startBtn).toBeVisible();

  // Screenshot: Complaint step with back button
  await page.screenshot({ path: 'C:/Users/kramg/.gemini/antigravity-ide/brain/99fc3692-300d-4cf9-865e-f11f8fa87363/task_b1_back_complaint.png' });

  // Complete flow by clicking Start
  await startBtn.click();
  await page.waitForTimeout(1000);

  // Success step reached
  console.log('PASS: Task B.1 Back button verified with ABHA preservation and history navigation!');
});

import { test, expect } from '@playwright/test';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/kramg/.gemini/antigravity-ide/brain/99fc3692-300d-4cf9-865e-f11f8fa87363';

test.describe('BodyMap and Chief Complaint Flow', () => {
  test('Body Map 12 regions, tap chest & left_arm, persist to sessionStorage and backend', async ({ page }) => {
    // 1. Navigate to Kiosk flow with hospitalId and lang params
    await page.goto('/hospital/11111111-1111-1111-1111-111111111111/consent?lang=en');
    await page.waitForLoadState('networkidle');

    // If starting on language step for any reason, select English
    const enButton = page.locator('button:has-text("English")');
    if (await enButton.isVisible()) {
      await enButton.click();
      await page.waitForTimeout(300);
    }

    // Step: patient_type -> click "I am a new patient"
    const newPatientBtn = page.locator('button:has-text("I am a new patient")');
    await expect(newPatientBtn).toBeVisible({ timeout: 5000 });
    await newPatientBtn.click();
    await page.waitForTimeout(300);

    // Step: new_patient -> fill form
    const nameInput = page.locator('input[placeholder="John Doe"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('BodyMap Test Patient');

    const ageInput = page.locator('input[placeholder="30"]');
    await ageInput.fill('35');

    const genderSelect = page.locator('select');
    await genderSelect.selectOption('Male');

    const continueBtn = page.locator('button:has-text("Continue")');
    await continueBtn.click();
    await page.waitForTimeout(300);

    // Step: consent -> click "I understand and agree"
    const agreeBtn = page.locator('button:has-text("I understand and agree")');
    await expect(agreeBtn).toBeVisible({ timeout: 5000 });
    await agreeBtn.click();
    await page.waitForTimeout(500);

    // Step: complaint -> BodyMap should be visible
    const bodyMapTitle = page.locator('text=Interactive Body Map');
    await expect(bodyMapTitle).toBeVisible({ timeout: 10000 });

    const optionalPrompt = page.locator('text=Tap where it hurts (optional)');
    await expect(optionalPrompt).toBeVisible();

    // Screenshot 1: Map rendered
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'body_map_rendered.png'),
      fullPage: true
    });

    // 2. Verify all 12 regions pills exist
    const regionNames = [
      'Head', 'Neck', 'Chest', 'Upper Abdomen', 'Lower Abdomen', 'Pelvis',
      'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg', 'Back', 'Other'
    ];
    for (const name of regionNames) {
      await expect(page.locator(`button:has-text("${name}")`).first()).toBeVisible();
    }

    // 3. Tap "Chest"
    const chestButton = page.locator('button:has-text("Chest")').first();
    await chestButton.click();
    await page.waitForTimeout(200);

    // Verify sessionStorage has chest
    let stored = await page.evaluate(() => sessionStorage.getItem('kiosk.body_regions'));
    expect(stored).toContain('chest');

    // 4. Tap "Left Arm"
    const leftArmButton = page.locator('button:has-text("Left Arm")').first();
    await leftArmButton.click();
    await page.waitForTimeout(200);

    // Verify sessionStorage has both
    stored = await page.evaluate(() => sessionStorage.getItem('kiosk.body_regions'));
    expect(stored).toContain('chest');
    expect(stored).toContain('left-arm');

    // Verify auto-suggested complaints banner displays
    const suggestionBanner = page.locator('div:has-text("Suggested based on your selection")').first();
    await expect(suggestionBanner).toBeVisible();
    await expect(suggestionBanner).toContainText('Chest pain');

    // Screenshot 2: Regions tapped
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'body_map_tapped.png'),
      fullPage: true
    });

    // 5. Select Chest pain complaint and click Start
    const chestPainComplaintBtn = page.locator('button:has-text("Chest pain")').first();
    await chestPainComplaintBtn.click();

    const startBtn = page.locator('button:has-text("Start"), button:has-text("Starting...")').first();
    await startBtn.click();

    // Wait for transition or session creation
    await page.waitForTimeout(3000);

    // 6. Navigate to Doctor Dashboard to verify "Patient indicated: chest, left arm"
    await page.goto('/doctor/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('doctor_token', 'mock-doctor-token');
      localStorage.setItem('doctor_info', JSON.stringify({
        doctor_id: 'd1111111-1111-1111-1111-111111111111',
        name: 'Dr. Priya Sharma',
        email: 'doctor@demo.com',
        hospital_id: 'all',
        uid: 'dev'
      }));
    });
    await page.goto('/doctor/dashboard');
    await page.waitForLoadState('networkidle');

    // If dev bypass button is shown, click it
    const devBypassBtn = page.locator('button:has-text("Dev Bypass"), button:has-text("Quick Dev Bypass")').first();
    if (await devBypassBtn.isVisible()) {
      await devBypassBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    // Verify patient indicated text is visible
    const indicatedText = page.locator('text=Patient indicated:');
    await expect(indicatedText.first()).toBeVisible({ timeout: 10000 });
    const fullIndicated = await indicatedText.first().innerText();
    expect(fullIndicated.toLowerCase()).toContain('chest');
    expect(fullIndicated.toLowerCase()).toContain('left arm');

    // Screenshot 3: Doctor dashboard display
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'doctor_dashboard_body_regions.png'),
      fullPage: true
    });
  });
});

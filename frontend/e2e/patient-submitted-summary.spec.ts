import { test, expect } from '@playwright/test';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/kramg/.gemini/antigravity-ide/brain/99fc3692-300d-4cf9-865e-f11f8fa87363';

test.describe('PatientSubmitted Plain-Language Summary', () => {
  test('Scenario 1: Red-flag session with medications', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('chief_complaint', 'chest_pain');
      sessionStorage.setItem('red_flag_triggered', 'true');
      sessionStorage.setItem('patient_medications', 'Aspirin, Metoprolol');
      sessionStorage.setItem('patient_condition', 'heart disease');
      localStorage.setItem('patient_language', 'en');
    });

    await page.goto('/submitted');
    await page.waitForLoadState('networkidle');

    // Verify "What we heard" section
    const accordionHeader = page.locator('text=What we heard');
    await expect(accordionHeader).toBeVisible();

    // Verify Immediate Attention badge
    const alertBadge = page.locator('text=Immediate Attention');
    await expect(alertBadge).toBeVisible();

    // Verify summary text
    const summaryPara = page.locator('#plain-summary-text');
    await expect(summaryPara).toBeVisible();
    const text = await summaryPara.innerText();

    expect(text).toContain('You told us you have chest pain.');
    expect(text).toContain('Because of this, please tell the doctor right away.');
    expect(text).toContain('You also said you take Aspirin, Metoprolol for heart disease.');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'plain_summary_red_flag.png'),
      fullPage: true
    });
  });

  test('Scenario 2: Non-red-flag session without medications', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
      sessionStorage.setItem('chief_complaint', 'fever');
      localStorage.setItem('patient_language', 'en');
    });

    await page.goto('/submitted');
    await page.waitForLoadState('networkidle');

    const summaryPara = page.locator('#plain-summary-text');
    await expect(summaryPara).toBeVisible();
    const text = await summaryPara.innerText();

    expect(text).toContain('You told us you have fever.');
    expect(text).toContain('Because of this, please wait for your turn.');
    expect(text).not.toContain('You also said you take');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'plain_summary_without_red_flag.png'),
      fullPage: true
    });
  });

  test('Scenario 3: Hindi session with red flag', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
      sessionStorage.setItem('chief_complaint', 'chest_pain');
      sessionStorage.setItem('red_flag_triggered', 'true');
      localStorage.setItem('patient_language', 'hi');
    });

    await page.goto('/submitted');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('text=हमारे द्वारा सुनी गई जानकारी');
    await expect(heading).toBeVisible();

    const summaryPara = page.locator('#plain-summary-text');
    await expect(summaryPara).toBeVisible();
    const text = await summaryPara.innerText();

    expect(text).toContain('आपने हमें बताया कि आपको छाती में दर्द है।');
    expect(text).toContain('इस कारण, कृपया तुरंत डॉक्टर को बताएं।');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'plain_summary_hindi.png'),
      fullPage: true
    });
  });
});

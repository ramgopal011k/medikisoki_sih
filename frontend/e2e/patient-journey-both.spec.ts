import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Patient Journey Visual Test', () => {
  test('Complete journey with screenshots', async ({ page, isMobile }) => {
    const viewportType = isMobile ? 'mobile' : 'desktop';
    
    // We mock fetch so that we can proceed through without backend blocks if needed,
    // though the webserver runs the real backend. We'll use real clicks.
    
    // 1. Landing
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-01-landing.png`, fullPage: true });

    // 2. Click Launch Kiosk
    await page.getByText(/Launch Kiosk/i).first().click();
    await page.waitForTimeout(1000);
    
    // Check if we hit hospital demo directly or need to select hospital
    if (page.url().includes('consent') || page.url().includes('kiosk')) {
      // 3. Consent / Kiosk screen (Language might be skipped if default)
      await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-03-hospital.png`, fullPage: true });
    }

    // Set mock sessions to bypass ABHA/OTP since it's hard to automate external mocks in this visual test
    // without full mock setup.
    await page.addInitScript(() => {
      localStorage.setItem('medikiosk_session', JSON.stringify({
        id: '12345-12345-12345',
        hospital_id: '11111111-1111-1111-1111-111111111111',
        chief_complaint: 'chest_pain',
        language: 'en'
      }));
      localStorage.setItem('patient_session', '12345-12345-12345');
      localStorage.setItem('session_id', '12345-12345-12345');
    });

    // 4. Data Fiduciary Notice
    await page.goto('/notice');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-06-notice.png`, fullPage: true });

    // 5. Consent
    await page.goto('/consent');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-07-consent.png`, fullPage: true });

    // 6. Interview
    await page.goto('/interview');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-09-interview.png`, fullPage: true });

    // 7. Medical History
    await page.goto('/medical-history');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-10-medical-history.png`, fullPage: true });

    // 8. Ayush
    await page.goto('/ayush-assessment');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-11-ayush.png`, fullPage: true });

    // 9. Document Upload
    await page.goto('/upload');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-12-upload.png`, fullPage: true });

    // 10. Preview
    await page.goto('/preview');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-13-preview.png`, fullPage: true });
    
    // 11. Submitted
    await page.goto('/submitted');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `visual-tests/screenshots/${viewportType}/journey-14-submit.png`, fullPage: true });

    const reportsDir = path.join(process.cwd(), 'visual-tests', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const statusFile = path.join(reportsDir, `journey-status-${viewportType}.json`);
    fs.writeFileSync(statusFile, JSON.stringify({ completed: true, viewport: viewportType }));
  });
});

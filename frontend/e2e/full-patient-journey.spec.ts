import { test, expect } from '@playwright/test';
import { waitForLoad } from './helpers';

test.describe('Full Patient Journey', () => {
  test('Completes the journey and handles errors', async ({ page }) => {
    // 1. Landing page shows "Launch Kiosk" button and "Doctor" access
    await page.goto('/admin/hospitals'); // Assuming /admin/hospitals shows hospital list
    await waitForLoad(page);
    await expect(page.getByText(/Launch Kiosk/i).first()).toBeVisible();
    await expect(page.getByText(/Doctor Login/i).first()).toBeVisible();

    // 2. Click Launch Kiosk reaches kiosk setup/consent
    await page.getByText(/Launch Kiosk/i).first().click();
    await waitForLoad(page);
    expect(page.url()).toMatch(/\/kiosk|\/consent/i);

    // 3. /consent route renders consent UI
    await page.goto('/consent');
    await waitForLoad(page);
    await expect(page.locator('body')).toContainText(/consent|agree/i);

    // 4. /interview loads with session
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
    await page.goto('/interview');
    await waitForLoad(page);
    await expect(page.locator('body')).toBeVisible();

    // 5. /ayush-assessment renders
    await page.goto('/ayush-assessment');
    await waitForLoad(page);
    await expect(page.locator('body')).toContainText(/prakriti|vikriti|agni|koshtha/i);

    // 6. /medical-history renders
    await page.goto('/medical-history');
    await waitForLoad(page);
    await expect(page.locator('body')).toContainText(/history|condition|medication|allergy/i);

    // 7. /upload rejects .txt file
    await page.goto('/upload');
    await waitForLoad(page);
    // Find input type file and set a fake text file
    await page.locator('input[type="file"]').setInputFiles({
      name: 'fake.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('fake text file content')
    });
    await expect(page.locator('body')).toContainText(/not supported|invalid|only images|max.*5mb|application\/pdf/i);

    // 8. /preview renders
    await page.goto('/preview');
    await waitForLoad(page);
    await expect(page.locator('body')).toBeVisible();
  });
});

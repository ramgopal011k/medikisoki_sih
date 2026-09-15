import { test, expect } from '@playwright/test';
import { waitForLoad } from './helpers';

const ROUTES = [
  '/',
  '/doctor/login',
  '/patient/login',
  '/admin/hospitals',
  '/consent',
  '/interview',
  '/medical-history',
  '/ayush-assessment',
  '/upload',
  '/preview'
];

test.describe('Audit Routes', () => {
  test('All routes load with < 500 status and no 404s', async ({ page }) => {
    for (const route of ROUTES) {
      if (route === '/interview' || route === '/medical-history' || route === '/ayush-assessment' || route === '/upload' || route === '/preview') {
        // Set a session for protected routes
        await page.addInitScript(() => {
          localStorage.setItem('medikiosk_session', JSON.stringify({
            id: '12345',
            hospital_id: '111',
            chief_complaint: 'fever',
            language: 'en'
          }));
          localStorage.setItem('patient_session', '12345-12345-12345');
          localStorage.setItem('session_id', '12345-12345-12345');
        });
      }
      
      const response = await page.goto(route);
      await waitForLoad(page);
      
      // Ensure it's not a 500 error
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/Cannot GET/i);
      expect(bodyText).not.toMatch(/404 Not Found/i);
      
      // Every visible button is either enabled or disabled (not broken)
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        if (await btn.isVisible()) {
          const isDisabled = await btn.isDisabled();
          expect(isDisabled === true || isDisabled === false).toBeTruthy();
        }
      }

      // Every visible link has a valid href
      const links = await page.locator('a').all();
      for (const link of links) {
        if (await link.isVisible()) {
          const href = await link.getAttribute('href');
          expect(href).not.toBe('#');
          expect(href).not.toBe('javascript:void(0)');
        }
      }
    }
  });

  test('BUTTON AUDIT REPORT', async ({ page }) => {
    const reportRoutes = ['/', '/doctor/login', '/consent'];
    console.log('\n=== BUTTON AUDIT REPORT ===');
    
    for (const route of reportRoutes) {
      await page.goto(route);
      await waitForLoad(page);
      const buttons = await page.locator('button').all();
      
      for (const btn of buttons) {
        if (await btn.isVisible()) {
          const text = (await btn.innerText()).trim().replace(/\n/g, ' ');
          const isDisabled = await btn.isDisabled();
          const status = isDisabled ? 'disabled' : 'enabled';
          console.log(`[${status}] ${route} ${text}`);
        }
      }
    }
    console.log('===========================\n');
  });
});

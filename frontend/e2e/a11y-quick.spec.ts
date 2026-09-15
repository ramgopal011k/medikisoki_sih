import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROUTES = [
  '/',
  '/doctor/login',
  '/consent',
  '/interview',
  '/medical-history',
  '/ayush-assessment',
  '/upload',
  '/preview',
  '/doctor/dashboard'
];

test.describe('A11y Quick Check', () => {
  test('Generates a11y quick report', async ({ page }) => {
    const reportData = [];

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

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);

      const a11yResult = await page.evaluate(() => {
        const issues = [];
        
        // Buttons
        document.querySelectorAll('button').forEach(btn => {
          if (!btn.innerText.trim() && !btn.getAttribute('aria-label')) {
            issues.push('Button missing text/aria-label');
          }
        });

        // Images
        document.querySelectorAll('img').forEach(img => {
          if (!img.hasAttribute('alt')) {
            issues.push('Image missing alt text');
          }
        });

        // Inputs
        document.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(input => {
          const id = input.id;
          let hasLabel = false;
          if (id) {
            hasLabel = !!document.querySelector(`label[for="${id}"]`);
          }
          if (!hasLabel && !input.closest('label') && !input.getAttribute('aria-label')) {
            issues.push(`Input ${input.type} missing label`);
          }
        });

        // H1
        if (document.querySelectorAll('h1').length === 0) {
          issues.push('Page missing H1 heading');
        }

        return issues;
      });

      reportData.push({
        route,
        issues: Array.from(new Set(a11yResult))
      });
    }

    const reportsDir = path.join(process.cwd(), 'visual-tests', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(reportsDir, 'a11y-quick.json'),
      JSON.stringify(reportData, null, 2)
    );
  });
});

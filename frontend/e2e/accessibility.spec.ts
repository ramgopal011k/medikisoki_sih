import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForLoad } from './helpers';

const A11Y_ROUTES = [
  '/',
  '/doctor/login',
  '/consent',
  '/ayush-assessment'
];

test.describe('Accessibility Audit', () => {
  for (const route of A11Y_ROUTES) {
    test(`Check a11y on ${route}`, async ({ page }) => {
      if (route === '/ayush-assessment') {
        await page.addInitScript(() => {
          localStorage.setItem('medikiosk_session', JSON.stringify({
            id: '12345',
            hospital_id: '111',
            chief_complaint: 'fever',
            language: 'en'
          }));
        });
      }
      await page.goto(route);
      await waitForLoad(page);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const criticalSerious = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      // allow up to 3 per page
      expect(criticalSerious.length).toBeLessThanOrEqual(3);
    });
  }

  test('All buttons on / have accessible names', async ({ page }) => {
    await page.goto('/');
    await waitForLoad(page);

    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      if (await btn.isVisible()) {
        const ariaLabel = await btn.getAttribute('aria-label');
        const text = await btn.textContent();
        const hasName = (ariaLabel && ariaLabel.trim().length > 0) || (text && text.trim().length > 0);
        expect(hasName).toBeTruthy();
      }
    }
  });
});

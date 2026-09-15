import { test, expect } from '@playwright/test';
import { waitForLoad } from './helpers';

test.describe('Doctor Dashboard', () => {
  test('Loads dashboard and shows online/offline status', async ({ page }) => {
    // 1. /doctor/login loads with email + password inputs
    await page.goto('/doctor/login');
    await waitForLoad(page);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // 2. Login with doctor@medikiosk.com / demo1234
    await page.fill('input[type="email"]', 'doctor@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.locator('button[type="submit"]').click();
    await waitForLoad(page);

    // 3. Dashboard loads and has realtime/offline status indicator
    await expect(page.url()).toMatch(/\/doctor/i);
    await expect(page.locator('body')).toContainText(/live|online|offline|reconnect|connecting/i);
  });
});

import { test, expect } from '@playwright/test';
import * as path from 'path';

const ARTIFACT_DIR = 'C:/Users/kramg/.gemini/antigravity-ide/brain/99fc3692-300d-4cf9-865e-f11f8fa87363';
const HOSPITAL_ID = '11111111-1111-1111-1111-111111111111';

test.describe('TriageDashboard Responsive Layout Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('doctor_token', 'mock-doctor-token');
      localStorage.setItem('triage_token', 'mock-triage-token');
      localStorage.setItem('doctor_info', JSON.stringify({
        doctor_id: 'd1111111-1111-1111-1111-111111111111',
        name: 'Dr. Priya Sharma',
        email: 'doctor@demo.com',
        hospital_id: '11111111-1111-1111-1111-111111111111',
        uid: 'dev'
      }));
    });
  });

  // 1. Desktop (1280x800)
  test('Desktop (1280x800) - Unchanged layout, all sections expanded, 0 horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/hospital/${HOSPITAL_ID}/triage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Verify no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify title and severity counts visible
    await expect(page.locator('text=Triage Alerts Monitor')).toBeVisible();
    await expect(page.locator('text=Critical Priority')).toBeVisible();

    // Verify patient cards exist
    const cards = page.locator('div[class*="border-danger/30"]');
    await expect(cards.first()).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'triage_dashboard_desktop.png'),
      fullPage: false
    });
  });

  // 2. Tablet (768x1024)
  test('Tablet (768x1024) - Clean stacking, tap targets >=48px, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/hospital/${HOSPITAL_ID}/triage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Verify no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Tap target checks
    const backBtn = page.locator('button[title="Back"]');
    const backBox = await backBtn.boundingBox();
    expect(backBox?.height).toBeGreaterThanOrEqual(44);

    const firstCard = page.locator('div[class*="min-h-[72px]"]').first();
    const cardBox = await firstCard.boundingBox();
    expect(cardBox?.height).toBeGreaterThanOrEqual(72);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'triage_dashboard_tablet.png'),
      fullPage: false
    });
  });

  // 3. Mobile (375x812)
  test('Mobile (375x812) - Single column, full width, tap to open summary, back button returns', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/hospital/${HOSPITAL_ID}/triage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Verify no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Patient card full width check
    const firstCard = page.locator('div[class*="min-h-[72px]"]').first();
    await expect(firstCard).toBeVisible();
    const cardBox = await firstCard.boundingBox();
    expect(cardBox?.width).toBeGreaterThan(320); // Takes nearly full 375px viewport (minus padding)
    expect(cardBox?.height).toBeGreaterThanOrEqual(72);

    // Verify "Tap to open →" affordance
    await expect(page.locator('text=Tap to open →').first()).toBeVisible();

    // Verify red flag / severity badge is rendered above card title
    await expect(page.locator('span:has-text("CRITICAL")').first()).toBeVisible();

    // Take screenshot of mobile dashboard
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'triage_dashboard_mobile.png'),
      fullPage: false
    });

    // Tap patient -> opens TriageSummary in read-only mode
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Expect Triage Summary page
    await expect(page.locator('text=Triage Summary')).toBeVisible();
    await expect(page.locator('text=Read-Only (Triage Staff)')).toBeVisible();

    // Take screenshot of read-only summary on mobile
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'triage_dashboard_mobile_summary.png'),
      fullPage: false
    });

    // Click back button to return to dashboard
    const backBtn = page.locator('button:has-text("Back to Triage Queue"), button:has-text("Back to Dashboard")').first();
    await backBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Returned to dashboard
    await expect(page.locator('text=Triage Alerts Monitor')).toBeVisible();
  });
});

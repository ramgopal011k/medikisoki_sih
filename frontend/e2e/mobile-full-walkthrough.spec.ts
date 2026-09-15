import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROUTES = [
  '/',
  '/doctor/login',
  '/patient/login',
  '/admin/hospitals',
  '/hospital/demo/kiosk',
  '/consent',
  '/interview',
  '/medical-history',
  '/ayush-assessment',
  '/upload',
  '/preview',
  '/doctor/dashboard'
];

test.describe('Mobile Full Walkthrough', () => {
  test('Visits every route and tests all buttons on mobile', async ({ page }) => {
    const reportData = {
      viewport: '390x844',
      routes: [] as any[]
    };

    let consoleErrors: any[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push({
        text: err.message,
        location: 'pageerror'
      });
    });

    // Mock sessions to prevent redirects
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
      console.log(`Testing route: ${route}`);
      const routeReport = {
        path: route,
        screenshot: '',
        loadTimeMs: 0,
        buttons: [] as any[],
        consoleErrors: [] as any[],
        broken: false,
        status: 200,
        mobileChecks: {
          hasHorizontalScroll: false,
          bodyTextReadable: true,
          inputsCutOff: false
        }
      };

      consoleErrors = []; // Reset errors for this route
      
      const startTime = Date.now();
      let response;
      try {
        response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1500); // allow hydration
      } catch (_e) {
        routeReport.broken = true;
        routeReport.status = 0;
        routeReport.screenshot = `visual-tests/screenshots/failures/mobile-${route.replace(/[/\\]/g, '_')}-timeout.png`;
        await page.screenshot({ path: routeReport.screenshot, fullPage: true });
        reportData.routes.push(routeReport);
        continue;
      }
      
      routeReport.loadTimeMs = Date.now() - startTime;
      if (response && response.status() >= 400) {
        routeReport.broken = true;
        routeReport.status = response.status();
      }

      // Mobile Checks
      routeReport.mobileChecks.hasHorizontalScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
      routeReport.mobileChecks.bodyTextReadable = await page.evaluate(() => {
        const bodyFontSize = window.getComputedStyle(document.body).fontSize;
        return parseFloat(bodyFontSize) >= 14;
      });
      routeReport.mobileChecks.inputsCutOff = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        return inputs.some(el => {
          const rect = el.getBoundingClientRect();
          return rect.right > window.innerWidth || rect.left < 0;
        });
      });

      const screenshotName = `visual-tests/screenshots/mobile/${route === '/' ? 'landing' : route.replace(/[/\\]/g, '_')}.png`;
      await page.screenshot({ path: screenshotName, fullPage: true });
      routeReport.screenshot = screenshotName;

      // Find all visible buttons
      const buttonLocators = page.locator('button:visible, [role="button"]:visible, a:visible');
      const buttonCount = await buttonLocators.count();

      for (let i = 0; i < buttonCount; i++) {
        // Must re-navigate and wait to ensure DOM is fresh for each button
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        
        const btn = page.locator('button:visible, [role="button"]:visible, a:visible').nth(i);
        
        if (await btn.count() === 0) continue; // In case dynamic UI changed

        let btnText = 'Unknown';
        try {
          btnText = await btn.innerText();
        } catch(_e) {}
        
        if (!btnText || btnText.trim() === '') {
          btnText = await btn.getAttribute('aria-label') || 'Icon Button';
        }
        
        const isDisabled = await btn.isDisabled().catch(() => false);
        
        // Mobile touch target size check
        const boundingBox = await btn.boundingBox();
        const isTallEnough = boundingBox ? boundingBox.height >= 44 : false;
        
        const buttonReport = {
          text: btnText.trim().replace(/\n/g, ' '),
          disabled: isDisabled,
          clickWorked: false,
          screenshot: '',
          isTouchTargetSufficient: isTallEnough
        };

        if (!isDisabled) {
          const preClickErrors = consoleErrors.length;
          try {
            await btn.click({ timeout: 3000 });
            await page.waitForTimeout(1000); // wait to see effect
            buttonReport.clickWorked = true;
          } catch (_e) {
            buttonReport.clickWorked = false;
          }
          const postClickErrors = consoleErrors.length;
          
          if (postClickErrors > preClickErrors) {
            buttonReport.clickWorked = false; // Flag if it threw errors
          }

          const btnScreenshot = `visual-tests/screenshots/mobile/${route === '/' ? 'landing' : route.replace(/[/\\]/g, '_')}-btn-${i+1}.png`;
          await page.screenshot({ path: btnScreenshot });
          buttonReport.screenshot = btnScreenshot;
        }

        routeReport.buttons.push(buttonReport);
      }

      routeReport.consoleErrors = [...consoleErrors];
      reportData.routes.push(routeReport);
    }

    const reportsDir = path.join(process.cwd(), 'visual-tests', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(reportsDir, 'mobile-report.json'),
      JSON.stringify(reportData, null, 2)
    );
  });
});

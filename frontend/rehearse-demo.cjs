const { chromium } = require('playwright');

async function rehearseRun(runNum) {
  const start = Date.now();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173/consent');
    await page.waitForSelector('button:has-text("English")');
    await page.click('button:has-text("English")');
    
    if (await page.locator('text=Where are you today?').isVisible().catch(() => false)) {
      await page.click('button:has-text("City General Hospital")');
    }

    if (await page.locator('button:has-text("I have an ABHA"), button:has-text("ABHA")').isVisible().catch(() => false)) {
      await page.click('button:has-text("I have an ABHA"), button:has-text("ABHA")');
      await page.fill('input[type="text"]', '91123456789012');
      await page.click('button:has-text("Continue")');
      await page.waitForSelector('text=Mock OTP');
      const otpText = await page.locator('text=Mock OTP').first().textContent();
      const otpMatch = otpText.match(/\d{6}/);
      const otpCode = otpMatch ? otpMatch[0] : '123456';
      await page.fill('input[placeholder="123456"]', otpCode);
      await page.click('button:has-text("Verify")');
      if (await page.locator('text=Past Records Found').isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.click('button:has-text("Continue as New Visit"), button:has-text("Continue")');
      }
    }

    if (await page.locator('button:has-text("I understand and agree")').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.click('button:has-text("I understand and agree")');
    }

    await page.waitForSelector('button:has-text("Chest pain")');
    await page.click('button:has-text("Chest pain")');
    await page.click('button:has-text("Begin Clinical Interview"), button:has-text("Start")');
    await page.waitForTimeout(1000);

    const q1 = page.locator('button:has-text("Sharp, stabbing pain"), button:has-text("Crushing")').first();
    if (await q1.isVisible({ timeout: 2000 }).catch(() => false)) await q1.click();
    const severe = page.locator('button:has-text("7-10 Severe"), button:has-text("Severe")').first();
    if (await severe.isVisible({ timeout: 2000 }).catch(() => false)) await severe.click();

    await page.goto('http://localhost:5173/doctor/login');
    await page.waitForSelector('button:has-text("Login"), button:has-text("Sign In")');
    await page.click('button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForTimeout(1000);
  } catch (e) {
    console.warn(`Run ${runNum} notice:`, e.message);
  } finally {
    await context.close();
    await browser.close();
  }

  const durationMin = ((Date.now() - start) / 60000).toFixed(2);
  console.log(`Rehearsal ${runNum}: ${durationMin} minutes`);
  return parseFloat(durationMin);
}

async function main() {
  const r1 = await rehearseRun(1);
  const r2 = await rehearseRun(2);
  const r3 = await rehearseRun(3);
  const avg = ((r1 + r2 + r3) / 3).toFixed(2);
  console.log(`SUMMARY: Run 1: ${r1} min | Run 2: ${r2} min | Run 3: ${r3} min | Avg: ${avg} min`);
}

main();

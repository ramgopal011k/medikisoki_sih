const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  
  console.log('Navigating to http://localhost:5173/welcome ...');
  await page.goto('http://localhost:5173/welcome');
  await page.waitForTimeout(1500);
  
  console.log('Triggering match-voice API call...');
  await page.evaluate(async () => {
    await fetch('http://localhost:3001/match-voice', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer medikiosk-demo-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: 'I have a squeezing sensation in my heart area',
        options: [{ value: 'Chest pain', label: 'Chest pain' }, { value: 'Fever', label: 'Fever' }]
      })
    });
  });

  console.log('Waiting 2 seconds for SSE event to arrive...');
  await page.waitForTimeout(2000);

  const demoDir = path.join(__dirname, '../demo');
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  const screenshotPath = path.join(demoDir, 'monitor_test_screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
})();

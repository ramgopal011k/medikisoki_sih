const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserTest() {
  console.log("Launching visible Chrome...");
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  
  const rootDir = 'C:/game/pythoncoding/New folder/hackathon';
  if (!fs.existsSync(path.join(rootDir, 'test-docs/screens'))) {
    fs.mkdirSync(path.join(rootDir, 'test-docs/screens'), { recursive: true });
  }

  async function testUpload(page, docPath, screenshotName) {
    try {
      const fullDocPath = path.join(rootDir, docPath);
      console.log(`\nTesting upload: ${fullDocPath}`);
      await page.goto('http://localhost:5173');
      
      console.log("Selecting language...");
      await wait(1000);
      const enBtn = await page.$('text=English');
      if (enBtn) await enBtn.click();
      
      console.log("Consent...");
      await wait(1000);
      const acceptBtn = await page.$('text=I Accept');
      if (acceptBtn) await acceptBtn.click();
      
      console.log("New Patient...");
      await wait(1000);
      const newBtn = await page.$('text=New Patient');
      if (newBtn) await newBtn.click();
      
      console.log("Chief Complaint...");
      await wait(1000);
      const ccInput = await page.$('textarea');
      if (ccInput) {
        await ccInput.fill('chest pain');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) await submitBtn.click();
      } else {
        const skipCC = await page.$('text=Skip');
        if(skipCC) await skipCC.click();
      }
      
      console.log("Interview questions...");
      for(let i=0; i<2; i++) {
        await wait(1500);
        const options = await page.$$('button.choice-btn, button.bg-white');
        if (options.length > 0) {
           await options[0].click();
        } else {
           const nextBtn = await page.$('text=Next');
           if (nextBtn) await nextBtn.click();
        }
      }
      
      console.log("Skip History...");
      await wait(1000);
      let skipBtn = await page.$('text=Skip');
      if (skipBtn) await skipBtn.click();
      
      console.log("Skip AYUSH...");
      await wait(1000);
      skipBtn = await page.$('text=Skip');
      if (skipBtn) await skipBtn.click();
      
      console.log("Uploading file...");
      await wait(2000);
      
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(fullDocPath);
      } else {
        console.log("Could not find file input element.");
      }
      
      console.log("Waiting for OCR processing...");
      try {
        await page.waitForSelector('text=100%', { timeout: 30000 });
        console.log("Upload reached 100%");
      } catch (e) {
        console.log("Upload did not reach 100% within 30s");
      }
      
      await wait(3000);
      
      const screenPath = path.join(rootDir, `test-docs/screens/${screenshotName}`);
      await page.screenshot({ path: screenPath });
      console.log(`Screenshot saved: ${screenPath}`);
      
      const chips = await page.$$('text=High, text=Low, .bg-red-100, .bg-orange-100');
      console.log(`Detected L/H chips: ${chips.length > 0 ? 'Yes' : 'No'}`);
      
      console.log("Submitting...");
      const submitDoc = await page.$('text=Continue, text=Submit');
      if (submitDoc) await submitDoc.click();
      await wait(2000);
      
    } catch(err) {
      console.error(`Error during browser test for ${docPath}:`, err.message);
    }
  }

  const page = await context.newPage();
  
  await testUpload(page, 'test-docs/clean-text-lab-report.pdf', '01-clean-upload.png');
  await testUpload(page, 'test-docs/image-only-lab-report.pdf', '02-image-only-upload.png');
  await testUpload(page, 'test-docs/messy-multi-page-report.pdf', '03-messy-upload.png');
  
  await browser.close();
  console.log("Browser test complete.");
}

runBrowserTest().catch(console.error);

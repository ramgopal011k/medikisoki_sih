const { chromium } = require('playwright');
const fs = require('fs');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserTest() {
  console.log("Launching visible Chrome...");
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  
  if (!fs.existsSync('test-docs/screens')) {
    fs.mkdirSync('test-docs/screens', { recursive: true });
  }

  async function testUpload(page, docPath, screenshotName) {
    try {
      console.log(`\nTesting upload: ${docPath}`);
      // Go to upload screen (assuming simple flow for demo, might need clicking through)
      await page.goto('http://localhost:5173');
      
      // 1. Language
      console.log("Selecting language...");
      await wait(1000);
      const enBtn = await page.$('text=English');
      if (enBtn) await enBtn.click();
      
      // 2. Consent
      console.log("Consent...");
      await wait(1000);
      const acceptBtn = await page.$('text=I Accept');
      if (acceptBtn) await acceptBtn.click();
      
      // 3. New Patient
      console.log("New Patient...");
      await wait(1000);
      const newBtn = await page.$('text=New Patient');
      if (newBtn) await newBtn.click();
      
      // 4. Chief complaint
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
      
      // 5. 2 interview questions
      console.log("Interview questions...");
      for(let i=0; i<2; i++) {
        await wait(1500);
        const options = await page.$$('button.choice-btn, button.bg-white'); // Approximate selectors
        if (options.length > 0) {
           await options[0].click();
        } else {
           const nextBtn = await page.$('text=Next');
           if (nextBtn) await nextBtn.click();
        }
      }
      
      // 6. Skip history
      console.log("Skip History...");
      await wait(1000);
      let skipBtn = await page.$('text=Skip');
      if (skipBtn) await skipBtn.click();
      
      // 7. Skip AYUSH
      console.log("Skip AYUSH...");
      await wait(1000);
      skipBtn = await page.$('text=Skip');
      if (skipBtn) await skipBtn.click();
      
      // We should be at DocumentUploadFlow
      console.log("Uploading file...");
      await wait(2000);
      
      // Handle file input
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(docPath);
      } else {
        console.log("Could not find file input element.");
      }
      
      // Wait for OCR result (up to 30s)
      console.log("Waiting for OCR processing...");
      // Check for success or progress
      try {
        await page.waitForSelector('text=100%', { timeout: 30000 });
        console.log("Upload reached 100%");
      } catch (e) {
        console.log("Upload did not reach 100% within 30s");
      }
      
      await wait(3000); // Wait for extraction table to render
      
      // Take screenshot
      const screenPath = `test-docs/screens/${screenshotName}`;
      await page.screenshot({ path: screenPath });
      console.log(`Screenshot saved: ${screenPath}`);
      
      // Check for L/H chips
      const chips = await page.$$('text=High, text=Low, .bg-red-100, .bg-orange-100');
      console.log(`Detected L/H chips: ${chips.length > 0 ? 'Yes' : 'No'}`);
      
      // Skip rest and submit
      console.log("Submitting...");
      const submitDoc = await page.$('text=Continue, text=Submit');
      if (submitDoc) await submitDoc.click();
      await wait(2000);
      
    } catch(err) {
      console.error(`Error during browser test for ${docPath}:`, err.message);
    }
  }

  const page = await context.newPage();
  
  // Doc A
  await testUpload(page, 'test-docs/clean-text-lab-report.pdf', '01-clean-upload.png');
  
  // Doc B
  await testUpload(page, 'test-docs/image-only-lab-report.pdf', '02-image-only-upload.png');
  
  // Doc C
  await testUpload(page, 'test-docs/messy-multi-page-report.pdf', '03-messy-upload.png');
  
  await browser.close();
  console.log("Browser test complete.");
}

runBrowserTest().catch(console.error);

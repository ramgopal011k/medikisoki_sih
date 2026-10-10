const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'backend/node_modules/playwright'));

async function renderPdfPages() {
  const pdfBytes = fs.readFileSync('scratch/test_fixed.pdf');
  const pdfBase64 = pdfBytes.toString('base64');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      async function render(n) {
        const pdf = await pdfjsLib.getDocument({ data: atob("${pdfBase64}") }).promise;
        window.numPages = pdf.numPages;
        const p = await pdf.getPage(n);
        const viewport = p.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        document.body.innerHTML = '';
        document.body.appendChild(canvas);
        await p.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    </script>
  `, { waitUntil: 'networkidle' });

  await page.evaluate(() => render(1));
  const numPages = await page.evaluate(() => window.numPages);
  console.log('Total pages now:', numPages);
  for (let i = 1; i <= numPages; i++) {
    await page.evaluate((n) => render(n), i);
    await page.waitForTimeout(300);
    const canvas = await page.$('canvas');
    await canvas.screenshot({ path: `scratch/fixed_page_${i}.png` });
    console.log(`Saved scratch/fixed_page_${i}.png`);
  }
  await browser.close();
}
renderPdfPages().catch(console.error);

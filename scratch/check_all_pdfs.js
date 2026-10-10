const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'backend/node_modules/playwright'));

async function checkAll() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const files = ['TECHNICAL_REFERENCES', 'WORKFLOW', 'TOOLS_AND_TECHNOLOGIES', 'DATASETS', 'PROJECT_ANALYSIS_SUMMARY'];
  
  for (const f of files) {
    const pdfPath = `docs/${f}.pdf`;
    if (!fs.existsSync(pdfPath)) continue;
    const b64 = fs.readFileSync(pdfPath).toString('base64');
    await page.setContent(`
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        async function getInfo() {
          const pdf = await pdfjsLib.getDocument({ data: atob("${b64}") }).promise;
          const pages = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i);
            const tc = await p.getTextContent();
            pages.push({ page: i, len: tc.items.length, text: tc.items.map(x => x.str).join(' ').trim() });
          }
          return { numPages: pdf.numPages, pages };
        }
      </script>
    `, { waitUntil: 'networkidle' });
    const res = await page.evaluate(() => getInfo());
    console.log(`=== ${f} (total ${res.numPages} pages) ===`);
    res.pages.forEach(p => {
      if (p.len < 10) {
        console.log(`  Page ${p.page} LOOKS BLANK OR EMPTY: items=${p.len}, text="${p.text}"`);
      }
    });
  }
  await browser.close();
}
checkAll().catch(console.error);

const fs = require('fs');
require('dotenv').config();

async function test() {
  const { ocrDocument } = require('./src/orchestration/sarvamClient');
  console.log('SARVAM_API_KEY present?', !!process.env.SARVAM_API_KEY);
  const buf = fs.readFileSync('../lab_report_clean.pdf');
  console.log('Buffer length:', buf.length);
  const res = await ocrDocument(buf);
  console.log('Result from ocrDocument:', JSON.stringify(res, null, 2));
}

test().catch(console.error);

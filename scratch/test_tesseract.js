const fs = require('fs');
const Tesseract = require('tesseract.js');

async function main() {
  console.log('Reading PDF...');
  const buf = fs.readFileSync('lab_report_clean.pdf');
  console.log('PDF length:', buf.length, 'magic:', buf.slice(0, 4).toString());
  try {
    console.log('Running Tesseract on PDF buffer...');
    const res = await Tesseract.recognize(buf, 'eng');
    console.log('Recognize result:', res.data.text);
  } catch (e) {
    console.error('Caught error in Tesseract:', e);
  }
}

main().catch(err => console.error('Main error:', err));

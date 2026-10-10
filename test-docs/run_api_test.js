const fs = require('fs');

async function testDoc(name, filePath) {
  try {
    const fileBytes = fs.readFileSync(filePath);
    const base64Data = fileBytes.toString('base64');
    const body = { image: base64Data };

    console.log(`\n--- Testing ${name} ---`);
    console.log(`File: ${filePath} (${(fileBytes.length / 1024).toFixed(2)} KB)`);

    const response = await fetch('http://localhost:3001/api/ocr/extract', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer medikiosk-demo-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    console.log(`HTTP Status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`Error Response: ${await response.text()}`);
      return;
    }

    const data = await response.json();
    const rows = data.extractions || data.saved || [];
    console.log(`Extracted row count: ${rows.length}`);
    
    // Check flags
    let hCount = 0;
    let lCount = 0;
    rows.forEach(r => {
      const v = (r.field_value || '').toLowerCase();
      if (v.includes(' h ') || v.endsWith(' h')) hCount++;
      if (v.includes(' l ') || v.endsWith(' l')) lCount++;
      console.log(`  - ${r.field_name}: ${r.field_value}`);
    });
    
    console.log(`Found ${hCount} H flags and ${lCount} L flags`);
  } catch (err) {
    console.error(`Error testing ${name}:`, err);
  }
}

async function runAll() {
  await testDoc('Doc A (clean)', 'test-docs/clean-text-lab-report.pdf');
  await testDoc('Doc B (image-only)', 'test-docs/image-only-lab-report.pdf');
  await testDoc('Doc C (messy)', 'test-docs/messy-multi-page-report.pdf');
}

runAll();

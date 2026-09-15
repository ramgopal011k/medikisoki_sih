const { normalizeTranscript, extractOptionSubPhrases, smartMatchOption } = require('./src/lib/smartVoiceMatch.ts');

const options = [
  { value: 'acute', label: 'Acute (Less than 3 weeks)', label_hi: 'तीव्र (3 सप्ताह से कम)' },
  { value: 'subacute', label: 'Subacute (3 to 8 weeks)', label_hi: 'मध्यम (3 से 8 सप्ताह)' },
  { value: 'chronic', label: 'Chronic (More than 8 weeks / Long standing)', label_hi: 'दीर्घकालिक (8 सप्ताह से अधिक)' },
  { value: 'unknown', label: "I don't know / Not sure", label_hi: 'मुझे नहीं पता' }
];

const testCases = [
  { speech: '3 to 8 weeks', expected: 'subacute' },
  { speech: '3-8 weeks', expected: 'subacute' },
  { speech: 'subacute', expected: 'subacute' },
  { speech: 'My name is Ramesh and I am coughing for 3 to 8 weeks', expected: 'subacute' },
  { speech: 'Doctor sahab mujhe lagbhag 3 se 8 hafte se khansi hai', expected: 'subacute' },
  { speech: 'Less than 3 weeks', expected: 'acute' },
  { speech: 'acute', expected: 'acute' },
  { speech: 'I think it is acute less than 3 weeks', expected: 'acute' },
  { speech: 'It has been around 2 weeks', expected: 'acute' },
  { speech: 'More than 8 weeks', expected: 'chronic' },
  { speech: 'chronic', expected: 'chronic' },
  { speech: 'It is chronic more than 2 months', expected: 'chronic' },
  { speech: "I don't know", expected: 'unknown' },
  { speech: 'Not sure', expected: 'unknown' },
  { speech: 'Pata nahi', expected: 'unknown' },
  { speech: 'Mujhe nahi pata', expected: 'unknown' }
];

const severityOptions = [
  { value: 'mild', label: 'Mild (1-3 / Slight pain)', label_hi: 'हल्का (1-3)' },
  { value: 'moderate', label: 'Moderate (4-6 / Noticeable)', label_hi: 'मध्यम (4-6)' },
  { value: 'severe', label: 'Severe (7-10 / Intense or crushing)', label_hi: 'गंभीर (7-10)' }
];

const severityCases = [
  { speech: '7-10 Severe', expected: 'severe' },
  { speech: '8', expected: 'severe' },
  { speech: 'Severe crushing pain', expected: 'severe' },
  { speech: 'Bahut zyada dard hai', expected: 'severe' },
  { speech: 'My name is John and I have severe 8 out of 10 pain', expected: 'severe' },
  { speech: 'Moderate', expected: 'moderate' },
  { speech: '5', expected: 'moderate' },
  { speech: 'Medium beech ka dard', expected: 'moderate' },
  { speech: 'Mild thoda sa', expected: 'mild' },
  { speech: '2', expected: 'mild' }
];

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING SMART VOICE MATCHING UNIT TESTS');
  console.log('================================================================');

  let passed = 0;
  let total = testCases.length + severityCases.length;

  console.log('\n--- Duration & Timeline Test Cases ---');
  for (const tc of testCases) {
    const res = await smartMatchOption(tc.speech, options);
    const ok = res.matched && res.value === tc.expected;
    if (ok) {
      console.log(`✓ PASS: "${tc.speech}" -> ${res.value} (${res.reason})`);
      passed++;
    } else {
      console.error(`✗ FAIL: "${tc.speech}" -> expected ${tc.expected}, got ${res.value || 'NO MATCH'}`);
    }
  }

  console.log('\n--- Pain & Severity Scale Test Cases ---');
  for (const tc of severityCases) {
    const res = await smartMatchOption(tc.speech, severityOptions);
    const ok = res.matched && res.value === tc.expected;
    if (ok) {
      console.log(`✓ PASS: "${tc.speech}" -> ${res.value} (${res.reason})`);
      passed++;
    } else {
      console.error(`✗ FAIL: "${tc.speech}" -> expected ${tc.expected}, got ${res.value || 'NO MATCH'}`);
    }
  }

  console.log('\n================================================================');
  console.log(`RESULT: ${passed}/${total} tests passed`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(console.error);

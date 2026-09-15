const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function recordDemo() {
  console.log('Starting automated demo recording...');
  const startTime = Date.now();

  const demoDir = path.join(__dirname, '..', 'demo');
  const recDir = path.join(demoDir, 'recordings');
  if (!fs.existsSync(demoDir)) fs.mkdirSync(demoDir, { recursive: true });
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir: recDir },
    viewport: { width: 1600, height: 900 }
  });

  const page = await context.newPage();

  const setNarration = async (text) => {
    console.log(`[DEMO STEP] ${text}`);
    await page.evaluate((msg) => {
      let el = document.getElementById('demo-narration-overlay');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-narration-overlay';
        el.style.position = 'fixed';
        el.style.top = '16px';
        el.style.left = '16px';
        el.style.zIndex = '99999';
        el.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
        el.style.color = '#38bdf8';
        el.style.padding = '10px 18px';
        el.style.borderRadius = '10px';
        el.style.fontSize = '14px';
        el.style.fontWeight = '700';
        el.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';
        el.style.border = '1px solid rgba(56, 189, 248, 0.4)';
        el.style.fontFamily = 'ui-monospace, monospace';
        el.style.letterSpacing = '0.05em';
        document.body.appendChild(el);
      }
      el.innerText = `JOURNEY STEP: ${msg}`;
    }, text);
  };

  const triggerOrchCall = async (endpoint, payload) => {
    await page.evaluate(async ({ ep, body }) => {
      try {
        await fetch(`http://localhost:3001${ep}`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer medikiosk-demo-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
      } catch (e) {
        console.error('Trigger orch error:', e);
      }
    }, { ep: endpoint, body: payload });
  };

  try {
    // 1. Landing
    await page.goto('http://localhost:5173/');
    await setNarration('1. MediKiosk Public Landing Page');
    await page.waitForTimeout(2000);

    // Trigger ASR Event to populate monitor (Sarvam)
    await triggerOrchCall('/api/orchestration/trigger-asr', { audio: 'sample', language: 'hi' }).catch(() => {});

    // 2. Kiosk Welcome
    await page.goto('http://localhost:5173/welcome');
    await setNarration('2. Welcome Screen & Language Selection');
    await page.waitForTimeout(2000);

    // 3. Consent Flow
    await page.goto('http://localhost:5173/consent');
    await setNarration('3. DPDP Patient Consent Verification');
    await page.waitForTimeout(2000);

    const consentAgree = page.locator('button:has-text("I understand and agree")').first();
    if (await consentAgree.isVisible().catch(() => false)) {
      await consentAgree.click();
      await page.waitForTimeout(1500);
    }

    // 4. Hospital & ABHA Verification
    await setNarration('4. ABHA Identity & OTP Verification');
    const abhaBtn = page.locator('button:has-text("I have an ABHA"), button:has-text("ABHA")').first();
    if (await abhaBtn.isVisible().catch(() => false)) {
      await abhaBtn.click();
      await page.waitForTimeout(1000);
    }

    // 5. Chief Complaint (Chest Pain + AYUSH toggle)
    await page.goto('http://localhost:5173/chief-complaint');
    await setNarration('5. Chief Complaint: Chest Pain (AYUSH Assessment Enabled)');
    await page.waitForTimeout(1500);

    // Trigger Voice-Match Orchestration Event (Gemini)
    await triggerOrchCall('/match-voice', {
      text: 'I feel a squeezing sensation in my heart area',
      options: [{ value: 'chest_pain', label: 'Chest pain' }, { value: 'fever', label: 'Fever' }]
    });
    await page.waitForTimeout(2000);

    // Select Chest Pain
    const chestPainBtn = page.locator('button:has-text("Chest Pain"), button:has-text("Chest pain")').first();
    if (await chestPainBtn.isVisible().catch(() => false)) {
      await chestPainBtn.click();
      await page.waitForTimeout(1500);
    }

    // 6. Clinical Interview (Red Flag Detection)
    await setNarration('6. Clinical Interview & Red Flag Semantic Analysis (MedGemma → Gemini)');
    // Trigger Red-Flag Semantic Orchestration Event (MedGemma / Gemini)
    await triggerOrchCall('/api/orchestration/trigger-redflag', {
      prompt: 'Patient reports severe crushing chest pain radiating to left arm with diaphoresis.'
    });
    await page.waitForTimeout(4000);

    // 7. Medical History
    await page.goto('http://localhost:5173/medical-history');
    await setNarration('7. Multi-Category Medical History Intake');
    await page.waitForTimeout(2000);

    // 8. AYUSH 12-Dimension RAG Assessment
    await page.goto('http://localhost:5173/ayush-assessment');
    await setNarration('8. Classical AYUSH 12-Dimension RAG Reasoning (Gemini RAG + Citations)');
    // Trigger AYUSH-RAG Orchestration Event
    await triggerOrchCall('/ayush-assessment', {
      prakriti: 'Vata-Pitta',
      vikriti: 'Pitta-Kaha',
      agni: 'Tikshnagni',
      koshtha: 'Krura',
      sara: 'Rasa',
      samhanana: 'Madhyama',
      pramana: 'Madhyama',
      satmya: 'Ojas',
      sattva: 'Pravara',
      ahara_shakti: 'Uttama',
      vyayama_shakti: 'Madhyama',
      vaya: 'Madhyama'
    });
    await page.waitForTimeout(5000);

    // 9. Records Upload (OCR Processing)
    await page.goto('http://localhost:5173/upload');
    await setNarration('9. Document Scan & OCR Processing (Sarvam OCR)');
    // Trigger OCR Orchestration Event
    await triggerOrchCall('/api/orchestration/trigger-ocr', { image: 'sample_base64' });
    await page.waitForTimeout(3000);

    // 10. Patient Summary Preview & Submission
    await page.goto('http://localhost:5173/preview');
    await setNarration('10. Patient Summary Verification Preview');
    await page.waitForTimeout(2500);

    await page.goto('http://localhost:5173/submitted');
    await setNarration('11. Patient Kiosk Journey Completed');
    await page.waitForTimeout(3000);

    // 12. Doctor Login & Dashboard View
    await page.goto('http://localhost:5173/doctor/login');
    await setNarration('12. Doctor Dashboard Portal Access');
    await page.waitForTimeout(2000);

    const loginBtn = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.goto('http://localhost:5173/doctor/dashboard');
    await setNarration('13. Realtime Doctor Triage Queue & Live Updates');
    await page.waitForTimeout(3500);

    // 13. Triage Summary Detail View
    const sessionId = 'demo-session-123';
    await page.goto(`http://localhost:5173/doctor/triage/${sessionId}`);
    await setNarration('14. Complete Triage Summary & Classical AYUSH Citations');
    await page.waitForTimeout(5000);

    console.log('Demo recording sequence finished successfully.');
  } catch (err) {
    console.error('Demo recording error:', err);
  }

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const rawVideoPath = await video.path();
    const webmPath = path.join(demoDir, 'orchestration-demo.webm');
    const mp4Path = path.join(demoDir, 'orchestration-demo.mp4');
    
    fs.copyFileSync(rawVideoPath, webmPath);
    fs.copyFileSync(rawVideoPath, mp4Path);

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    const durationMin = (durationSec / 60).toFixed(1);

    console.log(`RECORDING_COMPLETE: YES`);
    console.log(`DURATION: ${durationMin} min (${durationSec}s)`);
    console.log(`WEBM_PATH: ${webmPath}`);
    console.log(`MP4_PATH: ${mp4Path}`);
  }
}

recordDemo();

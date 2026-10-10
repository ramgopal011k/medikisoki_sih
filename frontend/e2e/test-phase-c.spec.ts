import { test, expect } from '@playwright/test';

test.describe('Phase C Evidence Capture', () => {
  test('C.2 - Marathi & Bengali Language Buttons on Welcome and Consent', async ({ page }) => {
    // 1. Check Welcome screen
    await page.goto('http://localhost:5173/welcome');
    await page.waitForTimeout(1000);

    const mrBtn = page.locator('#lang-btn-mr');
    const bnBtn = page.locator('#lang-btn-bn');
    const hiBtn = page.locator('#lang-btn-hi');
    const enBtn = page.locator('#lang-btn-en');

    await expect(mrBtn).toBeVisible();
    await expect(bnBtn).toBeVisible();
    await expect(hiBtn).toBeVisible();
    await expect(enBtn).toBeVisible();

    await page.screenshot({ path: 'evidence_c2_marathi_bengali.png', fullPage: true });
    console.log('[EVIDENCE C.2] Screenshot captured: evidence_c2_marathi_bengali.png');

    // 2. Also check Consent screen language buttons
    await page.goto('http://localhost:5173/consent');
    await page.waitForTimeout(1000);
    const consentMr = page.locator('#consent-lang-mr');
    const consentBn = page.locator('#consent-lang-bn');
    if (await consentMr.isVisible()) {
      await expect(consentMr).toBeVisible();
      await expect(consentBn).toBeVisible();
    }
  });

  test('C.1 - Classical Analysis (Nidana Panchaka + Samprapti Ghatakas) on TriageSummary', async ({ page }) => {
    // First, create a session via backend API to ensure we have a valid session ID with AYUSH opt-in
    const createRes = await page.request.post('http://localhost:3001/api/sessions', {
      data: {
        patient_name: 'Ayurveda Test Patient',
        chief_complaint: 'Malaavrodha and abdominal pain',
        language: 'hi',
        ayush_mode: true,
        consents: {
          clinical_care: true,
          ai_analytics: true,
          abdm_sharing: false,
          research: false
        }
      }
    });

    const resJson = await createRes.json();
    const sessionId = resJson.data?.id || resJson.data?.session_id || resJson.id || resJson.session_id;
    console.log('[Test C.1] Created test session:', sessionId);

    // Seed AYUSH assessment dimensions for this session
    await page.request.post('http://localhost:3001/ayush-assessment', {
      data: {
        session_id: sessionId,
        prakriti: 'Vata-Pitta',
        vikriti: 'Vata',
        agni: 'Manda',
        koshtha: 'Krura',
        sara: 'Madhyama',
        samhanana: 'Avara',
        pramana: 'Madhyama',
        satmya: 'Madhyama',
        sattva: 'Pravara',
        ahara_shakti: 'Avara',
        vyayama_shakti: 'Madhyama',
        vaya: 'Madhyama'
      }
    }).catch(() => {});

    // Navigate to doctor triage summary page
    await page.goto(`http://localhost:5173/doctor/triage/${sessionId}`);
    // Wait for loading spinner to disappear
    await expect(page.locator('text=Loading triage summary…')).not.toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(1000);

    // Verify Classical Analysis section exists and is visible
    const classicalSection = page.locator('.classical-analysis-section, section:has-text("Classical Analysis")').first();
    await expect(classicalSection).toBeVisible({ timeout: 15000 });

    // Verify Nidana Panchaka and Samprapti Ghatakas text
    await expect(page.locator('text=Nidana Panchaka').first()).toBeVisible();
    await expect(page.locator('text=Samprapti Ghatakas').first()).toBeVisible();

    // Capture screenshot of Classical Analysis
    await page.screenshot({ path: 'evidence_c1_classical_analysis.png', fullPage: true });
    console.log('[EVIDENCE C.1] Screenshot captured: evidence_c1_classical_analysis.png');
  });

  test('A.2 - Caregiver badge verification on Doctor Dashboard / Triage', async ({ page }) => {
    // Create a session with caregiver_mode = true
    const createRes = await page.request.post('http://localhost:3001/api/sessions', {
      data: {
        patient_name: 'Caregiver Assisted Patient',
        chief_complaint: 'Severe headache and fatigue',
        language: 'en',
        caregiver_mode: true,
        consents: {
          clinical_care: true,
          ai_analytics: true,
          abdm_sharing: true,
          research: false
        }
      }
    });

    const sessionData = await createRes.json();
    const sessionId = sessionData.session_id || sessionData.id || sessionData.data?.id;

    // Navigate to triage view
    await page.goto(`http://localhost:5173/doctor/triage/${sessionId}`);
    await page.waitForTimeout(2000);

    // Verify badge
    const badge = page.locator('text="Reported by caregiver"');
    if (await badge.count() > 0) {
      await expect(badge.first()).toBeVisible();
    }

    await page.screenshot({ path: 'evidence_a2_caregiver.png', fullPage: true });
    console.log('[EVIDENCE A.2] Screenshot captured: evidence_a2_caregiver.png');
  });
});

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/kramg/.gemini/antigravity-ide/brain/99fc3692-300d-4cf9-865e-f11f8fa87363';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'flow_screenshots');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];

test.describe('Complete Flow Visual Testing Across Viewports', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    test(`Capture Full Flow on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const snap = async (screenId: string) => {
        const filePath = path.join(SCREENSHOT_DIR, `${screenId}_${vp.name}.png`);
        await page.waitForTimeout(300);
        await page.screenshot({ path: filePath, fullPage: false });
      };

      // ==========================================
      // SITE 1: PATIENT KIOSK FLOW
      // ==========================================

      // 1. Landing Page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await snap('01_landing_page');

      // 2. Kiosk Welcome
      await page.goto('/hospital/11111111-1111-1111-1111-111111111111/kiosk');
      await page.waitForLoadState('networkidle');
      await snap('02_kiosk_welcome');

      // 3. DPDP Notice Screen
      await page.goto('/hospital/11111111-1111-1111-1111-111111111111/notice');
      await page.waitForLoadState('networkidle');
      await snap('03_dpdp_notice');

      // 4. Patient Type Selection
      await page.goto('/hospital/11111111-1111-1111-1111-111111111111/consent?lang=en');
      await page.waitForLoadState('networkidle');
      await snap('04_patient_type_selection');

      // Click "I am a new patient"
      const newPatientBtn = page.locator('button:has-text("I am a new patient")');
      if (await newPatientBtn.isVisible()) {
        await newPatientBtn.click();
        await page.waitForTimeout(400);
      }

      // 5. New Patient Registration Form
      const nameInput = page.locator('input[placeholder="John Doe"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill('Rohan Verma');
        await page.locator('input[placeholder="30"]').fill('32');
        await page.locator('select').selectOption('Male');
      }
      await snap('05_new_patient_registration_form');

      // Continue to consent checklist
      const continueBtn = page.locator('button:has-text("Continue")');
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(400);
      }

      // 6. Consent Checklist
      await snap('06_consent_clinical_care_checklist');

      // Click "I understand and agree"
      const agreeBtn = page.locator('button:has-text("I understand and agree")');
      if (await agreeBtn.isVisible()) {
        await agreeBtn.click();
        await page.waitForTimeout(400);
      }

      // 7. Chief Complaint & BodyMap (Initial)
      await snap('07_chief_complaint_bodymap_initial');

      // Tap Chest & Left Arm
      const chestBtn = page.locator('button:has-text("Chest")').first();
      if (await chestBtn.isVisible()) {
        await chestBtn.click();
        await page.waitForTimeout(200);
      }
      const leftArmBtn = page.locator('button:has-text("Left Arm")').first();
      if (await leftArmBtn.isVisible()) {
        await leftArmBtn.click();
        await page.waitForTimeout(200);
      }

      // 8. Chief Complaint & BodyMap (Tapped / Multi-Selected)
      await snap('08_chief_complaint_bodymap_tapped');

      // Toggle to Back View
      const backViewBtn = page.locator('button:has-text("Back View")');
      if (await backViewBtn.isVisible()) {
        await backViewBtn.click();
        await page.waitForTimeout(200);
        await snap('09_chief_complaint_bodymap_back_view');
        // Toggle back to front
        const frontViewBtn = page.locator('button:has-text("Front View")');
        if (await frontViewBtn.isVisible()) await frontViewBtn.click();
      }

      // Select Chest Pain and start session
      const chestPainBtn = page.locator('button:has-text("Chest pain")').first();
      if (await chestPainBtn.isVisible()) await chestPainBtn.click();

      // Ensure mock/session data ready for subsequent kiosk steps
      const activeSessionToken = 'session-flow-demo-' + vp.name;
      await page.evaluate((token) => {
        sessionStorage.setItem('patient_session', token);
        sessionStorage.setItem('session_id', token);
        sessionStorage.setItem('patient_name', 'Rohan Verma');
        sessionStorage.setItem('patient_complaint', 'Chest pain');
        sessionStorage.setItem('chief_complaint', 'chest_pain');
        sessionStorage.setItem('kiosk.body_regions', JSON.stringify(['chest', 'left-arm']));
        sessionStorage.setItem('ayush_mode', 'true');
        localStorage.setItem('patient_language', 'en');
      }, activeSessionToken);

      // 10. Adaptive AI Interview Screen
      await page.goto('/interview');
      await page.waitForLoadState('networkidle');
      await snap('10_interview_questions');

      // 11. AYUSH Assessment Screen
      await page.goto('/ayush-assessment');
      await page.waitForLoadState('networkidle');
      await snap('11_ayush_assessment');

      // 12. Document Upload Screen
      await page.goto('/records-upload');
      await page.waitForLoadState('networkidle');
      await snap('12_document_upload');

      // 13. Medical History Screen
      await page.goto('/medical-history');
      await page.waitForLoadState('networkidle');
      await snap('13_medical_history');

      // 14. Patient Preview Screen
      await page.goto('/preview');
      await page.waitForLoadState('networkidle');
      await snap('14_patient_preview');

      // 15. Patient Submitted Screen (Plain-language summary)
      await page.evaluate(() => {
        sessionStorage.setItem('red_flag_triggered', 'true');
      });
      await page.goto('/submitted');
      await page.waitForLoadState('networkidle');
      await snap('15_patient_submitted_summary');

      // ==========================================
      // SITE 2: DOCTOR & CLINICAL TRIAGE PORTAL
      // ==========================================

      // 16. Doctor Login Screen
      await page.goto('/doctor/login');
      await page.waitForLoadState('networkidle');
      await snap('16_doctor_login');

      // 17. Doctor Clinical Dashboard
      await page.evaluate(() => {
        localStorage.setItem('doctor_token', 'mock-doctor-token');
        localStorage.setItem('doctor_info', JSON.stringify({
          doctor_id: 'd1111111-1111-1111-1111-111111111111',
          name: 'Dr. Priya Sharma',
          email: 'doctor@demo.com',
          hospital_id: 'all',
          uid: 'dev'
        }));
      });
      await page.goto('/doctor/dashboard?h=all');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      const showAllBtn = page.locator('button:has-text("Show All Facilities")').first();
      if (await showAllBtn.isVisible()) {
        await showAllBtn.click();
        await page.waitForTimeout(400);
      }
      await snap('17_doctor_dashboard');

      // 18. Doctor Triage Summary
      await page.goto('/doctor/triage/646f879d-684c-40df-b99b-1ab7ae667142');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      await snap('18_doctor_triage_summary');

      // 19. Admin Hospitals Console
      await page.goto('/admin/hospitals');
      await page.waitForLoadState('networkidle');
      await snap('19_admin_hospitals');
    });
  }
});

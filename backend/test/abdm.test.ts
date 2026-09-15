import { ABDMService } from '../src/services/abdm';
import request from 'supertest';
import app from '../src/index';

describe('ABDM V3 Service & Gateway Integration', () => {
  let abdmService: ABDMService;

  beforeEach(() => {
    abdmService = new ABDMService();
  });

  describe('M1: Aadhaar OTP & ABHA Generation', () => {
    it('generates Aadhaar OTP for a valid 12-digit number', async () => {
      const res = await abdmService.generateAadhaarOtp({
        aadhaarNumber: '123456789012'
      });
      expect(res.txnId).toBeDefined();
      expect(res.txnId).toMatch(/^txn-/);
      expect(res.message).toContain('9012');
      expect(res.mode).toBe('SIMULATED_SANDBOX');
    });

    it('rejects invalid Aadhaar number length', async () => {
      await expect(
        abdmService.generateAadhaarOtp({ aadhaarNumber: '12345' })
      ).rejects.toThrow('Aadhaar number must be exactly 12 digits');
    });

    it('verifies Aadhaar OTP and returns standardized ABHA profile', async () => {
      const otpRes = await abdmService.generateAadhaarOtp({
        aadhaarNumber: '999988887777'
      });

      const verifyRes = await abdmService.verifyAadhaarOtp({
        txnId: otpRes.txnId,
        otp: '123456',
        mobile: '9876543210'
      });

      expect(verifyRes.txnId).toBe(otpRes.txnId);
      expect(verifyRes.token).toBeDefined();
      expect(verifyRes.abhaNumber).toMatch(/^91-\d{4}-\d{4}-\d{4}/);
      expect(verifyRes.abhaAddress).toContain('@abdm');
      expect(verifyRes.profile.name).toBeDefined();
      expect(verifyRes.profile.mobile).toBe('9876543210');
    });

    it('throws error when verifying with empty OTP or txnId', async () => {
      await expect(
        abdmService.verifyAadhaarOtp({ txnId: '', otp: '' })
      ).rejects.toThrow('Missing txnId or OTP');
    });
  });

  describe('M2: Care Context Linking', () => {
    it('links Care Context and returns reference number', async () => {
      const res = await abdmService.linkCareContext({
        sessionId: 'test-session-123',
        abhaAddress: 'patient.123@abdm',
        patientName: 'Test Patient',
        chiefComplaint: 'Chest Pain'
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.referenceNumber).toMatch(/^REF-ABDM-/);
      expect(res.careContextReference).toBe('CC-TEST-SES');
      expect(res.message).toContain('patient.123@abdm');
    });
  });

  describe('M3: Consent Request Initiation', () => {
    it('creates consent request for health information exchange', async () => {
      const res = await abdmService.requestConsent({
        abhaAddress: 'patient.test@abdm',
        purpose: 'Care Management',
        dateRange: {
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-09-14T00:00:00.000Z'
        },
        hiTypes: ['Prescription', 'OPConsultation']
      });

      expect(res.status).toBe('REQUESTED');
      expect(res.consentRequestId).toMatch(/^REQ-CONSENT-/);
      expect(res.message).toContain('patient.test@abdm');
    });
  });

  describe('REST Endpoints (/api/abdm)', () => {
    it('GET /api/abdm/status returns gateway info', async () => {
      const res = await request(app).get('/api/abdm/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toContain('ABDM');
      expect(res.body.supportedMilestones).toHaveLength(3);
    });

    it('POST /api/abdm/aadhaar-otp/generate generates OTP via HTTP', async () => {
      const res = await request(app)
        .post('/api/abdm/aadhaar-otp/generate')
        .send({ aadhaarNumber: '123456789012' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.txnId).toBeDefined();
    });

    it('POST /api/abdm/aadhaar-otp/verify verifies OTP via HTTP', async () => {
      const genRes = await request(app)
        .post('/api/abdm/aadhaar-otp/generate')
        .send({ aadhaarNumber: '123456789012' });

      const res = await request(app)
        .post('/api/abdm/aadhaar-otp/verify')
        .send({
          txnId: genRes.body.data.txnId,
          otp: '123456',
          mobile: '9876543210'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.abhaNumber).toBeDefined();
    });
  });
});

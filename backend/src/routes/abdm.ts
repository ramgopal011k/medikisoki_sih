import { Router, Request, Response } from 'express';
import { abdmService } from '../services/abdm';
import { z } from 'zod';

const router = Router();

const generateOtpSchema = z.object({
  aadhaarNumber: z.string().min(12).max(14)
});

const verifyOtpSchema = z.object({
  txnId: z.string().min(1),
  otp: z.string().min(4).max(6),
  mobile: z.string().optional()
});

const linkCareContextSchema = z.object({
  sessionId: z.string().min(1),
  abhaAddress: z.string().min(1),
  patientName: z.string().optional().default(''),
  chiefComplaint: z.string().optional().default('')
});

const consentRequestSchema = z.object({
  abhaAddress: z.string().min(1),
  purpose: z.string().optional().default('Clinical Consultation'),
  dateRange: z.object({
    from: z.string(),
    to: z.string()
  }).optional().default({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString()
  }),
  hiTypes: z.array(z.string()).optional().default(['DiagnosticReport', 'OPConsultation', 'Prescription'])
});

// GET /api/abdm/status - Check ABDM Gateway integration status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'ABDM V3 Client Gateway',
    liveSandboxConfigured: abdmService.isLiveConfigured(),
    supportedMilestones: ['M1 (ABHA Enrollment & Auth)', 'M2 (HIP Care Context Linking & FHIR)', 'M3 (HIU Consent & Health Data Exchange)'],
    environment: abdmService.isLiveConfigured() ? 'LIVE_SANDBOX' : 'SIMULATED_SANDBOX_FALLBACK'
  });
});

// POST /api/abdm/aadhaar-otp/generate (M1)
router.post('/aadhaar-otp/generate', async (req: Request, res: Response) => {
  try {
    const validated = generateOtpSchema.parse(req.body);
    const result = await abdmService.generateAadhaarOtp(validated);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to generate Aadhaar OTP' });
  }
});

// POST /api/abdm/aadhaar-otp/verify (M1)
router.post('/aadhaar-otp/verify', async (req: Request, res: Response) => {
  try {
    const validated = verifyOtpSchema.parse(req.body);
    const result = await abdmService.verifyAadhaarOtp(validated);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to verify Aadhaar OTP' });
  }
});

// POST /api/abdm/care-context/link (M2)
router.post('/care-context/link', async (req: Request, res: Response) => {
  try {
    const validated = linkCareContextSchema.parse(req.body);
    const result = await abdmService.linkCareContext(validated);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to link Care Context' });
  }
});

// POST /api/abdm/consent/request (M3)
router.post('/consent/request', async (req: Request, res: Response) => {
  try {
    const validated = consentRequestSchema.parse(req.body);
    const result = await abdmService.requestConsent(validated);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to initiate consent request' });
  }
});

export default router;

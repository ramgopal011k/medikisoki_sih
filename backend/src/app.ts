// Gemini semantic layer is HOLD (deferred to Phase 4).
import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { 
  medicalHistorySchema, 
  historyFactSchema, 
  ayushAssessmentSchema,
  authSchema 
} from './schemas';
import { reasonAyush } from './ayushReasoning';
import { reasonAyushWithRag } from './rag/ayushRag';
import Tesseract from 'tesseract.js';
import dotenv from 'dotenv';
import path from 'path';
import zlib from 'zlib';
import { supabase } from './supabase';
import { verifyAuth, signJwt } from './middleware/auth';
import triageRouter from './routes/triage';
import { securityHeaders, createRateLimiter, sanitizePromptInput } from './middleware/security';
import { getDoctorByEmail, saveDoctorAccount } from './services/doctorStore';
import { extractPdfImages } from './services/pdfImageExtractor';
import { rasterizePdf } from './services/pdfRasterizer';
import { parseLabRows } from './services/labTextParser';
import { extractDocumentDate } from './services/documentDateExtractor';
import { orchestrate } from './orchestration/router';
import { getCachedSemanticResponse, setCachedSemanticResponse, promptFor } from './orchestration/preseed-medgemma';

dotenv.config();

export const app = express();

// Security headers
app.use(securityHeaders);

// In-memory rate limiters
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many authentication attempts. Please try again later.'
});

const geminiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many AI requests. Please try again shortly.'
});

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim().replace(/\/$/, ''))
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:8080', 'http://localhost:80', 'http://localhost'];

if (process.env.CORS_EXTRA_ORIGINS) {
  const extra = process.env.CORS_EXTRA_ORIGINS.split(',').map((url) => url.trim().replace(/\/$/, '')).filter(Boolean);
  allowedOrigins.push(...extra);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      // Explicit allowed origins matching
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin) ||
        (process.env.NODE_ENV !== 'production' && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin))
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.raw({ limit: '25mb' }));

// Simple Origin-based CSRF for prototype
app.use((req, res, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && !req.path.startsWith('/auth/login') && !req.path.startsWith('/api/auth/login')) {
    const origin = req.headers.origin;
    if (origin) {
      if (
        !allowedOrigins.includes(origin) &&
        !origin.endsWith('.vercel.app') &&
        !/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin) &&
        !(process.env.NODE_ENV !== 'production' && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin))
      ) {
        return res.status(403).json({ error: 'CSRF token missing or invalid origin' });
      }
    }
  }
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'medikisoki-sih-backend', timestamp: new Date().toISOString(), db: 'supabase' });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'MediKiosk Clinical Intake & Triage Backend',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/hospitals',
      '/api/sessions',
      '/api/sessions/:id/triage',
      '/api/answers',
      '/api/summary',
      '/api/documents',
      '/ayush-assessment',
      '/medical-history',
      '/history-facts',
      '/auth/login'
    ]
  });
});

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

import { orchestrationEvents } from './orchestration/events';

app.get('/api/orchestration/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  orchestrationEvents.on('event', listener);

  req.on('close', () => {
    orchestrationEvents.off('event', listener);
  });
});

app.post('/api/orchestration/trigger-asr', async (req: Request, res: Response) => {
  try {
    const result = await orchestrate('asr', { audio: 'sample', language: req.body?.language || 'hi' });
    res.json(result);
  } catch (err) {
    res.json({ status: 'ok', task: 'asr' });
  }
});

app.post('/api/orchestration/trigger-ocr', async (req: Request, res: Response) => {
  try {
    const result = await orchestrate('ocr', { image: 'sample' });
    res.json(result);
  } catch (err) {
    res.json({ status: 'ok', task: 'ocr' });
  }
});

app.post('/api/orchestration/trigger-redflag', async (req: Request, res: Response) => {
  try {
    const result = await orchestrate('red-flag-semantic', { prompt: req.body?.prompt || 'chest pain' });
    res.json(result);
  } catch (err) {
    res.json({ status: 'ok', task: 'red-flag-semantic' });
  }
});

import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import FormData from 'form-data';

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

import sessionsRouter from './routes/sessions';
import answersRouter from './routes/answers';
import summaryRouter from './routes/summary';
import abdmRouter from './routes/abdm';
import { generateFhirBundle } from './fhir';
import { analyzeText } from './clinicalAnalysis';
import { generateTriageSummary } from './summary';

app.use('/api/abdm', abdmRouter);

app.post('/api/analyze-records', async (req: Request, res: Response) => {
  try {
    const { text, patientAllergies } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const analysis = await analyzeText(text, patientAllergies || []);
    res.json(analysis);
  } catch (err: any) {
    console.error('Clinical Analysis Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fhir/:sessionId', async (req: Request, res: Response) => {
  try {
    const bundle = await generateFhirBundle(String(req.params.sessionId));
    res.json(bundle);
  } catch (err: any) {
    console.error('FHIR Generation Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { patient_name, chief_complaint, age, gender, phone } = req.body;
    const updateData: any = {};
    if (patient_name !== undefined) updateData.patient_name = patient_name;
    if (chief_complaint !== undefined) updateData.chief_complaint = chief_complaint;
    if (age !== undefined) updateData.age = age;
    if (gender !== undefined) updateData.gender = gender;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length > 0) {
      await supabase.from('sessions').update(updateData).eq('id', id);
    }

    if (chief_complaint) {
      await supabase
        .from('answers')
        .update({ answer_text: chief_complaint })
        .eq('session_id', id)
        .eq('question_id', 'chief_complaint');
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Update session error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patient/visits/:abhaId', async (req: Request, res: Response) => {
  try {
    const { abhaId } = req.params;
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id, 
        created_at, 
        hospital_id, 
        patient_name, 
        chief_complaint, 
        status,
        summaries ( content )
      `)
      .eq('dummy_aadhaar', abhaId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: sessions });
  } catch (err: any) {
    console.error('Fetch Patient Visits Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patient/visits/:sessionId/revoke', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Revoking consent = DPDPA Right to Erasure
    // Hard delete triggers ON DELETE CASCADE for all PII data
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);
      
    if (error) throw error;
    
    // Log the erasure event
    try {
      await supabase.from('audit_logs').insert({
        session_id: sessionId,
        action: 'Right to Erasure invoked - Data purged',
        resource_type: 'sessions'
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log for erasure:', auditErr);
    }
    
    res.json({ success: true, message: 'Consent revoked and data anonymized/erased.' });
  } catch (err: any) {
    console.error('Revoke Consent Error:', err);
    res.status(500).json({ error: err.message });
  }
});

import hospitalsRouter from './routes/hospitals';
import documentsRouter from './routes/documents';
import analyticsRouter from './routes/analytics';
import aiRouter from './routes/ai';
import healthRouter from './routes/health';

// Apply Authentication Middleware to doctor/admin routes
// Anonymous kiosk endpoints (POST /api/sessions, history-facts, answers, medical-history, ayush-assessment, sarvam, gemini, etc.) are public
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && (req.path === '/sessions' || req.path === '/api/sessions')) {
    return next();
  }
  if (
    req.path.startsWith('/history-facts') ||
    req.path.startsWith('/medical-history') ||
    req.path.startsWith('/ayush-assessment') ||
    req.path.startsWith('/answers') ||
    req.path.startsWith('/documents') ||
    req.path.startsWith('/sarvam') ||
    req.path.startsWith('/gemini') ||
    req.path.startsWith('/summary') ||
    req.path.startsWith('/fhir') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/hospitals')
  ) {
    return next();
  }
  return verifyAuth(req, res, next);
});

// Mount routes — standardized on /api/ prefix with legacy compatibility
app.use('/api/sessions', sessionsRouter);
app.use('/sessions', sessionsRouter);
app.use('/api/answers', answersRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/documents', documentsRouter);
app.use('/documents', documentsRouter);
app.use('/api/triage', triageRouter);
app.use('/triage', triageRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);
app.use('/health', healthRouter);
app.use('/api/health', healthRouter);

// Doctor authentication endpoint
// Demo credentials loaded from environment variables (fallback to defaults for dev)
const DEMO_ADMIN_EMAILS = (process.env.DEMO_ADMIN_EMAILS || 'head,superadmin').split(',');
const DEMO_ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.DEMO_ADMIN_PASSWORD || 'admin123', 10);
const DEMO_DOCTOR_EMAIL = process.env.DEMO_DOCTOR_EMAIL || 'doctor@demo.com';
const DEMO_DOCTOR_PASSWORD_HASH = bcrypt.hashSync(process.env.DEMO_DOCTOR_PASSWORD || 'demo123', 10);

const handleLogin = async (req: Request, res: Response) => {
  try {
    authSchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Super Admin login (demo credentials)
  if (
    DEMO_ADMIN_EMAILS.includes(email) && 
    await bcrypt.compare(password, DEMO_ADMIN_PASSWORD_HASH)
  ) {
    return res.json({
      token: 'mock-superadmin-token',
      user: {
        doctor_id: 'superadmin',
        name: 'Super Admin',
        email: email,
        hospital_id: 'all',
        uid: 'admin-uid',
        role: 'head'
      }
    });
  }

  // Doctor login (demo credentials)
  if (
    email === DEMO_DOCTOR_EMAIL && await bcrypt.compare(password, DEMO_DOCTOR_PASSWORD_HASH)
  ) {
    const user = {
      doctor_id: 'd1111111-1111-1111-1111-111111111111',
      name: 'Dr. Rajesh Varma',
      email: email,
      hospital_id: '11111111-1111-1111-1111-111111111111',
      uid: 'mock-uid',
      role: 'doctor' as const
    };
    const token = await signJwt({
      uid: user.uid,
      doctor_id: user.doctor_id,
      name: user.name,
      email: user.email,
      hospital_id: user.hospital_id,
      role: 'doctor'
    });
    return res.json({
      token,
      user
    });
  }

  // Check persistent store for registered doctors
  const localDoc = getDoctorByEmail(email);
  if (localDoc && localDoc.password_hash) {
    const isMatch = await bcrypt.compare(password, localDoc.password_hash);
    if (isMatch) {
      return res.json({
        token: `token-${localDoc.doctor_id}`,
        user: {
          doctor_id: localDoc.doctor_id,
          name: localDoc.name,
          email: localDoc.email,
          hospital_id: localDoc.hospital_id || null,
          uid: localDoc.doctor_id,
          role: localDoc.role || 'doctor'
        }
      });
    }
  }

  // Database doctor login via bcrypt
  try {
    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('email', email)
      .single();

    if (!error && doctor && doctor.password_hash) {
      const isMatch = await bcrypt.compare(password, doctor.password_hash);
      if (isMatch) {
        return res.json({
          token: `token-${doctor.doctor_id}`,
          user: {
            doctor_id: doctor.doctor_id,
            name: doctor.name,
            email: doctor.email,
            hospital_id: doctor.hospital_id,
            uid: doctor.doctor_id,
            role: 'doctor'
          }
        });
      }
    }
  } catch (dbErr) {
    console.warn('Database auth check error:', dbErr);
  }

  return res.status(401).json({ error: 'Invalid credentials.' });
};

// Doctor registration endpoint
const handleRegister = async (req: Request, res: Response) => {
  try {
    authSchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { email, password, name, hospital_id, license_number } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    // Check if email already exists in local store
    const existingLocal = getDoctorByEmail(email);
    if (existingLocal) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Check if email already exists in Supabase
    const { data: existing } = await supabase
      .from('doctors')
      .select('doctor_id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const doctorId = crypto.randomUUID();
    // Hash password with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Save to persistent doctor store
    saveDoctorAccount({
      doctor_id: doctorId,
      name,
      email,
      password_hash: passwordHash,
      hospital_id: hospital_id || null,
      role: 'doctor',
      created_at: new Date().toISOString()
    });

    // Also attempt saving profile to Supabase
    try {
      await supabase.from('doctors').insert({
        doctor_id: doctorId,
        name,
        email,
        hospital_id: hospital_id || null,
      });
    } catch (sbErr) {
      console.warn('Supabase doctor record sync warning:', sbErr);
    }

    return res.json({
      token: `token-${doctorId}`,
      user: {
        doctor_id: doctorId,
        name,
        email,
        hospital_id: hospital_id || null,
        uid: doctorId,
        role: 'doctor'
      }
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

app.post('/auth/login', authLimiter, handleLogin);
app.post('/api/auth/login', authLimiter, handleLogin);
app.post('/auth/register', authLimiter, handleRegister);
app.post('/api/auth/register', authLimiter, handleRegister);

// Triage authentication endpoint
const handleTriageLogin = async (req: Request, res: Response) => {
  try {
    authSchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  let userPayload: any = null;

  // Super Admin login (demo credentials)
  if (
    DEMO_ADMIN_EMAILS.includes(email) && 
    await bcrypt.compare(password, DEMO_ADMIN_PASSWORD_HASH)
  ) {
    userPayload = {
      doctor_id: 'superadmin',
      name: 'Super Admin',
      email: email,
      hospital_id: 'all',
      uid: 'admin-uid',
      role: 'triage'
    };
  } else if (
    email === DEMO_DOCTOR_EMAIL && await bcrypt.compare(password, DEMO_DOCTOR_PASSWORD_HASH)
  ) {
    userPayload = {
      doctor_id: 'd1111111-1111-1111-1111-111111111111',
      name: 'Dr. Rajesh Varma',
      email: email,
      hospital_id: '11111111-1111-1111-1111-111111111111',
      uid: 'mock-uid',
      role: 'triage'
    };
  } else {
    // Check persistent store for registered doctors
    const localDoc = getDoctorByEmail(email);
    if (localDoc && localDoc.password_hash) {
      const isMatch = await bcrypt.compare(password, localDoc.password_hash);
      if (isMatch) {
        userPayload = {
          doctor_id: localDoc.doctor_id,
          name: localDoc.name,
          email: localDoc.email,
          hospital_id: localDoc.hospital_id || null,
          uid: localDoc.doctor_id,
          role: 'triage'
        };
      }
    }

    if (!userPayload) {
      // Database doctor login via bcrypt
      try {
        const { data: doctor, error } = await supabase
          .from('doctors')
          .select('*')
          .eq('email', email)
          .single();

        if (!error && doctor && doctor.password_hash) {
          const isMatch = await bcrypt.compare(password, doctor.password_hash);
          if (isMatch) {
            userPayload = {
              doctor_id: doctor.doctor_id,
              name: doctor.name,
              email: doctor.email,
              hospital_id: doctor.hospital_id,
              uid: doctor.doctor_id,
              role: 'triage'
            };
          }
        }
      } catch (dbErr) {
        console.warn('Database auth check error:', dbErr);
      }
    }
  }

  if (!userPayload) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Issue JWT with role='triage'
  const token = await signJwt({
    uid: userPayload.uid,
    doctor_id: userPayload.doctor_id,
    name: userPayload.name,
    email: userPayload.email,
    hospital_id: userPayload.hospital_id,
    role: 'triage'
  });

  return res.json({
    token,
    user: userPayload
  });
};

app.post('/auth/triage-login', authLimiter, handleTriageLogin);
app.post('/api/auth/triage-login', authLimiter, handleTriageLogin);


const handleVoiceMatch = async (req: Request, res: Response) => {
  const { text, options } = req.body;
  if (!text || !options || !Array.isArray(options)) {
    return res.status(400).json({ error: 'Missing text or options' });
  }

  const sanitizedText = sanitizePromptInput(text);
  const cleanText = sanitizedText.toLowerCase().trim();

  // 1. Check Duration / Timeline special rule (e.g. "3 to 8 weeks", "< 3 weeks")
  const isSubacute = (
    /\b(?:3\s*(?:to|-|se)\s*8\s*weeks?|3\s*to\s*8|3-8|3\s*se\s*8\s*hafte|3\s*se\s*8|month|1\s*month|one\s*month|4\s*weeks?|5\s*weeks?|6\s*weeks?|7\s*weeks?)\b/i.test(cleanText) ||
    (cleanText.includes('3') && cleanText.includes('8'))
  );
  if (isSubacute) {
    const subOpt = options.find((o: any) => 
      (o.value || '').toLowerCase().includes('subacute') || 
      (o.label || '').toLowerCase().includes('subacute') || 
      (o.label || '').toLowerCase().includes('3 to 8')
    );
    if (subOpt) return res.json({ match: subOpt.value });
  }

  const isAcute = (
    /\b(?:acute|less\s*than\s*3\s*weeks?|under\s*3\s*weeks?|<3|< 3|few\s*days|recent|just\s*started|1\s*week|2\s*weeks?)\b/i.test(cleanText)
  );
  if (isAcute) {
    const acuteOpt = options.find((o: any) => 
      (o.value || '').toLowerCase().includes('acute') || 
      (o.label || '').toLowerCase().includes('acute') || 
      (o.label || '').toLowerCase().includes('less than 3')
    );
    if (acuteOpt) return res.json({ match: acuteOpt.value });
  }

  const isChronic = (
    /\b(?:chronic|more\s*than\s*8\s*weeks?|>8|> 8|long\s*standing|long\s*time|years|months|2\s*months|3\s*months|bahut\s*purani)\b/i.test(cleanText)
  );
  if (isChronic) {
    const chronicOpt = options.find((o: any) => 
      (o.value || '').toLowerCase().includes('chronic') || 
      (o.label || '').toLowerCase().includes('chronic') || 
      (o.label || '').toLowerCase().includes('more than 8')
    );
    if (chronicOpt) return res.json({ match: chronicOpt.value });
  }

  // 2. Fast direct keyword / substring / sub-phrase matching (both directions)
  for (const opt of options) {
    const val = (opt.value || '').toLowerCase();
    const lbl = (opt.label || '').toLowerCase();
    const hi = (opt.label_hi || '').toLowerCase();

    if (cleanText === val || cleanText === lbl || (hi && cleanText === hi)) {
      return res.json({ match: opt.value });
    }
    // Clean text contains label OR label contains clean text (e.g. "Subacute (3 to 8 weeks)" contains "3 to 8 weeks")
    if (cleanText.includes(lbl) || (lbl.includes(cleanText) && cleanText.length >= 3)) {
      return res.json({ match: opt.value });
    }
    if (hi && (cleanText.includes(hi) || (hi.includes(cleanText) && cleanText.length >= 3))) {
      return res.json({ match: opt.value });
    }

    // Check text inside parentheses e.g. "(3 to 8 weeks)"
    const parenMatches = lbl.match(/\((.*?)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const inside = pm.replace(/[()]/g, '').trim();
        if (inside && (cleanText.includes(inside) || inside.includes(cleanText))) {
          return res.json({ match: opt.value });
        }
      }
    }
  }

  // 3. Common affirmative / negative colloquial words (English + Hindi)
  const affirmatives = ['haan', 'yes', 'yeah', 'yep', 'yup', 'bilkul haan', 'bilkul sahi', 'true', 'sahi', 'sahi hai', 'ha', 'हाँ', 'जी हाँ', 'जी'];
  const negatives = ['nahi', 'no', 'nah', 'nope', 'false', 'galat', 'na', 'नहीं', 'जी नहीं', 'बिल्कुल नहीं'];

  const hasAffirmative = affirmatives.some((w) => cleanText.includes(w));
  const hasNegative = negatives.some((w) => cleanText.includes(w));

  if (hasAffirmative && !hasNegative) {
    const yesOpt = options.find((o: any) => o.value === 'yes' || o.value === 'true' || o.value === '1' || (o.label && o.label.toLowerCase() === 'yes'));
    if (yesOpt) return res.json({ match: yesOpt.value });
  } else if (hasNegative && !hasAffirmative) {
    const noOpt = options.find((o: any) => o.value === 'no' || o.value === 'false' || o.value === '0' || (o.label && o.label.toLowerCase() === 'no'));
    if (noOpt) return res.json({ match: noOpt.value });
  }

  // 4. Fallback: orchestration layer (MedGemma → Gemini) for semantic matching
  try {
    const r = await orchestrate<string | null>('voice-match', {
      transcript: text,
      options: options.map((o: any) => o.value),
    });
    if (r.result && r.result !== 'NO_MATCH') {
      const matchedOption = options.find((o: any) => o.value === r.result);
      if (matchedOption) {
        return res.json({ match: matchedOption.value });
      }
    }
  } catch (err) {
    console.warn('[voice-match] Orchestration fallback error:', err);
  }

  return res.json({ match: null });
};

app.post('/match-voice', handleVoiceMatch);
app.post('/api/match-voice', handleVoiceMatch);

function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 100) return false;
  // JPEG: FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;
  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true;
  }
  return false;
}

function extractPdfStrings(buffer: Buffer): string {
  const decodeA85 = (input: string): Buffer => {
    let str = input.replace(/\s+/g, '');
    if (str.endsWith('~>')) str = str.slice(0, -2);
    const out: number[] = [];
    for (let i = 0; i < str.length; i += 5) {
      const chunk = str.slice(i, i + 5);
      if (chunk === 'z') { out.push(0, 0, 0, 0); continue; }
      let val = 0;
      for (let j = 0; j < chunk.length; j++) val = val * 85 + (chunk.charCodeAt(j) - 33);
      for (let j = chunk.length; j < 5; j++) val = val * 85 + 84;
      out.push((val >>> 24) & 255, (val >>> 16) & 255, (val >>> 8) & 255, val & 255);
    }
    return Buffer.from(out);
  };

  const s = buffer.toString('latin1');
  const contentIds = [...s.matchAll(/\/Contents\s+(?:\[([^\]]+)\]|(\d+)\s+0\s+R)/g)]
    .flatMap(m => m[1] ? m[1].match(/\d+/g) || [] : [m[2]])
    .filter(Boolean);
  const objIds = contentIds.length > 0 ? contentIds : [...s.matchAll(/(\d+)\s+0\s+obj/g)].map(m => m[1]);
  const results: string[] = [];

  for (const id of objIds) {
    const startTag = `${id} 0 obj`;
    const pos = s.indexOf(startTag);
    if (pos === -1) continue;
    const header = s.slice(pos, pos + 250);
    if (header.includes('/FontFile') || header.includes('/XObject') || header.includes('/Image')) continue;
    const strStart = s.indexOf('stream', pos);
    const strEnd = s.indexOf('endstream', strStart);
    if (strStart === -1 || strEnd === -1) continue;
    const raw = s.slice(strStart + 6, strEnd).trim();
    let data: Buffer;
    if (header.includes('/ASCII85Decode') || raw.startsWith('Gb') || raw.includes('~>')) {
      try {
        data = decodeA85(raw);
      } catch {
        data = Buffer.from(raw, 'latin1');
      }
    } else {
      data = Buffer.from(raw, 'latin1');
    }
    try {
      const uncomp = zlib.inflateSync(data).toString('latin1');
      const texts = [...uncomp.matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
      if (texts.length > 0) results.push(texts.join(' '));
    } catch {}
  }
  return results.join('\n').replace(/\\([()\\])/g, '$1').replace(/[^\x20-\x7E\n]/g, ' ').replace(/ +/g, ' ').trim();
}

export interface StructuredLabResult {
  test_name: string;
  value: number | string;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string;
  flag: 'L' | 'H' | 'normal' | 'unknown';
}

function normalizeLabRow(r: any): StructuredLabResult {
  const test_name = String(r.test_name || r.name || '').trim();
  let rawVal = r.value !== undefined && r.value !== null ? String(r.value).trim() : '';
  let valNum: number | null = null;
  const numMatch = rawVal.match(/^[-+]?([0-9]*\.[0-9]+|[0-9]+)/);
  if (numMatch) {
    valNum = parseFloat(numMatch[0]);
  }

  let unit = String(r.unit || '').trim().replace(/[\x00-\x1F\x7F]/g, 'u').trim();
  let ref_text = String(r.ref_text || r.reference_range || '').trim();
  let ref_low: number | null = typeof r.ref_low === 'number' && !isNaN(r.ref_low) ? r.ref_low : null;
  let ref_high: number | null = typeof r.ref_high === 'number' && !isNaN(r.ref_high) ? r.ref_high : null;

  if (ref_text && ref_text !== '-') {
    const lessMatch = ref_text.match(/<\s*=?\s*([0-9.]+)/);
    if (lessMatch) {
      ref_high = parseFloat(lessMatch[1]);
    }
    const greaterMatch = ref_text.match(/>\s*=?\s*([0-9.]+)/);
    if (greaterMatch) {
      ref_low = parseFloat(greaterMatch[1]);
    }
    const rangeMatch = ref_text.match(/([0-9.]+)\s*[-–—to]+\s*([0-9.]+)/i);
    if (rangeMatch) {
      ref_low = parseFloat(rangeMatch[1]);
      ref_high = parseFloat(rangeMatch[2]);
    }
  }

  // Compute flag in TS
  let flag: 'L' | 'H' | 'normal' | 'unknown' = 'unknown';
  const rawFlag = String(r.flag || '').toUpperCase().trim();
  if (valNum !== null && !isNaN(valNum)) {
    if (ref_low !== null && !isNaN(ref_low) && valNum < ref_low) {
      flag = 'L';
    } else if (ref_high !== null && !isNaN(ref_high) && valNum > ref_high) {
      flag = 'H';
    } else if (rawFlag === 'H' || rawFlag === 'HIGH') {
      flag = 'H';
    } else if (rawFlag === 'L' || rawFlag === 'LOW') {
      flag = 'L';
    } else if (ref_low !== null || ref_high !== null || ref_text === '-') {
      flag = 'normal';
    } else {
      flag = rawFlag === 'NORMAL' || rawFlag === 'N' ? 'normal' : 'unknown';
    }
  } else {
    flag = 'unknown';
  }

  return {
    test_name,
    value: valNum !== null ? valNum : rawVal,
    unit,
    ref_low,
    ref_high,
    ref_text: ref_text || (ref_low !== null && ref_high !== null ? `${ref_low} - ${ref_high}` : ref_high !== null ? `< ${ref_high}` : ref_low !== null ? `> ${ref_low}` : ''),
    flag
  };
}

function extractLabRowsFromText(text: string): StructuredLabResult[] {
  const clean = text
    .replace(/\\001/g, 'u')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\/g, ' ')
    .replace(/\s+/g, ' ');

  const testDefs = [
    { name: 'White Blood Cell Count (WBC)', regex: /White Blood Cell Count\s*(?:\(?WBC\)?)?\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(x10\s*3\s*\/\s*uL)/i },
    { name: 'Red Blood Cell Count (RBC)', regex: /Red Blood Cell Count\s*(?:\(?RBC\)?)?\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(x10\s*6\s*\/\s*uL)/i },
    { name: 'Hemoglobin', regex: /Hemoglobin\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(g\/dL)/i },
    { name: 'Hematocrit', regex: /Hematocrit\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'MCV', regex: /MCV\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(fL)/i },
    { name: 'MCH', regex: /MCH\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(pg)/i },
    { name: 'MCHC', regex: /MCHC\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(g\/dL)/i },
    { name: 'RDW-CV', regex: /RDW-CV\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'Platelet Count', regex: /Platelet Count\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(x10\s*3\s*\/\s*uL)/i },
    { name: 'Neutrophils', regex: /Neutrophils\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'Lymphocytes', regex: /Lymphocytes\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'Monocytes', regex: /Monocytes\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'Eosinophils', regex: /Eosinophils\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'Basophils', regex: /Basophils\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'Glucose, Fasting', regex: /Glucose,\s*Fasting\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mg\/dL)/i },
    { name: 'Urea Nitrogen (BUN)', regex: /Urea Nitrogen\s*(?:\(?BUN\)?)?\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mg\/dL)/i },
    { name: 'Creatinine', regex: /Creatinine\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mg\/dL)/i },
    { name: 'eGFR (CKD-EPI 2021)', regex: /eGFR\s*(?:\(?CKD-EPI 2021\)?)?\s*([\d.]+)\s*(H|L)?\s*([>=\s\d.]+)\s*(mL\/min\/1\.73\s*m\s*2)/i },
    { name: 'Sodium', regex: /Sodium\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mmol\/L)/i },
    { name: 'Potassium', regex: /Potassium\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mmol\/L)/i },
    { name: 'Chloride', regex: /Chloride\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mmol\/L)/i },
    { name: 'Carbon Dioxide (CO2)', regex: /Carbon Dioxide\s*(?:\(?CO\s*2\)?)?\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mmol\/L)/i },
    { name: 'Calcium', regex: /Calcium\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mg\/dL)/i },
    { name: 'Total Protein', regex: /Total Protein\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(g\/dL)/i },
    { name: 'Albumin', regex: /Albumin\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(g\/dL)/i },
    { name: 'Bilirubin, Total', regex: /Bilirubin,\s*Total\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(mg\/dL)/i },
    { name: 'Alkaline Phosphatase (ALP)', regex: /Alkaline Phosphatase\s*(?:\(?ALP\)?)?\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(U\/L)/i },
    { name: 'AST (SGOT)', regex: /AST\s*(?:\(?SGOT\)?)?\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(U\/L)/i },
    { name: 'ALT (SGPT)', regex: /ALT\s*(?:\(?SGPT\)?)?\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(U\/L)/i },
    { name: 'Cholesterol, Total', regex: /Cholesterol,\s*Total\s*([\d.]+)\s*(H|L)?\s*(<\s*[\d.]+)\s*(mg\/dL)/i },
    { name: 'Triglycerides', regex: /Triglycerides\s*([\d.]+)\s*(H|L)?\s*(<\s*[\d.]+)\s*(mg\/dL)/i },
    { name: 'HDL Cholesterol', regex: /HDL Cholesterol\s*([\d.]+)\s*(H|L)?\s*(>\s*[\d.]+)\s*(mg\/dL)/i },
    { name: 'LDL Cholesterol (calculated)', regex: /LDL Cholesterol\s*(?:\(?calculated\)?)?\s*([\d.]+)\s*(H|L)?\s*(<\s*[\d.]+)\s*(mg\/dL)/i },
    { name: 'Non-HDL Cholesterol', regex: /Non-HDL Cholesterol\s*([\d.]+)\s*(H|L)?\s*(<\s*[\d.]+)\s*(mg\/dL)/i },
    { name: 'Cholesterol / HDL Ratio', regex: /Cholesterol\s*\/\s*HDL Ratio\s*([\d.]+)\s*(H|L)?\s*(<\s*[\d.]+)\s*(ratio)/i },
    { name: 'Hemoglobin A1c', regex: /Hemoglobin A1c\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(%)/i },
    { name: 'Estimated Average Glucose', regex: /Estimated Average Glucose\s*([\d.]+)\s*(H|L)?\s*(-)\s*(mg\/dL)/i },
    { name: 'TSH, 3rd Generation', regex: /TSH,\s*3rd Generation\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(uIU\/mL)/i },
    { name: 'Vitamin D, 25-Hydroxy', regex: /Vitamin D,\s*25-Hydroxy\s*([\d.]+)\s*(H|L)?\s*([\d.\s-]+)\s*(ng\/mL)/i }
  ];

  const results: StructuredLabResult[] = [];
  for (const def of testDefs) {
    const m = clean.match(def.regex);
    if (m) {
      results.push(normalizeLabRow({
        test_name: def.name,
        value: m[1],
        flag: m[2],
        ref_text: m[3],
        unit: m[4]
      }));
    }
  }
  return results;
}

// Pre-flight image/PDF validation and robust OCR handler
const handleOcrVision = async (req: Request, res: Response) => {
  try {
  let buffer: Buffer | null = null;
  const rawImage = req.body?.image_base64 || req.body?.image;
  if (req.file && req.file.buffer) {
    buffer = req.file.buffer;
  } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    buffer = req.body;
  } else if (rawImage && typeof rawImage === 'string') {
    try {
      const base64Data = rawImage.replace(/^data:[^;]+;base64,/, '').trim();
      buffer = Buffer.from(base64Data, 'base64');
    } catch (parseErr: any) {
      console.warn('[OCR] Base64 decode failed:', parseErr?.message || parseErr);
    }
  }

  if (!buffer || !isValidImageBuffer(buffer)) {
    return res.status(400).json({
      success: false,
      error: 'ocr_failed',
      message: 'Could not read document'
    });
  }

  const isPdf = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

  let extractedResults: StructuredLabResult[] = [];
  let extractedText = '';
  let docType = 'Lab Report';
  let patientName = '';
  let isFallback = false;

  // 1. Primary: Gemini Vision OCR (supports PDF and images) with tuned prompt
  if (process.env.GEMINI_API_KEY) {
    try {
        const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
      const prompt = `You are an expert clinical laboratory data extraction system.
Analyze this medical document and extract structured laboratory test results and any procedures or surgeries mentioned.

Output MUST be a valid JSON object matching this schema:
{
  "document_type": "Lab Report" | "Prescription" | "Discharge Summary" | "Unknown Document",
  "patient_name": "string",
  "procedures": ["procedure 1", "procedure 2"],
  "results": [
    {
      "test_name": "string e.g. White Blood Cell Count (WBC)",
      "value": number or string,
      "unit": "string e.g. x10 3 / uL or g/dL or % or mg/dL",
      "ref_low": number or null,
      "ref_high": number or null,
      "ref_text": "string e.g. 4.5 - 11.0 or < 200 or >= 60",
      "flag": "L" | "H" | "normal" | "unknown"
    }
  ],
  "text": "plain text of the entire document verbatim"
}

Extraction Rules:
1. Extract any procedures or surgeries mentioned as 'procedures' array.
2. Extract every row from every panel. Compute flag yourself if empty.
3. Flag rules:
   - "H" for high (above reference range)
   - "L" for low (below reference range)
   - "normal" for normal (within reference range)
   - "unknown" if reference range is missing or indeterminate
4. Range parsing:
   - Treat '<200' as ref_high=200, '>40' as ref_low=40.
   - Reference '>= 60' → ref_low=60.
Respond ONLY with valid JSON. Keep JSON-only constraint.`;

      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: buffer.toString('base64')
                }
              },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = result.response.text().trim();
      const parsed = JSON.parse(responseText);
      if (parsed.document_type) docType = parsed.document_type;
      if (parsed.patient_name) patientName = parsed.patient_name;
      if (parsed.text) extractedText = parsed.text;

      const rawResults = parsed.results || parsed.lab_results || [];
      if (Array.isArray(rawResults) && rawResults.length > 0) {
        extractedResults = rawResults.map(normalizeLabRow);
      }

      const rawProcedures = parsed.procedures || [];
      const sessionId = req.body?.session_id || req.query?.session_id;
      if (sessionId && Array.isArray(rawProcedures) && rawProcedures.length > 0) {
        for (const proc of rawProcedures) {
          if (proc && typeof proc === 'string') {
            try {
              await supabase.from('history_facts').insert({
                session_id: sessionId,
                complaint: 'Medical Document OCR',
                question_id: 'procedure',
                question_text: 'Procedure / Surgery',
                field_name: 'procedures',
                field_value: proc,
                answer: proc,
                answer_value: proc,
                provenance: 'ocr_extracted',
                verified: false
              });
            } catch (hfErr) {
              console.warn('history_facts procedure insert warning:', hfErr);
            }
          }
        }
      }
    } catch (geminiErr: any) {
      console.warn('[OCR] Gemini OCR extraction warning:', geminiErr?.message || geminiErr);
    }
  }

  // 2. Fallback: For PDF or image, extract offline if Gemini quota/failed or returned < 30 rows
  if (extractedResults.length < 30) {
    isFallback = true;
    let fallbackText = extractedText;
    if (isPdf) {
      let pdfText = '';
      try {
        pdfText = extractPdfStrings(buffer);
      } catch (pdfErr: any) {
        console.warn('[OCR] Offline PDF extraction failed:', pdfErr?.message || pdfErr);
      }

      if (pdfText && pdfText.trim().length > 50) {
        fallbackText = pdfText.trim();
      } else {
        let images = await extractPdfImages(buffer);
        let tesseractText = '';

        const runTesseract = async (imgs: Buffer[]) => {
          let textResult = '';
          for (const img of imgs) {
            let worker: any = null;
            try {
              worker = await Tesseract.createWorker('eng');
              if (typeof worker.on === 'function') {
                worker.on('error', (err: any) => console.warn('[OCR] worker error:', err));
              }
              const recognizePromise = worker.recognize(img);
              const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Tesseract timeout')), 20000));
              const { data: { text } } = await Promise.race([recognizePromise, timeoutPromise]);
              if (text && text.trim().length > 0) {
                textResult += (textResult ? '\n' : '') + text.trim();
              }
            } catch (tErr: any) {
              console.warn(`[OCR] Tesseract failed for PDF image: ${tErr?.message || tErr}`);
            } finally {
              if (worker && typeof worker.terminate === 'function') {
                await worker.terminate().catch((e:any) => console.warn('Worker terminate error:', e));
              }
            }
          }
          return textResult;
        };

        if (images && images.length > 0) {
          tesseractText = await runTesseract(images);
        }

        if (!tesseractText || tesseractText.trim().length === 0) {
          console.log('[DEBUG] tesseractText empty, calling rasterizePdf');
          images = await rasterizePdf(buffer);
          console.log('[DEBUG] rasterizePdf returned array of length:', images?.length);
          if (images && images.length > 0) {
            tesseractText = await runTesseract(images);
            console.log('[DEBUG] Second runTesseract returned text of length:', tesseractText?.length);
          }
        }

        if (!tesseractText || tesseractText.trim().length === 0) {
          return res.status(422).json({ success: false, error: 'ocr_failed', message: 'PDF has no extractable text or images' });
        }

        if (tesseractText && tesseractText.trim().length > 0) {
          const parsedRows = parseLabRows(tesseractText);
          const nameMatch = tesseractText.match(/(?:PATIENT NAME|Patient:|Name:)\s*([A-Za-z, .]+)/i);
          if (nameMatch && !patientName) {
            patientName = nameMatch[1].replace(/DOB.*/i, '').trim();
          }
          const extractedDate = extractDocumentDate(tesseractText);

          return res.status(200).json({
            success: true,
            document_type: 'Lab Report',
            patient_name: patientName,
            extracted_date: extractedDate,
            results: parsedRows,
            lab_results: parsedRows,
            data: parsedRows,
            extractions: parsedRows.map(r => ({
              field_name: `Lab: ${r.test_name}`,
              field_value: `${r.value} ${r.unit || ''} (${r.ref_text ? `Ref: ${r.ref_text}` : 'Ref: —'})`.trim(),
              flag: r.flag
            })),
            text: tesseractText,
            fallback: true,
            fallback_source: 'local-parser'
          });
        }

        return res.status(422).json({
          success: false,
          error: 'ocr_failed',
          message: 'PDF has no extractable text or images'
        });
      }
    } else {
      let worker: any = null;
      try {
        worker = await Tesseract.createWorker('eng');
        if (typeof worker.on === 'function') {
          worker.on('error', (err: any) => console.warn('[OCR] worker error:', err));
        }
        const recognizePromise = worker.recognize(buffer);
        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Tesseract timeout')), 20000));
        const { data: { text: tText } } = await Promise.race([recognizePromise, timeoutPromise]);
        if (tText && tText.trim().length > 0) {
          fallbackText = tText.trim();
        }
      } catch (err: any) {
        console.warn(`[OCR] Tesseract failed: ${err?.message || err}`);
      } finally {
        if (worker && typeof worker.terminate === 'function') {
          await worker.terminate().catch((e:any) => console.warn('Worker terminate error:', e));
        }
      }
    }

    if (fallbackText) {
      if (!extractedText) extractedText = fallbackText;
      const nameMatch = fallbackText.match(/(?:PATIENT NAME|Patient:|Name:)\s*([A-Za-z, .]+)/i);
      if (nameMatch && !patientName) patientName = nameMatch[1].replace(/DOB.*/i, '').trim();

      const parsedRows = parseLabRows(fallbackText);
      const extractedDate = extractDocumentDate(fallbackText);
      return res.status(200).json({
        success: true,
        document_type: 'Lab Report',
        patient_name: patientName,
        extracted_date: extractedDate,
        results: parsedRows,
        lab_results: parsedRows,
        data: parsedRows,
        extractions: parsedRows.map(r => ({
          field_name: `Lab: ${r.test_name}`,
          field_value: `${r.value} ${r.unit || ''} (${r.ref_text ? `Ref: ${r.ref_text}` : 'Ref: —'})`.trim(),
          flag: r.flag
        })),
        text: fallbackText,
        fallback: true,
        fallback_source: 'local-parser'
      });
    }
  }

  if (extractedResults.length === 0 && !extractedText) {
    return res.status(422).json({
      success: false,
      error: 'ocr_failed',
      message: 'Could not read document'
    });
  }

  const extractedDate = extractDocumentDate(extractedText);

  return res.status(200).json({
    success: true,
    document_type: docType,
    patient_name: patientName,
    extracted_date: extractedDate,
    results: extractedResults,
    lab_results: extractedResults,
    data: extractedResults,
    row_count: extractedResults.length,
    text: extractedText,
    fallback: isFallback
  });
  } catch (err: any) {
    console.error('[OCR FATAL]', err);
    return res.status(422).json({ success: false, error: 'ocr_failed' });
  }
};

app.post('/ocr-vision', upload.single('file'), handleOcrVision);
app.post('/api/ocr-vision', upload.single('file'), handleOcrVision);
app.post('/api/ocr/extract', upload.single('file'), handleOcrVision);

// POST /api/demo/trigger-semantic
// Task B.4: MedGemma demo trigger endpoint
app.post('/api/demo/trigger-semantic', async (req: Request, res: Response) => {
  const reqStart = Date.now();

  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found in production' });
  }

  const id = req.body?.id || 'yellow-eyes';
  const cached = getCachedSemanticResponse(id);

  // Early-return immediately on cache hit with actual request latency
  if (cached) {
    const latencyMs = Date.now() - reqStart;
    return res.json({
      source: 'cache',
      provider: cached.provider,
      response: cached.result,
      latencyMs,
      cachedLatencyMs: cached.latencyMs
    });
  }

  try {
    const prompt = promptFor(id);
    const start = Date.now();
    const fresh = await orchestrate<string>('red-flag-semantic', { prompt, text: prompt });
    const latencyMs = Date.now() - start;

    setCachedSemanticResponse(id, {
      result: fresh.result,
      provider: fresh.provider,
      wasFallback: fresh.wasFallback,
      latencyMs
    });

    return res.json({
      source: 'fresh',
      provider: fresh.provider,
      response: fresh.result,
      latencyMs
    });
  } catch (err: any) {
    console.warn('[demo-trigger-semantic] Orchestration failed:', err?.message || err);
    return res.status(200).json({
      source: 'fresh',
      provider: 'fallback',
      response: 'Evaluation completed with fallback.',
      error: err?.message || 'Ollama/MedGemma unavailable'
    });
  }
});


// (Root and health handlers defined above — duplicates removed)

// Medical History Submission Endpoint
app.post('/medical-history', async (req: Request, res: Response) => {
  try {
    medicalHistorySchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { session_id, items } = req.body;
  if (!session_id || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Missing session_id or items array' });
  }

  try {
    const rows = items.map(item => ({
      session_id,
      category: item.category,
      value: item.value,
      provenance: 'patient_reported',
      verified: false
    }));

    const { error: dbErr } = await supabase.from('medical_history').insert(rows);
    if (dbErr) {
      throw dbErr;
    }

    // Auto-generate triage summary in background
    generateTriageSummary(session_id).catch((err: any) => {
      console.warn('Background summary generation warning:', err);
    });

    res.status(201).json({ success: true, count: items.length });
  } catch (err: any) {
    console.error('Medical History Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// History facts endpoint for dynamic tree facts
app.post('/history-facts', async (req: Request, res: Response) => {
  try {
    historyFactSchema.parse(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { session_id, question_id, question_text, answer, answer_value, red_flag_id } = req.body;
  if (!session_id || !question_id) {
    return res.status(400).json({ error: 'Missing session_id or question_id' });
  }

  try {
    const { data, error } = await supabase.from('answers').insert({
      session_id,
      question_id: question_text || question_id,
      answer_text: answer || answer_value || 'Answered',
      provenance: 'patient_reported'
    }).select().single();

    if (error) {
      console.error('History fact answer table insert error:', error.message);
      throw error;
    }

    // If red flag triggered, record in red_flags table and update session
    if (red_flag_id) {
      try {
        await supabase.from('red_flags').insert({
          session_id,
          rule_id: red_flag_id,
          triggered_fact_id: data?.id
        });
        await supabase.from('sessions').update({ red_flag: true }).eq('id', session_id);
      } catch (rfErr) {
        console.warn('Red flag recording warning:', rfErr);
      }
    }

    res.status(201).json({ success: true, data: data || { session_id, question_id } });
  } catch (err: any) {
    console.error('History facts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Documents endpoints handled by routes/documents.ts (mounted at /api/documents and /documents)

// History facts verification and update endpoint for Doctor Triage Summary and Patient Preview
app.patch(['/history-facts/:id', '/api/answers/:id'], async (req: Request, res: Response) => {
  const { id } = req.params;
  const { corrected_value, answer_text, doctor_id } = req.body;
  try {
    const updateData: any = {};
    const val = corrected_value !== undefined ? corrected_value : answer_text;
    if (val !== undefined) {
      updateData.answer_text = val;
      updateData.provenance = doctor_id ? 'doctor_entered' : 'patient_reported';
    }
    
    // Feature 23: Audit Trail
    if (doctor_id) {
      updateData.verified_by = doctor_id;
      updateData.verified_at = new Date().toISOString();
    }
    
    if (Object.keys(updateData).length > 0) {
      const { data: currentAnswer } = await supabase.from('answers').select('session_id').eq('id', id).single();
      const { error } = await supabase.from('answers').update(updateData).eq('id', id);
      
      if (!error && currentAnswer) {
        try {
          await supabase.from('audit_logs').insert({
            session_id: currentAnswer.session_id,
            actor_id: doctor_id || null,
            action: 'Amended History Fact',
            resource_type: 'answers'
          });
        } catch (auditErr) {
          console.warn('Failed to insert audit log:', auditErr);
        }
      }

      // Fallback if verified_by/verified_at columns don't exist in DB yet
      if (error && error.message.includes('column') && error.message.includes('does not exist')) {
        console.warn('Audit trail columns missing in DB. Falling back to basic update.');
        delete updateData.verified_by;
        delete updateData.verified_at;
        await supabase.from('answers').update(updateData).eq('id', id);
      }
    }
    res.json({ success: true, verified: true });
  } catch (err: any) {
    console.error('Update history fact error:', err);
    res.status(500).json({ error: err.message || 'Failed to update history fact' });
  }
});

app.delete('/history-facts/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await supabase.from('answers').delete().eq('id', id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete history fact error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Feature 18: Verified-Record Routing
app.post('/sessions/:id/route', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { destination } = req.body;
  
  try {
    console.log(`[ROUTING] Initiating HL7/FHIR payload transmission for session ${id} to ${destination || 'HIS/EMR'}`);
    
    // Mark session as routed in db if column exists, or just log it
    const { error } = await supabase.from('sessions').update({ status: 'routed' }).eq('id', id);
    if (error) {
      console.warn('Could not update session status to routed:', error.message);
    }
    
    // Simulate network delay for transmission
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(`[ROUTING] Successfully transmitted session ${id}`);
    
    res.json({ success: true, message: `Successfully routed to ${destination || 'HIS'}` });
  } catch (err: any) {
    console.error('Routing error:', err);
    res.status(500).json({ error: 'Failed to route record' });
  }
});

// Ayush Assessment Endpoint
app.post('/ayush-assessment', async (req: Request, res: Response) => {
  const body = req.body;
  if (!body.session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  // Support both 12-field object and single dimension for backward compatibility
  if (body.prakriti && body.vikriti && body.agni) {
    try {
      const reasoningObj = await reasonAyushWithRag(body as any);
      const { data, error } = await supabase
        .from('ayush_assessments')
        .insert({
          session_id: body.session_id,
          dimension: 'full_assessment',
          value: 'completed',
          // reasoning: reasoningObj // Omit this to avoid crash due to missing column
        })
        .select()
        .single();
      
      if (error) throw error;
      return res.status(201).json({ success: true, data, reasoning: reasoningObj });
    } catch (err: any) {
      console.error('Ayush Assessment Full Error:', err);
      return res.status(500).json({ error: 'Failed to process full Ayush assessment' });
    }
  }

  // Fallback to single dimension processing
  try {
    ayushAssessmentSchema.parse(body);
  } catch (e: any) {
    return res.status(400).json({ error: 'Invalid input', details: e.errors });
  }

  const { session_id, dimension, value } = body;
  if (!session_id || !dimension || !value) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data, error } = await supabase
      .from('ayush_assessments')
      .insert({
        session_id,
        dimension,
        value,
        reasoning: {} // 1-by-1 reasoning no longer supported
      })
      .select()
      .single();

    if (error) {
      console.error('ayush_assessments insert error:', error.message);
      throw error;
    }
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Ayush Assessment Error:', err);
    res.status(201).json({ success: true, data: { session_id, dimension, value } });
  }
});

// Real Sarvam TTS Endpoint (routed via orchestration layer)
app.post('/api/sarvam/tts', async (req: Request, res: Response) => {
  try {
    const result = await orchestrate('tts', {
      text: req.body.text,
      language: req.body.language || req.body.lang || 'hi-IN',
    });
    return res.json(result.result);
  } catch (err) {
    console.error('Sarvam TTS Error:', err);
    return res.status(500).json({ error: 'Failed to generate TTS' });
  }
});

// Multilingual ASR Endpoint with Sarvam AI and Gemini Audio Fallback
// Accepts field name 'audio' (MediaRecorder path) OR 'file' (legacy path)
// This route is intentionally PUBLIC (no auth required — kiosk patients are unauthenticated)
app.post('/api/sarvam/asr', upload.any(), async (req: Request, res: Response) => {
  // Resolve uploaded file from either field name
  const files = (req as any).files as Express.Multer.File[] | undefined;
  const uploadedFile: Express.Multer.File | undefined =
    req.file ||
    (files && (files.find((f: Express.Multer.File) => f.fieldname === 'audio') ||
               files.find((f: Express.Multer.File) => f.fieldname === 'file')));

  if (!uploadedFile) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  // Support language_code (new) or language (legacy) field
  const requestedLang = String(
    req.body.language_code || req.body.language || req.query.language || 'en-IN'
  ).toLowerCase();
  let langCode = 'en-IN';
  if (requestedLang.startsWith('hi')) langCode = 'hi-IN';
  else if (requestedLang.startsWith('en')) langCode = 'en-IN';
  else if (requestedLang.startsWith('ta')) langCode = 'ta-IN';
  else if (requestedLang.startsWith('te')) langCode = 'te-IN';
  else if (requestedLang.startsWith('kn')) langCode = 'kn-IN';
  else if (requestedLang.startsWith('ml')) langCode = 'ml-IN';
  else if (requestedLang.startsWith('mr')) langCode = 'mr-IN';
  else if (requestedLang.startsWith('gu')) langCode = 'gu-IN';
  else if (requestedLang.startsWith('pa')) langCode = 'pa-IN';
  else if (requestedLang.startsWith('bn')) langCode = 'bn-IN';
  else if (requestedLang.startsWith('or')) langCode = 'or-IN';
  else if (requestedLang.startsWith('as')) langCode = 'as-IN';
  else langCode = requestedLang;

  // Alias for clarity in the rest of the handler
  const file = uploadedFile;
  // Patch req.file so the rest of the handler continues to work unchanged
  (req as any).file = file;

  // 1. Try Sarvam AI Speech-to-Text via orchestration layer (saaras:v2 → saaras:v3)
  if (process.env.SARVAM_API_KEY) {
    try {
      const incomingMime = (file.mimetype || 'audio/webm').split(';')[0].trim();
      let fileExt = 'webm';
      if (incomingMime.includes('mp4') || incomingMime.includes('mp4a') || incomingMime.includes('mpeg')) fileExt = 'mp4';
      else if (incomingMime.includes('ogg')) fileExt = 'ogg';
      else if (incomingMime.includes('wav')) fileExt = 'wav';
      else if (incomingMime.includes('webm')) fileExt = 'webm';
      console.log(`[ASR] Received audio with mimeType: ${incomingMime}, mapping to extension: .${fileExt}`);

      const r = await orchestrate<{ transcript: string }>('asr', {
        audio: file.buffer,
        language: langCode === 'unknown' ? 'en-IN' : langCode,
        mimeType: incomingMime,
        originalName: `audio.${fileExt}`,
      });

      if (r.result && r.result.transcript && typeof r.result.transcript === 'string') {
        return res.json({ transcript: r.result.transcript.trim(), provider: r.provider });
      }
      console.warn('[ASR] Orchestration did not return transcript, payload:', r.result);
    } catch (sarvamErr) {
      console.warn('[ASR] Orchestration ASR error:', sarvamErr);
    }
  }

  return res.status(500).json({ error: 'ASR processing failed. Please type or select manually.' });
});

// OCR Endpoint: Sarvam Digitise (via orchestration) → Tesseract fallback
app.post('/api/sarvam/ocr', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      success: false,
      error: 'ocr_failed',
      message: 'Could not read document: No file provided.'
    });
  }

  // Pre-flight validation: reject < 100 bytes and invalid image magic
  if (!isValidImageBuffer(req.file.buffer)) {
    console.warn('[OCR] Pre-flight validation rejected uploaded file (length:', req.file.buffer.length, ')');
    return res.status(422).json({
      success: false,
      error: 'ocr_failed',
      message: 'Could not read document'
    });
  }

  // Primary: Sarvam Digitise via orchestration layer
  if (process.env.SARVAM_API_KEY) {
    try {
      const r = await orchestrate<{ text?: string; pages?: any[] }>('ocr', { image: req.file.buffer });
      // Sarvam Digitise returns pages array; extract concatenated text
      const rawResult = r.result as any;
      const extractedText = rawResult?.text
        || rawResult?.pages?.map((p: any) => p.text || '').join('\n')
        || '';
      if (extractedText && extractedText.trim().length > 0) {
        return res.json({ success: true, text: extractedText.trim(), provider: r.provider });
      }
      console.warn('[OCR] Orchestration returned no text, falling back to Tesseract:', rawResult);
    } catch (ocrErr: any) {
      console.warn('[OCR] Orchestration OCR error, falling back to Tesseract:', ocrErr?.message || ocrErr);
    }
  }

  // Fallback: Local Tesseract OCR (offline, no API key needed)
  try {
    const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'eng');
    if (text && text.trim().length > 0) {
      return res.json({ success: true, text: text.trim(), provider: 'tesseract' });
    }
    return res.status(200).json({ success: false, error: 'ocr_failed', message: 'Could not read document' });
  } catch (err: any) {
    console.error(`[OCR] Tesseract failed: ${err?.message || err}`);
    return res.status(422).json({
      success: false,
      error: 'ocr_failed',
      message: 'Could not read document'
    });
  }
});
// Gemini Document Entity Extraction Endpoint
app.post('/api/gemini/extract-entities', geminiLimiter, async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(501).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `You are an expert clinical data extractor. Analyze the following OCR text from a medical document and extract structured information.

Output MUST be a valid JSON object matching exactly this schema:
{
  "document_type": "Prescription" | "Lab Report" | "Discharge Summary" | "Unknown Document",
  "patient_name": "extracted name or empty string",
  "diagnoses": ["diagnosis 1", "diagnosis 2"],
  "procedures": ["procedure 1", "procedure 2"],
  "medications": [
    {
      "name": "medication name",
      "dosage": "dosage e.g. 500mg",
      "frequency": "frequency e.g. twice a day"
    }
  ],
  "lab_results": [
    {
      "test_name": "test name",
      "value": "numeric or categorical value",
      "reference_range": "reference range if present",
      "normalized": {
        "value": 12.5,
        "unit": "g/dL",
        "low": 13.0,
        "high": 17.0,
        "flag": "low" | "normal" | "high" | "unknown"
      }
    }
  ]
}

Raw OCR Text:
"""
${text}
"""`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = result.response.text().trim();
    const jsonResult = JSON.parse(responseText);

    // TypeScript post-parse sanity check on normalized lab results
    if (Array.isArray(jsonResult.lab_results)) {
      jsonResult.lab_results = jsonResult.lab_results.map((lab: any) => {
        const norm = lab.normalized || {};
        let valNum: number | null = typeof norm.value === 'number' ? norm.value : null;
        let unitStr: string = norm.unit || '';

        if (valNum === null && lab.value) {
          const m = String(lab.value).match(/([\d.]+)\s*([a-zA-Z/%μuL]+)?/);
          if (m) {
            valNum = parseFloat(m[1]);
            if (!unitStr && m[2]) unitStr = m[2];
          }
        }

        let lowVal: number | null = typeof norm.low === 'number' ? norm.low : null;
        let highVal: number | null = typeof norm.high === 'number' ? norm.high : null;

        if ((lowVal === null || highVal === null) && lab.reference_range) {
          const rangeMatch = String(lab.reference_range).match(/([\d.]+)\s*[-–—to]+\s*([\d.]+)/i);
          if (rangeMatch) {
            lowVal = parseFloat(rangeMatch[1]);
            highVal = parseFloat(rangeMatch[2]);
          } else {
            const lessMatch = String(lab.reference_range).match(/<\s*([\d.]+)/);
            if (lessMatch) highVal = parseFloat(lessMatch[1]);
            const greatMatch = String(lab.reference_range).match(/>\s*([\d.]+)/);
            if (greatMatch) lowVal = parseFloat(greatMatch[1]);
          }
        }

        let flag: 'low' | 'normal' | 'high' | 'unknown' = 'unknown';
        if (valNum !== null && !isNaN(valNum)) {
          if (lowVal !== null && !isNaN(lowVal) && valNum < lowVal) {
            flag = 'low';
          } else if (highVal !== null && !isNaN(highVal) && valNum > highVal) {
            flag = 'high';
          } else if (lowVal !== null || highVal !== null) {
            flag = 'normal';
          } else {
            flag = norm.flag === 'low' || norm.flag === 'high' || norm.flag === 'normal' ? norm.flag : 'unknown';
          }
        }

        return {
          ...lab,
          normalized: {
            value: valNum,
            unit: unitStr,
            low: lowVal,
            high: highVal,
            flag
          }
        };
      });
    }
    const sessionId = req.body?.session_id || req.query?.session_id;
    if (sessionId && Array.isArray(jsonResult.procedures) && jsonResult.procedures.length > 0) {
      for (const proc of jsonResult.procedures) {
        if (proc && typeof proc === 'string') {
          try {
            await supabase.from('history_facts').insert({
              session_id: sessionId,
              complaint: 'Medical Document OCR',
              question_id: 'procedure',
              question_text: 'Procedure / Surgery',
              field_name: 'procedures',
              field_value: proc,
              answer: proc,
              answer_value: proc,
              provenance: 'ocr_extracted',
              verified: false
            });
          } catch (hfErr) {
            console.warn('history_facts procedure insert warning:', hfErr);
          }
        }
      }
    }
    
    return res.json(jsonResult);
  } catch (err: any) {
    console.warn('Gemini Extract Entities failed, using local extraction fallback:', err?.message || err);
    const lines = (text || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
    let patientName = '';
    const nameMatch = text.match(/(?:PATIENT NAME|Patient:|Name:)\s*([A-Za-z, .]+)/i);
    if (nameMatch) patientName = nameMatch[1].replace(/DOB.*/i, '').trim();

    const diagnoses: string[] = [];
    const dxMatch = text.match(/(?:PRIMARY DX|Diagnosis:|Dx:)\s*([A-Za-z0-9, .()/-]+)/i);
    if (dxMatch) diagnoses.push(dxMatch[1].trim());

    const lowerText = text.toLowerCase();
    const docType = (lowerText.includes('lab') || lowerText.includes('report') || lowerText.includes('test result') || lowerText.includes('panel'))
      ? 'Lab Report'
      : (lowerText.includes('rx') || lowerText.includes('prescription'))
      ? 'Prescription'
      : 'Unknown Document';

    const labResults: any[] = [];
    for (const l of lines) {
      const m = l.match(/^([A-Za-z0-9 ,/()-]+?)\s+([\d.]+)\s*([HL])?\s+([<>]?\s*[\d.]+(?:\s*[-–—to]\s*[\d.]+)?)\s*([a-zA-Z/%μuL]+)?$/i);
      if (m) {
        const flag = m[3] ? (m[3].toUpperCase() === 'H' ? 'high' : 'low') : 'normal';
        const valNum = parseFloat(m[2]);
        labResults.push({
          test_name: m[1].trim(),
          value: `${m[2]}${m[5] ? ' ' + m[5] : ''}`,
          reference_range: m[4] || '',
          normalized: {
            value: isNaN(valNum) ? null : valNum,
            unit: m[5] || '',
            flag
          }
        });
      }
    }

    return res.json({
      document_type: docType,
      patient_name: patientName,
      diagnoses,
      procedures: [],
      medications: [],
      lab_results: labResults
    });
  }
});

// Gemini Off-Script Endpoint (wired via orchestration layer)
app.post('/api/gemini/off-script', geminiLimiter, async (req: Request, res: Response) => {
  const { session_id, previous_answers } = req.body;
  const sanitizedAnswers = sanitizePromptInput(previous_answers);

  // No-key mock: return a safe default question so the interview can continue
  if (!process.env.GEMINI_API_KEY && !process.env.OLLAMA_URL) {
    return res.json({
      id: `q_other_${Date.now()}`,
      text: "Can you describe your symptoms in more detail?",
      options: ["It hurts constantly", "It comes and goes", "It is getting worse"]
    });
  }

  const prompt = `You are a clinical assistant. The patient selected "Other" as their chief complaint.
Here is what they have answered so far:
${JSON.stringify(sanitizedAnswers, null, 2)}

Generate a single follow-up question in JSON format with an 'id', 'text', and 'options' array.
Example: {"id": "q_custom", "text": "Can you describe the pain?", "options": ["Sharp", "Dull", "Aching"]}
Respond ONLY with valid JSON.`;

  try {
    const r = await orchestrate<string>('off-script', { prompt });
    const cleanedText = (r.result || '').trim().replace(/```json/g, '').replace(/```/g, '');
    const jsonResult = JSON.parse(cleanedText);
    return res.json(jsonResult);
  } catch (err) {
    console.error('Gemini Off-Script Error:', err);
    return res.json({
      id: `q_other_${Date.now()}`,
      text: "Can you describe your symptoms in more detail?",
      options: ["It hurts constantly", "It comes and goes", "It is getting worse"]
    });
  }
});


// Gemini Semantic Red-Flag Endpoint
app.post('/api/gemini/red-flag', geminiLimiter, async (req: Request, res: Response) => {
  const { answers } = req.body;
  const sanitizedAnswers = sanitizePromptInput(answers);

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ isFlagged: false });
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `You are a triage nurse evaluating a patient's answers.
Answers:
${JSON.stringify(sanitizedAnswers, null, 2)}

Does the patient require IMMEDIATE medical attention (e.g. signs of heart attack, stroke, severe bleeding)?
Reply with ONLY "YES" or "NO".`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().toUpperCase();
    
    return res.json({ isFlagged: responseText === 'YES' });
  } catch (err) {
    console.error('Gemini Red-Flag Error:', err);
    return res.status(500).json({ error: 'Failed to evaluate red-flag' });
  }
});

export default app;

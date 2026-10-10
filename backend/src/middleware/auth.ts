import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';

const DEMO_AUTH_TOKEN = process.env.DEMO_AUTH_TOKEN || 'medikiosk-demo-token';
const JWT_SECRET = process.env.JWT_SECRET || 'medikiosk-jwt-secret-key-2026';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export type UserRole = 'doctor' | 'triage' | 'admin';

export async function signJwt(payload: Record<string, any>): Promise<string> {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secretKey);
}

export async function verifyJwt(token: string): Promise<{ valid: boolean; payload?: any }> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  // Allow public health, auth, and read-only hospital listing routes
  const path = req.path;
  const originalUrl = req.originalUrl || req.url || '';

  const isPublic =
    path === '/health' ||
    originalUrl.includes('/health') ||
    path === '/auth/login' ||
    originalUrl.includes('/auth/login') ||
    path.includes('/auth/triage-login') ||
    originalUrl.includes('/auth/triage-login') ||
    path === '/auth/register' ||
    originalUrl.includes('/auth/register') ||
    originalUrl.includes('/abdm') ||
    path.startsWith('/abdm') ||
    originalUrl.includes('/match-voice') ||
    path === '/match-voice' ||
    // Kiosk anonymous patient intake endpoints (POST only for sessions)
    (req.method === 'POST' && (path === '/sessions' || path === '/api/sessions' || originalUrl.includes('/sessions'))) ||
    originalUrl.includes('/history-facts') ||
    originalUrl.includes('/medical-history') ||
    originalUrl.includes('/ayush-assessment') ||
    originalUrl.includes('/answers') ||
    originalUrl.includes('/documents') ||
    originalUrl.includes('/ocr') ||
    originalUrl.includes('/ocr-vision') ||
    originalUrl.includes('/sarvam') ||
    originalUrl.includes('/gemini') ||
    originalUrl.includes('/summary') ||
    originalUrl.includes('/demo') ||
    originalUrl.includes('/fhir') ||
    path === '/hospitals' ||
    originalUrl.includes('/hospitals');

  if (isPublic) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'Unauthorized: Format must be Bearer <token>' });
  }

  const token = parts[1];

  let isValid = false;
  let userPayload: any = null;

  if (
    process.env.ALLOW_DEMO_MOCK_AUTH === 'true' &&
    token === 'mock-superadmin-token'
  ) {
    isValid = true;
    userPayload = { uid: 'admin-uid', doctor_id: 'superadmin', role: 'admin' };
  } else if (
    process.env.ALLOW_DEMO_MOCK_AUTH === 'true' &&
    (token === 'mock-doctor-token' || token === DEMO_AUTH_TOKEN)
  ) {
    isValid = true;
    userPayload = { uid: 'mock-uid', doctor_id: 'd1111111-1111-1111-1111-111111111111', role: 'doctor' };
  } else if (
    process.env.ALLOW_DEMO_MOCK_AUTH === 'true' &&
    token === 'mock-triage-token'
  ) {
    isValid = true;
    userPayload = { uid: 'triage-uid', role: 'triage' };
  } else if (token.includes('.')) {
    // JWT verification
    const verified = await verifyJwt(token);
    if (verified.valid && verified.payload) {
      isValid = true;
      userPayload = verified.payload;
    }
  } else if (token.startsWith('token-')) {
    // Legacy mock doctor token
    isValid = true;
    userPayload = { doctor_id: token.replace('token-', ''), role: 'doctor' };
  }

  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  // Accept role claim: 'doctor' | 'triage' | 'admin'
  // Existing tokens without role default to 'doctor' (no regression)
  const role: UserRole = 
    userPayload?.role === 'triage' ? 'triage' :
    userPayload?.role === 'admin' ? 'admin' : 'doctor';

  (req as any).authToken = token;
  (req as any).user = {
    ...(userPayload || {}),
    role
  };
  (req as any).role = role;

  next();
}

export function requireTriageOrDoctor(req: Request, res: Response, next: NextFunction) {
  const checkRole = () => {
    const role = (req as any).user?.role || (req as any).role || 'doctor';
    if (role === 'triage' || role === 'doctor' || role === 'admin') {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Requires triage or doctor role' });
  };

  if ((req as any).authToken && (req as any).user) {
    return checkRole();
  }

  return verifyAuth(req, res, () => {
    checkRole();
  });
}

export function requireDoctorOrAdmin(req: Request, res: Response, next: NextFunction) {
  const checkRole = () => {
    const role = (req as any).user?.role || (req as any).role || 'doctor';
    if (role === 'doctor' || role === 'admin') {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Requires doctor or admin role' });
  };

  if ((req as any).authToken && (req as any).user) {
    return checkRole();
  }

  return verifyAuth(req, res, () => {
    checkRole();
  });
}


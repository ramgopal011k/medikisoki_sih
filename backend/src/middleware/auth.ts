import { Request, Response, NextFunction } from 'express';


const DEMO_AUTH_TOKEN = process.env.DEMO_AUTH_TOKEN || 'medikiosk-demo-token';

export function verifyAuth(req: Request, res: Response, next: NextFunction) {
  // Allow public health, auth, and read-only hospital listing routes
  const path = req.path;
  const originalUrl = req.originalUrl || req.url || '';

  const isPublic =
    path === '/health' ||
    originalUrl.includes('/health') ||
    path === '/auth/login' ||
    originalUrl.includes('/auth/login') ||
    path === '/auth/register' ||
    originalUrl.includes('/auth/register') ||
    originalUrl.includes('/abdm') ||
    path.startsWith('/abdm') ||
    originalUrl.includes('/match-voice') ||
    path === '/match-voice' ||
    // ASR endpoints are intentionally public: kiosk patients are unauthenticated.
    // Audio is processed server-side (Sarvam / Gemini) and only the transcript is returned.
    // No patient PII is stored at the ASR layer.
    path === '/sarvam/asr' ||
    originalUrl.includes('/sarvam/asr') ||
    path === '/api/sarvam/asr' ||
    originalUrl.includes('/api/sarvam/asr') ||
    (req.method === 'GET' && (path === '/hospitals' || originalUrl.includes('/hospitals')));

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

  const ALLOWED_DEMO_TOKENS = [
    DEMO_AUTH_TOKEN,
    'mock-doctor-token',
    'mock-superadmin-token'
  ];

  let isValid = false;

  if (ALLOWED_DEMO_TOKENS.includes(token)) {
    isValid = true;
  } else {
    // TODO: Implement actual JWT verification for production
    // try {
    //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //   isValid = true;
    //   (req as any).user = decoded;
    // } catch (err) {
    //   isValid = false;
    // }
  }

  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  (req as any).authToken = token;
  next();
}

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const SESSION_COOKIE_NAME = 'sadc_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// Ephemeral fallback secret per server boot when SESSION_SECRET env is unset
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : EPHEMERAL_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export interface AdminSessionPayload {
  userId: number;
  email: string;
  name: string;
  role: string;
  exp: number;
}

export function signSessionToken(payload: Omit<AdminSessionPayload, 'exp'>): string {
  const fullPayload: AdminSessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): AdminSessionPayload | null {
  if (!token) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminSessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isHttpsRequest(req?: Request): boolean {
  if (!req) {
    return process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true';
  }
  const forwardedProto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return Boolean(req.secure || forwardedProto === 'https');
}

export function setAdminSessionCookie(res: Response, token: string, req?: Request): void {
  const isHttps = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearAdminSessionCookie(res: Response, req?: Request): void {
  const isHttps = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

export function getAdminFromRequest(req: Request): AdminSessionPayload | null {
  const authHeader = String(req.headers?.authorization || '');
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const bearerSession = verifySessionToken(bearerToken);
    if (bearerSession) return bearerSession;
  }

  const cookieToken = (req.cookies as Record<string, string | undefined> | undefined)?.[
    SESSION_COOKIE_NAME
  ];
  return verifySessionToken(cookieToken);
}

export interface AdminRequest extends Request {
  admin?: AdminSessionPayload;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const session = getAdminFromRequest(req);
  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'Authentication required to access administrator resources.' });
    return;
  }
  req.admin = session;
  next();
}

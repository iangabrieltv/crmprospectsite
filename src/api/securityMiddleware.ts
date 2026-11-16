import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email?: string;
  };
}

export type TokenVerifier = (token: string) => Promise<{
  uid: string;
  email?: string;
}>;

export interface CreateFirebaseAuthMiddlewareOptions {
  verifyToken?: TokenVerifier;
  projectId?: string;
  authorizedAdminUid?: string;
  authorizedAdminEmail?: string;
}

const FORBIDDEN_UID_PLACEHOLDERS = new Set([
  '',
  'REPLACE_WITH_YOUR_FIREBASE_UID',
  'YOUR_FIREBASE_UID',
  'UNDEFINED',
  'NULL',
]);

export function isValidAdminUidConfig(uid: unknown): uid is string {
  if (typeof uid !== 'string') return false;
  const trimmed = uid.trim();
  if (FORBIDDEN_UID_PLACEHOLDERS.has(trimmed.toUpperCase())) return false;
  if (trimmed.length < 6 || trimmed.length > 128) return false;
  return /^[a-zA-Z0-9:_\-]+$/.test(trimmed);
}

export function resolveFirebaseProjectId(): string {
  if (typeof process.env.FIREBASE_PROJECT_ID === 'string') {
    const fromEnv = process.env.FIREBASE_PROJECT_ID.trim();
    if (fromEnv) return fromEnv;
    // Explicitly set to empty string disables config fallback for strict env control
    if (process.env.FIREBASE_PROJECT_ID === '') {
      // Only fall back if FIREBASE_PROJECT_ID wasn't explicitly defined
    }
  }
  if (process.env.FIREBASE_PROJECT_ID !== undefined) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
      return parsed.projectId.trim();
    }
  } catch {
    // Fallback handled below
  }
  return '';
}

export async function verifyFirebaseTokenDefault(token: string): Promise<{
  uid: string;
  email?: string;
}> {
  const projectId = resolveFirebaseProjectId();
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID_MISSING');
  }

  const adminApp = !getApps().length ? initializeApp({ projectId }) : getApp();
  const decoded = await getAuth(adminApp).verifyIdToken(token, true);
  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}

export function createFirebaseAuthMiddleware(
  verifyTokenOrOptions?: TokenVerifier | CreateFirebaseAuthMiddlewareOptions
) {
  const options: CreateFirebaseAuthMiddlewareOptions =
    typeof verifyTokenOrOptions === 'function'
      ? { verifyToken: verifyTokenOrOptions }
      : verifyTokenOrOptions || {};

  const verifyToken = options.verifyToken || verifyFirebaseTokenDefault;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const configuredProjectId = (
      options.projectId !== undefined ? options.projectId : resolveFirebaseProjectId()
    ).trim();

    if (!configuredProjectId) {
      res.status(503).json({
        error:
          'Acesso negado: FIREBASE_PROJECT_ID não configurado no servidor.',
      });
      return;
    }

    const rawAllowedUid =
      options.authorizedAdminUid !== undefined
        ? options.authorizedAdminUid
        : process.env.AUTHORIZED_ADMIN_UID || '';
    const allowedUid = rawAllowedUid.trim();

    // Fail-closed: NEVER allow access if AUTHORIZED_ADMIN_UID is absent, empty, or placeholder.
    // E-mail alone can NEVER replace UID authorization.
    if (!isValidAdminUidConfig(allowedUid)) {
      res.status(403).json({
        error:
          'Acesso negado: AUTHORIZED_ADMIN_UID obrigatório não está configurado corretamente no servidor.',
      });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Autenticação obrigatória. Token Firebase ausente.',
      });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token || token.length > 4096) {
      res.status(401).json({
        error: 'Token de autenticação inválido.',
      });
      return;
    }

    try {
      const verified = await verifyToken(token);
      if (!verified?.uid) {
        res.status(401).json({ error: 'Token sem identificador de usuário válido.' });
        return;
      }

      if (verified.uid !== allowedUid) {
        res.status(403).json({
          error: 'Acesso negado: UID não autorizado para esta API privada.',
        });
        return;
      }

      const rawAllowedEmail =
        options.authorizedAdminEmail !== undefined
          ? options.authorizedAdminEmail
          : process.env.AUTHORIZED_ADMIN_EMAIL || '';
      const allowedEmail = rawAllowedEmail.trim().toLowerCase();

      if (allowedEmail && (verified.email || '').toLowerCase() !== allowedEmail) {
        res.status(403).json({
          error: 'Acesso negado: e-mail não autorizado para esta API privada.',
        });
        return;
      }

      req.authUser = {
        uid: verified.uid,
        email: verified.email,
      };
      next();
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : err instanceof Error
          ? err.message
          : 'TOKEN_VERIFY_ERROR';

      const isExpired =
        code.toLowerCase().includes('expired') ||
        code.includes('auth/id-token-expired');

      console.error(`[API Auth] Falha na verificação do token (${req.path}): ${code}`);
      res.status(401).json({
        error: isExpired
          ? 'Token Firebase expirado. Faça login novamente.'
          : 'Sessão inválida ou expirada. Faça login novamente.',
      });
    }
  };
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const middleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = req.authUser?.uid || req.ip || 'unknown';
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (current.count >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Limite de requisições excedido. Tente novamente em ${retryAfterSec}s.`,
      });
      return;
    }

    current.count += 1;
    next();
  };

  middleware.reset = () => {
    buckets.clear();
  };

  return middleware;
}

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

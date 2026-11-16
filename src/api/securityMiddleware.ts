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

function resolveFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId) return parsed.projectId;
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
  const decoded = await getAuth(adminApp).verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}

export function createFirebaseAuthMiddleware(
  verifyToken: TokenVerifier = verifyFirebaseTokenDefault
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

      const allowedUid = (process.env.AUTHORIZED_ADMIN_UID || '').trim();
      if (allowedUid && verified.uid !== allowedUid) {
        res.status(403).json({
          error: 'Acesso negado: conta não autorizada para esta API privada.',
        });
        return;
      }

      const allowedEmail = (process.env.AUTHORIZED_ADMIN_EMAIL || '').trim().toLowerCase();
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
      const code = err instanceof Error ? err.message : 'TOKEN_VERIFY_ERROR';
      console.error(`[API Auth] Falha na verificação do token (${req.path}): ${code}`);
      res.status(401).json({
        error: 'Sessão inválida ou expirada. Faça login novamente.',
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

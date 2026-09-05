import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../shared/prisma.js';
import { COOKIE_NAME, hashToken } from '../shared/crypto.js';
import { Errors } from '../shared/errors.js';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  status: string;
  displayName: string;
  mustChangePassword: boolean;
  version: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

export async function auth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = (req as any).cookies?.[COOKIE_NAME] as string | undefined;
    if (!token) throw Errors.unauthorized();
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw Errors.unauthorized();
    }
    const account = await prisma.account.findUnique({ where: { id: session.accountId } });
    if (!account || account.deletedAt) throw Errors.unauthorized();
    if (account.status !== 'ACTIVE') {
      throw Errors.forbidden(
        'ACCOUNT_DISABLED',
        'Tài khoản đã bị vô hiệu hóa',
      );
    }
    (req as any).user = {
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      displayName: account.displayName,
      mustChangePassword: account.mustChangePassword,
      version: account.version,
    } as AuthUser;
    (req as any).sessionId = session.id;
    next();
  } catch (e) {
    next(e);
  }
}

// Optional auth: populate req.user if cookie present, else continue
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = (req as any).cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) return next();
  try {
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return next();
    const account = await prisma.account.findUnique({ where: { id: session.accountId } });
    if (!account || account.deletedAt || account.status !== 'ACTIVE') return next();
    (req as any).user = {
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      displayName: account.displayName,
      mustChangePassword: account.mustChangePassword,
      version: account.version,
    };
    (req as any).sessionId = session.id;
  } catch {}
  next();
}

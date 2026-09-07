import type { Request, Response, NextFunction } from 'express';
import type { Account } from '@prisma/client';
import { z } from 'zod';
import * as authService from './auth.service.js';
import type { AuthUserDto } from './auth.service.js';
import { Errors } from '../../shared/errors.js';
import {
  COOKIE_NAME,
  sessionCookieOptions,
  clearCookieOptions,
} from '../../shared/crypto.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function toUserDto(account: Account): AuthUserDto {
  return authService.toUserDto(account);
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation failed');
    }
    const { email, password } = parsed.data;
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.headers['user-agent'] as string | undefined;

    const { account, token } = await authService.authenticate(
      email,
      password,
      ipAddress,
      userAgent,
    );

    res.cookie(COOKIE_NAME, token, sessionCookieOptions());
    res.status(201).json({ user: toUserDto(account) });
  } catch (e) {
    next(e);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    await authService.revokeCurrentSession(token);
    res.clearCookie(COOKIE_NAME, clearCookieOptions());
    // Also set cookie with clear options to ensure removal
    res.cookie(COOKIE_NAME, '', clearCookieOptions());
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) throw Errors.unauthorized();

    const profile = await authService.getAccountProfile(user.id);
    res.json({ user: profile });
  } catch (e) {
    next(e);
  }
}

export { toUserDto };

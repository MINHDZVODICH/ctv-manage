import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as usersService from './users.service.js';
import { Errors } from '../../shared/errors.js';

function toUserDto(account: any) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    phone: account.phone,
    role: account.role,
    status: account.status,
    version: account.version,
    mustChangePassword: account.mustChangePassword,
    ctvCode: account.ctvCode,
    dateOfBirth: account.dateOfBirth,
    gender: account.gender,
    address: account.address,
    adminNotes: account.adminNotes,
    joinedAt: account.joinedAt,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
  };
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user) throw Errors.unauthorized();
    const account = await usersService.getMyProfile(user.id);
    res.json({ user: toUserDto(account) });
  } catch (e) {
    next(e);
  }
}

const patchMeSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  expectedVersion: z.number().int().optional(),
});

export async function patchMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user) throw Errors.unauthorized();

    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
      throw Errors.badRequest('VALIDATION_ERROR', msg);
    }

    const updated = await usersService.updateMyProfile(user.id, parsed.data);
    res.json({ user: toUserDto(updated) });
  } catch (e) {
    next(e);
  }
}

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function postPasswordChange(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as any).user;
    if (!user) throw Errors.unauthorized();

    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
      throw Errors.badRequest('VALIDATION_ERROR', msg);
    }

    const sessionId = (req as any).sessionId as string | undefined;
    await usersService.changePassword(
      user.id,
      sessionId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as accountsService from './accounts.service.js';

// ---------------------------------------------------------------------------
// zod schemas
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

const patchBodySchema = z.object({
  displayName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  expectedVersion: z.number().int().optional(),
});

const patchNotesBodySchema = z.object({
  adminNotes: z.string().nullable(),
  expectedVersion: z.number().int().optional(),
});

const patchStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
  expectedVersion: z.number().int().optional(),
});

const passwordResetBodySchema = z.object({
  newPassword: z.string().min(8),
  mustChangePassword: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await accountsService.listAccounts({
      q: query.q,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 5;
    res.json({ data: result.data, total: result.total, page, pageSize });
  } catch (e) {
    next(e);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const account = await accountsService.getAccount(id);
    res.json({ data: account });
  } catch (e) {
    next(e);
  }
}

export async function patch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = patchBodySchema.parse(req.body);
    const result = await accountsService.updateAccount(id, {
      displayName: body.displayName,
      phone: body.phone,
      dateOfBirth: body.dateOfBirth as any,
      gender: body.gender,
      address: body.address,
      expectedVersion: body.expectedVersion,
    });
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function patchNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = patchNotesBodySchema.parse(req.body);
    const result = await accountsService.updateNotes(id, body.adminNotes, body.expectedVersion);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function patchStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = patchStatusBodySchema.parse(req.body);
    const result = await accountsService.changeStatus(id, body.status, body.expectedVersion);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function del(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await accountsService.softDelete(id);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function postPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = passwordResetBodySchema.parse(req.body);
    const result = await accountsService.resetPassword(id, body.newPassword, body.mustChangePassword);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

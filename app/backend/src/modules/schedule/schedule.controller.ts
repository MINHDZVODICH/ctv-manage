import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from './schedule.service.js';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const roomCodeEnum = z.enum(['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4']);
const periodEnum = z.enum(['MORNING', 'AFTERNOON']);

const putRegistrationSchema = z.object({
  roomCode: roomCodeEnum,
  slots: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(5),
        period: periodEnum,
      }),
    )
    .min(1),
  expectedVersion: z.number().int().optional(),
});

const getShiftsQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  })
  .refine(
    (d) => !(d.month && (d.from || d.to)),
    { message: 'Use either month or from/to, not both', path: ['month'] },
  );

const deleteSeriesQuerySchema = z.object({
  weekday: z.coerce.number().int().min(1).max(5),
  period: periodEnum,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const summaryQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine(
    (d) => !!(d.month || (d.from && d.to)),
    { message: 'Provide either month or from+to', path: ['month'] },
  )
  .refine(
    (d) => !(d.month && (d.from || d.to)),
    { message: 'Use either month or from/to, not both', path: ['month'] },
  );

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function getMyRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const reg = await service.getMyRegistration(user.id);
    if (!reg) {
      res.json({ data: null });
      return;
    }
    res.json({
      data: {
        id: reg.id,
        accountId: reg.accountId,
        startDate: (reg.startDate as Date).toISOString().slice(0, 10),
        endDate: (reg.endDate as Date).toISOString().slice(0, 10),
        timeZone: reg.timeZone,
        roomCode: reg.roomCode,
        version: reg.version,
        status: reg.status,
        patternSlots: reg.patternSlots,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function putMyRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const parsed = putRegistrationSchema.parse(req.body);
    const result = await service.upsertRegistration(user.id, {
      roomCode: parsed.roomCode,
      slots: parsed.slots,
      expectedVersion: parsed.expectedVersion,
    });
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function getMyShifts(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const q = getShiftsQuerySchema.parse(req.query);
    const data = await service.listMyShifts(user.id, q);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function getShiftById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const { shiftId } = req.params;
    const isAdmin = user.role === 'ADMIN';
    const result = await service.getShiftForUser(shiftId, user.id, isAdmin);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function deleteAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const { assignmentId } = req.params;
    const result = await service.cancelOne(user.id, assignmentId);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function deleteSeries(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const { registrationId } = req.params;
    const q = deleteSeriesQuerySchema.parse(req.query);
    const result = await service.cancelSeries(user.id, registrationId, q);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const q = summaryQuerySchema.parse(req.query);
    const data = await service.getScheduleSummary(q as any);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

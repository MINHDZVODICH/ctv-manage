import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from './schedule.service.js';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const roomCodeEnum = z.enum(['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4']);
const periodEnum = z.enum(['MORNING', 'AFTERNOON']);

const putScheduleSchema = z.object({
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

const workHistoryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  accountId: z.string().min(1).optional(),
});

const getShiftsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function getMySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const data = await service.getMySchedule(user.id);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export const getMyRegistration = getMySchedule;

export async function putMySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const parsed = putScheduleSchema.parse(req.body);
    const data = await service.upsertSchedule(user.id, parsed);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export const putMyRegistration = putMySchedule;

export async function getAccountSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = req.params.id || req.params.accountId;
    const data = await service.getAccountSchedule(accountId);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

const summaryQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    accountId: z.string().min(1).optional(),
  })
  .refine(
    (d) => !(d.month && (d.from || d.to)),
    { message: 'Use either month or from/to, not both', path: ['month'] },
  )
  .refine(
    (d) => {
      if (d.from && d.to) {
        return d.from <= d.to;
      }
      return true;
    },
    { message: 'from must be <= to', path: ['from'] },
  );

export async function getWeeklySummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getWeeklySummary();
    res.json({ data: result, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    summaryQuerySchema.parse(req.query);
    const result = await service.getWeeklySummary();
    res.json({ data: result, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getMyWorkHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const q = workHistoryQuerySchema.pick({ month: true }).parse(req.query);
    const result = await service.getWorkHistory({ month: q.month, accountId: user.id });
    res.json({ data: result, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getWorkHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const q = workHistoryQuerySchema.parse(req.query);
    const result = await service.getWorkHistory(q);
    res.json({ data: result, ...result });
  } catch (e) {
    next(e);
  }
}

// ---------------------------------------------------------------------------
// Legacy routes support
// ---------------------------------------------------------------------------

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
    const result = await service.cancelSeries(user.id, registrationId, req.query as any);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

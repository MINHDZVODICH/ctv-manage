import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Errors } from '../../shared/errors.js';
import * as service from './schedule.service.js';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const roomCodeEnum = z.enum(['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4']);
const periodEnum = z.enum(['MORNING', 'AFTERNOON']);

const putScheduleSchema = z.object({
  roomCode: roomCodeEnum,
  slots: z.array(
    z.object({
      weekday: z.number().int().min(1).max(5),
      period: periodEnum,
    }),
  ),
  expectedVersion: z.number().int().optional(),
});

const workHistoryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  accountId: z.string().min(1).optional(),
});

function assertNoScheduleDateParams(query: Record<string, any>) {
  if (query.month !== undefined || query.from !== undefined || query.to !== undefined) {
    throw Errors.badRequest(
      'INVALID_SCHEDULE_QUERY',
      'Weekly schedule endpoints do not accept date parameters (month/from/to). Query /api/v1/work-history for dated occurrences.',
    );
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function getMySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    assertNoScheduleDateParams(req.query);
    const user = req.user!;
    const data = await service.getMySchedule(user.id);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export const getMyRegistration = getMySchedule;

export async function putMySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
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
    assertNoScheduleDateParams(req.query);
    const accountId = req.params.id || req.params.accountId;
    const data = await service.getAccountSchedule(accountId);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function getWeeklySummary(req: Request, res: Response, next: NextFunction) {
  try {
    assertNoScheduleDateParams(req.query);
    const result = await service.getWeeklySummary();
    res.json({ data: result, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    assertNoScheduleDateParams(req.query);
    const result = await service.getWeeklySummary();
    res.json({ data: result, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getMyWorkHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const q = workHistoryQuerySchema.pick({ month: true }).parse(req.query);
    const result = await service.getMyWorkHistory(user.id, q.month);
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
    assertNoScheduleDateParams(req.query);
    const user = req.user!;
    const data = await service.listMyShifts(user.id);
    res.json({ data });
  } catch (e) {
    next(e);
  }
}

export async function getShiftById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { shiftId } = req.params;
    const isAdmin = user.role === 'ADMIN';
    const result = await service.getShiftForUser(shiftId, user.id, isAdmin);
    res.json({ data: result });
  } catch (e) {
    next(e);
  }
}

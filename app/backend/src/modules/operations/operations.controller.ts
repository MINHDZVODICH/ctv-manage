import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import { standardizeSnapshotErrorCode } from '../schedule/snapshot-coordinator.service.js';
import {
  todayInBangkok,
  addDays,
  parseYmdToUtcDate,
  formatUtcDateToYmd,
} from '../../shared/timezone.js';

export interface SnapshotRunResponseDto {
  id: string;
  workDate: string;
  status: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  insertedCount: number;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidYmd(val: string): boolean {
  if (!DATE_REGEX.test(val)) return false;
  const d = parseYmdToUtcDate(val);
  return !isNaN(d.getTime()) && formatUtcDateToYmd(d) === val;
}

export async function listSnapshotRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const rawTo = req.query.to as string | undefined;
    const rawFrom = req.query.from as string | undefined;

    const toStr = rawTo ?? todayInBangkok();
    const fromStr = rawFrom ?? addDays(toStr, -29);

    if (rawFrom !== undefined && !isValidYmd(rawFrom)) {
      throw Errors.badRequest('INVALID_DATE_FORMAT', 'from must be in YYYY-MM-DD format');
    }
    if (rawTo !== undefined && !isValidYmd(rawTo)) {
      throw Errors.badRequest('INVALID_DATE_FORMAT', 'to must be in YYYY-MM-DD format');
    }

    const fromDate = parseYmdToUtcDate(fromStr);
    const toDate = parseYmdToUtcDate(toStr);

    if (fromDate.getTime() > toDate.getTime()) {
      throw Errors.badRequest('INVALID_DATE_RANGE', 'from must be before or equal to to');
    }

    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 3600 * 1000));
    const totalDays = diffDays + 1;
    if (totalDays > 90) {
      throw Errors.badRequest('DATE_RANGE_EXCEEDED', 'Date range cannot exceed 90 days');
    }

    const runs = await prisma.snapshotRun.findMany({
      where: {
        workDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: {
        workDate: 'asc',
      },
    });

    const response: SnapshotRunResponseDto[] = runs.map((run) => ({
      id: run.id,
      workDate: formatUtcDateToYmd(run.workDate),
      status: run.status,
      attemptCount: run.attemptCount,
      nextAttemptAt: run.nextAttemptAt ? run.nextAttemptAt.toISOString() : null,
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      insertedCount: run.insertedCount,
      errorCode: run.errorCode ? standardizeSnapshotErrorCode(run.errorCode) : null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    }));

    res.json(response);
  } catch (err) {
    next(err);
  }
}

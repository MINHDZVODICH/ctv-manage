import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

export * from './schedule.types.js';
export {
  upsertSchedule,
  upsertRegistration,
  type ScheduleDto,
} from './schedule.command.service.js';
export {
  getMySchedule,
  getMyRegistration,
  getAccountSchedule,
  getWeeklySummary,
  getScheduleSummary,
  listMyShifts,
  getShiftForUser,
} from './schedule.query.service.js';
import { monthRangeToUtcDates } from './schedule.types.js';

export {
  todayInBangkok,
  addDays,
  parseYmdToUtcDate,
  formatUtcDateToYmd,
  weekdayUtc,
} from '../../shared/timezone.js';
import {
  parseYmdToUtcDate,
  formatUtcDateToYmd,
} from '../../shared/timezone.js';

// ---------------------------------------------------------------------------
// snapshotTodayWorkHistory (17:30 Asia/Bangkok snapshot cutoff)
// ---------------------------------------------------------------------------

export async function snapshotTodayWorkHistory(now = new Date()): Promise<{
  processedCount: number;
  skipped?: boolean;
  reason?: string;
}> {
  // Asia/Bangkok is UTC+7 (no DST)
  const bkkMs = now.getTime() + 7 * 3600 * 1000;
  const bkkDate = new Date(bkkMs);
  const y = bkkDate.getUTCFullYear();
  const m = bkkDate.getUTCMonth();
  const d = bkkDate.getUTCDate();
  const hours = bkkDate.getUTCHours();
  const minutes = bkkDate.getUTCMinutes();
  const jsDay = bkkDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // If before 17:30 Bangkok time, do nothing
  if (hours < 17 || (hours === 17 && minutes < 30)) {
    return { processedCount: 0, skipped: true, reason: 'BEFORE_CUTOFF' };
  }

  // If weekend (Sunday = 0, Saturday = 6), do nothing
  if (jsDay === 0 || jsDay === 6) {
    return { processedCount: 0, skipped: true, reason: 'WEEKEND' };
  }

  // Only snapshot today (Monday-Friday: jsDay 1..5)
  const todayYmd = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayUtc = parseYmdToUtcDate(todayYmd);

  const activeCtvs = await prisma.account.findMany({
    where: {
      role: 'CTV',
      status: 'ACTIVE',
      deletedAt: null,
      schedule: { isNot: null },
    },
    include: {
      schedule: {
        include: {
          shifts: true,
        },
      },
    },
  });

  const historyEntries: Array<{
    accountId: string;
    workDate: Date;
    period: string;
    roomCode: string;
    status: string;
  }> = [];

  for (const ctv of activeCtvs) {
    if (!ctv.schedule) continue;
    const matchingShifts = ctv.schedule.shifts.filter((s) => s.weekday === jsDay);
    for (const shift of matchingShifts) {
      historyEntries.push({
        accountId: ctv.id,
        workDate: todayUtc,
        period: shift.period,
        roomCode: ctv.schedule.roomCode,
        status: 'COMPLETED',
      });
    }
  }

  if (historyEntries.length === 0) {
    return { processedCount: 0 };
  }

  const result = await prisma.history.createMany({
    data: historyEntries,
    skipDuplicates: true,
  });

  return { processedCount: result.count };
}

// ---------------------------------------------------------------------------
// getWorkHistory & getMyWorkHistory
// ---------------------------------------------------------------------------

export async function getMyWorkHistory(accountId: string, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
  }

  const range = monthRangeToUtcDates(month);
  const rows = await prisma.history.findMany({
    where: {
      accountId,
      workDate: { gte: range.from, lte: range.to },
    },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }],
  });

  const entries = rows.map((row) => ({
    id: row.id,
    workDate: formatUtcDateToYmd(row.workDate),
    period: row.period,
    roomCode: row.roomCode,
  }));

  return { month, entries };
}

export async function getWorkHistory(params: { month: string; accountId?: string }) {
  if (!/^\d{4}-\d{2}$/.test(params.month)) {
    throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
  }

  const range = monthRangeToUtcDates(params.month);
  const rows = await prisma.history.findMany({
    where: {
      workDate: { gte: range.from, lte: range.to },
      ...(params.accountId ? { accountId: params.accountId } : {}),
    },
    include: { account: true },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }, { accountId: 'asc' }],
  });

  const entries = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    workDate: formatUtcDateToYmd(row.workDate),
    period: row.period,
    roomCode: row.roomCode,
    status: row.status,
  }));

  const grouped = new Map<
    string,
    {
      shiftId: string;
      workDate: string;
      period: string;
      count: number;
      shiftAssignments: Array<{
        id: string;
        accountId: string;
        displayName: string;
        phone: string | null;
        roomCode: string;
        status: string;
      }>;
    }
  >();

  for (const row of rows) {
    const workDate = formatUtcDateToYmd(row.workDate);
    const key = `${workDate}:${row.period}`;
    let cell = grouped.get(key);
    if (!cell) {
      cell = {
        shiftId: `history-${workDate}-${row.period}`,
        workDate,
        period: row.period,
        count: 0,
        shiftAssignments: [],
      };
      grouped.set(key, cell);
    }

    cell.shiftAssignments.push({
      id: row.id,
      accountId: row.accountId,
      displayName: row.account.displayName,
      phone: row.account.phone ?? null,
      roomCode: row.roomCode,
      status: row.status,
    });
    cell.count = cell.shiftAssignments.length;
  }

  return { month: params.month, entries, cells: [...grouped.values()] };
}


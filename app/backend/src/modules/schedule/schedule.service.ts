import { prisma } from '../../shared/prisma.js';
import type { Schedule } from '@prisma/client';
import { Errors } from '../../shared/errors.js';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

export * from './schedule.types.js';
import {
  type UpsertScheduleInput,
  validateScheduleInput,
  dedupeSlots,
  monthRangeToUtcDates,
} from './schedule.types.js';

export {
  todayInBangkok,
  addDays,
  parseYmdToUtcDate,
  formatUtcDateToYmd,
  weekdayUtc,
} from '../../shared/timezone.js';
import {
  todayInBangkok,
  addDays,
  parseYmdToUtcDate,
  formatUtcDateToYmd,
  weekdayUtc,
} from '../../shared/timezone.js';

// ---------------------------------------------------------------------------
// getMySchedule / getAccountSchedule
// ---------------------------------------------------------------------------

export async function getMySchedule(accountId: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { accountId },
    include: {
      shifts: {
        orderBy: [{ weekday: 'asc' }, { period: 'asc' }],
      },
    },
  });

  if (!schedule) return null;

  const formattedShifts = schedule.shifts.map((s) => ({
    weekday: s.weekday,
    period: s.period,
  }));

  return {
    id: schedule.id,
    accountId: schedule.accountId,
    roomCode: schedule.roomCode,
    version: schedule.version,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    patternSlots: formattedShifts,
    shifts: formattedShifts,
  };
}

export const getMyRegistration = getMySchedule;

export async function getAccountSchedule(accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, deletedAt: null },
  });
  if (!account) {
    throw Errors.notFound('Không tìm thấy tài khoản');
  }

  const schedule = await prisma.schedule.findUnique({
    where: { accountId },
    include: {
      shifts: {
        orderBy: [{ weekday: 'asc' }, { period: 'asc' }],
      },
    },
  });

  if (!schedule) return null;

  const formattedShifts = schedule.shifts.map((s) => ({
    weekday: s.weekday,
    period: s.period,
  }));

  return {
    id: schedule.id,
    accountId: schedule.accountId,
    roomCode: schedule.roomCode,
    version: schedule.version,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    patternSlots: formattedShifts,
    shifts: formattedShifts,
  };
}

// ---------------------------------------------------------------------------
// upsertSchedule
// ---------------------------------------------------------------------------

export async function upsertSchedule(accountId: string, input: UpsertScheduleInput) {
  validateScheduleInput(input);
  const slots = dedupeSlots(input.slots);

  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`;

    const existing = await tx.schedule.findUnique({
      where: { accountId },
      include: { shifts: true },
    });

    let scheduleRecord: Schedule;

    if (existing) {
      if (input.expectedVersion === undefined) {
        throw Errors.conflict(
          'VERSION_CONFLICT',
          'Lịch làm việc đã tồn tại. Vui lòng tải lại trước khi cập nhật.',
        );
      }
      if (existing.version !== input.expectedVersion) {
        throw Errors.conflict(
          'VERSION_CONFLICT',
          'Lịch làm việc đã được cập nhật ở phiên khác. Vui lòng tải lại.',
        );
      }

      scheduleRecord = await tx.schedule.update({
        where: { id: existing.id },
        data: {
          roomCode: input.roomCode,
          version: { increment: 1 },
        },
      });

      await tx.shift.deleteMany({
        where: { scheduleId: existing.id },
      });

      if (slots.length > 0) {
        await tx.shift.createMany({
          data: slots.map((s) => ({
            scheduleId: existing.id,
            weekday: s.weekday,
            period: s.period,
          })),
        });
      }
    } else {
      if (input.expectedVersion !== undefined) {
        throw Errors.conflict(
          'VERSION_CONFLICT',
          'Lịch làm việc hiện hành không còn tồn tại. Vui lòng tải lại.',
        );
      }

      scheduleRecord = await tx.schedule.create({
        data: {
          accountId,
          roomCode: input.roomCode,
          version: 1,
          shifts: slots.length > 0 ? {
            create: slots.map((s) => ({
              weekday: s.weekday,
              period: s.period,
            })),
          } : undefined,
        },
      });
    }

    return {
      id: scheduleRecord.id,
      accountId: scheduleRecord.accountId,
      roomCode: scheduleRecord.roomCode,
      version: scheduleRecord.version,
      createdAt: scheduleRecord.createdAt,
      updatedAt: scheduleRecord.updatedAt,
      patternSlots: slots,
      shifts: slots,
    };
  });
}

export const upsertRegistration = upsertSchedule;


// ---------------------------------------------------------------------------
// Weekly Summary
// ---------------------------------------------------------------------------

export async function getWeeklySummary() {
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
          shifts: {
            orderBy: [{ weekday: 'asc' }, { period: 'asc' }],
          },
        },
      },
    },
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
  });

  const cells: Array<{
    shiftId?: string;
    weekday: number;
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
  }> = [];

  for (let wd = 1; wd <= 5; wd++) {
    for (const p of ['MORNING', 'AFTERNOON']) {
      const assignments: Array<{
        id: string;
        accountId: string;
        displayName: string;
        phone: string | null;
        roomCode: string;
        status: string;
      }> = [];

      for (const ctv of activeCtvs) {
        if (!ctv.schedule) continue;
        const hasShift = ctv.schedule.shifts.some(
          (s) => s.weekday === wd && s.period === p,
        );
        if (hasShift) {
          assignments.push({
            id: `${ctv.id}-${wd}-${p}`,
            accountId: ctv.id,
            displayName: ctv.displayName,
            phone: ctv.phone ?? null,
            roomCode: ctv.schedule.roomCode,
            status: 'ACTIVE',
          });
        }
      }

      cells.push({
        shiftId: `weekly-${wd}-${p}`,
        weekday: wd,
        period: p,
        count: assignments.length,
        shiftAssignments: assignments,
      });
    }
  }

  return { cells };
}

export async function getScheduleSummary(_params?: { month?: string }) {
  return await getWeeklySummary();
}

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Backward-compatible stubs for legacy routes if needed
// ---------------------------------------------------------------------------

export async function listMyShifts(
  accountId: string,
  _params?: { month?: string; from?: string; to?: string },
) {
  const schedule = await getMySchedule(accountId);
  if (!schedule) return [];
  return schedule.shifts.map((s, idx) => ({
    id: `shift-${s.weekday}-${s.period}-${idx}`,
    shiftId: `weekly-${s.weekday}-${s.period}`,
    registrationId: schedule.id,
    roomCode: schedule.roomCode,
    status: 'ACTIVE',
    workDate: todayInBangkok(),
    weekday: s.weekday,
    period: s.period,
  }));
}

export async function getShiftForUser(shiftId: string, accountId: string, isAdmin: boolean) {
  const parts = shiftId.split('-');
  const wd = Number(parts[1]);
  const p = parts[2];

  if (!isAdmin) {
    const userSchedule = await prisma.schedule.findUnique({
      where: { accountId },
      include: { shifts: true },
    });
    const hasShift = userSchedule?.shifts.some((s) => s.weekday === wd && s.period === p);
    if (!hasShift) {
      throw Errors.forbidden();
    }
  }

  const activeCtvsWithShift = await prisma.account.findMany({
    where: {
      role: 'CTV',
      status: 'ACTIVE',
      deletedAt: null,
      schedule: {
        shifts: {
          some: { weekday: wd, period: p },
        },
      },
    },
    include: { schedule: true },
  });

  const assignments = activeCtvsWithShift.map((acc) => ({
    id: `${acc.id}-${wd}-${p}`,
    accountId: acc.id,
    displayName: acc.displayName,
    phone: acc.phone ?? null,
    roomCode: acc.schedule?.roomCode ?? 'ROOM_1',
    status: 'ACTIVE',
  }));

  return { id: shiftId, shiftId, assignments };
}

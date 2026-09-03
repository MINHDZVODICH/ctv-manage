import { prisma } from '../../shared/prisma.js';
import { AppError, Errors } from '../../shared/errors.js';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

export const ROOM_CODES = ['ROOM_1', 'ROOM_2', 'ROOM_3', 'ROOM_4'] as const;
export type RoomCode = typeof ROOM_CODES[number];

export const PERIODS = ['MORNING', 'AFTERNOON'] as const;
export type Period = typeof PERIODS[number];

export function todayInBangkok(): string {
  // Asia/Bangkok is UTC+7 without DST; use Intl to be correct regardless of host tz
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

export function addDays(ymd: string, days: number): string {
  const d = parseYmdToUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDateToYmd(d);
}

export function parseYmdToUtcDate(ymd: string): Date {
  // Stored as UTC midnight so comparisons are stable regardless of server tz
  return new Date(ymd + 'T00:00:00.000Z');
}

export function formatUtcDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekdayUtc(d: Date): number {
  // Monday=1 .. Sunday=7 (ISO weekday)
  const js = d.getUTCDay(); // 0 Sun .. 6 Sat
  return js === 0 ? 7 : js;
}

function nextMondayOrToday(todayYmd: string): string {
  const d = parseYmdToUtcDate(todayYmd);
  const wd = weekdayUtc(d);
  if (wd === 1) return todayYmd;
  const diff = (8 - wd) % 7; // days until next Monday
  return addDays(todayYmd, diff);
}

function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00.000Z');
  return !isNaN(d.getTime()) && formatUtcDateToYmd(d) === s;
}

function startOfMonthYmd(month: string): string {
  return `${month}-01`;
}
function endOfMonthYmd(month: string): string {
  // month = YYYY-MM
  const [y, m] = month.split('-').map(Number);
  // last day of month
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month
  return formatUtcDateToYmd(last);
}

function monthRangeToUtcDates(month: string): { from: Date; to: Date } {
  const fromYmd = startOfMonthYmd(month);
  const toYmd = endOfMonthYmd(month);
  // inclusive: gte from 00:00, lte to 00:00 (workDate stored at midnight)
  return { from: parseYmdToUtcDate(fromYmd), to: parseYmdToUtcDate(toYmd) };
}

// ---------------------------------------------------------------------------
// expireOldRegistrations
// ---------------------------------------------------------------------------

export async function expireOldRegistrations(accountId?: string) {
  const todayYmd = todayInBangkok();
  const todayDate = parseYmdToUtcDate(todayYmd);
  const where: any = {
    status: 'ACTIVE',
    endDate: { lt: todayDate },
  };
  if (accountId) where.accountId = accountId;
  await prisma.scheduleRegistration.updateMany({
    where,
    data: { status: 'EXPIRED' },
  });
}

// ---------------------------------------------------------------------------
// Work history snapshots
// ---------------------------------------------------------------------------

/**
 * Copies completed calendar days from mutable shift assignments into the
 * immutable WorkHistory table. The compound key makes repeated daily runs safe.
 */
export async function syncWorkHistory(upToExclusiveYmd = todayInBangkok()) {
  if (!isValidYmd(upToExclusiveYmd)) {
    throw Errors.badRequest('INVALID_HISTORY_CUTOFF', 'History cutoff must be YYYY-MM-DD');
  }

  const cutoff = parseYmdToUtcDate(upToExclusiveYmd);

  // Fast check: find completed assignments before cutoff
  const completedAssignments = await prisma.shiftAssignment.findMany({
    where: {
      status: 'ACTIVE',
      shift: { workDate: { lt: cutoff } },
    },
    include: { shift: true },
  });

  if (completedAssignments.length === 0) return { processedCount: 0 };

  const existingHistoryRecords = await prisma.workHistory.findMany({
    where: { sourceAssignmentId: { not: null } },
    select: { sourceAssignmentId: true },
  });
  const syncedIds = new Set(existingHistoryRecords.map((r) => r.sourceAssignmentId));

  const unSynced = completedAssignments.filter((a) => !syncedIds.has(a.id));
  if (unSynced.length === 0) return { processedCount: 0 };

  await prisma.$transaction(
    unSynced.map((assignment) =>
      prisma.workHistory.upsert({
        where: {
          accountId_workDate_period: {
            accountId: assignment.accountId,
            workDate: assignment.shift.workDate,
            period: assignment.shift.period,
          },
        },
        update: {},
        create: {
          accountId: assignment.accountId,
          workDate: assignment.shift.workDate,
          period: assignment.shift.period,
          roomCode: assignment.roomCode,
          status: 'COMPLETED',
          sourceAssignmentId: assignment.id,
        },
      }),
    ),
  );

  return { processedCount: unSynced.length };
}

// ---------------------------------------------------------------------------
// getMyRegistration
// ---------------------------------------------------------------------------

export async function getMyRegistration(accountId: string) {
  await expireOldRegistrations(accountId);
  const reg = await prisma.scheduleRegistration.findFirst({
    where: { accountId, status: 'ACTIVE' },
    include: { patternSlots: true },
    orderBy: { createdAt: 'desc' },
  });
  return reg;
}

// ---------------------------------------------------------------------------
// upsertRegistration
// ---------------------------------------------------------------------------

export type UpsertRegistrationInput = {
  roomCode: string;
  slots: { weekday: number; period: string }[];
  expectedVersion?: number;
};

function validateUpsertInput(input: UpsertRegistrationInput) {
  if (!ROOM_CODES.includes(input.roomCode as RoomCode)) {
    throw Errors.badRequest('INVALID_ROOM_CODE', `roomCode must be one of ${ROOM_CODES.join(', ')}`);
  }
  if (!Array.isArray(input.slots) || input.slots.length === 0) {
    throw Errors.badRequest('INVALID_SLOTS', 'At least 1 slot is required');
  }
  for (const s of input.slots) {
    if (!Number.isInteger(s.weekday) || s.weekday < 1 || s.weekday > 5) {
      throw Errors.badRequest('INVALID_WEEKDAY', 'weekday must be integer 1-5 (Mon-Fri)');
    }
    if (!PERIODS.includes(s.period as Period)) {
      throw Errors.badRequest('INVALID_PERIOD', `period must be one of ${PERIODS.join(', ')}`);
    }
  }
  // deduplicate check is not an error; we will dedupe internally
}

function dedupeSlots(slots: { weekday: number; period: string }[]) {
  const map = new Map<string, { weekday: number; period: string }>();
  for (const s of slots) {
    const k = `${s.weekday}:${s.period}`;
    if (!map.has(k)) map.set(k, { weekday: s.weekday, period: s.period });
  }
  return [...map.values()];
}

/**
 * Upsert registration + sync Shifts and ShiftAssignments.
 * - Computes startDate = next Monday or today (if today is Monday -> today)
 * - endDate = startDate + 30 days (simplified; original spec mentions 60 days)
 */
export async function upsertRegistration(accountId: string, input: UpsertRegistrationInput) {
  validateUpsertInput(input);
  // Freeze all completed days before changing the mutable weekly schedule.
  await syncWorkHistory();
  const slots = dedupeSlots(input.slots);

  await expireOldRegistrations(accountId);

  const existing = await prisma.scheduleRegistration.findFirst({
    where: { accountId, status: 'ACTIVE' },
    include: { patternSlots: true },
  });

  if (existing) {
    if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
      throw new AppError(409, 'VERSION_CONFLICT', 'Version conflict');
    }
  }

  const todayYmd = todayInBangkok();
  const todayDate = parseYmdToUtcDate(todayYmd);
  const startYmd = nextMondayOrToday(todayYmd);
  const startDate = parseYmdToUtcDate(startYmd);
  const endYmd = addDays(startYmd, 30);
  const endDate = parseYmdToUtcDate(endYmd);

  // Build set of desired workDate+period keys for quick comparison
  const desiredKeys = new Set<string>(); // "YYYY-MM-DD:PERIOD"
  const desiredByDate = new Map<string, Set<string>>(); // ymd -> Set<period>
  {
    const cur = parseYmdToUtcDate(startYmd);
    const end = parseYmdToUtcDate(endYmd);
    for (let d = new Date(cur); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
      const wd = weekdayUtc(d);
      const ymd = formatUtcDateToYmd(d);
      for (const s of slots) {
        if (s.weekday === wd) {
          const key = `${ymd}:${s.period}`;
          desiredKeys.add(key);
          if (!desiredByDate.has(ymd)) desiredByDate.set(ymd, new Set());
          desiredByDate.get(ymd)!.add(s.period);
        }
      }
    }
  }

  // Pre-resolve/create all required shifts outside transaction to minimize SQLite lock hold time
  const requiredShifts: { shiftId: string; workDate: Date; period: string }[] = [];
  for (const [ymd, periods] of desiredByDate.entries()) {
    const workDate = parseYmdToUtcDate(ymd);
    for (const period of periods) {
      let shift = await prisma.shift.findUnique({ where: { workDate_period: { workDate, period } } });
      if (!shift) {
        shift = await prisma.shift.create({ data: { workDate, period } });
      }
      requiredShifts.push({ shiftId: shift.id, workDate, period });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let registration: any;

    if (existing) {
      // Delete old pattern slots and recreate
      await tx.schedulePatternSlot.deleteMany({ where: { registrationId: existing.id } });

      registration = await tx.scheduleRegistration.update({
        where: { id: existing.id },
        data: {
          roomCode: input.roomCode,
          startDate,
          endDate,
          timeZone: 'Asia/Bangkok',
          version: { increment: 1 },
          patternSlots: {
            create: slots.map((s) => ({ weekday: s.weekday, period: s.period })),
          },
        },
        include: { patternSlots: true },
      });

      // Ensure assignments for all required shifts
      for (const req of requiredShifts) {
        const existingAssignment = await tx.shiftAssignment.findFirst({
          where: { shiftId: req.shiftId, registrationId: registration.id },
        });
        if (!existingAssignment) {
          const byAccount = await tx.shiftAssignment.findUnique({
            where: { shiftId_accountId: { shiftId: req.shiftId, accountId } },
          }).catch(() => null);
          if (byAccount) {
            if (byAccount.registrationId !== registration.id) {
              await tx.shiftAssignment.update({
                where: { id: byAccount.id },
                data: {
                  registrationId: registration.id,
                  roomCode: input.roomCode,
                  status: 'ACTIVE',
                  cancelledAt: null,
                  cancellationReason: null,
                },
              });
            } else if (byAccount.status === 'CANCELLED') {
              await tx.shiftAssignment.update({
                where: { id: byAccount.id },
                data: {
                  roomCode: input.roomCode,
                  status: 'ACTIVE',
                  cancelledAt: null,
                  cancellationReason: null,
                },
              });
            } else {
              if (byAccount.roomCode !== input.roomCode) {
                await tx.shiftAssignment.update({
                  where: { id: byAccount.id },
                  data: { roomCode: input.roomCode },
                });
              }
            }
          } else {
            await tx.shiftAssignment.create({
              data: {
                shiftId: req.shiftId,
                accountId,
                registrationId: registration.id,
                roomCode: input.roomCode,
                status: 'ACTIVE',
              },
            });
          }
        } else {
          if (existingAssignment.status === 'CANCELLED' || existingAssignment.roomCode !== input.roomCode) {
            await tx.shiftAssignment.update({
              where: { id: existingAssignment.id },
              data: {
                status: 'ACTIVE',
                roomCode: input.roomCode,
                cancelledAt: null,
                cancellationReason: null,
              },
            });
          }
        }
      }

      // Cancel assignments that are no longer in the new pattern where workDate >= today
      const allAssignments = await tx.shiftAssignment.findMany({
        where: { registrationId: registration.id, status: 'ACTIVE' },
        include: { shift: true },
      });
      for (const a of allAssignments) {
        const ymd = formatUtcDateToYmd(a.shift.workDate);
        if (a.shift.workDate < todayDate) continue; // only future/today
        const key = `${ymd}:${a.shift.period}`;
        if (!desiredKeys.has(key)) {
          await tx.shiftAssignment.update({
            where: { id: a.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
        } else {
          if (a.roomCode !== input.roomCode) {
            await tx.shiftAssignment.update({
              where: { id: a.id },
              data: { roomCode: input.roomCode },
            });
          }
        }
      }
    } else {
      // Create new registration
      registration = await tx.scheduleRegistration.create({
        data: {
          accountId,
          startDate,
          endDate,
          timeZone: 'Asia/Bangkok',
          roomCode: input.roomCode,
          version: 1,
          status: 'ACTIVE',
          patternSlots: {
            create: slots.map((s) => ({ weekday: s.weekday, period: s.period })),
          },
        },
        include: { patternSlots: true },
      });

      for (const req of requiredShifts) {
        const byAccount = await tx.shiftAssignment.findUnique({
          where: { shiftId_accountId: { shiftId: req.shiftId, accountId } },
        }).catch(() => null);
        if (byAccount) {
          await tx.shiftAssignment.update({
            where: { id: byAccount.id },
            data: {
              registrationId: registration.id,
              roomCode: input.roomCode,
              status: 'ACTIVE',
              cancelledAt: null,
            },
          });
        } else {
          await tx.shiftAssignment.create({
            data: {
              shiftId: req.shiftId,
              accountId,
              registrationId: registration.id,
              roomCode: input.roomCode,
              status: 'ACTIVE',
            },
          });
        }
      }
    }

    return registration;
  });

  // Return DTO
  return {
    id: result.id,
    accountId: result.accountId,
    startDate: formatUtcDateToYmd(result.startDate),
    endDate: formatUtcDateToYmd(result.endDate),
    timeZone: result.timeZone,
    roomCode: result.roomCode,
    version: result.version,
    status: result.status,
    patternSlots: result.patternSlots,
  };
}

// ---------------------------------------------------------------------------
// listMyShifts
// ---------------------------------------------------------------------------

export type ListMyShiftsParams = {
  from?: string;
  to?: string;
  month?: string;
};

export async function listMyShifts(accountId: string, params: ListMyShiftsParams) {
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (params.month) {
    if (!/^\d{4}-\d{2}$/.test(params.month)) {
      throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
    }
    const r = monthRangeToUtcDates(params.month);
    fromDate = r.from;
    toDate = r.to;
  } else {
    if (params.from) {
      if (!isValidYmd(params.from)) throw Errors.badRequest('INVALID_FROM', 'from must be YYYY-MM-DD');
      fromDate = parseYmdToUtcDate(params.from);
    }
    if (params.to) {
      if (!isValidYmd(params.to)) throw Errors.badRequest('INVALID_TO', 'to must be YYYY-MM-DD');
      toDate = parseYmdToUtcDate(params.to);
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw Errors.badRequest('INVALID_RANGE', 'from must be <= to');
    }
  }

  const shiftWhere: any = {};
  if (fromDate || toDate) {
    shiftWhere.workDate = {};
    if (fromDate) shiftWhere.workDate.gte = fromDate;
    if (toDate) shiftWhere.workDate.lte = toDate;
  }

  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      accountId,
      status: 'ACTIVE',
      ...(Object.keys(shiftWhere).length ? { shift: shiftWhere } : {}),
    },
    include: { shift: true },
    orderBy: [{ shift: { workDate: 'asc' } }, { shift: { period: 'asc' } }],
  });

  // Fallback ordering if Prisma nested order not fully supported: sort in memory
  assignments.sort((a, b) => {
    const d = a.shift.workDate.getTime() - b.shift.workDate.getTime();
    if (d !== 0) return d;
    return a.shift.period.localeCompare(b.shift.period);
  });

  return assignments.map((a) => ({
    id: a.id,
    shiftId: a.shiftId,
    registrationId: a.registrationId,
    roomCode: a.roomCode,
    status: a.status,
    workDate: formatUtcDateToYmd(a.shift.workDate),
    period: a.shift.period,
    shift: {
      id: a.shift.id,
      workDate: formatUtcDateToYmd(a.shift.workDate),
      period: a.shift.period,
    },
  }));
}

// ---------------------------------------------------------------------------
// getShiftForUser / getShiftDetailAdmin
// ---------------------------------------------------------------------------

export async function getShiftForUser(shiftId: string, accountId: string, isAdmin: boolean) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw Errors.notFound('Shift not found');

  const assignments = await prisma.shiftAssignment.findMany({
    where: { shiftId, status: 'ACTIVE' },
    include: { account: true },
  });

  if (!isAdmin) {
    const own = assignments.find((a) => a.accountId === accountId);
    if (!own) throw Errors.forbidden();
  }

  return {
    id: shift.id,
    workDate: formatUtcDateToYmd(shift.workDate),
    period: shift.period,
    shift: {
      id: shift.id,
      workDate: formatUtcDateToYmd(shift.workDate),
      period: shift.period,
    },
    assignments: assignments.map((a) => ({
      id: a.id,
      accountId: a.accountId,
      displayName: (a as any).account.displayName,
      phone: (a as any).account.phone ?? null,
      roomCode: a.roomCode,
      status: a.status,
    })),
  };
}

// ---------------------------------------------------------------------------
// cancelOne
// ---------------------------------------------------------------------------

export async function cancelOne(accountId: string, assignmentId: string) {
  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, accountId, status: 'ACTIVE' },
    include: { shift: true },
  });
  if (!assignment) throw Errors.notFound('Assignment not found');

  const todayYmd = todayInBangkok();
  const todayDate = parseYmdToUtcDate(todayYmd);
  if (assignment.shift.workDate < todayDate) {
    throw Errors.badRequest('CANNOT_CANCEL_PAST', 'Cannot cancel past shift');
  }

  await prisma.shiftAssignment.update({
    where: { id: assignment.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  return { affectedCount: 1 };
}

// ---------------------------------------------------------------------------
// cancelSeries
// ---------------------------------------------------------------------------

export async function cancelSeries(
  accountId: string,
  registrationId: string,
  params: { weekday: number; period: string; fromDate: string },
) {
  if (!Number.isInteger(params.weekday) || params.weekday < 1 || params.weekday > 5) {
    throw Errors.badRequest('INVALID_WEEKDAY', 'weekday must be 1-5');
  }
  if (!PERIODS.includes(params.period as Period)) {
    throw Errors.badRequest('INVALID_PERIOD', `period must be one of ${PERIODS.join(', ')}`);
  }
  if (!isValidYmd(params.fromDate)) {
    throw Errors.badRequest('INVALID_FROM_DATE', 'fromDate must be YYYY-MM-DD');
  }

  const reg = await prisma.scheduleRegistration.findFirst({
    where: { id: registrationId, accountId },
  });
  if (!reg) throw Errors.notFound('Registration not found');

  const fromDate = parseYmdToUtcDate(params.fromDate);

  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      registrationId,
      accountId,
      status: 'ACTIVE',
      shift: {
        period: params.period,
        workDate: { gte: fromDate },
      },
    },
    include: { shift: true },
  });

  // Filter by weekday (derived from shift.workDate)
  const toCancel = assignments.filter((a) => weekdayUtc(a.shift.workDate) === params.weekday);

  if (toCancel.length === 0) return { count: 0 };

  await prisma.shiftAssignment.updateMany({
    where: { id: { in: toCancel.map((a) => a.id) } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  return { count: toCancel.length };
}

// ---------------------------------------------------------------------------
// Work history queries (CTV + admin)
// ---------------------------------------------------------------------------

export async function getWorkHistory(params: { month: string; accountId?: string }) {
  if (!/^\d{4}-\d{2}$/.test(params.month)) {
    throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
  }

  await syncWorkHistory();
  const range = monthRangeToUtcDates(params.month);
  const rows = await prisma.workHistory.findMany({
    where: {
      workDate: { gte: range.from, lte: range.to },
      ...(params.accountId ? { accountId: params.accountId } : {}),
    },
    include: { account: true },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }, { accountId: 'asc' }],
  });

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

  return { month: params.month, cells: [...grouped.values()] };
}

// ---------------------------------------------------------------------------
// getScheduleSummary (admin)
// ---------------------------------------------------------------------------

export type GetScheduleSummaryParams = {
  month?: string;
  from?: string;
  to?: string;
  accountId?: string;
};

export async function getScheduleSummary(params: GetScheduleSummaryParams | string) {
  // Backward-compat: if a plain string is passed treat as month
  const q: GetScheduleSummaryParams = typeof params === 'string' ? { month: params } : params;

  let from: Date;
  let to: Date;
  let month: string | undefined;

  if (q.month) {
    if (!/^\d{4}-\d{2}$/.test(q.month)) {
      throw Errors.badRequest('INVALID_MONTH', 'month must be YYYY-MM');
    }
    const r = monthRangeToUtcDates(q.month);
    from = r.from;
    to = r.to;
    month = q.month;
  } else if (q.from && q.to) {
    if (!isValidYmd(q.from)) throw Errors.badRequest('INVALID_FROM', 'from must be YYYY-MM-DD');
    if (!isValidYmd(q.to)) throw Errors.badRequest('INVALID_TO', 'to must be YYYY-MM-DD');
    from = parseYmdToUtcDate(q.from);
    to = parseYmdToUtcDate(q.to);
    if (from > to) throw Errors.badRequest('INVALID_RANGE', 'from must be <= to');
    // limit to 62 days to avoid heavy queries (month + buffer)
    const diffDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > 62) throw Errors.badRequest('RANGE_TOO_LARGE', 'Date range must be <= 62 days');
  } else {
    throw Errors.badRequest('MISSING_RANGE', 'Provide either month or from+to');
  }

  const shifts = await prisma.shift.findMany({
    where: {
      workDate: { gte: from, lte: to },
      ...(q.accountId
        ? {
            assignments: {
              some: { accountId: q.accountId, status: 'ACTIVE' },
            },
          }
        : {}),
    },
    include: {
      assignments: {
        where: {
          status: 'ACTIVE',
          ...(q.accountId ? { accountId: q.accountId } : {}),
        },
        include: { account: true },
      },
    },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }],
  });

  // Group by workDate+period (shifts are already unique by that, but keep structure)
  const cells = shifts.map((s) => ({
    shiftId: s.id,
    workDate: formatUtcDateToYmd(s.workDate),
    period: s.period,
    count: s.assignments.length,
    shiftAssignments: s.assignments.map((a) => ({
      id: a.id,
      accountId: a.accountId,
      displayName: (a as any).account.displayName,
      phone: (a as any).account.phone ?? null,
      roomCode: a.roomCode,
      status: a.status,
    })),
  }));

  // Ensure ordering
  cells.sort((a, b) => {
    if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
    return a.period.localeCompare(b.period);
  });

  if (month) return { month, cells };
  return { from: q.from, to: q.to, cells };
}

import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import { todayInBangkok } from '../../shared/timezone.js';

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
// Backward-compatible shift lookups
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

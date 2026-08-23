import { prisma } from '../../shared/prisma.js';
import { ApiError } from '../../shared/api-error.js';
import { displayToRoomCode, roomCodeToDisplay, formatShiftSlotDto } from './schedule.dto.js';
import { logAudit } from '../audit/audit.service.js';
import { createNotification } from '../notifications/notifications.service.js';

export interface SaveRegistrationInput {
  roomCode?: string;
  room?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timeZone?: string;
  workContent?: string;
  slots: Array<{
    weekday: number; // 0 (Mon) -> 6 (Sun)
    period: 'MORNING' | 'AFTERNOON' | 'EVENING';
    enabled: boolean;
  }>;
  version?: number;
}

const getWeekday = (date: Date): number => {
  const jsDay = date.getDay(); // 0 for Sunday
  return (jsDay + 6) % 7; // 0 for Mon, 6 for Sun
};

const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getUserScheduleRegistration = async (accountId: string) => {
  const reg = await prisma.scheduleRegistration.findFirst({
    where: { accountId, status: 'ACTIVE' },
    include: { patternSlots: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!reg) {
    return null;
  }

  return {
    id: reg.id,
    roomCode: reg.roomCode,
    room: roomCodeToDisplay(reg.roomCode),
    startDate: reg.startDate,
    endDate: reg.endDate,
    timeZone: reg.timeZone,
    workContent: reg.workContent || '',
    version: reg.version,
    status: reg.status,
    slots: reg.patternSlots.map((s) => ({
      weekday: s.weekday,
      period: s.period,
      enabled: s.enabled,
    })),
  };
};

export const saveUserScheduleRegistration = async (
  accountId: string,
  input: SaveRegistrationInput,
  requestId?: string,
) => {
  const roomCode = input.roomCode || displayToRoomCode(input.room);

  const savedRegistration = await prisma.$transaction(async (tx) => {
    // 1. Find existing active registration
    const existing = await tx.scheduleRegistration.findFirst({
      where: { accountId, status: 'ACTIVE' },
      include: { patternSlots: true },
    });

    let reg;
    const version = existing ? existing.version + 1 : 1;

    if (existing) {
      reg = await tx.scheduleRegistration.update({
        where: { id: existing.id },
        data: {
          startDate: input.startDate,
          endDate: input.endDate,
          timeZone: input.timeZone || 'Asia/Ho_Chi_Minh',
          roomCode,
          workContent: input.workContent,
          version,
        },
      });
      // Delete old slots
      await tx.schedulePatternSlot.deleteMany({
        where: { registrationId: reg.id },
      });
    } else {
      reg = await tx.scheduleRegistration.create({
        data: {
          accountId,
          startDate: input.startDate,
          endDate: input.endDate,
          timeZone: input.timeZone || 'Asia/Ho_Chi_Minh',
          roomCode,
          workContent: input.workContent,
          version,
          status: 'ACTIVE',
        },
      });
    }

    // 2. Insert new pattern slots
    for (const slot of input.slots) {
      if (slot.enabled) {
        await tx.schedulePatternSlot.create({
          data: {
            registrationId: reg.id,
            weekday: slot.weekday,
            period: slot.period,
            enabled: true,
          },
        });
      }
    }

    // 3. Generate Shifts & ShiftAssignments
    const enabledSlots = input.slots.filter((s) => s.enabled);
    const [startYear, startMonth, startDay] = input.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = input.endDate.split('-').map(Number);

    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);

    const newTargetKeys = new Set<string>(); // "workDate_period"

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const weekday = getWeekday(d);
      const currentDateISO = toISODate(d);

      const matchingSlots = enabledSlots.filter((s) => s.weekday === weekday);
      for (const slot of matchingSlots) {
        newTargetKeys.add(`${currentDateISO}_${slot.period}`);

        // Upsert shared Shift
        const shift = await tx.shift.upsert({
          where: {
            workDate_period_roomCode: {
              workDate: currentDateISO,
              period: slot.period,
              roomCode,
            },
          },
          create: {
            workDate: currentDateISO,
            weekday,
            period: slot.period,
            roomCode,
            status: 'OPEN',
            allowRegistration: true,
            targetCapacity: 4,
          },
          update: {},
        });

        // Upsert ShiftAssignment for this CTV
        await tx.shiftAssignment.upsert({
          where: {
            shiftId_accountId: {
              shiftId: shift.id,
              accountId,
            },
          },
          create: {
            shiftId: shift.id,
            accountId,
            registrationId: reg.id,
            status: 'APPROVED',
            taskContent: input.workContent,
          },
          update: {
            registrationId: reg.id,
            status: 'APPROVED',
            taskContent: input.workContent,
            cancelledAt: null,
            cancellationReason: null,
          },
        });
      }
    }

    // Cancel old future assignments for this registration that are not in the new targets
    const todayISO = toISODate(new Date());
    const existingFutureAssignments = await tx.shiftAssignment.findMany({
      where: {
        accountId,
        registrationId: reg.id,
        status: 'APPROVED',
        shift: { workDate: { gte: todayISO } },
      },
      include: { shift: true },
    });

    for (const ea of existingFutureAssignments) {
      const key = `${ea.shift.workDate}_${ea.shift.period}`;
      if (!newTargetKeys.has(key)) {
        await tx.shiftAssignment.update({
          where: { id: ea.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'Cập nhật lại mẫu lịch làm việc',
          },
        });
      }
    }

    // 4. Create Notification
    await tx.notification.create({
      data: {
        accountId,
        type: 'success',
        title: 'Đăng ký lịch làm việc thành công',
        message: `Lịch làm việc đã được cập nhật từ ngày ${input.startDate} đến ${input.endDate}.`,
        sourceType: 'SCHEDULE_REGISTRATION',
        sourceId: reg.id,
      },
    });

    return reg;
  }, { timeout: 15000 });

  // Audit Log outside transaction
  await logAudit({
    actorAccountId: accountId,
    action: 'UPDATE_SCHEDULE_REGISTRATION',
    targetType: 'SCHEDULE_REGISTRATION',
    targetId: savedRegistration.id,
    requestId,
    metadata: { startDate: input.startDate, endDate: input.endDate, roomCode },
  });

  return savedRegistration;
};

export const getUserShifts = async (
  accountId: string,
  query?: { startDate?: string; endDate?: string; month?: string },
) => {
  const whereShift: any = {};

  if (query?.month) {
    whereShift.workDate = { startsWith: query.month };
  } else if (query?.startDate && query?.endDate) {
    whereShift.workDate = {
      gte: query.startDate,
      lte: query.endDate,
    };
  }

  // Find all shifts that have assignments or match range
  const shifts = await prisma.shift.findMany({
    where: whereShift,
    include: {
      assignments: {
        where: {
          status: { in: ['APPROVED', 'PENDING'] },
        },
        include: {
          account: {
            include: {
              files: { include: { file: true } },
            },
          },
          registration: true,
        },
      },
    },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }],
  });

  return shifts.map((s) => formatShiftSlotDto(s, accountId));
};

export const cancelShift = async (
  identifier: string,
  accountId: string,
  scope: 'single' | 'series' = 'single',
  fromDate?: string,
  reason?: string,
  requestId?: string,
) => {
  // Find assignment either by direct ID or by shiftId
  let assignment = await prisma.shiftAssignment.findFirst({
    where: {
      OR: [
        { id: identifier, accountId },
        { shiftId: identifier, accountId },
      ],
    },
    include: { shift: true },
  });

  if (!assignment) {
    // If not found directly, check if identifier is a shiftId
    const shift = await prisma.shift.findUnique({ where: { id: identifier } });
    if (shift) {
      assignment = await prisma.shiftAssignment.findFirst({
        where: { shiftId: shift.id, accountId },
        include: { shift: true },
      });
    }
  }

  if (!assignment) {
    throw ApiError.notFound('Không tìm thấy ca làm việc đã đăng ký');
  }

  const effectiveFromDate = fromDate || assignment.shift.workDate;
  let cancelledCount = 1;

  await prisma.$transaction(async (tx) => {
    if (scope === 'single') {
      await tx.shiftAssignment.update({
        where: { id: assignment!.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason || 'CTV hủy ca làm việc',
        },
      });
    } else {
      // Series cancellation
      const matchingAssignments = await tx.shiftAssignment.findMany({
        where: {
          accountId,
          status: 'APPROVED',
          shift: {
            workDate: { gte: effectiveFromDate },
            period: assignment!.shift.period,
            weekday: assignment!.shift.weekday,
          },
        },
        include: { shift: true },
      });

      cancelledCount = matchingAssignments.length;

      for (const ma of matchingAssignments) {
        await tx.shiftAssignment.update({
          where: { id: ma.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: reason || `Hủy chuỗi ca từ ngày ${effectiveFromDate}`,
          },
        });
      }
    }
  }, { timeout: 15000 });

  await logAudit({
    actorAccountId: accountId,
    action: scope === 'single' ? 'CANCEL_SINGLE_SHIFT' : 'CANCEL_SERIES_SHIFTS',
    targetType: scope === 'single' ? 'SHIFT_ASSIGNMENT' : 'ACCOUNT',
    targetId: scope === 'single' ? assignment.id : accountId,
    requestId,
    metadata: scope === 'single'
      ? { workDate: assignment.shift.workDate, period: assignment.shift.period }
      : { fromDate: effectiveFromDate, count: cancelledCount },
  });

  return { success: true, message: 'Đã hủy ca làm việc thành công' };
};

export const getScheduleSummary = async (monthQuery?: string) => {
  const currentYearMonth = monthQuery || toISODate(new Date()).slice(0, 7); // e.g. "2026-08"
  const todayISO = toISODate(new Date());

  const shifts = await prisma.shift.findMany({
    where: {
      workDate: { startsWith: currentYearMonth },
    },
    include: {
      assignments: {
        where: { status: 'APPROVED' },
        include: {
          account: {
            include: {
              files: { include: { file: true } },
            },
          },
          registration: true,
        },
      },
    },
    orderBy: [{ workDate: 'asc' }, { period: 'asc' }],
  });

  // 1. Today's CTVs
  const todayShifts = shifts.filter((s) => s.workDate === todayISO);
  const todayCTVs: any[] = [];

  for (const ts of todayShifts) {
    for (const as of ts.assignments) {
      const avatarFile = as.account.files?.find((f) => f.category === 'AVATAR')?.file;
      const name = as.account.displayName;
      const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || name.slice(0, 2).toUpperCase();

      todayCTVs.push({
        id: as.account.id,
        assignmentId: as.id,
        name,
        avatar: avatarFile ? `/api/v1/files/${avatarFile.id}/content` : undefined,
        initials,
        phone: as.account.phone,
        cctvCode: as.account.ctvCode,
        room: roomCodeToDisplay(ts.roomCode),
        roomDisplay: roomCodeToDisplay(ts.roomCode),
        shiftPeriod: ts.period === 'MORNING' ? 'Ca Sáng' : 'Ca Chiều',
        shiftTimeLabel: ts.period === 'MORNING' ? '08:00 - 12:00' : '13:30 - 17:30',
        taskContent: as.taskContent || as.registration?.workContent || 'Theo sự phân công của phụ trách ca',
        taskDisplay: as.taskContent || as.registration?.workContent || 'Theo sự phân công của phụ trách ca',
        status: 'Đi làm',
      });
    }
  }

  // 2. Formatted shift map for UI
  const formattedShifts = shifts.map((s) => formatShiftSlotDto(s));

  return {
    month: currentYearMonth,
    today: todayCTVs,
    shifts: formattedShifts,
  };
};

export const getShiftDetail = async (shiftId: string) => {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      assignments: {
        where: { status: 'APPROVED' },
        include: {
          account: {
            include: {
              files: { include: { file: true } },
            },
          },
          registration: true,
        },
      },
    },
  });

  if (!shift) {
    throw ApiError.notFound('Không tìm thấy ca làm việc');
  }

  return formatShiftSlotDto(shift);
};

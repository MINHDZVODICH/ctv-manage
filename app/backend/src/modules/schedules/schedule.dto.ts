import type {
  Account,
  SchedulePatternSlot,
  ScheduleRegistration,
  Shift,
  ShiftAssignment,
} from '@prisma/client';

type RegistrationWithSlots = ScheduleRegistration & { patternSlots: SchedulePatternSlot[] };
type AssignmentWithShift = ShiftAssignment & { shift: Shift };

export function toScheduleRegistrationDto(registration: RegistrationWithSlots) {
  return {
    id: registration.id,
    startDate: toYmd(registration.startDate),
    endDate: toYmd(registration.endDate),
    timeZone: registration.timeZone,
    roomCode: registration.roomCode,
    workContent: registration.workContent,
    slots: [...registration.patternSlots]
      .sort((left, right) => left.weekday - right.weekday || left.period.localeCompare(right.period))
      .map(({ weekday, period }) => ({ weekday, period })),
    version: registration.version,
    status: registration.status,
    updatedAt: registration.updatedAt.toISOString(),
  };
}

export function toMyShiftDto(assignment: AssignmentWithShift, today: string) {
  const workDate = toYmd(assignment.shift.workDate);
  return {
    assignmentId: assignment.id,
    shiftId: assignment.shiftId,
    registrationId: assignment.registrationId,
    workDate,
    weekday: assignment.shift.workDate.getUTCDay(),
    period: assignment.shift.period,
    roomCode: assignment.roomCode,
    workContent: assignment.workContent,
    status: assignment.status,
    canCancel: assignment.status === 'ACTIVE' && workDate >= today,
  };
}

export function toCoWorkerDto(assignment: ShiftAssignment & { account: Pick<Account, 'id' | 'displayName'> }) {
  return {
    accountId: assignment.account.id,
    displayName: assignment.account.displayName,
    roomCode: assignment.roomCode,
  };
}

export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

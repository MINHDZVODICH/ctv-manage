import {
  Prisma,
  type AccountRole,
  type PrismaClient,
  type ShiftPeriod,
} from '@prisma/client';
import { ApiError } from '../../shared/api-error.js';
import { prisma } from '../../shared/prisma.js';
import { toAdminRosterAssignmentDto, toCoWorkerDto, toMyShiftDto, toScheduleRegistrationDto, toYmd } from './schedule.dto.js';
import type { CancelSeriesQuery, MyShiftsQuery, ScheduleRegistrationInput, ScheduleSummaryQuery } from './schedule.schemas.js';

const SUPPORTED_TIME_ZONE = 'Asia/Bangkok';

export interface PatternInput {
  startDate: string;
  endDate: string;
  timeZone: string;
  slots: Array<{ weekday: number; period: ShiftPeriod | 'MORNING' | 'AFTERNOON' }>;
}

export interface ExpandedOccurrence {
  workDate: string;
  period: 'MORNING' | 'AFTERNOON';
}

export interface ScheduleActor {
  id: string;
  role: AccountRole | 'ADMIN' | 'CTV';
}

export function expandPattern(input: PatternInput): ExpandedOccurrence[] {
  if (input.timeZone !== SUPPORTED_TIME_ZONE) throw new TypeError('timeZone must be Asia/Bangkok.');
  const start = parseYmd(input.startDate);
  const end = parseYmd(input.endDate);
  if (end.getTime() < start.getTime()) throw new TypeError('endDate must be on or after startDate.');
  for (const slot of input.slots) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 5) {
      throw new TypeError('weekday must be an integer from 1 to 5.');
    }
    if (slot.period !== 'MORNING' && slot.period !== 'AFTERNOON') {
      throw new TypeError('period must be MORNING or AFTERNOON.');
    }
  }

  const slotKeys = new Set(input.slots.map((slot) => `${slot.weekday}:${slot.period}`));
  const occurrences: ExpandedOccurrence[] = [];
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    const date = new Date(cursor);
    const weekday = date.getUTCDay();
    if (weekday < 1 || weekday > 5) continue;
    for (const period of ['MORNING', 'AFTERNOON'] as const) {
      if (slotKeys.has(`${weekday}:${period}`)) occurrences.push({ workDate: toYmd(date), period });
    }
  }
  return occurrences;
}

export class ScheduleService {
  constructor(
    private readonly client: PrismaClient = prisma,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getCurrentRegistration(accountId: string) {
    const registration = await this.client.scheduleRegistration.findFirst({
      where: { accountId, status: 'ACTIVE' },
      include: { patternSlots: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return registration ? toScheduleRegistrationDto(registration) : null;
  }

  async upsertRegistration(accountId: string, input: ScheduleRegistrationInput) {
    const occurrences = expandPattern(input);
    const today = bangkokDate(this.now());

    try {
      return await this.client.$transaction(async (transaction) => {
      const current = await transaction.scheduleRegistration.findFirst({
        where: { accountId, status: 'ACTIVE' },
        include: { patternSlots: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });

      if (input.version === null) {
        if (current) throw versionConflict(current.version);
      } else if (!current || current.version !== input.version) {
        throw versionConflict(current?.version ?? null);
      }

      let registrationId: string;
      if (!current) {
        const created = await transaction.scheduleRegistration.create({
          data: {
            accountId,
            startDate: parseYmd(input.startDate),
            endDate: parseYmd(input.endDate),
            timeZone: input.timeZone,
            roomCode: input.roomCode,
            workContent: input.workContent,
            version: 1,
            patternSlots: { create: input.slots },
          },
        });
        registrationId = created.id;
      } else {
        const updated = await transaction.scheduleRegistration.updateMany({
          where: { id: current.id, accountId, status: 'ACTIVE', version: input.version! },
          data: {
            startDate: parseYmd(input.startDate),
            endDate: parseYmd(input.endDate),
            timeZone: input.timeZone,
            roomCode: input.roomCode,
            workContent: input.workContent,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          const latest = await transaction.scheduleRegistration.findUnique({ where: { id: current.id } });
          throw versionConflict(latest?.version ?? null);
        }
        registrationId = current.id;
        await transaction.schedulePatternSlot.deleteMany({ where: { registrationId } });
        await transaction.schedulePatternSlot.createMany({
          data: input.slots.map((slot) => ({ registrationId, ...slot })),
        });
      }

      const desiredShiftIds = new Set<string>();
      for (const occurrence of occurrences) {
        if (current && occurrence.workDate < today) continue;
        const workDate = parseYmd(occurrence.workDate);
        const shift = await transaction.shift.upsert({
          where: { workDate_period: { workDate, period: occurrence.period } },
          create: { workDate, period: occurrence.period },
          update: {},
        });
        desiredShiftIds.add(shift.id);
        const existingAssignment = await transaction.shiftAssignment.findUnique({
          where: { shiftId_accountId: { shiftId: shift.id, accountId } },
          select: { id: true, status: true, cancellationReason: true },
        });
        const preserveCancellation = existingAssignment?.status === 'CANCELLED'
          && existingAssignment.cancellationReason !== 'SCHEDULE_UPDATED';
        if (existingAssignment && preserveCancellation) {
          await transaction.shiftAssignment.update({
            where: { id: existingAssignment.id },
            data: { registrationId, roomCode: input.roomCode, workContent: input.workContent },
          });
        } else {
          await transaction.shiftAssignment.upsert({
            where: { shiftId_accountId: { shiftId: shift.id, accountId } },
            create: {
              shiftId: shift.id,
              accountId,
              registrationId,
              roomCode: input.roomCode,
              workContent: input.workContent,
            },
            update: {
              registrationId,
              roomCode: input.roomCode,
              workContent: input.workContent,
              status: 'ACTIVE',
              cancelledAt: null,
              cancellationReason: null,
            },
          });
        }
      }

      const existingFuture = await transaction.shiftAssignment.findMany({
        where: {
          registrationId,
          accountId,
          status: 'ACTIVE',
          shift: { workDate: { gte: parseYmd(today) } },
        },
        select: { id: true, shiftId: true },
      });
      const removedIds = existingFuture
        .filter((assignment) => !desiredShiftIds.has(assignment.shiftId))
        .map((assignment) => assignment.id);
      if (removedIds.length > 0) {
        await transaction.shiftAssignment.updateMany({
          where: { id: { in: removedIds }, status: 'ACTIVE' },
          data: { status: 'CANCELLED', cancelledAt: this.now(), cancellationReason: 'SCHEDULE_UPDATED' },
        });
      }

      const saved = await transaction.scheduleRegistration.findUniqueOrThrow({
        where: { id: registrationId }, include: { patternSlots: true },
      });
        return toScheduleRegistrationDto(saved);
      }, { maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      if (input.version === null && isConcurrentRegistrationCreationConflict(error)) {
        let current: { version: number } | null;
        try {
          current = await this.client.scheduleRegistration.findFirst({
            where: { accountId, status: 'ACTIVE' }, select: { version: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          });
        } catch {
          throw error;
        }
        if (current) throw versionConflict(current.version);
      }
      throw error;
    }
  }

  async listMyShifts(accountId: string, query: MyShiftsQuery) {
    const { from, to } = resolveRange(query);
    const assignments = await this.client.shiftAssignment.findMany({
      where: {
        accountId,
        status: 'ACTIVE',
        shift: { workDate: { gte: parseYmd(from), lte: parseYmd(to) } },
      },
      include: { shift: true },
      orderBy: [{ shift: { workDate: 'asc' } }, { shift: { period: 'asc' } }],
    });
    const today = bangkokDate(this.now());
    return assignments.map((assignment) => toMyShiftDto(assignment, today));
  }

  async getMonthlySummary(query: ScheduleSummaryQuery) {
    const { from, to } = monthRange(query.month);
    const assignments = await this.client.shiftAssignment.findMany({
      where: { status: 'ACTIVE', shift: { workDate: { gte: from, lt: to } } },
      include: { shift: true, account: { select: { id: true, displayName: true } } },
      orderBy: [{ shift: { workDate: 'asc' } }, { shift: { period: 'asc' } }, { account: { displayName: 'asc' } }],
    });
    const grouped = new Map<string, { shiftId: string; period: 'MORNING' | 'AFTERNOON'; count: number }[]>();
    for (const assignment of assignments) {
      const date = toYmd(assignment.shift.workDate);
      const slots = grouped.get(date) ?? [];
      const found = slots.find((slot) => slot.shiftId === assignment.shiftId);
      if (found) found.count += 1;
      else slots.push({ shiftId: assignment.shiftId, period: assignment.shift.period, count: 1 });
      grouped.set(date, slots);
    }
    const today = bangkokDate(this.now());
    return {
      month: query.month,
      today: assignments.filter((assignment) => toYmd(assignment.shift.workDate) === today).map((assignment) => ({
        shiftId: assignment.shiftId, accountId: assignment.accountId, displayName: assignment.account.displayName,
        period: assignment.shift.period, roomCode: assignment.roomCode,
      })),
      days: [...grouped.entries()].map(([date, slots]) => ({ date, slots })),
    };
  }

  async getShift(actor: ScheduleActor, shiftId: string) {
    const shift = await this.client.shift.findUnique({
      where: { id: shiftId },
      include: {
        assignments: {
          include: { account: { select: { id: true, displayName: true } } },
          orderBy: { account: { displayName: 'asc' } },
        },
      },
    });
    if (!shift) throw notFound();
    const ownAssignment = actor.role === 'CTV'
      ? shift.assignments.find((assignment) => assignment.accountId === actor.id)
      : undefined;
    if (actor.role === 'CTV' && !ownAssignment) throw notFound();

    const workDate = toYmd(shift.workDate);
    const activeAssignments = shift.assignments.filter((assignment) => assignment.status === 'ACTIVE');
    return {
      shiftId: shift.id,
      workDate,
      weekday: shift.workDate.getUTCDay(),
      period: shift.period,
      status: shift.status,
      assignment: ownAssignment ? {
        assignmentId: ownAssignment.id,
        registrationId: ownAssignment.registrationId,
        roomCode: ownAssignment.roomCode,
        workContent: ownAssignment.workContent,
        status: ownAssignment.status,
      } : null,
      canCancel: Boolean(ownAssignment && ownAssignment.status === 'ACTIVE' && workDate >= bangkokDate(this.now())),
      cancelScopes: ownAssignment && ownAssignment.status === 'ACTIVE' && workDate >= bangkokDate(this.now())
        ? ['ONE', 'SERIES'] as const
        : [] as const,
      coWorkers: activeAssignments
        .filter((assignment) => actor.role === 'ADMIN' || assignment.accountId !== actor.id)
        .map((assignment) => actor.role === 'ADMIN' ? toAdminRosterAssignmentDto(assignment) : toCoWorkerDto(assignment)),
    };
  }

  async cancelOne(accountId: string, assignmentId: string) {
    const assignment = await this.client.shiftAssignment.findFirst({
      where: { id: assignmentId, accountId }, include: { shift: true },
    });
    if (!assignment) throw notFound();
    if (assignment.status === 'CANCELLED') {
      return { scope: 'ONE' as const, fromDate: toYmd(assignment.shift.workDate), affectedCount: 0 };
    }
    if (toYmd(assignment.shift.workDate) < bangkokDate(this.now())) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Past shifts cannot be cancelled.');
    }
    const result = await this.client.shiftAssignment.updateMany({
      where: { id: assignmentId, accountId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: this.now(), cancellationReason: 'CTV_CANCELLED_ONE' },
    });
    return { scope: 'ONE' as const, fromDate: toYmd(assignment.shift.workDate), affectedCount: result.count };
  }

  async cancelSeries(accountId: string, registrationId: string, query: CancelSeriesQuery) {
    const from = parseYmd(query.fromDate);
    if (from.getUTCDay() !== query.weekday) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'fromDate must match weekday.');
    }
    if (query.fromDate < bangkokDate(this.now())) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Past shifts cannot be cancelled.');
    }
    const registration = await this.client.scheduleRegistration.findFirst({
      where: { id: registrationId, accountId }, select: { id: true },
    });
    if (!registration) throw notFound();
    const candidates = await this.client.shiftAssignment.findMany({
      where: {
        registrationId,
        accountId,
        status: 'ACTIVE',
        shift: { period: query.period, workDate: { gte: from } },
      },
      include: { shift: true },
    });
    const ids = candidates
      .filter((assignment) => assignment.shift.workDate.getUTCDay() === query.weekday)
      .map((assignment) => assignment.id);
    const result = ids.length === 0 ? { count: 0 } : await this.client.shiftAssignment.updateMany({
      where: { id: { in: ids }, accountId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: this.now(), cancellationReason: 'CTV_CANCELLED_SERIES' },
    });
    return { scope: 'SERIES' as const, fromDate: query.fromDate, affectedCount: result.count };
  }
}

function parseYmd(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Date must use YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toYmd(date) !== value) throw new TypeError('Date must be a real calendar date.');
  return date;
}

function bangkokDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SUPPORTED_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function resolveRange(query: MyShiftsQuery): { from: string; to: string } {
  if (query.month) {
    const [year, month] = query.month.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0));
    return { from: `${query.month}-01`, to: toYmd(last) };
  }
  return { from: query.from!, to: query.to! };
}

function monthRange(month: string): { from: Date; to: Date } {
  const [year, number] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(year, number - 1, 1)), to: new Date(Date.UTC(year, number, 1)) };
}

function versionConflict(currentVersion: number | null) {
  return new ApiError(409, 'VERSION_CONFLICT', 'Dữ liệu đã được cập nhật bởi yêu cầu khác', { currentVersion });
}

function notFound() {
  return new ApiError(404, 'RESOURCE_NOT_FOUND', 'Schedule resource was not found.');
}

function isConcurrentRegistrationCreationConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002' || error.code === 'P2034' || error.code === 'P2028';
  }
  return error instanceof Error && /database (?:is )?(?:locked|busy)/i.test(error.message);
}

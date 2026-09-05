import type { Schedule } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import {
  type UpsertScheduleInput,
  type UpsertRegistrationInput,
  validateScheduleInput,
  dedupeSlots,
} from './schedule.types.js';

export interface ScheduleDto {
  id: string;
  accountId: string;
  roomCode: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  patternSlots: { weekday: number; period: string }[];
  shifts: { weekday: number; period: string }[];
}

// ---------------------------------------------------------------------------
// upsertSchedule / upsertRegistration
// ---------------------------------------------------------------------------

export async function upsertSchedule(
  accountId: string,
  input: UpsertScheduleInput,
): Promise<ScheduleDto> {
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

export const upsertRegistration: (
  accountId: string,
  input: UpsertRegistrationInput,
) => Promise<ScheduleDto> = upsertSchedule;

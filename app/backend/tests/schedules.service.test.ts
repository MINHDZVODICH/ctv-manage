import assert from 'node:assert/strict';
import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, test } from 'vitest';
import { expandPattern, ScheduleService } from '../src/modules/schedules/schedule.service.js';

describe('expandPattern', () => {
  test('expands only selected weekdays and periods in Asia/Bangkok', () => {
    assert.deepEqual(expandPattern({
      startDate: '2026-08-24',
      endDate: '2026-08-28',
      timeZone: 'Asia/Bangkok',
      slots: [{ weekday: 1, period: 'MORNING' }],
    }), [{ workDate: '2026-08-24', period: 'MORNING' }]);
  });

  test('orders occurrences by date then period without depending on the host timezone', () => {
    assert.deepEqual(expandPattern({
      startDate: '2026-08-24',
      endDate: '2026-09-01',
      timeZone: 'Asia/Bangkok',
      slots: [
        { weekday: 2, period: 'MORNING' },
        { weekday: 1, period: 'AFTERNOON' },
        { weekday: 1, period: 'MORNING' },
      ],
    }), [
      { workDate: '2026-08-24', period: 'MORNING' },
      { workDate: '2026-08-24', period: 'AFTERNOON' },
      { workDate: '2026-08-25', period: 'MORNING' },
      { workDate: '2026-08-31', period: 'MORNING' },
      { workDate: '2026-08-31', period: 'AFTERNOON' },
      { workDate: '2026-09-01', period: 'MORNING' },
    ]);
  });

  test('rejects weekend pattern slots', () => {
    assert.throws(() => expandPattern({
      startDate: '2026-08-24',
      endDate: '2026-08-30',
      timeZone: 'Asia/Bangkok',
      slots: [{ weekday: 6, period: 'MORNING' }],
    }), /weekday/i);
  });
});

describe('schedule creation concurrency errors', () => {
  for (const error of [
    new Prisma.PrismaClientKnownRequestError('unrelated unique failure', { code: 'P2002', clientVersion: 'test' }),
    new Prisma.PrismaClientKnownRequestError('transaction expired', { code: 'P2028', clientVersion: 'test' }),
    new Error('database is locked'),
  ]) {
    test(`propagates ${'code' in error ? error.code : error.message} when no competing active registration exists`, async () => {
      const service = new ScheduleService(failingClient(error));
      await assert.rejects(
        service.upsertRegistration('ctv-no-winner', registrationInput()),
        (caught) => caught === error,
      );
    });
  }
});

function registrationInput() {
  return {
    startDate: '2026-08-24', endDate: '2026-08-31', timeZone: 'Asia/Bangkok' as const,
    roomCode: 'ROOM_1' as const, workContent: 'Hỗ trợ', slots: [{ weekday: 1, period: 'MORNING' as const }], version: null,
  };
}

function failingClient(error: Error): PrismaClient {
  return {
    $transaction: async () => { throw error; },
    scheduleRegistration: { findFirst: async () => null },
  } as unknown as PrismaClient;
}

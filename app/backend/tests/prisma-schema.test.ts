import assert from 'node:assert/strict';
import { afterAll, beforeEach, test } from 'vitest';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

beforeEach(async () => {
  await resetTestDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

test('schema rejects duplicate shared shifts for the same date and period', async () => {
  await prisma.shift.create({ data: { workDate: new Date('2026-08-25'), period: 'MORNING' } });

  await assert.rejects(() =>
    prisma.shift.create({ data: { workDate: new Date('2026-08-25'), period: 'MORNING' } }),
  );
});

test('schema rejects a room code outside the fixed room set', async () => {
  const account = await prisma.account.create({
    data: {
      email: 'ctv@example.test',
      passwordHash: 'hash',
      role: 'CTV',
      displayName: 'CTV Test',
    },
  });

  await assert.rejects(() => prisma.scheduleRegistration.create({
    data: {
      accountId: account.id,
      startDate: new Date('2026-08-25'),
      endDate: new Date('2026-08-29'),
      timeZone: 'Asia/Ho_Chi_Minh',
      roomCode: 'ROOM_5' as never,
      workContent: 'Hỗ trợ',
    },
  }));
});

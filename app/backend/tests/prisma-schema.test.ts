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

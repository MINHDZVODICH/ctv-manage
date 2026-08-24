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

test('idempotency keys are isolated by scope and fingerprint with hash-only storage', async () => {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("IdempotencyRecord")');
  const names = columns.map(({ name }) => name);
  assert.ok(names.includes('keyHash'));
  assert.ok(names.includes('scope'));
  assert.ok(names.includes('fingerprintHash'));
  assert.ok(names.includes('status'));
  assert.equal(names.includes('key'), false);

  const expiresAt = new Date('2026-08-26T00:00:00Z').getTime();
  const createdAt = new Date('2026-08-25T00:00:00Z').getTime();
  for (const [id, scope, fingerprintHash] of [
    ['idem-a', 'registration:create', 'fingerprint-a'],
    ['idem-b', 'password-reset', 'fingerprint-a'],
    ['idem-c', 'registration:create', 'fingerprint-b'],
  ]) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO "IdempotencyRecord" ("id", "scope", "fingerprintHash", "keyHash", "requestHash", "status", "expiresAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, scope, fingerprintHash, 'hashed-key', 'request-hash', 'IN_PROGRESS', expiresAt, createdAt, createdAt,
    );
  }

  await assert.rejects(() => prisma.$executeRawUnsafe(
    'INSERT INTO "IdempotencyRecord" ("id", "scope", "fingerprintHash", "keyHash", "requestHash", "status", "expiresAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    'idem-duplicate', 'registration:create', 'fingerprint-a', 'hashed-key', 'request-hash', 'IN_PROGRESS', expiresAt, createdAt, createdAt,
  ));
});

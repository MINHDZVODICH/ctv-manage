import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '../src/shared/prisma.js';
import { resetDatabase, seedActors } from './helpers.js';

describe('Phase 2 Database-Level Domain Integrity (PostgreSQL Enums & CHECK constraints)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
    const ctv = await prisma.account.findFirstOrThrow({ where: { role: 'CTV' } });
    await prisma.schedule.create({
      data: {
        accountId: ctv.id,
        roomCode: 'ROOM_1',
      },
    });
  });

  test('1. PostgreSQL rejects invalid Account.role (e.g. ADMN)', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Account" ("id", "email", "passwordHash", "role", "status", "displayName")
         VALUES ('acc_test_invalid_role', 'test.invalid.role@ctv.local', 'hash', 'ADMN'::"Role", 'ACTIVE'::"AccountStatus", 'Test')`,
      ),
    ).rejects.toThrow();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Account" ("id", "email", "passwordHash", "role", "status", "displayName")
         VALUES ('acc_test_invalid_role2', 'test.invalid.role2@ctv.local', 'hash', 'ADMN', 'ACTIVE'::"AccountStatus", 'Test')`,
      ),
    ).rejects.toThrow();
  });

  test('2. PostgreSQL rejects invalid Account.status (e.g. UNKNOWN_STATUS)', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Account" ("id", "email", "passwordHash", "role", "status", "displayName")
         VALUES ('acc_test_invalid_stat', 'test.invalid.status@ctv.local', 'hash', 'CTV'::"Role", 'UNKNOWN_STATUS'::"AccountStatus", 'Test')`,
      ),
    ).rejects.toThrow();
  });

  test('3. PostgreSQL rejects invalid Schedule.roomCode (e.g. ROOM_999)', async () => {
    const ctv = await prisma.account.findFirstOrThrow({ where: { role: 'CTV' } });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Schedule" ("id", "accountId", "roomCode", "version", "createdAt", "updatedAt")
         VALUES ('sched_inv_room', '${ctv.id}', 'ROOM_999'::"RoomCode", 1, NOW(), NOW())`,
      ),
    ).rejects.toThrow();
  });

  test('4. PostgreSQL rejects invalid Shift.period (e.g. MORNINGGG)', async () => {
    const schedule = await prisma.schedule.findFirstOrThrow();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Shift" ("scheduleId", "weekday", "period")
         VALUES ('${schedule.id}', 1, 'MORNINGGG'::"Period")`,
      ),
    ).rejects.toThrow();
  });

  test('5. PostgreSQL CHECK constraint rejects Shift.weekday outside 1..5', async () => {
    const schedule = await prisma.schedule.findFirstOrThrow();
    // Test weekday = 0 (Sunday)
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Shift" ("scheduleId", "weekday", "period")
         VALUES ('${schedule.id}', 0, 'MORNING'::"Period")`,
      ),
    ).rejects.toThrow(/Shift_weekday_check/);

    // Test weekday = 6 (Saturday)
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Shift" ("scheduleId", "weekday", "period")
         VALUES ('${schedule.id}', 6, 'MORNING'::"Period")`,
      ),
    ).rejects.toThrow(/Shift_weekday_check/);
  });

  test('6. PostgreSQL rejects invalid SnapshotRun.status (e.g. SUCEED)', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "SnapshotRun" ("id", "workDate", "status", "attemptCount", "createdAt", "updatedAt")
         VALUES ('snap_inv_status', '2026-09-15', 'SUCEED'::"SnapshotRunStatus", 1, NOW(), NOW())`,
      ),
    ).rejects.toThrow();
  });

  test('7. PostgreSQL CHECK constraint rejects SnapshotRun negative counters', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "SnapshotRun" ("id", "workDate", "status", "attemptCount", "createdAt", "updatedAt")
         VALUES ('snap_inv_attempts', '2026-09-16', 'PENDING'::"SnapshotRunStatus", -1, NOW(), NOW())`,
      ),
    ).rejects.toThrow(/SnapshotRun_attemptCount_check/);

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "SnapshotRun" ("id", "workDate", "status", "insertedCount", "createdAt", "updatedAt")
         VALUES ('snap_inv_inserted', '2026-09-17', 'PENDING'::"SnapshotRunStatus", -5, NOW(), NOW())`,
      ),
    ).rejects.toThrow(/SnapshotRun_insertedCount_check/);
  });

  test('8. PostgreSQL rejects invalid RateLimitWindow.scope and negative requestCount', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "RateLimitWindow" ("id", "scope", "identityDigest", "windowStart", "expiresAt")
         VALUES ('rl_inv_scope', 'INVALID_SCOPE'::"RateLimitScope", 'digest', NOW(), NOW())`,
      ),
    ).rejects.toThrow();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "RateLimitWindow" ("id", "scope", "identityDigest", "windowStart", "requestCount", "expiresAt")
         VALUES ('rl_inv_count', 'LOGIN_IP'::"RateLimitScope", 'digest', NOW(), -1, NOW())`,
      ),
    ).rejects.toThrow(/RateLimitWindow_requestCount_check/);
  });

  test('9. PostgreSQL rejects invalid RegistrationRequest.status and FileCategory', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "RegistrationRequest" ("id", "email", "displayName", "status", "updatedAt")
         VALUES ('req_inv_status', 'invalid.status@test.local', 'Test', 'PENDINGGG'::"RegistrationStatus", NOW())`,
      ),
    ).rejects.toThrow();

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "AccountFile" ("accountId", "fileId", "category")
         VALUES ('acc_dummy', 'file_dummy', 'INVALID_CATEGORY'::"FileCategory")`,
      ),
    ).rejects.toThrow();
  });
});

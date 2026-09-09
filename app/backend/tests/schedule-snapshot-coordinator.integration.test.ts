import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../src/shared/prisma.js';
import { resetDatabase, seedActors } from './helpers.js';
import { parseYmdToUtcDate } from '../src/shared/timezone.js';
import { SnapshotCoordinatorService } from '../src/modules/schedule/snapshot-coordinator.service.js';

describe('SnapshotCoordinatorService Integration Tests', () => {
  let coordinator: SnapshotCoordinatorService;

  beforeEach(async () => {
    await resetDatabase();
    coordinator = new SnapshotCoordinatorService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // 1. Reconcile creates a PENDING run once Bangkok time >= 17:30 (10:30 UTC)
  describe('1. Reconciliation Pass Cutoff and Initialization', () => {
    it('does not create a run before 17:30 Bangkok time (10:30 UTC)', async () => {
      // Monday 2026-09-07 10:29:59 UTC = 17:29:59 Bangkok
      const beforeCutoff = new Date('2026-09-07T10:29:59.000Z');
      await coordinator.reconcilePass(beforeCutoff);

      const run = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-07') },
      });
      expect(run).toBeNull();
    });

    it('does not create a run on weekends even after 17:30 Bangkok time', async () => {
      // Sunday 2026-09-06 11:00:00 UTC = 18:00:00 Bangkok
      const weekendAfterCutoff = new Date('2026-09-06T11:00:00.000Z');
      await coordinator.reconcilePass(weekendAfterCutoff);

      const run = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-06') },
      });
      expect(run).toBeNull();
    });

    it('creates a PENDING run for today once Bangkok time reaches 17:30 on a weekday', async () => {
      // Monday 2026-09-07 10:30:00 UTC = 17:30:00 Bangkok
      const atCutoff = new Date('2026-09-07T10:30:00.000Z');

      // Prevent immediate claim/execution so we can verify the created PENDING state
      vi.spyOn(coordinator, 'claimRun').mockResolvedValueOnce(false);

      await coordinator.reconcilePass(atCutoff);

      const run = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-07') },
      });
      expect(run).not.toBeNull();
      expect(run?.status).toBe('PENDING');
      expect(run?.attemptCount).toBe(0);
      expect(run?.nextAttemptAt).toEqual(atCutoff);
      expect(run?.leaseToken).toBeNull();
    });
  });

  // 2. Atomic claiming: first instance claims, second fails
  describe('2. Atomic Claiming', () => {
    it('allows first instance to claim with leaseToken, and second concurrent instance fails', async () => {
      const now = new Date('2026-09-07T10:30:00.000Z');
      const workDate = '2026-09-07';

      // Seed a PENDING run
      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate(workDate),
          status: 'PENDING',
          nextAttemptAt: now,
        },
      });

      const tokenA = 'token-instance-a-uuid';
      const tokenB = 'token-instance-b-uuid';

      const claimedA = await coordinator.claimRun(workDate, tokenA, now);
      const claimedB = await coordinator.claimRun(workDate, tokenB, now);

      expect(claimedA).toBe(true);
      expect(claimedB).toBe(false);

      const run = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate(workDate) },
      });
      expect(run?.status).toBe('RUNNING');
      expect(run?.leaseToken).toBe(tokenA);
      expect(run?.attemptCount).toBe(1);
      // 2-minute lease duration
      expect(run?.leaseExpiresAt).toEqual(new Date(now.getTime() + 2 * 60 * 1000));
      expect(run?.startedAt).toEqual(now);
    });

    it('rejects claim if nextAttemptAt is in the future for FAILED run', async () => {
      const now = new Date('2026-09-07T10:30:00.000Z');
      const futureAttempt = new Date('2026-09-07T10:35:00.000Z');
      const workDate = '2026-09-07';

      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate(workDate),
          status: 'FAILED',
          nextAttemptAt: futureAttempt,
          attemptCount: 1,
        },
      });

      const claimed = await coordinator.claimRun(workDate, 'token-early', now);
      expect(claimed).toBe(false);
    });
  });

  // 3. Expired lease reclamation
  describe('3. Expired Lease Reclamation', () => {
    it('allows another instance to reclaim run if leaseExpiresAt is in the past', async () => {
      const now = new Date('2026-09-07T10:35:00.000Z');
      const workDate = '2026-09-07';

      // Seed a RUNNING run whose lease has expired
      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate(workDate),
          status: 'RUNNING',
          leaseToken: 'stale-token-dead-instance',
          leaseExpiresAt: new Date(now.getTime() - 10_000), // 10s expired
          startedAt: new Date(now.getTime() - 130_000),
          attemptCount: 1,
        },
      });

      const newToken = 'recovery-token-new-instance';
      const claimed = await coordinator.claimRun(workDate, newToken, now);

      expect(claimed).toBe(true);

      const run = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate(workDate) },
      });
      expect(run?.status).toBe('RUNNING');
      expect(run?.leaseToken).toBe(newToken);
      expect(run?.attemptCount).toBe(2);
      expect(run?.leaseExpiresAt).toEqual(new Date(now.getTime() + 2 * 60 * 1000));
    });
  });

  // 4. Exponential backoff calculation
  describe('4. Exponential Backoff Calculation', () => {
    it('calculates +1m, +5m, +15m, +30m intervals capped at Bangkok midnight', () => {
      // 2026-09-07 10:30:00 UTC = 17:30 Bangkok
      const baseNow = new Date('2026-09-07T10:30:00.000Z');

      // Attempt 1: +1 minute
      const next1 = coordinator.calculateNextAttemptAt(1, baseNow);
      expect(next1).toEqual(new Date('2026-09-07T10:31:00.000Z'));

      // Attempt 2: +5 minutes
      const next2 = coordinator.calculateNextAttemptAt(2, baseNow);
      expect(next2).toEqual(new Date('2026-09-07T10:35:00.000Z'));

      // Attempt 3: +15 minutes
      const next3 = coordinator.calculateNextAttemptAt(3, baseNow);
      expect(next3).toEqual(new Date('2026-09-07T10:45:00.000Z'));

      // Attempt 4: +30 minutes
      const next4 = coordinator.calculateNextAttemptAt(4, baseNow);
      expect(next4).toEqual(new Date('2026-09-07T11:00:00.000Z'));

      // Attempt 5+: +30 minutes
      const next5 = coordinator.calculateNextAttemptAt(5, baseNow);
      expect(next5).toEqual(new Date('2026-09-07T11:00:00.000Z'));

      // Bangkok midnight capping:
      // Bangkok date 2026-09-07 ends at 2026-09-08 00:00:00 Bangkok = 2026-09-07 17:00:00 UTC
      const lateTime = new Date('2026-09-07T16:45:00.000Z'); // 23:45 Bangkok
      // Attempt 4 (+30m) would normally be 17:15:00 UTC, which exceeds midnight
      const capped = coordinator.calculateNextAttemptAt(4, lateTime);
      expect(capped).toEqual(new Date('2026-09-07T17:00:00.000Z'));

      // Once midnight has arrived or passed, returns null (no more retries for this date)
      const atMidnight = new Date('2026-09-07T17:00:00.000Z');
      expect(coordinator.calculateNextAttemptAt(1, atMidnight)).toBeNull();

      const afterMidnight = new Date('2026-09-07T17:05:00.000Z');
      expect(coordinator.calculateNextAttemptAt(1, afterMidnight)).toBeNull();
    });
  });

  // 5. Transaction rollback and recordFailure
  describe('5. Transaction Rollback and Error Recording', () => {
    it('rolls back inserted history rows upon error and records FAILED status with retry timestamp', async () => {
      const now = new Date('2026-09-07T10:30:00.000Z');
      const workDate = '2026-09-07';
      const targetDate = parseYmdToUtcDate(workDate);

      // Seed actors and schedule
      const { ctv } = await seedActors();
      await prisma.schedule.create({
        data: {
          accountId: ctv.id,
          roomCode: 'ROOM_1',
          shifts: {
            create: [{ weekday: 1, period: 'MORNING' }],
          },
        },
      });

      // Create and claim run
      await prisma.snapshotRun.create({
        data: {
          workDate: targetDate,
          status: 'PENDING',
          nextAttemptAt: now,
        },
      });

      const leaseToken = 'test-rollback-token';
      const claimed = await coordinator.claimRun(workDate, leaseToken, now);
      expect(claimed).toBe(true);

      // Simulate failure in history insertion by injecting an error inside transaction
      const failingDb = {
        ...prisma,
        $transaction: async (callback: any, options: any) => {
          return prisma.$transaction(async (realTx: any) => {
            const failingTx = {
              ...realTx,
              history: {
                ...realTx.history,
                createMany: async () => {
                  throw new Error('SIMULATED_DB_ERROR');
                },
              },
            };
            return callback(failingTx);
          }, options);
        },
      };
      const failingCoordinator = new SnapshotCoordinatorService(failingDb as any);

      await expect(failingCoordinator.executeAttempt(workDate, leaseToken, now)).rejects.toThrow(
        'SIMULATED_DB_ERROR',
      );

      // Verify transaction rollback: no history rows exist
      const historyRows = await prisma.history.findMany({
        where: { workDate: targetDate },
      });
      expect(historyRows).toHaveLength(0);

      // Record failure
      await coordinator.recordFailure(workDate, leaseToken, 'SIMULATED_DB_ERROR', now);

      // Verify persistent run state
      const failedRun = await prisma.snapshotRun.findUnique({
        where: { workDate: targetDate },
      });
      expect(failedRun?.status).toBe('FAILED');
      expect(failedRun?.errorCode).toBe('SIMULATED_DB_ERROR');
      // attemptCount was 1 when claimed, so next retry is +1m
      expect(failedRun?.nextAttemptAt).toEqual(new Date(now.getTime() + 60 * 1000));
      expect(failedRun?.leaseToken).toBeNull();
      expect(failedRun?.leaseExpiresAt).toBeNull();
    });
  });

  // 6. Zero-entry snapshot
  describe('6. Zero-Entry Snapshot and Normal Execution', () => {
    it('completes as SUCCEEDED with insertedCount: 0 when no accounts have active schedules', async () => {
      const now = new Date('2026-09-07T10:30:00.000Z');
      const workDate = '2026-09-07';
      const targetDate = parseYmdToUtcDate(workDate);

      // No CTVs seeded or CTVs have no schedule
      await prisma.snapshotRun.create({
        data: {
          workDate: targetDate,
          status: 'PENDING',
          nextAttemptAt: now,
        },
      });

      const leaseToken = 'zero-entry-token';
      const claimed = await coordinator.claimRun(workDate, leaseToken, now);
      expect(claimed).toBe(true);

      const result = await coordinator.executeAttempt(workDate, leaseToken, now);
      expect(result.insertedCount).toBe(0);

      const completedRun = await prisma.snapshotRun.findUnique({
        where: { workDate: targetDate },
      });
      expect(completedRun?.status).toBe('SUCCEEDED');
      expect(completedRun?.insertedCount).toBe(0);
      expect(completedRun?.completedAt).not.toBeNull();
      expect(completedRun?.leaseToken).toBeNull();
      expect(completedRun?.leaseExpiresAt).toBeNull();
      expect(completedRun?.errorCode).toBeNull();
    });

    it('inserts active CTV shifts, marks SUCCEEDED, and prevents duplicate insertion', async () => {
      const now = new Date('2026-09-07T10:30:00.000Z');
      const workDate = '2026-09-07';
      const targetDate = parseYmdToUtcDate(workDate);

      const { ctv, otherCtv } = await seedActors();

      // CTV 1 has Monday Morning + Monday Afternoon
      await prisma.schedule.create({
        data: {
          accountId: ctv.id,
          roomCode: 'ROOM_1',
          shifts: {
            create: [
              { weekday: 1, period: 'MORNING' },
              { weekday: 1, period: 'AFTERNOON' },
            ],
          },
        },
      });

      // CTV 2 has Monday Morning
      await prisma.schedule.create({
        data: {
          accountId: otherCtv.id,
          roomCode: 'ROOM_2',
          shifts: {
            create: [{ weekday: 1, period: 'MORNING' }],
          },
        },
      });

      // Run full reconcilePass
      await coordinator.reconcilePass(now);

      const run = await prisma.snapshotRun.findUnique({
        where: { workDate: targetDate },
      });
      expect(run?.status).toBe('SUCCEEDED');
      expect(run?.insertedCount).toBe(3);
      expect(run?.completedAt).not.toBeNull();
      expect(run?.leaseToken).toBeNull();

      const historyRows = await prisma.history.findMany({
        where: { workDate: targetDate },
      });
      expect(historyRows).toHaveLength(3);
    });
  });

  // 7. Mid-flight midnight date guard and execution timing (Issue 2)
  describe('7. Mid-Flight Midnight Date Guard and Execution Timing', () => {
    it('marks run as MISSED with DATE_PASSED if midnight passes before execution executes', async () => {
      // Work date is Monday 2026-09-07
      const workDate = '2026-09-07';
      const targetDate = parseYmdToUtcDate(workDate);
      const claimTime = new Date('2026-09-07T16:59:00.000Z'); // 23:59:00 Bangkok

      // Create and claim run before midnight
      await prisma.snapshotRun.create({
        data: {
          workDate: targetDate,
          status: 'PENDING',
          nextAttemptAt: claimTime,
        },
      });

      const leaseToken = 'midnight-cross-token';
      const claimed = await coordinator.claimRun(workDate, leaseToken, claimTime);
      expect(claimed).toBe(true);

      // Now execution happens at 00:01:00 Bangkok Tuesday (17:01:00 UTC)
      const afterMidnight = new Date('2026-09-07T17:01:00.000Z');
      const result = await coordinator.executeAttempt(workDate, leaseToken, afterMidnight);

      expect(result.insertedCount).toBe(0);

      const run = await prisma.snapshotRun.findUnique({
        where: { workDate: targetDate },
      });
      expect(run?.status).toBe('MISSED');
      expect(run?.errorCode).toBe('DATE_PASSED');
      expect(run?.leaseToken).toBeNull();
    });
  });

  // 8. Transaction Isolation and Lease Ownership Protection (Issue 3)
  describe('8. Transaction Isolation and Lease Ownership Protection', () => {
    it('throws LEASE_LOST if leaseToken is stolen or modified before completion', async () => {
      const now = new Date('2026-09-07T10:30:00.000Z');
      const workDate = '2026-09-07';
      const targetDate = parseYmdToUtcDate(workDate);

      const { ctv } = await seedActors();
      await prisma.schedule.create({
        data: {
          accountId: ctv.id,
          roomCode: 'ROOM_1',
          shifts: {
            create: [{ weekday: 1, period: 'MORNING' }],
          },
        },
      });

      await prisma.snapshotRun.create({
        data: {
          workDate: targetDate,
          status: 'PENDING',
          nextAttemptAt: now,
        },
      });

      const leaseToken = 'original-owner-token';
      const claimed = await coordinator.claimRun(workDate, leaseToken, now);
      expect(claimed).toBe(true);

      // We intercept the transaction so that updateMany finds 0 rows (simulating stolen lease)
      const interceptingDb = {
        ...prisma,
        $transaction: async (callback: any, options: any) => {
          return prisma.$transaction(async (realTx: any) => {
            const originalUpdateMany = realTx.snapshotRun.updateMany.bind(realTx.snapshotRun);
            const wrappedTx = {
              ...realTx,
              snapshotRun: {
                ...realTx.snapshotRun,
                updateMany: async (args: any) => {
                  return originalUpdateMany({
                    ...args,
                    where: {
                      ...args.where,
                      leaseToken: 'stolen-token-mismatch',
                    },
                  });
                },
              },
            };
            return callback(wrappedTx);
          }, options);
        },
      };

      const customCoordinator = new SnapshotCoordinatorService(interceptingDb as any);
      await expect(customCoordinator.executeAttempt(workDate, leaseToken, now)).rejects.toThrow(
        'LEASE_LOST',
      );

      // Verify rollback: no history rows inserted
      const history = await prisma.history.findMany({
        where: { workDate: targetDate },
      });
      expect(history).toHaveLength(0);
    });
  });
});


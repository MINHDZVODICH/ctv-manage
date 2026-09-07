import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient, SnapshotRun } from '@prisma/client';
import { prisma as defaultPrisma } from '../../shared/prisma.js';
import { todayInBangkok, parseYmdToUtcDate } from '../../shared/timezone.js';

export interface ClaimResult {
  claimed: boolean;
  leaseToken?: string;
  run?: SnapshotRun;
}

export class SnapshotCoordinatorService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /**
   * Queries current database time via SELECT NOW().
   */
  async getDbTime(tx?: Prisma.TransactionClient): Promise<Date> {
    const client = tx ?? this.db;
    const rows = await client.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    return rows[0]?.now ?? new Date();
  }

  /**
   * Calculates exponential retry delay:
   * Attempt 1: +1m
   * Attempt 2: +5m
   * Attempt 3: +15m
   * Attempt 4+: +30m
   * Capped at Bangkok midnight (returns null once midnight has arrived/passed).
   */
  calculateNextAttemptAt(attemptCount: number, now?: Date): Date | null {
    const base = now ?? new Date();

    // Asia/Bangkok is UTC+7 (no DST)
    const bkkMs = base.getTime() + 7 * 3600 * 1000;
    const bkkDate = new Date(bkkMs);
    const hours = bkkDate.getUTCHours();
    const minutes = bkkDate.getUTCMinutes();
    const y = bkkDate.getUTCFullYear();
    const m = bkkDate.getUTCMonth();
    const d = bkkDate.getUTCDate();

    // Snapshots run between 17:30 and 24:00 Bangkok time.
    // If before 17:30 Bangkok, the current date has reached/passed midnight for previous date runs.
    const isPastCutoff = hours > 17 || (hours === 17 && minutes >= 30);
    if (!isPastCutoff) {
      return null;
    }

    // Bangkok midnight at the end of the current Bangkok day (00:00:00 UTC+7 next day)
    const midnightUtcMs = Date.UTC(y, m, d + 1, 0, 0, 0, 0) - 7 * 3600 * 1000;
    const bangkokMidnight = new Date(midnightUtcMs);

    let delayMs: number;
    if (attemptCount <= 1) {
      delayMs = 60 * 1000; // 1 min
    } else if (attemptCount === 2) {
      delayMs = 5 * 60 * 1000; // 5 min
    } else if (attemptCount === 3) {
      delayMs = 15 * 60 * 1000; // 15 min
    } else {
      delayMs = 30 * 60 * 1000; // 30 min
    }

    const next = new Date(base.getTime() + delayMs);
    if (next.getTime() > bangkokMidnight.getTime()) {
      return bangkokMidnight;
    }

    return next;
  }

  /**
   * Acquires execution rights through an atomic conditional update:
   * - Run matches target workDate
   * - Status is PENDING or FAILED (with nextAttemptAt <= now), OR RUNNING with expired lease
   * Updates: status = 'RUNNING', leaseToken = token, leaseExpiresAt = now + 2m, attemptCount = attemptCount + 1
   */
  async claimRun(workDate: string, leaseToken: string, now?: Date): Promise<boolean> {
    const targetDate = parseYmdToUtcDate(workDate);
    const nowTime = now ?? (await this.getDbTime());
    const leaseExpires = new Date(nowTime.getTime() + 2 * 60 * 1000); // 2 minutes

    const result = await this.db.snapshotRun.updateMany({
      where: {
        workDate: targetDate,
        OR: [
          {
            status: 'PENDING',
            OR: [
              { nextAttemptAt: null },
              { nextAttemptAt: { lte: nowTime } },
            ],
          },
          {
            status: 'FAILED',
            nextAttemptAt: { lte: nowTime },
          },
          {
            status: 'RUNNING',
            leaseExpiresAt: { lt: nowTime },
          },
        ],
      },
      data: {
        status: 'RUNNING',
        leaseToken,
        leaseExpiresAt: leaseExpires,
        attemptCount: { increment: 1 },
        startedAt: nowTime,
      },
    });

    return result.count > 0;
  }

  /**
   * Executes a snapshot attempt inside an isolated database transaction with a 90s timeout.
   * Locks and verifies lease token, verifies Bangkok date is still current,
   * reads active CTVs and shifts, inserts history rows with skipDuplicates,
   * marks run SUCCEEDED, and clears lease.
   */
  async executeAttempt(
    workDate: string,
    leaseToken: string,
    now?: Date,
  ): Promise<{ insertedCount: number }> {
    const targetDate = parseYmdToUtcDate(workDate);

    return await this.db.$transaction(
      async (tx) => {
        const nowTime = now ?? (await this.getDbTime(tx));

        // Lock and verify lease token
        const run = await tx.snapshotRun.findUnique({
          where: { workDate: targetDate },
        });

        if (!run || run.leaseToken !== leaseToken || run.status !== 'RUNNING') {
          throw new Error('LEASE_LOST');
        }

        // Date Guard: Verify Bangkok date is still the current active date
        const currentBangkokDate = todayInBangkok(nowTime);
        if (workDate !== currentBangkokDate) {
          await tx.snapshotRun.update({
            where: { id: run.id },
            data: {
              status: 'MISSED',
              errorCode: 'DATE_PASSED',
              leaseToken: null,
              leaseExpiresAt: null,
              completedAt: nowTime,
            },
          });
          return { insertedCount: 0 };
        }

        // Determine target day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
        const jsDay = targetDate.getUTCDay();

        // Read eligible ACTIVE CTV accounts and their weekly schedules
        const activeCtvs = await tx.account.findMany({
          where: {
            role: 'CTV',
            status: 'ACTIVE',
            deletedAt: null,
            schedule: { isNot: null },
          },
          include: {
            schedule: {
              include: {
                shifts: true,
              },
            },
          },
        });

        const historyEntries: Array<{
          accountId: string;
          workDate: Date;
          period: string;
          roomCode: string;
          status: string;
        }> = [];

        for (const ctv of activeCtvs) {
          if (!ctv.schedule) continue;
          const matchingShifts = ctv.schedule.shifts.filter((s) => s.weekday === jsDay);
          for (const shift of matchingShifts) {
            historyEntries.push({
              accountId: ctv.id,
              workDate: targetDate,
              period: shift.period,
              roomCode: ctv.schedule.roomCode,
              status: 'COMPLETED',
            });
          }
        }

        let insertedCount = 0;
        if (historyEntries.length > 0) {
          const insertResult = await tx.history.createMany({
            data: historyEntries,
            skipDuplicates: true,
          });
          insertedCount = insertResult.count;
        }

        // Complete run atomically in the same transaction
        await tx.snapshotRun.update({
          where: { id: run.id },
          data: {
            status: 'SUCCEEDED',
            completedAt: nowTime,
            insertedCount,
            leaseToken: null,
            leaseExpiresAt: null,
            errorCode: null,
          },
        });

        return { insertedCount };
      },
      { timeout: 90_000 },
    );
  }

  /**
   * Records failure metadata and calculates exponential retry timestamp.
   * Only proceeds if the caller still owns the lease.
   */
  async recordFailure(
    workDate: string,
    leaseToken: string,
    errorCode: string,
    now?: Date,
  ): Promise<void> {
    const targetDate = parseYmdToUtcDate(workDate);
    const nowTime = now ?? (await this.getDbTime());

    const run = await this.db.snapshotRun.findUnique({
      where: { workDate: targetDate },
    });

    if (!run || run.leaseToken !== leaseToken) {
      return;
    }

    const nextAttemptAt = this.calculateNextAttemptAt(run.attemptCount, nowTime);

    await this.db.snapshotRun.updateMany({
      where: {
        workDate: targetDate,
        leaseToken,
      },
      data: {
        status: 'FAILED',
        errorCode,
        nextAttemptAt,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
  }

  /**
   * Executes a reconciliation pass:
   * 1. Evaluates cutoff strictly using database time.
   * 2. If eligible (weekday >= 17:30 Bangkok time) and no SnapshotRun exists, creates PENDING run.
   * 3. Claims and executes eligible runs.
   */
  async reconcilePass(now?: Date): Promise<void> {
    const nowTime = now ?? (await this.getDbTime());

    // Asia/Bangkok is UTC+7 (no DST)
    const bkkMs = nowTime.getTime() + 7 * 3600 * 1000;
    const bkkDate = new Date(bkkMs);
    const hours = bkkDate.getUTCHours();
    const minutes = bkkDate.getUTCMinutes();
    const jsDay = bkkDate.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

    const isWeekday = jsDay >= 1 && jsDay <= 5;
    const isPastCutoff = hours > 17 || (hours === 17 && minutes >= 30);

    if (!isWeekday || !isPastCutoff) {
      return;
    }

    const todayStr = todayInBangkok(nowTime);
    const todayUtc = parseYmdToUtcDate(todayStr);

    let todayRun = await this.db.snapshotRun.findUnique({
      where: { workDate: todayUtc },
    });

    if (!todayRun) {
      try {
        todayRun = await this.db.snapshotRun.create({
          data: {
            workDate: todayUtc,
            status: 'PENDING',
            nextAttemptAt: nowTime,
          },
        });
      } catch {
        todayRun = await this.db.snapshotRun.findUnique({
          where: { workDate: todayUtc },
        });
      }
    }

    const eligibleToRun =
      todayRun &&
      (todayRun.status === 'PENDING' ||
        (todayRun.status === 'FAILED' && !!todayRun.nextAttemptAt && todayRun.nextAttemptAt <= nowTime) ||
        (todayRun.status === 'RUNNING' && !!todayRun.leaseExpiresAt && todayRun.leaseExpiresAt < nowTime));

    if (eligibleToRun) {
      const leaseToken = randomUUID();
      const claimed = await this.claimRun(todayStr, leaseToken, nowTime);
      if (claimed) {
        try {
          await this.executeAttempt(todayStr, leaseToken, nowTime);
        } catch (err: any) {
          const errorCode = err?.code || err?.message || 'SNAPSHOT_EXECUTION_FAILED';
          await this.recordFailure(todayStr, leaseToken, errorCode, nowTime);
        }
      }
    }
  }
}

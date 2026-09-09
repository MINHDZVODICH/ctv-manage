import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, type SnapshotRun } from '@prisma/client';
import { prisma as defaultPrisma } from '../../shared/prisma.js';
import { logger } from '../../shared/logger.js';
import {
  todayInBangkok,
  parseYmdToUtcDate,
  formatUtcDateToYmd,
  addDays,
  weekdayUtc,
} from '../../shared/timezone.js';
import { config } from '../../config.js';

export function standardizeSnapshotErrorCode(err: unknown): string {
  if (!err) return 'SNAPSHOT_EXECUTION_FAILED';
  if (typeof err === 'string') {
    if (/^[A-Z0-9_]+$/.test(err)) return err;
    return 'SNAPSHOT_EXECUTION_FAILED';
  }
  const msg = (err as any)?.message;
  const code = (err as any)?.code;
  if (msg === 'LEASE_LOST' || code === 'LEASE_LOST') return 'LEASE_LOST';
  if (msg === 'DATE_PASSED' || code === 'DATE_PASSED') return 'DATE_PASSED';
  if (typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)) return code;
  if (typeof msg === 'string') {
    if (msg.toLowerCase().includes('timeout') || code === 'P2024' || code === '57014') return 'DB_TIMEOUT';
    if (/^[A-Z0-9_]+$/.test(msg)) return msg;
  }
  return 'SNAPSHOT_EXECUTION_FAILED';
}

export interface ClaimResult {
  claimed: boolean;
  leaseToken?: string;
  run?: SnapshotRun;
}

export class SnapshotCoordinatorService {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly trackingStartDate?: string,
  ) {}

  /**
   * Reads wall-clock time, including time spent waiting inside a transaction.
   */
  async getDbTime(tx?: Prisma.TransactionClient): Promise<Date> {
    const client = tx ?? this.db;
    const rows = await client.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() as now`;
    if (!rows[0]?.now) throw new Error('DB_TIME_UNAVAILABLE');
    return rows[0].now;
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
    const startAttemptMs = Date.now();

    const result = await this.db.$transaction(
      async (tx) => {
        // Lock and verify lease token with row-level lock (FOR UPDATE)
        const runs = await tx.$queryRaw<
          Array<{
            id: string;
            workDate: Date;
            status: string;
            leaseToken: string | null;
            leaseExpiresAt: Date | null;
            attemptCount: number;
          }>
        >`
          SELECT "id", "workDate", "status", "leaseToken", "leaseExpiresAt", "attemptCount"
          FROM "SnapshotRun"
          WHERE "workDate" = ${targetDate}::date
          FOR UPDATE
        `;
        const run = runs[0];

        if (!run || run.leaseToken !== leaseToken || run.status !== 'RUNNING') {
          throw new Error('LEASE_LOST');
        }

        const nowTime = now ?? (await this.getDbTime(tx));
        // Date Guard: Verify Bangkok date is still the current active date
        const currentBangkokDate = todayInBangkok(nowTime);
        if (workDate !== currentBangkokDate) {
          const missedResult = await tx.snapshotRun.updateMany({
            where: {
              id: run.id,
              leaseToken,
              status: 'RUNNING',
            },
            data: {
              status: 'MISSED',
              errorCode: 'DATE_PASSED',
              leaseToken: null,
              leaseExpiresAt: null,
              completedAt: nowTime,
            },
          });
          if (missedResult.count === 0) {
            throw new Error('LEASE_LOST');
          }
          return { insertedCount: 0, status: 'MISSED' as const, attemptCount: run.attemptCount };
        }

        if (!run.leaseExpiresAt || run.leaseExpiresAt <= nowTime) {
          throw new Error('LEASE_LOST');
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

        // Schedule reads can also cross midnight or consume the remaining lease.
        const writeTime = now ?? (await this.getDbTime(tx));
        if (todayInBangkok(writeTime) !== workDate) throw new Error('DATE_PASSED');
        if (run.leaseExpiresAt <= writeTime) throw new Error('LEASE_LOST');

        let insertedCount = 0;
        if (historyEntries.length > 0) {
          const insertResult = await tx.history.createMany({
            data: historyEntries,
            skipDuplicates: true,
          });
          insertedCount = insertResult.count;
        }

        // Complete run atomically in the same transaction, verifying lease ownership
        const updateResult = await tx.snapshotRun.updateMany({
          where: {
            id: run.id,
            leaseToken,
            status: 'RUNNING',
          },
          data: {
            status: 'SUCCEEDED',
            completedAt: writeTime,
            insertedCount,
            leaseToken: null,
            leaseExpiresAt: null,
            errorCode: null,
          },
        });

        if (updateResult.count === 0) {
          throw new Error('LEASE_LOST');
        }

        return { insertedCount, status: 'SUCCEEDED' as const, attemptCount: run.attemptCount };
      },
      {
        timeout: 90_000,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );

    // The transaction promise resolves only after commit has succeeded.
    if (result.status === 'MISSED') {
      logger.warn(
        { event: 'snapshot.missed', date: workDate, reason: 'DATE_PASSED' },
        'Snapshot missed due to date transition',
      );
    } else {
      logger.info(
        {
          event: 'snapshot.succeeded',
          date: workDate,
          attempt: result.attemptCount,
          insertedCount: result.insertedCount,
          durationMs: Date.now() - startAttemptMs,
        },
        'Snapshot succeeded',
      );
    }
    return { insertedCount: result.insertedCount };
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
    const sanitizedErrorCode = standardizeSnapshotErrorCode(errorCode);

    const updateResult = await this.db.snapshotRun.updateMany({
      where: {
        workDate: targetDate,
        leaseToken,
      },
      data: {
        status: 'FAILED',
        errorCode: sanitizedErrorCode,
        nextAttemptAt,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });

    if (updateResult.count > 0) {
      logger.info(
        {
          event: 'snapshot.retry_scheduled',
          date: workDate,
          attempt: run.attemptCount,
          nextAttemptAt,
          reason: sanitizedErrorCode,
        },
        'Snapshot retry scheduled',
      );
    }
  }

  /**
   * Reconciles missed dates between startDate and yesterday:
   * Finds all Monday-Friday dates between startDate and yesterday.
   * If no run exists, creates with status = 'MISSED' and insertedCount = 0.
   * If a run exists with PENDING or FAILED (or expired RUNNING), updates to MISSED.
   * Never inserts historical work entries for a MISSED date.
   */
  async reconcileMissedDates(startDate: string, now?: Date): Promise<void> {
    const nowTime = now ?? (await this.getDbTime());
    const todayStr = todayInBangkok(nowTime);
    const yesterdayStr = addDays(todayStr, -1);

    if (startDate > yesterdayStr) {
      return;
    }

    const startUtc = parseYmdToUtcDate(startDate);
    const yesterdayUtc = parseYmdToUtcDate(yesterdayStr);

    const existingRuns = await this.db.snapshotRun.findMany({
      where: {
        workDate: {
          gte: startUtc,
          lte: yesterdayUtc,
        },
      },
    });
    const runMap = new Map<string, (typeof existingRuns)[number]>();
    for (const run of existingRuns) {
      runMap.set(formatUtcDateToYmd(run.workDate), run);
    }

    let currentDate = startDate;
    while (currentDate <= yesterdayStr) {
      const targetUtc = parseYmdToUtcDate(currentDate);
      const dayOfWeek = weekdayUtc(targetUtc); // 1 = Monday .. 5 = Friday, 6 = Saturday, 7 = Sunday

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const existingRun = runMap.get(currentDate);

        if (!existingRun) {
          try {
            await this.db.snapshotRun.create({
              data: {
                workDate: targetUtc,
                status: 'MISSED',
                attemptCount: 0,
                insertedCount: 0,
              },
            });
            logger.warn(
              { event: 'snapshot.missed', date: currentDate, reason: 'MISSED_DOWNTIME' },
              'Snapshot marked as missed',
            );
          } catch {
            // Concurrent creation handled gracefully
          }
        } else if (
          existingRun.status === 'PENDING' ||
          existingRun.status === 'FAILED' ||
          (existingRun.status === 'RUNNING' &&
            !!existingRun.leaseExpiresAt &&
            existingRun.leaseExpiresAt < nowTime)
        ) {
          await this.db.snapshotRun.update({
            where: { id: existingRun.id },
            data: {
              status: 'MISSED',
              leaseToken: null,
              leaseExpiresAt: null,
            },
          });
          logger.warn(
            { event: 'snapshot.missed', date: currentDate, reason: 'UNFINISHED_RUN' },
            'Snapshot marked as missed',
          );
        }
      }

      currentDate = addDays(currentDate, 1);
    }
  }

  /**
   * Executes a reconciliation pass:
   * 1. Evaluates cutoff strictly using database time.
   * 2. Reconciles missed dates if SNAPSHOT_TRACKING_START_DATE is configured.
   * 3. If eligible (weekday >= 17:30 Bangkok time) and no SnapshotRun exists, creates PENDING run.
   * 4. Claims and executes eligible runs.
   */
  async reconcilePass(now?: Date): Promise<void> {
    const nowTime = now ?? (await this.getDbTime());

    const startDate =
      this.trackingStartDate ??
      process.env.SNAPSHOT_TRACKING_START_DATE ??
      config.SNAPSHOT_TRACKING_START_DATE;

    if (startDate) {
      await this.reconcileMissedDates(startDate, nowTime);
    }

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
      const claimed = await this.claimRun(todayStr, leaseToken, now);
      if (claimed) {
        try {
          await this.executeAttempt(todayStr, leaseToken, now);
        } catch (err: any) {
          const errorCode = standardizeSnapshotErrorCode(err);
          await this.recordFailure(todayStr, leaseToken, errorCode, now);
        }
      }
    }
  }
}

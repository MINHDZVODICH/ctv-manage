import type { PrismaClient } from '@prisma/client';
import {
  Prisma,
  type SnapshotRun,
  type Period,
  type RoomCode,
  type HistoryStatus,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../shared/prisma.js';
import { logger } from '../../shared/logger.js';
import {
  parseYmdToUtcDate,
  weekdayUtc,
  getDelayUntilNextBangkok1730,
} from '../../shared/timezone.js';
import { SnapshotRepository, type Progress } from './snapshot.repository.js';
import {
  type SnapshotRetryPolicy,
  DefaultSnapshotRetryPolicy,
  standardizeSnapshotErrorCode,
} from './snapshot-retry-policy.js';
import { SnapshotReconciliationService } from './snapshot-reconciliation.service.js';

export { standardizeSnapshotErrorCode };
export { SnapshotRepository, type Progress };
export { type SnapshotRetryPolicy, DefaultSnapshotRetryPolicy };
export { SnapshotReconciliationService };

export interface ClaimResult {
  claimed: boolean;
  leaseToken?: string;
  run?: SnapshotRun;
}

export class SnapshotCoordinatorService {
  private readonly repository: SnapshotRepository;
  private readonly retryPolicy: SnapshotRetryPolicy;
  private readonly reconciliation: SnapshotReconciliationService;

  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly trackingStartDate?: string,
    repository?: SnapshotRepository,
    retryPolicy?: SnapshotRetryPolicy,
    reconciliation?: SnapshotReconciliationService,
  ) {
    this.repository = repository ?? new SnapshotRepository(this.db);
    this.retryPolicy = retryPolicy ?? new DefaultSnapshotRetryPolicy();
    this.reconciliation =
      reconciliation ??
      new SnapshotReconciliationService(this.repository, this.retryPolicy, this.trackingStartDate);
  }

  async getDbTime(tx?: Prisma.TransactionClient): Promise<Date> {
    return this.repository.getDbTime(tx);
  }

  /** Backoff continues across midnight and during morning recovery. */
  calculateNextAttemptAt(attemptCount: number, now = new Date()): Date {
    return this.retryPolicy.calculateNextAttemptAt(attemptCount, now);
  }

  async claimRun(workDate: string, leaseToken: string, now?: Date): Promise<boolean> {
    const nowTime = now ?? (await this.repository.getDbTime());
    return this.repository.claimRun(workDate, leaseToken, nowTime);
  }

  /** History, successful run and contiguous cursor commit atomically. */
  async executeAttempt(
    workDate: string,
    leaseToken: string,
    now?: Date,
  ): Promise<{ insertedCount: number }> {
    const targetDate = parseYmdToUtcDate(workDate);
    const cutoff = new Date(`${workDate}T10:30:00.000Z`);
    const started = Date.now();

    const result = await this.repository.executeTransaction(
      async (tx) => {
        // Source writers hold the shared lock until commit. ReadCommitted takes a
        // fresh snapshot after this exclusive lock has been acquired.
        await this.repository.acquireAdvisoryLock(tx);
        const progress = await this.repository.lockProgress(tx);
        this.reconciliation.assertNextDate(progress, workDate);

        const run = await this.repository.findRunByWorkDateForUpdate(tx, targetDate);
        if (!run || run.leaseToken !== leaseToken || run.status !== 'RUNNING')
          throw new Error('LEASE_LOST');

        const readTime = now ?? (await this.repository.getDbTime(tx));
        if (cutoff > readTime || weekdayUtc(targetDate) > 5) throw new Error('DATE_NOT_ELIGIBLE');
        if (!run.leaseExpiresAt || run.leaseExpiresAt <= readTime) throw new Error('LEASE_LOST');

        const sources = await this.repository.queryEffectiveSources(tx, cutoff);
        const entries = sources.flatMap((source) => {
          if (!source.eligible || !source.roomCode) return [];
          return source.shifts
            .filter((shift) => shift.weekday === weekdayUtc(targetDate))
            .map((shift) => ({
              accountId: source.accountId,
              workDate: targetDate,
              period: shift.period as Period,
              roomCode: source.roomCode as RoomCode,
              status: 'COMPLETED' as HistoryStatus,
            }));
        });

        const writeTime = now ?? (await this.repository.getDbTime(tx));
        if (run.leaseExpiresAt <= writeTime) throw new Error('LEASE_LOST');

        const insertedCount = await this.repository.insertHistories(tx, entries);

        const updated = await this.repository.markRunSucceeded(tx, {
          id: run.id,
          leaseToken,
          completedAt: writeTime,
          insertedCount,
        });
        if (!updated) throw new Error('LEASE_LOST');

        await this.repository.updateLastProcessedDate(tx, targetDate);
        return { insertedCount, attemptCount: run.attemptCount };
      },
      { timeout: 90_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    logger.info(
      {
        event: 'snapshot.succeeded',
        date: workDate,
        attempt: result.attemptCount,
        insertedCount: result.insertedCount,
        durationMs: Date.now() - started,
      },
      'Snapshot succeeded',
    );
    return { insertedCount: result.insertedCount };
  }

  async recordFailure(
    workDate: string,
    leaseToken: string,
    errorCode: string,
    now?: Date,
  ): Promise<void> {
    const targetDate = parseYmdToUtcDate(workDate);
    const nowTime = now ?? (await this.repository.getDbTime());
    const sanitized = this.retryPolicy.standardizeErrorCode(errorCode);

    const run = await this.repository.findRunByWorkDate(targetDate);
    if (!run || run.leaseToken !== leaseToken) return;

    const nextAttemptAt = this.retryPolicy.calculateNextAttemptAt(run.attemptCount, nowTime);
    const result = await this.repository.recordFailure(
      targetDate,
      leaseToken,
      sanitized,
      nextAttemptAt,
    );

    if (result.recorded) {
      logger.info(
        {
          event: 'snapshot.retry_scheduled',
          date: workDate,
          attempt: run.attemptCount,
          nextAttemptAt,
          reason: sanitized,
        },
        'Snapshot retry scheduled',
      );
    }
  }

  /** Resume sequentially from the cursor, stopping at the first unfinished day. */
  async reconcilePass(now?: Date): Promise<number> {
    return this.reconciliation.reconcilePass(
      now,
      (date, token, t) => this.executeAttempt(date, token, t),
      (date, token, err, t) => this.recordFailure(date, token, err, t),
    );
  }

  /**
   * Calculates the delay in milliseconds until the next required wake.
   * If a pending or failed run has a scheduled retry earlier than the 17:30 cutoff,
   * returns the delay to that retry. Otherwise returns the delay to the next 17:30 Bangkok.
   */
  async getNextWakeDelay(now?: Date): Promise<number> {
    const nowTime = now ?? (await this.repository.getDbTime());
    const pendingRetry = await this.repository.findEarliestPendingOrFailedRun();
    const delayToCutoff = getDelayUntilNextBangkok1730(nowTime);

    if (pendingRetry?.nextAttemptAt) {
      const delayToRetry = Math.max(0, pendingRetry.nextAttemptAt.getTime() - nowTime.getTime());
      return Math.min(delayToRetry, delayToCutoff);
    }

    return delayToCutoff;
  }
}

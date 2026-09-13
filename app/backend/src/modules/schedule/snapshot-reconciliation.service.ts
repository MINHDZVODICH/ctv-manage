import { randomUUID } from 'node:crypto';
import type { WorkHistoryProgress } from '@prisma/client';
import type { SnapshotRepository } from './snapshot.repository.js';
import { type Progress } from './snapshot.repository.js';
import type { SnapshotRetryPolicy } from './snapshot-retry-policy.js';
import {
  todayInBangkok,
  parseYmdToUtcDate,
  formatUtcDateToYmd,
  addDays,
  weekdayUtc,
} from '../../shared/timezone.js';
import { config } from '../../config.js';

export class SnapshotReconciliationService {
  constructor(
    private readonly repository: SnapshotRepository,
    private readonly retryPolicy: SnapshotRetryPolicy,
    private readonly trackingStartDate?: string,
  ) {}

  assertNextDate(progress: Progress, workDate: string): void {
    if (
      workDate < formatUtcDateToYmd(progress.trackingStartDate) ||
      workDate !== addDays(formatUtcDateToYmd(progress.lastProcessedDate), 1)
    ) {
      throw new Error('HISTORY_PROGRESS_CONFLICT');
    }
  }

  async initializeProgress(now: Date): Promise<WorkHistoryProgress> {
    const today = todayInBangkok(now);
    const configured = this.trackingStartDate ?? config.SNAPSHOT_TRACKING_START_DATE;
    if (
      configured &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(configured) ||
        !Number.isFinite(parseYmdToUtcDate(configured).getTime()) ||
        formatUtcDateToYmd(parseYmdToUtcDate(configured)) !== configured)
    ) {
      throw new Error('INVALID_TRACKING_START_DATE');
    }

    const start = configured && configured > today ? configured : today;
    return this.repository.initializeProgressRecord(start);
  }

  async advanceCompletedDate(workDate: string): Promise<void> {
    await this.repository.executeTransaction(async (tx) => {
      const progress = await this.repository.lockProgress(tx);
      if (formatUtcDateToYmd(progress.lastProcessedDate) >= workDate) return;
      this.assertNextDate(progress, workDate);
      const date = parseYmdToUtcDate(workDate);
      if (weekdayUtc(date) <= 5) {
        const run = await this.repository.findRunByWorkDate(date, tx);
        if (run?.status !== 'SUCCEEDED') throw new Error('HISTORY_PROGRESS_CONFLICT');
      }
      await this.repository.updateLastProcessedDate(tx, date);
    });
  }

  async reconcilePass(
    now?: Date,
    executeAttemptFn?: (
      workDate: string,
      leaseToken: string,
      now?: Date,
    ) => Promise<{ insertedCount: number }>,
    recordFailureFn?: (
      workDate: string,
      leaseToken: string,
      errorCode: string,
      now?: Date,
    ) => Promise<void>,
  ): Promise<number> {
    const nowTime = now ?? (await this.repository.getDbTime());
    let progress = await this.initializeProgress(nowTime);
    const today = todayInBangkok(nowTime);
    const end = nowTime >= new Date(`${today}T10:30:00.000Z`) ? today : addDays(today, -1);
    let insertedCount = 0;

    for (let processed = 0; processed < 31; processed++) {
      const workDate = addDays(formatUtcDateToYmd(progress.lastProcessedDate), 1);
      if (workDate > end) return insertedCount;
      const date = parseYmdToUtcDate(workDate);

      if (weekdayUtc(date) > 5) {
        await this.advanceCompletedDate(workDate);
      } else {
        await this.repository.createPendingRun(date, nowTime);
        const run = await this.repository.findRunByWorkDateOrThrow(date);

        if (run.status === 'SUCCEEDED') {
          await this.advanceCompletedDate(workDate);
        } else {
          if (run.status === 'MISSED') {
            await this.repository.resetMissedRun(run.id, nowTime);
          }
          const token = randomUUID();
          if (!(await this.repository.claimRun(workDate, token, now))) {
            return insertedCount;
          }
          try {
            if (!executeAttemptFn) throw new Error('EXECUTE_ATTEMPT_HANDLER_REQUIRED');
            insertedCount += (await executeAttemptFn(workDate, token, now)).insertedCount;
          } catch (error) {
            if (recordFailureFn) {
              await recordFailureFn(
                workDate,
                token,
                this.retryPolicy.standardizeErrorCode(error),
                now,
              );
            }
            return insertedCount;
          }
        }
      }
      progress = await this.repository.getProgressOrThrow();
    }
    return insertedCount;
  }
}

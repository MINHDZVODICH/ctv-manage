import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, type SnapshotRun, type Period, type RoomCode, type HistoryStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../shared/prisma.js';
import { logger } from '../../shared/logger.js';
import { todayInBangkok, parseYmdToUtcDate, formatUtcDateToYmd, addDays, weekdayUtc } from '../../shared/timezone.js';
import { config } from '../../config.js';

export function standardizeSnapshotErrorCode(err: unknown): string {
  if (!err) return 'SNAPSHOT_EXECUTION_FAILED';
  if (typeof err === 'string') return /^[A-Z0-9_]+$/.test(err) ? err : 'SNAPSHOT_EXECUTION_FAILED';
  const { message, code } = err as { message?: string; code?: string };
  if (code && /^[A-Z0-9_]+$/.test(code)) return code;
  if (typeof message === 'string') {
    if (message.toLowerCase().includes('timeout')) return 'DB_TIMEOUT';
    if (/^[A-Z0-9_]+$/.test(message)) return message;
  }
  return 'SNAPSHOT_EXECUTION_FAILED';
}
export interface ClaimResult { claimed: boolean; leaseToken?: string; run?: SnapshotRun }
type Progress = { trackingStartDate: Date; lastProcessedDate: Date };

export class SnapshotCoordinatorService {
  constructor(private readonly db: PrismaClient = defaultPrisma, private readonly trackingStartDate?: string) {}

  async getDbTime(tx?: Prisma.TransactionClient): Promise<Date> {
    const rows = await (tx ?? this.db).$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() as now`;
    if (!rows[0]?.now) throw new Error('DB_TIME_UNAVAILABLE');
    return rows[0].now;
  }
  /** Backoff continues across midnight and during morning recovery. */
  calculateNextAttemptAt(attemptCount: number, now = new Date()): Date {
    const minutes = attemptCount <= 1 ? 1 : attemptCount === 2 ? 5 : attemptCount === 3 ? 15 : 30;
    return new Date(now.getTime() + minutes * 60_000);
  }
  async claimRun(workDate: string, leaseToken: string, now?: Date): Promise<boolean> {
    const nowTime = now ?? await this.getDbTime();
    const result = await this.db.snapshotRun.updateMany({
      where: {
        workDate: parseYmdToUtcDate(workDate),
        OR: [
          { status: { in: ['PENDING', 'FAILED'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: nowTime } }] },
          { status: 'RUNNING', leaseExpiresAt: { lte: nowTime } },
        ],
      },
      data: {
        status: 'RUNNING', leaseToken, leaseExpiresAt: new Date(nowTime.getTime() + 120_000),
        attemptCount: { increment: 1 }, startedAt: nowTime,
      },
    });
    return result.count > 0;
  }
  /** History, successful run and contiguous cursor commit atomically. */
  async executeAttempt(workDate: string, leaseToken: string, now?: Date): Promise<{ insertedCount: number }> {
    const targetDate = parseYmdToUtcDate(workDate);
    const cutoff = new Date(`${workDate}T10:30:00.000Z`);
    const started = Date.now();
    const result = await this.db.$transaction(async (tx) => {
      // Source writers hold the shared lock until commit. ReadCommitted takes a
      // fresh snapshot after this exclusive lock has been acquired.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(17300909)`;
      this.assertNextDate(await this.lockProgress(tx), workDate);
      const runs = await tx.$queryRaw<SnapshotRun[]>`
        SELECT * FROM "SnapshotRun" WHERE "workDate" = ${targetDate}::date FOR UPDATE
      `;
      const run = runs[0];
      if (!run || run.leaseToken !== leaseToken || run.status !== 'RUNNING') throw new Error('LEASE_LOST');
      const readTime = now ?? await this.getDbTime(tx);
      if (cutoff > readTime || weekdayUtc(targetDate) > 5) throw new Error('DATE_NOT_ELIGIBLE');
      if (!run.leaseExpiresAt || run.leaseExpiresAt <= readTime) throw new Error('LEASE_LOST');
      const sources = await tx.$queryRaw<Array<{
        accountId: string; eligible: boolean; roomCode: string | null;
        shifts: Array<{ weekday: number; period: string }>;
      }>>`
        SELECT DISTINCT ON ("accountId") "accountId", "eligible", "roomCode", "shifts"
        FROM "WorkHistorySource" WHERE "effectiveAt" <= ${cutoff}
        ORDER BY "accountId", "effectiveAt" DESC, "id" DESC
      `;
      const entries = sources.flatMap((source) => {
        if (!source.eligible || !source.roomCode) return [];
        return source.shifts.filter((shift) => shift.weekday === weekdayUtc(targetDate)).map((shift) => ({
          accountId: source.accountId,
          workDate: targetDate,
          period: shift.period as Period,
          roomCode: source.roomCode as RoomCode,
          status: 'COMPLETED' as HistoryStatus,
        }));
      });
      const writeTime = now ?? await this.getDbTime(tx);
      if (run.leaseExpiresAt <= writeTime) throw new Error('LEASE_LOST');
      const insertedCount = entries.length ? (await tx.history.createMany({ data: entries, skipDuplicates: true })).count : 0;
      const updated = await tx.snapshotRun.updateMany({
        where: { id: run.id, leaseToken, status: 'RUNNING' },
        data: { status: 'SUCCEEDED', completedAt: writeTime, insertedCount,
          leaseToken: null, leaseExpiresAt: null, errorCode: null, nextAttemptAt: null },
      });
      if (!updated.count) throw new Error('LEASE_LOST');
      await tx.workHistoryProgress.update({ where: { id: 'default' }, data: { lastProcessedDate: targetDate } });
      return { insertedCount, attemptCount: run.attemptCount };
    }, { timeout: 90_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    logger.info({ event: 'snapshot.succeeded', date: workDate, attempt: result.attemptCount,
      insertedCount: result.insertedCount, durationMs: Date.now() - started }, 'Snapshot succeeded');
    return { insertedCount: result.insertedCount };
  }
  private async lockProgress(tx: Prisma.TransactionClient): Promise<Progress> {
    const rows = await tx.$queryRaw<Progress[]>`
      SELECT "trackingStartDate", "lastProcessedDate" FROM "WorkHistoryProgress" WHERE "id" = 'default' FOR UPDATE
    `;
    if (!rows[0]) throw new Error('HISTORY_PROGRESS_UNINITIALIZED');
    return rows[0];
  }
  private assertNextDate(progress: Progress, workDate: string) {
    if (workDate < formatUtcDateToYmd(progress.trackingStartDate) ||
        workDate !== addDays(formatUtcDateToYmd(progress.lastProcessedDate), 1)) throw new Error('HISTORY_PROGRESS_CONFLICT');
  }
  async recordFailure(workDate: string, leaseToken: string, errorCode: string, now?: Date): Promise<void> {
    const targetDate = parseYmdToUtcDate(workDate);
    const nowTime = now ?? await this.getDbTime();
    const run = await this.db.snapshotRun.findUnique({ where: { workDate: targetDate } });
    if (!run || run.leaseToken !== leaseToken) return;
    const nextAttemptAt = this.calculateNextAttemptAt(run.attemptCount, nowTime);
    const sanitized = standardizeSnapshotErrorCode(errorCode);
    const result = await this.db.snapshotRun.updateMany({
      where: { workDate: targetDate, leaseToken, status: 'RUNNING' },
      data: { status: 'FAILED', errorCode: sanitized, nextAttemptAt, leaseToken: null, leaseExpiresAt: null },
    });
    if (result.count) logger.info({ event: 'snapshot.retry_scheduled', date: workDate,
      attempt: run.attemptCount, nextAttemptAt, reason: sanitized }, 'Snapshot retry scheduled');
  }
  /** Initialize once; configuration changes cannot rewind a persisted cursor. */
  private async initializeProgress(now: Date) {
    const today = todayInBangkok(now);
    const configured = this.trackingStartDate ?? process.env.SNAPSHOT_TRACKING_START_DATE ?? config.SNAPSHOT_TRACKING_START_DATE;
    if (configured && (!/^\d{4}-\d{2}-\d{2}$/.test(configured) ||
        !Number.isFinite(parseYmdToUtcDate(configured).getTime()) ||
        formatUtcDateToYmd(parseYmdToUtcDate(configured)) !== configured)) throw new Error('INVALID_TRACKING_START_DATE');
    // Normally initialized by migration beside the source baseline. Never infer a
    // historical starting date if the persisted cursor has been removed.
    const start = configured && configured > today ? configured : today;
    await this.db.workHistoryProgress.createMany({ skipDuplicates: true,
      data: [{ id: 'default', trackingStartDate: parseYmdToUtcDate(start), lastProcessedDate: parseYmdToUtcDate(addDays(start, -1)) }],
    });
    return this.db.workHistoryProgress.findUniqueOrThrow({ where: { id: 'default' } });
  }
  private async advanceCompletedDate(workDate: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const progress = await this.lockProgress(tx);
      if (formatUtcDateToYmd(progress.lastProcessedDate) >= workDate) return;
      this.assertNextDate(progress, workDate);
      const date = parseYmdToUtcDate(workDate);
      if (weekdayUtc(date) <= 5) {
        const run = await tx.snapshotRun.findUnique({ where: { workDate: date } });
        if (run?.status !== 'SUCCEEDED') throw new Error('HISTORY_PROGRESS_CONFLICT');
      }
      await tx.workHistoryProgress.update({ where: { id: 'default' }, data: { lastProcessedDate: date } });
    });
  }
  /** Resume sequentially from the cursor, stopping at the first unfinished day. */
  async reconcilePass(now?: Date): Promise<number> {
    const nowTime = now ?? await this.getDbTime();
    let progress = await this.initializeProgress(nowTime);
    const today = todayInBangkok(nowTime);
    const end = nowTime >= new Date(`${today}T10:30:00.000Z`) ? today : addDays(today, -1);
    let insertedCount = 0;
    // Bound each pass; the next timer tick resumes a longer outage.
    for (let processed = 0; processed < 31; processed++) {
      const workDate = addDays(formatUtcDateToYmd(progress.lastProcessedDate), 1);
      if (workDate > end) return insertedCount;
      const date = parseYmdToUtcDate(workDate);
      if (weekdayUtc(date) > 5) await this.advanceCompletedDate(workDate);
      else {
        await this.db.snapshotRun.createMany({ skipDuplicates: true,
          data: [{ workDate: date, status: 'PENDING', nextAttemptAt: nowTime }] });
        const run = await this.db.snapshotRun.findUniqueOrThrow({ where: { workDate: date } });
        if (run.status === 'SUCCEEDED') await this.advanceCompletedDate(workDate);
        else {
          // Only legacy MISSED dates inside the tracking boundary are recoverable.
          if (run.status === 'MISSED') await this.db.snapshotRun.updateMany({
            where: { id: run.id, status: 'MISSED' },
            data: { status: 'PENDING', nextAttemptAt: nowTime, leaseToken: null, leaseExpiresAt: null },
          });
          const token = randomUUID();
          if (!await this.claimRun(workDate, token, now)) return insertedCount;
          try { insertedCount += (await this.executeAttempt(workDate, token, now)).insertedCount; }
          catch (error) { await this.recordFailure(workDate, token, standardizeSnapshotErrorCode(error), now); return insertedCount; }
        }
      }
      progress = await this.db.workHistoryProgress.findUniqueOrThrow({ where: { id: 'default' } });
    }
    return insertedCount;
  }
}

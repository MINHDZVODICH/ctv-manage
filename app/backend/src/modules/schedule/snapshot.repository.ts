import type { Prisma, PrismaClient } from '@prisma/client';
import { type SnapshotRun, type WorkHistoryProgress } from '@prisma/client';
import { prisma as defaultPrisma } from '../../shared/prisma.js';
import { parseYmdToUtcDate, addDays } from '../../shared/timezone.js';

export type Progress = {
  trackingStartDate: Date;
  lastProcessedDate: Date;
};

export interface EffectiveSource {
  accountId: string;
  eligible: boolean;
  roomCode: string | null;
  shifts: Array<{ weekday: number; period: string }>;
}

export class SnapshotRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async getDbTime(tx?: Prisma.TransactionClient): Promise<Date> {
    const rows = await (tx ?? this.db).$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() as now`;
    if (!rows[0]?.now) throw new Error('DB_TIME_UNAVAILABLE');
    return rows[0].now;
  }

  async acquireAdvisoryLock(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(17300909)`;
  }

  async lockProgress(tx: Prisma.TransactionClient): Promise<Progress> {
    const rows = await tx.$queryRaw<Progress[]>`
      SELECT "trackingStartDate", "lastProcessedDate" FROM "WorkHistoryProgress" WHERE "id" = 'default' FOR UPDATE
    `;
    if (!rows[0]) throw new Error('HISTORY_PROGRESS_UNINITIALIZED');
    return rows[0];
  }

  async findRunByWorkDateForUpdate(
    tx: Prisma.TransactionClient,
    targetDate: Date,
  ): Promise<SnapshotRun | null> {
    const runs = await tx.$queryRaw<SnapshotRun[]>`
      SELECT * FROM "SnapshotRun" WHERE "workDate" = ${targetDate}::date FOR UPDATE
    `;
    return runs[0] ?? null;
  }

  async claimRun(workDate: string, leaseToken: string, now?: Date): Promise<boolean> {
    const nowTime = now ?? (await this.getDbTime());
    const result = await this.db.snapshotRun.updateMany({
      where: {
        workDate: parseYmdToUtcDate(workDate),
        OR: [
          {
            status: { in: ['PENDING', 'FAILED'] },
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: nowTime } }],
          },
          { status: 'RUNNING', leaseExpiresAt: { lte: nowTime } },
        ],
      },
      data: {
        status: 'RUNNING',
        leaseToken,
        leaseExpiresAt: new Date(nowTime.getTime() + 120_000),
        attemptCount: { increment: 1 },
        startedAt: nowTime,
      },
    });
    return result.count > 0;
  }

  async queryEffectiveSources(
    tx: Prisma.TransactionClient,
    cutoff: Date,
  ): Promise<EffectiveSource[]> {
    return tx.$queryRaw<EffectiveSource[]>`
      SELECT DISTINCT ON ("accountId") "accountId", "eligible", "roomCode", "shifts"
      FROM "WorkHistorySource" WHERE "effectiveAt" <= ${cutoff}
      ORDER BY "accountId", "effectiveAt" DESC, "id" DESC
    `;
  }

  async insertHistories(
    tx: Prisma.TransactionClient,
    entries: Prisma.HistoryCreateManyInput[],
  ): Promise<number> {
    if (!entries.length) return 0;
    const result = await tx.history.createMany({ data: entries, skipDuplicates: true });
    return result.count;
  }

  async markRunSucceeded(
    tx: Prisma.TransactionClient,
    params: { id: string; leaseToken: string; completedAt: Date; insertedCount: number },
  ): Promise<boolean> {
    const updated = await tx.snapshotRun.updateMany({
      where: { id: params.id, leaseToken: params.leaseToken, status: 'RUNNING' },
      data: {
        status: 'SUCCEEDED',
        completedAt: params.completedAt,
        insertedCount: params.insertedCount,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
        nextAttemptAt: null,
      },
    });
    return updated.count > 0;
  }

  async updateLastProcessedDate(
    tx: Prisma.TransactionClient,
    lastProcessedDate: Date,
  ): Promise<void> {
    await tx.workHistoryProgress.update({ where: { id: 'default' }, data: { lastProcessedDate } });
  }

  async findRunByWorkDate(
    targetDate: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<SnapshotRun | null> {
    return (tx ?? this.db).snapshotRun.findUnique({ where: { workDate: targetDate } });
  }

  async recordFailure(
    targetDate: Date,
    leaseToken: string,
    sanitizedErrorCode: string,
    nextAttemptAt: Date,
  ): Promise<{ recorded: boolean; attemptCount: number }> {
    const run = await this.db.snapshotRun.findUnique({ where: { workDate: targetDate } });
    if (!run || run.leaseToken !== leaseToken) return { recorded: false, attemptCount: 0 };
    const result = await this.db.snapshotRun.updateMany({
      where: { workDate: targetDate, leaseToken, status: 'RUNNING' },
      data: {
        status: 'FAILED',
        errorCode: sanitizedErrorCode,
        nextAttemptAt,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    return { recorded: result.count > 0, attemptCount: run.attemptCount };
  }

  async initializeProgressRecord(start: string): Promise<WorkHistoryProgress> {
    await this.db.workHistoryProgress.createMany({
      skipDuplicates: true,
      data: [
        {
          id: 'default',
          trackingStartDate: parseYmdToUtcDate(start),
          lastProcessedDate: parseYmdToUtcDate(addDays(start, -1)),
        },
      ],
    });
    return this.db.workHistoryProgress.findUniqueOrThrow({ where: { id: 'default' } });
  }

  async createPendingRun(workDate: Date, nextAttemptAt: Date): Promise<void> {
    await this.db.snapshotRun.createMany({
      skipDuplicates: true,
      data: [{ workDate, status: 'PENDING', nextAttemptAt }],
    });
  }

  async findRunByWorkDateOrThrow(workDate: Date): Promise<SnapshotRun> {
    return this.db.snapshotRun.findUniqueOrThrow({ where: { workDate } });
  }

  async resetMissedRun(id: string, nextAttemptAt: Date): Promise<void> {
    await this.db.snapshotRun.updateMany({
      where: { id, status: 'MISSED' },
      data: { status: 'PENDING', nextAttemptAt, leaseToken: null, leaseExpiresAt: null },
    });
  }

  async getProgressOrThrow(): Promise<WorkHistoryProgress> {
    return this.db.workHistoryProgress.findUniqueOrThrow({ where: { id: 'default' } });
  }

  async findEarliestPendingOrFailedRun(): Promise<SnapshotRun | null> {
    return this.db.snapshotRun.findFirst({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        nextAttemptAt: { not: null },
      },
      orderBy: { nextAttemptAt: 'asc' },
    });
  }

  async executeTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T> {
    return this.db.$transaction(callback, options);
  }
}

import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/shared/prisma.js';
import { resetDatabase, seedActors } from './helpers.js';
import { SnapshotCoordinatorService } from '../src/modules/schedule/snapshot-coordinator.service.js';
import { upsertSchedule } from '../src/modules/schedule/schedule.command.service.js';
import { addDays, parseYmdToUtcDate } from '../src/shared/timezone.js';

const date = parseYmdToUtcDate;
const monday = '2026-09-07';
const morningTuesday = new Date('2026-09-08T01:00:00Z');
async function progress(start = monday, last = addDays(start, -1)) {
  return prisma.workHistoryProgress.create({
    data: {
      id: 'default',
      trackingStartDate: date(start),
      lastProcessedDate: date(last),
    },
  });
}
async function seedSchedule() {
  const { ctv } = await seedActors();
  const schedule = await upsertSchedule(ctv.id, {
    roomCode: 'ROOM_1',
    slots: [
      { weekday: 1, period: 'MORNING' },
      { weekday: 2, period: 'AFTERNOON' },
      { weekday: 3, period: 'MORNING' },
    ],
  });
  // Fixtures predate the simulated outage. Production effectiveAt is set by DB triggers.
  await prisma.workHistorySource.updateMany({
    data: { effectiveAt: new Date('2026-09-07T09:00:00Z') },
  });
  return { ctv, schedule };
}
async function lastProcessed() {
  return (await prisma.workHistoryProgress.findUniqueOrThrow({ where: { id: 'default' } }))
    .lastProcessedDate;
}

describe('Persistent work history recovery', () => {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('starts today on first boot, even if old tracking config and runs exist', async () => {
    await seedSchedule();
    await prisma.snapshotRun.create({ data: { workDate: date(monday), status: 'MISSED' } });
    await new SnapshotCoordinatorService(prisma, '2020-01-01').reconcilePass(morningTuesday);
    expect(await lastProcessed()).toEqual(date(monday));
    expect(await prisma.history.count()).toBe(0);
    expect(
      (await prisma.snapshotRun.findUniqueOrThrow({ where: { workDate: date(monday) } })).status,
    ).toBe('MISSED');
  });

  it('remembers a Monday pre-cutoff boot and backfills Monday on Tuesday morning exactly once', async () => {
    await seedSchedule();
    await new SnapshotCoordinatorService().reconcilePass(new Date('2026-09-07T10:00:00Z'));
    expect(await prisma.history.count()).toBe(0);
    await new SnapshotCoordinatorService().reconcilePass(morningTuesday);
    const rows = await prisma.history.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      workDate: date(monday),
      period: 'MORNING',
      roomCode: 'ROOM_1',
    });
    expect(await lastProcessed()).toEqual(date(monday));
    await new SnapshotCoordinatorService().reconcilePass(morningTuesday);
    expect(await prisma.history.count()).toBe(1);
    expect(await prisma.snapshotRun.count()).toBe(1);
  });

  it('catches up multiple days, skips weekends, and waits for the current cutoff', async () => {
    await seedSchedule();
    await progress('2026-09-04');
    const coordinator = new SnapshotCoordinatorService();
    await coordinator.reconcilePass(new Date('2026-09-10T01:00:00Z'));
    expect(await prisma.history.count()).toBe(3);
    expect(await lastProcessed()).toEqual(date('2026-09-09'));
    const runs = await prisma.snapshotRun.findMany({ orderBy: { workDate: 'asc' } });
    expect(runs.map((r) => r.workDate)).toEqual(
      ['2026-09-04', monday, '2026-09-08', '2026-09-09'].map(date),
    );
    expect(runs.every((r) => r.status === 'SUCCEEDED')).toBe(true);
    await coordinator.reconcilePass(new Date('2026-09-10T10:30:00Z'));
    expect(await lastProcessed()).toEqual(date('2026-09-10'));
  });

  it('uses the final transaction schedule at the original cutoff despite later schedule and account changes', async () => {
    const { ctv, schedule } = await seedSchedule();
    await progress();
    await upsertSchedule(ctv.id, {
      expectedVersion: schedule.version,
      roomCode: 'ROOM_2',
      slots: [{ weekday: 1, period: 'AFTERNOON' }],
    });
    await prisma.account.update({ where: { id: ctv.id }, data: { status: 'DISABLED' } });
    await new SnapshotCoordinatorService().reconcilePass(morningTuesday);
    expect(await prisma.history.findMany()).toEqual([
      expect.objectContaining({ period: 'MORNING', roomCode: 'ROOM_1' }),
    ]);
    const revisions = await prisma.workHistorySource.findMany({
      where: { accountId: ctv.id },
      orderBy: { id: 'asc' },
    });
    expect(revisions.at(-2)).toMatchObject({
      roomCode: 'ROOM_2',
      shifts: [{ weekday: 1, period: 'AFTERNOON' }],
    });
    expect(revisions.at(-1)?.eligible).toBe(false);
    expect(new Set(revisions.map((r) => r.transactionId)).size).toBe(revisions.length);
  });

  it('does not apply a newly created schedule to an earlier day', async () => {
    await seedSchedule();
    await prisma.workHistorySource.updateMany({
      data: { effectiveAt: new Date('2026-09-08T00:00:00Z') },
    });
    await progress();
    await new SnapshotCoordinatorService().reconcilePass(morningTuesday);
    expect(await prisma.history.count()).toBe(0);
    expect(await lastProcessed()).toEqual(date(monday));
  });

  it('does not retain source revisions from rolled-back schedule changes', async () => {
    const { ctv, schedule } = await seedSchedule();
    const before = await prisma.workHistorySource.count({ where: { accountId: ctv.id } });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.schedule.update({ where: { id: schedule.id }, data: { roomCode: 'ROOM_4' } });
        // Flush deferred triggers to verify revision writes themselves roll back too.
        await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
        throw new Error('ROLLBACK');
      }),
    ).rejects.toThrow('ROLLBACK');
    expect(await prisma.workHistorySource.count({ where: { accountId: ctv.id } })).toBe(before);
    expect((await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } })).roomCode).toBe(
      'ROOM_1',
    );
  });

  it('serializes source revisions across concurrent schedule and eligibility changes', async () => {
    const { ctv, schedule } = await seedSchedule();
    await Promise.all([
      upsertSchedule(ctv.id, {
        expectedVersion: schedule.version,
        roomCode: 'ROOM_2',
        slots: [{ weekday: 2, period: 'MORNING' }],
      }),
      prisma.account.update({ where: { id: ctv.id }, data: { status: 'DISABLED' } }),
    ]);
    const latest = await prisma.workHistorySource.findFirstOrThrow({
      where: { accountId: ctv.id },
      orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
    });
    expect(latest).toMatchObject({
      eligible: false,
      roomCode: 'ROOM_2',
      shifts: [{ weekday: 2, period: 'MORNING' }],
    });
  });

  it('resumes a long outage in bounded passes instead of losing the remaining days', async () => {
    await progress('2026-08-01');
    const coordinator = new SnapshotCoordinatorService();
    const now = new Date('2026-09-10T01:00:00Z');
    await coordinator.reconcilePass(now);
    expect(await lastProcessed()).toEqual(date('2026-08-31'));
    await coordinator.reconcilePass(now);
    expect(await lastProcessed()).toEqual(date('2026-09-09'));
    expect(await prisma.history.count()).toBe(0);
  });

  it('stops at a failed date and retries later without advancing beyond the gap', async () => {
    await seedSchedule();
    await progress();
    const coordinator = new SnapshotCoordinatorService();
    const fail = vi
      .spyOn(coordinator, 'executeAttempt')
      .mockRejectedValueOnce(new Error('DB_TIMEOUT'));
    const now = new Date('2026-09-10T01:00:00Z');
    await coordinator.reconcilePass(now);
    expect(await lastProcessed()).toEqual(date('2026-09-06'));
    expect(await prisma.snapshotRun.count()).toBe(1);
    fail.mockRestore();
    await coordinator.reconcilePass(new Date(now.getTime() + 30_000));
    expect(await prisma.history.count()).toBe(0);
    await coordinator.reconcilePass(new Date(now.getTime() + 60_000));
    expect(await prisma.history.count()).toBe(3);
    expect(await lastProcessed()).toEqual(date('2026-09-09'));
  });

  it('rolls history and success back if saving the cursor fails', async () => {
    await seedSchedule();
    await progress();
    const coordinator = new SnapshotCoordinatorService();
    await prisma.snapshotRun.create({ data: { workDate: date(monday), status: 'PENDING' } });
    await coordinator.claimRun(monday, 'owner', morningTuesday);
    const db = {
      $transaction: (callback: any, options: any) =>
        prisma.$transaction(
          (tx) =>
            callback({
              ...tx,
              workHistoryProgress: {
                update: () => {
                  throw new Error('CURSOR_WRITE_FAILED');
                },
              },
            }),
          options,
        ),
    };
    await expect(
      new SnapshotCoordinatorService(db as any).executeAttempt(monday, 'owner', morningTuesday),
    ).rejects.toThrow('CURSOR_WRITE_FAILED');
    expect(await prisma.history.count()).toBe(0);
    expect(await lastProcessed()).toEqual(date('2026-09-06'));
    expect(
      (await prisma.snapshotRun.findUniqueOrThrow({ where: { workDate: date(monday) } })).status,
    ).toBe('RUNNING');
  });

  it('allows only one concurrent claim and recovers an expired lease', async () => {
    await seedSchedule();
    await progress();
    const coordinator = new SnapshotCoordinatorService();
    await prisma.snapshotRun.create({ data: { workDate: date(monday), status: 'PENDING' } });
    const claims = await Promise.all([
      coordinator.claimRun(monday, 'a', morningTuesday),
      coordinator.claimRun(monday, 'b', morningTuesday),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const later = new Date(morningTuesday.getTime() + 120_000);
    expect(await coordinator.claimRun(monday, 'recovered', later)).toBe(true);
    await coordinator.executeAttempt(monday, 'recovered', later);
    expect(await prisma.history.count()).toBe(1);
  });

  it('two concurrent reconciliation instances never duplicate history or move the cursor backwards', async () => {
    await seedSchedule();
    await progress();
    await Promise.all([
      new SnapshotCoordinatorService().reconcilePass(morningTuesday),
      new SnapshotCoordinatorService().reconcilePass(morningTuesday),
    ]);
    expect(await prisma.history.count()).toBe(1);
    expect(await lastProcessed()).toEqual(date(monday));
  });

  it('respects the persisted boundary and adopts an already successful day without rewriting it', async () => {
    await seedSchedule();
    await progress('2026-09-08');
    await prisma.snapshotRun.createMany({
      data: [
        { workDate: date(monday), status: 'MISSED' },
        { workDate: date('2026-09-08'), status: 'SUCCEEDED', insertedCount: 7 },
      ],
    });
    await new SnapshotCoordinatorService(prisma, '2020-01-01').reconcilePass(
      new Date('2026-09-09T01:00:00Z'),
    );
    expect(await prisma.history.count()).toBe(0);
    expect(await lastProcessed()).toEqual(date('2026-09-08'));
    expect(
      (await prisma.snapshotRun.findUniqueOrThrow({ where: { workDate: date('2026-09-08') } }))
        .insertedCount,
    ).toBe(7);
    expect(
      (await prisma.snapshotRun.findUniqueOrThrow({ where: { workDate: date(monday) } })).status,
    ).toBe('MISSED');
  });

  it('refuses direct execution before the boundary or out of order', async () => {
    await progress('2026-09-08');
    const coordinator = new SnapshotCoordinatorService();
    await expect(coordinator.executeAttempt(monday, 'owner', morningTuesday)).rejects.toThrow(
      'HISTORY_PROGRESS_CONFLICT',
    );
    await expect(coordinator.executeAttempt('2026-09-09', 'owner', morningTuesday)).rejects.toThrow(
      'HISTORY_PROGRESS_CONFLICT',
    );
    expect(await prisma.history.count()).toBe(0);
  });

  it('keeps retrying across midnight', () => {
    const coordinator = new SnapshotCoordinatorService();
    expect(coordinator.calculateNextAttemptAt(4, new Date('2026-09-07T16:45:00Z'))).toEqual(
      new Date('2026-09-07T17:15:00Z'),
    );
    expect(coordinator.calculateNextAttemptAt(1, morningTuesday)).toEqual(
      new Date('2026-09-08T01:01:00Z'),
    );
  });
});

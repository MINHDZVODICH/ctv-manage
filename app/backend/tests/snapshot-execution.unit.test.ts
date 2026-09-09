import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/shared/prisma.js', () => ({ prisma: {} }));
vi.mock('../src/shared/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { SnapshotCoordinatorService } from '../src/modules/schedule/snapshot-coordinator.service.js';
import { logger } from '../src/shared/logger.js';

function harness() {
  const state = { time: new Date('2026-09-07T10:30:00Z'), lock: Promise.resolve(),
    leaseExpiresAt: new Date('2026-09-07T10:32:00Z') };
  const readSources = vi.fn().mockResolvedValue([]);
  const tx = {
    $executeRaw: vi.fn(async () => { await state.lock; return 1; }),
    $queryRaw: vi.fn(async (sql: TemplateStringsArray) => {
      const query = sql.join('');
      if (query.includes('WorkHistoryProgress')) return [{ trackingStartDate: new Date('2026-09-07'), lastProcessedDate: new Date('2026-09-06') }];
      if (query.includes('SnapshotRun')) return [{ id: 'run', status: 'RUNNING', leaseToken: 'owner', leaseExpiresAt: state.leaseExpiresAt, attemptCount: 1 }];
      if (query.includes('WorkHistorySource')) return readSources();
      expect(query).toContain('clock_timestamp()');
      return [{ now: state.time }];
    }),
    history: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    snapshotRun: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    workHistoryProgress: { update: vi.fn().mockResolvedValue({}) },
  };
  const commit = vi.fn().mockResolvedValue(undefined);
  const db = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
    const result = await callback(tx); await commit(); return result;
  } };
  return { state, tx, readSources, commit, coordinator: new SnapshotCoordinatorService(db as unknown as PrismaClient) };
}

describe('Snapshot clock and commit boundaries', () => {
  afterEach(() => vi.clearAllMocks());
  it('continues after midnight if the lease remains valid', async () => {
    const { state, coordinator, tx } = harness();
    state.time = new Date('2026-09-07T16:59:59Z');
    state.leaseExpiresAt = new Date('2026-09-07T17:02:00Z');
    let unlock!: () => void;
    state.lock = new Promise<void>(resolve => { unlock = resolve; });
    const execution = coordinator.executeAttempt('2026-09-07', 'owner');
    state.time = new Date('2026-09-07T17:00:01Z'); unlock();
    await expect(execution).resolves.toEqual({ insertedCount: 0 });
    expect(tx.workHistoryProgress.update).toHaveBeenCalled();
  });
  it('rejects an expired lease even if its token still matches', async () => {
    const { state, readSources, coordinator } = harness();
    state.time = state.leaseExpiresAt;
    await expect(coordinator.executeAttempt('2026-09-07', 'owner')).rejects.toThrow('LEASE_LOST');
    expect(readSources).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
  it('checks the lease again after slow source reads', async () => {
    const { state, tx, readSources, coordinator } = harness();
    readSources.mockImplementation(async () => { state.time = state.leaseExpiresAt; return []; });
    await expect(coordinator.executeAttempt('2026-09-07', 'owner')).rejects.toThrow('LEASE_LOST');
    expect(tx.workHistoryProgress.update).not.toHaveBeenCalled();
    expect(tx.snapshotRun.updateMany).not.toHaveBeenCalled();
  });
  it('does not advance the cursor when the lease token no longer matches at completion', async () => {
    const { tx, coordinator } = harness();
    tx.snapshotRun.updateMany.mockResolvedValue({ count: 0 });
    await expect(coordinator.executeAttempt('2026-09-07', 'owner')).rejects.toThrow('LEASE_LOST');
    expect(tx.workHistoryProgress.update).not.toHaveBeenCalled();
  });
  it('emits success only after commit resolves', async () => {
    const { commit, coordinator } = harness();
    commit.mockImplementation(async () => { expect(logger.info).not.toHaveBeenCalled(); });
    await coordinator.executeAttempt('2026-09-07', 'owner');
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'snapshot.succeeded' }), expect.any(String));
  });
  it('does not emit success when commit fails', async () => {
    const { commit, coordinator } = harness();
    commit.mockRejectedValue(new Error('COMMIT_FAILED'));
    await expect(coordinator.executeAttempt('2026-09-07', 'owner')).rejects.toThrow('COMMIT_FAILED');
    expect(logger.info).not.toHaveBeenCalled();
  });
});

import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/shared/prisma.js', () => ({ prisma: {} }));
vi.mock('../src/shared/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { SnapshotCoordinatorService } from '../src/modules/schedule/snapshot-coordinator.service.js';
import { logger } from '../src/shared/logger.js';

function harness() {
  const state = {
    time: new Date('2026-09-07T10:30:00Z'),
    lock: Promise.resolve(),
    leaseExpiresAt: new Date('2026-09-07T10:32:00Z'),
  };
  const tx = {
    $queryRaw: vi.fn(async (sql: TemplateStringsArray) => {
      if (sql.join('').includes('FOR UPDATE')) {
        await state.lock;
        return [{ id: 'run', status: 'RUNNING', leaseToken: 'owner', leaseExpiresAt: state.leaseExpiresAt, attemptCount: 1 }];
      }
      expect(sql.join('')).toContain('clock_timestamp()');
      return [{ now: state.time }];
    }),
    account: { findMany: vi.fn().mockResolvedValue([]) },
    history: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    snapshotRun: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const commit = vi.fn().mockResolvedValue(undefined);
  const db = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      const result = await callback(tx);
      await commit();
      return result;
    },
  };
  return { state, tx, commit, coordinator: new SnapshotCoordinatorService(db as unknown as PrismaClient) };
}

describe('Snapshot clock and commit boundaries', () => {
  afterEach(() => vi.clearAllMocks());

  it('checks database wall time after a row lock delayed execution past midnight', async () => {
    const { state, tx, coordinator } = harness();
    state.time = new Date('2026-09-07T16:59:59Z');
    let unlock!: () => void;
    state.lock = new Promise<void>((resolve) => { unlock = resolve; });
    const execution = coordinator.executeAttempt('2026-09-07', 'owner');
    expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
    state.time = new Date('2026-09-07T17:00:01Z');
    unlock();
    await expect(execution).resolves.toEqual({ insertedCount: 0 });
    expect(tx.account.findMany).not.toHaveBeenCalled();
    expect(tx.history.createMany).not.toHaveBeenCalled();
    expect(tx.snapshotRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'MISSED', errorCode: 'DATE_PASSED' }),
    }));
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('rejects an expired lease even if its token still matches', async () => {
    const { state, tx, coordinator } = harness();
    state.time = state.leaseExpiresAt;
    await expect(coordinator.executeAttempt('2026-09-07', 'owner')).rejects.toThrow('LEASE_LOST');
    expect(tx.account.findMany).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('checks time again before writing after slow schedule reads', async () => {
    const { state, tx, coordinator } = harness();
    state.time = new Date('2026-09-07T16:59:59Z');
    state.leaseExpiresAt = new Date('2026-09-07T17:01:00Z');
    tx.account.findMany.mockImplementation(async () => {
      state.time = new Date('2026-09-07T17:00:01Z');
      return [];
    });
    await expect(coordinator.executeAttempt('2026-09-07', 'owner')).rejects.toThrow('DATE_PASSED');
    expect(tx.history.createMany).not.toHaveBeenCalled();
    expect(tx.snapshotRun.updateMany).not.toHaveBeenCalled();
  });

  it('emits success only after commit resolves', async () => {
    const { commit, coordinator } = harness();
    commit.mockImplementation(async () => { expect(logger.info).not.toHaveBeenCalled(); });
    await coordinator.executeAttempt('2026-09-07', 'owner');
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'snapshot.succeeded' }), expect.any(String));
  });

  it('does not emit success if commit fails after all transaction statements succeed', async () => {
    const { commit, tx, coordinator } = harness();
    commit.mockRejectedValue(new Error('COMMIT_FAILED'));
    await expect(coordinator.executeAttempt('2026-09-07', 'owner')).rejects.toThrow('COMMIT_FAILED');
    expect(tx.snapshotRun.updateMany).toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});

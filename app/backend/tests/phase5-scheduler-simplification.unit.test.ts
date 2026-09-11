import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reconcilePass: vi.fn(),
  getNextWakeDelay: vi.fn(),
}));

vi.mock('../src/modules/schedule/snapshot-coordinator.service.js', () => ({
  SnapshotCoordinatorService: class {
    reconcilePass = mocks.reconcilePass;
    getNextWakeDelay = mocks.getNextWakeDelay;
  },
}));

vi.mock('../src/shared/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { startScheduleSnapshotJob, getDelayUntilNextBangkok1730 } from '../src/jobs/schedule-snapshot.job.js';

describe('Phase 5 — Event-Driven Snapshot Scheduler Simplification (Option B)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.reconcilePass.mockReset();
    mocks.getNextWakeDelay.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('runs startup reconciliation immediately and schedules the next wake at 17:30 Bangkok', async () => {
    mocks.reconcilePass.mockResolvedValue(0);
    mocks.getNextWakeDelay.mockResolvedValue(5 * 60 * 60 * 1000); // 5 hours

    const job = startScheduleSnapshotJob();

    // Initial pass runs immediately
    expect(mocks.reconcilePass).toHaveBeenCalledTimes(1);

    // Let the initial pass and its finally block settle
    await job.waitForActiveTask();
    await Promise.resolve();

    expect(mocks.getNextWakeDelay).toHaveBeenCalledTimes(1);

    // Advancing 60s should NOT trigger another reconcile pass (no 60s busy polling)
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.reconcilePass).toHaveBeenCalledTimes(1);

    // Advancing to the scheduled 5h wake should trigger the next pass
    await vi.advanceTimersByTimeAsync(5 * 60 * 60 * 1000 - 60_000);
    expect(mocks.reconcilePass).toHaveBeenCalledTimes(2);

    await job.stop();
  });

  it('schedules an earlier retry wake if a run failed with nextAttemptAt', async () => {
    mocks.reconcilePass.mockResolvedValue(0);
    const retryDelayMs = 60_000; // 1 minute retry backoff
    mocks.getNextWakeDelay.mockResolvedValue(retryDelayMs);

    const job = startScheduleSnapshotJob();
    await job.waitForActiveTask();
    await Promise.resolve();

    expect(mocks.reconcilePass).toHaveBeenCalledTimes(1);

    // Advancing by retryDelayMs triggers the retry pass
    await vi.advanceTimersByTimeAsync(retryDelayMs);
    expect(mocks.reconcilePass).toHaveBeenCalledTimes(2);

    await job.stop();
  });

  it('falls back to safe timer if getNextWakeDelay throws a transient error', async () => {
    mocks.reconcilePass.mockResolvedValue(0);
    mocks.getNextWakeDelay.mockRejectedValue(new Error('DB unreachable'));

    const job = startScheduleSnapshotJob();
    await job.waitForActiveTask();
    await Promise.resolve();

    expect(mocks.reconcilePass).toHaveBeenCalledTimes(1);

    // Fallback 60s timer triggers retry
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.reconcilePass).toHaveBeenCalledTimes(2);

    await job.stop();
  });

  it('cancels scheduled wake and stops cleanly', async () => {
    mocks.reconcilePass.mockResolvedValue(0);
    mocks.getNextWakeDelay.mockResolvedValue(3600_000);

    const job = startScheduleSnapshotJob();
    await job.waitForActiveTask();
    await Promise.resolve();

    expect(mocks.reconcilePass).toHaveBeenCalledTimes(1);

    await job.stop();

    // Advancing past the timer delay must not trigger any new pass
    await vi.advanceTimersByTimeAsync(7200_000);
    expect(mocks.reconcilePass).toHaveBeenCalledTimes(1);
  });
});

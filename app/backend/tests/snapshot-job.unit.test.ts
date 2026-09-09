import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { reconcilePass } = vi.hoisted(() => ({ reconcilePass: vi.fn() }));
vi.mock('../src/modules/schedule/snapshot-coordinator.service.js', () => ({
  SnapshotCoordinatorService: class { reconcilePass = reconcilePass; },
}));
vi.mock('../src/shared/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
import { startScheduleSnapshotJob } from '../src/jobs/schedule-snapshot.job.js';

describe('Snapshot job lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); reconcilePass.mockReset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('joins manual and timer triggers and waits for the original task on stop', async () => {
    let release!: () => void;
    reconcilePass.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    const job = startScheduleSnapshotJob();
    const manual = job.triggerNow();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(reconcilePass).toHaveBeenCalledTimes(1);
    let stopped = false;
    const stopping = job.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await Promise.all([manual, stopping]);
    expect(stopped).toBe(true);
    await job.triggerNow();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reconcilePass).toHaveBeenCalledTimes(1);
  });

  it('allows a later run after a failed task settles', async () => {
    reconcilePass.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const job = startScheduleSnapshotJob();
    await job.waitForActiveTask();
    await job.triggerNow();
    expect(reconcilePass).toHaveBeenCalledTimes(2);
    await job.stop();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stop: vi.fn(), cleanup: vi.fn(), disconnect: vi.fn(),
  close: vi.fn(), closeIdleConnections: vi.fn(), setShuttingDown: vi.fn(),
}));
vi.mock('../src/config.js', () => ({ config: { PORT: 4000, HOST: 'localhost' } }));
vi.mock('../src/app.js', () => ({
  createApp: () => ({ listen: () => ({ close: mocks.close, closeIdleConnections: mocks.closeIdleConnections }) }),
}));
vi.mock('../src/jobs/schedule-snapshot.job.js', () => ({ startScheduleSnapshotJob: () => ({ stop: mocks.stop }) }));
vi.mock('../src/shared/prisma.js', () => ({ prisma: { $disconnect: mocks.disconnect } }));
vi.mock('../src/shared/rateLimitStore.js', () => ({ cleanupExpiredRateLimits: mocks.cleanup }));
vi.mock('../src/modules/health/health.controller.js', () => ({ setShuttingDown: mocks.setShuttingDown }));
vi.mock('../src/shared/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

describe('Shutdown deadline', () => {
  let signal: () => Promise<void>;
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.stop.mockResolvedValue(undefined);
    mocks.cleanup.mockResolvedValue(0);
    mocks.disconnect.mockResolvedValue(undefined);
    mocks.close.mockImplementation((callback: () => void) => callback());
    vi.spyOn(process, 'on').mockImplementation(((event: string, callback: () => Promise<void>) => {
      if (event === 'SIGTERM') signal = callback;
      return process;
    }) as typeof process.on);
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('forces exit at 30 seconds even if database disconnect never resolves', async () => {
    mocks.disconnect.mockImplementation(() => new Promise(() => {}));
    await import('../src/main.js');
    signal();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(process.exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('waits for active snapshot and cleanup before disconnecting', async () => {
    let finishSnapshot!: () => void;
    let finishCleanup!: () => void;
    mocks.stop.mockImplementation(() => new Promise<void>((resolve) => { finishSnapshot = resolve; }));
    mocks.cleanup.mockImplementation(() => new Promise<number>((resolve) => { finishCleanup = () => resolve(0); }));
    await import('../src/main.js');
    signal();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.setShuttingDown).toHaveBeenCalledWith(true);
    expect(mocks.disconnect).not.toHaveBeenCalled();
    finishSnapshot();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.disconnect).not.toHaveBeenCalled();
    finishCleanup();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(process.exit).toHaveBeenCalledTimes(1);
  });

  it('forces exit without disconnecting early when a background task hangs', async () => {
    mocks.stop.mockImplementation(() => new Promise(() => {}));
    await import('../src/main.js');
    signal();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

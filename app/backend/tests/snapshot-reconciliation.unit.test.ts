import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SnapshotReconciliationService } from '../src/modules/schedule/snapshot-reconciliation.service.js';
import type { SnapshotRepository, Progress } from '../src/modules/schedule/snapshot.repository.js';
import { DefaultSnapshotRetryPolicy } from '../src/modules/schedule/snapshot-retry-policy.js';

describe('SnapshotReconciliationService', () => {
  let mockRepository: Partial<SnapshotRepository>;
  const retryPolicy = new DefaultSnapshotRetryPolicy();

  beforeEach(() => {
    mockRepository = {
      initializeProgressRecord: vi.fn(),
      executeTransaction: vi.fn(),
      lockProgress: vi.fn(),
      updateLastProcessedDate: vi.fn(),
      createPendingRun: vi.fn(),
      findRunByWorkDateOrThrow: vi.fn(),
      claimRun: vi.fn(),
      getProgressOrThrow: vi.fn(),
    };
  });

  describe('assertNextDate', () => {
    const service = new SnapshotReconciliationService(
      mockRepository as SnapshotRepository,
      retryPolicy,
    );

    const progress: Progress = {
      trackingStartDate: new Date('2026-09-01T00:00:00.000Z'),
      lastProcessedDate: new Date('2026-09-06T00:00:00.000Z'),
    };

    it('accepts next contiguous date', () => {
      expect(() => service.assertNextDate(progress, '2026-09-07')).not.toThrow();
    });

    it('rejects date before tracking start date', () => {
      expect(() => service.assertNextDate(progress, '2026-08-31')).toThrow(
        'HISTORY_PROGRESS_CONFLICT',
      );
    });

    it('rejects non-contiguous skipped date', () => {
      expect(() => service.assertNextDate(progress, '2026-09-08')).toThrow(
        'HISTORY_PROGRESS_CONFLICT',
      );
    });

    it('rejects duplicate/past processed date', () => {
      expect(() => service.assertNextDate(progress, '2026-09-06')).toThrow(
        'HISTORY_PROGRESS_CONFLICT',
      );
    });
  });

  describe('initializeProgress', () => {
    it('throws on invalid trackingStartDate format', async () => {
      const service = new SnapshotReconciliationService(
        mockRepository as SnapshotRepository,
        retryPolicy,
        '2026-9-1', // invalid format (not YYYY-MM-DD)
      );

      await expect(service.initializeProgress(new Date('2026-09-10T10:00:00Z'))).rejects.toThrow(
        'INVALID_TRACKING_START_DATE',
      );
    });

    it('calls repository to initialize with valid start date', async () => {
      (mockRepository.initializeProgressRecord as any).mockResolvedValueOnce({
        id: 'default',
        trackingStartDate: new Date('2026-09-01T00:00:00Z'),
        lastProcessedDate: new Date('2026-08-31T00:00:00Z'),
      });

      const service = new SnapshotReconciliationService(
        mockRepository as SnapshotRepository,
        retryPolicy,
        '2026-09-01',
      );

      const result = await service.initializeProgress(new Date('2026-09-10T10:00:00Z'));
      expect(result.id).toBe('default');
      expect(mockRepository.initializeProgressRecord).toHaveBeenCalledWith('2026-09-10');
    });
  });

  describe('reconcilePass time decoupling', () => {
    it('forwards undefined now into claim, execute, and failure handlers when caller omits now', async () => {
      const dbTime = new Date('2026-09-07T12:00:00.000Z'); // Monday after 17:30 Bangkok (10:30 UTC)
      mockRepository.getDbTime = vi.fn().mockResolvedValue(dbTime);
      (mockRepository.initializeProgressRecord as any).mockResolvedValue({
        id: 'default',
        trackingStartDate: new Date('2026-09-07T00:00:00Z'),
        lastProcessedDate: new Date('2026-09-06T00:00:00Z'),
      });
      (mockRepository.createPendingRun as any).mockResolvedValue(undefined);
      (mockRepository.findRunByWorkDateOrThrow as any).mockResolvedValue({
        id: 'run-1',
        workDate: new Date('2026-09-07T00:00:00Z'),
        status: 'PENDING',
      });
      (mockRepository.claimRun as any).mockResolvedValue(true);
      (mockRepository.getProgressOrThrow as any).mockResolvedValue({
        id: 'default',
        trackingStartDate: new Date('2026-09-07T00:00:00Z'),
        lastProcessedDate: new Date('2026-09-07T00:00:00Z'),
      });

      const executeAttemptFn = vi.fn().mockResolvedValue({ insertedCount: 5 });
      const recordFailureFn = vi.fn().mockResolvedValue(undefined);

      const service = new SnapshotReconciliationService(
        mockRepository as SnapshotRepository,
        retryPolicy,
        '2026-09-07',
      );

      const count = await service.reconcilePass(undefined, executeAttemptFn, recordFailureFn);
      expect(count).toBe(5);
      expect(mockRepository.getDbTime).toHaveBeenCalled();
      // Verifies original optional now (undefined) is forwarded so execution uses fresh DB clock
      expect(mockRepository.claimRun).toHaveBeenCalledWith(
        '2026-09-07',
        expect.any(String),
        undefined,
      );
      expect(executeAttemptFn).toHaveBeenCalledWith('2026-09-07', expect.any(String), undefined);
    });

    it('forwards injected now when caller explicitly provides now', async () => {
      const fixedTime = new Date('2026-09-07T12:00:00.000Z');
      (mockRepository.initializeProgressRecord as any).mockResolvedValue({
        id: 'default',
        trackingStartDate: new Date('2026-09-07T00:00:00Z'),
        lastProcessedDate: new Date('2026-09-06T00:00:00Z'),
      });
      (mockRepository.createPendingRun as any).mockResolvedValue(undefined);
      (mockRepository.findRunByWorkDateOrThrow as any).mockResolvedValue({
        id: 'run-1',
        workDate: new Date('2026-09-07T00:00:00Z'),
        status: 'PENDING',
      });
      (mockRepository.claimRun as any).mockResolvedValue(true);
      (mockRepository.getProgressOrThrow as any).mockResolvedValue({
        id: 'default',
        trackingStartDate: new Date('2026-09-07T00:00:00Z'),
        lastProcessedDate: new Date('2026-09-07T00:00:00Z'),
      });

      const executeAttemptFn = vi.fn().mockRejectedValue(new Error('LEASE_LOST'));
      const recordFailureFn = vi.fn().mockResolvedValue(undefined);

      const service = new SnapshotReconciliationService(
        mockRepository as SnapshotRepository,
        retryPolicy,
        '2026-09-07',
      );

      await service.reconcilePass(fixedTime, executeAttemptFn, recordFailureFn);
      expect(executeAttemptFn).toHaveBeenCalledWith('2026-09-07', expect.any(String), fixedTime);
      expect(recordFailureFn).toHaveBeenCalledWith(
        '2026-09-07',
        expect.any(String),
        'LEASE_LOST',
        fixedTime,
      );
    });
  });
});

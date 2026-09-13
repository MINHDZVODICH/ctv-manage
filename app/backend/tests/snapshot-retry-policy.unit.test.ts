import { describe, expect, it } from 'vitest';
import {
  DefaultSnapshotRetryPolicy,
  standardizeSnapshotErrorCode,
} from '../src/modules/schedule/snapshot-retry-policy.js';

describe('SnapshotRetryPolicy', () => {
  const policy = new DefaultSnapshotRetryPolicy();

  describe('standardizeSnapshotErrorCode', () => {
    it('handles null/undefined error', () => {
      expect(standardizeSnapshotErrorCode(null)).toBe('SNAPSHOT_EXECUTION_FAILED');
      expect(standardizeSnapshotErrorCode(undefined)).toBe('SNAPSHOT_EXECUTION_FAILED');
    });

    it('preserves uppercase snake_case error string or code', () => {
      expect(standardizeSnapshotErrorCode('LEASE_LOST')).toBe('LEASE_LOST');
      expect(standardizeSnapshotErrorCode({ code: 'CUSTOM_ERR_1' })).toBe('CUSTOM_ERR_1');
      expect(standardizeSnapshotErrorCode(new Error('CUSTOM_ERROR'))).toBe('CUSTOM_ERROR');
    });

    it('classifies timeout messages to DB_TIMEOUT', () => {
      expect(standardizeSnapshotErrorCode(new Error('Query timeout after 5000ms'))).toBe(
        'DB_TIMEOUT',
      );
    });

    it('falls back to default for arbitrary messages', () => {
      expect(standardizeSnapshotErrorCode(new Error('something bad happened'))).toBe(
        'SNAPSHOT_EXECUTION_FAILED',
      );
    });
  });

  describe('calculateNextAttemptAt', () => {
    const baseTime = new Date('2026-09-10T12:00:00Z');

    it('schedules 1 minute backoff for attempt 1', () => {
      const next = policy.calculateNextAttemptAt(1, baseTime);
      expect(next.getTime() - baseTime.getTime()).toBe(60_000);
    });

    it('schedules 5 minutes backoff for attempt 2', () => {
      const next = policy.calculateNextAttemptAt(2, baseTime);
      expect(next.getTime() - baseTime.getTime()).toBe(5 * 60_000);
    });

    it('schedules 15 minutes backoff for attempt 3', () => {
      const next = policy.calculateNextAttemptAt(3, baseTime);
      expect(next.getTime() - baseTime.getTime()).toBe(15 * 60_000);
    });

    it('schedules 30 minutes backoff for attempt 4 and above', () => {
      const next4 = policy.calculateNextAttemptAt(4, baseTime);
      expect(next4.getTime() - baseTime.getTime()).toBe(30 * 60_000);

      const next5 = policy.calculateNextAttemptAt(5, baseTime);
      expect(next5.getTime() - baseTime.getTime()).toBe(30 * 60_000);
    });
  });

  describe('injectable retry options', () => {
    it('uses custom backoff schedule when injected', () => {
      const customPolicy = new DefaultSnapshotRetryPolicy({
        backoffScheduleMinutes: [2, 10, 20],
      });
      const baseTime = new Date('2026-09-10T12:00:00Z');
      expect(customPolicy.calculateNextAttemptAt(1, baseTime).getTime() - baseTime.getTime()).toBe(
        2 * 60_000,
      );
      expect(customPolicy.calculateNextAttemptAt(2, baseTime).getTime() - baseTime.getTime()).toBe(
        10 * 60_000,
      );
      expect(customPolicy.calculateNextAttemptAt(3, baseTime).getTime() - baseTime.getTime()).toBe(
        20 * 60_000,
      );
      expect(customPolicy.calculateNextAttemptAt(4, baseTime).getTime() - baseTime.getTime()).toBe(
        20 * 60_000,
      );
    });
  });
});

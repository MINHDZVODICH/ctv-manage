import { describe, it, expect } from 'vitest';
import {
  todayInBangkok,
  currentMonthInBangkok,
  addDays,
  weekdayUtc,
  parseYmdToUtcDate,
  formatUtcDateToYmd,
} from '../src/shared/timezone.js';
import {
  getDelayUntilNextBangkok1730,
  startScheduleSnapshotJob,
} from '../src/jobs/schedule-snapshot.job.js';
import {
  saveBufferToFile,
  fileExists,
  deleteFile,
  getStoragePath,
} from '../src/shared/fileStorage.js';
import { config } from '../src/config.js';

describe('Phase 5 Hardening — Jobs, File Storage & Timezone', () => {
  describe('Timezone & Date Helpers', () => {
    it('formats today in Bangkok as YYYY-MM-DD', () => {
      const today = todayInBangkok();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('formats current month in Bangkok as YYYY-MM', () => {
      const month = currentMonthInBangkok();
      expect(month).toMatch(/^\d{4}-\d{2}$/);
    });

    it('adds days correctly across month boundaries', () => {
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    });

    it('computes ISO weekday consistently', () => {
      // 2026-09-07 is Monday -> 1
      const monday = parseYmdToUtcDate('2026-09-07');
      expect(weekdayUtc(monday)).toBe(1);

      // 2026-09-13 is Sunday -> 7
      const sunday = parseYmdToUtcDate('2026-09-13');
      expect(weekdayUtc(sunday)).toBe(7);
    });

    it('converts between UTC Date and YMD string losslessly', () => {
      const ymd = '2026-10-15';
      const d = parseYmdToUtcDate(ymd);
      expect(formatUtcDateToYmd(d)).toBe(ymd);
    });
  });

  describe('Schedule Snapshot Job Controller', () => {
    it('calculates a positive delay until next 17:30 Bangkok', () => {
      const delay = getDelayUntilNextBangkok1730();
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('can be started, triggered, and stopped gracefully', async () => {
      const job = startScheduleSnapshotJob();
      expect(typeof job.stop).toBe('function');
      expect(typeof job.triggerNow).toBe('function');

      // Triggering manually does not throw
      await expect(job.triggerNow()).resolves.toBeUndefined();

      // Stopping job stops timers
      job.stop();
    });
  });

  describe('Async File Storage Operations', () => {
    const testKey = 'test/hardening/sample.txt';
    const testBuffer = Buffer.from('hello async storage hardening', 'utf8');

    it('saves buffer, checks existence, and deletes cleanly asynchronously', async () => {
      // Save
      await saveBufferToFile(testBuffer, testKey);

      // Exists
      const exists = await fileExists(testKey);
      expect(exists).toBe(true);

      // Delete
      await deleteFile(testKey);

      // Verify no longer exists
      const existsAfter = await fileExists(testKey);
      expect(existsAfter).toBe(false);
    });

    it('rejects path traversal in storage keys', () => {
      expect(() => getStoragePath('../../etc/passwd')).toThrow();
      expect(() => getStoragePath('../secret')).toThrow();
    });
  });

  describe('Environment Configuration', () => {
    it('exposes validated environment variables with defaults', () => {
      expect(config.PORT).toBeDefined();
      expect(config.HOST).toBeDefined();
      expect(config.CORS_ORIGIN).toBeDefined();
      expect(config.FILE_STORAGE_ROOT).toBeDefined();
    });
  });
});

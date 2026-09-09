import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors } from './helpers.js';
import { SnapshotCoordinatorService } from '../src/modules/schedule/snapshot-coordinator.service.js';
import {
  todayInBangkok,
  addDays,
  parseYmdToUtcDate,
} from '../src/shared/timezone.js';

const app = createApp();

describe('Operations Snapshot Runs & Missed Date Tracking Integration Tests', () => {
  let coordinator: SnapshotCoordinatorService;

  beforeEach(async () => {
    delete process.env.SNAPSHOT_TRACKING_START_DATE;
    await resetDatabase();
    await seedActors();
    coordinator = new SnapshotCoordinatorService();
  });

  afterAll(async () => {
    delete process.env.SNAPSHOT_TRACKING_START_DATE;
    await prisma.$disconnect();
  });

  describe('GET /api/v1/operations/snapshot-runs', () => {
    it('returns 401 for anonymous requests', async () => {
      const res = await request(app).get('/api/v1/operations/snapshot-runs');
      expect(res.status).toBe(401);
    });

    it('returns 403 for CTV role requests', async () => {
      const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
      const res = await request(app)
        .get('/api/v1/operations/snapshot-runs')
        .set('Cookie', ctvCookie);
      expect(res.status).toBe(403);
    });

    it('returns 200 with list of runs for ADMIN role', async () => {
      const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

      // Create a couple runs
      const run1 = await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate('2026-09-07'),
          status: 'SUCCEEDED',
          attemptCount: 1,
          startedAt: new Date('2026-09-07T10:30:00.000Z'),
          completedAt: new Date('2026-09-07T10:30:02.000Z'),
          insertedCount: 12,
          leaseToken: 'sensitive-lease-token-1',
        },
      });

      const run2 = await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate('2026-09-08'),
          status: 'MISSED',
          attemptCount: 0,
          insertedCount: 0,
          leaseToken: 'sensitive-lease-token-2',
        },
      });

      const res = await request(app)
        .get('/api/v1/operations/snapshot-runs?from=2026-09-07&to=2026-09-08')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const item1 = res.body.find((r: any) => r.id === run1.id);
      expect(item1).toBeDefined();
      expect(item1.workDate).toBe('2026-09-07');
      expect(item1.status).toBe('SUCCEEDED');
      expect(item1.attemptCount).toBe(1);
      expect(item1.insertedCount).toBe(12);
      expect(item1.startedAt).toBe('2026-09-07T10:30:00.000Z');
      expect(item1.completedAt).toBe('2026-09-07T10:30:02.000Z');

      // Crucial security check: leaseToken MUST NOT be present
      expect(item1.leaseToken).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('sensitive-lease-token');
      expect(JSON.stringify(res.body)).not.toContain('postgresql');
    });

    it('defaults date range to last 30 Bangkok calendar days when query params are omitted', async () => {
      const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

      const todayStr = todayInBangkok();
      const inRangeDateStr = addDays(todayStr, -29); // 30th day inclusive
      const outOfRangeDateStr = addDays(todayStr, -30); // 31st day, out of range

      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate(inRangeDateStr),
          status: 'SUCCEEDED',
          attemptCount: 1,
          insertedCount: 5,
        },
      });

      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate(outOfRangeDateStr),
          status: 'SUCCEEDED',
          attemptCount: 1,
          insertedCount: 3,
        },
      });

      const res = await request(app)
        .get('/api/v1/operations/snapshot-runs')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const workDates = res.body.map((r: any) => r.workDate);
      expect(workDates).toContain(inRangeDateStr);
      expect(workDates).not.toContain(outOfRangeDateStr);
    });

    it('allows date range of exactly 90 days but returns 400 if date range is 91 days', async () => {
      const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

      // 2026-01-01 to 2026-03-31 is exactly 90 days inclusive (31 + 28 + 31)
      const res90 = await request(app)
        .get('/api/v1/operations/snapshot-runs?from=2026-01-01&to=2026-03-31')
        .set('Cookie', adminCookie);
      expect(res90.status).toBe(200);

      // 2026-01-01 to 2026-04-01 is 91 days inclusive (exceeds 90-day limit)
      const res91 = await request(app)
        .get('/api/v1/operations/snapshot-runs?from=2026-01-01&to=2026-04-01')
        .set('Cookie', adminCookie);
      expect(res91.status).toBe(400);
      expect(res91.body.error).toBeDefined();
      expect(res91.body.error.code).toBe('DATE_RANGE_EXCEEDED');
    });

    it('returns 400 if from is after to', async () => {
      const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

      const res = await request(app)
        .get('/api/v1/operations/snapshot-runs?from=2026-09-10&to=2026-09-01')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for invalid date format', async () => {
      const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

      const res = await request(app)
        .get('/api/v1/operations/snapshot-runs?from=invalid-date&to=2026-09-10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});

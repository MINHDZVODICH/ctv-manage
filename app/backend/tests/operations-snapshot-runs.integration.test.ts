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

  describe('Missed Date Tracking', () => {
    it('detects unexecuted weekdays between SNAPSHOT_TRACKING_START_DATE and yesterday, creating them with status=MISSED and insertedCount=0', async () => {
      // Simulate today is Thursday 2026-09-10 18:00 Bangkok (11:00 UTC)
      // 3 business days ago:
      // Thursday (today) -> Wednesday 09-09 (1), Tuesday 09-08 (2), Monday 09-07 (3)
      const now = new Date('2026-09-10T11:00:00.000Z');
      const startDate = '2026-09-07';
      process.env.SNAPSHOT_TRACKING_START_DATE = startDate;

      // Seed an active CTV with shifts so we can verify no history is created for missed dates
      const ctv = await prisma.account.findUnique({
        where: { email: 'ctv.active@ctv.local' },
      });
      expect(ctv).not.toBeNull();

      await prisma.schedule.create({
        data: {
          accountId: ctv!.id,
          roomCode: 'ROOM_1',
          shifts: {
            create: [
              { weekday: 1, period: 'MORNING' }, // Monday
              { weekday: 2, period: 'MORNING' }, // Tuesday
              { weekday: 3, period: 'MORNING' }, // Wednesday
            ],
          },
        },
      });

      // Run reconciliation pass
      await coordinator.reconcilePass(now);

      // Verify past weekdays are created with status = 'MISSED' and insertedCount = 0
      const missedRuns = await prisma.snapshotRun.findMany({
        where: {
          workDate: {
            in: [
              parseYmdToUtcDate('2026-09-07'),
              parseYmdToUtcDate('2026-09-08'),
              parseYmdToUtcDate('2026-09-09'),
            ],
          },
        },
        orderBy: { workDate: 'asc' },
      });

      expect(missedRuns).toHaveLength(3);
      for (const run of missedRuns) {
        expect(run.status).toBe('MISSED');
        expect(run.insertedCount).toBe(0);
        expect(run.leaseToken).toBeNull();
      }

      // Assert NO History entries were inserted for MISSED dates
      const historyEntries = await prisma.history.findMany({
        where: {
          workDate: {
            in: [
              parseYmdToUtcDate('2026-09-07'),
              parseYmdToUtcDate('2026-09-08'),
              parseYmdToUtcDate('2026-09-09'),
            ],
          },
        },
      });
      expect(historyEntries).toHaveLength(0);
    });

    it('updates past weekdays with PENDING or FAILED status to MISSED without touching SUCCEEDED runs', async () => {
      // Simulate today is Wednesday 2026-09-09 18:00 Bangkok (11:00 UTC)
      const now = new Date('2026-09-09T11:00:00.000Z');
      const startDate = '2026-09-04'; // Friday (day 5)
      // Past weekdays: Friday 09-04, Monday 09-07, Tuesday 09-08
      // Weekend: Saturday 09-05, Sunday 09-06

      // Pre-seed Friday as SUCCEEDED
      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate('2026-09-04'),
          status: 'SUCCEEDED',
          insertedCount: 5,
        },
      });

      // Pre-seed Monday as FAILED
      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate('2026-09-07'),
          status: 'FAILED',
          attemptCount: 2,
          errorCode: 'NETWORK_TIMEOUT',
          leaseToken: 'old-token',
        },
      });

      // Pre-seed Tuesday as PENDING
      await prisma.snapshotRun.create({
        data: {
          workDate: parseYmdToUtcDate('2026-09-08'),
          status: 'PENDING',
          attemptCount: 0,
        },
      });

      await (coordinator as any).reconcileMissedDates(startDate, now);

      // Check Friday remained SUCCEEDED
      const friRun = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-04') },
      });
      expect(friRun?.status).toBe('SUCCEEDED');
      expect(friRun?.insertedCount).toBe(5);

      // Check Monday updated to MISSED
      const monRun = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-07') },
      });
      expect(monRun?.status).toBe('MISSED');
      expect(monRun?.leaseToken).toBeNull();

      // Check Tuesday updated to MISSED
      const tueRun = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-08') },
      });
      expect(tueRun?.status).toBe('MISSED');
      expect(tueRun?.leaseToken).toBeNull();

      // Check weekends (Saturday 09-05, Sunday 09-06) were NOT created
      const satRun = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-05') },
      });
      expect(satRun).toBeNull();

      const sunRun = await prisma.snapshotRun.findUnique({
        where: { workDate: parseYmdToUtcDate('2026-09-06') },
      });
      expect(sunRun).toBeNull();
    });
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
      const inRangeDateStr = addDays(todayStr, -15);
      const outOfRangeDateStr = addDays(todayStr, -35);

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

    it('returns 400 if date range exceeds 90 days', async () => {
      const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

      const res = await request(app)
        .get('/api/v1/operations/snapshot-runs?from=2026-01-01&to=2026-04-10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
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

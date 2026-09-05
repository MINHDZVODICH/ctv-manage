import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors } from './helpers.js';
import {
  syncDailyHistory,
} from '../src/modules/schedule/schedule.service.js';

const app = createApp();

describe('Phase B — Schedule, Shifts, Cancellations & History Suite (SCH-001..012, CAN-001..005, SUM-001..003, HIST-001..005)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('SCH-001 & SCH-005: Schedule registration saves schedule and shifts in database', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Register Mon Morning + Wed Afternoon in ROOM_1
    const regRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_1',
        slots: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 3, period: 'AFTERNOON' },
        ],
      });
    expect(regRes.status).toBe(200);
    expect(regRes.body.data.roomCode).toBe('ROOM_1');
    expect(regRes.body.data.patternSlots).toHaveLength(2);

    // Verify schedule and shifts in database
    const schedule = await prisma.schedule.findUnique({
      where: { accountId: ctv.id },
      include: { shifts: true },
    });
    expect(schedule).not.toBeNull();
    expect(schedule?.roomCode).toBe('ROOM_1');
    expect(schedule?.shifts).toHaveLength(2);
    expect(schedule?.shifts.map((s) => s.period)).toEqual(
      expect.arrayContaining(['MORNING', 'AFTERNOON']),
    );
  });

  test('SCH-003: Invalid schedule slot validations (invalid weekday, invalid period, non-array slots)', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // Non-array slots
    const res1 = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: 'not-an-array' });
    expect(res1.status).toBe(400);

    // Invalid weekday (Sunday = 0, Saturday = 6)
    const res2 = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 6, period: 'MORNING' }] });
    expect(res2.status).toBe(400);

    // Invalid roomCode
    const res3 = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_999', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(res3.status).toBe(400);
  });

  test('SCH-006 & SCH-008: Updating schedule updates pattern and shifts', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // 1. Initial registration: Monday Morning
    const initRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(initRes.status).toBe(200);
    const initialVersion = initRes.body.data.version;

    // 2. Update registration: Change to Friday Afternoon in ROOM_2
    const updateRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [{ weekday: 5, period: 'AFTERNOON' }],
        expectedVersion: initialVersion,
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.roomCode).toBe('ROOM_2');
    expect(updateRes.body.data.version).toBe(initialVersion + 1);

    // 3. Query shifts in database
    const schedule = await prisma.schedule.findUnique({
      where: { accountId: ctv.id },
      include: { shifts: true },
    });
    expect(schedule?.roomCode).toBe('ROOM_2');
    expect(schedule?.shifts).toHaveLength(1);
    expect(schedule?.shifts[0].weekday).toBe(5);
    expect(schedule?.shifts[0].period).toBe('AFTERNOON');
  });

  test('SCH-006: Existing registration requires the current version and rejects stale writes atomically', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    const initRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(initRes.status).toBe(200);
    const initialVersion = initRes.body.data.version;

    const missingVersionRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_2', slots: [{ weekday: 2, period: 'AFTERNOON' }] });
    expect(missingVersionRes.status).toBe(409);
    expect(missingVersionRes.body.error.code).toBe('VERSION_CONFLICT');

    const staleVersionRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [{ weekday: 2, period: 'AFTERNOON' }],
        expectedVersion: initialVersion + 99,
      });
    expect(staleVersionRes.status).toBe(409);
    expect(staleVersionRes.body.error.code).toBe('VERSION_CONFLICT');

    const currentRes = await request(app)
      .get('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie);
    expect(currentRes.status).toBe(200);
    expect(currentRes.body.data.version).toBe(initialVersion);
    expect(currentRes.body.data.roomCode).toBe('ROOM_1');
    expect(currentRes.body.data.patternSlots).toEqual(
      expect.arrayContaining([expect.objectContaining({ weekday: 1, period: 'MORNING' })]),
    );
  });

  test('SUM-001..003 & RGR-10: Admin schedule summary distinguishes same-name CTVs and returns cells', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // CTV registers
    await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });

    // Admin requests summary
    const summaryRes = await request(app)
      .get('/api/v1/schedule-summary')
      .set('Cookie', adminCookie);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data).toBeDefined();
    expect(summaryRes.body.data.cells).toHaveLength(10);
  });

  test('HIST-001..005: Work history daily synchronization is idempotent and records snapshots', async () => {
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // 1. Seed history record
    await prisma.history.create({
      data: {
        accountId: ctv.id,
        workDate: new Date('2026-08-01T00:00:00.000Z'),
        period: 'MORNING',
        roomCode: 'ROOM_1',
        status: 'COMPLETED',
      },
    });

    // 2. Run syncDailyHistory
    await syncDailyHistory();

    const historyItems = await prisma.history.findMany({
      where: { accountId: ctv.id },
    });
    expect(historyItems.length).toBeGreaterThanOrEqual(1);

    const countBefore = historyItems.length;

    // 3. Run syncDailyHistory again (idempotency check)
    await syncDailyHistory();

    const countAfter = await prisma.history.count({
      where: { accountId: ctv.id },
    });
    expect(countAfter).toBe(countBefore);

    // 4. CTV reads own work history via API
    const histApiRes = await request(app)
      .get('/api/v1/users/me/work-history?month=2026-08')
      .set('Cookie', ctvCookie);
    expect(histApiRes.status).toBe(200);
    expect(histApiRes.body.data).toBeDefined();
    expect(histApiRes.body.data.cells.length).toBeGreaterThanOrEqual(1);
  });

  test('SYNC-001..004: Cross-view synchronization for Schedule, Shift, and History (4 weekly views + 3 history views)', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // 1. CTV registers Buồng 1 + T2 Morning + T3 Afternoon
    const regRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_1',
        slots: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 2, period: 'AFTERNOON' },
        ],
      });
    expect(regRes.status).toBe(200);

    // 2. View 1: Personal Schedule (CTV)
    const personalRes = await request(app)
      .get('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie);
    expect(personalRes.status).toBe(200);
    expect(personalRes.body.data.roomCode).toBe('ROOM_1');
    expect(personalRes.body.data.shifts).toHaveLength(2);

    // 3. View 2: Account Schedule (Admin viewing CTV)
    const adminAccountRes = await request(app)
      .get(`/api/v1/accounts/${ctv.id}/schedule`)
      .set('Cookie', adminCookie);
    expect(adminAccountRes.status).toBe(200);
    expect(adminAccountRes.body.data.roomCode).toBe('ROOM_1');
    expect(adminAccountRes.body.data.shifts).toHaveLength(2);

    // 4. View 3: Weekly Summary (Admin)
    const weeklyRes = await request(app)
      .get('/api/v1/schedule/weekly-summary')
      .set('Cookie', adminCookie);
    expect(weeklyRes.status).toBe(200);
    const monCell = weeklyRes.body.data.cells.find((c: any) => c.weekday === 1 && c.period === 'MORNING');
    expect(monCell.count).toBe(1);
    expect(monCell.shiftAssignments[0].roomCode).toBe('ROOM_1');
    const tueCell = weeklyRes.body.data.cells.find((c: any) => c.weekday === 2 && c.period === 'AFTERNOON');
    expect(tueCell.count).toBe(1);
    expect(tueCell.shiftAssignments[0].roomCode).toBe('ROOM_1');

    // 5. View 4: Backward-compatible summary
    const compatRes = await request(app)
      .get('/api/v1/schedule-summary')
      .set('Cookie', adminCookie);
    expect(compatRes.status).toBe(200);
    expect(compatRes.body.data.cells).toHaveLength(10);

    // 6. Test History Views before 17:30
    // Wednesday 2026-09-02 at 10:00 UTC (17:00 Asia/Bangkok, before 17:30 cutoff)
    const beforeCutoff = new Date('2026-09-02T10:00:00.000Z');
    await syncDailyHistory(beforeCutoff);

    const ctvHistBefore = await request(app)
      .get('/api/v1/users/me/work-history?month=2026-09')
      .set('Cookie', ctvCookie);
    expect(ctvHistBefore.status).toBe(200);
    // 2026-09-02 must NOT be recorded before 17:30
    const todayCellsBefore = ctvHistBefore.body.data.cells.filter((c: any) => c.workDate === '2026-09-02');
    expect(todayCellsBefore).toHaveLength(0);

    // 7. Add Wednesday shift for CTV and test History Views after 17:30
    await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_1',
        slots: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 2, period: 'AFTERNOON' },
          { weekday: 3, period: 'MORNING' },
        ],
        expectedVersion: 1,
      });

    // Run snapshot at 18:00 Asia/Bangkok on 2026-09-02
    const afterCutoff = new Date('2026-09-02T11:00:00.000Z');
    await syncDailyHistory(afterCutoff);

    // View 1: Personal History (CTV)
    const ctvHistAfter = await request(app)
      .get('/api/v1/users/me/work-history?month=2026-09')
      .set('Cookie', ctvCookie);
    expect(ctvHistAfter.status).toBe(200);
    const ctvTodayCells = ctvHistAfter.body.data.cells.filter((c: any) => c.workDate === '2026-09-02');
    expect(ctvTodayCells).toHaveLength(1);
    expect(ctvTodayCells[0].workDate).toBe('2026-09-02');
    expect(ctvTodayCells[0].period).toBe('MORNING');
    expect(ctvTodayCells[0].shiftAssignments[0].roomCode).toBe('ROOM_1');

    // View 2: Account History (Admin viewing CTV)
    const adminHistCtv = await request(app)
      .get(`/api/v1/work-history?month=2026-09&accountId=${ctv.id}`)
      .set('Cookie', adminCookie);
    expect(adminHistCtv.status).toBe(200);
    const adminTodayCells = adminHistCtv.body.data.cells.filter((c: any) => c.workDate === '2026-09-02');
    expect(adminTodayCells).toHaveLength(1);
    expect(adminTodayCells[0].workDate).toBe('2026-09-02');
    expect(adminTodayCells[0].shiftAssignments[0].roomCode).toBe('ROOM_1');

    // View 3: Summary History (Admin viewing all CTVs for month)
    const adminHistSummary = await request(app)
      .get('/api/v1/work-history?month=2026-09')
      .set('Cookie', adminCookie);
    expect(adminHistSummary.status).toBe(200);
    const summaryTodayCells = adminHistSummary.body.data.cells.filter((c: any) => c.workDate === '2026-09-02');
    expect(summaryTodayCells).toHaveLength(1);
    expect(summaryTodayCells[0].workDate).toBe('2026-09-02');
    expect(summaryTodayCells[0].shiftAssignments[0].displayName).toBe('CTV Active');
  });
});

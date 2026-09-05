import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors } from './helpers.js';
import { syncDailyHistory, snapshotTodayWorkHistory, parseYmdToUtcDate } from '../src/modules/schedule/schedule.service.js';

const app = createApp();

describe('Task 2 — Schedule, Shift and History Redesign Integration Tests', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Test 1: Schedule registration and retrieval (PUT / GET /api/v1/users/me/schedule & aliases)', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // 1. Initial schedule retrieval should return null
    const getInit = await request(app)
      .get('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie);
    expect(getInit.status).toBe(200);
    expect(getInit.body.data).toBeNull();

    // 2. Register new schedule via PUT /api/v1/users/me/schedule
    const putRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_1',
        slots: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 3, period: 'AFTERNOON' },
        ],
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.roomCode).toBe('ROOM_1');
    expect(putRes.body.data.version).toBe(1);
    expect(putRes.body.data.shifts).toHaveLength(2);
    expect(putRes.body.data.patternSlots).toHaveLength(2);

    // 3. Verify in database
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });
    const dbSchedule = await prisma.schedule.findUnique({
      where: { accountId: ctv.id },
      include: { shifts: true },
    });
    expect(dbSchedule).not.toBeNull();
    expect(dbSchedule?.roomCode).toBe('ROOM_1');
    expect(dbSchedule?.shifts).toHaveLength(2);

    // 4. Retrieve schedule via GET /api/v1/users/me/schedule
    const getRes = await request(app)
      .get('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.roomCode).toBe('ROOM_1');
    expect(getRes.body.data.version).toBe(1);
    expect(getRes.body.data.shifts).toEqual(
      expect.arrayContaining([
        { weekday: 1, period: 'MORNING' },
        { weekday: 3, period: 'AFTERNOON' },
      ]),
    );

    // 5. Backward-compatible alias: GET /api/v1/users/me/schedule-registration
    const aliasGet = await request(app)
      .get('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie);
    expect(aliasGet.status).toBe(200);
    expect(aliasGet.body.data.roomCode).toBe('ROOM_1');
    expect(aliasGet.body.data.patternSlots).toHaveLength(2);

    // 6. Backward-compatible alias: PUT /api/v1/users/me/schedule-registration
    const aliasPut = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [{ weekday: 2, period: 'MORNING' }],
        expectedVersion: 1,
      });
    expect(aliasPut.status).toBe(200);
    expect(aliasPut.body.data.roomCode).toBe('ROOM_2');
    expect(aliasPut.body.data.version).toBe(2);
    expect(aliasPut.body.data.shifts).toHaveLength(1);
  });

  test('Test 2: Concurrency version conflict on schedule update', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // Create initial schedule
    const initRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_1',
        slots: [{ weekday: 1, period: 'MORNING' }],
      });
    expect(initRes.status).toBe(200);
    expect(initRes.body.data.version).toBe(1);

    // Attempt update without expectedVersion -> 409
    const missingVersionRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [{ weekday: 2, period: 'MORNING' }],
      });
    expect(missingVersionRes.status).toBe(409);

    // Attempt update with mismatched expectedVersion -> 409
    const mismatchRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [{ weekday: 2, period: 'MORNING' }],
        expectedVersion: 999,
      });
    expect(mismatchRes.status).toBe(409);

    // Correct expectedVersion -> 200 and version increments
    const okRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [{ weekday: 2, period: 'MORNING' }],
        expectedVersion: 1,
      });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.version).toBe(2);
    expect(okRes.body.data.roomCode).toBe('ROOM_2');
  });

  test('Test 3: Weekly summary aggregation by weekday & period', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie1 = await loginCookie(app, 'ctv.active@ctv.local');
    const ctvCookie2 = await loginCookie(app, 'ctv.other@ctv.local');

    // CTV1 registers: Mon MORNING (wd 1), Wed AFTERNOON (wd 3) in ROOM_1
    await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie1)
      .send({
        roomCode: 'ROOM_1',
        slots: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 3, period: 'AFTERNOON' },
        ],
      });

    // CTV2 registers: Mon MORNING (wd 1), Fri MORNING (wd 5) in ROOM_2
    await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie2)
      .send({
        roomCode: 'ROOM_2',
        slots: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 5, period: 'MORNING' },
        ],
      });

    // Call GET /api/v1/schedule/weekly-summary
    const res = await request(app)
      .get('/api/v1/schedule/weekly-summary')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);

    const cells = res.body.data?.cells ?? res.body.cells;
    expect(cells).toBeDefined();
    expect(cells.length).toBe(10); // 5 weekdays * 2 periods

    // Monday Morning should have count = 2
    const monMorn = cells.find((c: any) => c.weekday === 1 && c.period === 'MORNING');
    expect(monMorn).toBeDefined();
    expect(monMorn.count).toBe(2);
    expect(monMorn.shiftAssignments).toHaveLength(2);
    expect(monMorn.shiftAssignments.some((a: any) => a.roomCode === 'ROOM_1' && a.displayName === 'CTV Active')).toBe(true);
    expect(monMorn.shiftAssignments.some((a: any) => a.roomCode === 'ROOM_2' && a.displayName === 'CTV Other')).toBe(true);

    // Wednesday Afternoon should have count = 1
    const wedAft = cells.find((c: any) => c.weekday === 3 && c.period === 'AFTERNOON');
    expect(wedAft).toBeDefined();
    expect(wedAft.count).toBe(1);
    expect(wedAft.shiftAssignments[0].roomCode).toBe('ROOM_1');

    // Tuesday Morning should have count = 0
    const tueMorn = cells.find((c: any) => c.weekday === 2 && c.period === 'MORNING');
    expect(tueMorn).toBeDefined();
    expect(tueMorn.count).toBe(0);
    expect(tueMorn.shiftAssignments).toHaveLength(0);

    // Backward compatible alias: GET /api/v1/schedule-summary
    const aliasRes = await request(app)
      .get('/api/v1/schedule-summary')
      .set('Cookie', adminCookie);
    expect(aliasRes.status).toBe(200);
    const aliasCells = aliasRes.body.data?.cells ?? aliasRes.body.cells;
    expect(aliasCells.length).toBe(10);
  });

  test('Test 4 & 5: snapshotTodayWorkHistory behavior before 17:30 (skipped) vs weekend (skipped) vs at 17:30 (recorded & idempotent)', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Wednesday = weekday 3. Let's use 2026-09-02 (a Wednesday).
    // CTV registers Wednesday MORNING and Wednesday AFTERNOON in ROOM_3
    await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_3',
        slots: [
          { weekday: 3, period: 'MORNING' },
          { weekday: 3, period: 'AFTERNOON' },
        ],
      });

    const targetDateStr = '2026-09-02';
    const targetDateUtc = parseYmdToUtcDate(targetDateStr);

    // 1. Run snapshotTodayWorkHistory at 10:00 UTC (17:00 Asia/Bangkok, BEFORE 17:30) on 2026-09-02
    const beforeCutoff = new Date('2026-09-02T10:00:00.000Z');
    const beforeRes = await snapshotTodayWorkHistory(beforeCutoff);
    expect(beforeRes).toEqual({ processedCount: 0, skipped: true, reason: 'BEFORE_CUTOFF' });

    // Verify 2026-09-02 is NOT recorded in History
    const historyBefore = await prisma.history.findMany({
      where: {
        accountId: ctv.id,
        workDate: targetDateUtc,
      },
    });
    expect(historyBefore).toHaveLength(0);

    // Verify work history API returns empty cells & entries for 2026-09-02
    const workHistoryResBefore = await request(app)
      .get('/api/v1/users/me/work-history?month=2026-09')
      .set('Cookie', ctvCookie);
    expect(workHistoryResBefore.status).toBe(200);
    const cellsBefore = workHistoryResBefore.body.data?.cells ?? workHistoryResBefore.body.cells;
    const todayCellsBefore = cellsBefore.filter((c: any) => c.workDate === targetDateStr);
    expect(todayCellsBefore).toHaveLength(0);

    // 2. Run snapshotTodayWorkHistory on a weekend (Saturday 2026-09-05 at 11:00 UTC / 18:00 Bangkok)
    const weekendDate = new Date('2026-09-05T11:00:00.000Z');
    const weekendRes = await snapshotTodayWorkHistory(weekendDate);
    expect(weekendRes).toEqual({ processedCount: 0, skipped: true, reason: 'WEEKEND' });

    // 3. Run snapshotTodayWorkHistory at exactly 10:30 UTC (17:30 Asia/Bangkok) on Wednesday 2026-09-02
    const atCutoff = new Date('2026-09-02T10:30:00.000Z');
    const snapshotRes = await snapshotTodayWorkHistory(atCutoff);
    expect(snapshotRes.processedCount).toBe(2);

    // 4. Run snapshotTodayWorkHistory again at 11:00 UTC on 2026-09-02 -> Idempotent, 0 new rows
    const duplicateRes = await snapshotTodayWorkHistory(new Date('2026-09-02T11:00:00.000Z'));
    expect(duplicateRes.processedCount).toBe(0);

    // Verify 2026-09-02 IS recorded in History with roomCode = ROOM_3 and status = COMPLETED
    const historyAfter = await prisma.history.findMany({
      where: {
        accountId: ctv.id,
        workDate: targetDateUtc,
      },
      orderBy: { period: 'asc' },
    });
    expect(historyAfter).toHaveLength(2);
    expect(historyAfter[0].period).toBe('AFTERNOON'); // alphabetical A before M
    expect(historyAfter[0].roomCode).toBe('ROOM_3');
    expect(historyAfter[0].status).toBe('COMPLETED');
    expect(historyAfter[1].period).toBe('MORNING');
    expect(historyAfter[1].roomCode).toBe('ROOM_3');
    expect(historyAfter[1].status).toBe('COMPLETED');

    // Verify work history API now returns entries and cells
    const workHistoryResAfter = await request(app)
      .get('/api/v1/users/me/work-history?month=2026-09')
      .set('Cookie', ctvCookie);
    expect(workHistoryResAfter.status).toBe(200);
    const dataAfter = workHistoryResAfter.body.data ?? workHistoryResAfter.body;
    expect(dataAfter.entries).toBeDefined();
    expect(dataAfter.entries).toHaveLength(2);
    expect(dataAfter.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workDate: targetDateStr, period: 'MORNING', roomCode: 'ROOM_3' }),
        expect.objectContaining({ workDate: targetDateStr, period: 'AFTERNOON', roomCode: 'ROOM_3' }),
      ]),
    );

    const cellsAfter = dataAfter.cells;
    const todayCellsAfter = cellsAfter.filter((c: any) => c.workDate === targetDateStr);
    expect(todayCellsAfter).toHaveLength(2);
  });

  test('Test 6: Changing schedule does NOT alter existing History', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // 1. Initial schedule: Wednesday MORNING in ROOM_1
    const regRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_1',
        slots: [{ weekday: 3, period: 'MORNING' }],
      });
    expect(regRes.status).toBe(200);

    // 2. Snapshot Wednesday 2026-09-02 after 17:30
    await snapshotTodayWorkHistory(new Date('2026-09-02T11:00:00.000Z'));

    const originalHistory = await prisma.history.findFirstOrThrow({
      where: {
        accountId: ctv.id,
        workDate: parseYmdToUtcDate('2026-09-02'),
        period: 'MORNING',
      },
    });
    expect(originalHistory.roomCode).toBe('ROOM_1');

    // 3. CTV updates schedule: changes room to ROOM_4 and drops Wednesday (only Monday MORNING now)
    const updateRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_4',
        slots: [{ weekday: 1, period: 'MORNING' }],
        expectedVersion: 1,
      });
    expect(updateRes.status).toBe(200);

    // 4. Run snapshotTodayWorkHistory again
    await snapshotTodayWorkHistory(new Date('2026-09-02T12:00:00.000Z'));

    // 5. Existing History MUST NOT be changed or removed!
    const unchangedHistory = await prisma.history.findFirstOrThrow({
      where: {
        accountId: ctv.id,
        workDate: parseYmdToUtcDate('2026-09-02'),
        period: 'MORNING',
      },
    });
    expect(unchangedHistory.roomCode).toBe('ROOM_1');
    expect(unchangedHistory.status).toBe('COMPLETED');
  });

  test('Test 7: Admin retrieval of CTV schedule (GET /api/v1/accounts/:id/schedule)', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });
    const otherCtv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.other@ctv.local' } });

    // Register schedule for ctv.active
    await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [
          { weekday: 2, period: 'MORNING' },
          { weekday: 4, period: 'AFTERNOON' },
        ],
      });

    // 1. Admin gets schedule for ctv.active
    const res = await request(app)
      .get(`/api/v1/accounts/${ctv.id}/schedule`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.roomCode).toBe('ROOM_2');
    expect(res.body.data.shifts).toHaveLength(2);

    // 2. Admin gets schedule for otherCtv (who has not registered yet) -> data: null
    const noScheduleRes = await request(app)
      .get(`/api/v1/accounts/${otherCtv.id}/schedule`)
      .set('Cookie', adminCookie);
    expect(noScheduleRes.status).toBe(200);
    expect(noScheduleRes.body.data).toBeNull();

    // 3. CTV trying to access this endpoint -> 403 Forbidden
    const forbiddenRes = await request(app)
      .get(`/api/v1/accounts/${ctv.id}/schedule`)
      .set('Cookie', ctvCookie);
    expect(forbiddenRes.status).toBe(403);
  });

  test('Test 8: DELETE schedule endpoints are not exposed and old fake endpoints return 404', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    const scheduleDelete = await request(app)
      .delete('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie);
    expect(scheduleDelete.status).toBe(404);

    const legacyDelete = await request(app)
      .delete('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie);
    expect(legacyDelete.status).toBe(404);

    const fakeAssignmentDel = await request(app)
      .delete('/api/v1/users/me/shift-assignments/any-id')
      .set('Cookie', ctvCookie);
    expect(fakeAssignmentDel.status).toBe(404);

    const fakeRegAssignmentsDel = await request(app)
      .delete('/api/v1/users/me/schedule-registrations/any-id/assignments')
      .set('Cookie', ctvCookie);
    expect(fakeRegAssignmentsDel.status).toBe(404);

    const fakeRegSeriesDel = await request(app)
      .delete('/api/v1/users/me/schedule-registrations/any-id/series')
      .set('Cookie', ctvCookie);
    expect(fakeRegSeriesDel.status).toBe(404);
  });

  test('Test 9: PUT schedule allows an empty weekly pattern (0 slots)', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // 1. Create schedule with 1 shift
    const putRes = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(putRes.status).toBe(200);
    const version = putRes.body.data.version;

    // 2. Update with empty slots []
    const res = await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_1',
        slots: [],
        expectedVersion: version,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.shifts).toHaveLength(0);
    expect(res.body.data.version).toBe(version + 1);

    // 3. Verify GET returns schedule with empty shifts
    const getRes = await request(app)
      .get('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.shifts).toHaveLength(0);
  });
});

import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors } from './helpers.js';

const app = createApp();

describe('Phase 1 Contract: Weekly Schedule vs Dated History Separation', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  test('1. Weekly schedule responses contain weekday and period, and NO workDate', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // Register a weekly slot
    const putRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 3, period: 'AFTERNOON' },
        ],
      });
    expect(putRes.status).toBe(200);

    // Read weekly schedule
    const getRes = await request(app).get('/api/v1/users/me/schedule').set('Cookie', ctvCookie);
    expect(getRes.status).toBe(200);

    const schedule = getRes.body.data;
    expect(schedule.roomCode).toBe('ROOM_2');
    expect(schedule.shifts).toHaveLength(2);

    for (const shift of schedule.shifts) {
      expect(typeof shift.weekday).toBe('number');
      expect([1, 3]).toContain(shift.weekday);
      expect(['MORNING', 'AFTERNOON']).toContain(shift.period);
      expect((shift as any).workDate).toBeUndefined();
    }

    // Also verify getMyRegistration alias
    const regRes = await request(app)
      .get('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie);
    expect(regRes.status).toBe(200);
    for (const shift of regRes.body.data.shifts) {
      expect((shift as any).workDate).toBeUndefined();
    }
  });

  test('2. Weekly schedule endpoints strictly reject month, from, and to parameters', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // schedule-summary rejects month
    const res1 = await request(app)
      .get('/api/v1/schedule-summary?month=2026-09')
      .set('Cookie', adminCookie);
    expect(res1.status).toBe(400);
    expect(res1.body.error?.code).toBe('INVALID_SCHEDULE_QUERY');

    // schedule-summary rejects from/to
    const res2 = await request(app)
      .get('/api/v1/schedule-summary?from=2026-09-01&to=2026-09-10')
      .set('Cookie', adminCookie);
    expect(res2.status).toBe(400);
    expect(res2.body.error?.code).toBe('INVALID_SCHEDULE_QUERY');

    // weekly-summary rejects month
    const res3 = await request(app)
      .get('/api/v1/schedule/weekly-summary?month=2026-09')
      .set('Cookie', adminCookie);
    expect(res3.status).toBe(400);

    // users/me/schedule rejects month
    const res4 = await request(app)
      .get('/api/v1/users/me/schedule?month=2026-09')
      .set('Cookie', ctvCookie);
    expect(res4.status).toBe(400);
  });

  test('3. Weekly summary response contains weekday and period, and NO workDate in cells', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    const res = await request(app)
      .get('/api/v1/schedule/weekly-summary')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);

    const cells = res.body.data.cells;
    expect(cells.length).toBe(10); // 5 weekdays * 2 periods

    for (const cell of cells) {
      expect(typeof cell.weekday).toBe('number');
      expect(cell.weekday).toBeGreaterThanOrEqual(1);
      expect(cell.weekday).toBeLessThanOrEqual(5);
      expect(['MORNING', 'AFTERNOON']).toContain(cell.period);
      expect((cell as any).workDate).toBeUndefined();
    }
  });

  test('4. Work History responses contain persisted workDate and reflect filters', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctv = await prisma.account.findFirstOrThrow({
      where: { role: 'CTV', status: 'ACTIVE', deletedAt: null },
    });

    // Seed two history records in different months
    await prisma.history.upsert({
      where: {
        accountId_workDate_period: {
          accountId: ctv.id,
          workDate: new Date('2026-07-15T00:00:00.000Z'),
          period: 'MORNING',
        },
      },
      update: {},
      create: {
        accountId: ctv.id,
        workDate: new Date('2026-07-15T00:00:00.000Z'),
        period: 'MORNING',
        roomCode: 'ROOM_1',
        status: 'ACTIVE',
      },
    });

    await prisma.history.upsert({
      where: {
        accountId_workDate_period: {
          accountId: ctv.id,
          workDate: new Date('2026-08-20T00:00:00.000Z'),
          period: 'AFTERNOON',
        },
      },
      update: {},
      create: {
        accountId: ctv.id,
        workDate: new Date('2026-08-20T00:00:00.000Z'),
        period: 'AFTERNOON',
        roomCode: 'ROOM_3',
        status: 'ACTIVE',
      },
    });

    // Query month 2026-07
    const resJuly = await request(app)
      .get('/api/v1/work-history?month=2026-07')
      .set('Cookie', adminCookie);
    expect(resJuly.status).toBe(200);
    const julyEntries = resJuly.body.data.entries;
    expect(julyEntries.every((e: any) => e.workDate.startsWith('2026-07'))).toBe(true);
    expect(
      julyEntries.some((e: any) => e.workDate === '2026-07-15' && e.period === 'MORNING'),
    ).toBe(true);
    expect(julyEntries.some((e: any) => e.workDate === '2026-08-20')).toBe(false);

    // Query month 2026-08
    const resAugust = await request(app)
      .get('/api/v1/work-history?month=2026-08')
      .set('Cookie', adminCookie);
    expect(resAugust.status).toBe(200);
    const augEntries = resAugust.body.data.entries;
    expect(augEntries.every((e: any) => e.workDate.startsWith('2026-08'))).toBe(true);
    expect(
      augEntries.some((e: any) => e.workDate === '2026-08-20' && e.period === 'AFTERNOON'),
    ).toBe(true);
    expect(augEntries.some((e: any) => e.workDate === '2026-07-15')).toBe(false);
  });
});

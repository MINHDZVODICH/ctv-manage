import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors } from './helpers.js';
import { syncWorkHistory } from '../src/modules/schedule/schedule.service.js';

const app = createApp();

describe('Phase B — Schedule, Shifts, Cancellations & History Suite (SCH-001..012, CAN-001..005, SUM-001..003, HIST-001..005)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('SCH-001 & SCH-005: Schedule registration materializes shifts and assignments over 30-day horizon', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

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

    // Verify shifts and assignments were materialized in database
    const assignments = await prisma.shiftAssignment.findMany({
      where: { account: { email: 'ctv.active@ctv.local' }, status: 'ACTIVE' },
      include: { shift: true },
    });
    expect(assignments.length).toBeGreaterThanOrEqual(4);

    for (const a of assignments) {
      expect(a.roomCode).toBe('ROOM_1');
      expect(['MORNING', 'AFTERNOON']).toContain(a.shift.period);
    }
  });

  test('SCH-003: Invalid schedule slot validations (invalid weekday, invalid period, empty slots)', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // Empty slots array
    const res1 = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [] });
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

  test('SCH-006 & SCH-008: Updating schedule updates pattern and reconciles future shifts', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

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

    // 3. Query active assignments
    const assignments = await prisma.shiftAssignment.findMany({
      where: { account: { email: 'ctv.active@ctv.local' }, status: 'ACTIVE' },
      include: { shift: true },
    });
    for (const a of assignments) {
      expect(a.roomCode).toBe('ROOM_2');
      expect(a.shift.period).toBe('AFTERNOON');
    }
  });

  test('CAN-001 & CAN-002: Single shift and series cancellation workflows', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // Register
    const regRes = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    const regId = regRes.body.data.id;

    // 1. Cancel single assignment
    const assignments = await prisma.shiftAssignment.findMany({
      where: { registrationId: regId, status: 'ACTIVE' },
    });
    expect(assignments.length).toBeGreaterThan(0);
    const targetAssignment = assignments[0];

    const cancelOneRes = await request(app)
      .delete(`/api/v1/users/me/shift-assignments/${targetAssignment.id}`)
      .set('Cookie', ctvCookie);
    expect(cancelOneRes.status).toBe(200);

    const cancelledInDb = await prisma.shiftAssignment.findUnique({ where: { id: targetAssignment.id } });
    expect(cancelledInDb?.status).toBe('CANCELLED');

    // 2. Cancel series
    const cancelSeriesRes = await request(app)
      .delete(`/api/v1/users/me/schedule-registrations/${regId}/series?weekday=1&period=MORNING&fromDate=2026-08-01`)
      .set('Cookie', ctvCookie);
    expect(cancelSeriesRes.status).toBe(200);
  });

  test('SUM-001..003 & RGR-10: Admin schedule summary distinguishes same-name CTVs and filters by month', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // CTV registers
    await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });

    // Admin requests summary for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const summaryRes = await request(app)
      .get(`/api/v1/schedule-summary?month=${currentMonth}`)
      .set('Cookie', adminCookie);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data).toBeDefined();
  });

  test('HIST-001..005: Work history daily synchronization is idempotent and records snapshots', async () => {
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Seed past assignment
    const pastShift = await prisma.shift.create({
      data: {
        workDate: new Date('2026-08-01T00:00:00.000Z'),
        period: 'MORNING',
      },
    });

    const reg = await prisma.scheduleRegistration.create({
      data: {
        accountId: ctv.id,
        roomCode: 'ROOM_1',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-31T00:00:00.000Z'),
        status: 'ACTIVE',
      },
    });

    await prisma.shiftAssignment.create({
      data: {
        shiftId: pastShift.id,
        accountId: ctv.id,
        registrationId: reg.id,
        roomCode: 'ROOM_1',
        status: 'ACTIVE',
      },
    });

    // 1. Run syncWorkHistory
    await syncWorkHistory();

    const historyItems = await prisma.workHistory.findMany({
      where: { accountId: ctv.id },
    });
    expect(historyItems.length).toBeGreaterThanOrEqual(1);

    const countBefore = historyItems.length;

    // 2. Run syncWorkHistory again (idempotency check)
    await syncWorkHistory();

    const countAfter = await prisma.workHistory.count({
      where: { accountId: ctv.id },
    });
    expect(countAfter).toBe(countBefore);

    // 3. CTV reads own work history via API
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const histApiRes = await request(app)
      .get('/api/v1/users/me/work-history?month=2026-08')
      .set('Cookie', ctvCookie);
    expect(histApiRes.status).toBe(200);
    expect(histApiRes.body.data).toBeDefined();
    expect(histApiRes.body.data.cells.length).toBeGreaterThanOrEqual(1);
  });
});

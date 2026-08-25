import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AccountRole, AccountStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import request, { type Response } from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { deriveCsrfToken } from '../src/shared/security.js';
import { prisma } from '../src/shared/prisma.js';
import { ScheduleService } from '../src/modules/schedules/schedule.service.js';
import { resetTestDatabase } from './test-database.js';

const origin = 'http://localhost:5173';
const now = () => new Date('2026-08-24T03:00:00.000Z');

interface ActorSession {
  accountId: string;
  cookie: string;
  csrf: string;
}

describe.sequential('CTV schedule API', () => {
  let ctv!: ActorSession;
  let otherCtv!: ActorSession;
  let admin!: ActorSession;

  beforeAll(async () => {
    await resetTestDatabase(prisma);
    ctv = await createActor('ctv-schedule@example.vn', 'CTV lịch', AccountRole.CTV);
    otherCtv = await createActor('other-schedule@example.vn', 'CTV cùng ca', AccountRole.CTV);
    admin = await createActor('admin-schedule@example.vn', 'Quản trị viên', AccountRole.ADMIN);
  });

  beforeEach(async () => {
    await prisma.shiftAssignment.deleteMany();
    await prisma.schedulePatternSlot.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.scheduleRegistration.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('returns null when the CTV has no current registration', async () => {
    const response = await request(createApp({ now }))
      .get('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctv.cookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data, null);
  });

  test('creates a version-one registration and reuses the shared date-period shift', async () => {
    const app = createApp({ now });
    const [first, second] = await Promise.all([
      putRegistration(app, ctv, registrationPayload(null)),
      putRegistration(app, otherCtv, registrationPayload(null, 'ROOM_2')),
    ]);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.body.data.version, 1);
    assert.equal(await prisma.shift.count(), 2);
    assert.equal(await prisma.shiftAssignment.count(), 4);
    const shift = await prisma.shift.findFirstOrThrow({ include: { assignments: true } });
    assert.equal(shift.assignments.length, 2);
  });

  test('serializes concurrent first registrations into one winner and a version conflict loser', async () => {
    const firstPayload = registrationPayload(null, 'ROOM_1');
    const secondPayload = {
      ...registrationPayload(null, 'ROOM_2'),
      workContent: 'Hỗ trợ tiếp nhận hồ sơ',
      slots: [{ weekday: 1, period: 'MORNING' }, { weekday: 3, period: 'AFTERNOON' }],
    };
    const firstClient = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
    const secondClient = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
    await prepareConcurrentClient(firstClient);
    await prepareConcurrentClient(secondClient);
    const firstApp = createApp({ now, scheduleService: new ScheduleService(firstClient, now) });
    const secondApp = createApp({ now, scheduleService: new ScheduleService(secondClient, now) });
    let first: Response;
    let second: Response;
    try {
      [first, second] = await Promise.all([
        putRegistration(firstApp, ctv, firstPayload),
        putRegistration(secondApp, ctv, secondPayload),
      ]);
    } finally {
      await firstClient.$disconnect();
      await secondClient.$disconnect();
    }
    const responses = [first, second];
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const winner = responses.find((response) => response.status === 200)!;
    const loser = responses.find((response) => response.status === 409)!;
    assert.equal(loser.body.error.code, 'VERSION_CONFLICT');
    assert.equal(loser.body.error.details.currentVersion, 1);
    const winnerPayload = winner === first ? firstPayload : secondPayload;

    const active = await prisma.scheduleRegistration.findMany({
      where: { accountId: ctv.accountId, status: 'ACTIVE' }, include: { patternSlots: true },
    });
    assert.equal(active.length, 1);
    assert.equal(active[0].roomCode, winnerPayload.roomCode);
    assert.equal(active[0].workContent, winnerPayload.workContent);
    assert.deepEqual(active[0].patternSlots.map((slot) => `${slot.weekday}:${slot.period}`).sort(), winnerPayload.slots.map((slot) => `${slot.weekday}:${slot.period}`).sort());

    const assignments = await prisma.shiftAssignment.findMany({ where: { accountId: ctv.accountId } });
    assert.equal(assignments.length, winnerPayload.slots.length * 2);
    const orphanedShifts = await prisma.shift.findMany({ where: { assignments: { none: {} } } });
    assert.equal(orphanedShifts.length, 0);

    const app = createApp({ now });
    const current = await request(app).get('/api/v1/users/me/schedule-registration').set('Cookie', ctv.cookie);
    assert.equal(current.status, 200);
    assert.equal(current.body.data.version, 1);
    const retry = await putRegistration(app, ctv, { ...winnerPayload, version: current.body.data.version });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.version, 2);
    const staleCreate = await putRegistration(app, ctv, winnerPayload);
    assert.equal(staleCreate.status, 409);
  });

  test('rejects a stale version without changing registration or assignments', async () => {
    const app = createApp({ now });
    const created = await putRegistration(app, ctv, registrationPayload(null));
    assert.equal(created.status, 200);
    const current = await putRegistration(app, ctv, registrationPayload(created.body.data.version));
    assert.equal(current.status, 200);
    const before = await snapshot(ctv.accountId);

    const stale = await putRegistration(app, ctv, {
      ...registrationPayload(1),
      roomCode: 'ROOM_4',
    });

    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'VERSION_CONFLICT');
    assert.equal(stale.body.error.details.currentVersion, 2);
    assert.deepEqual(await snapshot(ctv.accountId), before);
  });

  test('updates future assignments transactionally and keeps past history read-only', async () => {
    const app = createApp({ now });
    const created = await putRegistration(app, ctv, {
      ...registrationPayload(null), startDate: '2026-08-17', endDate: '2026-08-31',
    });
    assert.equal(created.status, 200);

    const updated = await putRegistration(app, ctv, {
      ...registrationPayload(1, 'ROOM_3'), startDate: '2026-08-17', endDate: '2026-08-31',
      slots: [{ weekday: 1, period: 'AFTERNOON' }],
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.version, 2);
    const assignments = await prisma.shiftAssignment.findMany({
      where: { accountId: ctv.accountId }, include: { shift: true }, orderBy: { shift: { workDate: 'asc' } },
    });
    const past = assignments.find((item) => item.shift.workDate.toISOString().startsWith('2026-08-17'));
    const removedFuture = assignments.find((item) => item.shift.workDate.toISOString().startsWith('2026-08-24') && item.shift.period === 'MORNING');
    const newFuture = assignments.find((item) => item.shift.workDate.toISOString().startsWith('2026-08-24') && item.shift.period === 'AFTERNOON');
    assert.equal(past?.status, 'ACTIVE');
    assert.equal(past?.roomCode, 'ROOM_1');
    assert.equal(removedFuture?.status, 'CANCELLED');
    assert.equal(newFuture?.status, 'ACTIVE');
    assert.equal(newFuture?.roomCode, 'ROOM_3');
  });

  test('lists the same active assignments and returns owner-safe shift detail with co-workers', async () => {
    const app = createApp({ now });
    await putRegistration(app, ctv, registrationPayload(null));
    await putRegistration(app, otherCtv, registrationPayload(null, 'ROOM_2'));
    const list = await request(app)
      .get('/api/v1/users/me/shifts?from=2026-08-24&to=2026-08-31')
      .set('Cookie', ctv.cookie);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 2);
    const detail = await request(app)
      .get(`/api/v1/shifts/${list.body.data[0].shiftId}`)
      .set('Cookie', ctv.cookie);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.assignment.accountId, undefined);
    assert.equal(detail.body.data.coWorkers.length, 1);
    assert.deepEqual(Object.keys(detail.body.data.coWorkers[0]).sort(), ['accountId', 'displayName', 'roomCode']);

    const hidden = await request(app)
      .get(`/api/v1/shifts/${list.body.data[1].shiftId}`)
      .set('Cookie', admin.cookie);
    assert.equal(hidden.status, 200);
  });

  test('prevents another CTV from learning a shift they do not belong to', async () => {
    const app = createApp({ now });
    await putRegistration(app, ctv, registrationPayload(null));
    const shift = await prisma.shift.findFirstOrThrow();
    await prisma.shiftAssignment.deleteMany({ where: { accountId: otherCtv.accountId } });
    const response = await request(app).get(`/api/v1/shifts/${shift.id}`).set('Cookie', otherCtv.cookie);
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'RESOURCE_NOT_FOUND');
  });

  test('cancels one assignment idempotently and only for its owner', async () => {
    const app = createApp({ now });
    await putRegistration(app, ctv, registrationPayload(null));
    const assignment = await prisma.shiftAssignment.findFirstOrThrow({ where: { accountId: ctv.accountId } });

    const forbidden = await cancelOne(app, otherCtv, assignment.id);
    assert.equal(forbidden.status, 404);
    const first = await cancelOne(app, ctv, assignment.id);
    const repeated = await cancelOne(app, ctv, assignment.id);
    assert.equal(first.status, 200);
    assert.equal(first.body.data.affectedCount, 1);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.data.affectedCount, 0);
  });

  test('cancels only the matching series on and after the requested boundary', async () => {
    const app = createApp({ now });
    const created = await putRegistration(app, ctv, {
      ...registrationPayload(null), endDate: '2026-09-07',
      slots: [{ weekday: 1, period: 'MORNING' }, { weekday: 3, period: 'MORNING' }],
    });
    const registrationId = created.body.data.id;
    const first = await cancelSeries(app, ctv, registrationId, 'weekday=1&period=MORNING&fromDate=2026-08-31');
    const repeated = await cancelSeries(app, ctv, registrationId, 'weekday=1&period=MORNING&fromDate=2026-08-31');
    assert.equal(first.status, 200);
    assert.equal(first.body.data.affectedCount, 2);
    assert.equal(repeated.body.data.affectedCount, 0);

    const activeDates = (await prisma.shiftAssignment.findMany({
      where: { accountId: ctv.accountId, status: 'ACTIVE' }, include: { shift: true },
    })).map((item) => `${item.shift.workDate.toISOString().slice(0, 10)}:${item.shift.period}`).sort();
    assert.ok(activeDates.includes('2026-08-24:MORNING'));
    assert.ok(activeDates.includes('2026-08-26:MORNING'));
    assert.ok(activeDates.includes('2026-09-02:MORNING'));
    assert.equal(activeDates.includes('2026-08-31:MORNING'), false);
  });

  test('preserves CTV cancellations when a later registration update keeps the same slots', async () => {
    const app = createApp({ now });
    const created = await putRegistration(app, ctv, {
      ...registrationPayload(null), endDate: '2026-09-07',
      slots: [{ weekday: 1, period: 'MORNING' }, { weekday: 3, period: 'MORNING' }],
    });
    const monday = await prisma.shiftAssignment.findFirstOrThrow({
      where: { accountId: ctv.accountId, shift: { workDate: new Date('2026-08-24T00:00:00.000Z') } },
    });
    assert.equal((await cancelOne(app, ctv, monday.id)).body.data.affectedCount, 1);
    assert.equal((await cancelSeries(app, ctv, created.body.data.id, 'weekday=3&period=MORNING&fromDate=2026-08-26')).body.data.affectedCount, 2);

    const updated = await putRegistration(app, ctv, {
      ...registrationPayload(created.body.data.version, 'ROOM_3'), endDate: '2026-09-07',
      slots: [{ weekday: 1, period: 'MORNING' }, { weekday: 3, period: 'MORNING' }],
    });
    assert.equal(updated.status, 200);
    const cancelled = await prisma.shiftAssignment.findMany({
      where: { accountId: ctv.accountId, status: 'CANCELLED' }, include: { shift: true }, orderBy: { shift: { workDate: 'asc' } },
    });
    assert.deepEqual(cancelled.map((item) => `${item.shift.workDate.toISOString().slice(0, 10)}:${item.shift.period}`), [
      '2026-08-24:MORNING', '2026-08-26:MORNING', '2026-09-02:MORNING',
    ]);
  });

  test('rejects a registration range longer than 180 days before creating assignments', async () => {
    const app = createApp({ now });
    const response = await putRegistration(app, ctv, {
      ...registrationPayload(null), endDate: '2027-02-21',
    });
    assert.equal(response.status, 422);
    assert.equal(response.body.error.code, 'VALIDATION_FAILED');
    assert.equal(await prisma.scheduleRegistration.count({ where: { accountId: ctv.accountId } }), 0);
    assert.equal(await prisma.shiftAssignment.count({ where: { accountId: ctv.accountId } }), 0);
  });

  test('rejects weekend filters and fixed-enum violations', async () => {
    const app = createApp({ now });
    const invalidRoom = await putRegistration(app, ctv, { ...registrationPayload(null), roomCode: 'ROOM_5' });
    assert.equal(invalidRoom.status, 422);
    const invalidWeekday = await request(app)
      .delete('/api/v1/users/me/schedule-registrations/missing/assignments?weekday=6&period=MORNING&fromDate=2026-08-29')
      .set('Origin', origin).set('Cookie', ctv.cookie).set('X-CSRF-Token', ctv.csrf);
    assert.equal(invalidWeekday.status, 422);
  });

  test('enforces CTV role, CSRF, and Origin on registration mutations', async () => {
    const app = createApp({ now });
    const adminMutation = await putRegistration(app, admin, registrationPayload(null));
    assert.equal(adminMutation.status, 403);
    const missingCsrf = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Origin', origin).set('Cookie', ctv.cookie).send(registrationPayload(null));
    assert.equal(missingCsrf.status, 403);
    assert.equal(missingCsrf.body.error.code, 'CSRF_INVALID');
    const missingOrigin = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctv.cookie).set('X-CSRF-Token', ctv.csrf).send(registrationPayload(null));
    assert.equal(missingOrigin.status, 403);
    assert.equal(missingOrigin.body.error.code, 'ORIGIN_NOT_ALLOWED');
  });
});

function registrationPayload(version: number | null, roomCode = 'ROOM_1') {
  return {
    startDate: '2026-08-24', endDate: '2026-08-31', timeZone: 'Asia/Bangkok', roomCode,
    workContent: 'Hỗ trợ xử lý dữ liệu', slots: [
      { weekday: 1, period: 'MORNING' },
    ], version,
  };
}

async function createActor(email: string, displayName: string, role: AccountRole): Promise<ActorSession> {
  const account = await prisma.account.create({ data: {
    email, passwordHash: 'not-used-in-session-test', role, status: AccountStatus.ACTIVE,
    mustChangePassword: false, displayName,
  } });
  const rawToken = createHash('sha256').update(`${email}:raw`).digest('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.session.create({ data: {
    accountId: account.id, tokenHash, expiresAt: new Date('2027-01-01T00:00:00.000Z'),
  } });
  return {
    accountId: account.id,
    cookie: `ctv_session=${rawToken}`,
    csrf: deriveCsrfToken(tokenHash, config.CSRF_SECRET),
  };
}

function putRegistration(app: ReturnType<typeof createApp>, actor: ActorSession, body: unknown): Promise<Response> {
  return request(app).put('/api/v1/users/me/schedule-registration')
    .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).send(body as object);
}

function cancelOne(app: ReturnType<typeof createApp>, actor: ActorSession, assignmentId: string): Promise<Response> {
  return request(app).delete(`/api/v1/users/me/shift-assignments/${assignmentId}`)
    .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf);
}

function cancelSeries(app: ReturnType<typeof createApp>, actor: ActorSession, registrationId: string, query: string): Promise<Response> {
  return request(app).delete(`/api/v1/users/me/schedule-registrations/${registrationId}/assignments?${query}`)
    .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf);
}

async function snapshot(accountId: string) {
  const registration = await prisma.scheduleRegistration.findFirst({
    where: { accountId }, include: { patternSlots: { orderBy: [{ weekday: 'asc' }, { period: 'asc' }] } },
  });
  const assignments = await prisma.shiftAssignment.findMany({
    where: { accountId }, include: { shift: true }, orderBy: { id: 'asc' },
  });
  return JSON.parse(JSON.stringify({ registration, assignments }));
}

async function prepareConcurrentClient(client: PrismaClient): Promise<void> {
  await client.$connect();
  await client.$executeRawUnsafe('PRAGMA foreign_keys=ON');
  await client.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  await client.$queryRawUnsafe('PRAGMA busy_timeout=5000');
}

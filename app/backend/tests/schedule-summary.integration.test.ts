import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AccountRole, AccountStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { deriveCsrfToken } from '../src/shared/security.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

interface Actor { cookie: string; csrf: string; accountId: string }

describe.sequential('Admin schedule summary API', () => {
  let admin: Actor;
  let ctvOne: Actor;
  let ctvTwo: Actor;

  beforeAll(async () => {
    await resetTestDatabase(prisma);
    admin = await createActor('summary-admin@example.vn', 'Admin', AccountRole.ADMIN);
    ctvOne = await createActor('summary-one@example.vn', 'Nguyễn Văn A', AccountRole.CTV);
    ctvTwo = await createActor('summary-two@example.vn', 'Trần Thị B', AccountRole.CTV);
  });
  beforeEach(async () => {
    await prisma.shiftAssignment.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.scheduleRegistration.deleteMany();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  test('groups a monthly summary by shared date and period rather than room', async () => {
    const shift = await prisma.shift.create({ data: { workDate: new Date('2026-08-24T00:00:00.000Z'), period: 'MORNING' } });
    await assignment(shift.id, ctvOne.accountId, 'ROOM_1');
    await assignment(shift.id, ctvTwo.accountId, 'ROOM_2');

    const response = await request(createApp()).get('/api/v1/schedule-summary?month=2026-08').set('Cookie', admin.cookie);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.days, [{ date: '2026-08-24', slots: [{ shiftId: shift.id, period: 'MORNING', count: 2 }] }]);
    assert.deepEqual(response.body.data.today, []);
  });

  test('returns only active assignments and a safe roster for Admin', async () => {
    const shift = await prisma.shift.create({ data: { workDate: new Date('2026-08-25T00:00:00.000Z'), period: 'AFTERNOON' } });
    const active = await assignment(shift.id, ctvOne.accountId, 'ROOM_1');
    await assignment(shift.id, ctvTwo.accountId, 'ROOM_2', 'CANCELLED');
    const app = createApp();
    const summary = await request(app).get('/api/v1/schedule-summary?month=2026-08').set('Cookie', admin.cookie);
    assert.equal(summary.body.data.days[0].slots[0].count, 1);
    const roster = await request(app).get(`/api/v1/shifts/${shift.id}`).set('Cookie', admin.cookie);
    assert.equal(roster.status, 200);
    assert.deepEqual(roster.body.data.coWorkers, [{ accountId: ctvOne.accountId, displayName: 'Nguyễn Văn A', roomCode: 'ROOM_1', workContent: 'Hỗ trợ tiếp nhận', status: 'ACTIVE' }]);
    assert.equal(roster.body.data.assignment, null);
    assert.equal(active.status, 'ACTIVE');
  });

  test('validates a real calendar month and restricts summary to Admin', async () => {
    const app = createApp();
    const invalid = await request(app).get('/api/v1/schedule-summary?month=2026-13').set('Cookie', admin.cookie);
    assert.equal(invalid.status, 422);
    const missing = await request(app).get('/api/v1/schedule-summary').set('Cookie', admin.cookie);
    assert.equal(missing.status, 422);
    const forbidden = await request(app).get('/api/v1/schedule-summary?month=2026-08').set('Cookie', ctvOne.cookie);
    assert.equal(forbidden.status, 403);
  });
});

async function assignment(shiftId: string, accountId: string, roomCode: 'ROOM_1' | 'ROOM_2', status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE') {
  const registration = await prisma.scheduleRegistration.create({ data: {
    accountId, startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-08-31T00:00:00.000Z'), timeZone: 'Asia/Bangkok', roomCode, workContent: 'Hỗ trợ tiếp nhận',
  } });
  return prisma.shiftAssignment.create({ data: { shiftId, accountId, registrationId: registration.id, roomCode, workContent: 'Hỗ trợ tiếp nhận', status } });
}

async function createActor(email: string, displayName: string, role: AccountRole): Promise<Actor> {
  const account = await prisma.account.create({ data: { email, displayName, role, status: AccountStatus.ACTIVE, passwordHash: 'not-used', mustChangePassword: false } });
  const raw = createHash('sha256').update(email).digest('base64url');
  const hash = createHash('sha256').update(raw).digest('hex');
  await prisma.session.create({ data: { accountId: account.id, tokenHash: hash, expiresAt: new Date('2027-01-01T00:00:00.000Z') } });
  return { accountId: account.id, cookie: `ctv_session=${raw}`, csrf: deriveCsrfToken(hash, config.CSRF_SECRET) };
}

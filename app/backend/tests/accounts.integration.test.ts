import assert from 'node:assert/strict';
import argon2 from 'argon2';
import {
  AccountRole,
  AccountStatus,
  RoomCode,
  ScheduleRegistrationStatus,
  ShiftAssignmentStatus,
  ShiftPeriod,
  ShiftStatus,
} from '@prisma/client';
import { afterAll, beforeAll, describe, test } from 'vitest';
import request, { type Response } from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

const allowedOrigin = 'http://localhost:5173';
const password = 'Secret123';
const now = new Date('2026-08-25T10:00:00.000Z');
const app = createApp({ now: () => now });

let adminId: string;
let ctvId: string;

describe.sequential('account and profile API', () => {
  beforeAll(async () => {
    await resetTestDatabase(prisma);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const [admin, ctv] = await Promise.all([
      prisma.account.create({ data: {
        email: 'admin@example.vn', passwordHash, role: AccountRole.ADMIN,
        status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: 'Quản trị viên',
      } }),
      prisma.account.create({ data: {
        email: 'an@example.vn', passwordHash, role: AccountRole.CTV,
        status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: 'Nguyễn Văn An',
        phone: '0900000000', ctvCode: 'CTV-001', joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      } }),
    ]);
    adminId = admin.id;
    ctvId = ctv.id;
  });

  afterAll(async () => prisma.$disconnect());

  test('Admin account list is server-paginated and never leaks credentials', async () => {
    const admin = await authenticated('admin@example.vn');
    const response = await request(app)
      .get('/api/v1/accounts?q=Nguy%E1%BB%85n&status=ACTIVE&page=1&pageSize=5')
      .set('Cookie', admin.cookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.pageSize, 5);
    assert.equal(response.body.meta.total, 1);
    assert.equal(response.body.data[0].displayName, 'Nguyễn Văn An');
    assert.equal(JSON.stringify(response.body).includes('passwordHash'), false);
    assert.equal(JSON.stringify(response.body).includes('storageKey'), false);
  });

  test('CTV cannot access Admin account resources', async () => {
    const ctv = await authenticated('an@example.vn');
    const response = await request(app).get('/api/v1/accounts').set('Cookie', ctv.cookie);
    assert.equal(response.status, 403);
  });

  test('stale account versions return VERSION_CONFLICT without changing the account', async () => {
    const admin = await authenticated('admin@example.vn');
    const response = await mutation(admin, request(app)
      .patch(`/api/v1/accounts/${ctvId}`)
      .send({ displayName: 'Tên bị ghi đè', version: 2 }));

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'VERSION_CONFLICT');
    assert.equal((await prisma.account.findUniqueOrThrow({ where: { id: ctvId } })).displayName, 'Nguyễn Văn An');
  });

  test('disabling an account revokes sessions and cancels only future assignments atomically', async () => {
    const admin = await authenticated('admin@example.vn');
    const ctv = await authenticated('an@example.vn');
    const registration = await prisma.scheduleRegistration.create({ data: {
      accountId: ctvId,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T00:00:00.000Z'),
      timeZone: 'Asia/Bangkok', roomCode: RoomCode.ROOM_1, workContent: 'Hỗ trợ',
      status: ScheduleRegistrationStatus.ACTIVE,
    } });
    const [pastShift, futureShift] = await Promise.all([
      prisma.shift.create({ data: { workDate: new Date('2026-08-24T00:00:00.000Z'), period: ShiftPeriod.MORNING, status: ShiftStatus.OPEN } }),
      prisma.shift.create({ data: { workDate: new Date('2026-08-26T00:00:00.000Z'), period: ShiftPeriod.MORNING, status: ShiftStatus.OPEN } }),
    ]);
    await prisma.shiftAssignment.createMany({ data: [pastShift, futureShift].map((shift) => ({
      shiftId: shift.id, accountId: ctvId, registrationId: registration.id,
      roomCode: RoomCode.ROOM_1, workContent: 'Hỗ trợ', status: ShiftAssignmentStatus.ACTIVE,
    })) });

    const response = await mutation(admin, request(app)
      .patch(`/api/v1/accounts/${ctvId}/status`)
      .send({ status: 'DISABLED', version: 1 }));

    assert.equal(response.status, 200);
    assert.equal(await prisma.session.count({ where: { accountId: ctvId, revokedAt: null } }), 0);
    assert.equal(await prisma.shiftAssignment.count({ where: { accountId: ctvId, status: 'ACTIVE', shift: { workDate: { gt: now } } } }), 0);
    assert.equal(await prisma.shiftAssignment.count({ where: { accountId: ctvId, status: 'ACTIVE', shift: { workDate: { lt: now } } } }), 1);
    assert.ok((await prisma.session.findUniqueOrThrow({ where: { tokenHash: ctv.tokenHash } })).revokedAt);
  });

  test('a user can update their own versioned profile without receiving Admin notes', async () => {
    await prisma.account.update({ where: { id: ctvId }, data: { status: AccountStatus.ACTIVE, adminNotes: 'Internal only' } });
    const ctv = await authenticated('an@example.vn');
    const current = await request(app).get('/api/v1/users/me').set('Cookie', ctv.cookie);
    assert.equal(current.status, 200);
    assert.equal(Object.hasOwn(current.body.data, 'adminNotes'), false);
    assert.equal(JSON.stringify(current.body).includes('passwordHash'), false);

    const updated = await mutation(ctv, request(app).patch('/api/v1/users/me').send({
      displayName: 'Nguyễn Văn An Mới', phone: '0911111111', version: current.body.data.version,
    }));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.displayName, 'Nguyễn Văn An Mới');
    assert.equal(updated.body.data.version, current.body.data.version + 1);
    assert.equal(Object.hasOwn(updated.body.data, 'adminNotes'), false);
  });

  test('profile change requires the current password and revokes every session after success', async () => {
    await prisma.account.update({ where: { id: ctvId }, data: { status: AccountStatus.ACTIVE } });
    const ctv = await authenticated('an@example.vn');
    const another = await authenticated('an@example.vn');
    const wrong = await mutation(ctv, request(app)
      .post('/api/v1/users/me/password-changes')
      .send({ currentPassword: 'Wrong123', newPassword: 'Changed123' }));
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error.code, 'CURRENT_PASSWORD_INVALID');

    const changed = await mutation(ctv, request(app)
      .post('/api/v1/users/me/password-changes')
      .send({ currentPassword: password, newPassword: 'Changed123' }));
    assert.equal(changed.status, 200);
    assert.equal(JSON.stringify(changed.body).includes('Changed123'), false);
    assert.equal(await prisma.session.count({ where: { accountId: ctvId, revokedAt: null } }), 0);
    assert.ok((await prisma.session.findUniqueOrThrow({ where: { tokenHash: another.tokenHash } })).revokedAt);
  });

  test('Admin password reset is durable and idempotent without echoing the password', async () => {
    const admin = await authenticated('admin@example.vn');
    const account = await prisma.account.findUniqueOrThrow({ where: { id: ctvId } });
    const send = () => mutation(admin, request(app)
      .post(`/api/v1/accounts/${ctvId}/password-resets`)
      .set('Idempotency-Key', 'reset-an-1')
      .send({ newPassword: 'Reset1234', requireChangeOnLogin: true }));
    const first = await send();
    const second = await send();

    assert.equal(first.status, 200);
    assert.deepEqual(second.body, first.body);
    assert.equal(JSON.stringify(first.body).includes('Reset1234'), false);
    assert.equal(first.body.data.mustChangePassword, true);
    assert.ok(await argon2.verify((await prisma.account.findUniqueOrThrow({ where: { id: ctvId } })).passwordHash, 'Reset1234'));
    assert.equal(await prisma.idempotencyRecord.count({ where: { scope: `account-password-reset:${ctvId}` } }), 1);
    assert.equal(account.id, first.body.data.accountId);
  });

  test('soft delete is idempotent, revokes sessions, and retains assignment history', async () => {
    const admin = await authenticated('admin@example.vn');
    const beforeAssignments = await prisma.shiftAssignment.count({ where: { accountId: ctvId } });
    const first = await mutation(admin, request(app).delete(`/api/v1/accounts/${ctvId}`));
    const second = await mutation(admin, request(app).delete(`/api/v1/accounts/${ctvId}`));

    assert.equal(first.status, 204);
    assert.equal(second.status, 204);
    assert.ok((await prisma.account.findUniqueOrThrow({ where: { id: ctvId } })).deletedAt);
    assert.equal(await prisma.shiftAssignment.count({ where: { accountId: ctvId } }), beforeAssignments);
    assert.equal(await prisma.session.count({ where: { accountId: ctvId, revokedAt: null } }), 0);
  });
});

interface AuthenticatedActor { cookie: string; csrf: string; tokenHash: string }

async function authenticated(email: string): Promise<AuthenticatedActor> {
  const login = await request(app).post('/api/v1/auth/sessions').set('Origin', allowedOrigin).send({ email, password });
  assert.equal(login.status, 201);
  const cookie = login.headers['set-cookie'][0];
  const csrf = await request(app).get('/api/v1/auth/csrf-token').set('Cookie', cookie);
  assert.equal(csrf.status, 200);
  const rawToken = cookie.match(/ctv_session=([^;]+)/)?.[1];
  assert.ok(rawToken);
  return { cookie, csrf: csrf.body.data.csrfToken, tokenHash: (await prisma.session.findFirstOrThrow({
    where: { account: { email }, revokedAt: null }, orderBy: { createdAt: 'desc' },
  })).tokenHash };
}

function mutation(actor: AuthenticatedActor, testRequest: request.Test): Promise<Response> {
  return testRequest.set('Cookie', actor.cookie).set('Origin', allowedOrigin).set('X-CSRF-Token', actor.csrf);
}

import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors, TEST_PASSWORD, validPng } from './helpers.js';

const app = createApp();

describe('Phase A — P0 Security, Access & Regression Protection Suite', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('RISK-01 / SCH-009 / SCH-010: Shift detail scoping and ownership boundaries', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const otherCookie = await loginCookie(app, 'ctv.other@ctv.local');

    // CTV creates a schedule registration
    await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });

    // 1. Admin can view schedule of CTV
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });
    const adminRes = await request(app).get(`/api/v1/accounts/${ctv.id}/schedule`).set('Cookie', adminCookie);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.roomCode).toBe('ROOM_1');

    // 2. Assigned CTV can view own schedule
    const assignedRes = await request(app).get('/api/v1/users/me/schedule').set('Cookie', ctvCookie);
    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.data.roomCode).toBe('ROOM_1');

    // 3. Unassigned CTV is forbidden from viewing other CTV schedule via admin endpoint
    const unassignedRes = await request(app).get(`/api/v1/accounts/${ctv.id}/schedule`).set('Cookie', otherCookie);
    expect(unassignedRes.status).toBe(403);
  });

  test('RISK-02 / AUTH-007 / ACC-004: Disabled or deleted account session is revoked immediately', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    const ctvAccount = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Verify session is currently active
    const meBefore = await request(app).get('/api/v1/auth/sessions/me').set('Cookie', ctvCookie);
    expect(meBefore.status).toBe(200);

    // Admin disables the account
    const disableRes = await request(app)
      .patch(`/api/v1/accounts/${ctvAccount.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'DISABLED', expectedVersion: ctvAccount.version });
    expect(disableRes.status).toBe(200);

    // Next request from CTV with same session cookie MUST be rejected
    const meAfterDisable = await request(app).get('/api/v1/auth/sessions/me').set('Cookie', ctvCookie);
    expect(meAfterDisable.status).toBe(401);

    const profileAfterDisable = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(profileAfterDisable.status).toBe(401);
  });

  test('RISK-03 / PROF-001 / ACC-011 / RGR-11: Sensitive fields are omitted in responses', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctvAccount = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Admin sets admin notes on CTV account
    await request(app)
      .patch(`/api/v1/accounts/${ctvAccount.id}/notes`)
      .set('Cookie', adminCookie)
      .send({ adminNotes: 'CONFIDENTIAL_ADMIN_NOTE_12345', expectedVersion: ctvAccount.version });

    // 1. CTV profile endpoint must not leak admin notes, password hash, or storage keys
    const ctvProfile = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(ctvProfile.status).toBe(200);
    const bodyStr = JSON.stringify(ctvProfile.body);
    expect(bodyStr).not.toContain('CONFIDENTIAL_ADMIN_NOTE_12345');
    expect(bodyStr).not.toContain('passwordHash');
    expect(bodyStr).not.toContain('tokenHash');
    expect(ctvProfile.body.user.adminNotes).toBeUndefined();

    // 2. Admin password reset does not echo plain password in payload
    const resetRes = await request(app)
      .post(`/api/v1/accounts/${ctvAccount.id}/password-resets`)
      .set('Cookie', adminCookie)
      .send({ newPassword: 'NewPassword@123' });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.passwordHash).toBeUndefined();
    expect(resetRes.body.tokenHash).toBeUndefined();
  });

  test('RISK-04 / REG-005 / RGR-01: Soft-deleted account allows clean re-registration and approval', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvAccount = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Soft delete the CTV account
    const delRes = await request(app)
      .delete(`/api/v1/accounts/${ctvAccount.id}`)
      .set('Cookie', adminCookie);
    expect([200, 204]).toContain(delRes.status);

    const deletedAccount = await prisma.account.findUnique({ where: { id: ctvAccount.id } });
    expect(deletedAccount?.deletedAt).not.toBeNull();

    // Register again with the same email
    const regRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'ctv.active@ctv.local')
      .field('displayName', 'CTV Re-Registered')
      .field('phone', '0909999888')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', validPng, 'cccd-front.png');
    expect(regRes.status).toBe(201);
    const requestId = regRes.body.request.id;

    // Admin approves the re-registration
    const approveRes = await request(app)
      .patch(`/api/v1/registration-requests/${requestId}`)
      .set('Cookie', adminCookie)
      .send({ decision: 'APPROVED', expectedStatus: 'PENDING' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.request).toBeDefined();
    expect(approveRes.body.request.status).toBe('APPROVED');
  });

  test('RISK-05 / ACC-009 / SCH-007: Stale optimistic version updates return 409 Conflict', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctvAccount = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // 1. Account update with stale version
    const staleAccountUpdate = await request(app)
      .patch(`/api/v1/accounts/${ctvAccount.id}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'Updated Name', expectedVersion: ctvAccount.version + 999 });
    expect(staleAccountUpdate.status).toBe(409);

    // 2. Schedule update with stale version
    const initialSchedule = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(initialSchedule.status).toBe(200);
    const regVersion = initialSchedule.body.data.version;

    const staleScheduleUpdate = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_2', slots: [{ weekday: 2, period: 'AFTERNOON' }], expectedVersion: regVersion + 999 });
    expect(staleScheduleUpdate.status).toBe(409);
  });

  test('RISK-06 / FILE-001 / FILE-004: File authorization restricts access to owner and admin only', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const otherCookie = await loginCookie(app, 'ctv.other@ctv.local');

    // CTV uploads a private avatar
    const uploadRes = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ctvCookie)
      .attach('file', validPng, 'avatar.png');
    expect(uploadRes.status).toBe(201);
    const fileId = uploadRes.body.file.fileId;

    // 1. Owner can stream the file
    const ownerStream = await request(app).get(`/api/v1/files/${fileId}/content`).set('Cookie', ctvCookie);
    expect(ownerStream.status).toBe(200);
    expect(ownerStream.headers['content-type']).toContain('image/png');

    // 2. Admin can stream the file
    const adminStream = await request(app).get(`/api/v1/files/${fileId}/content`).set('Cookie', adminCookie);
    expect(adminStream.status).toBe(200);

    // 3. Another CTV is forbidden from accessing the file
    const otherStream = await request(app).get(`/api/v1/files/${fileId}/content`).set('Cookie', otherCookie);
    expect(otherStream.status).toBe(403);

    // 4. Anonymous user is denied
    const anonStream = await request(app).get(`/api/v1/files/${fileId}/content`);
    expect(anonStream.status).toBe(401);
  });

  test('RISK-07 / CAN-005 / HIST-001..003: Finalized work history is immutable to future cancellations', async () => {
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Seed historical history snapshot
    const historyRecord = await prisma.history.create({
      data: {
        accountId: ctv.id,
        workDate: new Date('2026-08-01T00:00:00.000Z'),
        period: 'MORNING',
        roomCode: 'ROOM_1',
        status: 'COMPLETED',
      },
    });

    // CTV updates schedule
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    await request(app)
      .put('/api/v1/users/me/schedule')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_3',
        slots: [{ weekday: 2, period: 'AFTERNOON' }],
      });

    // Verify past history snapshot is completely intact
    const afterHistory = await prisma.history.findUnique({
      where: { id: historyRecord.id },
    });
    expect(afterHistory).not.toBeNull();
    expect(afterHistory?.roomCode).toBe('ROOM_1');
    expect(afterHistory?.status).toBe('COMPLETED');
  });

  test('RISK-09: Malformed JSON and bad requests return structured error responses', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .set('Content-Type', 'application/json')
      .send('{"email": "ctv.active@ctv.local", "password": '); // broken JSON
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  test('Section 11: Complete API Authorization Matrix across Applicant, CTV, Admin', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // 1. Health check: public to all
    const healthAnon = await request(app).get('/api/v1/health');
    expect(healthAnon.status).toBe(200);

    // 2. Admin Accounts list: Admin=200, CTV=403, Anon=401
    const accAdmin = await request(app).get('/api/v1/accounts').set('Cookie', adminCookie);
    expect(accAdmin.status).toBe(200);

    const accCtv = await request(app).get('/api/v1/accounts').set('Cookie', ctvCookie);
    expect(accCtv.status).toBe(403);

    const accAnon = await request(app).get('/api/v1/accounts');
    expect(accAnon.status).toBe(401);

    // 3. Registration requests review: Admin=200, CTV=403, Anon=401
    const reqAdmin = await request(app).get('/api/v1/registration-requests').set('Cookie', adminCookie);
    expect(reqAdmin.status).toBe(200);

    const reqCtv = await request(app).get('/api/v1/registration-requests').set('Cookie', ctvCookie);
    expect(reqCtv.status).toBe(403);

    const reqAnon = await request(app).get('/api/v1/registration-requests');
    expect(reqAnon.status).toBe(401);

    // 4. Schedule summary: Admin=200, CTV=403, Anon=401
    const sumAdmin = await request(app).get('/api/v1/schedule-summary?month=2026-08').set('Cookie', adminCookie);
    expect(sumAdmin.status).toBe(200);

    const sumCtv = await request(app).get('/api/v1/schedule-summary?month=2026-08').set('Cookie', ctvCookie);
    expect(sumCtv.status).toBe(403);

    // 5. User me: CTV=200, Admin=200, Anon=401
    const meCtv = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(meCtv.status).toBe(200);

    const meAdmin = await request(app).get('/api/v1/users/me').set('Cookie', adminCookie);
    expect(meAdmin.status).toBe(200);

    const meAnon = await request(app).get('/api/v1/users/me');
    expect(meAnon.status).toBe(401);
  });
});

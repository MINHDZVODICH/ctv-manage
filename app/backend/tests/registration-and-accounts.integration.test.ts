import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors, TEST_PASSWORD } from './helpers.js';

const app = createApp();

describe('registration approval and account administration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('validates, normalizes and rejects duplicate public registrations', async () => {
    const invalid = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'not-an-email')
      .field('displayName', '')
      .field('phone', '1')
      .field('password', '123');
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', ' NEW.CTV@EXAMPLE.COM ')
      .field('displayName', 'CTV Mới')
      .field('phone', '0912345678')
      .field('password', TEST_PASSWORD);
    expect(created.status).toBe(201);
    expect(created.body.request.email).toBe('new.ctv@example.com');
    expect(created.body.request.status).toBe('PENDING');

    const duplicate = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'new.ctv@example.com')
      .field('displayName', 'CTV Trùng')
      .field('phone', '0987654321')
      .field('password', TEST_PASSWORD);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  test('ADMIN approves a pending registration exactly once and the new CTV can log in', async () => {
    const registration = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'approved.ctv@example.com')
      .field('displayName', 'CTV Được Duyệt')
      .field('phone', '0912345678')
      .field('password', TEST_PASSWORD);
    const requestId = registration.body.request.id;
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    const approved = await request(app)
      .patch(`/api/v1/registration-requests/${requestId}`)
      .set('Cookie', adminCookie)
      .send({ decision: 'APPROVED', expectedStatus: 'PENDING' });
    expect(approved.status).toBe(200);
    expect(approved.body.request.status).toBe('APPROVED');
    expect(approved.body.request.approvedAccount.ctvCode).toMatch(/^CTV-\d{4}-\d{3}$/);

    const repeated = await request(app)
      .patch(`/api/v1/registration-requests/${requestId}`)
      .set('Cookie', adminCookie)
      .send({ decision: 'APPROVED', expectedStatus: 'PENDING' });
    expect(repeated.status).toBe(409);

    const newLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'approved.ctv@example.com', password: TEST_PASSWORD });
    expect(newLogin.status).toBe(201);
  });

  test('ADMIN lists/searches CTV accounts, handles version conflicts and resets password', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const actors = await prisma.account.findMany({ where: { role: 'CTV' } });
    const active = actors.find((account) => account.email === 'ctv.active@ctv.local')!;

    const list = await request(app)
      .get('/api/v1/accounts?q=Active&page=1&pageSize=5')
      .set('Cookie', adminCookie);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0].email).toBe('ctv.active@ctv.local');

    const updated = await request(app)
      .patch(`/api/v1/accounts/${active.id}/notes`)
      .set('Cookie', adminCookie)
      .send({ adminNotes: 'Đã kiểm tra', expectedVersion: active.version });
    expect(updated.status).toBe(200);
    expect(updated.body.data.adminNotes).toBe('Đã kiểm tra');

    const conflict = await request(app)
      .patch(`/api/v1/accounts/${active.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'DISABLED', expectedVersion: active.version });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('VERSION_CONFLICT');

    const reset = await request(app)
      .post(`/api/v1/accounts/${active.id}/password-resets`)
      .set('Cookie', adminCookie)
      .send({ newPassword: 'Changed@123456', mustChangePassword: true });
    expect(reset.status).toBe(200);

    const newLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: active.email, password: 'Changed@123456' });
    expect(newLogin.status).toBe(201);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });

  test('CTV updates profile and changing password revokes other sessions', async () => {
    const firstCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const secondCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const profile = await request(app).get('/api/v1/users/me').set('Cookie', firstCookie);

    const updated = await request(app)
      .patch('/api/v1/users/me')
      .set('Cookie', firstCookie)
      .send({ displayName: 'CTV Đã Sửa', expectedVersion: profile.body.user.version });
    expect(updated.status).toBe(200);
    expect(updated.body.user.displayName).toBe('CTV Đã Sửa');

    const changed = await request(app)
      .post('/api/v1/users/me/password-changes')
      .set('Cookie', firstCookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'Profile@123456' });
    expect(changed.status).toBe(204);

    const staleSession = await request(app).get('/api/v1/users/me').set('Cookie', secondCookie);
    expect(staleSession.status).toBe(401);
  });
});


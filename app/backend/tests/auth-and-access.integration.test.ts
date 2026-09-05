import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { optionalAuth } from '../src/middleware/auth.js';
import { loginCookie, resetDatabase, seedActors, TEST_PASSWORD } from './helpers.js';

const app = createApp();

describe('authentication, sessions and role boundaries', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('health endpoint is public', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('rejects invalid credentials and disabled accounts', async () => {
    const invalid = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: 'wrong-password' });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('INVALID_CREDENTIALS');

    const disabled = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.disabled@ctv.local', password: TEST_PASSWORD });
    expect(disabled.status).toBe(403);
    expect(disabled.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  test('creates, restores and revokes a server-side session', async () => {
    const login = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: ' CTV.ACTIVE@CTV.LOCAL ', password: TEST_PASSWORD });
    expect(login.status).toBe(201);
    expect(login.body.user.role).toBe('CTV');
    expect(login.headers['set-cookie']?.[0]).toContain('HttpOnly');
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    const me = await request(app).get('/api/v1/auth/sessions/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ctv.active@ctv.local');

    const logout = await request(app).delete('/api/v1/auth/sessions/current').set('Cookie', cookie);
    expect(logout.status).toBe(204);

    const afterLogout = await request(app).get('/api/v1/auth/sessions/me').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
  });

  test('enforces anonymous, ADMIN and CTV route boundaries', async () => {
    const anonymous = await request(app).get('/api/v1/accounts');
    expect(anonymous.status).toBe(401);

    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const forbidden = await request(app).get('/api/v1/accounts').set('Cookie', ctvCookie);
    expect(forbidden.status).toBe(403);

    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const adminList = await request(app).get('/api/v1/accounts').set('Cookie', adminCookie);
    expect(adminList.status).toBe(200);

    const adminScheduleWrite = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', adminCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(adminScheduleWrite.status).toBe(403);
  });

  test('rejects non-ACTIVE account with 403 ACCOUNT_DISABLED even if session exists', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Directly disable account in DB without revoking session to test defense-in-depth
    await prisma.account.update({
      where: { id: ctv.id },
      data: { status: 'DISABLED' },
    });

    const res = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  test('optionalAuth does not attach req.user if account is not ACTIVE', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    await prisma.account.update({
      where: { id: ctv.id },
      data: { status: 'DISABLED' },
    });

    const token = ctvCookie.split(';')[0].split('=')[1];
    const req = { cookies: { ctv_session: token } } as any;
    let nextCalled = false;
    await optionalAuth(req, {} as any, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.user).toBeUndefined();
  });
});


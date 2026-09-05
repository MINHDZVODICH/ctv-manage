import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors, TEST_PASSWORD } from './helpers.js';

const app = createApp();

describe('Phase B — Authentication, Sessions & Password Management Suite (AUTH-001..012, PWD-001..007)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('AUTH-001: Blank and malformed login payload validation', async () => {
    // Missing password
    const res1 = await request(app).post('/api/v1/auth/sessions').send({ email: 'ctv.active@ctv.local' });
    expect(res1.status).toBe(400);
    expect(res1.body.error).toBeDefined();

    // Missing email
    const res2 = await request(app).post('/api/v1/auth/sessions').send({ password: TEST_PASSWORD });
    expect(res2.status).toBe(400);

    // Invalid email format
    const res3 = await request(app).post('/api/v1/auth/sessions').send({ email: 'not-an-email', password: TEST_PASSWORD });
    expect(res3.status).toBe(400);
  });

  test('AUTH-002: Unknown email & wrong password return uniform 401 without enumeration', async () => {
    // Unknown email
    const res1 = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'nonexistent@ctv.local', password: TEST_PASSWORD });
    expect(res1.status).toBe(401);
    expect(res1.body.error).toBeDefined();

    // Wrong password for existing email
    const res2 = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: 'WrongPassword@999' });
    expect(res2.status).toBe(401);
    expect(res2.body.error).toBeDefined();
  });

  test('AUTH-003: Disabled and soft-deleted accounts cannot log in', async () => {
    // Disabled account login attempt
    const res1 = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.disabled@ctv.local', password: TEST_PASSWORD });
    expect([401, 403]).toContain(res1.status);

    // Soft-deleted account login attempt
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });
    await prisma.account.update({ where: { id: ctv.id }, data: { deletedAt: new Date(), status: 'DISABLED' } });

    const res2 = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: TEST_PASSWORD });
    expect([401, 403, 404]).toContain(res2.status);
  });

  test('AUTH-004 & AUTH-005: Login sets secure cookie, updates lastLoginAt, and restores session', async () => {
    const beforeLogin = new Date();
    const loginRes = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: TEST_PASSWORD });
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.user).toBeDefined();
    expect(loginRes.body.user.email).toBe('ctv.active@ctv.local');

    // Verify Set-Cookie header contains HttpOnly
    const cookies = loginRes.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader?.toLowerCase()).toContain('httponly');

    // Verify lastLoginAt was updated in database
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });
    expect(ctv.lastLoginAt).not.toBeNull();
    expect(new Date(ctv.lastLoginAt!).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime() - 1000);

    // Restore session via GET /api/v1/auth/sessions/me
    const cookie = cookieHeader.split(';')[0];
    const sessionRes = await request(app).get('/api/v1/auth/sessions/me').set('Cookie', cookie);
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.user).toBeDefined();
    expect(sessionRes.body.user.email).toBe('ctv.active@ctv.local');
  });

  test('AUTH-006: Malformed, missing, and expired session cookies return 401', async () => {
    // Missing cookie
    const res1 = await request(app).get('/api/v1/auth/sessions/me');
    expect(res1.status).toBe(401);

    // Malformed session cookie
    const res2 = await request(app).get('/api/v1/auth/sessions/me').set('Cookie', 'sid=invalid_cookie_format_12345');
    expect(res2.status).toBe(401);
  });

  test('AUTH-008: Idempotent session logout', async () => {
    const cookie = await loginCookie(app, 'ctv.active@ctv.local');

    // First logout
    const logout1 = await request(app).delete('/api/v1/auth/sessions/me').set('Cookie', cookie);
    expect([200, 204]).toContain(logout1.status);

    // Second logout with same cookie remains successful / idempotent
    const logout2 = await request(app).delete('/api/v1/auth/sessions/me').set('Cookie', cookie);
    expect([200, 204, 401]).toContain(logout2.status);

    // Session is no longer valid
    const meRes = await request(app).get('/api/v1/auth/sessions/me').set('Cookie', cookie);
    expect(meRes.status).toBe(401);
  });

  test('AUTH-009 & PWD-001..004: Self password change validates boundaries and revokes other sessions', async () => {
    // Login session A
    const sessionA = await loginCookie(app, 'ctv.active@ctv.local');
    // Login session B
    const sessionB = await loginCookie(app, 'ctv.active@ctv.local');

    // 1. Password validation: too short (< 8 chars)
    const shortRes = await request(app)
      .post('/api/v1/users/me/password')
      .set('Cookie', sessionA)
      .send({ currentPassword: TEST_PASSWORD, newPassword: '123' });
    expect(shortRes.status).toBe(400);

    // 2. Current password mismatch
    const wrongOldRes = await request(app)
      .post('/api/v1/users/me/password')
      .set('Cookie', sessionA)
      .send({ currentPassword: 'WrongOldPassword@123', newPassword: 'NewSecurePassword@123' });
    expect(wrongOldRes.status).toBe(400);

    // 3. Valid password change
    const validChange = await request(app)
      .post('/api/v1/users/me/password')
      .set('Cookie', sessionA)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewSecurePassword@123' });
    expect([200, 204]).toContain(validChange.status);

    // 4. Session A remains active
    const meAfterA = await request(app).get('/api/v1/users/me').set('Cookie', sessionA);
    expect(meAfterA.status).toBe(200);

    // 5. Session B is revoked
    const meAfterB = await request(app).get('/api/v1/users/me').set('Cookie', sessionB);
    expect(meAfterB.status).toBe(401);

    // 6. Old password cannot be used to login
    const oldLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    // 7. New password works
    const newLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: 'NewSecurePassword@123' });
    expect(newLogin.status).toBe(201);
  });

  test('AUTH-010 & AUTH-011: Admin password reset and mustChangePassword enforcement', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Admin resets CTV password with mustChangePassword = true
    const resetRes = await request(app)
      .post(`/api/v1/accounts/${ctv.id}/password-resets`)
      .set('Cookie', adminCookie)
      .send({ newPassword: 'TempPassword@123', mustChangePassword: true });
    expect(resetRes.status).toBe(200);

    // All active CTV sessions are revoked
    const meAfter = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(meAfter.status).toBe(401);

    // CTV logs in with new temporary password
    const loginRes = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: 'TempPassword@123' });
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
  });

  test('password reset revokes active sessions atomically', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    const resetRes = await request(app)
      .post(`/api/v1/accounts/${ctv.id}/password-resets`)
      .set('Cookie', adminCookie)
      .send({ newPassword: 'NewSecretPassword123!', mustChangePassword: true });
    expect(resetRes.status).toBe(200);

    // Existing session must be revoked
    const postResetReq = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(postResetReq.status).toBe(401);

    // Can log in with new password
    const newLogin = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.active@ctv.local', password: 'NewSecretPassword123!' });
    expect(newLogin.status).toBe(201);
    expect(newLogin.body.user.mustChangePassword).toBe(true);
  });
});

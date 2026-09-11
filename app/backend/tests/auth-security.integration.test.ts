import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { resetDatabase, seedActors, TEST_PASSWORD } from './helpers.js';
import * as authService from '../src/modules/auth/auth.service.js';
import { incrementRateLimit } from '../src/shared/rateLimitStore.js';

const app = createApp();

describe('Auth Security, Proxy Trust, Timing Protection & Rate Limiting Integration Tests', () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.rateLimitWindow.deleteMany();
    await seedActors();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
  });

  test('1. spoofed X-Forwarded-For without trusted proxy config: ignores spoofed header and uses socket IP', async () => {
    const spoofedIp = '203.0.113.195';

    const loginRes = await request(app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', spoofedIp)
      .send({ email: 'ctv.active@ctv.local', password: TEST_PASSWORD });

    expect(loginRes.status).toBe(201);

    const session = await prisma.session.findFirst({
      where: { account: { email: 'ctv.active@ctv.local' } },
      orderBy: { createdAt: 'desc' },
    });

    expect(session).toBeDefined();
    // When proxy is not trusted, req.ip falls back to socket IP (e.g. 127.0.0.1 or ::ffff:127.0.0.1)
    // and must NOT be the attacker's spoofed X-Forwarded-For header
    expect(session?.ipAddress).not.toBe(spoofedIp);
    expect(session?.ipAddress).toMatch(/127\.0\.0\.1/);
  });

  test('2. non-existent account login: executes dummy Argon2 verify to prevent timing enumeration, returns 401 INVALID_CREDENTIALS', async () => {
    const verifySpy = vi.spyOn(argon2, 'verify');

    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ghost.user.doesnotexist@ctv.local', password: 'AnyPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('INVALID_CREDENTIALS');
    // Dummy argon2 verify MUST be called to prevent timing enumeration
    expect(verifySpy).toHaveBeenCalled();
  });

  test('3. disabled account with WRONG password: returns 401 INVALID_CREDENTIALS (does NOT leak disabled status)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.disabled@ctv.local', password: 'incorrect-password' });

    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  test('4. disabled account with CORRECT password: returns 403 ACCOUNT_DISABLED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'ctv.disabled@ctv.local', password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('ACCOUNT_DISABLED');
  });

  test('4b. pending registration with WRONG password: returns 401 INVALID_CREDENTIALS (does NOT leak pending status)', async () => {
    const hashed = await argon2.hash(TEST_PASSWORD);
    await prisma.registrationRequest.create({
      data: {
        email: 'pending.candidate@ctv.local',
        passwordHash: hashed,
        displayName: 'Pending Candidate',
        status: 'PENDING',
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'pending.candidate@ctv.local', password: 'incorrect-password' });

    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  test('4c. pending registration with CORRECT password: returns 403 ACCOUNT_PENDING_APPROVAL', async () => {
    const hashed = await argon2.hash(TEST_PASSWORD);
    await prisma.registrationRequest.create({
      data: {
        email: 'pending.candidate@ctv.local',
        passwordHash: hashed,
        displayName: 'Pending Candidate',
        status: 'PENDING',
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'pending.candidate@ctv.local', password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('ACCOUNT_PENDING_APPROVAL');
    expect(res.body.error?.message).toBe('Tài khoản đang được chờ duyệt');
  });

  test('5. login rate limit: 10 req / 15 min per IP + normalized email', async () => {
    const email = 'ctv.active@ctv.local';

    // Perform 10 failed login attempts with same email
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/v1/auth/sessions')
        .send({ email, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    // 11th attempt with normalized variation of email (extra spaces, uppercase)
    const blockedRes = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: '  CTV.ACTIVE@CTV.LOCAL  ', password: 'wrong-password' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error?.code).toBe('RATE_LIMITED');
    expect(blockedRes.headers['retry-after']).toBeDefined();
  });

  test('5b. login rate limit: 60 req / 15 min per IP across different emails', async () => {
    // Pre-seed 60 requests in LOGIN_IP scope for 127.0.0.1 and ::ffff:127.0.0.1 to simulate IP hitting limit
    for (let i = 0; i < 60; i++) {
      await incrementRateLimit('LOGIN_IP', '127.0.0.1', 900);
      await incrementRateLimit('LOGIN_IP', '::ffff:127.0.0.1', 900);
    }

    const blockedRes = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'brandnewemail@ctv.local', password: 'wrong' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error?.code).toBe('RATE_LIMITED');
  });

  test('6. IP rate limit triggers before JSON body parsing for login route', async () => {
    // Pre-seed rate limit for socket IP
    for (let i = 0; i < 60; i++) {
      await incrementRateLimit('LOGIN_IP', '127.0.0.1', 900);
      await incrementRateLimit('LOGIN_IP', '::ffff:127.0.0.1', 900);
    }

    // Send malformed JSON payload.
    // If rate limiter runs before body parser, this returns 429 RATE_LIMITED.
    // If body parser runs before rate limiter, this would return 400 Bad Request syntax error.
    const res = await request(app)
      .post('/api/v1/auth/sessions')
      .set('Content-Type', 'application/json')
      .send('{"email": "ctv.active@ctv.local", "password": ');

    expect(res.status).toBe(429);
    expect(res.body.error?.code).toBe('RATE_LIMITED');
  });

  test('7. getAccountProfile in auth.service: fetches profile without raw passwordHash and handles invalid accounts', async () => {
    const activeUser = await prisma.account.findUniqueOrThrow({
      where: { email: 'ctv.active@ctv.local' },
    });

    const profile = await (authService as any).getAccountProfile(activeUser.id);
    expect(profile).toBeDefined();
    expect(profile.id).toBe(activeUser.id);
    expect(profile.email).toBe('ctv.active@ctv.local');
    expect(profile.displayName).toBe('CTV Active');
    expect(profile.role).toBe('CTV');
    expect(profile.status).toBe('ACTIVE');
    expect((profile as any).passwordHash).toBeUndefined();

    // Throws unauthorized for non-existent account
    await expect((authService as any).getAccountProfile('non-existent-id')).rejects.toThrow();

    // Throws unauthorized for soft-deleted account
    await prisma.account.update({
      where: { id: activeUser.id },
      data: { deletedAt: new Date() },
    });
    await expect((authService as any).getAccountProfile(activeUser.id)).rejects.toThrow();
  });
});

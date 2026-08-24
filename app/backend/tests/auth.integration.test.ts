import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import argon2 from 'argon2';
import { AccountRole, AccountStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

const allowedOrigin = 'http://localhost:5173';
const validCredentials = { email: 'admin@example.vn', password: 'Secret123' };

describe.sequential('authentication API', () => {
  beforeAll(async () => {
    await resetTestDatabase(prisma);
    await prisma.account.create({
      data: {
        email: validCredentials.email,
        passwordHash: await argon2.hash(validCredentials.password, { type: argon2.argon2id }),
        role: AccountRole.ADMIN,
        status: AccountStatus.ACTIVE,
        mustChangePassword: false,
        displayName: 'Quản trị viên',
      },
    });
    await prisma.account.create({
      data: {
        email: 'disabled@example.vn',
        passwordHash: await argon2.hash(validCredentials.password, { type: argon2.argon2id }),
        role: AccountRole.CTV,
        status: AccountStatus.DISABLED,
        displayName: 'CTV bị khóa',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('login stores only a token hash and returns a secure session cookie', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/sessions')
      .set('Origin', allowedOrigin)
      .send(validCredentials);

    assert.equal(response.status, 201);
    const cookie = response.headers['set-cookie'][0];
    assert.match(cookie, /^ctv_session=[A-Za-z0-9_-]{43};/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    const rawToken = cookie.match(/^ctv_session=([^;]+)/)?.[1];
    assert.ok(rawToken);
    const storedSession = await prisma.session.findFirstOrThrow();
    assert.match(storedSession.tokenHash, /^[a-f0-9]{64}$/);
    assert.notEqual(storedSession.tokenHash, rawToken);
    assert.equal(storedSession.tokenHash, createHash('sha256').update(rawToken).digest('hex'));
    assert.equal(JSON.stringify(response.body).includes('token'), false);
    assert.deepEqual(response.body.data.user, {
      id: expectString(response.body.data.user.id),
      displayName: 'Quản trị viên',
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: false,
    });
  });

  test('current session is resolved exclusively from the session cookie', async () => {
    const cookie = await loginCookie();
    const response = await request(createApp())
      .get('/api/v1/auth/sessions/current')
      .set('Cookie', cookie);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.role, 'ADMIN');
    assert.equal(response.body.data.user.displayName, 'Quản trị viên');
  });

  test('unknown email and wrong password use the same public error', async () => {
    for (const credentials of [
      { email: 'missing@example.vn', password: 'Secret123' },
      { email: validCredentials.email, password: 'Wrong123' },
    ]) {
      const response = await request(createApp())
        .post('/api/v1/auth/sessions')
        .set('Origin', allowedOrigin)
        .send(credentials);

      assert.equal(response.status, 401);
      assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
    }
  });

  test('disabled account with valid credentials returns ACCOUNT_DISABLED', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/sessions')
      .set('Origin', allowedOrigin)
      .send({ email: 'disabled@example.vn', password: validCredentials.password });

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'ACCOUNT_DISABLED');
  });

  test('login rejects a non-JSON media type', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/sessions')
      .set('Origin', allowedOrigin)
      .set('Content-Type', 'text/plain')
      .send('email=admin@example.vn');

    assert.equal(response.status, 415);
    assert.equal(response.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  test('login rejects a missing Origin header', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/sessions')
      .send(validCredentials);

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'ORIGIN_NOT_ALLOWED');
  });

  test('login rejects an Origin outside the allowlist', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/sessions')
      .set('Origin', 'https://attacker.example')
      .send(validCredentials);

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'ORIGIN_NOT_ALLOWED');
  });

  test('login rate limit is keyed by IP and normalized email', async () => {
    const app = createApp();
    let response!: request.Response;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await request(app)
        .post('/api/v1/auth/sessions')
        .set('Origin', allowedOrigin)
        .send({ email: 'throttled@example.vn', password: 'Wrong123' });
    }

    assert.equal(response.status, 429);
    assert.equal(response.body.error.code, 'RATE_LIMITED');
    assert.match(response.headers['retry-after'], /^\d+$/);
  });

  test('authenticated mutation rejects a missing CSRF token', async () => {
    const cookie = await loginCookie();
    const response = await request(createApp())
      .delete('/api/v1/auth/sessions/current')
      .set('Cookie', cookie);

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'CSRF_INVALID');
  });

  test('CSRF token authorizes logout, revokes the session, and logout remains idempotent', async () => {
    const app = createApp();
    const cookie = await loginCookie(app);
    const csrfResponse = await request(app)
      .get('/api/v1/auth/csrf-token')
      .set('Cookie', cookie);
    assert.equal(csrfResponse.status, 200);
    assert.match(csrfResponse.body.data.csrfToken, /^[a-f0-9]{64}$/);

    const logoutResponse = await request(app)
      .delete('/api/v1/auth/sessions/current')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfResponse.body.data.csrfToken);
    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers['set-cookie'][0], /ctv_session=;/);

    const rawToken = cookie.match(/ctv_session=([^;]+)/)?.[1];
    assert.ok(rawToken);
    const storedSession = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: createHash('sha256').update(rawToken).digest('hex') },
    });
    assert.ok(storedSession.revokedAt);

    const repeated = await request(app)
      .delete('/api/v1/auth/sessions/current')
      .set('Cookie', cookie);
    assert.equal(repeated.status, 204);
  });
});

async function loginCookie(app = createApp()): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/sessions')
    .set('Origin', allowedOrigin)
    .send(validCredentials);
  assert.equal(response.status, 201);
  return response.headers['set-cookie'][0];
}

function expectString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Expected a string value.');
  }
  return value;
}

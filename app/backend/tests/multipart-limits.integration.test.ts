import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import {
  loginCookie,
  resetDatabase,
  seedActors,
  TEST_PASSWORD,
  validPng,
} from './helpers.js';
import { incrementRateLimit } from '../src/shared/rateLimitStore.js';

const app = createApp();

describe('Multipart Upload Constraints & Custom Error Envelopes (Task 6)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('1. upload file > 5 MiB returns HTTP 413 FILE_TOO_LARGE', async () => {
    const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x00);

    // 1a. Public registration upload > 5 MiB
    const regRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'oversized@ctv.local')
      .field('displayName', 'Oversized Applicant')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', oversizedBuffer, { filename: 'large.png', contentType: 'image/png' });

    expect(regRes.status).toBe(413);
    expect(regRes.body).toEqual({
      error: expect.objectContaining({
        code: 'FILE_TOO_LARGE',
        message: expect.any(String),
      }),
    });

    // 1b. Account file upload > 5 MiB
    const uploadRes = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ownerCookie)
      .attach('file', oversizedBuffer, { filename: 'large_avatar.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(413);
    expect(uploadRes.body).toEqual({
      error: expect.objectContaining({
        code: 'FILE_TOO_LARGE',
        message: expect.any(String),
      }),
    });
  });

  test('2. public registration with unexpected file field returns HTTP 400 FILE_UPLOAD_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'unexpected.file@ctv.local')
      .field('displayName', 'Unexpected File Applicant')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD)
      .attach('extraFile', validPng, { filename: 'extra.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: 'FILE_UPLOAD_ERROR',
        message: expect.any(String),
      }),
    });
  });

  test('3. public registration with text field > 16 KiB returns HTTP 400 FILE_UPLOAD_ERROR', async () => {
    const oversizedTextField = 'a'.repeat(16 * 1024 + 1);

    const res = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'oversized.field@ctv.local')
      .field('displayName', 'Oversized Field')
      .field('phone', '0901234567')
      .field('address', oversizedTextField)
      .field('password', TEST_PASSWORD);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: 'FILE_UPLOAD_ERROR',
        message: expect.any(String),
      }),
    });
  });

  test('4. public registration with > 7 text fields returns HTTP 400 FILE_UPLOAD_ERROR', async () => {
    // 7 standard fields + 1 extra field = 8 fields
    const res = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'excess.fields@ctv.local')
      .field('displayName', 'Excess Fields')
      .field('phone', '0901234567')
      .field('dateOfBirth', '2000-01-01')
      .field('gender', 'MALE')
      .field('address', '123 Main St')
      .field('password', TEST_PASSWORD)
      .field('extraUnwantedField', 'unwanted value');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: 'FILE_UPLOAD_ERROR',
        message: expect.any(String),
      }),
    });
  });

  test('5. public registration rate limit: 5 requests / 1 hour per client IP applied before multipart parsing', async () => {
    // Simulate hitting limit of 5 requests for client IP
    for (let i = 0; i < 5; i++) {
      await incrementRateLimit('REGISTRATION_IP', '127.0.0.1', 3600);
      await incrementRateLimit('REGISTRATION_IP', '::ffff:127.0.0.1', 3600);
    }

    // 6th request: send with an invalid multipart field (extraFile).
    // If multipart parsing ran first, multer would return 400 FILE_UPLOAD_ERROR.
    // Because rate limit is applied BEFORE multipart parsing, it returns 429 RATE_LIMITED.
    const res = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'blocked.ip@ctv.local')
      .field('displayName', 'Blocked IP')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD)
      .attach('extraFile', validPng, { filename: 'extra.png', contentType: 'image/png' });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: expect.objectContaining({
        code: 'RATE_LIMITED',
        message: expect.any(String),
      }),
    });
    expect(res.headers['retry-after']).toBeDefined();
  });

  test('6. account file upload rate limit: 30 requests / 15 min per account ID applied after auth and before multipart parsing', async () => {
    // 6a. Unauthenticated upload returns 401 UNAUTHORIZED before any rate limit or multipart parsing
    const unauthRes = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .attach('file', validPng, { filename: 'avatar.png', contentType: 'image/png' });

    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error?.code).toBe('UNAUTHORIZED');

    // 6b. Authenticated user hitting 30 requests limit
    const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctvUser = await prisma.account.findUniqueOrThrow({
      where: { email: 'ctv.active@ctv.local' },
    });

    for (let i = 0; i < 30; i++) {
      await incrementRateLimit('UPLOAD_ACCOUNT', ctvUser.id, 900);
    }

    // 31st request: send with an unexpected field name (wrongField).
    // If multipart parsing ran before rate limiter, multer would return 400 FILE_UPLOAD_ERROR.
    // Applied AFTER auth but BEFORE multipart parsing -> must return 429 RATE_LIMITED.
    const blockedRes = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ownerCookie)
      .attach('wrongField', validPng, { filename: 'wrong.png', contentType: 'image/png' });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body).toEqual({
      error: expect.objectContaining({
        code: 'RATE_LIMITED',
        message: expect.any(String),
      }),
    });
    expect(blockedRes.headers['retry-after']).toBeDefined();

    // 6c. A different user (ctv.other) is not rate limited (proves rate limit is per account ID)
    const otherCookie = await loginCookie(app, 'ctv.other@ctv.local');
    const otherRes = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', otherCookie)
      .attach('file', validPng, { filename: 'avatar.png', contentType: 'image/png' });

    expect(otherRes.status).toBe(201);
    expect(otherRes.body.file).toBeDefined();
  });
});

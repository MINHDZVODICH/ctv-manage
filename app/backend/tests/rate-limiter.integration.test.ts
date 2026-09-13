import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { type RequestHandler } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../src/shared/prisma.js';
import { config } from '../src/config.js';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import { cleanupExpiredRateLimits, calculateIdentityDigest } from '../src/shared/rateLimitStore.js';

function createTestApp(limiterMiddleware: RequestHandler) {
  const app = express();
  app.use(express.json());
  app.get('/test-endpoint', limiterMiddleware, (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.post('/test-endpoint', limiterMiddleware, (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  return app;
}

describe('PostgreSQL-Backed Shared Rate Limiting Integration Tests', () => {
  beforeEach(async () => {
    await prisma.rateLimitWindow.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('1. atomic increment: multiple concurrent requests within window increment count correctly', async () => {
    const testIp = '10.0.0.1';
    const limiter = createRateLimiter({
      scope: 'LOGIN_IP',
      maxRequests: 20,
      windowSeconds: 60,
      keyGenerator: () => testIp,
    });
    const app = createTestApp(limiter);

    // Send 10 concurrent requests
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get('/test-endpoint')),
    );

    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    }

    // Verify in database: exactly 1 window row exists with requestCount = 10
    const digest = calculateIdentityDigest(testIp);
    const rows = await prisma.rateLimitWindow.findMany({
      where: { scope: 'LOGIN_IP', identityDigest: digest },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].requestCount).toBe(10);
  });

  test('2. threshold exceeded: request exceeding limit returns HTTP 429 with RATE_LIMITED error and Retry-After header', async () => {
    const testIp = '10.0.0.2';
    const limiter = createRateLimiter({
      scope: 'LOGIN_IP',
      maxRequests: 3,
      windowSeconds: 60,
      keyGenerator: () => testIp,
    });
    const app = createTestApp(limiter);

    // Send 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/test-endpoint');
      expect(res.status).toBe(200);
    }

    // 4th request exceeds maxRequests = 3
    const res = await request(app).get('/test-endpoint');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.',
      },
    });
    expect(res.headers['retry-after']).toBeDefined();
    const retryAfter = Number(res.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  test('3. window expiration: after window seconds, subsequent request starts new window and succeeds', async () => {
    const testIp = '10.0.0.3';
    const limiter = createRateLimiter({
      scope: 'LOGIN_IP',
      maxRequests: 1,
      windowSeconds: 10,
      keyGenerator: () => testIp,
    });
    const app = createTestApp(limiter);

    // 1st request succeeds
    const res1 = await request(app).get('/test-endpoint');
    expect(res1.status).toBe(200);

    // 2nd request within same window is rate limited
    const res2 = await request(app).get('/test-endpoint');
    expect(res2.status).toBe(429);

    // Advance time past the 10-second window
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const now = new Date();
      vi.setSystemTime(new Date(now.getTime() + 11_000));

      // Request in new window starts fresh count and succeeds
      const res3 = await request(app).get('/test-endpoint');
      expect(res3.status).toBe(200);

      // Verify in database: two distinct window rows exist
      const digest = calculateIdentityDigest(testIp);
      const rows = await prisma.rateLimitWindow.findMany({
        where: { scope: 'LOGIN_IP', identityDigest: digest },
      });
      expect(rows).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('4. secret hashing: raw IP or email does not appear in RateLimitWindow table (stored as HMAC-SHA256)', async () => {
    const rawIp = '198.51.100.42';
    const rawEmail = 'victim_target@ctv.local';

    const ipLimiter = createRateLimiter({
      scope: 'LOGIN_IP',
      maxRequests: 5,
      windowSeconds: 60,
      keyGenerator: () => rawIp,
    });
    const ipApp = createTestApp(ipLimiter);
    await request(ipApp).get('/test-endpoint');

    const accountLimiter = createRateLimiter({
      scope: 'LOGIN_ACCOUNT',
      maxRequests: 5,
      windowSeconds: 60,
      keyGenerator: () => rawEmail,
    });
    const accountApp = createTestApp(accountLimiter);
    await request(accountApp).get('/test-endpoint');

    // Query all rows in RateLimitWindow
    const allRows = await prisma.rateLimitWindow.findMany();
    expect(allRows.length).toBeGreaterThanOrEqual(2);

    // Raw values MUST NOT appear anywhere in table rows
    for (const row of allRows) {
      expect(row.identityDigest).not.toContain(rawIp);
      expect(row.identityDigest).not.toContain(rawEmail);
      expect(JSON.stringify(row)).not.toContain(rawIp);
      expect(JSON.stringify(row)).not.toContain(rawEmail);
    }

    // The identityDigest must match HMAC-SHA256 with config.RATE_LIMIT_KEY_SECRET
    const expectedIpDigest = crypto
      .createHmac('sha256', config.RATE_LIMIT_KEY_SECRET)
      .update(rawIp)
      .digest('hex');
    const expectedEmailDigest = crypto
      .createHmac('sha256', config.RATE_LIMIT_KEY_SECRET)
      .update(rawEmail)
      .digest('hex');

    const ipRow = allRows.find(
      (r) => r.scope === 'LOGIN_IP' && r.identityDigest === expectedIpDigest,
    );
    const emailRow = allRows.find(
      (r) => r.scope === 'LOGIN_ACCOUNT' && r.identityDigest === expectedEmailDigest,
    );

    expect(ipRow).toBeDefined();
    expect(emailRow).toBeDefined();
  });

  test('5. fail closed: when database query rejects or store is unavailable, returns HTTP 503 with SERVICE_UNAVAILABLE', async () => {
    const failingLimiter = createRateLimiter({
      scope: 'LOGIN_IP',
      maxRequests: 10,
      windowSeconds: 60,
      keyGenerator: () => '10.0.0.5',
    });
    const app = createTestApp(failingLimiter);

    // Force prisma.$queryRaw to reject
    const queryRawSpy = vi
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('Database connection lost'));

    try {
      const res = await request(app).get('/test-endpoint');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
        },
      });
    } finally {
      queryRawSpy.mockRestore();
    }
  });

  test('6. cleanup routine: rows older than expiration are deleted', async () => {
    const now = new Date();
    const expiredDate = new Date(now.getTime() - 60_000); // 1 minute ago
    const activeDate = new Date(now.getTime() + 60_000); // 1 minute in future

    // Insert an expired window row
    await prisma.rateLimitWindow.create({
      data: {
        scope: 'LOGIN_IP',
        identityDigest: 'expired-digest-' + crypto.randomUUID(),
        windowStart: new Date(now.getTime() - 120_000),
        requestCount: 5,
        expiresAt: expiredDate,
      },
    });

    // Insert an active window row
    const activeDigest = 'active-digest-' + crypto.randomUUID();
    await prisma.rateLimitWindow.create({
      data: {
        scope: 'LOGIN_IP',
        identityDigest: activeDigest,
        windowStart: now,
        requestCount: 2,
        expiresAt: activeDate,
      },
    });

    // Run cleanup
    const deletedCount = await cleanupExpiredRateLimits(now);
    expect(deletedCount).toBeGreaterThanOrEqual(1);

    // Expired row should be deleted
    const expiredRows = await prisma.rateLimitWindow.findMany({
      where: { expiresAt: { lt: now } },
    });
    expect(expiredRows).toHaveLength(0);

    // Active row should still exist
    const activeRows = await prisma.rateLimitWindow.findMany({
      where: { identityDigest: activeDigest },
    });
    expect(activeRows).toHaveLength(1);
  });
});

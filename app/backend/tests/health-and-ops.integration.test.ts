import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { logger } from '../src/shared/logger.js';
import { setShuttingDown } from '../src/modules/health/health.controller.js';
import { seedActors, loginCookie, resetDatabase } from './helpers.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Health Endpoints, Structured Logging, and Graceful Shutdown Integration Tests', () => {
  const app = createApp();

  beforeEach(() => {
    setShuttingDown(false);
  });

  afterEach(() => {
    setShuttingDown(false);
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('1. GET /api/v1/health returns 200 { status: "ok" }', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('2. GET /api/v1/health/live returns 200 { status: "live" }', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'live' });
  });

  test('3. GET /api/v1/health/ready returns 200 { status: "ready" } when DB responds within 2 seconds', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  test('4. GET /api/v1/health/ready returns 503 { status: "not_ready" } when DB query rejects without leaking SQL or error', async () => {
    const originalQueryRaw = prisma.$queryRaw;
    prisma.$queryRaw = vi.fn().mockRejectedValueOnce(
      new Error('FATAL: password authentication failed for user "postgres"'),
    ) as any;

    try {
      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'not_ready' });
      expect(JSON.stringify(res.body)).not.toContain('FATAL');
      expect(JSON.stringify(res.body)).not.toContain('postgres');
      expect(JSON.stringify(res.body)).not.toContain('SELECT');
    } finally {
      prisma.$queryRaw = originalQueryRaw;
    }
  });

  test('5. GET /api/v1/health/ready returns 503 { status: "not_ready" } when DB query hangs beyond 2s deadline', async () => {
    const originalQueryRaw = prisma.$queryRaw;
    prisma.$queryRaw = vi.fn().mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 2500)),
    ) as any;

    try {
      const start = Date.now();
      const res = await request(app).get('/api/v1/health/ready');
      const elapsed = Date.now() - start;

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'not_ready' });
      expect(elapsed).toBeGreaterThanOrEqual(1900);
      expect(elapsed).toBeLessThan(3500);
    } finally {
      prisma.$queryRaw = originalQueryRaw;
    }
  }, 6000);

  test('6. All requests include X-Request-ID response header matching UUID format', async () => {
    const res = await request(app).get('/api/v1/health');
    const reqId = res.headers['x-request-id'];

    expect(reqId).toBeDefined();
    expect(reqId).toMatch(UUID_REGEX);
  });

  test('7. Propagates valid incoming X-Request-ID header', async () => {
    const customId = crypto.randomUUID();
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });

  test('8. After graceful shutdown initiated, GET /api/v1/health/ready immediately returns 503 { status: "not_ready" }', async () => {
    setShuttingDown(true);

    const originalQueryRaw = prisma.$queryRaw;
    const mockQueryRaw = vi.fn();
    prisma.$queryRaw = mockQueryRaw as any;
    try {
      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'not_ready' });
      // Database query should NOT have been called once shutdown is initiated
      expect(mockQueryRaw).not.toHaveBeenCalled();
    } finally {
      prisma.$queryRaw = originalQueryRaw;
    }
  });

  test('9. Request logger logs start and finish with route template, status, duration, and redacts passwords/bodies', async () => {
    const infoSpy = vi.spyOn(logger, 'info');

    try {
      const res = await request(app)
        .post('/api/v1/auth/sessions')
        .send({ email: 'test@example.com', password: 'SecretPassword123' });

      expect(res.headers['x-request-id']).toMatch(UUID_REGEX);

      // Verify info logs were emitted for request start and finish
      const logCalls = infoSpy.mock.calls;
      expect(logCalls.length).toBeGreaterThanOrEqual(2);

      // Verify log objects contain request metadata and do NOT contain raw body or password
      for (const call of logCalls) {
        const logObj = call[0];
        if (typeof logObj === 'object' && logObj !== null) {
          const serialized = JSON.stringify(logObj);
          expect(serialized).not.toContain('SecretPassword123');
          expect(logObj).not.toHaveProperty('body');
          expect(logObj).not.toHaveProperty('cookies');
        }
      }

      // Find the finish log call
      const finishCall = logCalls.find(
        (c) => typeof c[0] === 'object' && c[0] !== null && 'durationMs' in c[0],
      );
      expect(finishCall).toBeDefined();
      const finishObj = finishCall![0] as any;
      expect(finishObj.requestId).toMatch(UUID_REGEX);
      expect(finishObj.status).toBeDefined();
      expect(typeof finishObj.durationMs).toBe('number');
    } finally {
      infoSpy.mockRestore();
    }
  });

  test('10. Authenticated request logs actorId on finish', async () => {
    await resetDatabase();
    const { ctv } = await seedActors();
    const cookie = await loginCookie(app, ctv.email);

    const infoSpy = vi.spyOn(logger, 'info');
    try {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);

      const logCalls = infoSpy.mock.calls;
      const finishCall = logCalls.find(
        (c) =>
          typeof c[0] === 'object' &&
          c[0] !== null &&
          'durationMs' in (c[0] as object) &&
          (c[0] as any).url === '/api/v1/users/me',
      );
      expect(finishCall).toBeDefined();
      const finishObj = finishCall![0] as any;
      expect(finishObj.actorId).toBe(ctv.id);
      expect(finishObj.status).toBe(200);
      expect(finishObj.route).toBe('/api/v1/users/me');
    } finally {
      infoSpy.mockRestore();
    }
  });
});

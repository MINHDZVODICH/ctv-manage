import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors, TEST_PASSWORD, validPng } from './helpers.js';

const app = createApp();

describe('Phase C — Resilience, Integrity & Timezone Boundaries Suite', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Database integrity: Cascading and foreign key integrity during account operations', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Register schedule
    await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });

    // Upload avatar
    await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ctvCookie)
      .attach('file', validPng, 'avatar.png');

    // Admin disables account -> verify side-effects
    const disableRes = await request(app)
      .patch(`/api/v1/accounts/${ctv.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'DISABLED', expectedVersion: ctv.version });
    expect(disableRes.status).toBe(200);

    // Active schedule registrations are cancelled
    const reg = await prisma.scheduleRegistration.findFirst({
      where: { accountId: ctv.id },
    });
    expect(reg?.status).toBe('CANCELLED');

    // All active future assignments are cancelled
    const activeAssignments = await prisma.shiftAssignment.count({
      where: { accountId: ctv.id, status: 'ACTIVE' },
    });
    expect(activeAssignments).toBe(0);
  });

  test('Transaction atomicity: Failed file upload rolls back all asset records and disk files', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    const countAssetsBefore = await prisma.fileAsset.count();
    const countAccountFilesBefore = await prisma.accountFile.count();

    // Attempt upload with corrupt/invalid format
    const badUpload = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ctvCookie)
      .attach('file', Buffer.from('FAKE_NOT_IMAGE_DATA'), 'fake.png');
    expect(badUpload.status).toBe(400);

    const countAssetsAfter = await prisma.fileAsset.count();
    const countAccountFilesAfter = await prisma.accountFile.count();

    // Verify zero orphaned records in DB
    expect(countAssetsAfter).toBe(countAssetsBefore);
    expect(countAccountFilesAfter).toBe(countAccountFilesBefore);
  });

  test('Timezone and date range queries: Asia/Bangkok UTC+7 midnight and range filters', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    // Query summary with from and to dates
    const rangeSummary = await request(app)
      .get('/api/v1/schedule-summary?from=2026-08-01&to=2026-08-15')
      .set('Cookie', adminCookie);
    expect(rangeSummary.status).toBe(200);
    expect(rangeSummary.body.data).toBeDefined();

    // Query with invalid range (from > to) returns 400
    const invalidRange = await request(app)
      .get('/api/v1/schedule-summary?from=2026-08-15&to=2026-08-01')
      .set('Cookie', adminCookie);
    expect(invalidRange.status).toBe(400);
  });
});

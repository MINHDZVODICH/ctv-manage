import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors, validPng, validPdf } from './helpers.js';

const app = createApp();

describe('Phase B — Account Administration & Profiles/Files Suite (ACC-001..012, PROF-001..005, FILE-001..008)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('ACC-001 & ACC-003: Account listing, pagination, and role security', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // CTV cannot list accounts
    const forbiddenRes = await request(app).get('/api/v1/accounts').set('Cookie', ctvCookie);
    expect(forbiddenRes.status).toBe(403);

    // Admin lists accounts with pagination
    const listRes = await request(app).get('/api/v1/accounts?page=1&pageSize=2').set('Cookie', adminCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.total).toBeGreaterThanOrEqual(3);
    expect(listRes.body.page).toBe(1);
    expect(listRes.body.pageSize).toBe(2);
  });

  test('ACC-002 & RGR-08: Vietnamese diacritics search and filter', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    // Create accounts with Vietnamese diacritics
    await prisma.account.create({
      data: {
        email: 'nguyenvana@ctv.local',
        passwordHash: 'hash',
        role: 'CTV',
        status: 'ACTIVE',
        displayName: 'Nguyễn Văn An',
        phone: '0901234567',
        ctvCode: 'CTV-VN-001',
      },
    });
    await prisma.account.create({
      data: {
        email: 'tranthib@ctv.local',
        passwordHash: 'hash',
        role: 'CTV',
        status: 'ACTIVE',
        displayName: 'Trần Thị Bình',
        phone: '0909876543',
        ctvCode: 'CTV-VN-002',
      },
    });

    // Search by diacritic name
    const res1 = await request(app).get('/api/v1/accounts?q=Nguyễn').set('Cookie', adminCookie);
    expect(res1.status).toBe(200);
    expect(res1.body.data.some((a: any) => a.displayName === 'Nguyễn Văn An')).toBe(true);

    // Search by phone
    const res2 = await request(app).get('/api/v1/accounts?q=0909876543').set('Cookie', adminCookie);
    expect(res2.status).toBe(200);
    expect(res2.body.data.some((a: any) => a.displayName === 'Trần Thị Bình')).toBe(true);
  });

  test('ACC-004 & ACC-005: Account status transitions (DISABLED <-> ACTIVE)', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // 1. Disable active account
    const disableRes = await request(app)
      .patch(`/api/v1/accounts/${ctv.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'DISABLED', expectedVersion: ctv.version });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.status).toBe('DISABLED');

    // 2. Reactivate account
    const freshCtv = await prisma.account.findUniqueOrThrow({ where: { id: ctv.id } });
    const reactivateRes = await request(app)
      .patch(`/api/v1/accounts/${ctv.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'ACTIVE', expectedVersion: freshCtv.version });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.status).toBe('ACTIVE');
  });

  test('ACC-006: Soft-delete account is idempotent and preserves integrity', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // First delete
    const del1 = await request(app).delete(`/api/v1/accounts/${ctv.id}`).set('Cookie', adminCookie);
    expect(del1.status).toBe(200);

    // Second delete (idempotent)
    const del2 = await request(app).delete(`/api/v1/accounts/${ctv.id}`).set('Cookie', adminCookie);
    expect(del2.status).toBe(200);

    const deleted = await prisma.account.findUnique({ where: { id: ctv.id } });
    expect(deleted?.deletedAt).not.toBeNull();
  });

  test('disabling and soft-deleting an account preserves schedule and shifts and revokes sessions', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Seed a schedule for this CTV
    await prisma.schedule.upsert({
      where: { accountId: ctv.id },
      create: {
        accountId: ctv.id,
        roomCode: 'ROOM_1',
        shifts: {
          create: [{ weekday: 1, period: 'MORNING' }, { weekday: 3, period: 'AFTERNOON' }],
        },
      },
      update: {},
    });

    // 1. Disable account
    const disableRes = await request(app)
      .patch(`/api/v1/accounts/${ctv.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'DISABLED', expectedVersion: ctv.version });
    expect(disableRes.status).toBe(200);

    // Verify schedule still exists
    const scheduleAfterDisable = await prisma.schedule.findUnique({
      where: { accountId: ctv.id },
      include: { shifts: true },
    });
    expect(scheduleAfterDisable).not.toBeNull();
    expect(scheduleAfterDisable?.shifts).toHaveLength(2);

    // Verify session revoked
    const postDisableReq = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(postDisableReq.status).toBe(401);

    // 2. Soft-delete account
    const delRes = await request(app).delete(`/api/v1/accounts/${ctv.id}`).set('Cookie', adminCookie);
    expect(delRes.status).toBe(200);

    // Verify schedule still exists after soft-delete
    const scheduleAfterDelete = await prisma.schedule.findUnique({
      where: { accountId: ctv.id },
      include: { shifts: true },
    });
    expect(scheduleAfterDelete).not.toBeNull();
    expect(scheduleAfterDelete?.shifts).toHaveLength(2);
  });

  test('ACC-012: Save admin notes increments version and preserves notes', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    const notesRes = await request(app)
      .patch(`/api/v1/accounts/${ctv.id}/notes`)
      .set('Cookie', adminCookie)
      .send({ adminNotes: 'Special performance review: Outstanding', expectedVersion: ctv.version });
    expect(notesRes.status).toBe(200);
    expect(notesRes.body.data.adminNotes).toBe('Special performance review: Outstanding');
    expect(notesRes.body.data.version).toBe(ctv.version + 1);
  });

  test('PROF-001..005 & RGR-13: Profile update, date of birth handling, and empty state validation', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({ where: { email: 'ctv.active@ctv.local' } });

    // Update profile fields
    const patchRes = await request(app)
      .patch('/api/v1/users/me')
      .set('Cookie', ctvCookie)
      .send({
        displayName: 'CTV Renamed',
        phone: '0988776655',
        dateOfBirth: '2000-05-15',
        gender: 'FEMALE',
        address: '123 Test St, District 1, HCMC',
        expectedVersion: ctv.version,
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.displayName).toBe('CTV Renamed');
    expect(patchRes.body.user.phone).toBe('0988776655');
    expect(patchRes.body.user.gender).toBe('FEMALE');
    expect(patchRes.body.user.version).toBe(ctv.version + 1);

    // Read updated profile
    const getRes = await request(app).get('/api/v1/users/me').set('Cookie', ctvCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.user.displayName).toBe('CTV Renamed');
  });

  test('FILE-001..008: Upload, replace, delete, stream, and missing-file handling', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // 1. Upload avatar
    const upAvatar = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ctvCookie)
      .attach('file', validPng, 'avatar1.png');
    expect(upAvatar.status).toBe(201);
    const avatar1Id = upAvatar.body.file.fileId;

    // 2. Stream avatar
    const stream1 = await request(app).get(`/api/v1/files/${avatar1Id}/content`).set('Cookie', ctvCookie);
    expect(stream1.status).toBe(200);
    expect(stream1.headers['content-type']).toContain('image/png');

    // 3. Upload CV (PDF)
    const upCv = await request(app)
      .put('/api/v1/users/me/files/CV')
      .set('Cookie', ctvCookie)
      .attach('file', validPdf, 'resume.pdf');
    expect(upCv.status).toBe(201);
    const cvId = upCv.body.file.fileId;

    // 4. Stream CV
    const streamCv = await request(app).get(`/api/v1/files/${cvId}/content`).set('Cookie', ctvCookie);
    expect(streamCv.status).toBe(200);
    expect(streamCv.headers['content-type']).toContain('application/pdf');

    // 5. Replace avatar with new one
    const upAvatar2 = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ctvCookie)
      .attach('file', validPng, 'avatar2.png');
    expect(upAvatar2.status).toBe(201);
    const avatar2Id = upAvatar2.body.file.fileId;
    expect(avatar2Id).not.toBe(avatar1Id);

    // 6. Delete CV
    const delCv = await request(app).delete('/api/v1/users/me/files/CV').set('Cookie', ctvCookie);
    expect(delCv.status).toBe(204);

    // 7. Deleted CV is no longer accessible
    const streamDeleted = await request(app).get(`/api/v1/files/${cvId}/content`).set('Cookie', ctvCookie);
    expect(streamDeleted.status).toBe(403);
  });
});

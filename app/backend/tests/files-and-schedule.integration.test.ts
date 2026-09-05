import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors, validPng } from './helpers.js';

const app = createApp();

describe('private files and schedule workflows', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('allows owner and ADMIN file access, denies another CTV and rejects spoofed files', async () => {
    const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const otherCookie = await loginCookie(app, 'ctv.other@ctv.local');
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    const invalid = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ownerCookie)
      .attach('file', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_FILE_TYPE');

    const uploaded = await request(app)
      .put('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ownerCookie)
      .attach('file', validPng, { filename: 'avatar.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    const fileId = uploaded.body.file.fileId;

    const profile = await request(app).get('/api/v1/users/me').set('Cookie', ownerCookie);
    expect(profile.status).toBe(200);
    expect(profile.body.user.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'AVATAR',
          fileId,
          file: expect.objectContaining({
            originalName: 'avatar.png',
            mimeType: 'image/png',
            sizeBytes: validPng.length,
          }),
        }),
      ]),
    );

    expect((await request(app).get(`/api/v1/files/${fileId}/content`).set('Cookie', ownerCookie)).status).toBe(200);
    expect((await request(app).get(`/api/v1/files/${fileId}/content`).set('Cookie', adminCookie)).status).toBe(200);
    expect((await request(app).get(`/api/v1/files/${fileId}/content`).set('Cookie', otherCookie)).status).toBe(403);

    const removed = await request(app)
      .delete('/api/v1/users/me/files/AVATAR')
      .set('Cookie', ownerCookie);
    expect(removed.status).toBe(204);
    expect((await request(app).get(`/api/v1/files/${fileId}/content`).set('Cookie', ownerCookie)).status).toBe(403);

    const profileAfterDelete = await request(app).get('/api/v1/users/me').set('Cookie', ownerCookie);
    expect(profileAfterDelete.body.user.files).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'AVATAR' })]),
    );
  });

  test('creates a CTV schedule, enforces ownership, summarizes and cancels an assignment', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const otherCookie = await loginCookie(app, 'ctv.other@ctv.local');
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    const invalid = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_9', slots: [] });
    expect(invalid.status).toBe(400);

    const registration = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(registration.status).toBe(200);
    expect(registration.body.data.patternSlots).toHaveLength(1);

    const shifts = await request(app).get('/api/v1/users/me/shifts').set('Cookie', ctvCookie);
    expect(shifts.status).toBe(200);
    expect(shifts.body.data.length).toBeGreaterThan(0);
    const assignment = shifts.body.data[0];

    const denied = await request(app).get(`/api/v1/shifts/${assignment.shiftId}`).set('Cookie', otherCookie);
    expect(denied.status).toBe(403);

    const detail = await request(app).get(`/api/v1/shifts/${assignment.shiftId}`).set('Cookie', adminCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.assignments[0].displayName).toBe('CTV Active');

    const month = assignment.workDate.slice(0, 7);
    const summary = await request(app)
      .get(`/api/v1/schedule-summary?month=${month}`)
      .set('Cookie', adminCookie);
    expect(summary.status).toBe(200);
    expect(summary.body.data.cells.some((cell: any) => cell.shiftId === assignment.shiftId)).toBe(true);

    const cancelled = await request(app)
      .delete(`/api/v1/users/me/shift-assignments/${assignment.id}`)
      .set('Cookie', ctvCookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.affectedCount).toBe(1);
  });

  test('preserves past work history when a CTV updates future schedule', async () => {
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctv = await prisma.account.findUniqueOrThrow({
      where: { email: 'ctv.active@ctv.local' },
    });

    const created = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({ roomCode: 'ROOM_1', slots: [{ weekday: 1, period: 'MORNING' }] });
    expect(created.status).toBe(200);

    const registrationId = created.body.data.id as string;
    const pastWorkDate = new Date('2024-01-08T00:00:00.000Z');
    const storedHistory = await prisma.history.create({
      data: {
        accountId: ctv.id,
        workDate: pastWorkDate,
        period: 'MORNING',
        roomCode: 'ROOM_1',
        status: 'COMPLETED',
      },
    });

    const updated = await request(app)
      .put('/api/v1/users/me/schedule-registration')
      .set('Cookie', ctvCookie)
      .send({
        roomCode: 'ROOM_2',
        slots: [{ weekday: 2, period: 'AFTERNOON' }],
        expectedVersion: created.body.data.version,
      });
    expect(updated.status).toBe(200);

    const checkedHistory = await prisma.history.findUniqueOrThrow({
      where: {
        accountId_workDate_period: {
          accountId: ctv.id,
          workDate: pastWorkDate,
          period: 'MORNING',
        },
      },
    });
    expect(checkedHistory.roomCode).toBe('ROOM_1');
    expect(checkedHistory.status).toBe('COMPLETED');

    const ownHistory = await request(app)
      .get('/api/v1/users/me/work-history?month=2024-01')
      .set('Cookie', ctvCookie);
    expect(ownHistory.status).toBe(200);
    expect(ownHistory.body.data.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workDate: '2024-01-08',
          period: 'MORNING',
          shiftAssignments: expect.arrayContaining([
            expect.objectContaining({
              id: storedHistory.id,
              accountId: ctv.id,
              roomCode: 'ROOM_1',
              status: 'COMPLETED',
            }),
          ]),
        }),
      ]),
    );

    const adminHistory = await request(app)
      .get(`/api/v1/work-history?month=2024-01&accountId=${ctv.id}`)
      .set('Cookie', adminCookie);
    expect(adminHistory.status).toBe(200);
    expect(adminHistory.body.data.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workDate: '2024-01-08',
          shiftAssignments: expect.arrayContaining([
            expect.objectContaining({ id: storedHistory.id, accountId: ctv.id }),
          ]),
        }),
      ]),
    );
  });
});

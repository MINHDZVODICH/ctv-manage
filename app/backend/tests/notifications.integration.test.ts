import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AccountRole, AccountStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { deriveCsrfToken } from '../src/shared/security.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

interface Actor { cookie: string; csrf: string; accountId: string }
const origin = 'http://localhost:5173';

describe.sequential('Notifications API', () => {
  let first: Actor;
  let second: Actor;
  beforeAll(async () => { await resetTestDatabase(prisma); first = await actor('notice-a@example.vn'); second = await actor('notice-b@example.vn'); });
  beforeEach(async () => { await prisma.notification.deleteMany(); });
  afterAll(async () => { await prisma.$disconnect(); });

  test('paginates the owner notifications newest first without internal fields', async () => {
    await prisma.notification.createMany({ data: [
      { accountId: first.accountId, type: 'APPROVED', title: 'Cũ', message: 'old', createdAt: new Date('2026-08-01T00:00:00.000Z') },
      { accountId: first.accountId, type: 'APPROVED', title: 'Mới', message: 'new', createdAt: new Date('2026-08-02T00:00:00.000Z') },
      { accountId: second.accountId, type: 'SECRET', title: 'Khác', message: 'hidden', sourceId: 'secret' },
    ] });
    const response = await request(createApp()).get('/api/v1/notifications?read=false&page=1&pageSize=1').set('Cookie', first.cookie);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.meta, { page: 1, pageSize: 1, total: 2 });
    assert.deepEqual(Object.keys(response.body.data[0]).sort(), ['createdAt', 'id', 'message', 'read', 'title', 'type']);
    assert.equal(response.body.data[0].title, 'Mới');
  });

  test('a user cannot change another account notification', async () => {
    const notice = await prisma.notification.create({ data: { accountId: first.accountId, type: 'APPROVED', title: 'Hồ sơ đã được duyệt', message: 'ok' } });
    const response = await patch(second, notice.id, true);
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'RESOURCE_NOT_FOUND');
  });

  test('changes only the owner notification state idempotently and requires CSRF and Origin', async () => {
    const notice = await prisma.notification.create({ data: { accountId: first.accountId, type: 'APPROVED', title: 'Hồ sơ đã được duyệt', message: 'ok' } });
    const app = createApp();
    const missingCsrf = await request(app).patch(`/api/v1/notifications/${notice.id}`).set('Origin', origin).set('Cookie', first.cookie).send({ read: true });
    assert.equal(missingCsrf.status, 403);
    const missingOrigin = await request(app).patch(`/api/v1/notifications/${notice.id}`).set('Cookie', first.cookie).set('X-CSRF-Token', first.csrf).send({ read: true });
    assert.equal(missingOrigin.status, 403);
    const firstPatch = await patch(first, notice.id, true, app);
    const secondPatch = await patch(first, notice.id, true, app);
    assert.equal(firstPatch.status, 200);
    assert.equal(secondPatch.status, 200);
    assert.equal(firstPatch.body.data.read, true);
    assert.equal(secondPatch.body.data.read, true);
    const unread = await request(app).get('/api/v1/notifications?read=false').set('Cookie', first.cookie);
    assert.equal(unread.body.meta.total, 0);
  });
});

async function actor(email: string): Promise<Actor> {
  const account = await prisma.account.create({ data: { email, displayName: email, role: AccountRole.CTV, status: AccountStatus.ACTIVE, passwordHash: 'not-used', mustChangePassword: false } });
  const raw = createHash('sha256').update(email).digest('base64url'); const hash = createHash('sha256').update(raw).digest('hex');
  await prisma.session.create({ data: { accountId: account.id, tokenHash: hash, expiresAt: new Date('2027-01-01T00:00:00.000Z') } });
  return { accountId: account.id, cookie: `ctv_session=${raw}`, csrf: deriveCsrfToken(hash, config.CSRF_SECRET) };
}
function patch(actor: Actor, id: string, read: boolean, app = createApp()) { return request(app).patch(`/api/v1/notifications/${id}`).set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).send({ read }); }

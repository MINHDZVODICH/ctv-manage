import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import { AccountRole, AccountStatus, FileAssetState, FileCategory } from '@prisma/client';
import { afterAll, beforeAll, describe, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { FileStorage } from '../src/shared/file-storage.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

const allowedOrigin = 'http://localhost:5173';
const password = 'Secret123';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
let storageRoot: string;
let storage: FileStorage;
let app: ReturnType<typeof createApp>;
let adminId: string;
let ctvAId: string;
let ctvBId: string;
let ctvAFileId: string;

describe.sequential('private account files API', () => {
  beforeAll(async () => {
    await resetTestDatabase(prisma);
    storageRoot = await mkdtemp(join(tmpdir(), 'ctv-account-files-'));
    storage = new FileStorage(storageRoot);
    app = createApp({ fileStorage: storage });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const [admin, ctvA, ctvB] = await Promise.all([
      prisma.account.create({ data: { email: 'admin-files@example.vn', passwordHash, role: AccountRole.ADMIN, status: AccountStatus.ACTIVE, displayName: 'Admin' } }),
      prisma.account.create({ data: { email: 'a@example.vn', passwordHash, role: AccountRole.CTV, status: AccountStatus.ACTIVE, displayName: 'CTV A' } }),
      prisma.account.create({ data: { email: 'b@example.vn', passwordHash, role: AccountRole.CTV, status: AccountStatus.ACTIVE, displayName: 'CTV B' } }),
    ]);
    adminId = admin.id; ctvAId = ctvA.id; ctvBId = ctvB.id;
    const staged = await storage.stage({ category: FileCategory.AVATAR, originalName: 'avatar.png', mimeType: 'image/png', buffer: png });
    await storage.finalize(staged);
    const { category: _category, ...fileData } = staged;
    const file = await prisma.fileAsset.create({ data: { ...fileData, state: FileAssetState.ACTIVE } });
    ctvAFileId = file.id;
    await prisma.accountFile.create({ data: { accountId: ctvA.id, fileId: file.id, category: FileCategory.AVATAR } });
  });

  afterAll(async () => { await prisma.$disconnect(); await rm(storageRoot, { recursive: true, force: true }); });

  test('a CTV cannot download another CTV file while Admin can', async () => {
    const ctvB = await login('b@example.vn');
    const admin = await login('admin-files@example.vn');
    assert.equal((await request(app).get(`/api/v1/files/${ctvAFileId}/content`).set('Cookie', ctvB.cookie)).status, 404);
    const allowed = await request(app).get(`/api/v1/files/${ctvAFileId}/content`).set('Cookie', admin.cookie);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers['content-type'], 'image/png');
    assert.match(allowed.headers['content-disposition'], /^inline; filename=/);
    assert.equal(allowed.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(allowed.body, png);
  });

  test('download rejects inactive metadata and physically missing files', async () => {
    const admin = await login('admin-files@example.vn');
    await prisma.fileAsset.update({ where: { id: ctvAFileId }, data: { state: FileAssetState.STAGED } });
    assert.equal((await request(app).get(`/api/v1/files/${ctvAFileId}/content`).set('Cookie', admin.cookie)).status, 404);
    await prisma.fileAsset.update({ where: { id: ctvAFileId }, data: { state: FileAssetState.ACTIVE } });
    const metadata = await prisma.fileAsset.findUniqueOrThrow({ where: { id: ctvAFileId } });
    await storage.remove(metadata.storageKey);
    assert.equal((await request(app).get(`/api/v1/files/${ctvAFileId}/content`).set('Cookie', admin.cookie)).status, 404);
  });

  test('owner can replace and idempotently delete a profile category', async () => {
    const ctvA = await login('a@example.vn');
    const replaced = await request(app)
      .put('/api/v1/users/me/files/avatar')
      .set('Cookie', ctvA.cookie).set('Origin', allowedOrigin).set('X-CSRF-Token', ctvA.csrf)
      .attach('file', png, { filename: 'new-avatar.png', contentType: 'image/png' });
    assert.equal(replaced.status, 200);
    assert.equal(replaced.body.data.category, 'AVATAR');
    assert.equal(JSON.stringify(replaced.body).includes('storageKey'), false);

    const removed = () => request(app).delete('/api/v1/users/me/files/avatar')
      .set('Cookie', ctvA.cookie).set('Origin', allowedOrigin).set('X-CSRF-Token', ctvA.csrf);
    assert.equal((await removed()).status, 204);
    assert.equal((await removed()).status, 204);
    assert.equal(await prisma.accountFile.count({ where: { accountId: ctvAId, category: FileCategory.AVATAR, deletedAt: null } }), 0);
  });

  test('Admin can replace a CTV file but owner-shaped misses stay 404', async () => {
    const admin = await login('admin-files@example.vn');
    const replaced = await request(app)
      .put(`/api/v1/accounts/${ctvBId}/files/avatar`)
      .set('Cookie', admin.cookie).set('Origin', allowedOrigin).set('X-CSRF-Token', admin.csrf)
      .attach('file', png, { filename: 'b.png', contentType: 'image/png' });
    assert.equal(replaced.status, 200);
    assert.equal(await prisma.accountFile.count({ where: { accountId: ctvBId, category: FileCategory.AVATAR, deletedAt: null } }), 1);

    const ctvA = await login('a@example.vn');
    const missing = await request(app).get(`/api/v1/files/${replaced.body.data.id}/content`).set('Cookie', ctvA.cookie);
    assert.equal(missing.status, 404);
    assert.notEqual(adminId, ctvAId);
  });

  test('only Admin can download an active pending-registration attachment', async () => {
    const staged = await storage.stage({ category: FileCategory.CV, originalName: 'pending.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n') });
    await storage.finalize(staged);
    const { category: _category, ...fileData } = staged;
    const registration = await prisma.registrationRequest.create({ data: {
      email: 'pending@example.vn', passwordHash: 'pending-hash', displayName: 'CTV Pending',
    } });
    const file = await prisma.fileAsset.create({ data: { ...fileData, state: FileAssetState.ACTIVE } });
    await prisma.registrationRequestFile.create({ data: { requestId: registration.id, fileId: file.id, category: FileCategory.CV } });
    const admin = await login('admin-files@example.vn');
    const ctvA = await login('a@example.vn');

    assert.equal((await request(app).get(`/api/v1/files/${file.id}/content`).set('Cookie', ctvA.cookie)).status, 404);
    assert.equal((await request(app).get(`/api/v1/files/${file.id}/content`).set('Cookie', admin.cookie)).status, 200);
  });
});

async function login(email: string): Promise<{ cookie: string; csrf: string }> {
  const response = await request(app).post('/api/v1/auth/sessions').set('Origin', allowedOrigin).send({ email, password });
  assert.equal(response.status, 201);
  const cookie = response.headers['set-cookie'][0];
  const csrf = await request(app).get('/api/v1/auth/csrf-token').set('Cookie', cookie);
  return { cookie, csrf: csrf.body.data.csrfToken };
}

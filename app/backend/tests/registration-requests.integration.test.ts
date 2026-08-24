import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import { AccountRole, AccountStatus, FileAssetState } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import request, { type Response } from 'supertest';
import { createApp } from '../src/app.js';
import { FileStorage } from '../src/shared/file-storage.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

const allowedOrigin = 'http://localhost:5173';
const password = 'Secret123';
const profile = {
  displayName: 'Nguyễn Văn A',
  email: 'ctv@example.vn',
  phone: '0900000000',
  dateOfBirth: '2000-01-01',
  gender: 'MALE',
  address: 'Hà Nội',
  password,
};

let storageRoot: string;
let app: ReturnType<typeof createApp>;

describe.sequential('registration request API', () => {
  beforeAll(async () => {
    await resetTestDatabase(prisma);
    storageRoot = await mkdtemp(join(tmpdir(), 'ctv-registration-'));
    app = createApp({ fileStorage: new FileStorage(storageRoot) });
    await Promise.all([
      createAccount('admin-a@example.vn', AccountRole.ADMIN, 'Admin A'),
      createAccount('admin-b@example.vn', AccountRole.ADMIN, 'Admin B'),
      createAccount('ctv-existing@example.vn', AccountRole.CTV, 'CTV Existing'),
    ]);
  });

  beforeEach(() => {
    app = createApp({ fileStorage: new FileStorage(storageRoot) });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(storageRoot, { recursive: true, force: true });
  });

  test('requires an allowlisted Origin and multipart media type for public submission', async () => {
    const missingOrigin = await submitRegistration('origin-missing', profile, false);
    assert.equal(missingOrigin.status, 403);
    assert.equal(missingOrigin.body.error.code, 'ORIGIN_NOT_ALLOWED');

    const wrongMedia = await request(app)
      .post('/api/v1/registration-requests')
      .set('Origin', allowedOrigin)
      .set('Idempotency-Key', 'wrong-media')
      .send(profile);
    assert.equal(wrongMedia.status, 415);
    assert.equal(wrongMedia.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  test('replays the same registration result for the same idempotency key and payload', async () => {
    const first = await submitRegistration('key-1', profile);
    const second = await submitRegistration('key-1', profile);

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.deepEqual(second.body, first.body);
    assert.equal(await prisma.registrationRequest.count({ where: { email: profile.email } }), 1);
    assert.equal(await prisma.idempotencyRecord.count(), 1);
    const idempotency = await prisma.idempotencyRecord.findFirstOrThrow();
    assert.equal((idempotency as unknown as { key?: string }).key, undefined);
    assert.match((idempotency as unknown as { keyHash: string }).keyHash, /^[a-f0-9]{64}$/);
    assert.equal((idempotency as unknown as { status: string }).status, 'COMPLETED');
    const storedPending = await prisma.registrationRequest.findFirstOrThrow({ where: { email: profile.email } });
    assert.match(storedPending.passwordHash, /^\$argon2id\$/);
    assert.equal(JSON.stringify(first.body).includes('password'), false);
    assert.equal(JSON.stringify(first.body).includes('storageKey'), false);
  });

  test('rejects reuse of an idempotency key with a different payload', async () => {
    const response = await submitRegistration('key-1', { ...profile, phone: '0911111111' });

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
  });

  test('validates attachment magic bytes before persisting metadata', async () => {
    const response = await request(app)
      .post('/api/v1/registration-requests')
      .set('Origin', allowedOrigin)
      .set('Idempotency-Key', 'bad-file')
      .field('profile', JSON.stringify({ ...profile, email: 'bad-file@example.vn' }))
      .attach('cccdFront', Buffer.from('not really an image'), { filename: 'cccd.png', contentType: 'image/png' });

    assert.equal(response.status, 415);
    assert.equal(response.body.error.code, 'UNSUPPORTED_FILE_TYPE');
    assert.equal(await prisma.registrationRequest.count({ where: { email: 'bad-file@example.vn' } }), 0);
    assert.equal(await prisma.fileAsset.count(), 0);
  });

  test('rejects a missing required phone and an impossible calendar date', async () => {
    const missingPhone = await submitRegistration('missing-phone', {
      ...profile,
      email: 'missing-phone@example.vn',
      phone: '',
    });
    assert.equal(missingPhone.status, 422);
    assert.equal(missingPhone.body.error.code, 'VALIDATION_FAILED');

    const impossibleDate = await submitRegistration('impossible-date', {
      ...profile,
      email: 'impossible-date@example.vn',
      dateOfBirth: '2026-02-31',
    });
    assert.equal(impossibleDate.status, 422);
    assert.equal(impossibleDate.body.error.code, 'VALIDATION_FAILED');
  });

  test('rejects an email that already belongs to an account', async () => {
    const response = await submitRegistration('existing-email', {
      ...profile,
      email: 'ctv-existing@example.vn',
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'EMAIL_ALREADY_REGISTERED');
    assert.equal(await prisma.registrationRequest.count({ where: { email: 'ctv-existing@example.vn' } }), 0);
  });

  test('Admin list and detail require ADMIN and omit password hashes and storage keys', async () => {
    const anonymous = await request(app).get('/api/v1/registration-requests');
    assert.equal(anonymous.status, 401);

    const ctv = await login('ctv-existing@example.vn');
    const forbidden = await request(app).get('/api/v1/registration-requests').set('Cookie', ctv.cookie);
    assert.equal(forbidden.status, 403);

    const admin = await login('admin-a@example.vn');
    const list = await request(app)
      .get('/api/v1/registration-requests?status=PENDING&page=1&pageSize=20&q=Nguy%E1%BB%85n')
      .set('Cookie', admin.cookie);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items.length, 1);
    assert.equal(list.body.data.pagination.total, 1);
    assertNoSecrets(list.body);

    const detail = await request(app)
      .get(`/api/v1/registration-requests/${list.body.data.items[0].id}`)
      .set('Cookie', admin.cookie);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.displayName, profile.displayName);
    assertNoSecrets(detail.body);
  });

  test('only one Admin can approve a pending request', async () => {
    const submitted = await submitRegistration('concurrent-approval', {
      ...profile,
      email: 'approved@example.vn',
    }, true, true);
    assert.equal(submitted.status, 201);
    const [adminA, adminB] = await Promise.all([login('admin-a@example.vn'), login('admin-b@example.vn')]);

    const [a, b] = await Promise.all([
      decide(submitted.body.data.id, adminA, 'APPROVED'),
      decide(submitted.body.data.id, adminB, 'APPROVED'),
    ]);

    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal(await prisma.account.count({ where: { email: 'approved@example.vn' } }), 1);
    const storedRequest = await prisma.registrationRequest.findUniqueOrThrow({
      where: { id: submitted.body.data.id },
      include: { files: true },
    });
    assert.equal(storedRequest.status, 'APPROVED');
    assert.equal(storedRequest.passwordHash, '');
    assert.ok(storedRequest.approvedAccountId);
    assert.equal(await prisma.accountFile.count({ where: { accountId: storedRequest.approvedAccountId! } }), 1);
    assert.equal(await prisma.notification.count({ where: { accountId: storedRequest.approvedAccountId! } }), 1);
    assert.equal(await prisma.fileAsset.count({ where: { state: FileAssetState.ACTIVE } }), 1);
    assertNoSecrets(a.status === 200 ? a.body : b.body);
  });

  test('approval rejects a request whose ACTIVE file bytes are unavailable', async () => {
    const submitted = await submitRegistration('missing-approved-file', {
      ...profile,
      email: 'missing-approved-file@example.vn',
    }, true, true);
    assert.equal(submitted.status, 201);
    const linked = await prisma.registrationRequestFile.findFirstOrThrow({
      where: { requestId: submitted.body.data.id },
      include: { file: true },
    });
    await new FileStorage(storageRoot).remove(linked.file.storageKey);
    const admin = await login('admin-a@example.vn');

    const response = await decide(submitted.body.data.id, admin, 'APPROVED');

    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'REGISTRATION_FILES_UNAVAILABLE');
    assert.equal(await prisma.account.count({ where: { email: 'missing-approved-file@example.vn' } }), 0);
    const unchanged = await prisma.registrationRequest.findUniqueOrThrow({ where: { id: submitted.body.data.id } });
    assert.equal(unchanged.status, 'PENDING');
    assert.match(unchanged.passwordHash, /^\$argon2id\$/);
  });

  test('authenticated decision mutation requires CSRF and rejection creates no account', async () => {
    const submitted = await submitRegistration('reject-request', {
      ...profile,
      email: 'rejected@example.vn',
    });
    const admin = await login('admin-a@example.vn');
    const missingCsrf = await request(app)
      .patch(`/api/v1/registration-requests/${submitted.body.data.id}`)
      .set('Origin', allowedOrigin)
      .set('Cookie', admin.cookie)
      .send({ decision: 'REJECTED', expectedStatus: 'PENDING' });
    assert.equal(missingCsrf.status, 403);
    assert.equal(missingCsrf.body.error.code, 'CSRF_INVALID');

    const rejected = await decide(submitted.body.data.id, admin, 'REJECTED');
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.status, 'REJECTED');
    assert.equal(await prisma.account.count({ where: { email: 'rejected@example.vn' } }), 0);
    const stored = await prisma.registrationRequest.findUniqueOrThrow({ where: { id: submitted.body.data.id } });
    assert.equal(stored.passwordHash, '');
  });
});

async function createAccount(email: string, role: AccountRole, displayName: string): Promise<void> {
  await prisma.account.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role,
      status: AccountStatus.ACTIVE,
      mustChangePassword: false,
      displayName,
    },
  });
}

async function submitRegistration(
  key: string,
  submittedProfile: typeof profile,
  includeOrigin = true,
  includeFile = false,
): Promise<Response> {
  let submission = request(app).post('/api/v1/registration-requests').set('Idempotency-Key', key);
  if (includeOrigin) submission = submission.set('Origin', allowedOrigin);
  submission = submission.field('profile', JSON.stringify(submittedProfile));
  if (includeFile) {
    submission = submission.attach('cccdFront', validPng(), { filename: 'cccd.png', contentType: 'image/png' });
  }
  return submission;
}

async function login(email: string): Promise<{ cookie: string; csrf: string }> {
  const session = await request(app)
    .post('/api/v1/auth/sessions')
    .set('Origin', allowedOrigin)
    .send({ email, password });
  assert.equal(session.status, 201);
  const cookie = session.headers['set-cookie'][0];
  const csrf = await request(app).get('/api/v1/auth/csrf-token').set('Cookie', cookie);
  assert.equal(csrf.status, 200);
  return { cookie, csrf: csrf.body.data.csrfToken };
}

async function decide(
  requestId: string,
  admin: { cookie: string; csrf: string },
  decision: 'APPROVED' | 'REJECTED',
): Promise<Response> {
  return request(app)
    .patch(`/api/v1/registration-requests/${requestId}`)
    .set('Origin', allowedOrigin)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .send({ decision, expectedStatus: 'PENDING' });
}

function assertNoSecrets(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('storageKey'), false);
}

function validPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import { AccountRole, AccountStatus, FileCategory, FileAssetState, RoomCode, ScheduleRegistrationStatus, ShiftAssignmentStatus, ShiftPeriod, ShiftStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, test } from 'vitest';
import request, { type Response, type Test } from 'supertest';
import { createApp } from '../src/app.js';
import { FileStorage } from '../src/shared/file-storage.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

const origin = 'http://localhost:5173';
const password = 'Secret123';
let app = createApp({ now: () => new Date('2026-08-25T10:00:00.000Z') });
let admin: Actor; let ctv: Actor; let other: Actor;
let ctvId: string; let pendingId: string; let fileId: string; let assignmentId: string; let registrationId: string; let shiftId: string; let notificationId: string; let storageRoot: string;

describe.sequential('API_SPEC documented endpoint contract', () => {
  beforeAll(async () => {
    await resetTestDatabase(prisma);
    storageRoot = await mkdtemp(join(tmpdir(), 'ctv-contract-'));
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const [adminAccount, ctvAccount, otherAccount] = await Promise.all([
      prisma.account.create({ data: { email: 'admin.contract@example.vn', passwordHash: hash, role: AccountRole.ADMIN, status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: 'Quản trị viên' } }),
      prisma.account.create({ data: { email: 'ctv.contract@example.vn', passwordHash: hash, role: AccountRole.CTV, status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: 'Nguyễn Văn A', phone: '0900000000' } }),
      prisma.account.create({ data: { email: 'other.contract@example.vn', passwordHash: hash, role: AccountRole.CTV, status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: 'CTV khác' } }),
    ]);
    ctvId = ctvAccount.id;
    const pending = await prisma.registrationRequest.create({ data: { email: 'pending.contract@example.vn', passwordHash: hash, displayName: 'Hồ sơ chờ duyệt', phone: '0912345678' } });
    pendingId = pending.id;
    const registration = await prisma.scheduleRegistration.create({ data: { accountId: ctvAccount.id, startDate: new Date('2026-08-24'), endDate: new Date('2026-09-30'), timeZone: 'Asia/Bangkok', roomCode: RoomCode.ROOM_1, workContent: 'Hỗ trợ dữ liệu', status: ScheduleRegistrationStatus.ACTIVE, patternSlots: { create: { weekday: 1, period: ShiftPeriod.MORNING } } } });
    registrationId = registration.id;
    const shift = await prisma.shift.create({ data: { workDate: new Date('2026-08-31'), period: ShiftPeriod.MORNING, status: ShiftStatus.OPEN } });
    shiftId = shift.id;
    const assignment = await prisma.shiftAssignment.create({ data: { shiftId: shift.id, accountId: ctvAccount.id, registrationId: registration.id, roomCode: RoomCode.ROOM_1, workContent: 'Hỗ trợ dữ liệu', status: ShiftAssignmentStatus.ACTIVE } });
    assignmentId = assignment.id;
    const bytes = validPng(); const storage = new FileStorage(storageRoot); const staged = await storage.stage({ category: FileCategory.AVATAR, originalName: 'avatar.png', mimeType: 'image/png', buffer: bytes }, '0123456789abcdef0123456789abcdef0123456789abcdef.png'); await storage.finalize(staged);
    const { category: _category, ...fileData } = staged;
    const file = await prisma.fileAsset.create({ data: { ...fileData, state: FileAssetState.ACTIVE } }); fileId = file.id;
    await prisma.accountFile.create({ data: { accountId: ctvAccount.id, fileId: file.id, category: FileCategory.AVATAR } });
    const notification = await prisma.notification.create({ data: { accountId: ctvAccount.id, type: 'TEST', title: 'Thông báo kiểm thử', message: 'Nội dung' } }); notificationId = notification.id;
    app = createApp({ now: () => new Date('2026-08-25T10:00:00.000Z'), fileStorage: storage });
    admin = await login(adminAccount.email); ctv = await login(ctvAccount.email); other = await login(otherAccount.email);
  });

  afterAll(async () => { await prisma.$disconnect(); await rm(storageRoot, { recursive: true, force: true }); });

  test('every API_SPEC endpoint has its documented success envelope and anonymous or wrong-role denial', async () => {
    const client = request(app);
    const endpoints: Endpoint[] = [
      endpoint('POST /auth/sessions', () => client.post('/api/v1/auth/sessions').set('Origin', origin).send({ email: 'admin.contract@example.vn', password }), 201, 'public'),
      endpoint('GET /auth/sessions/current', () => client.get('/api/v1/auth/sessions/current').set('Cookie', admin.cookie), 200, 'session'),
      endpoint('DELETE /auth/sessions/current', async () => { const actor = await login('other.contract@example.vn'); return mutate(client.delete('/api/v1/auth/sessions/current'), actor); }, 204, 'session'),
      endpoint('GET /auth/csrf-token', () => client.get('/api/v1/auth/csrf-token').set('Cookie', admin.cookie), 200, 'session'),
      endpoint('POST /registration-requests', () => client.post('/api/v1/registration-requests').set('Origin', origin).set('Idempotency-Key', 'contract-public-registration').field('profile', JSON.stringify({ displayName: 'Đăng ký hợp đồng', email: 'new.contract@example.vn', phone: '0933333333', dateOfBirth: '2000-01-01', gender: 'MALE', address: 'Hà Nội', password })), 201, 'public'),
      endpoint('GET /registration-requests', () => client.get('/api/v1/registration-requests?page=1&pageSize=5').set('Cookie', admin.cookie), 200, 'admin'),
      endpoint('GET /registration-requests/{requestId}', () => client.get(`/api/v1/registration-requests/${pendingId}`).set('Cookie', admin.cookie), 200, 'admin'),
      endpoint('PATCH /registration-requests/{requestId}', () => mutate(client.patch(`/api/v1/registration-requests/${pendingId}`).send({ decision: 'REJECTED', expectedStatus: 'PENDING' }), admin), 200, 'admin'),
      endpoint('GET /accounts', () => client.get('/api/v1/accounts?page=1&pageSize=5').set('Cookie', admin.cookie), 200, 'admin'),
      endpoint('GET /accounts/{accountId}', () => client.get(`/api/v1/accounts/${ctvId}`).set('Cookie', admin.cookie), 200, 'admin'),
      endpoint('PATCH /accounts/{accountId}', async () => mutate(client.patch(`/api/v1/accounts/${ctvId}`).send({ displayName: 'Nguyễn Văn A', version: (await accountVersion(ctvId)) }), admin), 200, 'admin'),
      endpoint('PATCH /accounts/{accountId}/status', async () => { const subject = await createCtv('status.contract@example.vn'); return mutate(client.patch(`/api/v1/accounts/${subject.id}/status`).send({ status: 'DISABLED', version: subject.version }), admin); }, 200, 'admin'),
      endpoint('DELETE /accounts/{accountId}', async () => { const subject = await createCtv('delete.contract@example.vn'); return mutate(client.delete(`/api/v1/accounts/${subject.id}`), admin); }, 204, 'admin'),
      endpoint('PATCH /accounts/{accountId}/notes', async () => mutate(client.patch(`/api/v1/accounts/${ctvId}/notes`).send({ notes: 'Ghi chú kiểm thử', version: await accountVersion(ctvId) }), admin), 200, 'admin'),
      endpoint('GET /users/me', () => client.get('/api/v1/users/me').set('Cookie', ctv.cookie), 200, 'session'),
      endpoint('PATCH /users/me', async () => mutate(client.patch('/api/v1/users/me').send({ displayName: 'Nguyễn Văn A', version: await accountVersion(ctvId) }), ctv), 200, 'session'),
      endpoint('POST /users/me/password-changes', async () => { const subject = await createCtv('password.contract@example.vn'); const actor = await login(subject.email); return mutate(client.post('/api/v1/users/me/password-changes').send({ currentPassword: password, newPassword: 'Changed123' }), actor); }, 200, 'session'),
      endpoint('POST /accounts/{accountId}/password-resets', async () => { const subject = await createCtv('reset.contract@example.vn'); return mutate(client.post(`/api/v1/accounts/${subject.id}/password-resets`).set('Idempotency-Key', 'contract-reset').send({ newPassword: 'Changed123', requireChangeOnLogin: true }), admin); }, 200, 'admin'),
      endpoint('GET /files/{fileId}/content', () => client.get(`/api/v1/files/${fileId}/content`).set('Cookie', ctv.cookie), 200, 'owner', false),
      endpoint('PUT /users/me/files/{category}', () => mutate(client.put('/api/v1/users/me/files/avatar').attach('file', validPng(), { filename: 'new.png', contentType: 'image/png' }), ctv), 200, 'session'),
      endpoint('DELETE /users/me/files/{category}', () => mutate(client.delete('/api/v1/users/me/files/avatar'), ctv), 204, 'session'),
      endpoint('PUT /accounts/{accountId}/files/{category}', () => mutate(client.put(`/api/v1/accounts/${ctvId}/files/avatar`).attach('file', validPng(), { filename: 'admin.png', contentType: 'image/png' }), admin), 200, 'admin'),
      endpoint('DELETE /accounts/{accountId}/files/{category}', () => mutate(client.delete(`/api/v1/accounts/${ctvId}/files/avatar`), admin), 204, 'admin'),
      endpoint('GET /users/me/schedule-registration', () => client.get('/api/v1/users/me/schedule-registration').set('Cookie', ctv.cookie), 200, 'ctv'),
      endpoint('PUT /users/me/schedule-registration', () => mutate(client.put('/api/v1/users/me/schedule-registration').send({ startDate: '2026-08-24', endDate: '2026-09-30', timeZone: 'Asia/Bangkok', roomCode: 'ROOM_1', workContent: 'Hỗ trợ dữ liệu', slots: [{ weekday: 1, period: 'MORNING' }], version: 1 }), ctv), 200, 'ctv'),
      endpoint('GET /users/me/shifts', () => client.get('/api/v1/users/me/shifts?from=2026-08-24&to=2026-09-04').set('Cookie', ctv.cookie), 200, 'ctv'),
      endpoint('GET /shifts/{shiftId}', () => client.get(`/api/v1/shifts/${shiftId}`).set('Cookie', ctv.cookie), 200, 'owner'),
      endpoint('DELETE /users/me/shift-assignments/{assignmentId}', () => mutate(client.delete(`/api/v1/users/me/shift-assignments/${assignmentId}`), ctv), 200, 'ctv'),
      endpoint('DELETE /users/me/schedule-registrations/{registrationId}/assignments', () => mutate(client.delete(`/api/v1/users/me/schedule-registrations/${registrationId}/assignments?weekday=1&period=MORNING&fromDate=2026-08-31`), ctv), 200, 'ctv'),
      endpoint('GET /schedule-summary', () => client.get('/api/v1/schedule-summary?month=2026-08').set('Cookie', admin.cookie), 200, 'admin'),
      endpoint('GET /notifications', () => client.get('/api/v1/notifications?read=false&page=1&pageSize=5').set('Cookie', ctv.cookie), 200, 'session'),
      endpoint('PATCH /notifications/{notificationId}', () => mutate(client.patch(`/api/v1/notifications/${notificationId}`).send({ read: true }), ctv), 200, 'owner'),
    ];
    assert.equal(endpoints.length, 32, 'keep this matrix synchronized with docs/API_SPEC.md endpoint tables');
    for (const entry of endpoints) {
      const happy = await entry.happy();
      assert.equal(happy.status, entry.success, `${entry.name} must preserve documented success status`);
      if (entry.envelope) assert.ok(happy.body.data !== undefined, `${entry.name} must use the { data } envelope`);
      if (entry.access !== 'public' && entry.name !== 'DELETE /auth/sessions/current') {
        const anonymous = await anonymousFor(client, entry.name);
        assert.equal(anonymous.status, 401, `${entry.name} must deny an anonymous request`);
      }
      if (entry.access === 'admin' || entry.access === 'ctv' || entry.access === 'owner') {
        const forbidden = await wrongActorFor(client, entry.name);
        assert.ok([403, 404].includes(forbidden.status), `${entry.name} must be owner/role-safe`);
      }
    }
  });
});

interface Actor { cookie: string; csrf: string }
interface Endpoint { name: string; happy: () => Promise<Response>; success: number; access: 'public' | 'session' | 'admin' | 'ctv' | 'owner'; envelope: boolean }
function endpoint(name: string, happy: () => Promise<Response>, success: number, access: Endpoint['access'], envelope = success !== 204): Endpoint { return { name, happy, success, access, envelope }; }
async function login(email: string): Promise<Actor> { const result = await request(app).post('/api/v1/auth/sessions').set('Origin', origin).send({ email, password }); assert.equal(result.status, 201); const cookie = result.headers['set-cookie'][0]; const csrf = await request(app).get('/api/v1/auth/csrf-token').set('Cookie', cookie); return { cookie, csrf: csrf.body.data.csrfToken }; }
function mutate(testRequest: Test, actor: Actor): Promise<Response> { return testRequest.set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf); }
async function accountVersion(id: string): Promise<number> { return (await prisma.account.findUniqueOrThrow({ where: { id } })).version; }
async function createCtv(email: string) { return prisma.account.create({ data: { email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: AccountRole.CTV, status: AccountStatus.ACTIVE, mustChangePassword: false, displayName: email, } }); }
function validPng() { return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]); }
async function anonymousFor(client: ReturnType<typeof request>, name: string): Promise<Response> { const [method, path] = name.split(' '); const url = `/api/v1${path.replace(/\{[^}]+\}/g, 'missing')}`; return client[method.toLowerCase() as 'get'](url); }
async function wrongActorFor(client: ReturnType<typeof request>, name: string): Promise<Response> { const path = `/api/v1${name.split(' ')[1].replace('{requestId}', pendingId).replace('{accountId}', ctvId).replace('{fileId}', fileId).replace('{category}', 'avatar').replace('{shiftId}', shiftId).replace('{assignmentId}', assignmentId).replace('{registrationId}', registrationId).replace('{notificationId}', notificationId)}`; const method = name.split(' ')[0].toLowerCase() as 'get'; const actor = name.includes('schedule-summary') || name.includes('/accounts') || name.includes('registration-requests') ? ctv : name.startsWith('GET /shifts') ? other : name.includes('schedule-registration') || name.includes('users/me/shifts') || name.includes('shift-assignments') || name.includes('schedule-registrations') ? admin : other; return client[method](path).set('Cookie', actor.cookie); }

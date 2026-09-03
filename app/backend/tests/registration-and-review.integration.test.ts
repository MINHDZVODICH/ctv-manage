import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { loginCookie, resetDatabase, seedActors, TEST_PASSWORD, validPdf, validPng } from './helpers.js';

const app = createApp();

describe('Phase B — Public Registration & Review Suite (REG-001..010, REV-001..009)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('REG-001: Field validations (missing required, invalid phone, invalid email, weak password)', async () => {
    // Missing email
    const res1 = await request(app)
      .post('/api/v1/registration-requests')
      .field('displayName', 'Nguyen Van A')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD);
    expect(res1.status).toBe(400);

    // Invalid phone
    const res2 = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.a@ctv.local')
      .field('displayName', 'Nguyen Van A')
      .field('phone', '123')
      .field('password', TEST_PASSWORD);
    expect(res2.status).toBe(400);

    // Password too short (< 6 chars)
    const res3 = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.a@ctv.local')
      .field('displayName', 'Nguyen Van A')
      .field('phone', '0901234567')
      .field('password', '12345');
    expect(res3.status).toBe(400);
  });

  test('REG-002: Valid registration without files creates PENDING request', async () => {
    const res = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.nofiles@ctv.local')
      .field('displayName', 'Applicant No Files')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD);
    expect(res.status).toBe(201);
    expect(res.body.request).toBeDefined();
    expect(res.body.request.status).toBe('PENDING');
    expect(res.body.request.files).toHaveLength(0);

    const saved = await prisma.registrationRequest.findUnique({ where: { id: res.body.request.id } });
    expect(saved).not.toBeNull();
    expect(saved?.passwordHash).not.toBeNull();
  });

  test('REG-003 & REG-007: Registration with valid files and mime validation', async () => {
    // 1. Invalid file mime / fake extension
    const invalidFileRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.badfile@ctv.local')
      .field('displayName', 'Applicant Bad File')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', Buffer.from('NOT_A_REAL_IMAGE_DATA'), 'fake.png');
    expect(invalidFileRes.status).toBe(400);

    // 2. Valid files (cccdFront, cccdBack, cv)
    const validRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.withfiles@ctv.local')
      .field('displayName', 'Applicant With Files')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', validPng, 'cccd-front.png')
      .attach('cccdBack', validPng, 'cccd-back.png')
      .attach('cv', validPdf, 'resume.pdf');
    expect(validRes.status).toBe(201);
    expect(validRes.body.request.files).toHaveLength(3);
  });

  test('REG-004: Duplicate active account or pending request rejection', async () => {
    // 1. Duplicate of existing active account (case-insensitive)
    const dupActiveRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'CTV.ACTIVE@ctv.local')
      .field('displayName', 'Duplicate CTV')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD);
    expect(dupActiveRes.status).toBe(409);

    // 2. First submission
    const firstRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.pending@ctv.local')
      .field('displayName', 'Applicant Pending')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD);
    expect(firstRes.status).toBe(201);

    // 3. Second submission with same pending email -> 409
    const secondRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.pending@ctv.local')
      .field('displayName', 'Applicant Duplicate')
      .field('phone', '0901234568')
      .field('password', TEST_PASSWORD);
    expect(secondRes.status).toBe(409);
  });

  test('REV-001 & REV-002: Review endpoints authorization and search/pagination', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
    const ctvCookie = await loginCookie(app, 'ctv.active@ctv.local');

    // Create 3 pending requests
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post('/api/v1/registration-requests')
        .field('email', `applicant.${i}@ctv.local`)
        .field('displayName', `Applicant Number ${i}`)
        .field('phone', `090111100${i}`)
        .field('password', TEST_PASSWORD);
    }

    // 1. CTV is forbidden
    const ctvList = await request(app).get('/api/v1/registration-requests').set('Cookie', ctvCookie);
    expect(ctvList.status).toBe(403);

    // 2. Admin can list requests with pagination
    const adminList = await request(app).get('/api/v1/registration-requests?page=1&pageSize=2').set('Cookie', adminCookie);
    expect(adminList.status).toBe(200);
    expect(adminList.body.items).toHaveLength(2);
    expect(adminList.body.total).toBe(3);

    // 3. Admin can search by name or email
    const searchRes = await request(app).get('/api/v1/registration-requests?q=Number 2').set('Cookie', adminCookie);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.items).toHaveLength(1);
    expect(searchRes.body.items[0].displayName).toBe('Applicant Number 2');
  });

  test('REV-004: Approval workflow creates ACTIVE account with unique ctvCode and transitions files', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    // Submit registration with files
    const regRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.approved@ctv.local')
      .field('displayName', 'Applicant To Approve')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', validPng, 'cccd-front.png');
    expect(regRes.status).toBe(201);
    const requestId = regRes.body.request.id;

    // Admin approves
    const approveRes = await request(app)
      .patch(`/api/v1/registration-requests/${requestId}`)
      .set('Cookie', adminCookie)
      .send({ decision: 'APPROVED', expectedStatus: 'PENDING' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.request.status).toBe('APPROVED');
    expect(approveRes.body.request.approvedAccount).toBeDefined();
    expect(approveRes.body.request.approvedAccount.ctvCode).toMatch(/^CTV-\d{4}-\d{3}$/);

    // Account exists in database and is ACTIVE
    const newAccount = await prisma.account.findUnique({
      where: { email: 'applicant.approved@ctv.local' },
      include: { accountFiles: { include: { fileAsset: true } } },
    });
    expect(newAccount).not.toBeNull();
    expect(newAccount?.status).toBe('ACTIVE');
    expect(newAccount?.accountFiles).toHaveLength(1);
    expect(newAccount?.accountFiles[0].fileAsset.state).toBe('ACTIVE');

    // Password hash was cleared on registration request
    const requestAfter = await prisma.registrationRequest.findUnique({ where: { id: requestId } });
    expect(requestAfter?.passwordHash).toBeNull();

    // New account can log in immediately
    const loginRes = await request(app)
      .post('/api/v1/auth/sessions')
      .send({ email: 'applicant.approved@ctv.local', password: TEST_PASSWORD });
    expect(loginRes.status).toBe(201);
  });

  test('REV-005: Rejection workflow records reason, reviewer and clears passwordHash', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    // Submit registration
    const regRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.rejected@ctv.local')
      .field('displayName', 'Applicant To Reject')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD);
    expect(regRes.status).toBe(201);
    const requestId = regRes.body.request.id;

    // Admin rejects
    const rejectRes = await request(app)
      .patch(`/api/v1/registration-requests/${requestId}`)
      .set('Cookie', adminCookie)
      .send({ decision: 'REJECTED', expectedStatus: 'PENDING', rejectionReason: 'Hồ sơ chưa đủ thông tin' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.request.status).toBe('REJECTED');
    expect(rejectRes.body.request.rejectionReason).toBe('Hồ sơ chưa đủ thông tin');

    // Request in database has no passwordHash
    const saved = await prisma.registrationRequest.findUnique({ where: { id: requestId } });
    expect(saved?.passwordHash).toBeNull();

    // No account created
    const noAccount = await prisma.account.findUnique({ where: { email: 'applicant.rejected@ctv.local' } });
    expect(noAccount).toBeNull();
  });

  test('REV-006: Stale decision on already processed request returns 409 Conflict', async () => {
    const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');

    const regRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.conflict@ctv.local')
      .field('displayName', 'Applicant Conflict')
      .field('phone', '0901234567')
      .field('password', TEST_PASSWORD);
    const requestId = regRes.body.request.id;

    // First decision: approve
    const firstDecision = await request(app)
      .patch(`/api/v1/registration-requests/${requestId}`)
      .set('Cookie', adminCookie)
      .send({ decision: 'APPROVED', expectedStatus: 'PENDING' });
    expect(firstDecision.status).toBe(200);

    // Second decision on already approved request -> 409 Conflict
    const secondDecision = await request(app)
      .patch(`/api/v1/registration-requests/${requestId}`)
      .set('Cookie', adminCookie)
      .send({ decision: 'REJECTED', expectedStatus: 'PENDING', rejectionReason: 'Too late' });
    expect(secondDecision.status).toBe(409);
  });
});

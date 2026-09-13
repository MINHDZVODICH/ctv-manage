import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { registrationFileService } from '../src/modules/registration/registration-file.service.js';
import {
  fileExists,
  saveBufferToFile,
  generateCuid,
  buildStorageKey,
  sha256Of,
  getBaseDir,
  getStoragePath,
} from '../src/shared/fileStorage.js';
import { loginCookie, resetDatabase, seedActors, TEST_PASSWORD, validPng } from './helpers.js';

const app = createApp();

describe('Registration Concurrency & Race Condition Safeguards (ISSUES 1, 2, 3, 4, 12, 13, 16, 17)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedActors();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Issue 1 & 12: Concurrent duplicate registration submissions — exactly 1 succeeds, all others 409 with file cleanup', async () => {
    const email = 'concurrent.applicant@ctv.local';
    const numRequests = 4; // within IP rate limit window of 5

    const attemptedKeys: string[] = [];
    const origSave = registrationFileService.saveFilesToStorage.bind(registrationFileService);
    const saveSpy = vi
      .spyOn(registrationFileService, 'saveFilesToStorage')
      .mockImplementation(async (entries) => {
        attemptedKeys.push(...entries.map((e) => e.storageKey));
        return origSave(entries);
      });

    try {
      const submissionPromises = Array.from({ length: numRequests }, (_, idx) =>
        request(app)
          .post('/api/v1/registration-requests')
          .field('email', email)
          .field('displayName', `Applicant Concurrent ${idx}`)
          .field('phone', `090123456${idx}`)
          .field('password', TEST_PASSWORD)
          .attach('cccdFront', validPng, `cccd-${idx}.png`),
      );

      const responses = await Promise.all(submissionPromises);

      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(numRequests - 1);

      for (const conflict of conflicts) {
        expect(conflict.body.error?.code).toBe('EMAIL_ALREADY_EXISTS');
      }

      // Exactly 1 PENDING request in database
      const dbRequests = await prisma.registrationRequest.findMany({
        where: { email },
        include: { files: { include: { fileAsset: true } } },
      });
      expect(dbRequests).toHaveLength(1);
      expect(dbRequests[0].status).toBe('PENDING');

      // Verify successful request file exists on disk
      const stagedFile = dbRequests[0].files[0];
      expect(stagedFile).toBeDefined();
      const winnerKey = stagedFile.fileAsset.storageKey;
      expect(await fileExists(winnerKey)).toBe(true);

      // Verify attempted keys were captured for all requests
      expect(attemptedKeys).toHaveLength(numRequests);
      const loserKeys = attemptedKeys.filter((k) => k !== winnerKey);
      expect(loserKeys).toHaveLength(numRequests - 1);

      // Zero orphan files on disk: every single failed submission had its storage file deleted
      for (const loserKey of loserKeys) {
        expect(await fileExists(loserKey)).toBe(false);
      }

      // Zero orphan FileAsset records in database: only the winner's file asset exists
      const allDbFiles = await prisma.fileAsset.findMany();
      expect(allDbFiles).toHaveLength(1);
      expect(allDbFiles[0].id).toBe(stagedFile.fileAsset.id);
      expect(allDbFiles[0].storageKey).toBe(winnerKey);
      for (const loserKey of loserKeys) {
        expect(allDbFiles.some((f) => f.storageKey === loserKey)).toBe(false);
      }
    } finally {
      saveSpy.mockRestore();
    }
  });

  test('Issue 1 & 12: Database partial unique index rejects direct duplicate PENDING insert but permits non-pending records', async () => {
    const email = 'direct.db.unique@ctv.local';

    // First pending registration succeeds
    const first = await prisma.registrationRequest.create({
      data: {
        email,
        displayName: 'First Pending',
        status: 'PENDING',
      },
    });
    expect(first.id).toBeDefined();

    // Duplicate pending registration must fail with unique constraint violation
    await expect(
      prisma.registrationRequest.create({
        data: {
          email,
          displayName: 'Second Pending',
          status: 'PENDING',
        },
      }),
    ).rejects.toThrow();

    // But inserting a non-pending record (e.g. REJECTED) with the same email succeeds
    const rejected = await prisma.registrationRequest.create({
      data: {
        email,
        displayName: 'Historical Rejected',
        status: 'REJECTED',
        rejectionReason: 'Previous historical application',
      },
    });
    expect(rejected.id).toBeDefined();
  });

  test('Issue 2 & 17: Concurrent conflicting decisions (APPROVE vs REJECT) — exactly 1 succeeds, other rejected with 409', async () => {
    const adminTok = await loginCookie(app, 'admin.acceptance@ctv.local');

    // Create a single pending request
    const createRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.race@ctv.local')
      .field('displayName', 'Applicant Race')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', validPng, 'front.png');
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.request.id;

    // Concurrently send APPROVE and REJECT for the same requestId
    const [approveRes, rejectRes] = await Promise.all([
      request(app)
        .patch(`/api/v1/registration-requests/${requestId}`)
        .set('Cookie', adminTok)
        .send({ decision: 'APPROVED', expectedStatus: 'PENDING' }),
      request(app)
        .patch(`/api/v1/registration-requests/${requestId}`)
        .set('Cookie', adminTok)
        .send({
          decision: 'REJECTED',
          expectedStatus: 'PENDING',
          rejectionReason: 'Conflicting race rejection',
        }),
    ]);

    const statuses = [approveRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const failed = approveRes.status === 409 ? approveRes : rejectRes;
    expect(failed.body.error?.code).toBe('REGISTRATION_ALREADY_REVIEWED');

    // Database state must be consistent: exactly one decision recorded
    const finalRequest = await prisma.registrationRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(['APPROVED', 'REJECTED']).toContain(finalRequest.status);

    const accounts = await prisma.account.findMany({
      where: { email: 'applicant.race@ctv.local' },
    });
    if (finalRequest.status === 'APPROVED') {
      expect(accounts).toHaveLength(1);
      expect(finalRequest.approvedAccountId).toBe(accounts[0].id);
    } else {
      expect(accounts).toHaveLength(0);
      expect(finalRequest.rejectionReason).toBe('Conflicting race rejection');
    }
  });

  test('Issue 2: Two concurrent APPROVE decisions on the same request — exactly 1 succeeds', async () => {
    const adminTok = await loginCookie(app, 'admin.acceptance@ctv.local');

    const createRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', 'applicant.doubleapprove@ctv.local')
      .field('displayName', 'Applicant Double')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', validPng, 'front.png');
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.request.id;

    const [approve1, approve2] = await Promise.all([
      request(app)
        .patch(`/api/v1/registration-requests/${requestId}`)
        .set('Cookie', adminTok)
        .send({ decision: 'APPROVED', expectedStatus: 'PENDING' }),
      request(app)
        .patch(`/api/v1/registration-requests/${requestId}`)
        .set('Cookie', adminTok)
        .send({ decision: 'APPROVED', expectedStatus: 'PENDING' }),
    ]);

    const statuses = [approve1.status, approve2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const accounts = await prisma.account.findMany({
      where: { email: 'applicant.doubleapprove@ctv.local' },
    });
    expect(accounts).toHaveLength(1);
  });

  test('Issue 3 & 17: Concurrent approvals across multiple different applicants allocate sequential CTV codes without collisions', async () => {
    const adminTok = await loginCookie(app, 'admin.acceptance@ctv.local');
    const count = 5;
    const passwordHash = await argon2.hash(TEST_PASSWORD);

    // Seed 5 different pending requests with files directly to isolate approval concurrency
    const requestIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const storageKey = buildStorageKey(`front-${i}.png`);
      await saveBufferToFile(validPng, storageKey);

      const fileAsset = await prisma.fileAsset.create({
        data: {
          id: generateCuid(),
          storageKey,
          originalName: `front-${i}.png`,
          mimeType: 'image/png',
          sizeBytes: validPng.length,
          sha256: sha256Of(validPng),
          state: 'STAGED',
        },
      });

      const req = await prisma.registrationRequest.create({
        data: {
          email: `parallel.ctv.${i}@ctv.local`,
          passwordHash,
          displayName: `Parallel CTV ${i}`,
          status: 'PENDING',
          files: {
            create: [
              {
                fileAsset: { connect: { id: fileAsset.id } },
                category: 'CCCD_FRONT',
              },
            ],
          },
        },
      });
      requestIds.push(req.id);
    }

    // Approve all 5 in parallel simultaneously
    const approvalResponses = await Promise.all(
      requestIds.map((id) =>
        request(app)
          .patch(`/api/v1/registration-requests/${id}`)
          .set('Cookie', adminTok)
          .send({ decision: 'APPROVED', expectedStatus: 'PENDING' }),
      ),
    );

    // Every single parallel approval MUST succeed (status 200)
    for (const res of approvalResponses) {
      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('APPROVED');
      expect(res.body.request.approvedAccount.ctvCode).toMatch(/^CTV-\d{4}-\d{3}$/);
    }

    // Verify all generated CTV codes are unique
    const codes = approvalResponses.map((r) => r.body.request.approvedAccount.ctvCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(count);

    // Verify sequential ordering
    const numbers = codes.map((c) => Number.parseInt(c.slice(-3), 10)).sort((a, b) => a - b);
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBe(numbers[i - 1] + 1);
    }
  });

  test('Issue 3 & 17: CTV sequence boundary rollover from 999 to 1000+ without collision under parallel approvals', async () => {
    const adminTok = await loginCookie(app, 'admin.acceptance@ctv.local');
    const year = new Date().getFullYear();
    const passwordHash = await argon2.hash(TEST_PASSWORD);

    // Seed account at 999 boundary
    await prisma.account.create({
      data: {
        email: 'boundary999@ctv.local',
        passwordHash,
        role: 'CTV',
        status: 'ACTIVE',
        displayName: 'Boundary 999 CTV',
        ctvCode: `CTV-${year}-999`,
      },
    });

    // Create 3 pending requests to approve concurrently across the 999 boundary
    const requestIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const storageKey = buildStorageKey(`boundary-front-${i}.png`);
      await saveBufferToFile(validPng, storageKey);

      const fileAsset = await prisma.fileAsset.create({
        data: {
          id: generateCuid(),
          storageKey,
          originalName: `boundary-front-${i}.png`,
          mimeType: 'image/png',
          sizeBytes: validPng.length,
          sha256: sha256Of(validPng),
          state: 'STAGED',
        },
      });

      const req = await prisma.registrationRequest.create({
        data: {
          email: `boundary.applicant.${i}@ctv.local`,
          passwordHash,
          displayName: `Boundary Applicant ${i}`,
          status: 'PENDING',
          files: {
            create: [
              {
                fileAsset: { connect: { id: fileAsset.id } },
                category: 'CCCD_FRONT',
              },
            ],
          },
        },
      });
      requestIds.push(req.id);
    }

    // Approve all 3 in parallel
    const approvalResponses = await Promise.all(
      requestIds.map((id) =>
        request(app)
          .patch(`/api/v1/registration-requests/${id}`)
          .set('Cookie', adminTok)
          .send({ decision: 'APPROVED', expectedStatus: 'PENDING' }),
      ),
    );

    // All 3 must succeed with 200
    for (const res of approvalResponses) {
      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('APPROVED');
    }

    // Verify allocated codes crossed 1000 sequentially: 1000, 1001, 1002
    const allocatedCodes = approvalResponses
      .map((r) => r.body.request.approvedAccount.ctvCode as string)
      .sort();

    expect(allocatedCodes).toEqual([`CTV-${year}-1000`, `CTV-${year}-1001`, `CTV-${year}-1002`]);
  });

  test('Issue 13: Soft-deleted account re-registration restores account identity and preserves CTV code', async () => {
    const adminTok = await loginCookie(app, 'admin.acceptance@ctv.local');
    const email = 'resurrect.me@ctv.local';
    const originalCtvCode = 'CTV-2026-888';

    // 1. Create original active account
    const original = await prisma.account.create({
      data: {
        email,
        passwordHash: 'hash123',
        role: 'CTV',
        status: 'ACTIVE',
        displayName: 'Original Name',
        ctvCode: originalCtvCode,
      },
    });

    // 2. Soft-delete account
    await prisma.account.update({
      where: { id: original.id },
      data: {
        deletedAt: new Date(),
        status: 'DISABLED',
      },
    });

    // 3. User applies for re-registration
    const regRes = await request(app)
      .post('/api/v1/registration-requests')
      .field('email', email)
      .field('displayName', 'Resurrected Name')
      .field('phone', '0999888777')
      .field('password', TEST_PASSWORD)
      .attach('cccdFront', validPng, 'new-front.png');
    expect(regRes.status).toBe(201);
    const reqId = regRes.body.request.id;

    // 4. Admin approves re-registration
    const approveRes = await request(app)
      .patch(`/api/v1/registration-requests/${reqId}`)
      .set('Cookie', adminTok)
      .send({ decision: 'APPROVED', expectedStatus: 'PENDING' });
    expect(approveRes.status).toBe(200);

    // 5. Verify existing account is resurrected rather than a duplicate created
    const accounts = await prisma.account.findMany({ where: { email } });
    expect(accounts).toHaveLength(1);

    const resurrected = accounts[0];
    expect(resurrected.id).toBe(original.id);
    expect(resurrected.deletedAt).toBeNull();
    expect(resurrected.status).toBe('ACTIVE');
    expect(resurrected.displayName).toBe('Resurrected Name');
    expect(resurrected.phone).toBe('0999888777');
    expect(resurrected.ctvCode).toBe(originalCtvCode); // Preserves original CTV code identity
  });
});

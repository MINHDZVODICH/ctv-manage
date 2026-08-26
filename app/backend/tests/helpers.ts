import fs from 'node:fs/promises';
import path from 'node:path';
import argon2 from 'argon2';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/shared/prisma.js';

export const TEST_PASSWORD = 'Test@123456';
let passwordHash: string | undefined;

export async function resetDatabase() {
  await prisma.workHistory.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedulePatternSlot.deleteMany();
  await prisma.scheduleRegistration.deleteMany();
  await prisma.accountFile.deleteMany();
  await prisma.registrationRequestFile.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.registrationRequest.deleteMany();
  await prisma.account.deleteMany();

  const uploadRoot = path.resolve(process.cwd(), process.env.FILE_STORAGE_ROOT ?? '.acceptance-uploads');
  await fs.rm(uploadRoot, { recursive: true, force: true });
  await fs.mkdir(uploadRoot, { recursive: true });
}

export async function seedActors() {
  passwordHash ??= await argon2.hash(TEST_PASSWORD);
  const [admin, ctv, otherCtv, disabledCtv] = await Promise.all([
    prisma.account.create({
      data: {
        email: 'admin.acceptance@ctv.local',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        displayName: 'Admin Acceptance',
        ctvCode: 'ADMIN-ACCEPTANCE',
      },
    }),
    prisma.account.create({
      data: {
        email: 'ctv.active@ctv.local',
        passwordHash,
        role: 'CTV',
        status: 'ACTIVE',
        displayName: 'CTV Active',
        phone: '0900000001',
        ctvCode: 'CTV-ACCEPTANCE-001',
      },
    }),
    prisma.account.create({
      data: {
        email: 'ctv.other@ctv.local',
        passwordHash,
        role: 'CTV',
        status: 'ACTIVE',
        displayName: 'CTV Other',
        phone: '0900000002',
        ctvCode: 'CTV-ACCEPTANCE-002',
      },
    }),
    prisma.account.create({
      data: {
        email: 'ctv.disabled@ctv.local',
        passwordHash,
        role: 'CTV',
        status: 'DISABLED',
        displayName: 'CTV Disabled',
        ctvCode: 'CTV-ACCEPTANCE-003',
      },
    }),
  ]);
  return { admin, ctv, otherCtv, disabledCtv };
}

export async function loginCookie(app: Express, email: string, password = TEST_PASSWORD) {
  const response = await request(app).post('/api/v1/auth/sessions').send({ email, password });
  if (response.status !== 201) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  const setCookie = response.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) throw new Error(`Login response did not set a cookie for ${email}`);
  return raw.split(';')[0];
}

export const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

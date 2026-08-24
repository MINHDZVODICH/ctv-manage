import assert from 'node:assert/strict';
import { AccountRole, AccountStatus, type Account, type PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { describe, test } from 'vitest';
import { ApiError } from '../src/shared/api-error.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { requireCsrf } from '../src/middleware/csrf.middleware.js';

const activeAccount: Account = {
  id: 'acc_admin',
  email: 'admin@example.vn',
  passwordHash: '',
  role: AccountRole.ADMIN,
  status: AccountStatus.ACTIVE,
  mustChangePassword: false,
  displayName: 'Quản trị viên',
  phone: null,
  ctvCode: null,
  dateOfBirth: null,
  gender: null,
  address: null,
  adminNotes: null,
  joinedAt: null,
  lastLoginAt: null,
  passwordChangedAt: null,
  createdAt: new Date('2026-08-25T00:00:00.000Z'),
  updatedAt: new Date('2026-08-25T00:00:00.000Z'),
  deletedAt: null,
};

describe('AuthService', () => {
  test('hashPassword produces an Argon2id hash that verifies the original password', async () => {
    const service = new AuthService({} as PrismaClient);

    const hash = await service.hashPassword('Secret123');

    assert.match(hash, /^\$argon2id\$/);
    assert.equal(await service.verifyPassword(hash, 'Secret123'), true);
    assert.equal(await service.verifyPassword(hash, 'Wrong123'), false);
  });

  test('unknown email and wrong password expose the same invalid-credentials error', async () => {
    const passwordHash = await new AuthService({} as PrismaClient).hashPassword('Secret123');
    const serviceWithAccount = new AuthService(fakePrisma({ ...activeAccount, passwordHash }));
    const serviceWithoutAccount = new AuthService(fakePrisma(null));

    await assert.rejects(
      serviceWithAccount.createSession({ email: activeAccount.email, password: 'Wrong123' }),
      isApiError(401, 'INVALID_CREDENTIALS'),
    );
    await assert.rejects(
      serviceWithoutAccount.createSession({ email: 'missing@example.vn', password: 'Wrong123' }),
      isApiError(401, 'INVALID_CREDENTIALS'),
    );
  });

  test('a disabled account with valid credentials is rejected explicitly', async () => {
    const service = new AuthService(fakePrisma({
      ...activeAccount,
      passwordHash: await new AuthService({} as PrismaClient).hashPassword('Secret123'),
      status: AccountStatus.DISABLED,
    }));

    await assert.rejects(
      service.createSession({ email: activeAccount.email, password: 'Secret123' }),
      isApiError(403, 'ACCOUNT_DISABLED'),
    );
  });
});

test('requireCsrf cannot silently authorize a request without an authenticated session', () => {
  let forwardedError: unknown;

  requireCsrf(
    { headers: {} } as Request,
    { locals: {} } as Response,
    ((error?: unknown) => { forwardedError = error; }) as NextFunction,
  );

  assert.ok(forwardedError instanceof ApiError);
  assert.equal(forwardedError.statusCode, 401);
  assert.equal(forwardedError.code, 'AUTHENTICATION_REQUIRED');
});

function isApiError(statusCode: number, code: string): (error: unknown) => boolean {
  return (error) => error instanceof ApiError && error.statusCode === statusCode && error.code === code;
}

function fakePrisma(account: Account | null): PrismaClient {
  return {
    account: {
      findUnique: async () => account,
    },
  } as unknown as PrismaClient;
}

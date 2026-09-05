import argon2 from 'argon2';
import { prisma } from '../../shared/prisma.js';
import type { Prisma } from '@prisma/client';
import { AppError, Errors } from '../../shared/errors.js';
import { parseAndValidateDateOfBirth } from '../../shared/dateValidation.js';

export async function getMyProfile(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      accountFiles: {
        where: { deletedAt: null },
        include: { fileAsset: true },
      },
    },
  });
  if (!account || account.deletedAt) {
    throw Errors.notFound('Không tìm thấy tài khoản');
  }
  return account;
}

export interface UpdateMyProfilePayload {
  displayName?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  expectedVersion?: number;
}

export async function updateMyProfile(
  accountId: string,
  payload: UpdateMyProfilePayload,
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });
  if (!account || account.deletedAt) {
    throw Errors.notFound('Không tìm thấy tài khoản');
  }

  // Optimistic concurrency check
  if (
    payload.expectedVersion !== undefined &&
    payload.expectedVersion !== account.version
  ) {
    throw new AppError(409, 'VERSION_CONFLICT', 'Dữ liệu đã được cập nhật bởi phiên khác, vui lòng tải lại');
  }

  const data: Prisma.AccountUpdateInput = {
    version: { increment: 1 },
  };

  if (payload.displayName !== undefined) data.displayName = payload.displayName;
  if (payload.phone !== undefined) data.phone = payload.phone;
  if (payload.address !== undefined) data.address = payload.address;
  if (payload.gender !== undefined) data.gender = payload.gender;
  if (payload.dateOfBirth !== undefined) {
    data.dateOfBirth = parseAndValidateDateOfBirth(payload.dateOfBirth);
  }

  // If expectedVersion provided, use conditional update to ensure atomicity
  if (payload.expectedVersion !== undefined) {
    const updated = await prisma.account.updateMany({
      where: { id: accountId, version: payload.expectedVersion, deletedAt: null },
      data: data as Prisma.AccountUpdateManyMutationInput,
    });
    if (updated.count === 0) {
      throw new AppError(409, 'VERSION_CONFLICT', 'Version conflict');
    }
    const fresh = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        accountFiles: {
          where: { deletedAt: null },
          include: { fileAsset: true },
        },
      },
    });
    return fresh!;
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data,
    include: {
      accountFiles: {
        where: { deletedAt: null },
        include: { fileAsset: true },
      },
    },
  });
  return updated;
}

export async function changePassword(
  accountId: string,
  sessionId: string | undefined,
  currentPassword: string,
  newPassword: string,
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });
  if (!account || account.deletedAt) {
    throw Errors.notFound('Không tìm thấy tài khoản');
  }

  const valid = await argon2.verify(account.passwordHash, currentPassword);
  if (!valid) {
    throw Errors.badRequest('INVALID_PASSWORD', 'Mật khẩu hiện tại không chính xác');
  }

  const newHash = await argon2.hash(newPassword);

  await prisma.account.update({
    where: { id: accountId },
    data: {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });

  // Revoke all other sessions except current one
  if (sessionId) {
    await prisma.session.updateMany({
      where: {
        accountId,
        id: { not: sessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  } else {
    await prisma.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

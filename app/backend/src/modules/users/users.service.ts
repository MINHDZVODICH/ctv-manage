import argon2 from 'argon2';
import { prisma } from '../../shared/prisma.js';
import { AppError, Errors } from '../../shared/errors.js';

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
    throw Errors.notFound('Account not found');
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
    throw Errors.notFound('Account not found');
  }

  // Optimistic concurrency check
  if (
    payload.expectedVersion !== undefined &&
    payload.expectedVersion !== account.version
  ) {
    throw new AppError(409, 'VERSION_CONFLICT', 'Version conflict');
  }

  const data: Record<string, unknown> = {
    version: { increment: 1 },
  };

  if (payload.displayName !== undefined) data['displayName'] = payload.displayName;
  if (payload.phone !== undefined) data['phone'] = payload.phone;
  if (payload.address !== undefined) data['address'] = payload.address;
  if (payload.gender !== undefined) data['gender'] = payload.gender;
  if (payload.dateOfBirth !== undefined) {
    if (payload.dateOfBirth === null || payload.dateOfBirth === '') {
      data['dateOfBirth'] = null;
    } else {
      let parsed = new Date(payload.dateOfBirth);
      if (isNaN(parsed.getTime()) && typeof payload.dateOfBirth === 'string') {
        const parts = payload.dateOfBirth.split(/[\/\-]/);
        if (parts.length === 3 && parts[2].length === 4) {
          parsed = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      }
      data['dateOfBirth'] = isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  // If expectedVersion provided, use conditional update to ensure atomicity
  if (payload.expectedVersion !== undefined) {
    const updated = await prisma.account.updateMany({
      where: { id: accountId, version: payload.expectedVersion, deletedAt: null },
      data: data as any,
    });
    if (updated.count === 0) {
      throw new AppError(409, 'VERSION_CONFLICT', 'Version conflict');
    }
    const fresh = await prisma.account.findUnique({ where: { id: accountId } });
    return fresh!;
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: data as any,
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
    throw Errors.notFound('Account not found');
  }

  const valid = await argon2.verify(account.passwordHash, currentPassword);
  if (!valid) {
    throw Errors.badRequest('INVALID_PASSWORD', 'Current password is incorrect');
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

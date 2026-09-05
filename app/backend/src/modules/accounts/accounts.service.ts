import * as argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import { parseAndValidateDateOfBirth } from '../../shared/dateValidation.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------


function mapAccountFiles(a: any) {
  return (a.accountFiles ?? [])
    .filter((af: any) => !af.deletedAt)
    .map((af: any) => ({
      category: af.category,
      fileId: af.fileId,
      createdAt: af.createdAt,
      file: af.fileAsset
        ? {
            id: af.fileAsset.id,
            storageKey: af.fileAsset.storageKey,
            originalName: af.fileAsset.originalName,
            mimeType: af.fileAsset.mimeType,
            sizeBytes: af.fileAsset.sizeBytes,
            sha256: af.fileAsset.sha256,
            state: af.fileAsset.state,
            createdAt: af.fileAsset.createdAt,
          }
        : null,
    }));
}

function mapAccountRow(a: any) {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    phone: a.phone,
    ctvCode: a.ctvCode,
    role: a.role,
    status: a.status,
    version: a.version,
    gender: a.gender,
    dateOfBirth: a.dateOfBirth,
    address: a.address,
    joinedAt: a.joinedAt,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    files: mapAccountFiles(a),
  };
}

function mapAccountDetail(a: any) {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    phone: a.phone,
    ctvCode: a.ctvCode,
    role: a.role,
    status: a.status,
    version: a.version,
    mustChangePassword: a.mustChangePassword,
    gender: a.gender,
    dateOfBirth: a.dateOfBirth,
    address: a.address,
    adminNotes: a.adminNotes,
    joinedAt: a.joinedAt,
    lastLoginAt: a.lastLoginAt,
    passwordChangedAt: a.passwordChangedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    files: mapAccountFiles(a),
  };
}

function assertVersionMatch(current: number, expectedVersion: number | undefined) {
  if (expectedVersion !== undefined && current !== expectedVersion) {
    throw Errors.conflict('VERSION_CONFLICT', 'Phiên bản dữ liệu đã thay đổi, vui lòng tải lại');
  }
}

// ---------------------------------------------------------------------------
// listAccounts
// ---------------------------------------------------------------------------

export interface ListAccountsParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listAccounts(params: ListAccountsParams): Promise<{ data: any[]; total: number }> {
  const page = params.page && params.page >= 1 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && params.pageSize >= 1 ? Math.floor(params.pageSize) : 5;

  const where: any = {
    deletedAt: null,
    role: 'CTV',
  };

  if (params.status) {
    where.status = params.status;
  }

  if (params.q && params.q.trim().length > 0) {
    const q = params.q.trim();
    where.OR = [
      { displayName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        accountFiles: {
          where: { deletedAt: null },
          include: { fileAsset: true },
        },
      },
    }),
  ]);

  return { data: rows.map(mapAccountRow), total };
}

// ---------------------------------------------------------------------------
// getAccount
// ---------------------------------------------------------------------------

export async function getAccount(accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, deletedAt: null },
    include: {
      accountFiles: {
        where: { deletedAt: null },
        include: { fileAsset: true },
      },
    },
  });
  if (!account) throw Errors.notFound('Không tìm thấy tài khoản');
  return mapAccountDetail(account);
}

// ---------------------------------------------------------------------------
// updateAccount
// ---------------------------------------------------------------------------

export interface UpdateAccountPayload {
  displayName?: string;
  phone?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  address?: string | null;
  expectedVersion?: number;
}

export async function updateAccount(accountId: string, payload: UpdateAccountPayload) {
  const account = await prisma.account.findFirst({ where: { id: accountId, deletedAt: null } });
  if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

  assertVersionMatch(account.version, payload.expectedVersion);

  const data: Prisma.AccountUpdateInput = { version: { increment: 1 } };
  if (payload.displayName !== undefined) data.displayName = payload.displayName;
  if (payload.phone !== undefined) data.phone = payload.phone;
  if (payload.gender !== undefined) data.gender = payload.gender;
  if (payload.address !== undefined) data.address = payload.address;
  if (payload.dateOfBirth !== undefined) {
    data.dateOfBirth = parseAndValidateDateOfBirth(payload.dateOfBirth);
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data,
    include: {
      accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } },
    },
  });
  return mapAccountDetail(updated);
}

// ---------------------------------------------------------------------------
// updateNotes
// ---------------------------------------------------------------------------

export async function updateNotes(accountId: string, adminNotes: string | null, expectedVersion?: number) {
  const account = await prisma.account.findFirst({ where: { id: accountId, deletedAt: null } });
  if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

  assertVersionMatch(account.version, expectedVersion);

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: { adminNotes, version: { increment: 1 } },
    include: {
      accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } },
    },
  });
  return mapAccountDetail(updated);
}

// ---------------------------------------------------------------------------
// changeStatus
// ---------------------------------------------------------------------------

export async function changeStatus(accountId: string, status: string, expectedVersion?: number) {
  return await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { id: accountId, deletedAt: null } });
    if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

    assertVersionMatch(account.version, expectedVersion);

    const updated = await tx.account.update({
      where: { id: accountId },
      data: { status, version: { increment: 1 } },
      include: {
        accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } },
      },
    });

    if (status === 'DISABLED') {
      await tx.session.updateMany({
        where: { accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return mapAccountDetail(updated);
  });
}

// ---------------------------------------------------------------------------
// softDelete
// ---------------------------------------------------------------------------

export async function softDelete(accountId: string) {
  return await prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({ where: { id: accountId } });
    if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

    if (account.deletedAt) {
      const withFiles = await tx.account.findUnique({
        where: { id: accountId },
        include: { accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } } },
      });
      return mapAccountDetail(withFiles!);
    }

    const now = new Date();
    const updated = await tx.account.update({
      where: { id: accountId },
      data: { deletedAt: now, status: 'DISABLED', version: { increment: 1 } },
      include: { accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } } },
    });

    await tx.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    });

    return mapAccountDetail(updated);
  });
}

// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------

export async function resetPassword(accountId: string, newPassword: string, mustChangePassword?: boolean) {
  const passwordHash = await argon2.hash(newPassword);
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { id: accountId, deletedAt: null } });
    if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

    const updated = await tx.account.update({
      where: { id: accountId },
      data: {
        passwordHash,
        mustChangePassword: mustChangePassword ?? false,
        passwordChangedAt: now,
      },
      include: { accountFiles: { where: { deletedAt: null }, include: { fileAsset: true } } },
    });

    await tx.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    });

    return mapAccountDetail(updated);
  });
}

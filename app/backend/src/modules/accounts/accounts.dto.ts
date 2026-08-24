import type { Account, AccountFile, FileAsset } from '@prisma/client';

export interface AccountFileDto {
  id: string;
  category: 'AVATAR' | 'CCCD_FRONT' | 'CCCD_BACK' | 'CV';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export function toAccountSummaryDto(account: Account & { accountFiles: Array<AccountFile & { file: FileAsset }> }) {
  const avatar = account.accountFiles.find((entry) => entry.category === 'AVATAR');
  return {
    id: account.id,
    displayName: account.displayName,
    email: account.email,
    phone: account.phone,
    ctvCode: account.ctvCode,
    status: account.status,
    version: account.version,
    joinedAt: account.joinedAt?.toISOString() ?? null,
    avatarFileId: avatar?.file.id ?? null,
  };
}

export function toAccountDetailDto(account: Account & { accountFiles: Array<AccountFile & { file: FileAsset }> }) {
  return {
    ...toAccountSummaryDto(account),
    role: account.role,
    dateOfBirth: account.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: account.gender,
    address: account.address,
    adminNotes: account.adminNotes,
    mustChangePassword: account.mustChangePassword,
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    files: account.accountFiles.map(({ file, category, createdAt }): AccountFileDto => ({
      id: file.id,
      category,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: createdAt.toISOString(),
    })),
  };
}

export function toSelfProfileDto(account: Account & { accountFiles: Array<AccountFile & { file: FileAsset }> }) {
  const { adminNotes: _adminNotes, ...profile } = toAccountDetailDto(account);
  return profile;
}

export function toFileDto(file: FileAsset, category: AccountFile['category']): AccountFileDto {
  return {
    id: file.id,
    category,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
  };
}

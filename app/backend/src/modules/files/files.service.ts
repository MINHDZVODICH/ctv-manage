import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import {
  assertFileMagic,
  buildStorageKey,
  deleteFile,
  generateCuid,
  saveBufferToFile,
  sha256Of,
} from '../../shared/fileStorage.js';
import { logger } from '../../shared/logger.js';

export const FILE_CATEGORIES = ['AVATAR', 'CCCD_FRONT', 'CCCD_BACK', 'CV'] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

const ALLOWED_MIMES: Record<FileCategory, string[]> = {
  AVATAR: ['image/jpeg', 'image/png', 'image/webp'],
  CCCD_FRONT: ['image/jpeg', 'image/png', 'image/webp'],
  CCCD_BACK: ['image/jpeg', 'image/png', 'image/webp'],
  CV: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

export function isFileCategory(v: string): v is FileCategory {
  return (FILE_CATEGORIES as readonly string[]).includes(v);
}

export async function authorizeFile(actorId: string, actorRole: string, fileId: string) {
  const asset = await (prisma as any).fileAsset.findFirst({
    where: { id: fileId, state: { in: ['ACTIVE', 'STAGED'] } },
  });
  if (!asset) throw Errors.notFound('Không tìm thấy tệp');

  // Account owners can only read their own active file. Admins can additionally
  // inspect files attached to a registration request while it is still staged.
  const accountLink = await (prisma as any).accountFile.findFirst({
    where: {
      fileId,
      deletedAt: null,
      ...(actorRole === 'ADMIN' ? {} : { accountId: actorId }),
    },
    select: { accountId: true },
  });
  const registrationLink =
    actorRole === 'ADMIN'
      ? await (prisma as any).registrationRequestFile.findFirst({
          where: { fileId },
          select: { requestId: true },
        })
      : null;

  if ((!accountLink || (actorRole !== 'ADMIN' && asset.state !== 'ACTIVE')) && !registrationLink) {
    // Do not expose unattached assets or another CTV's files.
    throw Errors.forbidden();
  }

  return {
    fileId: asset.id,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    originalName: asset.originalName,
    sizeBytes: asset.sizeBytes,
  };
}

export async function uploadFileForAccount(targetAccountId: string, category: FileCategory, file: Express.Multer.File) {
  const account = await (prisma as any).account.findFirst({
    where: { id: targetAccountId, deletedAt: null },
    select: { id: true },
  });
  if (!account) throw Errors.notFound('Không tìm thấy tài khoản');

  if (!ALLOWED_MIMES[category].includes(file.mimetype)) {
    throw Errors.badRequest('INVALID_FILE_TYPE', 'Loại tệp không hợp lệ');
  }
  assertFileMagic(file.buffer, ALLOWED_MIMES[category]);

  const fileAssetId = generateCuid();
  const storageKey = buildStorageKey(file.originalname);

  saveBufferToFile(file.buffer, storageKey);

  const now = new Date();
  try {
    await prisma.$transaction(async (tx: any) => {
      // Soft-delete previous active file(s) in the same category for this account
      await tx.accountFile.updateMany({
        where: { accountId: targetAccountId, category, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.fileAsset.create({
        data: {
          id: fileAssetId,
          storageKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          sha256: sha256Of(file.buffer),
          state: 'ACTIVE',
        },
      });
      await tx.accountFile.create({
        data: { accountId: targetAccountId, fileId: fileAssetId, category },
      });
    });
  } catch (err) {
    try {
      deleteFile(storageKey);
    } catch (cleanupErr) {
      logger.warn({ cleanupErr, storageKey }, 'Failed to cleanup file after uploadFileForAccount failure');
    }
    throw err;
  }

  return {
    fileId: fileAssetId,
    category,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

export async function deleteFileForAccount(targetAccountId: string, category: FileCategory) {
  const existing = await (prisma as any).accountFile.findFirst({
    where: { accountId: targetAccountId, category, deletedAt: null },
  });
  if (!existing) throw Errors.notFound('Không tìm thấy tệp');

  await (prisma as any).accountFile.update({
    where: { accountId_fileId: { accountId: targetAccountId, fileId: existing.fileId } },
    data: { deletedAt: new Date() },
  });

  return { success: true };
}

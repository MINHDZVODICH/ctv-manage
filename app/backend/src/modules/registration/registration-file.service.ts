import type { Prisma, FileCategory } from '@prisma/client';
import {
  assertFileMagic,
  buildStorageKey,
  deleteFile,
  fileExists,
  generateCuid,
  saveBufferToFile,
} from '../../shared/fileStorage.js';
import { Errors } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import {
  FILE_CATEGORY_BY_FIELD,
  type RegistrationFileField,
  type RegistrationFilesInput,
} from './registration.types.js';

const ALLOWED_MIMES: Record<string, string[]> = {
  CCCD_FRONT: ['image/jpeg', 'image/png', 'image/webp'],
  CCCD_BACK: ['image/jpeg', 'image/png', 'image/webp'],
  CV: ['application/pdf'],
};

export interface PreparedRegistrationFile {
  field: RegistrationFileField;
  category: FileCategory;
  file: Express.Multer.File;
  fileAssetId: string;
  storageKey: string;
}

export class RegistrationFileService {
  /**
   * Validates and prepares file assets from multipart input.
   */
  prepareFiles(files: RegistrationFilesInput): PreparedRegistrationFile[] {
    const entries: PreparedRegistrationFile[] = [];

    for (const field of Object.keys(FILE_CATEGORY_BY_FIELD) as RegistrationFileField[]) {
      const file = files[field];
      if (!file) continue;
      const category = FILE_CATEGORY_BY_FIELD[field];
      assertFileMagic(file.buffer, ALLOWED_MIMES[category]);
      entries.push({
        field,
        category,
        file,
        fileAssetId: generateCuid(),
        storageKey: buildStorageKey(file.originalname),
      });
    }

    return entries;
  }

  /**
   * Persists buffers to storage with rollback cleanup on error.
   * Tracks storageKey before awaiting write so partial files are cleaned up if the write fails.
   */
  async saveFilesToStorage(entries: PreparedRegistrationFile[]): Promise<string[]> {
    const writtenKeys: string[] = [];
    try {
      for (const e of entries) {
        writtenKeys.push(e.storageKey);
        await saveBufferToFile(e.file.buffer, e.storageKey);
      }
      return writtenKeys;
    } catch (err) {
      await this.cleanupStorageFiles(writtenKeys);
      throw err;
    }
  }

  /**
   * Clean up storage files when subsequent operations fail.
   */
  async cleanupStorageFiles(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await deleteFile(key);
      } catch (cleanupErr) {
        logger.warn(
          { cleanupErr, key },
          'Failed to cleanup uploaded file after registration failure',
        );
      }
    }
  }

  /**
   * Verifies that all attached files exist on storage prior to approval.
   */
  async verifyFilesExist(files: Array<{ fileAsset: { storageKey: string } }>): Promise<void> {
    for (const rf of files) {
      if (!(await fileExists(rf.fileAsset.storageKey))) {
        throw Errors.conflict('FILES_MISSING', 'Tệp đính kèm không còn tồn tại, không thể duyệt');
      }
    }
  }

  /**
   * Transactional migration of registration files to account files.
   */
  async linkFilesToAccount(
    tx: Prisma.TransactionClient,
    accountId: string,
    files: Array<{ fileId: string; category: FileCategory }>,
  ): Promise<void> {
    if (files.length === 0) return;

    for (const rf of files) {
      await tx.accountFile.create({
        data: { accountId, fileId: rf.fileId, category: rf.category },
      });
    }

    await tx.fileAsset.updateMany({
      where: { id: { in: files.map((rf) => rf.fileId) }, state: { not: 'ACTIVE' } },
      data: { state: 'ACTIVE' },
    });
  }
}

export const registrationFileService = new RegistrationFileService();

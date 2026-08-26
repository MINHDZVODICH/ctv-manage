import type {} from 'multer';
import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import { normalizeEmail } from '../../shared/crypto.js';
import {
  assertFileMagic,
  buildStorageKey,
  deleteFile,
  fileExists,
  generateCuid,
  saveBufferToFile,
  sha256Of,
} from '../../shared/fileStorage.js';
import { logger } from '../../shared/logger.js';

export const FILE_CATEGORY_BY_FIELD = {
  cccdFront: 'CCCD_FRONT',
  cccdBack: 'CCCD_BACK',
  cv: 'CV',
} as const;

export type RegistrationFileField = keyof typeof FILE_CATEGORY_BY_FIELD;

const ALLOWED_MIMES: Record<string, string[]> = {
  CCCD_FRONT: ['image/jpeg', 'image/png', 'image/webp'],
  CCCD_BACK: ['image/jpeg', 'image/png', 'image/webp'],
  CV: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

export interface CreateRegistrationInput {
  emailRaw: string;
  displayName: string;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  address?: string | null;
  password: string;
}

export interface RegistrationFilesInput {
  cccdFront?: Express.Multer.File;
  cccdBack?: Express.Multer.File;
  cv?: Express.Multer.File;
}

function toFileDto(rf: { category: string; fileId: string; fileAsset: { originalName: string; mimeType: string; sizeBytes: number } }) {
  return {
    category: rf.category,
    fileId: rf.fileId,
    originalName: rf.fileAsset.originalName,
    mimeType: rf.fileAsset.mimeType,
    sizeBytes: rf.fileAsset.sizeBytes,
  };
}

function toRequestDto(r: any) {
  return {
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    phone: r.phone,
    dateOfBirth: r.dateOfBirth,
    gender: r.gender,
    address: r.address,
    status: r.status,
    rejectionReason: r.rejectionReason,
    reviewedById: r.reviewedById,
    approvedAccountId: r.approvedAccountId,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    files: (r.files ?? []).map(toFileDto),
  };
}

export async function createRequest(input: CreateRegistrationInput, files: RegistrationFilesInput) {
  const email = normalizeEmail(input.emailRaw);

  // Conflict check: account email exists OR pending registration with same email
  const [existingAccount, pendingRequest] = await Promise.all([
    prisma.account.findFirst({ where: { email, deletedAt: null }, select: { id: true } }),
    prisma.registrationRequest.findFirst({ where: { email, status: 'PENDING' }, select: { id: true } }),
  ]);
  if (existingAccount || pendingRequest) {
    throw Errors.conflict('EMAIL_ALREADY_EXISTS', 'Email đã tồn tại hoặc đang chờ duyệt');
  }

  const passwordHash = await argon2.hash(input.password);

  const entries: Array<{
    field: RegistrationFileField;
    category: string;
    file: Express.Multer.File;
    fileAssetId: string;
    storageKey: string;
  }> = [];

  for (const field of Object.keys(FILE_CATEGORY_BY_FIELD) as RegistrationFileField[]) {
    const file = files[field];
    if (!file) continue;
    const category = FILE_CATEGORY_BY_FIELD[field];
    // Validate file magic via mime check (defense in depth — controller also validates)
    assertFileMagic(file.buffer, ALLOWED_MIMES[category]);
    entries.push({
      field,
      category,
      file,
      fileAssetId: generateCuid(),
      storageKey: buildStorageKey(file.originalname),
    });
  }

  // Save files to disk first, tracking written keys for cleanup on failure
  const writtenKeys: string[] = [];
  try {
    for (const e of entries) {
      saveBufferToFile(e.file.buffer, e.storageKey);
      writtenKeys.push(e.storageKey);
    }

    const created = await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        await tx.fileAsset.create({
          data: {
            id: e.fileAssetId,
            storageKey: e.storageKey,
            originalName: e.file.originalname,
            mimeType: e.file.mimetype,
            sizeBytes: e.file.size,
            sha256: sha256Of(e.file.buffer),
            state: 'ACTIVE',
          },
        });
      }
      return tx.registrationRequest.create({
        data: {
          email,
          passwordHash,
          displayName: input.displayName,
          phone: input.phone ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          gender: input.gender ?? null,
          address: input.address ?? null,
          status: 'PENDING',
          files: entries.length
            ? { create: entries.map((e) => ({ fileId: e.fileAssetId, category: e.category })) }
            : undefined,
        },
        include: { files: { include: { fileAsset: true } } },
      });
    });

    return toRequestDto(created);
  } catch (err) {
    for (const key of writtenKeys) {
      try {
        deleteFile(key);
      } catch (cleanupErr) {
        logger.warn({ cleanupErr, key }, 'Failed to cleanup uploaded file after createRequest failure');
      }
    }
    throw err;
  }
}

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export async function listPending({ q, page = 1, pageSize = 20, status = 'PENDING' }: ListParams) {
  const where: Prisma.RegistrationRequestWhereInput = { status };
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { displayName: { contains: term } },
      { phone: { contains: term } },
      { email: { contains: term } },
      { email: { contains: term.toLowerCase() } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.registrationRequest.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { files: { include: { fileAsset: true } } },
    }),
    prisma.registrationRequest.count({ where }),
  ]);
  return { items: items.map(toRequestDto), total, page, pageSize };
}

async function generateCtvCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CTV-${year}-`;
  const last = await (tx as any).account.findFirst({
    where: { ctvCode: { startsWith: prefix } },
    orderBy: { ctvCode: 'desc' },
    select: { ctvCode: true },
  });
  let seq = 1;
  if (last?.ctvCode) {
    const tail = last.ctvCode.slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function decide(
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewedById: string,
  rejectionReason?: string,
) {
  const request = await prisma.registrationRequest.findUnique({
    where: { id: requestId },
    include: { files: { include: { fileAsset: true } } },
  });
  if (!request) throw Errors.notFound('Không tìm thấy yêu cầu đăng ký');
  if (request.status !== 'PENDING') {
    throw Errors.conflict('REGISTRATION_ALREADY_REVIEWED', 'Yêu cầu đã được xử lý trước đó');
  }

  const now = new Date();

  if (decision === 'REJECTED') {
    const updated = await prisma.registrationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById,
        reviewedAt: now,
        rejectionReason: rejectionReason ?? null,
        passwordHash: null,
      },
      include: { files: { include: { fileAsset: true } } },
    });
    return toRequestDto(updated);
  }

  // APPROVED
  if (!request.passwordHash) {
    throw Errors.badRequest('MISSING_PASSWORD', 'Yêu cầu đăng ký không có mật khẩu');
  }
  // Check files still exist on disk
  for (const rf of request.files) {
    if (!fileExists(rf.fileAsset.storageKey)) {
      throw Errors.conflict('FILES_MISSING', 'Tệp đính kèm không còn tồn tại, không thể duyệt');
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ctvCode = await generateCtvCode(tx);

      const account = await (tx as any).account.create({
        data: {
          email: request.email,
          passwordHash: request.passwordHash as string,
          role: 'CTV',
          status: 'ACTIVE',
          version: 1,
          displayName: request.displayName,
          phone: request.phone,
          dateOfBirth: request.dateOfBirth,
          gender: request.gender,
          address: request.address,
          ctvCode,
          joinedAt: now,
        },
      });

      if (request.files.length > 0) {
        for (const rf of request.files) {
          await (tx as any).accountFile.create({
            data: { accountId: account.id, fileId: rf.fileId, category: rf.category },
          });
        }
        await (tx as any).fileAsset.updateMany({
          where: { id: { in: request.files.map((rf) => rf.fileId) }, state: { not: 'ACTIVE' } },
          data: { state: 'ACTIVE' },
        });
      }

      const updatedRequest = await (tx as any).registrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedById,
          reviewedAt: now,
          approvedAccountId: account.id,
          passwordHash: null,
        },
        include: { files: { include: { fileAsset: true } } },
      });

      return { request: updatedRequest, account };
    });

    return {
      ...toRequestDto(result.request),
      approvedAccount: { id: result.account.id, email: result.account.email, ctvCode: result.account.ctvCode },
    };
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw Errors.conflict('EMAIL_ALREADY_EXISTS', 'Email đã tồn tại trong hệ thống');
    }
    throw e;
  }
}

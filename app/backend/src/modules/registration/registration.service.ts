import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { RegistrationStatus } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { Errors } from '../../shared/errors.js';
import { normalizeEmail } from '../../shared/crypto.js';
import { sha256Of } from '../../shared/fileStorage.js';
import {
  type CreateRegistrationInput,
  type RegistrationFilesInput,
  type ListParams,
  type RegistrationRequestDto,
  type RegistrationDecisionResultDto,
  FILE_CATEGORY_BY_FIELD,
  type RegistrationFileField,
} from './registration.types.js';
import { registrationFileService } from './registration-file.service.js';
import { generateCtvCode } from './ctv-code.service.js';
import { translateRegistrationPrismaError } from './registration-errors.js';
import { toRequestDto } from './registration.mapper.js';

export {
  FILE_CATEGORY_BY_FIELD,
  type RegistrationFileField,
  type CreateRegistrationInput,
  type RegistrationFilesInput,
  type ListParams,
  type RegistrationRequestDto,
  type RegistrationDecisionResultDto,
};

export async function createRequest(
  input: CreateRegistrationInput,
  files: RegistrationFilesInput,
): Promise<RegistrationRequestDto> {
  const email = normalizeEmail(input.emailRaw);

  // Fast pre-check: active account or pending request
  const [existingAccount, pendingRequest] = await Promise.all([
    prisma.account.findFirst({ where: { email, deletedAt: null }, select: { id: true } }),
    prisma.registrationRequest.findFirst({
      where: { email, status: RegistrationStatus.PENDING },
      select: { id: true },
    }),
  ]);
  if (existingAccount || pendingRequest) {
    throw Errors.conflict('EMAIL_ALREADY_EXISTS', 'Email đã tồn tại hoặc đang chờ duyệt');
  }

  const passwordHash = await argon2.hash(input.password);
  const preparedEntries = registrationFileService.prepareFiles(files);
  const writtenKeys = await registrationFileService.saveFilesToStorage(preparedEntries);

  try {
    const created = await prisma.$transaction(async (tx) => {
      for (const e of preparedEntries) {
        await tx.fileAsset.create({
          data: {
            id: e.fileAssetId,
            storageKey: e.storageKey,
            originalName: e.file.originalname,
            mimeType: e.file.mimetype,
            sizeBytes: e.file.size,
            sha256: sha256Of(e.file.buffer),
            state: 'STAGED',
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
          status: RegistrationStatus.PENDING,
          files: preparedEntries.length
            ? {
                create: preparedEntries.map((e) => ({
                  fileAsset: { connect: { id: e.fileAssetId } },
                  category: e.category,
                })),
              }
            : undefined,
        },
        include: { files: { include: { fileAsset: true } } },
      });
    });

    return toRequestDto(created);
  } catch (err) {
    await registrationFileService.cleanupStorageFiles(writtenKeys);
    translateRegistrationPrismaError(err);
  }
}

export async function listPending({
  q,
  page = 1,
  pageSize = 20,
  status = RegistrationStatus.PENDING,
}: ListParams) {
  const where: Prisma.RegistrationRequestWhereInput = { status };
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { displayName: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
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

export async function decide(
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewedById: string,
  rejectionReason?: string,
): Promise<RegistrationDecisionResultDto> {
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Acquire row-level lock on RegistrationRequest to ensure atomic decision transition
      const lockedRows = await tx.$queryRaw<Array<{ id: string; status: RegistrationStatus }>>`
        SELECT id, status FROM "RegistrationRequest" WHERE id = ${requestId} FOR UPDATE
      `;
      const locked = lockedRows[0];
      if (!locked) {
        throw Errors.notFound('Không tìm thấy yêu cầu đăng ký');
      }
      if (locked.status !== RegistrationStatus.PENDING) {
        throw Errors.conflict('REGISTRATION_ALREADY_REVIEWED', 'Yêu cầu đã được xử lý trước đó');
      }

      if (decision === 'REJECTED') {
        const updated = await tx.registrationRequest.update({
          where: { id: requestId },
          data: {
            status: RegistrationStatus.REJECTED,
            reviewedById,
            reviewedAt: now,
            rejectionReason: rejectionReason ?? null,
            passwordHash: null,
          },
          include: { files: { include: { fileAsset: true } } },
        });
        return { request: updated, account: undefined };
      }

      // APPROVED decision path
      const request = await tx.registrationRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { files: { include: { fileAsset: true } } },
      });

      if (!request.passwordHash) {
        throw Errors.badRequest('MISSING_PASSWORD', 'Yêu cầu đăng ký không có mật khẩu');
      }

      // Verify physical files still exist on storage
      await registrationFileService.verifyFilesExist(request.files);

      // Check if an active account already exists with this email
      const activeAccount = await tx.account.findFirst({
        where: { email: request.email, deletedAt: null },
        select: { id: true },
      });
      if (activeAccount) {
        throw Errors.conflict(
          'EMAIL_ALREADY_EXISTS',
          'Tài khoản với email này đã tồn tại và đang hoạt động',
        );
      }

      // Concurrency-safe CTV code generation using PostgreSQL advisory lock
      const ctvCode = await generateCtvCode(tx);

      // Check for existing soft-deleted account to resurrect
      const existingDeleted = await tx.account.findFirst({
        where: { email: request.email, deletedAt: { not: null } },
      });

      let account;
      if (existingDeleted) {
        account = await tx.account.update({
          where: { id: existingDeleted.id },
          data: {
            passwordHash: request.passwordHash,
            role: 'CTV',
            status: 'ACTIVE',
            deletedAt: null,
            version: { increment: 1 },
            displayName: request.displayName,
            phone: request.phone,
            dateOfBirth: request.dateOfBirth,
            gender: request.gender,
            address: request.address,
            ctvCode: existingDeleted.ctvCode ?? ctvCode,
            joinedAt: now,
          },
        });
      } else {
        account = await tx.account.create({
          data: {
            email: request.email,
            passwordHash: request.passwordHash,
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
      }

      // Transactional migration of registration files to account files
      await registrationFileService.linkFilesToAccount(
        tx,
        account.id,
        request.files.map((rf) => ({ fileId: rf.fileId, category: rf.category })),
      );

      // Mark request as APPROVED
      const updatedRequest = await tx.registrationRequest.update({
        where: { id: requestId },
        data: {
          status: RegistrationStatus.APPROVED,
          reviewedById,
          reviewedAt: now,
          approvedAccountId: account.id,
          passwordHash: null,
        },
        include: { files: { include: { fileAsset: true } } },
      });

      return { request: updatedRequest, account };
    });

    const dto = toRequestDto(result.request);
    if (result.account) {
      return {
        ...dto,
        approvedAccount: {
          id: result.account.id,
          email: result.account.email,
          ctvCode: result.account.ctvCode,
        },
      };
    }
    return dto;
  } catch (error) {
    translateRegistrationPrismaError(error);
  }
}

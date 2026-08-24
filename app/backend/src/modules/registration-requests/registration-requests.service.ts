import argon2 from 'argon2';
import {
  AccountRole,
  AccountStatus,
  FileAssetState,
  type Prisma,
  type PrismaClient,
  type RegistrationRequest,
} from '@prisma/client';
import { ApiError } from '../../shared/api-error.js';
import { FileStorage, type StagedFile } from '../../shared/file-storage.js';
import { IdempotencyService, type ReplayedResponse } from '../../shared/idempotency.js';
import { prisma } from '../../shared/prisma.js';
import {
  toRegistrationCreatedDto,
  toRegistrationDecisionDto,
  toRegistrationDetailDto,
  toRegistrationSummaryDto,
} from './registration-requests.dto.js';
import type {
  RegistrationDecisionInput,
  RegistrationListQuery,
  RegistrationProfileInput,
} from './registration-requests.schemas.js';

export class RegistrationRequestsService {
  private readonly idempotency: IdempotencyService;

  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly fileStorage: FileStorage = new FileStorage(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.idempotency = new IdempotencyService(database, now);
  }

  async create(
    key: string,
    profile: RegistrationProfileInput,
    files: StagedFile[],
  ): Promise<ReplayedResponse> {
    const requestHash = this.idempotency.requestHash({
      profile: { ...profile, dateOfBirth: profile.dateOfBirth?.toISOString() },
      files: files.map(({ category, originalName, mimeType, sizeBytes, sha256 }) => (
        { category, originalName, mimeType, sizeBytes, sha256 }
      )).sort((left, right) => left.category.localeCompare(right.category)),
    });
    const replay = await this.idempotency.replay(key, requestHash);
    if (replay) {
      await this.discard(files);
      return replay;
    }

    const existingAccount = await this.database.account.findUnique({ where: { email: profile.email } });
    if (existingAccount) {
      await this.discard(files);
      throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists for this email address.');
    }

    const passwordHash = await argon2.hash(profile.password, { type: argon2.argon2id });
    let requestId: string | undefined;
    try {
      const response = await this.database.$transaction(async (transaction) => {
        const concurrentReplay = await this.idempotency.replay(key, requestHash, transaction);
        if (concurrentReplay) return concurrentReplay;

        const createdFiles = await Promise.all(files.map((file) => transaction.fileAsset.create({
          data: {
            storageKey: file.storageKey,
            originalName: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            sha256: file.sha256,
            state: FileAssetState.STAGED,
          },
        })));
        const registrationRequest = await transaction.registrationRequest.create({
          data: {
            email: profile.email,
            passwordHash,
            displayName: profile.displayName,
            phone: profile.phone,
            dateOfBirth: profile.dateOfBirth,
            gender: profile.gender,
            address: profile.address,
            files: {
              create: createdFiles.map((file, index) => ({ fileId: file.id, category: files[index].category })),
            },
          },
        });
        requestId = registrationRequest.id;
        const result = { statusCode: 201, body: { data: toRegistrationCreatedDto(registrationRequest) } };
        await transaction.idempotencyRecord.create({ data: this.idempotency.recordData(key, requestHash, result) });
        return result;
      });

      await Promise.all(files.map((file) => this.fileStorage.finalize(file)));
      if (files.length) {
        await this.database.fileAsset.updateMany({
          where: { storageKey: { in: files.map((file) => file.storageKey) } },
          data: { state: FileAssetState.ACTIVE },
        });
      }
      return response;
    } catch (error) {
      await Promise.allSettled(files.map((file) => this.fileStorage.quarantine(file)));
      if (requestId) {
        await this.database.$transaction([
          this.database.idempotencyRecord.deleteMany({ where: { key: this.idempotency.keyHash(key) } }),
          this.database.registrationRequest.deleteMany({ where: { id: requestId } }),
          this.database.fileAsset.deleteMany({ where: { storageKey: { in: files.map((file) => file.storageKey) } } }),
        ]).catch(() => undefined);
      }
      throw error;
    }
  }

  async list(query: RegistrationListQuery) {
    const where: Prisma.RegistrationRequestWhereInput = {
      status: query.status,
      ...(query.q ? {
        OR: [
          { displayName: { contains: query.q } },
          { email: { contains: query.q } },
          { phone: { contains: query.q } },
        ],
      } : {}),
    };
    const [items, total] = await this.database.$transaction([
      this.database.registrationRequest.findMany({
        where,
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.registrationRequest.count({ where }),
    ]);
    return {
      items: items.map(toRegistrationSummaryDto),
      pagination: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async detail(requestId: string) {
    const registrationRequest = await this.database.registrationRequest.findUnique({
      where: { id: requestId },
      include: { files: { include: { file: true } } },
    });
    if (!registrationRequest) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Registration request was not found.');
    return toRegistrationDetailDto(registrationRequest);
  }

  async decide(requestId: string, reviewerId: string, input: RegistrationDecisionInput) {
    try {
      return await this.database.$transaction(async (transaction) => {
        const current = await transaction.registrationRequest.findUnique({
          where: { id: requestId },
          include: { files: true },
        });
        if (!current) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Registration request was not found.');

        const reviewedAt = this.now();
        const claimed = await transaction.registrationRequest.updateMany({
          where: { id: requestId, status: input.expectedStatus },
          data: {
            status: input.decision,
            reviewedById: reviewerId,
            reviewedAt,
            rejectionReason: input.decision === 'REJECTED' ? input.rejectionReason : null,
            passwordHash: '',
          },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, 'REGISTRATION_ALREADY_REVIEWED', 'Registration request was already reviewed.');
        }

        let approvedAccountId: string | undefined;
        if (input.decision === 'APPROVED') {
          const account = await transaction.account.create({
            data: {
              email: current.email,
              passwordHash: current.passwordHash,
              role: AccountRole.CTV,
              status: AccountStatus.ACTIVE,
              mustChangePassword: false,
              displayName: current.displayName,
              phone: current.phone,
              dateOfBirth: current.dateOfBirth,
              gender: current.gender,
              address: current.address,
              ctvCode: ctvCodeFor(current),
              joinedAt: reviewedAt,
            },
          });
          approvedAccountId = account.id;
          if (current.files.length) {
            await transaction.accountFile.createMany({
              data: current.files.map((file) => ({
                accountId: account.id,
                fileId: file.fileId,
                category: file.category,
              })),
          });
          }
          await transaction.notification.create({
            data: {
              accountId: account.id,
              type: 'REGISTRATION_APPROVED',
              title: 'Hồ sơ đăng ký đã được phê duyệt',
              message: 'Tài khoản CTV của bạn đã được kích hoạt.',
              sourceType: 'REGISTRATION_REQUEST',
              sourceId: requestId,
            },
          });
          await transaction.registrationRequest.update({
            where: { id: requestId },
            data: { approvedAccountId: account.id },
          });
        }

        const reviewed = await transaction.registrationRequest.findUniqueOrThrow({ where: { id: requestId } });
        return toRegistrationDecisionDto({ ...reviewed, approvedAccountId: approvedAccountId ?? reviewed.approvedAccountId });
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ApiError(409, 'ACCOUNT_ALREADY_EXISTS', 'An account already exists for this registration.');
      }
      throw error;
    }
  }

  private async discard(files: StagedFile[]): Promise<void> {
    await Promise.allSettled(files.map((file) => this.fileStorage.discard(file)));
  }
}

function ctvCodeFor(request: RegistrationRequest): string {
  return `CTV-${request.id.slice(-12).toUpperCase()}`;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'P2002';
}

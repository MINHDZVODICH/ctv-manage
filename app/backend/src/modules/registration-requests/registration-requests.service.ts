import argon2 from 'argon2';
import {
  AccountRole,
  AccountStatus,
  FileAssetState,
  IdempotencyRecordStatus,
  Prisma,
  type IdempotencyRecord,
  type PrismaClient,
  type RegistrationRequest,
} from '@prisma/client';
import { ApiError } from '../../shared/api-error.js';
import { FileStorage, type StageFileInput, type StagedFile } from '../../shared/file-storage.js';
import { IdempotencyService, type StoredResponse } from '../../shared/idempotency.js';
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

export interface CreateRegistrationInput {
  scope: string;
  fingerprint: string;
  key: string;
  profile: RegistrationProfileInput;
  files: StageFileInput[];
}

type RequestWithFiles = Prisma.RegistrationRequestGetPayload<{
  include: { files: { include: { file: true } } };
}>;

export class RegistrationRequestsService {
  private readonly idempotency: IdempotencyService;

  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly fileStorage: FileStorage = new FileStorage(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.idempotency = new IdempotencyService(database, now);
  }

  async create(input: CreateRegistrationInput): Promise<StoredResponse> {
    const descriptors = input.files.map((file) => this.fileStorage.inspect(file, placeholderStorageKey(file)));
    const requestHash = this.idempotency.requestHash({
      profile: { ...input.profile, dateOfBirth: input.profile.dateOfBirth?.toISOString() },
      files: descriptors.map(({ category, originalName, mimeType, sizeBytes, sha256 }) => (
        { category, originalName, mimeType, sizeBytes, sha256 }
      )).sort((left, right) => left.category.localeCompare(right.category)),
    });

    // Password hashing is deliberately completed before the first database or filesystem I/O.
    const passwordHash = await argon2.hash(input.profile.password, { type: argon2.argon2id });
    const reservation = await this.idempotency.reserve({
      scope: input.scope,
      fingerprint: input.fingerprint,
      key: input.key,
      requestHash,
    });
    if (reservation.kind === 'in-progress') {
      throw new ApiError(409, 'IDEMPOTENCY_REQUEST_IN_PROGRESS', 'A matching registration is still being processed.');
    }
    if (reservation.kind === 'replay') {
      await this.verifyCompletedResult(reservation.record);
      return reservation.response;
    }

    const files = input.files.map((file) => this.fileStorage.inspect(
      file,
      this.fileStorage.deterministicKey(reservation.workflowKey, file),
    ));
    let requestId: string | undefined;
    try {
      const existingAccount = await this.database.account.findUnique({ where: { email: input.profile.email } });
      if (existingAccount) {
        throw new ApiError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists for this email address.');
      }

      const registrationRequest = await this.database.$transaction(async (transaction) => {
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
        const created = await transaction.registrationRequest.create({
          data: {
            email: input.profile.email,
            passwordHash,
            displayName: input.profile.displayName,
            phone: input.profile.phone,
            dateOfBirth: input.profile.dateOfBirth,
            gender: input.profile.gender,
            address: input.profile.address,
            files: {
              create: createdFiles.map((file, index) => ({ fileId: file.id, category: files[index].category })),
            },
          },
        });
        const attached = await transaction.idempotencyRecord.updateMany({
          where: { id: reservation.record.id, status: IdempotencyRecordStatus.IN_PROGRESS, resourceId: null },
          data: { resourceId: created.id },
        });
        if (attached.count !== 1) {
          throw new ApiError(500, 'IDEMPOTENCY_WORKFLOW_CORRUPTED', 'Could not attach registration workflow state.');
        }
        return created;
      });
      requestId = registrationRequest.id;

      for (let index = 0; index < input.files.length; index += 1) {
        await this.fileStorage.stage(input.files[index], files[index].storageKey);
      }
      for (const file of files) await this.fileStorage.finalize(file);
      for (const file of files) await this.fileStorage.verifyActive(file);

      const response: StoredResponse = {
        statusCode: 201,
        body: { data: toRegistrationCreatedDto(registrationRequest) },
      };
      await this.completeWorkflow(reservation.record.id, registrationRequest.id, files, response);
      return response;
    } catch (error) {
      await this.compensateOrThrow(reservation.record.id, requestId, files, error);
      throw error;
    }
  }

  async reconcileIncomplete(): Promise<void> {
    const records = await this.database.idempotencyRecord.findMany({
      where: { scope: 'registration:create', status: IdempotencyRecordStatus.IN_PROGRESS },
      orderBy: { createdAt: 'asc' },
    });
    for (const record of records) await this.reconcileRecord(record);
    const quarantined = await this.database.fileAsset.findMany({
      where: { state: FileAssetState.QUARANTINED },
    });
    for (const file of quarantined) {
      try {
        await this.fileStorage.verifyQuarantined(file);
      } catch {
        await this.database.fileAsset.update({
          where: { id: file.id },
          data: { state: FileAssetState.DELETED },
        });
      }
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
      const candidate = await this.database.registrationRequest.findUnique({
        where: { id: requestId },
        include: { files: { include: { file: true } } },
      });
      if (!candidate) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Registration request was not found.');
      if (input.decision === 'APPROVED') await this.requireAvailableFiles(candidate);

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

  private async completeWorkflow(
    recordId: string,
    requestId: string,
    files: StagedFile[],
    response: StoredResponse,
  ): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      if (files.length) {
        const activated = await transaction.fileAsset.updateMany({
          where: {
            storageKey: { in: files.map((file) => file.storageKey) },
            state: { in: [FileAssetState.STAGED, FileAssetState.ACTIVE] },
          },
          data: { state: FileAssetState.ACTIVE },
        });
        if (activated.count !== files.length) {
          throw new ApiError(500, 'REGISTRATION_FILE_STATE_CONFLICT', 'Could not activate every registration file.');
        }
      }
      await this.idempotency.complete(transaction, recordId, requestId, response);
    });
  }

  private async verifyCompletedResult(record: IdempotencyRecord): Promise<void> {
    if (!record.resourceId) {
      throw new ApiError(409, 'IDEMPOTENCY_RESULT_UNAVAILABLE', 'The completed registration resource is unavailable.');
    }
    const registration = await this.database.registrationRequest.findUnique({
      where: { id: record.resourceId },
      include: { files: { include: { file: true } } },
    });
    if (!registration) {
      throw new ApiError(409, 'IDEMPOTENCY_RESULT_UNAVAILABLE', 'The completed registration resource is unavailable.');
    }
    await this.requireAvailableFiles(registration, 'IDEMPOTENCY_RESULT_UNAVAILABLE');
  }

  private async requireAvailableFiles(
    request: RequestWithFiles,
    code = 'REGISTRATION_FILES_UNAVAILABLE',
  ): Promise<void> {
    try {
      for (const { file } of request.files) {
        if (file.state !== FileAssetState.ACTIVE) throw new Error(`File ${file.id} is not ACTIVE.`);
        await this.fileStorage.verifyActive(file);
      }
    } catch {
      throw new ApiError(409, code, 'Registration files are not active and physically available.');
    }
  }

  private async reconcileRecord(record: IdempotencyRecord): Promise<void> {
    if (!record.resourceId) {
      await this.database.idempotencyRecord.delete({ where: { id: record.id } });
      return;
    }
    const request = await this.database.registrationRequest.findUnique({
      where: { id: record.resourceId },
      include: { files: { include: { file: true } } },
    });
    if (!request) {
      await this.database.idempotencyRecord.delete({ where: { id: record.id } });
      return;
    }
    const files = request.files.map(({ category, file }) => ({ ...file, category }));
    try {
      if (files.some((file) => file.state === FileAssetState.QUARANTINED)) {
        throw new Error('Workflow contains quarantined files.');
      }
      for (const file of files) await this.fileStorage.finalize(file);
      for (const file of files) await this.fileStorage.verifyActive(file);
      await this.completeWorkflow(record.id, request.id, files, {
        statusCode: 201,
        body: { data: toRegistrationCreatedDto(request) },
      });
    } catch (error) {
      await this.compensateOrThrow(record.id, request.id, files, error);
    }
  }

  private async compensateOrThrow(
    recordId: string,
    requestId: string | undefined,
    files: StagedFile[],
    originalError: unknown,
  ): Promise<void> {
    const cleanupErrors: unknown[] = [];
    const quarantined = await Promise.allSettled(files.map((file) => this.fileStorage.quarantine(file)));
    cleanupErrors.push(...quarantined.filter((result) => result.status === 'rejected').map((result) => result.reason));
    try {
      await this.database.$transaction(async (transaction) => {
        if (requestId) await transaction.registrationRequest.deleteMany({ where: { id: requestId } });
        for (let index = 0; index < files.length; index += 1) {
          const result = quarantined[index];
          if (result.status === 'fulfilled' && result.value) {
            const updated = await transaction.fileAsset.updateMany({
              where: { storageKey: files[index].storageKey },
              data: { storageKey: result.value, state: FileAssetState.QUARANTINED },
            });
            if (updated.count !== 1) {
              throw new Error(`Could not persist quarantine metadata for ${files[index].storageKey}.`);
            }
          } else if (result.status === 'fulfilled') {
            await transaction.fileAsset.deleteMany({ where: { storageKey: files[index].storageKey } });
          }
        }
        await transaction.idempotencyRecord.deleteMany({ where: { id: recordId } });
      });
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length) {
      throw new AggregateError([originalError, ...cleanupErrors], 'Registration workflow compensation failed.');
    }
  }
}

function placeholderStorageKey(file: StageFileInput): string {
  const extension = file.originalName.slice(file.originalName.lastIndexOf('.')).toLowerCase();
  return `${'0'.repeat(48)}${extension}`;
}

function ctvCodeFor(request: RegistrationRequest): string {
  return `CTV-${request.id.slice(-12).toUpperCase()}`;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

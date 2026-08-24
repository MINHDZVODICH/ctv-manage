import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  AccountRole,
  AccountStatus,
  FileAssetState,
  FileCategory,
  IdempotencyRecordStatus,
  ShiftAssignmentStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { ApiError } from '../../shared/api-error.js';
import { FileStorage, type StageFileInput, type StagedFile } from '../../shared/file-storage.js';
import { IdempotencyService, type StoredResponse } from '../../shared/idempotency.js';
import { prisma } from '../../shared/prisma.js';
import { toAccountDetailDto, toAccountSummaryDto, toFileDto, toSelfProfileDto } from './accounts.dto.js';
import type {
  AccountListQuery,
  AccountNotesInput,
  AccountStatusInput,
  AccountUpdateInput,
  PasswordChangeInput,
  PasswordResetInput,
} from './accounts.schemas.js';

const activeFiles = {
  where: { deletedAt: null, file: { state: FileAssetState.ACTIVE, deletedAt: null } },
  include: { file: true },
} satisfies Prisma.AccountFileFindManyArgs;

export class AccountsService {
  private readonly idempotency: IdempotencyService;

  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly fileStorage: FileStorage = new FileStorage(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.idempotency = new IdempotencyService(database, now);
  }

  async list(query: AccountListQuery) {
    const q = query.q.trim();
    const where: Prisma.AccountWhereInput = {
      role: AccountRole.CTV,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(q ? { OR: [
        { displayName: { contains: q } }, { email: { contains: q } },
        { phone: { contains: q } }, { ctvCode: { contains: q } },
      ] } : {}),
    };
    const [items, total] = await this.database.$transaction([
      this.database.account.findMany({
        where,
        include: { accountFiles: activeFiles },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.account.count({ where }),
    ]);
    return { items: items.map(toAccountSummaryDto), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(accountId: string) {
    return toAccountDetailDto(await this.requireVisibleAccount(accountId));
  }

  async me(accountId: string) {
    const account = await this.database.account.findFirst({
      where: { id: accountId, deletedAt: null }, include: { accountFiles: activeFiles },
    });
    if (!account) throw notFound();
    return toSelfProfileDto(account);
  }

  async update(accountId: string, input: AccountUpdateInput, self = false) {
    const data = profileData(input);
    const updated = await this.database.account.updateMany({
      where: { id: accountId, deletedAt: null, version: input.version, ...(self ? {} : { role: AccountRole.CTV }) },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count !== 1) await this.throwMissingOrConflict(accountId, input.version, self);
    return self ? this.me(accountId) : this.detail(accountId);
  }

  async updateNotes(accountId: string, input: AccountNotesInput) {
    const updated = await this.database.account.updateMany({
      where: { id: accountId, role: AccountRole.CTV, deletedAt: null, version: input.version },
      data: { adminNotes: input.notes || null, version: { increment: 1 } },
    });
    if (updated.count !== 1) await this.throwMissingOrConflict(accountId, input.version, false);
    return this.detail(accountId);
  }

  async updateStatus(accountId: string, input: AccountStatusInput) {
    const changedAt = this.now();
    await this.database.$transaction(async (transaction) => {
      const updated = await transaction.account.updateMany({
        where: { id: accountId, role: AccountRole.CTV, deletedAt: null, version: input.version },
        data: { status: input.status, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        const existing = await transaction.account.findFirst({ where: { id: accountId, role: AccountRole.CTV, deletedAt: null } });
        if (!existing) throw notFound();
        throw versionConflict();
      }
      if (input.status === AccountStatus.DISABLED) {
        await transaction.session.updateMany({
          where: { accountId, revokedAt: null }, data: { revokedAt: changedAt },
        });
        await transaction.shiftAssignment.updateMany({
          where: { accountId, status: ShiftAssignmentStatus.ACTIVE, shift: { workDate: { gt: changedAt } } },
          data: { status: ShiftAssignmentStatus.CANCELLED, cancelledAt: changedAt, cancellationReason: 'ACCOUNT_DISABLED' },
        });
      }
    });
    return this.detail(accountId);
  }

  async softDelete(accountId: string): Promise<void> {
    const deletedAt = this.now();
    await this.database.$transaction(async (transaction) => {
      const target = await transaction.account.findUnique({ where: { id: accountId } });
      if (!target || target.role !== AccountRole.CTV || target.deletedAt) return;
      await transaction.account.update({
        where: { id: accountId },
        data: { deletedAt, status: AccountStatus.DISABLED, version: { increment: 1 } },
      });
      await transaction.session.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: deletedAt } });
      await transaction.shiftAssignment.updateMany({
        where: { accountId, status: ShiftAssignmentStatus.ACTIVE, shift: { workDate: { gt: deletedAt } } },
        data: { status: ShiftAssignmentStatus.CANCELLED, cancelledAt: deletedAt, cancellationReason: 'ACCOUNT_DELETED' },
      });
    });
  }

  async changePassword(accountId: string, input: PasswordChangeInput) {
    const account = await this.database.account.findFirst({ where: { id: accountId, deletedAt: null } });
    if (!account) throw notFound();
    if (!await argon2.verify(account.passwordHash, input.currentPassword)) {
      throw new ApiError(400, 'CURRENT_PASSWORD_INVALID', 'Current password is invalid.');
    }
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    const changedAt = this.now();
    const revokedSessionCount = await this.database.$transaction(async (transaction) => {
      await transaction.account.update({ where: { id: accountId }, data: {
        passwordHash, mustChangePassword: false, passwordChangedAt: changedAt, version: { increment: 1 },
      } });
      return (await transaction.session.updateMany({
        where: { accountId, revokedAt: null }, data: { revokedAt: changedAt },
      })).count;
    });
    return { accountId, mustChangePassword: false, changedAt: changedAt.toISOString(), revokedSessionCount };
  }

  async resetPassword(accountId: string, adminId: string, key: string, input: PasswordResetInput): Promise<StoredResponse> {
    const requestHash = this.idempotency.requestHash({ accountId, ...input });
    const reservation = await this.idempotency.reserve({
      scope: `account-password-reset:${accountId}`,
      fingerprint: `admin:${adminId}`,
      key,
      requestHash,
    });
    if (reservation.kind === 'replay') return reservation.response;
    if (reservation.kind === 'in-progress') {
      throw new ApiError(409, 'IDEMPOTENCY_REQUEST_IN_PROGRESS', 'A matching password reset is still being processed.');
    }
    try {
      const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
      const changedAt = this.now();
      const response = await this.database.$transaction(async (transaction) => {
        const account = await transaction.account.findFirst({
          where: { id: accountId, role: AccountRole.CTV, deletedAt: null },
        });
        if (!account) throw notFound();
        await transaction.account.update({ where: { id: accountId }, data: {
          passwordHash,
          mustChangePassword: input.requireChangeOnLogin,
          passwordChangedAt: changedAt,
          version: { increment: 1 },
        } });
        const revokedSessionCount = (await transaction.session.updateMany({
          where: { accountId, revokedAt: null }, data: { revokedAt: changedAt },
        })).count;
        const body = { data: {
          accountId,
          mustChangePassword: input.requireChangeOnLogin,
          changedAt: changedAt.toISOString(),
          revokedSessionCount,
        } };
        const attached = await transaction.idempotencyRecord.updateMany({
          where: { id: reservation.record.id, status: IdempotencyRecordStatus.IN_PROGRESS, resourceId: null },
          data: { resourceId: accountId },
        });
        if (attached.count !== 1) throw new ApiError(500, 'IDEMPOTENCY_WORKFLOW_CORRUPTED', 'Password reset workflow changed unexpectedly.');
        await this.idempotency.complete(transaction, reservation.record.id, accountId, { statusCode: 200, body });
        return body;
      });
      return { statusCode: 200, body: response };
    } catch (error) {
      await this.database.idempotencyRecord.deleteMany({
        where: { id: reservation.record.id, status: IdempotencyRecordStatus.IN_PROGRESS, resourceId: null },
      });
      throw error;
    }
  }

  async openFile(fileId: string, actor: { id: string; role: 'ADMIN' | 'CTV' }) {
    const accountLink = await this.database.accountFile.findFirst({
      where: {
        fileId, deletedAt: null,
        account: { deletedAt: null, ...(actor.role === AccountRole.ADMIN ? {} : { id: actor.id }) },
        file: { state: FileAssetState.ACTIVE, deletedAt: null },
      },
      include: { file: true },
    });
    const registrationLink = !accountLink && actor.role === AccountRole.ADMIN
      ? await this.database.registrationRequestFile.findFirst({
          where: { fileId, file: { state: FileAssetState.ACTIVE, deletedAt: null } },
          include: { file: true },
        })
      : null;
    const link = accountLink ?? registrationLink;
    if (!link) throw notFound('File was not found.');
    try {
      await this.fileStorage.verifyActive(link.file);
      const opened = await this.fileStorage.open(link.file.storageKey);
      if (opened.sizeBytes !== link.file.sizeBytes) throw new Error('File size mismatch.');
      return { path: opened.path, file: link.file, category: link.category };
    } catch {
      throw notFound('File was not found.');
    }
  }

  async replaceFile(accountId: string, file: StageFileInput, admin = false) {
    await this.requireFileTarget(accountId, admin);
    const storageKey = this.fileStorage.deterministicKey(`account-file:${randomUUID()}`, file);
    const staged = this.fileStorage.inspect(file, storageKey);
    let assetId: string | undefined;
    let activated: Awaited<ReturnType<AccountsService['activateFileReplacement']>> | undefined;
    try {
      const asset = await this.database.fileAsset.create({ data: {
        ...fileAssetData(staged),
        accountFiles: { create: { accountId, category: file.category } },
      } });
      assetId = asset.id;
      await this.fileStorage.stage(file, storageKey);
      await this.fileStorage.finalize(staged);
      await this.fileStorage.verifyActive(staged);
      activated = await this.activateFileReplacement(accountId, file.category, asset.id);
    } catch (error) {
      if (assetId) await this.compensateFileReplacement(assetId, staged);
      throw error;
    }
    await Promise.all(activated.previous.map((entry) => this.fileStorage.remove(entry.file.storageKey)));
    return toFileDto(activated.active, file.category);
  }

  async reconcileIncompleteFileReplacements(): Promise<void> {
    const incomplete = await this.database.fileAsset.findMany({
      where: {
        state: { in: [FileAssetState.STAGED, FileAssetState.QUARANTINED] },
        accountFiles: { some: { deletedAt: null } },
      },
      include: { accountFiles: { where: { deletedAt: null } } },
      orderBy: { createdAt: 'asc' },
    });
    for (const asset of incomplete) {
      const link = asset.accountFiles[0];
      if (!link) continue;
      const descriptor: StagedFile = { ...asset, category: link.category };
      if (asset.state === FileAssetState.QUARANTINED) {
        await this.resolveQuarantinedIntent(asset.id, descriptor);
        continue;
      }
      let activated: Awaited<ReturnType<AccountsService['activateFileReplacement']>> | undefined;
      try {
        await this.fileStorage.finalize(descriptor);
        await this.fileStorage.verifyActive(descriptor);
        activated = await this.activateFileReplacement(link.accountId, link.category, asset.id);
      } catch (error) {
        await this.compensateFileReplacement(asset.id, descriptor);
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      if (activated) await Promise.all(activated.previous.map((entry) => this.fileStorage.remove(entry.file.storageKey)));
    }
  }

  async deleteFile(accountId: string, category: FileCategory, admin = false): Promise<void> {
    await this.requireFileTarget(accountId, admin);
    const deletedAt = this.now();
    const removed = await this.database.$transaction(async (transaction) => {
      const links = await transaction.accountFile.findMany({
        where: { accountId, category, deletedAt: null }, include: { file: true },
      });
      if (!links.length) return [];
      await transaction.accountFile.updateMany({ where: { accountId, category, deletedAt: null }, data: { deletedAt } });
      await transaction.fileAsset.updateMany({
        where: { id: { in: links.map((entry) => entry.fileId) } },
        data: { state: FileAssetState.DELETED, deletedAt },
      });
      return links.map((entry) => entry.file.storageKey);
    });
    await Promise.all(removed.map((storageKey) => this.fileStorage.remove(storageKey)));
  }

  private async activateFileReplacement(accountId: string, category: FileCategory, assetId: string) {
    return this.database.$transaction(async (transaction) => {
      const intent = await transaction.accountFile.findUnique({ where: { accountId_fileId: { accountId, fileId: assetId } } });
      if (!intent || intent.deletedAt || intent.category !== category) {
        throw new ApiError(500, 'FILE_REPLACEMENT_INTENT_MISSING', 'File replacement intent is missing.');
      }
      const replacedAt = this.now();
      const previous = await transaction.accountFile.findMany({
        where: { accountId, category, deletedAt: null, fileId: { not: assetId }, file: { state: FileAssetState.ACTIVE } },
        include: { file: true },
      });
      if (previous.length) {
        await transaction.accountFile.updateMany({
          where: { accountId, category, deletedAt: null, fileId: { in: previous.map((entry) => entry.fileId) } },
          data: { deletedAt: replacedAt },
        });
        await transaction.fileAsset.updateMany({
          where: { id: { in: previous.map((entry) => entry.fileId) } },
          data: { state: FileAssetState.DELETED, deletedAt: replacedAt },
        });
      }
      const activated = await transaction.fileAsset.updateMany({
        where: { id: assetId, state: FileAssetState.STAGED, deletedAt: null },
        data: { state: FileAssetState.ACTIVE },
      });
      if (activated.count !== 1) throw new ApiError(500, 'FILE_REPLACEMENT_STATE_INVALID', 'File replacement state changed unexpectedly.');
      return { active: await transaction.fileAsset.findUniqueOrThrow({ where: { id: assetId } }), previous };
    });
  }

  private async compensateFileReplacement(assetId: string, file: StagedFile): Promise<void> {
    const failures: unknown[] = [];
    let quarantined: string | undefined;
    try { quarantined = await this.fileStorage.quarantine(file); } catch (error) { failures.push(error); }
    try {
      await this.database.$transaction([
        this.database.accountFile.updateMany({ where: { fileId: assetId, deletedAt: null }, data: { deletedAt: this.now() } }),
        this.database.fileAsset.updateMany({
          where: { id: assetId, state: FileAssetState.STAGED },
          data: quarantined
            ? { storageKey: quarantined, state: FileAssetState.QUARANTINED }
            : { state: FileAssetState.DELETED, deletedAt: this.now() },
        }),
      ]);
    } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Account file replacement cleanup failed.');
  }

  private async resolveQuarantinedIntent(assetId: string, file: StagedFile): Promise<void> {
    let present = true;
    try { await this.fileStorage.verifyQuarantined(file); } catch { present = false; }
    const unlink = this.database.accountFile.updateMany({ where: { fileId: assetId, deletedAt: null }, data: { deletedAt: this.now() } });
    if (present) await unlink;
    else await this.database.$transaction([
      unlink,
      this.database.fileAsset.updateMany({
        where: { id: assetId, state: FileAssetState.QUARANTINED },
        data: { state: FileAssetState.DELETED, deletedAt: this.now() },
      }),
    ]);
  }

  private async requireVisibleAccount(accountId: string) {
    const account = await this.database.account.findFirst({
      where: { id: accountId, role: AccountRole.CTV, deletedAt: null },
      include: { accountFiles: activeFiles },
    });
    if (!account) throw notFound();
    return account;
  }

  private async requireFileTarget(accountId: string, admin: boolean): Promise<void> {
    const account = await this.database.account.findFirst({
      where: { id: accountId, deletedAt: null, ...(admin ? { role: AccountRole.CTV } : {}) },
    });
    if (!account) throw notFound();
  }

  private async throwMissingOrConflict(accountId: string, expectedVersion: number, self: boolean): Promise<never> {
    const account = await this.database.account.findFirst({
      where: { id: accountId, deletedAt: null, ...(self ? {} : { role: AccountRole.CTV }) },
    });
    if (!account) throw notFound();
    if (account.version !== expectedVersion) throw versionConflict();
    throw new ApiError(409, 'ACCOUNT_UPDATE_CONFLICT', 'The account could not be updated.');
  }
}

function profileData(input: AccountUpdateInput): Prisma.AccountUpdateManyMutationInput {
  return {
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.phone === undefined ? {} : { phone: input.phone || null }),
    ...(input.dateOfBirth === undefined ? {} : { dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null }),
    ...(input.gender === undefined ? {} : { gender: input.gender || null }),
    ...(input.address === undefined ? {} : { address: input.address || null }),
  };
}

function fileAssetData(file: StagedFile): Prisma.FileAssetCreateInput {
  return {
    storageKey: file.storageKey, originalName: file.originalName, mimeType: file.mimeType,
    sizeBytes: file.sizeBytes, sha256: file.sha256, state: FileAssetState.STAGED,
  };
}

function notFound(message = 'Account was not found.'): ApiError {
  return new ApiError(404, 'RESOURCE_NOT_FOUND', message);
}

function versionConflict(): ApiError {
  return new ApiError(409, 'VERSION_CONFLICT', 'The account was updated by another request.');
}

export function fileCategoryFromSlug(slug: string): FileCategory {
  const categories: Record<string, FileCategory> = {
    avatar: FileCategory.AVATAR,
    'cccd-front': FileCategory.CCCD_FRONT,
    'cccd-back': FileCategory.CCCD_BACK,
    cv: FileCategory.CV,
  };
  const category = categories[slug];
  if (!category) throw new ApiError(422, 'VALIDATION_FAILED', 'File category is invalid.');
  return category;
}

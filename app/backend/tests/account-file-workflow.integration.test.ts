import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import { AccountRole, AccountStatus, FileAssetState, FileCategory } from '@prisma/client';
import { afterAll, beforeEach, describe, test } from 'vitest';
import { AccountsService } from '../src/modules/accounts/accounts.service.js';
import { FileStorage, type StageFileInput, type StagedFile } from '../src/shared/file-storage.js';
import { prisma } from '../src/shared/prisma.js';
import { resetTestDatabase } from './test-database.js';

const roots: string[] = [];

describe.sequential('durable account file replacement workflow', () => {
  beforeEach(async () => resetTestDatabase(prisma));
  afterAll(async () => { await prisma.$disconnect(); await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); });

  test('finalize failure quarantines metadata and leaves no active orphan or live link', async () => {
    const root = await temporaryRoot();
    const service = new AccountsService(prisma, new FailingFinalizeStorage(root));
    const accountId = await createCtv();
    await assert.rejects(service.replaceFile(accountId, fileInput()));
    assert.equal(await prisma.accountFile.count({ where: { accountId, deletedAt: null } }), 0);
    assert.equal(await prisma.fileAsset.count({ where: { state: FileAssetState.QUARANTINED } }), 1);
    assert.equal((await entries(root, 'active')).length, 0);
    assert.equal((await entries(root, 'quarantine')).length, 1);
  });

  test('a final activation transaction failure is compensated without orphan active bytes', async () => {
    const root = await temporaryRoot();
    const accountId = await createCtv();
    const service = new AccountsService(prisma, new DeleteIntentAfterFinalizeStorage(root));
    await assert.rejects(service.replaceFile(accountId, fileInput()));
    assert.equal(await prisma.accountFile.count({ where: { accountId, deletedAt: null } }), 0);
    assert.equal(await prisma.fileAsset.count({ where: { state: FileAssetState.QUARANTINED } }), 1);
    assert.equal((await entries(root, 'active')).length, 0);
  });

  test('startup reconciliation completes an interrupted finalized STAGED replacement exactly once', async () => {
    const root = await temporaryRoot();
    const storage = new FileStorage(root);
    const accountId = await createCtv();
    const old = await activeFile(storage, accountId, 'old.png', '1'.repeat(48) + '.png');
    const staged = await storage.stage(fileInput(), '2'.repeat(48) + '.png');
    await prisma.fileAsset.create({ data: {
      storageKey: staged.storageKey, originalName: staged.originalName, mimeType: staged.mimeType,
      sizeBytes: staged.sizeBytes, sha256: staged.sha256, state: FileAssetState.STAGED,
      accountFiles: { create: { accountId, category: FileCategory.AVATAR } },
    } });
    await storage.finalize(staged);

    const service = new AccountsService(prisma, storage);
    await service.reconcileIncompleteFileReplacements();
    await service.reconcileIncompleteFileReplacements();

    const live = await prisma.accountFile.findMany({ where: { accountId, category: FileCategory.AVATAR, deletedAt: null }, include: { file: true } });
    assert.equal(live.length, 1);
    assert.equal(live[0].file.state, FileAssetState.ACTIVE);
    assert.equal(live[0].file.storageKey, staged.storageKey);
    assert.equal((await prisma.fileAsset.findUniqueOrThrow({ where: { id: old } })).state, FileAssetState.DELETED);
    assert.equal((await entries(root, 'active')).length, 1);
  });

  test('startup reconciliation resolves a QUARANTINED intent whose physical bytes are missing', async () => {
    const root = await temporaryRoot();
    const accountId = await createCtv();
    const asset = await prisma.fileAsset.create({ data: {
      storageKey: '3'.repeat(48) + '.png', originalName: 'missing.png', mimeType: 'image/png',
      sizeBytes: 9, sha256: '4'.repeat(64), state: FileAssetState.QUARANTINED,
      accountFiles: { create: { accountId, category: FileCategory.AVATAR } },
    } });
    await new AccountsService(prisma, new FileStorage(root)).reconcileIncompleteFileReplacements();
    assert.equal((await prisma.fileAsset.findUniqueOrThrow({ where: { id: asset.id } })).state, FileAssetState.DELETED);
    assert.equal(await prisma.accountFile.count({ where: { accountId, deletedAt: null } }), 0);
  });

  test('a category delete linearizes before a gated replacement without deleting its STAGED intent', async () => {
    const root = await temporaryRoot();
    const storage = new BlockingStageStorage(root);
    const accountId = await createCtv();
    const oldId = await activeFile(storage, accountId, 'old.png', '5'.repeat(48) + '.png');
    const service = new AccountsService(prisma, storage);

    const replacement = service.replaceFile(accountId, fileInput());
    await storage.stageStarted;
    await service.deleteFile(accountId, FileCategory.AVATAR);
    storage.releaseStage();
    const result = await replacement;

    assert.equal(result.category, FileCategory.AVATAR);
    const live = await prisma.accountFile.findMany({ where: { accountId, category: FileCategory.AVATAR, deletedAt: null }, include: { file: true } });
    assert.equal(live.length, 1);
    assert.equal(live[0].file.state, FileAssetState.ACTIVE);
    assert.equal((await prisma.fileAsset.findUniqueOrThrow({ where: { id: oldId } })).state, FileAssetState.DELETED);
    await assertStorageMatchesMetadata(root);
    await service.reconcileIncompleteFileReplacements();
    await service.reconcileIncompleteFileReplacements();
    await assertStorageMatchesMetadata(root);
  });

  test('a soft delete racing a gated replacement prevents activation and leaves no untracked bytes', async () => {
    const root = await temporaryRoot();
    const storage = new BlockingStageStorage(root);
    const accountId = await createCtv();
    await activeFile(storage, accountId, 'old.png', '6'.repeat(48) + '.png');
    const service = new AccountsService(prisma, storage);

    const replacement = service.replaceFile(accountId, fileInput());
    await storage.stageStarted;
    await service.softDelete(accountId);
    storage.releaseStage();
    await assert.rejects(replacement);

    assert.ok((await prisma.account.findUniqueOrThrow({ where: { id: accountId } })).deletedAt);
    assert.equal(await prisma.accountFile.count({ where: { accountId, deletedAt: null } }), 0);
    assert.equal((await entries(root, 'active')).length, 0);
    assert.equal((await entries(root, 'staging')).length, 0);
    assert.equal((await entries(root, 'quarantine')).length, 0);
    assert.equal(await prisma.fileAsset.count({ where: { state: { in: [FileAssetState.STAGED, FileAssetState.QUARANTINED] } } }), 0);
    await assertStorageMatchesMetadata(root);
    await service.reconcileIncompleteFileReplacements();
    await assertStorageMatchesMetadata(root);
  });

  test('two concurrent replacements converge to one authorized file with no filesystem orphan', async () => {
    const root = await temporaryRoot();
    const storage = new BlockingTwoFinalizeStorage(root);
    const accountId = await createCtv();
    await activeFile(storage, accountId, 'old.png', '7'.repeat(48) + '.png');
    const service = new AccountsService(prisma, storage);

    const first = service.replaceFile(accountId, { ...fileInput(), originalName: 'first.png' });
    const second = service.replaceFile(accountId, { ...fileInput(), originalName: 'second.png' });
    await storage.bothFinalized;
    storage.releaseFinalizes();
    await Promise.all([first, second]);

    const live = await prisma.accountFile.findMany({ where: { accountId, category: FileCategory.AVATAR, deletedAt: null }, include: { file: true } });
    assert.equal(live.length, 1);
    assert.equal(live[0].file.state, FileAssetState.ACTIVE);
    await assertStorageMatchesMetadata(root);
    await service.reconcileIncompleteFileReplacements();
    await assertStorageMatchesMetadata(root);
  });
});

class FailingFinalizeStorage extends FileStorage {
  override async finalize(_file: StagedFile): Promise<void> { throw new Error('injected finalize failure'); }
}

class DeleteIntentAfterFinalizeStorage extends FileStorage {
  override async finalize(file: StagedFile): Promise<void> {
    await super.finalize(file);
    await prisma.accountFile.deleteMany({ where: { file: { storageKey: file.storageKey } } });
  }
}

class BlockingStageStorage extends FileStorage {
  private started!: () => void;
  private release!: () => void;
  readonly stageStarted = new Promise<void>((resolve) => { this.started = resolve; });
  private readonly stageRelease = new Promise<void>((resolve) => { this.release = resolve; });

  override async stage(input: StageFileInput, storageKey?: string): Promise<StagedFile> {
    if (input.originalName === 'avatar.png') { this.started(); await this.stageRelease; }
    return super.stage(input, storageKey);
  }

  releaseStage(): void { this.release(); }
}

class BlockingTwoFinalizeStorage extends FileStorage {
  private count = 0;
  private both!: () => void;
  private release!: () => void;
  readonly bothFinalized = new Promise<void>((resolve) => { this.both = resolve; });
  private readonly finalizesRelease = new Promise<void>((resolve) => { this.release = resolve; });

  override async finalize(file: StagedFile): Promise<void> {
    await super.finalize(file);
    if (file.originalName === 'old.png') return;
    this.count += 1;
    if (this.count === 2) this.both();
    await this.finalizesRelease;
  }

  releaseFinalizes(): void { this.release(); }
}

async function createCtv(): Promise<string> {
  const passwordHash = await argon2.hash('Secret123', { type: argon2.argon2id });
  return (await prisma.account.create({ data: { email: `ctv-${Date.now()}-${Math.random()}@example.vn`, passwordHash, role: AccountRole.CTV, status: AccountStatus.ACTIVE, displayName: 'CTV' } })).id;
}

async function activeFile(storage: FileStorage, accountId: string, name: string, key: string): Promise<string> {
  const input = { ...fileInput(), originalName: name };
  const staged = await storage.stage(input, key); await storage.finalize(staged);
  return (await prisma.fileAsset.create({ data: {
    storageKey: staged.storageKey, originalName: staged.originalName, mimeType: staged.mimeType,
    sizeBytes: staged.sizeBytes, sha256: staged.sha256, state: FileAssetState.ACTIVE,
    accountFiles: { create: { accountId, category: FileCategory.AVATAR } },
  } })).id;
}

function fileInput(): StageFileInput { return { category: FileCategory.AVATAR, originalName: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]) }; }
async function temporaryRoot(): Promise<string> { const root = await mkdtemp(join(tmpdir(), 'ctv-account-workflow-')); roots.push(root); return root; }
async function entries(root: string, area: string): Promise<string[]> { try { return await readdir(join(root, area)); } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; } }

async function assertStorageMatchesMetadata(root: string): Promise<void> {
  const assets = await prisma.fileAsset.findMany();
  const byArea = {
    staging: new Set(assets.filter((asset) => asset.state === FileAssetState.STAGED).map((asset) => asset.storageKey)),
    active: new Set(assets.filter((asset) => asset.state === FileAssetState.ACTIVE).map((asset) => asset.storageKey)),
    quarantine: new Set(assets.filter((asset) => asset.state === FileAssetState.QUARANTINED).map((asset) => asset.storageKey)),
  };
  for (const area of ['staging', 'active', 'quarantine'] as const) {
    assert.deepEqual(new Set(await entries(root, area)), byArea[area]);
  }
}

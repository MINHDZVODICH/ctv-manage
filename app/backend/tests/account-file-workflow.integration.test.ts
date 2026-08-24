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

import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { FileStorage, type StageFileInput, type StagedFile } from '../src/shared/file-storage.js';
import { prisma } from '../src/shared/prisma.js';
import { RegistrationRequestsService } from '../src/modules/registration-requests/registration-requests.service.js';
import { resetTestDatabase } from './test-database.js';

const allowedOrigin = 'http://localhost:5173';
const profile = {
  displayName: 'Nguyễn Văn Workflow',
  email: 'workflow@example.vn',
  phone: '0900000001',
  dateOfBirth: '2000-01-01',
  gender: 'MALE',
  address: 'Hà Nội',
  password: 'Secret123',
};
const roots: string[] = [];

describe.sequential('durable registration workflow', () => {
  beforeEach(async () => {
    await resetTestDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  });

  test('a concurrent same-key loser never stages or finalizes a second file', async () => {
    const root = await temporaryRoot();
    const storage = new BlockingFirstStageStorage(root);
    const app = createApp({ fileStorage: storage });
    const first = submit(app, 'concurrent-file', profile, true);
    await storage.firstStageStarted;

    const second = await submit(app, 'concurrent-file', profile, true);
    storage.releaseFirstStage();
    const firstResponse = await first;

    assert.deepEqual([firstResponse.status, second.status].sort(), [201, 409]);
    assert.equal(storage.stageCalls, 1);
    assert.equal(storage.finalizeCalls, 1);
    assert.equal(await prisma.registrationRequest.count(), 1);
    assert.equal(await prisma.fileAsset.count(), 1);
    assert.equal((await directoryEntries(root, 'active')).length, 1);
    assert.equal((await directoryEntries(root, 'staging')).length, 0);
  });

  test('a finalize failure never records a replayable success and leaves no orphan active bytes', async () => {
    const root = await temporaryRoot();
    const app = createApp({ fileStorage: new FailingFinalizeStorage(root) });

    const response = await submit(app, 'finalize-failure', profile, true);

    assert.equal(response.status, 500);
    assert.equal(await prisma.idempotencyRecord.count(), 0);
    assert.equal(await prisma.registrationRequest.count(), 0);
    assert.equal(await prisma.fileAsset.count({ where: { state: 'QUARANTINED' } }), 1);
    assert.equal((await directoryEntries(root, 'active')).length, 0);
    assert.equal((await directoryEntries(root, 'staging')).length, 0);
    assert.equal((await directoryEntries(root, 'quarantine')).length, 1);
  });

  test('a final completion transaction failure quarantines bytes and cannot replay 201', async () => {
    const root = await temporaryRoot();
    const app = createApp({ fileStorage: new DeleteReservationAfterFinalizeStorage(root) });

    const response = await submit(app, 'completion-failure', profile, true);
    const retry = await submit(app, 'completion-failure', profile, true);

    assert.equal(response.status, 500);
    assert.equal(retry.status, 500);
    assert.equal(await prisma.idempotencyRecord.count(), 0);
    assert.equal(await prisma.registrationRequest.count(), 0);
    assert.equal(await prisma.fileAsset.count({ where: { state: 'QUARANTINED' } }), 2);
    assert.equal((await directoryEntries(root, 'active')).length, 0);
    assert.equal((await directoryEntries(root, 'quarantine')).length, 2);
  });

  test('startup reconciliation completes an interrupted STAGED workflow without creating another request', async () => {
    const root = await temporaryRoot();
    const storage = new FileStorage(root);
    const staged = await storage.stage(fileInput(), 'a'.repeat(48) + '.png');
    const registration = await prisma.registrationRequest.create({
      data: {
        email: profile.email,
        passwordHash: '$argon2id$interrupted',
        displayName: profile.displayName,
        phone: profile.phone,
        files: {
          create: {
            category: 'CCCD_FRONT',
            file: {
              create: {
                storageKey: staged.storageKey,
                originalName: staged.originalName,
                mimeType: staged.mimeType,
                sizeBytes: staged.sizeBytes,
                sha256: staged.sha256,
                state: 'STAGED',
              },
            },
          },
        },
      },
    });
    await prisma.$executeRawUnsafe(
      'INSERT INTO "IdempotencyRecord" ("id", "scope", "fingerprintHash", "keyHash", "requestHash", "status", "resourceId", "expiresAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'idem-reconcile', 'registration:create', 'fingerprint-hash', 'key-hash', 'request-hash', 'IN_PROGRESS', registration.id,
      new Date('2026-08-26T00:00:00Z').getTime(), new Date('2026-08-25T00:00:00Z').getTime(), new Date('2026-08-25T00:00:00Z').getTime(),
    );

    const service = new RegistrationRequestsService(prisma, storage, () => new Date('2026-08-25T12:00:00Z'));
    await (service as unknown as { reconcileIncomplete: () => Promise<void> }).reconcileIncomplete();

    assert.equal(await prisma.registrationRequest.count(), 1);
    const file = await prisma.fileAsset.findFirstOrThrow();
    assert.equal(file.state, 'ACTIVE');
    await storage.open(file.storageKey);
    const record = await prisma.idempotencyRecord.findFirstOrThrow();
    assert.equal((record as unknown as { status: string }).status, 'COMPLETED');
    assert.equal((record as unknown as { responseStatus: number }).responseStatus, 201);
  });

  test('startup reconciliation marks missing quarantined bytes as deleted metadata', async () => {
    const root = await temporaryRoot();
    const storage = new FailingFinalizeStorage(root);
    const app = createApp({ fileStorage: storage });
    await submit(app, 'quarantine-reconcile', profile, true);
    const quarantined = await prisma.fileAsset.findFirstOrThrow({ where: { state: 'QUARANTINED' } });
    await rm(join(root, 'quarantine', quarantined.storageKey));

    await new RegistrationRequestsService(prisma, storage).reconcileIncomplete();

    assert.equal((await prisma.fileAsset.findUniqueOrThrow({ where: { id: quarantined.id } })).state, 'DELETED');
  });
});

class BlockingFirstStageStorage extends FileStorage {
  stageCalls = 0;
  finalizeCalls = 0;
  private start!: () => void;
  private release!: () => void;
  readonly firstStageStarted = new Promise<void>((resolve) => { this.start = resolve; });
  private readonly firstStageRelease = new Promise<void>((resolve) => { this.release = resolve; });

  override async stage(input: StageFileInput, storageKey?: string): Promise<StagedFile> {
    this.stageCalls += 1;
    if (this.stageCalls === 1) {
      this.start();
      await this.firstStageRelease;
    }
    return super.stage(input, storageKey);
  }

  override async finalize(file: StagedFile): Promise<void> {
    this.finalizeCalls += 1;
    await super.finalize(file);
  }

  releaseFirstStage(): void {
    this.release();
  }
}

class FailingFinalizeStorage extends FileStorage {
  override async finalize(_file: StagedFile): Promise<void> {
    throw new Error('injected finalize failure');
  }
}

class DeleteReservationAfterFinalizeStorage extends FileStorage {
  override async finalize(file: StagedFile): Promise<void> {
    await super.finalize(file);
    await prisma.idempotencyRecord.deleteMany();
  }
}

async function submit(
  app: ReturnType<typeof createApp>,
  key: string,
  submittedProfile: typeof profile,
  includeFile: boolean,
) {
  let submission = request(app)
    .post('/api/v1/registration-requests')
    .set('Origin', allowedOrigin)
    .set('User-Agent', 'workflow-test-agent')
    .set('Idempotency-Key', key)
    .field('profile', JSON.stringify(submittedProfile));
  if (includeFile) {
    submission = submission.attach('cccdFront', validPng(), { filename: 'cccd.png', contentType: 'image/png' });
  }
  return submission;
}

function fileInput(): StageFileInput {
  return {
    category: 'CCCD_FRONT',
    originalName: 'cccd.png',
    mimeType: 'image/png',
    buffer: validPng(),
  };
}

function validPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ctv-registration-workflow-'));
  roots.push(root);
  return root;
}

async function directoryEntries(root: string, area: string): Promise<string[]> {
  try {
    return await readdir(join(root, area));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

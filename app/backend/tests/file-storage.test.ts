import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, test } from 'vitest';
import { ApiError } from '../src/shared/api-error.js';
import { FileStorage } from '../src/shared/file-storage.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('FileStorage', () => {
  test('stages, finalizes, opens, and removes a validated private file', async () => {
    const root = await temporaryRoot();
    const storage = new FileStorage(root, { imageMaxBytes: 1024, cvMaxBytes: 2048 });
    const png = validPng();

    const staged = await storage.stage({
      category: 'CCCD_FRONT',
      originalName: 'mat-truoc.png',
      mimeType: 'image/png',
      buffer: png,
    });

    assert.equal(staged.sizeBytes, png.length);
    assert.match(staged.sha256, /^[a-f0-9]{64}$/);
    await storage.finalize(staged);
    const opened = await storage.open(staged.storageKey);
    assert.deepEqual(await readFile(opened.path), png);

    await storage.remove(staged.storageKey);
    await assert.rejects(storage.open(staged.storageKey), (error: unknown) => (
      error instanceof ApiError && error.code === 'FILE_NOT_FOUND'
    ));
  });

  test('rejects signature spoofing and files beyond the category byte limit', async () => {
    const root = await temporaryRoot();
    const storage = new FileStorage(root, { imageMaxBytes: 12, cvMaxBytes: 20 });

    await assert.rejects(storage.stage({
      category: 'CCCD_BACK',
      originalName: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-png'),
    }), (error: unknown) => error instanceof ApiError && error.code === 'UNSUPPORTED_FILE_TYPE');

    await assert.rejects(storage.stage({
      category: 'CCCD_FRONT',
      originalName: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([validPng(), Buffer.alloc(20)]),
    }), (error: unknown) => error instanceof ApiError && error.code === 'FILE_TOO_LARGE');
  });

  test('never resolves a storage key outside the private root', async () => {
    const storage = new FileStorage(await temporaryRoot());

    await assert.rejects(storage.open('../secret.txt'), (error: unknown) => (
      error instanceof ApiError && error.code === 'INVALID_STORAGE_KEY'
    ));
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ctv-file-storage-'));
  roots.push(root);
  return root;
}

function validPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}
